import { QTensor } from '../core/tensor'

export interface OptimizerConfig {
  learningRate?: number
  maxIterations?: number
  tolerance?: number
  clipNorm?: number
  clipValue?: number
}

export interface OptimizerState {
  step: number
  params: Map<number, Float64Array>
}

export interface StepResult {
  loss: number
  gradNorm: number
  step: number
}

export abstract class Optimizer {
  protected lr: number
  protected maxIterations: number
  protected tolerance: number
  protected clipNorm: number | null
  protected clipValue: number | null
  protected _step: number
  protected _state: Map<number, Record<string, Float64Array>>

  constructor(config?: OptimizerConfig) {
    this.lr = config?.learningRate ?? 0.01
    this.maxIterations = config?.maxIterations ?? 1000
    this.tolerance = config?.tolerance ?? 1e-8
    this.clipNorm = config?.clipNorm ?? null
    this.clipValue = config?.clipValue ?? null
    this._step = 0
    this._state = new Map()
  }

  get step(): number {
    return this._step
  }

  get learningRate(): number {
    return this.lr
  }

  set learningRate(value: number) {
    this.lr = value
  }

  abstract computeUpdate(param: QTensor, grad: QTensor): Float64Array

  update(params: QTensor[]): StepResult {
    this._step++

    const grads = params.map(p => p.grad)
    const validGrads = grads.filter((g): g is QTensor => g !== null)

    if (validGrads.length === 0) {
      return { loss: 0, gradNorm: 0, step: this._step }
    }

    if (this.clipNorm !== null) {
      this.clipGradientNorm(validGrads)
    }

    if (this.clipValue !== null) {
      this.clipGradientValue(validGrads)
    }

    let gradNorm = 0
    for (const grad of validGrads) {
      gradNorm += this.computeNorm(grad.data)
    }
    gradNorm = Math.sqrt(gradNorm)

    for (let i = 0; i < params.length; i++) {
      const param = params[i]
      const grad = param.grad

      if (!grad) continue

      const update = this.computeUpdate(param, grad)

      for (let j = 0; j < param.data.length; j++) {
        param.data[j] -= update[j]
      }
    }

    return { loss: 0, gradNorm, step: this._step }
  }

  step_update(params: QTensor[], gradients: QTensor[]): StepResult {
    this._step++

    if (this.clipNorm !== null) {
      this.clipGradientNorm(gradients)
    }

    if (this.clipValue !== null) {
      this.clipGradientValue(gradients)
    }

    let gradNorm = 0
    for (const grad of gradients) {
      gradNorm += this.computeNorm(grad.data)
    }
    gradNorm = Math.sqrt(gradNorm)

    for (let i = 0; i < params.length; i++) {
      const param = params[i]
      const grad = gradients[i]

      if (!grad) continue

      const update = this.computeUpdate(param, grad)

      for (let j = 0; j < param.data.length; j++) {
        param.data[j] -= update[j]
      }
    }

    return { loss: 0, gradNorm, step: this._step }
  }

  minimize(
    lossFn: () => QTensor,
    params: QTensor[],
    options?: { maxIter?: number; callback?: (step: number, loss: number) => void }
  ): { finalLoss: number; steps: number; converged: boolean } {
    const maxIter = options?.maxIter ?? this.maxIterations
    let prevLoss = Infinity
    let converged = false

    for (let i = 0; i < maxIter; i++) {
      this.zeroGrad(params)

      const loss = lossFn()
      const lossValue = loss.item()

      if (options?.callback) {
        options.callback(i, lossValue)
      }

      if (Math.abs(prevLoss - lossValue) < this.tolerance) {
        converged = true
        return { finalLoss: lossValue, steps: i, converged }
      }

      prevLoss = lossValue
      this.update(params)
    }

    return { finalLoss: prevLoss, steps: maxIter, converged }
  }

  zeroGrad(params: QTensor[]): void {
    for (const param of params) {
      if (param.grad) {
        for (let i = 0; i < param.grad.data.length; i++) {
          param.grad.data[i] = 0
        }
      }
    }
  }

  protected clipGradientNorm(grads: QTensor[]): void {
    if (this.clipNorm === null) return

    let totalNorm = 0
    for (const grad of grads) {
      totalNorm += this.computeNorm(grad.data)
    }
    totalNorm = Math.sqrt(totalNorm)

    if (totalNorm > this.clipNorm) {
      const scale = this.clipNorm / totalNorm
      for (const grad of grads) {
        for (let i = 0; i < grad.data.length; i++) {
          grad.data[i] *= scale
        }
      }
    }
  }

