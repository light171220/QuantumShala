import { QTensor, Shape } from '../core/tensor'
import { Variable, VariableCollection } from '../core/variable'
import { QuantumTape } from '../autodiff/tape'
import { Device, getDevice } from '../devices/base-device'
import { QNode, qnode } from '../circuit/qnode'
import { QuantumLayer, ForwardContext, LayerConfig, Sequential } from './layers'
import { grad } from '../autodiff/backward'

export interface HybridLayerConfig extends LayerConfig {
  device?: string
  diffMethod?: 'parameter-shift' | 'adjoint' | 'backprop' | 'finite-diff'
  shots?: number | null
}

export abstract class HybridLayer {
  readonly name: string
  protected _trainable: boolean
  protected _variables: VariableCollection
  protected _built: boolean
  protected _device: string
  protected _diffMethod: 'parameter-shift' | 'adjoint' | 'backprop' | 'finite-diff'
  protected _shots: number | null

  constructor(config: HybridLayerConfig = {}) {
    this.name = config.name ?? this.constructor.name
    this._trainable = config.trainable ?? true
    this._variables = new VariableCollection()
    this._built = false
    this._device = config.device ?? 'default.qubit'
    this._diffMethod = config.diffMethod ?? 'parameter-shift'
    this._shots = config.shots ?? null
  }

  get trainable(): boolean {
    return this._trainable
  }

  set trainable(value: boolean) {
    this._trainable = value
    if (value) {
      this._variables.unfreeze()
    } else {
      this._variables.freeze()
    }
  }

  get variables(): VariableCollection {
    return this._variables
  }

  get built(): boolean {
    return this._built
  }

  abstract forward(inputs: QTensor): QTensor

  abstract backward(gradOutputs: QTensor): QTensor

  build(inputShape?: Shape): void {
    this._built = true
  }

  call(inputs: QTensor): QTensor {
    if (!this._built) {
      this.build(inputs.shape)
    }
    return this.forward(inputs)
  }

  getWeights(): QTensor[] {
    return this._variables.tensors()
  }

  setWeights(weights: QTensor[]): void {
    const vars = this._variables.all()
    if (weights.length !== vars.length) {
      throw new Error(`Expected ${vars.length} weights, got ${weights.length}`)
    }
    for (let i = 0; i < vars.length; i++) {
      vars[i].update(weights[i].data)
    }
  }

  countParams(): number {
    return this._variables.totalParameters()
  }

  trainableParams(): number {
    return this._variables.trainableParameters()
  }

  freeze(): void {
    this._trainable = false
    this._variables.freeze()
  }

  unfreeze(): void {
    this._trainable = true
    this._variables.unfreeze()
  }

  parameters(): Variable[] {
    return this._variables.trainable()
  }

  zeroGrad(): void {
    this._variables.zeroGrad()
  }

  toString(): string {
    return `${this.name}(params=${this.countParams()}, trainable=${this._trainable})`
  }
}

export interface QuantumLinearConfig extends HybridLayerConfig {
  inputFeatures: number
  outputFeatures: number
  numQubits?: number
  numLayers?: number
  bias?: boolean
}

export class QuantumLinear extends HybridLayer {
  readonly inputFeatures: number
  readonly outputFeatures: number
  readonly numQubits: number
  readonly numLayers: number
  readonly useBias: boolean
  private _qnode: QNode | null

  constructor(config: QuantumLinearConfig) {
    super(config)
    this.inputFeatures = config.inputFeatures
    this.outputFeatures = config.outputFeatures
    this.numQubits = config.numQubits ?? Math.max(
      Math.ceil(Math.log2(config.inputFeatures + 1)),
      Math.ceil(Math.log2(config.outputFeatures + 1))
    )
    this.numLayers = config.numLayers ?? 2
    this.useBias = config.bias ?? true
    this._qnode = null
  }

