import { QTensor } from '../core/tensor'
import { Complex } from '../core/complex'
import { QuantumTape, TapeOperation } from '../autodiff/tape'
import { Observable } from '../circuit/operations/observables'

export interface DeviceCapabilities {
  supportsAdjoint: boolean
  supportsBackprop: boolean
  supportsBatchExecution: boolean
  supportsDerivatives: boolean
  maxWires: number
  nativeGates: string[]
  supportedObservables: string[]
}

export interface ExecutionConfig {
  shots?: number | null
  seed?: number
  interface?: string
}

export interface DeviceState {
  stateVector?: QTensor
  densityMatrix?: QTensor
  samples?: number[][]
}

export abstract class Device {
  readonly name: string
  readonly shortName: string
  readonly version: string
  protected _numWires: number
  protected _shots: number | null
  protected _seed: number | null
  protected _state: DeviceState

  constructor(
    name: string,
    options: {
      wires?: number
      shots?: number | null
      seed?: number
    } = {}
  ) {
    this.name = name
    this.shortName = name.split('.').pop() ?? name
    this.version = '0.1.0'
    this._numWires = options.wires ?? 0
    this._shots = options.shots ?? null
    this._seed = options.seed ?? null
    this._state = {}
  }

  get numWires(): number {
    return this._numWires
  }

  set numWires(value: number) {
    this._numWires = value
  }

  get shots(): number | null {
    return this._shots
  }

  set shots(value: number | null) {
    this._shots = value
  }

  get state(): DeviceState {
    return this._state
  }

  abstract get capabilities(): DeviceCapabilities

  abstract execute(tape: QuantumTape, config?: ExecutionConfig): number | number[] | QTensor

  executeBatch(tapes: QuantumTape[], config?: ExecutionConfig): (number | number[] | QTensor)[] {
    return tapes.map(tape => this.execute(tape, config))
  }

  gradient?(tape: QuantumTape, params: QTensor[]): QTensor[]

  jacobian?(tape: QuantumTape, params: QTensor[]): QTensor

  abstract reset(): void

  preProcess(tape: QuantumTape): QuantumTape {
    return tape.expand()
  }

  postProcess(results: any): any {
    return results
  }

  validateTape(tape: QuantumTape): void {
    if (tape.numWires > this.capabilities.maxWires) {
      throw new Error(
        `Circuit requires ${tape.numWires} wires, but device ${this.name} supports maximum ${this.capabilities.maxWires}`
      )
    }

    for (const record of tape.operations) {
      const op = record.operation
      if (op.type === 'gate' && !this.supportsGate(op.name)) {
        throw new Error(`Device ${this.name} does not support gate: ${op.name}`)
      }
    }
  }

  supportsGate(gateName: string): boolean {
    return this.capabilities.nativeGates.includes(gateName)
  }

  supportsObservable(observableName: string): boolean {
    return this.capabilities.supportedObservables.includes(observableName)
  }

  abstract applyOperation(op: TapeOperation): void

  abstract measure(observable: Observable, wires: number[]): number

  abstract sampleCircuit(shots: number): number[][]

  abstract getProbabilities(wires?: number[]): number[]

  abstract getStateVector(): QTensor

  toJSON(): object {
    return {
      name: this.name,
      version: this.version,
      numWires: this._numWires,
      shots: this._shots,
      capabilities: this.capabilities
    }
  }

  toString(): string {
    return `${this.name}(wires=${this._numWires}, shots=${this._shots ?? 'analytic'})`
  }
}

export abstract class QubitDevice extends Device {
  protected _stateVector: QTensor | null
  protected _basisStates: number[]

  constructor(
    name: string,
    options: {
      wires?: number
      shots?: number | null
      seed?: number
    } = {}
  ) {
    super(name, options)
    this._stateVector = null
    this._basisStates = []
  }

  get stateVector(): QTensor | null {
    return this._stateVector
  }

  reset(): void {
    const dim = 1 << this._numWires
    this._stateVector = QTensor.zeros([dim], { dtype: 'complex128' })
    this._stateVector.data[0] = 1
    this._basisStates = Array.from({ length: dim }, (_, i) => i)
  }

  initializeState(state?: QTensor): void {
    if (state) {
      this._stateVector = state.clone()
    } else {
      this.reset()
    }
  }

  getStateVector(): QTensor {
    if (!this._stateVector) {
      throw new Error('State vector not initialized')
    }
    return this._stateVector.clone()
  }