  protected clipGradientValue(grads: QTensor[]): void {
    if (this.clipValue === null) return

    for (const grad of grads) {
      for (let i = 0; i < grad.data.length; i++) {
        grad.data[i] = Math.max(-this.clipValue, Math.min(this.clipValue, grad.data[i]))
      }
    }
  }

  protected computeNorm(data: Float64Array): number {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i]
    }
    return sum
  }

  protected getState(paramId: number): Record<string, Float64Array> {
    if (!this._state.has(paramId)) {
      this._state.set(paramId, {})
    }
    return this._state.get(paramId)!
  }

  protected getOrCreateStateBuffer(paramId: number, key: string, size: number): Float64Array {
    const state = this.getState(paramId)
    if (!state[key]) {
      state[key] = new Float64Array(size)
    }
    return state[key]
  }

  reset(): void {
    this._step = 0
    this._state.clear()
  }

  state_dict(): OptimizerState {
    const params = new Map<number, Float64Array>()
    const entries = Array.from(this._state.entries())
    for (let i = 0; i < entries.length; i++) {
      const [id, state] = entries[i]
      const stateEntries = Object.entries(state)
      for (let j = 0; j < stateEntries.length; j++) {
        const [, data] = stateEntries[j]
        params.set(id, new Float64Array(data))
      }
    }
    return { step: this._step, params }
  }

  load_state_dict(state: OptimizerState): void {
    this._step = state.step
  }
}

export interface SGDConfig extends OptimizerConfig {
  momentum?: number
  dampening?: number
  nesterov?: boolean
  weightDecay?: number
}

export class SGD extends Optimizer {
  private momentum: number
  private dampening: number
  private nesterov: boolean
  private weightDecay: number

  constructor(config?: SGDConfig) {
    super(config)
    this.momentum = config?.momentum ?? 0
    this.dampening = config?.dampening ?? 0
    this.nesterov = config?.nesterov ?? false
    this.weightDecay = config?.weightDecay ?? 0
  }

  computeUpdate(param: QTensor, grad: QTensor): Float64Array {
    const update = new Float64Array(param.data.length)
    const gradData = grad.data

    for (let i = 0; i < param.data.length; i++) {
      let g = gradData[i]

      if (this.weightDecay !== 0) {
        g += this.weightDecay * param.data[i]
      }

      if (this.momentum !== 0) {
        const velocity = this.getOrCreateStateBuffer(param.id, 'velocity', param.data.length)

        if (this._step > 1) {
          velocity[i] = this.momentum * velocity[i] + (1 - this.dampening) * g
        } else {
          velocity[i] = g
        }

        if (this.nesterov) {
          g = g + this.momentum * velocity[i]
        } else {
          g = velocity[i]
        }
      }

      update[i] = this.lr * g
    }

    return update
  }
}

export interface AdamConfig extends OptimizerConfig {
  beta1?: number
  beta2?: number
  epsilon?: number
  amsgrad?: boolean
  weightDecay?: number
}

export class Adam extends Optimizer {
  private beta1: number
  private beta2: number
  private epsilon: number
  private amsgrad: boolean
  private weightDecay: number

  constructor(config?: AdamConfig) {
    super(config)
    this.beta1 = config?.beta1 ?? 0.9
    this.beta2 = config?.beta2 ?? 0.999
    this.epsilon = config?.epsilon ?? 1e-8
    this.amsgrad = config?.amsgrad ?? false
    this.weightDecay = config?.weightDecay ?? 0
  }

  computeUpdate(param: QTensor, grad: QTensor): Float64Array {
    const update = new Float64Array(param.data.length)
    const gradData = grad.data

    const m = this.getOrCreateStateBuffer(param.id, 'm', param.data.length)
    const v = this.getOrCreateStateBuffer(param.id, 'v', param.data.length)

    let vMax: Float64Array | null = null
    if (this.amsgrad) {
      vMax = this.getOrCreateStateBuffer(param.id, 'v_max', param.data.length)
    }

    const biasCorrection1 = 1 - Math.pow(this.beta1, this._step)
    const biasCorrection2 = 1 - Math.pow(this.beta2, this._step)

    for (let i = 0; i < param.data.length; i++) {
      let g = gradData[i]

      if (this.weightDecay !== 0) {
        g += this.weightDecay * param.data[i]
      }

      m[i] = this.beta1 * m[i] + (1 - this.beta1) * g
      v[i] = this.beta2 * v[i] + (1 - this.beta2) * g * g

      const mHat = m[i] / biasCorrection1
      let vHat = v[i] / biasCorrection2

      if (this.amsgrad && vMax) {
        vMax[i] = Math.max(vMax[i], v[i])
        vHat = vMax[i] / biasCorrection2
      }

      update[i] = this.lr * mHat / (Math.sqrt(vHat) + this.epsilon)
    }

    return update
  }
}