  build(inputShape?: Shape): void {
    const numWeights = this.numLayers * this.numQubits * 3
    const weights = Variable.xavier([numWeights], {
      name: `${this.name}_weights`
    })
    this._variables.add(weights)

    if (this.useBias) {
      const bias = Variable.zeros([this.outputFeatures], {
        name: `${this.name}_bias`
      })
      this._variables.add(bias)
    }

    this._qnode = new QNode(
      (...args) => this._circuitFn(...args),
      {
        device: this._device,
        diffMethod: this._diffMethod,
        shots: this._shots ?? undefined
      }
    )

    this._built = true
  }

  private _circuitFn(...args: (QTensor | number)[]): void {
  }

  forward(inputs: QTensor): QTensor {
    if (!this._built) {
      this.build(inputs.shape)
    }

    const batchSize = inputs.shape[0] ?? 1
    const outputData = new Float64Array(batchSize * this.outputFeatures)
    const weights = this._variables.get(`${this.name}_weights`)!

    for (let b = 0; b < batchSize; b++) {
      const inputSlice = inputs.shape.length > 1
        ? new Float64Array(inputs.data.slice(b * this.inputFeatures, (b + 1) * this.inputFeatures))
        : inputs.data

      for (let o = 0; o < this.outputFeatures; o++) {
        let result = 0
        for (let i = 0; i < this.inputFeatures; i++) {
          const idx = (o * this.inputFeatures + i) % weights.size
          result += inputSlice[i] * Math.tanh(weights.get(idx))
        }
        outputData[b * this.outputFeatures + o] = result
      }
    }

    const output = new QTensor(outputData, [batchSize, this.outputFeatures], {
      dtype: 'float64',
      requiresGrad: inputs.requiresGrad || weights.requiresGrad
    })

    if (this.useBias) {
      const bias = this._variables.get(`${this.name}_bias`)!
      for (let b = 0; b < batchSize; b++) {
        for (let o = 0; o < this.outputFeatures; o++) {
          output.data[b * this.outputFeatures + o] += bias.get(o)
        }
      }
    }

    return output
  }

  backward(gradOutputs: QTensor): QTensor {
    const weights = this._variables.get(`${this.name}_weights`)!
    const batchSize = gradOutputs.shape[0] ?? 1

    const gradInputData = new Float64Array(batchSize * this.inputFeatures)

    for (let b = 0; b < batchSize; b++) {
      for (let i = 0; i < this.inputFeatures; i++) {
        let gradSum = 0
        for (let o = 0; o < this.outputFeatures; o++) {
          const idx = (o * this.inputFeatures + i) % weights.size
          gradSum += gradOutputs.data[b * this.outputFeatures + o] * Math.tanh(weights.get(idx))
        }
        gradInputData[b * this.inputFeatures + i] = gradSum
      }
    }

    return new QTensor(gradInputData, [batchSize, this.inputFeatures], { dtype: 'float64' })
  }
}

export interface QuantumConvConfig extends HybridLayerConfig {
  inChannels: number
  outChannels: number
  kernelSize: number | [number, number]
  stride?: number | [number, number]
  padding?: number | [number, number]
  numQubits?: number
  numLayers?: number
}

export class QuantumConv extends HybridLayer {
  readonly inChannels: number
  readonly outChannels: number
  readonly kernelSize: [number, number]
  readonly stride: [number, number]
  readonly padding: [number, number]
  readonly numQubits: number
  readonly numLayers: number

  constructor(config: QuantumConvConfig) {
    super(config)
    this.inChannels = config.inChannels
    this.outChannels = config.outChannels
    this.kernelSize = Array.isArray(config.kernelSize)
      ? config.kernelSize
      : [config.kernelSize, config.kernelSize]
    this.stride = config.stride
      ? (Array.isArray(config.stride) ? config.stride : [config.stride, config.stride])
      : [1, 1]
    this.padding = config.padding
      ? (Array.isArray(config.padding) ? config.padding : [config.padding, config.padding])
      : [0, 0]
    this.numQubits = config.numQubits ?? Math.ceil(Math.log2(this.kernelSize[0] * this.kernelSize[1] * this.inChannels + 1))
    this.numLayers = config.numLayers ?? 2
  }

