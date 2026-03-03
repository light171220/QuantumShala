import { QTensor } from '../core/tensor'
import { Variable } from '../core/variable'

export interface OptimizerConfig {
  lr?: number
  weightDecay?: number
}

export interface OptimizerState {
  step: number
  [key: string]: any
}

export abstract class Optimizer {
  readonly name: string
  protected _lr: number
  protected _weightDecay: number
  protected _params: Variable[]
  protected _state: Map<number, OptimizerState>
  protected _stepCount: number

  constructor(params: Variable[], config: OptimizerConfig = {}) {
    this.name = this.constructor.name
    this._lr = config.lr ?? 0.01
    this._weightDecay = config.weightDecay ?? 0
    this._params = params.filter(p => !p.frozen)
    this._state = new Map()
    this._stepCount = 0
  }

  get lr(): number {
    return this._lr
  }

  set lr(value: number) {
    this._lr = value
  }

  get params(): Variable[] {
    return this._params
  }

  get stepCount(): number {
    return this._stepCount
  }

  abstract step(): void

  zeroGrad(): void {
    for (const param of this._params) {
      param.zeroGrad()
    }
  }

  getState(param: Variable): OptimizerState {
    if (!this._state.has(param.id)) {
      this._state.set(param.id, { step: 0 })
    }
    return this._state.get(param.id)!
  }

  stateDict(): Map<number, OptimizerState> {
    return new Map(this._state)
  }

  loadStateDict(state: Map<number, OptimizerState>): void {
    this._state = new Map(state)
  }

  addParamGroup(params: Variable[]): void {
    const trainable = params.filter(p => !p.frozen)
    this._params.push(...trainable)
  }
}

export interface SGDConfig extends OptimizerConfig {
  momentum?: number
  dampening?: number
  nesterov?: boolean
}

export class SGD extends Optimizer {
  private _momentum: number
  private _dampening: number
  private _nesterov: boolean

  constructor(params: Variable[], config: SGDConfig = {}) {
    super(params, config)
    this._momentum = config.momentum ?? 0
    this._dampening = config.dampening ?? 0
    this._nesterov = config.nesterov ?? false

    if (this._nesterov && (this._momentum <= 0 || this._dampening !== 0)) {
      throw new Error('Nesterov momentum requires a momentum and zero dampening')
    }
  }

  step(): void {
    this._stepCount++

    for (const param of this._params) {
      if (!param.tensor.grad) continue

      const state = this.getState(param)
      state.step++

      let grad = param.tensor.grad.clone()

      if (this._weightDecay !== 0) {
        for (let i = 0; i < grad.data.length; i++) {
          grad.data[i] += this._weightDecay * param.data[i]
        }
      }

      if (this._momentum !== 0) {
        if (!state.momentumBuffer) {
          state.momentumBuffer = grad.clone()
        } else {
          const buf = state.momentumBuffer as QTensor
          for (let i = 0; i < buf.data.length; i++) {
            buf.data[i] = buf.data[i] * this._momentum + grad.data[i] * (1 - this._dampening)
          }
        }

        if (this._nesterov) {
          const buf = state.momentumBuffer as QTensor
          for (let i = 0; i < grad.data.length; i++) {
            grad.data[i] = grad.data[i] + this._momentum * buf.data[i]
          }
        } else {
          grad = state.momentumBuffer as QTensor
        }
      }

      for (let i = 0; i < param.data.length; i++) {
        param.data[i] -= this._lr * grad.data[i]
      }
    }
  }
}

export interface AdamConfig extends OptimizerConfig {
  betas?: [number, number]
  eps?: number
  amsgrad?: boolean
}

export class Adam extends Optimizer {
  private _beta1: number
  private _beta2: number
  private _eps: number
  private _amsgrad: boolean

  constructor(params: Variable[], config: AdamConfig = {}) {
    super(params, config)
    const betas = config.betas ?? [0.9, 0.999]
    this._beta1 = betas[0]
    this._beta2 = betas[1]
    this._eps = config.eps ?? 1e-8
    this._amsgrad = config.amsgrad ?? false
  }