export interface RMSpropConfig extends OptimizerConfig {
  alpha?: number
  epsilon?: number
  momentum?: number
  centered?: boolean
  weightDecay?: number
}

export class RMSprop extends Optimizer {
  private alpha: number
  private epsilon: number
  private momentum: number
  private centered: boolean
  private weightDecay: number

  constructor(config?: RMSpropConfig) {
    super(config)
    this.alpha = config?.alpha ?? 0.99
    this.epsilon = config?.epsilon ?? 1e-8
    this.momentum = config?.momentum ?? 0
    this.centered = config?.centered ?? false
    this.weightDecay = config?.weightDecay ?? 0
  }

  computeUpdate(param: QTensor, grad: QTensor): Float64Array {
    const update = new Float64Array(param.data.length)
    const gradData = grad.data

    const squareAvg = this.getOrCreateStateBuffer(param.id, 'square_avg', param.data.length)

    let gradAvg: Float64Array | null = null
    if (this.centered) {
      gradAvg = this.getOrCreateStateBuffer(param.id, 'grad_avg', param.data.length)
    }

    let momentum: Float64Array | null = null
    if (this.momentum > 0) {
      momentum = this.getOrCreateStateBuffer(param.id, 'momentum', param.data.length)
    }

    for (let i = 0; i < param.data.length; i++) {
      let g = gradData[i]

      if (this.weightDecay !== 0) {
        g += this.weightDecay * param.data[i]
      }

      squareAvg[i] = this.alpha * squareAvg[i] + (1 - this.alpha) * g * g

      let avg = squareAvg[i]

      if (this.centered && gradAvg) {
        gradAvg[i] = this.alpha * gradAvg[i] + (1 - this.alpha) * g
        avg = squareAvg[i] - gradAvg[i] * gradAvg[i]
      }

      if (this.momentum > 0 && momentum) {
        momentum[i] = this.momentum * momentum[i] + g / (Math.sqrt(avg) + this.epsilon)
        update[i] = this.lr * momentum[i]
      } else {
        update[i] = this.lr * g / (Math.sqrt(avg) + this.epsilon)
      }
    }

    return update
  }
}

export interface AdagradConfig extends OptimizerConfig {
  lrDecay?: number
  epsilon?: number
  initialAccumulatorValue?: number
  weightDecay?: number
}

export class Adagrad extends Optimizer {
  private lrDecay: number
  private epsilon: number
  private initialAccumulatorValue: number
  private weightDecay: number

  constructor(config?: AdagradConfig) {
    super(config)
    this.lrDecay = config?.lrDecay ?? 0
    this.epsilon = config?.epsilon ?? 1e-10
    this.initialAccumulatorValue = config?.initialAccumulatorValue ?? 0
    this.weightDecay = config?.weightDecay ?? 0
  }

  computeUpdate(param: QTensor, grad: QTensor): Float64Array {
    const update = new Float64Array(param.data.length)
    const gradData = grad.data

    const sumSq = this.getOrCreateStateBuffer(param.id, 'sum_sq', param.data.length)

    if (this._step === 1 && this.initialAccumulatorValue !== 0) {
      for (let i = 0; i < sumSq.length; i++) {
        sumSq[i] = this.initialAccumulatorValue
      }
    }

    const clr = this.lr / (1 + (this._step - 1) * this.lrDecay)

    for (let i = 0; i < param.data.length; i++) {
      let g = gradData[i]

      if (this.weightDecay !== 0) {
        g += this.weightDecay * param.data[i]
      }

      sumSq[i] += g * g

      update[i] = clr * g / (Math.sqrt(sumSq[i]) + this.epsilon)
    }

    return update
  }
}

export interface AdadeltaConfig extends OptimizerConfig {
  rho?: number
  epsilon?: number
  weightDecay?: number
}

export class Adadelta extends Optimizer {
  private rho: number
  private epsilon: number
  private weightDecay: number

  constructor(config?: AdadeltaConfig) {
    super(config)
    this.rho = config?.rho ?? 0.9
    this.epsilon = config?.epsilon ?? 1e-6
    this.weightDecay = config?.weightDecay ?? 0
  }