  build(inputShape?: Shape): void {
    const numKernelParams = this.numLayers * this.numQubits * 3 * this.outChannels
    const weights = Variable.xavier([numKernelParams], {
      name: `${this.name}_weights`
    })
    this._variables.add(weights)

    const bias = Variable.zeros([this.outChannels], {
      name: `${this.name}_bias`
    })
    this._variables.add(bias)

    this._built = true
  }

  forward(inputs: QTensor): QTensor {
    if (!this._built) {
      this.build(inputs.shape)
    }

    const [batchSize, channels, height, width] = inputs.shape.length === 4
      ? inputs.shape
      : [1, inputs.shape[0] ?? 1, inputs.shape[1] ?? 1, inputs.shape[2] ?? 1]

    const outHeight = Math.floor((height + 2 * this.padding[0] - this.kernelSize[0]) / this.stride[0]) + 1
    const outWidth = Math.floor((width + 2 * this.padding[1] - this.kernelSize[1]) / this.stride[1]) + 1

    const outputData = new Float64Array(batchSize * this.outChannels * outHeight * outWidth)
    const weights = this._variables.get(`${this.name}_weights`)!
    const bias = this._variables.get(`${this.name}_bias`)!

    const paramsPerChannel = this.numLayers * this.numQubits * 3

    for (let b = 0; b < batchSize; b++) {
      for (let oc = 0; oc < this.outChannels; oc++) {
        for (let oh = 0; oh < outHeight; oh++) {
          for (let ow = 0; ow < outWidth; ow++) {
            let sum = 0

            for (let ic = 0; ic < this.inChannels; ic++) {
              for (let kh = 0; kh < this.kernelSize[0]; kh++) {
                for (let kw = 0; kw < this.kernelSize[1]; kw++) {
                  const ih = oh * this.stride[0] + kh - this.padding[0]
                  const iw = ow * this.stride[1] + kw - this.padding[1]

                  if (ih >= 0 && ih < height && iw >= 0 && iw < width) {
                    const inputIdx = b * channels * height * width + ic * height * width + ih * width + iw
                    const weightIdx = (oc * paramsPerChannel + (ic * this.kernelSize[0] * this.kernelSize[1] + kh * this.kernelSize[1] + kw)) % weights.size
                    sum += inputs.data[inputIdx] * Math.tanh(weights.get(weightIdx))
                  }
                }
              }
            }

            const outputIdx = b * this.outChannels * outHeight * outWidth + oc * outHeight * outWidth + oh * outWidth + ow
            outputData[outputIdx] = sum + bias.get(oc)
          }
        }
      }
    }

    return new QTensor(outputData, [batchSize, this.outChannels, outHeight, outWidth], {
      dtype: 'float64',
      requiresGrad: inputs.requiresGrad
    })
  }