  getProbabilities(wires?: number[]): number[] {
    if (!this._stateVector) {
      throw new Error('State vector not initialized')
    }

    const allProbs = this._stateVector.abs2().toArray() as number[]

    if (!wires || wires.length === this._numWires) {
      return allProbs
    }

    const numSubsystem = 1 << wires.length
    const marginalProbs = new Array(numSubsystem).fill(0)

    for (let i = 0; i < allProbs.length; i++) {
      let subsystemIndex = 0
      for (let j = 0; j < wires.length; j++) {
        const wire = wires[j]
        const bit = (i >> (this._numWires - 1 - wire)) & 1
        subsystemIndex |= bit << (wires.length - 1 - j)
      }
      marginalProbs[subsystemIndex] += allProbs[i]
    }

    return marginalProbs
  }

  sampleCircuit(shots: number): number[][] {
    const probs = this.getProbabilities()
    const samples: number[][] = []

    const cumulativeProbs = probs.reduce((acc, p, i) => {
      acc.push((acc[i - 1] ?? 0) + p)
      return acc
    }, [] as number[])

    for (let i = 0; i < shots; i++) {
      const r = Math.random()
      let outcome = 0

      for (let j = 0; j < cumulativeProbs.length; j++) {
        if (r < cumulativeProbs[j]) {
          outcome = j
          break
        }
      }

      const bits: number[] = []
      for (let j = this._numWires - 1; j >= 0; j--) {
        bits.unshift((outcome >> j) & 1)
      }
      samples.push(bits)
    }

    return samples
  }

  measure(observable: Observable, wires: number[]): number {
    if (!this._stateVector) {
      throw new Error('State vector not initialized')
    }

    const obsMatrix = observable.matrix()
    const fullObservable = this.expandObservable(obsMatrix, wires)

    let expectation = 0
    const dim = 1 << this._numWires

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        const stateI = this._stateVector.getComplex(i)
        const stateJ = this._stateVector.getComplex(j)
        const obsIJ = fullObservable.getComplex(i * dim + j)

        const term = stateI.conj().mul(obsIJ).mul(stateJ)
        expectation += term.re
      }
    }

    return expectation
  }

  private expandObservable(observable: QTensor, wires: number[]): QTensor {
    if (wires.length === this._numWires) {
      return observable
    }

    const fullDim = 1 << this._numWires
    const obsDim = 1 << wires.length
    const result = QTensor.zeros([fullDim, fullDim], { dtype: 'complex128' })

    for (let i = 0; i < fullDim; i++) {
      for (let j = 0; j < fullDim; j++) {
        let obsI = 0
        let obsJ = 0
        let match = true

        for (let k = 0; k < this._numWires; k++) {
          const bitI = (i >> (this._numWires - 1 - k)) & 1
          const bitJ = (j >> (this._numWires - 1 - k)) & 1

          const wireIdx = wires.indexOf(k)
          if (wireIdx !== -1) {
            obsI |= bitI << (wires.length - 1 - wireIdx)
            obsJ |= bitJ << (wires.length - 1 - wireIdx)
          } else {
            if (bitI !== bitJ) {
              match = false
              break
            }
          }
        }

        if (match) {
          result.setComplex(i * fullDim + j, observable.getComplex(obsI * obsDim + obsJ))
        }
      }
    }

    return result
  }

  variance(observable: Observable, wires: number[]): number {
    const expval = this.measure(observable, wires)

    const obsMatrix = observable.matrix()
    const obs2Matrix = obsMatrix.matmul(obsMatrix)
    const obs2 = new (observable.constructor as any)(obs2Matrix, wires)

    const expval2 = this.measure(obs2, wires)

    return expval2 - expval * expval
  }
}

export interface DevicePlugin {
  name: string
  version: string
  devices: Map<string, new (options: any) => Device>
  register(): void
}

const deviceRegistry = new Map<string, new (options: any) => Device>()

export function registerDevice(name: string, deviceClass: new (options: any) => Device): void {
  deviceRegistry.set(name, deviceClass)
}

export function getDevice(name: string, options?: any): Device {
  const DeviceClass = deviceRegistry.get(name)
  if (!DeviceClass) {
    throw new Error(`Unknown device: ${name}. Available devices: ${Array.from(deviceRegistry.keys()).join(', ')}`)
  }
  return new DeviceClass(options)
}

export function listDevices(): string[] {
  return Array.from(deviceRegistry.keys())
}

export function registerPlugin(plugin: DevicePlugin): void {
  for (const [name, deviceClass] of plugin.devices) {
    registerDevice(name, deviceClass)
  }
}