  computeUpdate(param: QTensor, grad: QTensor): Float64Array {
    const update = new Float64Array(param.data.length)
    const gradData = grad.data

    const squareAvg = this.getOrCreateStateBuffer(param.id, 'square_avg', param.data.length)
    const accDelta = this.getOrCreateStateBuffer(param.id, 'acc_delta', param.data.length)

    for (let i = 0; i < param.data.length; i++) {
      let g = gradData[i]

      if (this.weightDecay !== 0) {
        g += this.weightDecay * param.data[i]
      }

      squareAvg[i] = this.rho * squareAvg[i] + (1 - this.rho) * g * g

      const std = Math.sqrt(accDelta[i] + this.epsilon)
      const delta = std / Math.sqrt(squareAvg[i] + this.epsilon) * g

      accDelta[i] = this.rho * accDelta[i] + (1 - this.rho) * delta * delta

      update[i] = delta
    }

    return update
  }
}

export interface AdamWConfig extends AdamConfig {
  weightDecay?: number
}

export class AdamW extends Optimizer {
  private beta1: number
  private beta2: number
  private epsilon: number
  private amsgrad: boolean
  private weightDecay: number

  constructor(config?: AdamWConfig) {
    super(config)
    this.beta1 = config?.beta1 ?? 0.9
    this.beta2 = config?.beta2 ?? 0.999
    this.epsilon = config?.epsilon ?? 1e-8
    this.amsgrad = config?.amsgrad ?? false
    this.weightDecay = config?.weightDecay ?? 0.01
  }

  computeUpdate(param: QTensor, grad: QTensor): Float64Array {
    const update = new Float64Array(param.data.length)
    const gradData = grad.data

    const m = this.getOrCreateStateBuffer(param.id, 'm', param.data.length)
    const v = this.getOrCreateStateBuffer(param.id, 'v', param.data.length)

    let vMax: Float64Array | null = null
    if (this.amsgrad) {
      vMax = this.getOrCreateStateBuffer(param.id, 'v_max', param.data.length)
    }

    const biasCorrection1 = 1 - Math.pow(this.beta1, this._step)
    const biasCorrection2 = 1 - Math.pow(this.beta2, this._step)

    for (let i = 0; i < param.data.length; i++) {
      const g = gradData[i]

      m[i] = this.beta1 * m[i] + (1 - this.beta1) * g
      v[i] = this.beta2 * v[i] + (1 - this.beta2) * g * g

      const mHat = m[i] / biasCorrection1
      let vHat = v[i] / biasCorrection2

      if (this.amsgrad && vMax) {
        vMax[i] = Math.max(vMax[i], v[i])
        vHat = vMax[i] / biasCorrection2
      }

      update[i] = this.lr * (mHat / (Math.sqrt(vHat) + this.epsilon) + this.weightDecay * param.data[i])
    }

    return update
  }
}

export interface NAGConfig extends OptimizerConfig {
  momentum?: number
  weightDecay?: number
}

export class NAG extends Optimizer {
  private momentum: number
  private weightDecay: number

  constructor(config?: NAGConfig) {
    super(config)
    this.momentum = config?.momentum ?? 0.9
    this.weightDecay = config?.weightDecay ?? 0
  }

  computeUpdate(param: QTensor, grad: QTensor): Float64Array {
    const update = new Float64Array(param.data.length)
    const gradData = grad.data

    const velocity = this.getOrCreateStateBuffer(param.id, 'velocity', param.data.length)

    for (let i = 0; i < param.data.length; i++) {
      let g = gradData[i]

      if (this.weightDecay !== 0) {
        g += this.weightDecay * param.data[i]
      }

      const vPrev = velocity[i]
      velocity[i] = this.momentum * velocity[i] - this.lr * g

      update[i] = -this.momentum * vPrev + (1 + this.momentum) * velocity[i]
      update[i] = -update[i]
    }

    return update
  }
}

export interface QNGConfig extends OptimizerConfig {
  approximation?: 'block-diagonal' | 'diagonal'
  regularization?: number
}

export class QNG extends Optimizer {
  private approximation: 'block-diagonal' | 'diagonal'
  private regularization: number

  constructor(config?: QNGConfig) {
    super(config)
    this.approximation = config?.approximation ?? 'diagonal'
    this.regularization = config?.regularization ?? 1e-3
  }