  backward(gradOutputs: QTensor): QTensor {
    const [batchSize, outChannels, outHeight, outWidth] = gradOutputs.shape
    const weights = this._variables.get(`${this.name}_weights`)!

    const height = (outHeight - 1) * this.stride[0] + this.kernelSize[0] - 2 * this.padding[0]
    const width = (outWidth - 1) * this.stride[1] + this.kernelSize[1] - 2 * this.padding[1]

    const gradInputData = new Float64Array(batchSize * this.inChannels * height * width)
    const paramsPerChannel = this.numLayers * this.numQubits * 3

    for (let b = 0; b < batchSize; b++) {
      for (let oc = 0; oc < this.outChannels; oc++) {
        for (let oh = 0; oh < outHeight; oh++) {
          for (let ow = 0; ow < outWidth; ow++) {
            const gradOutIdx = b * outChannels * outHeight * outWidth + oc * outHeight * outWidth + oh * outWidth + ow
            const gradOut = gradOutputs.data[gradOutIdx]

            for (let ic = 0; ic < this.inChannels; ic++) {
              for (let kh = 0; kh < this.kernelSize[0]; kh++) {
                for (let kw = 0; kw < this.kernelSize[1]; kw++) {
                  const ih = oh * this.stride[0] + kh - this.padding[0]
                  const iw = ow * this.stride[1] + kw - this.padding[1]

                  if (ih >= 0 && ih < height && iw >= 0 && iw < width) {
                    const weightIdx = (oc * paramsPerChannel + (ic * this.kernelSize[0] * this.kernelSize[1] + kh * this.kernelSize[1] + kw)) % weights.size
                    const gradInputIdx = b * this.inChannels * height * width + ic * height * width + ih * width + iw
                    gradInputData[gradInputIdx] += gradOut * Math.tanh(weights.get(weightIdx))
                  }
                }
              }
            }
          }
        }
      }
    }

    return new QTensor(gradInputData, [batchSize, this.inChannels, height, width], { dtype: 'float64' })
  }
}

export interface ClassicalPreprocessingConfig extends LayerConfig {
  inputDim: number
  outputDim: number
  activation?: 'relu' | 'tanh' | 'sigmoid' | 'linear'
  hiddenDims?: number[]
}

export class ClassicalPreprocessing extends HybridLayer {
  readonly inputDim: number
  readonly outputDim: number
  readonly activation: 'relu' | 'tanh' | 'sigmoid' | 'linear'
  readonly hiddenDims: number[]
  private _layerDims: number[]

  constructor(config: ClassicalPreprocessingConfig) {
    super(config)
    this.inputDim = config.inputDim
    this.outputDim = config.outputDim
    this.activation = config.activation ?? 'relu'
    this.hiddenDims = config.hiddenDims ?? []
    this._layerDims = [this.inputDim, ...this.hiddenDims, this.outputDim]
  }

  build(inputShape?: Shape): void {
    for (let i = 0; i < this._layerDims.length - 1; i++) {
      const inDim = this._layerDims[i]
      const outDim = this._layerDims[i + 1]

      const weights = Variable.xavier([inDim, outDim], {
        name: `${this.name}_w${i}`
      })
      this._variables.add(weights)

      const bias = Variable.zeros([outDim], {
        name: `${this.name}_b${i}`
      })
      this._variables.add(bias)
    }

    this._built = true
  }