  step(): void {
    this._stepCount++

    for (const param of this._params) {
      if (!param.tensor.grad) continue

      const state = this.getState(param)
      state.step++

      if (!state.expAvg) {
        state.expAvg = QTensor.zeros(param.shape)
        state.expAvgSq = QTensor.zeros(param.shape)
        if (this._amsgrad) {
          state.maxExpAvgSq = QTensor.zeros(param.shape)
        }
      }

      const expAvg = state.expAvg as QTensor
      const expAvgSq = state.expAvgSq as QTensor
      const grad = param.tensor.grad

      if (this._weightDecay !== 0) {
        for (let i = 0; i < grad.data.length; i++) {
          grad.data[i] += this._weightDecay * param.data[i]
        }
      }

      for (let i = 0; i < expAvg.data.length; i++) {
        expAvg.data[i] = this._beta1 * expAvg.data[i] + (1 - this._beta1) * grad.data[i]
        expAvgSq.data[i] = this._beta2 * expAvgSq.data[i] + (1 - this._beta2) * grad.data[i] * grad.data[i]
      }

      const biasCorrection1 = 1 - Math.pow(this._beta1, state.step)
      const biasCorrection2 = 1 - Math.pow(this._beta2, state.step)

      if (this._amsgrad) {
        const maxExpAvgSq = state.maxExpAvgSq as QTensor
        for (let i = 0; i < maxExpAvgSq.data.length; i++) {
          maxExpAvgSq.data[i] = Math.max(maxExpAvgSq.data[i], expAvgSq.data[i])
        }

        for (let i = 0; i < param.data.length; i++) {
          const mHat = expAvg.data[i] / biasCorrection1
          const vHat = maxExpAvgSq.data[i] / biasCorrection2
          param.data[i] -= this._lr * mHat / (Math.sqrt(vHat) + this._eps)
        }
      } else {
        for (let i = 0; i < param.data.length; i++) {
          const mHat = expAvg.data[i] / biasCorrection1
          const vHat = expAvgSq.data[i] / biasCorrection2
          param.data[i] -= this._lr * mHat / (Math.sqrt(vHat) + this._eps)
        }
      }
    }
  }
}

export interface AdamWConfig extends AdamConfig {}

export class AdamW extends Optimizer {
  private _beta1: number
  private _beta2: number
  private _eps: number
  private _amsgrad: boolean

  constructor(params: Variable[], config: AdamWConfig = {}) {
    super(params, config)
    const betas = config.betas ?? [0.9, 0.999]
    this._beta1 = betas[0]
    this._beta2 = betas[1]
    this._eps = config.eps ?? 1e-8
    this._amsgrad = config.amsgrad ?? false
  }

  step(): void {
    this._stepCount++

    for (const param of this._params) {
      if (!param.tensor.grad) continue

      const state = this.getState(param)
      state.step++

      if (!state.expAvg) {
        state.expAvg = QTensor.zeros(param.shape)
        state.expAvgSq = QTensor.zeros(param.shape)
        if (this._amsgrad) {
          state.maxExpAvgSq = QTensor.zeros(param.shape)
        }
      }

      const expAvg = state.expAvg as QTensor
      const expAvgSq = state.expAvgSq as QTensor
      const grad = param.tensor.grad

      if (this._weightDecay !== 0) {
        for (let i = 0; i < param.data.length; i++) {
          param.data[i] *= (1 - this._lr * this._weightDecay)
        }
      }

      for (let i = 0; i < expAvg.data.length; i++) {
        expAvg.data[i] = this._beta1 * expAvg.data[i] + (1 - this._beta1) * grad.data[i]
        expAvgSq.data[i] = this._beta2 * expAvgSq.data[i] + (1 - this._beta2) * grad.data[i] * grad.data[i]
      }

      const biasCorrection1 = 1 - Math.pow(this._beta1, state.step)
      const biasCorrection2 = 1 - Math.pow(this._beta2, state.step)

      for (let i = 0; i < param.data.length; i++) {
        const mHat = expAvg.data[i] / biasCorrection1
        const vHat = expAvgSq.data[i] / biasCorrection2
        param.data[i] -= this._lr * mHat / (Math.sqrt(vHat) + this._eps)
      }
    }
  }
}

