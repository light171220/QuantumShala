import { QTensor } from '../core/tensor'
import { Complex } from '../core/complex'

export type OperationType =
  | 'gate'
  | 'measurement'
  | 'state_prep'
  | 'barrier'
  | 'reset'

export interface TapeOperation {
  id: number
  type: OperationType
  name: string
  wires: number[]
  params: number[]
  paramTensors: QTensor[]
  inverse: boolean
  controlWires: number[]
  matrix?: QTensor
}

export interface TapeRecord {
  operation: TapeOperation
  timestamp: number
}

let tapeIdCounter = 0
let operationIdCounter = 0

export class QuantumTape {
  readonly id: number
  private _operations: TapeRecord[]
  private _numWires: number
  private _parameters: Map<string, QTensor>
  private _recording: boolean
  private _expandedTape: QuantumTape | null

  constructor(numWires?: number) {
    this.id = tapeIdCounter++
    this._operations = []
    this._numWires = numWires ?? 0
    this._parameters = new Map()
    this._recording = false
    this._expandedTape = null
  }

  get operations(): TapeRecord[] {
    return [...this._operations]
  }

  get numOperations(): number {
    return this._operations.length
  }

  get numWires(): number {
    return this._numWires
  }

  get parameters(): Map<string, QTensor> {
    return new Map(this._parameters)
  }

  get numParameters(): number {
    let count = 0
    for (const t of this._parameters.values()) {
      count += t.size
    }
    return count
  }

  get trainableParams(): QTensor[] {
    return Array.from(this._parameters.values()).filter(t => t.requiresGrad)
  }

  get isRecording(): boolean {
    return this._recording
  }

  startRecording(): void {
    this._recording = true
  }

  stopRecording(): void {
    this._recording = false
  }

  record<T>(fn: () => T): T {
    this.startRecording()
    try {
      const result = fn()
      return result
    } finally {
      this.stopRecording()
    }
  }

  addOperation(op: Omit<TapeOperation, 'id'>): void {
    const operation: TapeOperation = {
      ...op,
      id: operationIdCounter++
    }

    for (const wire of operation.wires) {
      if (wire >= this._numWires) {
        this._numWires = wire + 1
      }
    }
    for (const wire of operation.controlWires) {
      if (wire >= this._numWires) {
        this._numWires = wire + 1
      }
    }

    this._operations.push({
      operation,
      timestamp: Date.now()
    })

    for (const paramTensor of operation.paramTensors) {
      if (paramTensor.name) {
        this._parameters.set(paramTensor.name, paramTensor)
      }
    }
  }

  addGate(
    name: string,
    wires: number[],
    params: number[] = [],
    options: {
      paramTensors?: QTensor[]
      inverse?: boolean
      controlWires?: number[]
      matrix?: QTensor
    } = {}
  ): void {
    this.addOperation({
      type: 'gate',
      name,
      wires,
      params,
      paramTensors: options.paramTensors ?? [],
      inverse: options.inverse ?? false,
      controlWires: options.controlWires ?? [],
      matrix: options.matrix
    })
  }

  addMeasurement(name: string, wires: number[], observable?: QTensor): void {
    this.addOperation({
      type: 'measurement',
      name,
      wires,
      params: [],
      paramTensors: observable ? [observable] : [],
      inverse: false,
      controlWires: []
    })
  }

  addStatePrep(name: string, wires: number[], state: QTensor): void {
    this.addOperation({
      type: 'state_prep',
      name,
      wires,
      params: [],
      paramTensors: [state],
      inverse: false,
      controlWires: []
    })
  }

  addBarrier(wires?: number[]): void {
    this.addOperation({
      type: 'barrier',
      name: 'Barrier',
      wires: wires ?? Array.from({ length: this._numWires }, (_, i) => i),
      params: [],
      paramTensors: [],
      inverse: false,
      controlWires: []
    })
  }

  addReset(wire: number): void {
    this.addOperation({
      type: 'reset',
      name: 'Reset',
      wires: [wire],
      params: [],
      paramTensors: [],
      inverse: false,
      controlWires: []
    })
  }

