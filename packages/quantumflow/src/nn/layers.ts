import { QTensor, Shape, DType } from '../core/tensor'
import { Variable, VariableCollection } from '../core/variable'
import { QuantumTape } from '../autodiff/tape'
import { Device } from '../devices/base-device'
import { H, rx, ry, rz, cnot, cz, rot } from '../circuit/operations/gates'
import { expval, PauliZObservable, PauliXObservable, PauliYObservable } from '../circuit/operations/observables'

export interface LayerConfig {
  name?: string
  trainable?: boolean
}

export interface ForwardContext {
  tape: QuantumTape
  device?: Device
  training: boolean
}

export abstract class QuantumLayer {
  readonly name: string
  protected _trainable: boolean
  protected _variables: VariableCollection
  protected _built: boolean

  constructor(config: LayerConfig = {}) {
    this.name = config.name ?? this.constructor.name
    this._trainable = config.trainable ?? true
    this._variables = new VariableCollection()
    this._built = false
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

  abstract forward(ctx: ForwardContext, inputs?: QTensor): void

  build(inputShape?: Shape): void {
    this._built = true
  }

  call(ctx: ForwardContext, inputs?: QTensor): void {
    if (!this._built) {
      this.build(inputs?.shape)
    }
    this.forward(ctx, inputs)
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

  toString(): string {
    return `${this.name}(params=${this.countParams()}, trainable=${this._trainable})`
  }
}

export interface AngleEncodingConfig extends LayerConfig {
  numQubits: number
  rotation?: 'X' | 'Y' | 'Z'
  scaling?: number
  hadamardFirst?: boolean
}

export class AngleEncodingLayer extends QuantumLayer {
  readonly numQubits: number
  readonly rotation: 'X' | 'Y' | 'Z'
  readonly scaling: number
  readonly hadamardFirst: boolean

  constructor(config: AngleEncodingConfig) {
    super(config)
    this.numQubits = config.numQubits
    this.rotation = config.rotation ?? 'Y'
    this.scaling = config.scaling ?? 1.0
    this.hadamardFirst = config.hadamardFirst ?? false
  }

  forward(ctx: ForwardContext, inputs?: QTensor): void {
    if (!inputs) {
      throw new Error('AngleEncodingLayer requires input data')
    }

    const data = Array.from(inputs.data)
    const numFeatures = Math.min(data.length, this.numQubits)

    for (let i = 0; i < numFeatures; i++) {
      if (this.hadamardFirst) {
        H(ctx.tape, i)
      }

      const angle = data[i] * this.scaling

      switch (this.rotation) {
        case 'X':
          rx(ctx.tape, i, angle)
          break
        case 'Y':
          ry(ctx.tape, i, angle)
          break
        case 'Z':
          rz(ctx.tape, i, angle)
          break
      }
    }
  }

  build(inputShape?: Shape): void {
    this._built = true
  }
}

export interface AmplitudeEncodingConfig extends LayerConfig {
  numQubits: number
  normalize?: boolean
  padValue?: number
}

export class AmplitudeEncodingLayer extends QuantumLayer {
  readonly numQubits: number
  readonly normalize: boolean
  readonly padValue: number

  constructor(config: AmplitudeEncodingConfig) {
    super(config)
    this.numQubits = config.numQubits
    this.normalize = config.normalize ?? true
    this.padValue = config.padValue ?? 0
  }

  forward(ctx: ForwardContext, inputs?: QTensor): void {
    if (!inputs) {
      throw new Error('AmplitudeEncodingLayer requires input data')
    }

    const dim = 1 << this.numQubits
    let data = Array.from(inputs.data)

    if (data.length < dim) {
      data = [...data, ...new Array(dim - data.length).fill(this.padValue)]
    } else if (data.length > dim) {
      data = data.slice(0, dim)
    }

    if (this.normalize) {
      const norm = Math.sqrt(data.reduce((sum, x) => sum + x * x, 0))
      if (norm > 1e-10) {
        data = data.map(x => x / norm)
      }
    }

    const stateVector = QTensor.fromComplex(
      data.map(x => ({ re: x, im: 0 })),
      [dim]
    )

    ctx.tape.addStatePrep('AmplitudeEncoding', Array.from({ length: this.numQubits }, (_, i) => i), stateVector)
  }
}

export interface StronglyEntanglingConfig extends LayerConfig {
  numQubits: number
  numLayers: number
  ranges?: number[]
  imprimitive?: 'CNOT' | 'CZ'
}

export class StronglyEntanglingLayer extends QuantumLayer {
  readonly numQubits: number
  readonly numLayers: number
  readonly ranges: number[]
  readonly imprimitive: 'CNOT' | 'CZ'

  constructor(config: StronglyEntanglingConfig) {
    super(config)
    this.numQubits = config.numQubits
    this.numLayers = config.numLayers

    if (config.ranges) {
      this.ranges = config.ranges
    } else {
      this.ranges = []
      for (let l = 0; l < this.numLayers; l++) {
        this.ranges.push((l % (this.numQubits - 1)) + 1)
      }
    }

    this.imprimitive = config.imprimitive ?? 'CNOT'
  }

  build(inputShape?: Shape): void {
    const numParams = this.numLayers * this.numQubits * 3
    const weights = Variable.uniform([numParams], -Math.PI, Math.PI, {
      name: `${this.name}_weights`
    })
    this._variables.add(weights)
    this._built = true
  }

  forward(ctx: ForwardContext, inputs?: QTensor): void {
    const weights = this._variables.get(`${this.name}_weights`)
    if (!weights) {
      throw new Error('Layer not built')
    }

    let paramIdx = 0

    for (let l = 0; l < this.numLayers; l++) {
      for (let q = 0; q < this.numQubits; q++) {
        const phi = weights.get(paramIdx++)
        const theta = weights.get(paramIdx++)
        const omega = weights.get(paramIdx++)
        rot(ctx.tape, q, phi, theta, omega)
      }

      const r = this.ranges[l] ?? 1
      for (let q = 0; q < this.numQubits; q++) {
        const target = (q + r) % this.numQubits
        if (this.imprimitive === 'CZ') {
          cz(ctx.tape, q, target)
        } else {
          cnot(ctx.tape, q, target)
        }
      }
    }
  }
}

export interface BasicEntanglerConfig extends LayerConfig {
  numQubits: number
  numLayers: number
  rotation?: 'X' | 'Y' | 'Z'
}

export class BasicEntanglerLayer extends QuantumLayer {
  readonly numQubits: number
  readonly numLayers: number
  readonly rotation: 'X' | 'Y' | 'Z'

  constructor(config: BasicEntanglerConfig) {
    super(config)
    this.numQubits = config.numQubits
    this.numLayers = config.numLayers
    this.rotation = config.rotation ?? 'X'
  }

  build(inputShape?: Shape): void {
    const numParams = this.numLayers * this.numQubits
    const weights = Variable.uniform([numParams], -Math.PI, Math.PI, {
      name: `${this.name}_weights`
    })
    this._variables.add(weights)
    this._built = true
  }

  forward(ctx: ForwardContext, inputs?: QTensor): void {
    const weights = this._variables.get(`${this.name}_weights`)
    if (!weights) {
      throw new Error('Layer not built')
    }

    let paramIdx = 0

    for (let l = 0; l < this.numLayers; l++) {
      for (let q = 0; q < this.numQubits; q++) {
        const angle = weights.get(paramIdx++)
        switch (this.rotation) {
          case 'X':
            rx(ctx.tape, q, angle)
            break
          case 'Y':
            ry(ctx.tape, q, angle)
            break
          case 'Z':
            rz(ctx.tape, q, angle)
            break
        }
      }

      if (this.numQubits > 1) {
        for (let q = 0; q < this.numQubits; q++) {
          cnot(ctx.tape, q, (q + 1) % this.numQubits)
        }
      }
    }
  }
}

export interface RandomLayerConfig extends LayerConfig {
  numQubits: number
  numLayers: number
  rotationsPerLayer?: number
  seed?: number
}

export class RandomLayer extends QuantumLayer {
  readonly numQubits: number
  readonly numLayers: number
  readonly rotationsPerLayer: number
  private _seed: number
  private _gatePattern: Array<{ type: 'X' | 'Y' | 'Z'; qubit: number }>
  private _entanglePattern: Array<{ control: number; target: number }>

  constructor(config: RandomLayerConfig) {
    super(config)
    this.numQubits = config.numQubits
    this.numLayers = config.numLayers
    this.rotationsPerLayer = config.rotationsPerLayer ?? this.numQubits
    this._seed = config.seed ?? Date.now()
    this._gatePattern = []
    this._entanglePattern = []
    this._generatePattern()
  }

  private _generatePattern(): void {
    let state = this._seed

    const random = () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff
      return state / 0x7fffffff
    }

    for (let l = 0; l < this.numLayers; l++) {
      for (let r = 0; r < this.rotationsPerLayer; r++) {
        const gateType = ['X', 'Y', 'Z'][Math.floor(random() * 3)] as 'X' | 'Y' | 'Z'
        const qubit = Math.floor(random() * this.numQubits)
        this._gatePattern.push({ type: gateType, qubit })
      }

      if (this.numQubits > 1) {
        const numEntanglers = Math.floor(random() * this.numQubits) + 1
        for (let e = 0; e < numEntanglers; e++) {
          const control = Math.floor(random() * this.numQubits)
          let target = Math.floor(random() * this.numQubits)
          while (target === control) {
            target = Math.floor(random() * this.numQubits)
          }
          this._entanglePattern.push({ control, target })
        }
      }
    }
  }

  build(inputShape?: Shape): void {
    const numParams = this._gatePattern.length
    const weights = Variable.uniform([numParams], -Math.PI, Math.PI, {
      name: `${this.name}_weights`
    })
    this._variables.add(weights)
    this._built = true
  }

  forward(ctx: ForwardContext, inputs?: QTensor): void {
    const weights = this._variables.get(`${this.name}_weights`)
    if (!weights) {
      throw new Error('Layer not built')
    }

    let paramIdx = 0
    let entangleIdx = 0
    const gatesPerLayer = this.rotationsPerLayer
    const entanglersPerLayer = Math.ceil(this._entanglePattern.length / this.numLayers)

    for (let l = 0; l < this.numLayers; l++) {
      const startGate = l * gatesPerLayer
      const endGate = Math.min(startGate + gatesPerLayer, this._gatePattern.length)

      for (let g = startGate; g < endGate; g++) {
        const gate = this._gatePattern[g]
        const angle = weights.get(paramIdx++)

        switch (gate.type) {
          case 'X':
            rx(ctx.tape, gate.qubit, angle)
            break
          case 'Y':
            ry(ctx.tape, gate.qubit, angle)
            break
          case 'Z':
            rz(ctx.tape, gate.qubit, angle)
            break
        }
      }

      const startEntangle = l * entanglersPerLayer
      const endEntangle = Math.min(startEntangle + entanglersPerLayer, this._entanglePattern.length)

      for (let e = startEntangle; e < endEntangle; e++) {
        const { control, target } = this._entanglePattern[e]
        cnot(ctx.tape, control, target)
      }
    }
  }
}

export interface MeasurementLayerConfig extends LayerConfig {
  numQubits: number
  observables?: Array<'X' | 'Y' | 'Z'>
  wires?: number[]
}

export class MeasurementLayer extends QuantumLayer {
  readonly numQubits: number
  readonly observables: Array<'X' | 'Y' | 'Z'>
  readonly wires: number[]