  private _activate(x: number): number {
    switch (this.activation) {
      case 'relu':
        return Math.max(0, x)
      case 'tanh':
        return Math.tanh(x)
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x))
      case 'linear':
      default:
        return x
    }
  }

  private _activateDerivative(x: number): number {
    switch (this.activation) {
      case 'relu':
        return x > 0 ? 1 : 0
      case 'tanh':
        const t = Math.tanh(x)
        return 1 - t * t
      case 'sigmoid':
        const s = 1 / (1 + Math.exp(-x))
        return s * (1 - s)
      case 'linear':
      default:
        return 1
    }
  }

  forward(inputs: QTensor): QTensor {
    if (!this._built) {
      this.build(inputs.shape)
    }

    const batchSize = inputs.shape[0] ?? 1
    let current = inputs

    for (let i = 0; i < this._layerDims.length - 1; i++) {
      const inDim = this._layerDims[i]
      const outDim = this._layerDims[i + 1]
      const weights = this._variables.get(`${this.name}_w${i}`)!
      const bias = this._variables.get(`${this.name}_b${i}`)!

      const outputData = new Float64Array(batchSize * outDim)

      for (let b = 0; b < batchSize; b++) {
        for (let o = 0; o < outDim; o++) {
          let sum = bias.get(o)
          for (let j = 0; j < inDim; j++) {
            const inputIdx = current.shape.length > 1 ? b * inDim + j : j
            sum += current.data[inputIdx] * weights.get(j * outDim + o)
          }

          const isLastLayer = i === this._layerDims.length - 2
          outputData[b * outDim + o] = isLastLayer ? sum : this._activate(sum)
        }
      }

      current = new QTensor(outputData, [batchSize, outDim], {
        dtype: 'float64',
        requiresGrad: inputs.requiresGrad
      })
    }

    return current
  }

  backward(gradOutputs: QTensor): QTensor {
    const batchSize = gradOutputs.shape[0] ?? 1
    let gradCurrent = gradOutputs

    for (let i = this._layerDims.length - 2; i >= 0; i--) {
      const inDim = this._layerDims[i]
      const outDim = this._layerDims[i + 1]
      const weights = this._variables.get(`${this.name}_w${i}`)!

      const gradInputData = new Float64Array(batchSize * inDim)

      for (let b = 0; b < batchSize; b++) {
        for (let j = 0; j < inDim; j++) {
          let sum = 0
          for (let o = 0; o < outDim; o++) {
            sum += gradCurrent.data[b * outDim + o] * weights.get(j * outDim + o)
          }
          gradInputData[b * inDim + j] = sum
        }
      }

      gradCurrent = new QTensor(gradInputData, [batchSize, inDim], { dtype: 'float64' })
    }

    return gradCurrent
  }
}

export interface ClassicalPostprocessingConfig extends LayerConfig {
  inputDim: number
  outputDim: number
  activation?: 'relu' | 'tanh' | 'sigmoid' | 'softmax' | 'linear'
  hiddenDims?: number[]
}

export class ClassicalPostprocessing extends HybridLayer {
  readonly inputDim: number
  readonly outputDim: number
  readonly activation: 'relu' | 'tanh' | 'sigmoid' | 'softmax' | 'linear'
  readonly hiddenDims: number[]
  private _layerDims: number[]

  constructor(config: ClassicalPostprocessingConfig) {
    super(config)
    this.inputDim = config.inputDim
    this.outputDim = config.outputDim
    this.activation = config.activation ?? 'linear'
    this.hiddenDims = config.hiddenDims ?? []
    this._layerDims = [this.inputDim, ...this.hiddenDims, this.outputDim]
  }

  build(inputShape?: Shape): void {
    for (let i = 0; i < this._layerDims.length - 1; i++) {
      const inDim = this._layerDims[i]
      const outDim = this._layerDims[i + 1]

      const weights = Variable.xavier([inDim, outDim], {
        name: `${this.name}_w${i}`
      })
      this._variables.add(weights)

      const bias = Variable.zeros([outDim], {
        name: `${this.name}_b${i}`
      })
      this._variables.add(bias)
    }

    this._built = true
  }