  getParametricOperations(): TapeRecord[] {
    return this._operations.filter(
      rec => rec.operation.params.length > 0 || rec.operation.paramTensors.length > 0
    )
  }

  getGates(): TapeRecord[] {
    return this._operations.filter(rec => rec.operation.type === 'gate')
  }

  getMeasurements(): TapeRecord[] {
    return this._operations.filter(rec => rec.operation.type === 'measurement')
  }

  expand(): QuantumTape {
    if (this._expandedTape) {
      return this._expandedTape
    }

    const expanded = new QuantumTape(this._numWires)

    for (const record of this._operations) {
      const op = record.operation

      if (this.isDecomposable(op)) {
        const decomposed = this.decompose(op)
        for (const subOp of decomposed) {
          expanded.addOperation(subOp)
        }
      } else {
        expanded.addOperation({ ...op })
      }
    }

    this._expandedTape = expanded
    return expanded
  }

  private isDecomposable(op: TapeOperation): boolean {
    const decomposableGates = ['CRX', 'CRY', 'CRZ', 'CSWAP', 'Toffoli', 'MultiControlledX']
    return decomposableGates.includes(op.name)
  }

  private decompose(op: TapeOperation): Omit<TapeOperation, 'id'>[] {
    switch (op.name) {
      case 'CRX':
        return this.decomposeCRX(op)
      case 'CRY':
        return this.decomposeCRY(op)
      case 'CRZ':
        return this.decomposeCRZ(op)
      case 'CSWAP':
        return this.decomposeCSWAP(op)
      case 'Toffoli':
        return this.decomposeToffoli(op)
      default:
        return [{ ...op }]
    }
  }

