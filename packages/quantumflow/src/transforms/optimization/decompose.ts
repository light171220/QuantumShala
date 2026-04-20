import { QuantumTape, TapeOperation, TapeRecord } from '../../autodiff/tape'
import { QTensor } from '../../core/tensor'
import { Complex } from '../../core/complex'
import { Transform, TransformResult, arraysEqual } from '../base'

export type NativeGateSet = 'clifford+t' | 'ibmq' | 'rigetti' | 'ionq' | 'custom'

export interface DecomposeConfig {
  gateSet?: NativeGateSet
  customGates?: string[]
  maxDepth?: number
  optimizeDecomposition?: boolean
}

export class DecomposeTransform extends Transform {
  private gateSet: NativeGateSet
  private nativeGates: Set<string>
  private maxDepth: number
  private optimizeDecomposition: boolean

  constructor(config?: DecomposeConfig) {
    super({
      name: 'Decompose',
      description: 'Decompose gates to native gate set'
    })
    this.gateSet = config?.gateSet ?? 'ibmq'
    this.nativeGates = this.getNativeGates(config?.gateSet, config?.customGates)
    this.maxDepth = config?.maxDepth ?? 3
    this.optimizeDecomposition = config?.optimizeDecomposition ?? true
  }

  private getNativeGates(gateSet?: NativeGateSet, customGates?: string[]): Set<string> {
    if (customGates && customGates.length > 0) {
      return new Set(customGates)
    }

    switch (gateSet) {
      case 'clifford+t':
        return new Set(['H', 'Hadamard', 'S', 'T', 'CNOT', 'CX', 'X', 'Y', 'Z', 'PauliX', 'PauliY', 'PauliZ'])
      case 'ibmq':
        return new Set(['RZ', 'SX', 'X', 'CNOT', 'CX', 'I'])
      case 'rigetti':
        return new Set(['RX', 'RZ', 'CZ', 'I'])
      case 'ionq':
        return new Set(['RX', 'RY', 'RZ', 'RXX', 'I'])
      default:
        return new Set(['RZ', 'SX', 'X', 'CNOT', 'CX', 'I'])
    }
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = tape.operations
    const decomposed: TapeRecord[] = []
    let totalDecomposed = 0

    for (const record of operations) {
      const op = record.operation

      if (this.isNative(op)) {
        decomposed.push(record)
        continue
      }

      const decomposition = this.decomposeGate(op, 0)
      if (decomposition.length > 0) {
        totalDecomposed++
        for (const decomposedOp of decomposition) {
          decomposed.push({
            operation: decomposedOp,
            timestamp: record.timestamp
          })
        }
      } else {
        decomposed.push(record)
      }
    }

    const newTape = new QuantumTape(tape.numWires)
    for (const record of decomposed) {
      newTape.addOperation({ ...record.operation })
    }

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: totalDecomposed,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private isNative(op: TapeOperation): boolean {
    if (op.type !== 'gate') return true
    return this.nativeGates.has(op.name)
  }

  private decomposeGate(op: TapeOperation, depth: number): TapeOperation[] {
    if (depth >= this.maxDepth) return [op]
    if (this.isNative(op)) return [op]

    const decomposition = this.getDecomposition(op)

    if (decomposition.length === 0) {
      return [op]
    }

    const result: TapeOperation[] = []
    for (const decomposedOp of decomposition) {
      if (this.isNative(decomposedOp)) {
        result.push(decomposedOp)
      } else {
        result.push(...this.decomposeGate(decomposedOp, depth + 1))
      }
    }

    return result
  }

  private getDecomposition(op: TapeOperation): TapeOperation[] {
    switch (op.name) {
      case 'H':
      case 'Hadamard':
        return this.decomposeHadamard(op)
      case 'Y':
      case 'PauliY':
        return this.decomposeY(op)
      case 'Z':
      case 'PauliZ':
        return this.decomposeZ(op)
      case 'S':
        return this.decomposeS(op)
      case 'T':
        return this.decomposeT(op)
      case 'RX':
        return this.decomposeRX(op)
      case 'RY':
        return this.decomposeRY(op)
      case 'SWAP':
        return this.decomposeSWAP(op)
      case 'ISWAP':
        return this.decomposeISWAP(op)
      case 'CY':
        return this.decomposeCY(op)
      case 'CZ':
        return this.decomposeCZ(op)
      case 'CRX':
        return this.decomposeCRX(op)
      case 'CRY':
        return this.decomposeCRY(op)
      case 'CRZ':
        return this.decomposeCRZ(op)
      case 'RXX':
        return this.decomposeRXX(op)
      case 'RYY':
        return this.decomposeRYY(op)
      case 'RZZ':
        return this.decomposeRZZ(op)
      case 'Toffoli':
      case 'CCX':
        return this.decomposeToffoli(op)
      case 'CSWAP':
      case 'Fredkin':
        return this.decomposeCSWAP(op)
      case 'Rot':
        return this.decomposeRot(op)
      case 'U3':
        return this.decomposeU3(op)
      case 'U2':
        return this.decomposeU2(op)
      case 'U1':
        return this.decomposeU1(op)
      case 'PhaseShift':
        return this.decomposePhaseShift(op)
      default:
        return []
    }
  }

  private createGate(name: string, wires: number[], params: number[] = [], inverse: boolean = false): TapeOperation {
    return {
      id: 0,
      type: 'gate',
      name,
      wires,
      params,
      paramTensors: [],
      inverse,
      controlWires: []
    }
  }

  private decomposeHadamard(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    if (this.gateSet === 'ibmq') {
      return [
        this.createGate('RZ', [wire], [Math.PI / 2]),
        this.createGate('SX', [wire]),
        this.createGate('RZ', [wire], [Math.PI / 2])
      ]
    }
    if (this.gateSet === 'rigetti') {
      return [
        this.createGate('RZ', [wire], [Math.PI / 2]),
        this.createGate('RX', [wire], [Math.PI / 2]),
        this.createGate('RZ', [wire], [Math.PI / 2])
      ]
    }
    return [op]
  }

  private decomposeY(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    if (this.gateSet === 'ibmq') {
      return [
        this.createGate('RZ', [wire], [Math.PI]),
        this.createGate('X', [wire])
      ]
    }
    return [
      this.createGate('RZ', [wire], [Math.PI / 2]),
      this.createGate('RX', [wire], [Math.PI]),
      this.createGate('RZ', [wire], [-Math.PI / 2])
    ]
  }

  private decomposeZ(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    return [this.createGate('RZ', [wire], [Math.PI])]
  }

  private decomposeS(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    const angle = op.inverse ? -Math.PI / 2 : Math.PI / 2
    return [this.createGate('RZ', [wire], [angle])]
  }

  private decomposeT(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    const angle = op.inverse ? -Math.PI / 4 : Math.PI / 4
    return [this.createGate('RZ', [wire], [angle])]
  }

  private decomposeRX(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    const theta = op.params[0]
    if (this.gateSet === 'ibmq') {
      return [
        this.createGate('RZ', [wire], [Math.PI / 2]),
        this.createGate('SX', [wire]),
        this.createGate('RZ', [wire], [theta + Math.PI]),
        this.createGate('SX', [wire]),
        this.createGate('RZ', [wire], [5 * Math.PI / 2])
      ]
    }
    return [op]
  }

  private decomposeRY(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    const theta = op.params[0]
    if (this.gateSet === 'ibmq') {
      return [
        this.createGate('SX', [wire]),
        this.createGate('RZ', [wire], [theta + Math.PI]),
        this.createGate('SX', [wire]),
        this.createGate('RZ', [wire], [3 * Math.PI])
      ]
    }
    if (this.gateSet === 'rigetti') {
      return [
        this.createGate('RX', [wire], [Math.PI / 2]),
        this.createGate('RZ', [wire], [theta]),
        this.createGate('RX', [wire], [-Math.PI / 2])
      ]
    }
    return [op]
  }

  private decomposeSWAP(op: TapeOperation): TapeOperation[] {
    const [w1, w2] = op.wires
    if (this.gateSet === 'rigetti') {
      return [
        this.createGate('CZ', [w1, w2]),
        this.createGate('RY', [w1], [Math.PI / 2]),
        this.createGate('RY', [w2], [-Math.PI / 2]),
        this.createGate('CZ', [w1, w2]),
        this.createGate('RY', [w1], [-Math.PI / 2]),
        this.createGate('RY', [w2], [Math.PI / 2]),
        this.createGate('CZ', [w1, w2])
      ]
    }
    return [
      this.createGate('CNOT', [w1, w2]),
      this.createGate('CNOT', [w2, w1]),
      this.createGate('CNOT', [w1, w2])
    ]
  }

  private decomposeISWAP(op: TapeOperation): TapeOperation[] {
    const [w1, w2] = op.wires
    return [
      this.createGate('S', [w1]),
      this.createGate('S', [w2]),
      this.createGate('H', [w1]),
      this.createGate('CNOT', [w1, w2]),
      this.createGate('CNOT', [w2, w1]),
      this.createGate('H', [w2])
    ]
  }

  private decomposeCY(op: TapeOperation): TapeOperation[] {
    const [control, target] = op.wires
    return [
      this.createGate('S', [target], [], true),
      this.createGate('CNOT', [control, target]),
      this.createGate('S', [target])
    ]
  }

  private decomposeCZ(op: TapeOperation): TapeOperation[] {
    const [control, target] = op.wires
    if (this.gateSet === 'rigetti') {
      return [op]
    }
    return [
      this.createGate('H', [target]),
      this.createGate('CNOT', [control, target]),
      this.createGate('H', [target])
    ]
  }

  private decomposeCRX(op: TapeOperation): TapeOperation[] {
    const [control, target] = op.wires
    const theta = op.params[0]
    return [
      this.createGate('RZ', [target], [Math.PI / 2]),
      this.createGate('CNOT', [control, target]),
      this.createGate('RY', [target], [-theta / 2]),
      this.createGate('CNOT', [control, target]),
      this.createGate('RY', [target], [theta / 2]),
      this.createGate('RZ', [target], [-Math.PI / 2])
    ]
  }

  private decomposeCRY(op: TapeOperation): TapeOperation[] {
    const [control, target] = op.wires
    const theta = op.params[0]
    return [
      this.createGate('RY', [target], [theta / 2]),
      this.createGate('CNOT', [control, target]),
      this.createGate('RY', [target], [-theta / 2]),
      this.createGate('CNOT', [control, target])
    ]
  }

  private decomposeCRZ(op: TapeOperation): TapeOperation[] {
    const [control, target] = op.wires
    const theta = op.params[0]
    return [
      this.createGate('RZ', [target], [theta / 2]),
      this.createGate('CNOT', [control, target]),
      this.createGate('RZ', [target], [-theta / 2]),
      this.createGate('CNOT', [control, target])
    ]
  }

  private decomposeRXX(op: TapeOperation): TapeOperation[] {
    const [w1, w2] = op.wires
    const theta = op.params[0]
    if (this.gateSet === 'ionq') {
      return [op]
    }
    return [
      this.createGate('H', [w1]),
      this.createGate('H', [w2]),
      this.createGate('CNOT', [w1, w2]),
      this.createGate('RZ', [w2], [theta]),
      this.createGate('CNOT', [w1, w2]),
      this.createGate('H', [w1]),
      this.createGate('H', [w2])
    ]
  }

  private decomposeRYY(op: TapeOperation): TapeOperation[] {
    const [w1, w2] = op.wires
    const theta = op.params[0]
    return [
      this.createGate('RX', [w1], [Math.PI / 2]),
      this.createGate('RX', [w2], [Math.PI / 2]),
      this.createGate('CNOT', [w1, w2]),
      this.createGate('RZ', [w2], [theta]),
      this.createGate('CNOT', [w1, w2]),
      this.createGate('RX', [w1], [-Math.PI / 2]),
      this.createGate('RX', [w2], [-Math.PI / 2])
    ]
  }

  private decomposeRZZ(op: TapeOperation): TapeOperation[] {
    const [w1, w2] = op.wires
    const theta = op.params[0]
    return [
      this.createGate('CNOT', [w1, w2]),
      this.createGate('RZ', [w2], [theta]),
      this.createGate('CNOT', [w1, w2])
    ]
  }

  private decomposeToffoli(op: TapeOperation): TapeOperation[] {
    const [c1, c2, target] = op.wires
    return [
      this.createGate('H', [target]),
      this.createGate('CNOT', [c2, target]),
      this.createGate('T', [target], [], true),
      this.createGate('CNOT', [c1, target]),
      this.createGate('T', [target]),
      this.createGate('CNOT', [c2, target]),
      this.createGate('T', [target], [], true),
      this.createGate('CNOT', [c1, target]),
      this.createGate('T', [c2]),
      this.createGate('T', [target]),
      this.createGate('H', [target]),
      this.createGate('CNOT', [c1, c2]),
      this.createGate('T', [c1]),
      this.createGate('T', [c2], [], true),
      this.createGate('CNOT', [c1, c2])
    ]
  }

  private decomposeCSWAP(op: TapeOperation): TapeOperation[] {
    const [control, t1, t2] = op.wires
    return [
      this.createGate('CNOT', [t2, t1]),
      this.createGate('Toffoli', [control, t1, t2]),
      this.createGate('CNOT', [t2, t1])
    ]
  }

  private decomposeRot(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    const [phi, theta, omega] = op.params
    return [
      this.createGate('RZ', [wire], [phi]),
      this.createGate('RY', [wire], [theta]),
      this.createGate('RZ', [wire], [omega])
    ]
  }

  private decomposeU3(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    const [theta, phi, lambda] = op.params
    return [
      this.createGate('RZ', [wire], [phi]),
      this.createGate('RY', [wire], [theta]),
      this.createGate('RZ', [wire], [lambda])
    ]
  }

  private decomposeU2(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    const [phi, lambda] = op.params
    return [
      this.createGate('RZ', [wire], [phi - Math.PI / 2]),
      this.createGate('SX', [wire]),
      this.createGate('RZ', [wire], [lambda + Math.PI / 2])
    ]
  }

  private decomposeU1(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    const lambda = op.params[0]
    return [this.createGate('RZ', [wire], [lambda])]
  }

  private decomposePhaseShift(op: TapeOperation): TapeOperation[] {
    const wire = op.wires[0]
    const phi = op.params[0]
    return [this.createGate('RZ', [wire], [phi])]
  }
}

export class DecomposeMultiControlledTransform extends Transform {
  constructor() {
    super({
      name: 'DecomposeMultiControlled',
      description: 'Decompose multi-controlled gates into single and two-qubit gates'
    })
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = tape.operations
    const decomposed: TapeRecord[] = []
    let totalDecomposed = 0

    for (const record of operations) {
      const op = record.operation

      if (op.controlWires.length <= 1) {
        decomposed.push(record)
        continue
      }

      const decomposition = this.decomposeMultiControlled(op)
      if (decomposition.length > 0) {
        totalDecomposed++
        for (const decomposedOp of decomposition) {
          decomposed.push({
            operation: decomposedOp,
            timestamp: record.timestamp
          })
        }
      } else {
        decomposed.push(record)
      }
    }

    const newTape = new QuantumTape(tape.numWires)
    for (const record of decomposed) {
      newTape.addOperation({ ...record.operation })
    }

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: totalDecomposed,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private decomposeMultiControlled(op: TapeOperation): TapeOperation[] {
    const numControls = op.controlWires.length
    if (numControls <= 1) return [op]

    const controls = [...op.controlWires]
    const target = op.wires[0]

    return this.multiControlledDecomposition(controls, target, op.name, op.params)
  }

  private multiControlledDecomposition(
    controls: number[],
    target: number,
    gateName: string,
    params: number[]
  ): TapeOperation[] {
    if (controls.length === 1) {
      return [this.createControlledGate(controls[0], target, gateName, params)]
    }

    if (controls.length === 2) {
      return this.decomposeTwoControlled(controls, target, gateName, params)
    }

    const result: TapeOperation[] = []
    const ancilla = Math.max(...controls, target) + 1
    const firstHalf = controls.slice(0, Math.floor(controls.length / 2))
    const secondHalf = controls.slice(Math.floor(controls.length / 2))

    result.push(...this.decomposeTwoControlled([...firstHalf.slice(0, 2)], ancilla, 'X', []))
    result.push(...this.multiControlledDecomposition([ancilla, ...secondHalf], target, gateName, params))
    result.push(...this.decomposeTwoControlled([...firstHalf.slice(0, 2)], ancilla, 'X', []))

    return result
  }

  private decomposeTwoControlled(controls: number[], target: number, gateName: string, params: number[]): TapeOperation[] {
    const [c1, c2] = controls
    return [
      this.createGate('Toffoli', [c1, c2, target])
    ]
  }

  private createControlledGate(control: number, target: number, gateName: string, params: number[]): TapeOperation {
    const controlledName = gateName.startsWith('C') ? gateName : `C${gateName}`
    return this.createGate(controlledName, [control, target], params)
  }

  private createGate(name: string, wires: number[], params: number[] = []): TapeOperation {
    return {
      id: 0,
      type: 'gate',
      name,
      wires,
      params,
      paramTensors: [],
      inverse: false,
      controlWires: []
    }
  }
}

export class UnrollToNativeTransform extends Transform {
  private nativeGates: Set<string>
  private maxIterations: number