  private _activate(x: number): number {
    switch (this.activation) {
      case 'relu':
        return Math.max(0, x)
      case 'tanh':
        return Math.tanh(x)
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x))
      case 'linear':
      default:
        return x
    }
  }

  forward(inputs: QTensor): QTensor {
    if (!this._built) {
      this.build(inputs.shape)
    }

    const batchSize = inputs.shape[0] ?? 1
    let current = inputs

    for (let i = 0; i < this._layerDims.length - 1; i++) {
      const inDim = this._layerDims[i]
      const outDim = this._layerDims[i + 1]
      const weights = this._variables.get(`${this.name}_w${i}`)!
      const bias = this._variables.get(`${this.name}_b${i}`)!

      const outputData = new Float64Array(batchSize * outDim)

      for (let b = 0; b < batchSize; b++) {
        for (let o = 0; o < outDim; o++) {
          let sum = bias.get(o)
          for (let j = 0; j < inDim; j++) {
            const inputIdx = current.shape.length > 1 ? b * inDim + j : j
            sum += current.data[inputIdx] * weights.get(j * outDim + o)
          }

          const isLastLayer = i === this._layerDims.length - 2
          outputData[b * outDim + o] = isLastLayer && this.activation !== 'softmax'
            ? this._activate(sum)
            : sum
        }
      }

      current = new QTensor(outputData, [batchSize, outDim], {
        dtype: 'float64',
        requiresGrad: inputs.requiresGrad
      })
    }

    if (this.activation === 'softmax') {
      const outputData = new Float64Array(current.data.length)

      for (let b = 0; b < batchSize; b++) {
        let maxVal = -Infinity
        for (let o = 0; o < this.outputDim; o++) {
          maxVal = Math.max(maxVal, current.data[b * this.outputDim + o])
        }

        let sumExp = 0
        for (let o = 0; o < this.outputDim; o++) {
          sumExp += Math.exp(current.data[b * this.outputDim + o] - maxVal)
        }

        for (let o = 0; o < this.outputDim; o++) {
          outputData[b * this.outputDim + o] = Math.exp(current.data[b * this.outputDim + o] - maxVal) / sumExp
        }
      }

      current = new QTensor(outputData, [batchSize, this.outputDim], {
        dtype: 'float64',
        requiresGrad: inputs.requiresGrad
      })
    }

    return current
  }

  backward(gradOutputs: QTensor): QTensor {
    const batchSize = gradOutputs.shape[0] ?? 1
    let gradCurrent = gradOutputs

    for (let i = this._layerDims.length - 2; i >= 0; i--) {
      const inDim = this._layerDims[i]
      const outDim = this._layerDims[i + 1]
      const weights = this._variables.get(`${this.name}_w${i}`)!

      const gradInputData = new Float64Array(batchSize * inDim)

      for (let b = 0; b < batchSize; b++) {
        for (let j = 0; j < inDim; j++) {
          let sum = 0
          for (let o = 0; o < outDim; o++) {
            sum += gradCurrent.data[b * outDim + o] * weights.get(j * outDim + o)
          }
          gradInputData[b * inDim + j] = sum
        }
      }

      gradCurrent = new QTensor(gradInputData, [batchSize, inDim], { dtype: 'float64' })
    }

    return gradCurrent
  }
}

export interface TorchLikeModuleConfig {
  name?: string
}

export abstract class TorchLikeModule {
  readonly name: string
  protected _training: boolean
  protected _modules: Map<string, TorchLikeModule | HybridLayer>
  protected _parameters: Map<string, Variable>

  constructor(config: TorchLikeModuleConfig = {}) {
    this.name = config.name ?? this.constructor.name
    this._training = true
    this._modules = new Map()
    this._parameters = new Map()
  }

  abstract forward(inputs: QTensor): QTensor

  call(inputs: QTensor): QTensor {
    return this.forward(inputs)
  }

  train(mode: boolean = true): this {
    this._training = mode
    for (const module of this._modules.values()) {
      if (module instanceof TorchLikeModule) {
        module.train(mode)
      } else {
        module.trainable = mode
      }
    }
    return this
  }

  eval(): this {
    return this.train(false)
  }

  registerModule(name: string, module: TorchLikeModule | HybridLayer): void {
    this._modules.set(name, module)
  }

  registerParameter(name: string, param: Variable): void {
    this._parameters.set(name, param)
  }

  parameters(): Variable[] {
    const params: Variable[] = []

    for (const param of this._parameters.values()) {
      params.push(param)
    }

    for (const module of this._modules.values()) {
      if (module instanceof TorchLikeModule) {
        params.push(...module.parameters())
      } else {
        params.push(...module.parameters())
      }
    }

    return params
  }