export interface RMSpropConfig extends OptimizerConfig {
  alpha?: number
  eps?: number
  momentum?: number
  centered?: boolean
}

export class RMSprop extends Optimizer {
  private _alpha: number
  private _eps: number
  private _momentum: number
  private _centered: boolean

  constructor(params: Variable[], config: RMSpropConfig = {}) {
    super(params, config)
    this._alpha = config.alpha ?? 0.99
    this._eps = config.eps ?? 1e-8
    this._momentum = config.momentum ?? 0
    this._centered = config.centered ?? false
  }

  step(): void {
    this._stepCount++

    for (const param of this._params) {
      if (!param.tensor.grad) continue

      const state = this.getState(param)
      state.step++

      if (!state.squareAvg) {
        state.squareAvg = QTensor.zeros(param.shape)
        if (this._momentum > 0) {
          state.momentumBuffer = QTensor.zeros(param.shape)
        }
        if (this._centered) {
          state.gradAvg = QTensor.zeros(param.shape)
        }
      }

      const squareAvg = state.squareAvg as QTensor
      const grad = param.tensor.grad

      if (this._weightDecay !== 0) {
        for (let i = 0; i < grad.data.length; i++) {
          grad.data[i] += this._weightDecay * param.data[i]
        }
      }

      for (let i = 0; i < squareAvg.data.length; i++) {
        squareAvg.data[i] = this._alpha * squareAvg.data[i] + (1 - this._alpha) * grad.data[i] * grad.data[i]
      }

      let avg: QTensor
      if (this._centered) {
        const gradAvg = state.gradAvg as QTensor
        for (let i = 0; i < gradAvg.data.length; i++) {
          gradAvg.data[i] = this._alpha * gradAvg.data[i] + (1 - this._alpha) * grad.data[i]
        }
        avg = QTensor.zeros(param.shape)
        for (let i = 0; i < avg.data.length; i++) {
          avg.data[i] = squareAvg.data[i] - gradAvg.data[i] * gradAvg.data[i]
        }
      } else {
        avg = squareAvg
      }

      if (this._momentum > 0) {
        const buf = state.momentumBuffer as QTensor
        for (let i = 0; i < buf.data.length; i++) {
          buf.data[i] = this._momentum * buf.data[i] + grad.data[i] / (Math.sqrt(avg.data[i]) + this._eps)
        }
        for (let i = 0; i < param.data.length; i++) {
          param.data[i] -= this._lr * buf.data[i]
        }
      } else {
        for (let i = 0; i < param.data.length; i++) {
          param.data[i] -= this._lr * grad.data[i] / (Math.sqrt(avg.data[i]) + this._eps)
        }
      }
    }
  }
}

export interface AdagradConfig extends OptimizerConfig {
  lrDecay?: number
  eps?: number
  initialAccumulatorValue?: number
}

export class Adagrad extends Optimizer {
  private _lrDecay: number
  private _eps: number
  private _initialAccumulatorValue: number

  constructor(params: Variable[], config: AdagradConfig = {}) {
    super(params, config)
    this._lrDecay = config.lrDecay ?? 0
    this._eps = config.eps ?? 1e-10
    this._initialAccumulatorValue = config.initialAccumulatorValue ?? 0
  }

  step(): void {
    this._stepCount++

    for (const param of this._params) {
      if (!param.tensor.grad) continue

      const state = this.getState(param)
      state.step++

      if (!state.sum) {
        const data = new Float64Array(param.size)
        data.fill(this._initialAccumulatorValue)
        state.sum = new QTensor(data, param.shape)
      }

      const sum = state.sum as QTensor
      const grad = param.tensor.grad

      if (this._weightDecay !== 0) {
        for (let i = 0; i < grad.data.length; i++) {
          grad.data[i] += this._weightDecay * param.data[i]
        }
      }

      for (let i = 0; i < sum.data.length; i++) {
        sum.data[i] += grad.data[i] * grad.data[i]
      }

      const clr = this._lr / (1 + (state.step - 1) * this._lrDecay)

      for (let i = 0; i < param.data.length; i++) {
        param.data[i] -= clr * grad.data[i] / (Math.sqrt(sum.data[i]) + this._eps)
      }
    }
  }
}