  constructor(config: MeasurementLayerConfig) {
    super({ ...config, trainable: false })
    this.numQubits = config.numQubits
    this.observables = config.observables ?? new Array(config.numQubits).fill('Z')
    this.wires = config.wires ?? Array.from({ length: config.numQubits }, (_, i) => i)
  }

  forward(ctx: ForwardContext, inputs?: QTensor): void {
    for (let i = 0; i < this.wires.length; i++) {
      const wire = this.wires[i]
      const obsType = this.observables[i] ?? 'Z'

      let observable
      switch (obsType) {
        case 'X':
          observable = new PauliXObservable(wire)
          break
        case 'Y':
          observable = new PauliYObservable(wire)
          break
        case 'Z':
        default:
          observable = new PauliZObservable(wire)
          break
      }

      expval(ctx.tape, observable)
    }
  }
}

export interface SequentialConfig extends LayerConfig {
  layers?: QuantumLayer[]
}

export class Sequential extends QuantumLayer {
  private _layers: QuantumLayer[]

  constructor(config: SequentialConfig = {}) {
    super(config)
    this._layers = config.layers ?? []
  }

  add(layer: QuantumLayer): this {
    this._layers.push(layer)
    return this
  }

  get layers(): QuantumLayer[] {
    return [...this._layers]
  }