  computeUpdate(param: QTensor, grad: QTensor): Float64Array {
    const update = new Float64Array(param.data.length)
    const gradData = grad.data

    const metricDiag = this.getOrCreateStateBuffer(param.id, 'metric_diag', param.data.length)

    for (let i = 0; i < param.data.length; i++) {
      const g = gradData[i]

      const metricValue = Math.max(metricDiag[i], this.regularization)

      update[i] = this.lr * g / metricValue
    }

    return update
  }

  updateMetric(param: QTensor, metricValues: Float64Array): void {
    const metricDiag = this.getOrCreateStateBuffer(param.id, 'metric_diag', param.data.length)
    for (let i = 0; i < metricDiag.length; i++) {
      metricDiag[i] = metricValues[i]
    }
  }
}

export interface SPSAConfig extends OptimizerConfig {
  perturbation?: number
  perturbationDecay?: number
  learningRateDecay?: number
  blocking?: boolean
  resamplingFactor?: number
}

export class SPSA extends Optimizer {
  private perturbation: number
  private perturbationDecay: number
  private learningRateDecay: number
  private blocking: boolean
  private resamplingFactor: number

  constructor(config?: SPSAConfig) {
    super(config)
    this.perturbation = config?.perturbation ?? 0.1
    this.perturbationDecay = config?.perturbationDecay ?? 0.101
    this.learningRateDecay = config?.learningRateDecay ?? 0.602
    this.blocking = config?.blocking ?? false
    this.resamplingFactor = config?.resamplingFactor ?? 1
  }

  computeUpdate(param: QTensor, grad: QTensor): Float64Array {
    const update = new Float64Array(param.data.length)
    const gradData = grad.data

    const ak = this.lr / Math.pow(this._step + 1, this.learningRateDecay)

    for (let i = 0; i < param.data.length; i++) {
      update[i] = ak * gradData[i]
    }

    return update
  }

  estimateGradient(
    lossFn: (params: Float64Array) => number,
    params: Float64Array
  ): Float64Array {
    const n = params.length
    const gradient = new Float64Array(n)

    const ck = this.perturbation / Math.pow(this._step + 1, this.perturbationDecay)

    for (let r = 0; r < this.resamplingFactor; r++) {
      const delta = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        delta[i] = Math.random() < 0.5 ? -1 : 1
      }

      const paramsPlus = new Float64Array(n)
      const paramsMinus = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        paramsPlus[i] = params[i] + ck * delta[i]
        paramsMinus[i] = params[i] - ck * delta[i]
      }

      const lossPlus = lossFn(paramsPlus)
      const lossMinus = lossFn(paramsMinus)

      for (let i = 0; i < n; i++) {
        gradient[i] += (lossPlus - lossMinus) / (2 * ck * delta[i])
      }
    }

    for (let i = 0; i < n; i++) {
      gradient[i] /= this.resamplingFactor
    }

    return gradient
  }
}

export function sgd(config?: SGDConfig): SGD {
  return new SGD(config)
}

export function adam(config?: AdamConfig): Adam {
  return new Adam(config)
}

export function rmsprop(config?: RMSpropConfig): RMSprop {
  return new RMSprop(config)
}

export function adagrad(config?: AdagradConfig): Adagrad {
  return new Adagrad(config)
}

export function adadelta(config?: AdadeltaConfig): Adadelta {
  return new Adadelta(config)
}

export function adamw(config?: AdamWConfig): AdamW {
  return new AdamW(config)
}

export function nag(config?: NAGConfig): NAG {
  return new NAG(config)
}

export function qng(config?: QNGConfig): QNG {
  return new QNG(config)
}

export function spsa(config?: SPSAConfig): SPSA {
  return new SPSA(config)
}

export type OptimizerType = 'sgd' | 'adam' | 'rmsprop' | 'adagrad' | 'adadelta' | 'adamw' | 'nag' | 'qng' | 'spsa'

export function createOptimizer(type: OptimizerType, config?: OptimizerConfig): Optimizer {
  switch (type) {
    case 'sgd':
      return new SGD(config as SGDConfig)
    case 'adam':
      return new Adam(config as AdamConfig)
    case 'rmsprop':
      return new RMSprop(config as RMSpropConfig)
    case 'adagrad':
      return new Adagrad(config as AdagradConfig)
    case 'adadelta':
      return new Adadelta(config as AdadeltaConfig)
    case 'adamw':
      return new AdamW(config as AdamWConfig)
    case 'nag':
      return new NAG(config as NAGConfig)
    case 'qng':
      return new QNG(config as QNGConfig)
    case 'spsa':
      return new SPSA(config as SPSAConfig)
    default:
      throw new Error(`Unknown optimizer type: ${type}`)
  }
}