  constructor(config?: { gateSet?: NativeGateSet; customGates?: string[]; maxIterations?: number }) {
    super({
      name: 'UnrollToNative',
      description: 'Recursively unroll all gates to native gate set'
    })
    this.nativeGates = new Set(config?.customGates ?? ['RZ', 'SX', 'X', 'CNOT', 'CX', 'I'])
    this.maxIterations = config?.maxIterations ?? 10
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    let currentTape = tape.copy()
    let totalDecomposed = 0

    for (let i = 0; i < this.maxIterations; i++) {
      const decomposer = new DecomposeTransform({ customGates: Array.from(this.nativeGates) })
      const result = decomposer.apply(currentTape)

      if (result.stats.gatesDecomposed === 0) {
        break
      }

      totalDecomposed += result.stats.gatesDecomposed
      currentTape = result.tape
    }

    return {
      tape: currentTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: currentTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: totalDecomposed,
        executionTimeMs: Date.now() - startTime
      }
    }
  }
}

export function decompose(config?: DecomposeConfig): DecomposeTransform {
  return new DecomposeTransform(config)
}

export function decomposeMultiControlled(): DecomposeMultiControlledTransform {
  return new DecomposeMultiControlledTransform()
}

export function unrollToNative(config?: { gateSet?: NativeGateSet; customGates?: string[]; maxIterations?: number }): UnrollToNativeTransform {
  return new UnrollToNativeTransform(config)
}

export function toIBMQ(): DecomposeTransform {
  return new DecomposeTransform({ gateSet: 'ibmq' })
}

export function toRigetti(): DecomposeTransform {
  return new DecomposeTransform({ gateSet: 'rigetti' })
}

export function toIonQ(): DecomposeTransform {
  return new DecomposeTransform({ gateSet: 'ionq' })
}

export function toCliffordT(): DecomposeTransform {
  return new DecomposeTransform({ gateSet: 'clifford+t' })
}