  get numLayers(): number {
    return this._layers.length
  }

  build(inputShape?: Shape): void {
    let currentShape = inputShape
    for (const layer of this._layers) {
      layer.build(currentShape)
    }
    this._built = true
  }

  forward(ctx: ForwardContext, inputs?: QTensor): void {
    let currentInputs = inputs
    for (const layer of this._layers) {
      layer.call(ctx, currentInputs)
      currentInputs = undefined
    }
  }

  getWeights(): QTensor[] {
    const weights: QTensor[] = []
    for (const layer of this._layers) {
      weights.push(...layer.getWeights())
    }
    return weights
  }

  setWeights(weights: QTensor[]): void {
    let offset = 0
    for (const layer of this._layers) {
      const layerWeights = layer.getWeights()
      const numWeights = layerWeights.length
      layer.setWeights(weights.slice(offset, offset + numWeights))
      offset += numWeights
    }
  }

  countParams(): number {
    return this._layers.reduce((sum, layer) => sum + layer.countParams(), 0)
  }

  trainableParams(): number {
    return this._layers.reduce((sum, layer) => sum + layer.trainableParams(), 0)
  }

  freeze(): void {
    this._trainable = false
    for (const layer of this._layers) {
      layer.freeze()
    }
  }

  unfreeze(): void {
    this._trainable = true
    for (const layer of this._layers) {
      layer.unfreeze()
    }
  }