export interface SPSAConfig extends OptimizerConfig {
  a?: number
  c?: number
  A?: number
  alpha?: number
  gamma?: number
}

export class SPSA extends Optimizer {
  private _a: number
  private _c: number
  private _A: number
  private _alpha: number
  private _gamma: number

  constructor(params: Variable[], config: SPSAConfig = {}) {
    super(params, config)
    this._a = config.a ?? 0.1
    this._c = config.c ?? 0.1
    this._A = config.A ?? 10
    this._alpha = config.alpha ?? 0.602
    this._gamma = config.gamma ?? 0.101
  }

  step(lossFn?: () => number): void {
    this._stepCount++
    const k = this._stepCount

    const ak = this._a / Math.pow(k + this._A, this._alpha)
    const ck = this._c / Math.pow(k, this._gamma)

    for (const param of this._params) {
      const delta = new Float64Array(param.size)
      for (let i = 0; i < param.size; i++) {
        delta[i] = Math.random() < 0.5 ? -1 : 1
      }

      const originalData = new Float64Array(param.data)

      for (let i = 0; i < param.size; i++) {
        param.data[i] = originalData[i] + ck * delta[i]
      }
      const lossPlus = lossFn ? lossFn() : 0

      for (let i = 0; i < param.size; i++) {
        param.data[i] = originalData[i] - ck * delta[i]
      }
      const lossMinus = lossFn ? lossFn() : 0

      for (let i = 0; i < param.size; i++) {
        param.data[i] = originalData[i]
      }

      const gradApprox = (lossPlus - lossMinus) / (2 * ck)

      for (let i = 0; i < param.size; i++) {
        param.data[i] -= ak * gradApprox * delta[i]
      }
    }
  }
}

export interface QNSPSAConfig extends SPSAConfig {
  regularization?: number
}

export class QNSPSA extends Optimizer {
  private _a: number
  private _c: number
  private _A: number
  private _alpha: number
  private _gamma: number
  private _regularization: number
  private _hessianEstimate: Map<number, QTensor>

  constructor(params: Variable[], config: QNSPSAConfig = {}) {
    super(params, config)
    this._a = config.a ?? 0.1
    this._c = config.c ?? 0.1
    this._A = config.A ?? 10
    this._alpha = config.alpha ?? 0.602
    this._gamma = config.gamma ?? 0.101
    this._regularization = config.regularization ?? 0.001
    this._hessianEstimate = new Map()
  }

  step(lossFn?: () => number): void {
    this._stepCount++
    const k = this._stepCount

    const ak = this._a / Math.pow(k + this._A, this._alpha)
    const ck = this._c / Math.pow(k, this._gamma)

    for (const param of this._params) {
      const n = param.size

      if (!this._hessianEstimate.has(param.id)) {
        const hessianData = new Float64Array(n * n)
        for (let i = 0; i < n; i++) {
          hessianData[i * n + i] = 1
        }
        this._hessianEstimate.set(param.id, new QTensor(hessianData, [n, n]))
      }

      const delta1 = new Float64Array(n)
      const delta2 = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        delta1[i] = Math.random() < 0.5 ? -1 : 1
        delta2[i] = Math.random() < 0.5 ? -1 : 1
      }

      const originalData = new Float64Array(param.data)

      for (let i = 0; i < n; i++) {
        param.data[i] = originalData[i] + ck * delta1[i]
      }
      const lossPlus1 = lossFn ? lossFn() : 0

      for (let i = 0; i < n; i++) {
        param.data[i] = originalData[i] - ck * delta1[i]
      }
      const lossMinus1 = lossFn ? lossFn() : 0

      for (let i = 0; i < n; i++) {
        param.data[i] = originalData[i]
      }

      const gradApprox = new Float64Array(n)
      const gradDiff = (lossPlus1 - lossMinus1) / (2 * ck)
      for (let i = 0; i < n; i++) {
        gradApprox[i] = gradDiff / delta1[i]
      }

      const H = this._hessianEstimate.get(param.id)!
      const Hinv = new Float64Array(n * n)
      for (let i = 0; i < n * n; i++) {
        Hinv[i] = H.data[i]
      }

      for (let i = 0; i < n; i++) {
        Hinv[i * n + i] += this._regularization
      }

      const direction = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        let sum = 0
        for (let j = 0; j < n; j++) {
          sum += Hinv[i * n + j] * gradApprox[j]
        }
        direction[i] = sum
      }