  private decomposeCRX(op: TapeOperation): Omit<TapeOperation, 'id'>[] {
    const [control, target] = op.wires
    const theta = op.params[0]
    return [
      { type: 'gate', name: 'RZ', wires: [target], params: [Math.PI / 2], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [control, target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'RY', wires: [target], params: [-theta / 2], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [control, target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'RY', wires: [target], params: [theta / 2], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'RZ', wires: [target], params: [-Math.PI / 2], paramTensors: [], inverse: false, controlWires: [] }
    ]
  }

  private decomposeCRY(op: TapeOperation): Omit<TapeOperation, 'id'>[] {
    const [control, target] = op.wires
    const theta = op.params[0]
    return [
      { type: 'gate', name: 'RY', wires: [target], params: [theta / 2], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [control, target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'RY', wires: [target], params: [-theta / 2], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [control, target], params: [], paramTensors: [], inverse: false, controlWires: [] }
    ]
  }

  private decomposeCRZ(op: TapeOperation): Omit<TapeOperation, 'id'>[] {
    const [control, target] = op.wires
    const theta = op.params[0]
    return [
      { type: 'gate', name: 'RZ', wires: [target], params: [theta / 2], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [control, target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'RZ', wires: [target], params: [-theta / 2], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [control, target], params: [], paramTensors: [], inverse: false, controlWires: [] }
    ]
  }

  private decomposeCSWAP(op: TapeOperation): Omit<TapeOperation, 'id'>[] {
    const [control, target1, target2] = op.wires
    return [
      { type: 'gate', name: 'CNOT', wires: [target2, target1], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'Toffoli', wires: [control, target1, target2], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [target2, target1], params: [], paramTensors: [], inverse: false, controlWires: [] }
    ]
  }

  private decomposeToffoli(op: TapeOperation): Omit<TapeOperation, 'id'>[] {
    const [c1, c2, target] = op.wires
    return [
      { type: 'gate', name: 'H', wires: [target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [c2, target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'T', wires: [target], params: [], paramTensors: [], inverse: true, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [c1, target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'T', wires: [target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [c2, target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'T', wires: [target], params: [], paramTensors: [], inverse: true, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [c1, target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'T', wires: [c2], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'T', wires: [target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'H', wires: [target], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [c1, c2], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'T', wires: [c1], params: [], paramTensors: [], inverse: false, controlWires: [] },
      { type: 'gate', name: 'T', wires: [c2], params: [], paramTensors: [], inverse: true, controlWires: [] },
      { type: 'gate', name: 'CNOT', wires: [c1, c2], params: [], paramTensors: [], inverse: false, controlWires: [] }
    ]
  }

  adjoint(): QuantumTape {
    const adjointTape = new QuantumTape(this._numWires)

    for (let i = this._operations.length - 1; i >= 0; i--) {
      const record = this._operations[i]
      const op = record.operation

      if (op.type === 'measurement' || op.type === 'reset') {
        continue
      }

      adjointTape.addOperation({
        type: op.type,
        name: op.name,
        wires: [...op.wires],
        params: op.params.map(p => -p),
        paramTensors: op.paramTensors.map(t => t.neg()),
        inverse: !op.inverse,
        controlWires: [...op.controlWires],
        matrix: op.matrix?.dag()
      })
    }

    return adjointTape
  }

  copy(): QuantumTape {
    const newTape = new QuantumTape(this._numWires)
    for (const record of this._operations) {
      newTape.addOperation({ ...record.operation })
    }
    for (const [name, tensor] of this._parameters) {
      newTape._parameters.set(name, tensor)
    }
    return newTape
  }

  concat(other: QuantumTape): QuantumTape {
    const newTape = this.copy()
    const wireOffset = this._numWires

    for (const record of other._operations) {
      const op = record.operation
      newTape.addOperation({
        type: op.type,
        name: op.name,
        wires: op.wires.map(w => w + wireOffset),
        params: [...op.params],
        paramTensors: [...op.paramTensors],
        inverse: op.inverse,
        controlWires: op.controlWires.map(w => w + wireOffset),
        matrix: op.matrix
      })
    }

    return newTape
  }

  compose(other: QuantumTape): QuantumTape {
    if (other._numWires > this._numWires) {
      throw new Error('Cannot compose tapes with more wires')
    }

    const newTape = this.copy()
    for (const record of other._operations) {
      newTape.addOperation({ ...record.operation })
    }
    return newTape
  }

  clear(): void {
    this._operations = []
    this._parameters.clear()
    this._expandedTape = null
  }

  toJSON(): object {
    return {
      id: this.id,
      numWires: this._numWires,
      operations: this._operations.map(rec => ({
        id: rec.operation.id,
        type: rec.operation.type,
        name: rec.operation.name,
        wires: rec.operation.wires,
        params: rec.operation.params,
        inverse: rec.operation.inverse,
        controlWires: rec.operation.controlWires
      }))
    }
  }

  toString(): string {
    const lines: string[] = []
    lines.push(`QuantumTape(wires=${this._numWires}, ops=${this._operations.length})`)

    for (const record of this._operations) {
      const op = record.operation
      const paramsStr = op.params.length > 0 ? `(${op.params.map(p => p.toFixed(4)).join(', ')})` : ''
      const controlStr = op.controlWires.length > 0 ? ` ctrl=[${op.controlWires.join(',')}]` : ''
      const invStr = op.inverse ? '†' : ''
      lines.push(`  ${op.name}${invStr}${paramsStr} @ [${op.wires.join(', ')}]${controlStr}`)
    }

    return lines.join('\n')
  }
}

export function tape(numWires?: number): QuantumTape {
  return new QuantumTape(numWires)
}

let activeTape: QuantumTape | null = null

export function getActiveTape(): QuantumTape | null {
  return activeTape
}

export function setActiveTape(t: QuantumTape | null): void {
  activeTape = t
}

export function withTape<T>(t: QuantumTape, fn: () => T): T {
  const previousTape = activeTape
  activeTape = t
  try {
    return fn()
  } finally {
    activeTape = previousTape
  }
}

export function recordOperation(op: Omit<TapeOperation, 'id'>): void {
  if (activeTape && activeTape.isRecording) {
    activeTape.addOperation(op)
  }
}