  getLayer(index: number): QuantumLayer {
    if (index < 0 || index >= this._layers.length) {
      throw new Error(`Layer index ${index} out of range`)
    }
    return this._layers[index]
  }

  toString(): string {
    const lines = [`Sequential(name=${this.name}):`]
    for (let i = 0; i < this._layers.length; i++) {
      lines.push(`  [${i}] ${this._layers[i].toString()}`)
    }
    lines.push(`  Total params: ${this.countParams()}`)
    lines.push(`  Trainable params: ${this.trainableParams()}`)
    return lines.join('\n')
  }
}

export interface TwoLocalConfig extends LayerConfig {
  numQubits: number
  numLayers: number
  rotationBlocks?: Array<'RX' | 'RY' | 'RZ'>
  entanglementBlocks?: 'linear' | 'circular' | 'full' | 'sca'
  skipFinalRotation?: boolean
}

export class TwoLocal extends QuantumLayer {
  readonly numQubits: number
  readonly numLayers: number
  readonly rotationBlocks: Array<'RX' | 'RY' | 'RZ'>
  readonly entanglementBlocks: 'linear' | 'circular' | 'full' | 'sca'
  readonly skipFinalRotation: boolean

  constructor(config: TwoLocalConfig) {
    super(config)
    this.numQubits = config.numQubits
    this.numLayers = config.numLayers
    this.rotationBlocks = config.rotationBlocks ?? ['RY', 'RZ']
    this.entanglementBlocks = config.entanglementBlocks ?? 'linear'
    this.skipFinalRotation = config.skipFinalRotation ?? false
  }

  private _getEntanglementPairs(): Array<[number, number]> {
    const pairs: Array<[number, number]> = []

    switch (this.entanglementBlocks) {
      case 'linear':
        for (let i = 0; i < this.numQubits - 1; i++) {
          pairs.push([i, i + 1])
        }
        break
      case 'circular':
        for (let i = 0; i < this.numQubits; i++) {
          pairs.push([i, (i + 1) % this.numQubits])
        }
        break
      case 'full':
        for (let i = 0; i < this.numQubits; i++) {
          for (let j = i + 1; j < this.numQubits; j++) {
            pairs.push([i, j])
          }
        }
        break
      case 'sca':
        for (let i = 0; i < this.numQubits - 1; i += 2) {
          pairs.push([i, i + 1])
        }
        for (let i = 1; i < this.numQubits - 1; i += 2) {
          pairs.push([i, i + 1])
        }
        break
    }

    return pairs
  }