      for (let i = 0; i < n; i++) {
        param.data[i] -= ak * direction[i]
      }
    }
  }
}

export interface LRSchedulerConfig {
  lastEpoch?: number
}

export abstract class LRScheduler {
  protected _optimizer: Optimizer
  protected _lastEpoch: number
  protected _baseLrs: number[]

  constructor(optimizer: Optimizer, config: LRSchedulerConfig = {}) {
    this._optimizer = optimizer
    this._lastEpoch = config.lastEpoch ?? -1
    this._baseLrs = [optimizer.lr]
  }

  abstract getLR(): number[]

  step(epoch?: number): void {
    if (epoch === undefined) {
      this._lastEpoch++
    } else {
      this._lastEpoch = epoch
    }

    const lrs = this.getLR()
    this._optimizer.lr = lrs[0]
  }

  get lastEpoch(): number {
    return this._lastEpoch
  }
}

export interface StepLRConfig extends LRSchedulerConfig {
  stepSize: number
  gamma?: number
}

export class StepLR extends LRScheduler {
  private _stepSize: number
  private _gamma: number

  constructor(optimizer: Optimizer, config: StepLRConfig) {
    super(optimizer, config)
    this._stepSize = config.stepSize
    this._gamma = config.gamma ?? 0.1
  }

  getLR(): number[] {
    if (this._lastEpoch === 0 || this._lastEpoch % this._stepSize !== 0) {
      return [this._optimizer.lr]
    }
    return [this._optimizer.lr * this._gamma]
  }
}

export interface ExponentialLRConfig extends LRSchedulerConfig {
  gamma: number
}

export class ExponentialLR extends LRScheduler {
  private _gamma: number

  constructor(optimizer: Optimizer, config: ExponentialLRConfig) {
    super(optimizer, config)
    this._gamma = config.gamma
  }

  getLR(): number[] {
    if (this._lastEpoch === 0) {
      return this._baseLrs
    }
    return [this._optimizer.lr * this._gamma]
  }
}

export interface CosineAnnealingLRConfig extends LRSchedulerConfig {
  tMax: number
  etaMin?: number
}

export class CosineAnnealingLR extends LRScheduler {
  private _tMax: number
  private _etaMin: number

  constructor(optimizer: Optimizer, config: CosineAnnealingLRConfig) {
    super(optimizer, config)
    this._tMax = config.tMax
    this._etaMin = config.etaMin ?? 0
  }

  getLR(): number[] {
    if (this._lastEpoch === 0) {
      return this._baseLrs
    }

    const baseLr = this._baseLrs[0]
    const lr = this._etaMin + (baseLr - this._etaMin) * (1 + Math.cos(Math.PI * this._lastEpoch / this._tMax)) / 2
    return [lr]
  }
}

export interface ReduceLROnPlateauConfig extends LRSchedulerConfig {
  mode?: 'min' | 'max'
  factor?: number
  patience?: number
  threshold?: number
  thresholdMode?: 'rel' | 'abs'
  cooldown?: number
  minLr?: number
  eps?: number
}

export class ReduceLROnPlateau {
  private _optimizer: Optimizer
  private _mode: 'min' | 'max'
  private _factor: number
  private _patience: number
  private _threshold: number
  private _thresholdMode: 'rel' | 'abs'
  private _cooldown: number
  private _minLr: number
  private _eps: number
  private _best: number
  private _numBadEpochs: number
  private _cooldownCounter: number
  private _lastEpoch: number

