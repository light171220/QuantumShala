export interface Callback {
  onTrainBegin?: () => void
  onTrainEnd?: () => void
  onEpochBegin?: (epoch: number) => void
  onEpochEnd?: (epoch: number, logs: CallbackLogs) => boolean
  onBatchBegin?: (batch: number) => void
  onBatchEnd?: (batch: number, logs: CallbackLogs) => void
}

export interface CallbackLogs {
  loss?: number
  accuracy?: number
  valLoss?: number
  valAccuracy?: number
  gradientNorm?: number
  learningRate?: number
  [key: string]: number | undefined
}

export class EarlyStopping implements Callback {
  private patience: number
  private minDelta: number
  private monitor: string
  private mode: 'min' | 'max'
  private bestValue: number
  private waitCount: number
  private stopped: boolean

  constructor(config: {
    patience?: number
    minDelta?: number
    monitor?: string
    mode?: 'min' | 'max'
  } = {}) {
    this.patience = config.patience ?? 10
    this.minDelta = config.minDelta ?? 0.0001
    this.monitor = config.monitor ?? 'loss'
    this.mode = config.mode ?? 'min'
    this.bestValue = this.mode === 'min' ? Infinity : -Infinity
    this.waitCount = 0
    this.stopped = false
  }

  onTrainBegin(): void {
    this.bestValue = this.mode === 'min' ? Infinity : -Infinity
    this.waitCount = 0
    this.stopped = false
  }

  onEpochEnd(_epoch: number, logs: CallbackLogs): boolean {
    const current = logs[this.monitor]
    if (current === undefined) return false

    const improved = this.mode === 'min'
      ? current < this.bestValue - this.minDelta
      : current > this.bestValue + this.minDelta

    if (improved) {
      this.bestValue = current
      this.waitCount = 0
    } else {
      this.waitCount++
      if (this.waitCount >= this.patience) {
        this.stopped = true
        return true
      }
    }

    return false
  }

  isStopped(): boolean {
    return this.stopped
  }
}

export class LearningRateScheduler implements Callback {
  private schedule: 'constant' | 'exponential' | 'cosine' | 'step'
  private initialLr: number
  private currentLr: number
  private decayRate: number
  private decaySteps: number
  private minLr: number
  private totalEpochs: number

  constructor(config: {
    schedule?: 'constant' | 'exponential' | 'cosine' | 'step'
    initialLr?: number
    decayRate?: number
    decaySteps?: number
    minLr?: number
    totalEpochs?: number
  } = {}) {
    this.schedule = config.schedule ?? 'constant'
    this.initialLr = config.initialLr ?? 0.01
    this.currentLr = this.initialLr
    this.decayRate = config.decayRate ?? 0.96
    this.decaySteps = config.decaySteps ?? 10
    this.minLr = config.minLr ?? 1e-6
    this.totalEpochs = config.totalEpochs ?? 100
  }

  onTrainBegin(): void {
    this.currentLr = this.initialLr
  }

  onEpochBegin(epoch: number): void {
    switch (this.schedule) {
      case 'exponential':
        this.currentLr = this.initialLr * Math.pow(this.decayRate, epoch)
        break
      case 'cosine':
        this.currentLr = this.minLr + 0.5 * (this.initialLr - this.minLr) *
          (1 + Math.cos(Math.PI * epoch / this.totalEpochs))
        break
      case 'step':
        this.currentLr = this.initialLr * Math.pow(this.decayRate, Math.floor(epoch / this.decaySteps))
        break
      case 'constant':
      default:
        break
    }

    this.currentLr = Math.max(this.currentLr, this.minLr)
  }

  getLearningRate(): number {
    return this.currentLr
  }
}

export class ModelCheckpoint implements Callback {
  private monitor: string
  private mode: 'min' | 'max'
  private bestValue: number
  private bestParams: number[] | null

  constructor(config: {
    monitor?: string
    mode?: 'min' | 'max'
  } = {}) {
    this.monitor = config.monitor ?? 'loss'
    this.mode = config.mode ?? 'min'
    this.bestValue = this.mode === 'min' ? Infinity : -Infinity
    this.bestParams = null
  }

  onTrainBegin(): void {
    this.bestValue = this.mode === 'min' ? Infinity : -Infinity
    this.bestParams = null
  }

  onEpochEnd(_epoch: number, logs: CallbackLogs & { params?: number[] }): boolean {
    const current = logs[this.monitor]
    if (current === undefined) return false

    const improved = this.mode === 'min'
      ? current < this.bestValue
      : current > this.bestValue

    if (improved && logs.params) {
      this.bestValue = current
      this.bestParams = [...logs.params]
    }

    return false
  }

  getBestParams(): number[] | null {
    return this.bestParams
  }

  getBestValue(): number {
    return this.bestValue
  }
}

export class GradientMonitor implements Callback {
  private history: { epoch: number; gradientNorm: number }[] = []
  private vanishingThreshold: number
  private explodingThreshold: number

  constructor(config: {
    vanishingThreshold?: number
    explodingThreshold?: number
  } = {}) {
    this.vanishingThreshold = config.vanishingThreshold ?? 1e-7
    this.explodingThreshold = config.explodingThreshold ?? 1e3
  }

  onTrainBegin(): void {
    this.history = []
  }

  onEpochEnd(epoch: number, logs: CallbackLogs): boolean {
    if (logs.gradientNorm !== undefined) {
      this.history.push({ epoch, gradientNorm: logs.gradientNorm })

      if (logs.gradientNorm < this.vanishingThreshold) {
        console.warn(`Vanishing gradients detected at epoch ${epoch}`)
      }
      if (logs.gradientNorm > this.explodingThreshold) {
        console.warn(`Exploding gradients detected at epoch ${epoch}`)
        return true
      }
    }
    return false
  }

  getHistory(): { epoch: number; gradientNorm: number }[] {
    return this.history
  }
}

export interface CallbacksConfig {
  earlyStopping?: {
    patience?: number
    minDelta?: number
    monitor?: string
    mode?: 'min' | 'max'
  }
  learningRateScheduler?: {
    schedule?: 'constant' | 'exponential' | 'cosine' | 'step'
    initialLr?: number
    decayRate?: number
    decaySteps?: number
    minLr?: number
    totalEpochs?: number
  }
  modelCheckpoint?: {
    monitor?: string
    mode?: 'min' | 'max'
    saveBest?: boolean
  }
  gradientMonitor?: {
    vanishingThreshold?: number
    explodingThreshold?: number
  }
}

export function createCallbacks(configs: CallbacksConfig): Callback[] {
  const callbacks: Callback[] = []

  if (configs.earlyStopping) {
    callbacks.push(new EarlyStopping(configs.earlyStopping))
  }
  if (configs.learningRateScheduler) {
    callbacks.push(new LearningRateScheduler(configs.learningRateScheduler))
  }
  if (configs.modelCheckpoint) {
    callbacks.push(new ModelCheckpoint(configs.modelCheckpoint))
  }
  if (configs.gradientMonitor) {
    callbacks.push(new GradientMonitor(configs.gradientMonitor))
  }

  return callbacks
}