  build(inputShape?: Shape): void {
    const rotationLayers = this.skipFinalRotation ? this.numLayers : this.numLayers + 1
    const numRotParams = rotationLayers * this.numQubits * this.rotationBlocks.length
    const weights = Variable.uniform([numRotParams], -Math.PI, Math.PI, {
      name: `${this.name}_weights`
    })
    this._variables.add(weights)
    this._built = true
  }

  forward(ctx: ForwardContext, inputs?: QTensor): void {
    const weights = this._variables.get(`${this.name}_weights`)
    if (!weights) {
      throw new Error('Layer not built')
    }

    const entanglementPairs = this._getEntanglementPairs()
    let paramIdx = 0

    const applyRotationLayer = () => {
      for (let q = 0; q < this.numQubits; q++) {
        for (const block of this.rotationBlocks) {
          const angle = weights.get(paramIdx++)
          switch (block) {
            case 'RX':
              rx(ctx.tape, q, angle)
              break
            case 'RY':
              ry(ctx.tape, q, angle)
              break
            case 'RZ':
              rz(ctx.tape, q, angle)
              break
          }
        }
      }
    }

    applyRotationLayer()

    for (let l = 0; l < this.numLayers; l++) {
      for (const [control, target] of entanglementPairs) {
        cnot(ctx.tape, control, target)
      }

      if (l < this.numLayers - 1 || !this.skipFinalRotation) {
        applyRotationLayer()
      }
    }
  }
}

export interface EfficientSU2Config extends LayerConfig {
  numQubits: number
  numLayers: number
  entanglement?: 'linear' | 'circular' | 'full' | 'sca'
}

export class EfficientSU2 extends TwoLocal {
  constructor(config: EfficientSU2Config) {
    super({
      ...config,
      rotationBlocks: ['RY', 'RZ'],
      entanglementBlocks: config.entanglement ?? 'linear',
      skipFinalRotation: true
    })
  }
}

export interface RealAmplitudesConfig extends LayerConfig {
  numQubits: number
  numLayers: number
  entanglement?: 'linear' | 'circular' | 'full' | 'sca'
}

export class RealAmplitudes extends TwoLocal {
  constructor(config: RealAmplitudesConfig) {
    super({
      ...config,
      rotationBlocks: ['RY'],
      entanglementBlocks: config.entanglement ?? 'linear',
      skipFinalRotation: false
    })
  }
}

export function angleEncoding(config: Omit<AngleEncodingConfig, 'name'>): AngleEncodingLayer {
  return new AngleEncodingLayer(config)
}

export function amplitudeEncoding(config: Omit<AmplitudeEncodingConfig, 'name'>): AmplitudeEncodingLayer {
  return new AmplitudeEncodingLayer(config)
}

export function stronglyEntangling(config: Omit<StronglyEntanglingConfig, 'name'>): StronglyEntanglingLayer {
  return new StronglyEntanglingLayer(config)
}

export function basicEntangler(config: Omit<BasicEntanglerConfig, 'name'>): BasicEntanglerLayer {
  return new BasicEntanglerLayer(config)
}

export function randomLayer(config: Omit<RandomLayerConfig, 'name'>): RandomLayer {
  return new RandomLayer(config)
}

export function measurement(config: Omit<MeasurementLayerConfig, 'name'>): MeasurementLayer {
  return new MeasurementLayer(config)
}

export function sequential(...layers: QuantumLayer[]): Sequential {
  return new Sequential({ layers })
}

export function twoLocal(config: Omit<TwoLocalConfig, 'name'>): TwoLocal {
  return new TwoLocal(config)
}

export function efficientSU2(config: Omit<EfficientSU2Config, 'name'>): EfficientSU2 {
  return new EfficientSU2(config)
}

export function realAmplitudes(config: Omit<RealAmplitudesConfig, 'name'>): RealAmplitudes {
  return new RealAmplitudes(config)
}