  constructor(optimizer: Optimizer, config: ReduceLROnPlateauConfig = {}) {
    this._optimizer = optimizer
    this._mode = config.mode ?? 'min'
    this._factor = config.factor ?? 0.1
    this._patience = config.patience ?? 10
    this._threshold = config.threshold ?? 1e-4
    this._thresholdMode = config.thresholdMode ?? 'rel'
    this._cooldown = config.cooldown ?? 0
    this._minLr = config.minLr ?? 0
    this._eps = config.eps ?? 1e-8
    this._best = this._mode === 'min' ? Infinity : -Infinity
    this._numBadEpochs = 0
    this._cooldownCounter = 0
    this._lastEpoch = 0
  }

  step(metric: number): void {
    this._lastEpoch++

    if (this._cooldownCounter > 0) {
      this._cooldownCounter--
      this._numBadEpochs = 0
    }

    const improved = this._isBetter(metric)
    if (improved) {
      this._best = metric
      this._numBadEpochs = 0
    } else {
      this._numBadEpochs++
    }

    if (this._numBadEpochs > this._patience) {
      this._reduceLR()
      this._cooldownCounter = this._cooldown
      this._numBadEpochs = 0
    }
  }

  private _isBetter(metric: number): boolean {
    if (this._mode === 'min') {
      if (this._thresholdMode === 'rel') {
        return metric < this._best * (1 - this._threshold)
      }
      return metric < this._best - this._threshold
    } else {
      if (this._thresholdMode === 'rel') {
        return metric > this._best * (1 + this._threshold)
      }
      return metric > this._best + this._threshold
    }
  }

  private _reduceLR(): void {
    const oldLr = this._optimizer.lr
    const newLr = Math.max(oldLr * this._factor, this._minLr)
    if (oldLr - newLr > this._eps) {
      this._optimizer.lr = newLr
    }
  }
}

export function sgd(params: Variable[], config?: SGDConfig): SGD {
  return new SGD(params, config)
}

export function adam(params: Variable[], config?: AdamConfig): Adam {
  return new Adam(params, config)
}

export function adamw(params: Variable[], config?: AdamWConfig): AdamW {
  return new AdamW(params, config)
}

export function rmsprop(params: Variable[], config?: RMSpropConfig): RMSprop {
  return new RMSprop(params, config)
}

export function adagrad(params: Variable[], config?: AdagradConfig): Adagrad {
  return new Adagrad(params, config)
}

export function spsa(params: Variable[], config?: SPSAConfig): SPSA {
  return new SPSA(params, config)
}

export function qnspsa(params: Variable[], config?: QNSPSAConfig): QNSPSA {
  return new QNSPSA(params, config)
}

export function stepLR(optimizer: Optimizer, config: StepLRConfig): StepLR {
  return new StepLR(optimizer, config)
}

export function exponentialLR(optimizer: Optimizer, config: ExponentialLRConfig): ExponentialLR {
  return new ExponentialLR(optimizer, config)
}

export function cosineAnnealingLR(optimizer: Optimizer, config: CosineAnnealingLRConfig): CosineAnnealingLR {
  return new CosineAnnealingLR(optimizer, config)
}

export function reduceLROnPlateau(optimizer: Optimizer, config?: ReduceLROnPlateauConfig): ReduceLROnPlateau {
  return new ReduceLROnPlateau(optimizer, config)
}

export {
  Optimizer as TensorOptimizer,
  OptimizerConfig as TensorOptimizerConfig,
  OptimizerState as TensorOptimizerState,
  StepResult,
  SGD as TensorSGD,
  SGDConfig as TensorSGDConfig,
  Adam as TensorAdam,
  AdamConfig as TensorAdamConfig,
  RMSprop as TensorRMSprop,
  RMSpropConfig as TensorRMSpropConfig,
  Adagrad as TensorAdagrad,
  AdagradConfig as TensorAdagradConfig,
  Adadelta as TensorAdadelta,
  AdadeltaConfig as TensorAdadeltaConfig,
  AdamW as TensorAdamW,
  AdamWConfig as TensorAdamWConfig,
  NAG as TensorNAG,
  NAGConfig as TensorNAGConfig,
  QNG as TensorQNG,
  QNGConfig as TensorQNGConfig,
  SPSA as TensorSPSA,
  SPSAConfig as TensorSPSAConfig,
  OptimizerType,
  createOptimizer
} from './tensor-optimizers'