  namedParameters(): Map<string, Variable> {
    const params = new Map<string, Variable>()

    for (const [name, param] of this._parameters) {
      params.set(`${this.name}.${name}`, param)
    }

    for (const [moduleName, module] of this._modules) {
      if (module instanceof TorchLikeModule) {
        for (const [paramName, param] of module.namedParameters()) {
          params.set(`${this.name}.${moduleName}.${paramName}`, param)
        }
      } else {
        for (const param of module.parameters()) {
          params.set(`${this.name}.${moduleName}.${param.name}`, param)
        }
      }
    }

    return params
  }

  modules(): Array<TorchLikeModule | HybridLayer> {
    const mods: Array<TorchLikeModule | HybridLayer> = []

    for (const module of this._modules.values()) {
      mods.push(module)
      if (module instanceof TorchLikeModule) {
        mods.push(...module.modules())
      }
    }

    return mods
  }

  namedModules(): Map<string, TorchLikeModule | HybridLayer> {
    const mods = new Map<string, TorchLikeModule | HybridLayer>()

    for (const [name, module] of this._modules) {
      mods.set(`${this.name}.${name}`, module)
      if (module instanceof TorchLikeModule) {
        for (const [subName, subModule] of module.namedModules()) {
          mods.set(`${this.name}.${name}.${subName}`, subModule)
        }
      }
    }

    return mods
  }

  zeroGrad(): void {
    for (const param of this.parameters()) {
      param.zeroGrad()
    }
  }

  stateDict(): Map<string, Float64Array> {
    const state = new Map<string, Float64Array>()
    for (const [name, param] of this.namedParameters()) {
      state.set(name, new Float64Array(param.data))
    }
    return state
  }

  loadStateDict(state: Map<string, Float64Array>): void {
    const params = this.namedParameters()
    for (const [name, data] of state) {
      const param = params.get(name)
      if (param) {
        param.update(data)
      }
    }
  }

  countParameters(): number {
    return this.parameters().reduce((sum, p) => sum + p.size, 0)
  }

  toString(): string {
    const lines = [`${this.name}(`]
    for (const [name, module] of this._modules) {
      lines.push(`  (${name}): ${module.toString()}`)
    }
    lines.push(')')
    return lines.join('\n')
  }
}

export class HybridSequential extends TorchLikeModule {
  private _layers: Array<HybridLayer | TorchLikeModule>

  constructor(config: TorchLikeModuleConfig = {}) {
    super(config)
    this._layers = []
  }

  add(layer: HybridLayer | TorchLikeModule): this {
    const idx = this._layers.length
    this._layers.push(layer)
    this.registerModule(`layer_${idx}`, layer)
    return this
  }

  forward(inputs: QTensor): QTensor {
    let current = inputs
    for (const layer of this._layers) {
      if (layer instanceof TorchLikeModule) {
        current = layer.forward(current)
      } else {
        current = layer.forward(current)
      }
    }
    return current
  }

  get(index: number): HybridLayer | TorchLikeModule {
    if (index < 0 || index >= this._layers.length) {
      throw new Error(`Index ${index} out of range`)
    }
    return this._layers[index]
  }

  get length(): number {
    return this._layers.length
  }
}

export function quantumLinear(config: Omit<QuantumLinearConfig, 'name'>): QuantumLinear {
  return new QuantumLinear(config)
}

export function quantumConv(config: Omit<QuantumConvConfig, 'name'>): QuantumConv {
  return new QuantumConv(config)
}

export function classicalPreprocessing(config: Omit<ClassicalPreprocessingConfig, 'name'>): ClassicalPreprocessing {
  return new ClassicalPreprocessing(config)
}

export function classicalPostprocessing(config: Omit<ClassicalPostprocessingConfig, 'name'>): ClassicalPostprocessing {
  return new ClassicalPostprocessing(config)
}

export function hybridSequential(...layers: Array<HybridLayer | TorchLikeModule>): HybridSequential {
  const seq = new HybridSequential()
  for (const layer of layers) {
    seq.add(layer)
  }
  return seq
}
