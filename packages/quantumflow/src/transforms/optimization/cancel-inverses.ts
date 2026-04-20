import { QuantumTape, TapeOperation, TapeRecord } from '../../autodiff/tape'
import { Transform, TransformResult, arraysEqual, wiresOverlap } from '../base'

export interface CancelInversesConfig {
  maxSearchDepth?: number
  cancelParametric?: boolean
  tolerance?: number
}

export class CancelInversesTransform extends Transform {
  private maxSearchDepth: number
  private cancelParametric: boolean
  private tolerance: number

  constructor(config?: CancelInversesConfig) {
    super({
      name: 'CancelInverses',
      description: 'Cancel adjacent inverse gate pairs'
    })
    this.maxSearchDepth = config?.maxSearchDepth ?? 5
    this.cancelParametric = config?.cancelParametric ?? true
    this.tolerance = config?.tolerance ?? 1e-10
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = [...tape.operations]
    let totalRemoved = 0
    let changed = true

    while (changed) {
      changed = false
      const result: TapeRecord[] = []
      const toSkip = new Set<number>()

      for (let i = 0; i < operations.length; i++) {
        if (toSkip.has(i)) continue

        const op1 = operations[i].operation

        if (!this.isCancellable(op1)) {
          result.push(operations[i])
          continue
        }

        let foundPair = false

        for (let j = i + 1; j < Math.min(i + 1 + this.maxSearchDepth, operations.length); j++) {
          if (toSkip.has(j)) continue

          const op2 = operations[j].operation

          if (this.blocksCommutation(op1, op2, operations, i, j)) {
            break
          }

          if (this.areInverses(op1, op2)) {
            toSkip.add(j)
            foundPair = true
            totalRemoved += 2
            changed = true
            break
          }
        }

        if (!foundPair) {
          result.push(operations[i])
        }
      }

      operations.length = 0
      operations.push(...result)
    }

    const newTape = new QuantumTape(tape.numWires)
    for (const record of operations) {
      newTape.addOperation({ ...record.operation })
    }

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: totalRemoved,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private isCancellable(op: TapeOperation): boolean {
    if (op.type !== 'gate') return false

    const selfInverseGates = [
      'PauliX', 'PauliY', 'PauliZ', 'X', 'Y', 'Z',
      'Hadamard', 'H', 'CNOT', 'CX', 'CY', 'CZ',
      'SWAP', 'Toffoli', 'CCX', 'CSWAP', 'Fredkin'
    ]

    const parametricGates = [
      'RX', 'RY', 'RZ', 'PhaseShift', 'Rot', 'U3',
      'CRX', 'CRY', 'CRZ', 'RXX', 'RYY', 'RZZ'
    ]

    const otherInvertibleGates = ['S', 'T', 'SX', 'ISWAP']

    return (
      selfInverseGates.includes(op.name) ||
      otherInvertibleGates.includes(op.name) ||
      (this.cancelParametric && parametricGates.includes(op.name))
    )
  }

  private areInverses(op1: TapeOperation, op2: TapeOperation): boolean {
    if (!arraysEqual(op1.wires, op2.wires)) return false
    if (!arraysEqual(op1.controlWires, op2.controlWires)) return false

    const selfInverseGates = [
      'PauliX', 'PauliY', 'PauliZ', 'X', 'Y', 'Z',
      'Hadamard', 'H', 'CNOT', 'CX', 'CY', 'CZ',
      'SWAP', 'Toffoli', 'CCX', 'CSWAP', 'Fredkin'
    ]

    if (selfInverseGates.includes(op1.name) && op1.name === op2.name) {
      return !op1.inverse === !op2.inverse
    }

    if (op1.name === op2.name && op1.inverse !== op2.inverse) {
      return true
    }

    if (op1.name === 'S' && op2.name === 'S') {
      return op1.inverse !== op2.inverse
    }

    if (op1.name === 'T' && op2.name === 'T') {
      return op1.inverse !== op2.inverse
    }

    if (op1.name === 'SX' && op2.name === 'SX') {
      return op1.inverse !== op2.inverse
    }

    if (this.cancelParametric && op1.name === op2.name) {
      return this.areParametricInverses(op1, op2)
    }

    return false
  }

  private areParametricInverses(op1: TapeOperation, op2: TapeOperation): boolean {
    if (op1.params.length !== op2.params.length) return false

    for (let i = 0; i < op1.params.length; i++) {
      const sum = op1.params[i] + op2.params[i]
      const normalizedSum = sum % (2 * Math.PI)

      if (Math.abs(normalizedSum) > this.tolerance && Math.abs(normalizedSum - 2 * Math.PI) > this.tolerance) {
        return false
      }
    }

    return true
  }

  private blocksCommutation(
    op1: TapeOperation,
    op2: TapeOperation,
    operations: TapeRecord[],
    startIdx: number,
    endIdx: number
  ): boolean {
    const wires1 = new Set([...op1.wires, ...op1.controlWires])
    const wires1Array = Array.from(wires1)

    for (let k = startIdx + 1; k < endIdx; k++) {
      const midOp = operations[k].operation
      const wiresMid = new Set([...midOp.wires, ...midOp.controlWires])

      for (let i = 0; i < wires1Array.length; i++) {
        const w = wires1Array[i]
        if (wiresMid.has(w) && !this.canCommute(op1, midOp)) {
          return true
        }
      }
    }

    return false
  }

  private canCommute(op1: TapeOperation, op2: TapeOperation): boolean {
    if (!wiresOverlap([...op1.wires, ...op1.controlWires], [...op2.wires, ...op2.controlWires])) {
      return true
    }

    const diagonalGates = ['RZ', 'PhaseShift', 'CZ', 'CRZ', 'RZZ', 'PauliZ', 'Z', 'S', 'T']

    if (diagonalGates.includes(op1.name) && diagonalGates.includes(op2.name)) {
      return true
    }

    return false
  }
}

export class CancelSelfInverseTransform extends Transform {
  constructor() {
    super({
      name: 'CancelSelfInverse',
      description: 'Cancel adjacent self-inverse gates (X, Y, Z, H, CNOT, etc.)'
    })
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = [...tape.operations]
    let totalRemoved = 0
    let changed = true

    while (changed) {
      changed = false

      for (let i = 0; i < operations.length - 1; i++) {
        const op1 = operations[i].operation
        const op2 = operations[i + 1].operation

        if (this.areSelfInversePair(op1, op2)) {
          operations.splice(i, 2)
          totalRemoved += 2
          changed = true
          break
        }
      }
    }

    const newTape = new QuantumTape(tape.numWires)
    for (const record of operations) {
      newTape.addOperation({ ...record.operation })
    }

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: totalRemoved,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private areSelfInversePair(op1: TapeOperation, op2: TapeOperation): boolean {
    const selfInverseGates = [
      'PauliX', 'PauliY', 'PauliZ', 'X', 'Y', 'Z',
      'Hadamard', 'H', 'CNOT', 'CX', 'CY', 'CZ',
      'SWAP', 'Toffoli', 'CCX', 'CSWAP', 'Fredkin'
    ]

    if (!selfInverseGates.includes(op1.name)) return false
    if (op1.name !== op2.name) return false
    if (!arraysEqual(op1.wires, op2.wires)) return false
    if (!arraysEqual(op1.controlWires, op2.controlWires)) return false

    return true
  }
}

export class CancelHadamardTransform extends Transform {
  constructor() {
    super({
      name: 'CancelHadamard',
      description: 'Cancel adjacent Hadamard gates'
    })
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = [...tape.operations]
    let totalRemoved = 0
    let changed = true

    while (changed) {
      changed = false

      for (let i = 0; i < operations.length - 1; i++) {
        const op1 = operations[i].operation
        const op2 = operations[i + 1].operation

        if (this.areHadamardPair(op1, op2)) {
          operations.splice(i, 2)
          totalRemoved += 2
          changed = true
          break
        }
      }
    }

    const newTape = new QuantumTape(tape.numWires)
    for (const record of operations) {
      newTape.addOperation({ ...record.operation })
    }

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: totalRemoved,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private areHadamardPair(op1: TapeOperation, op2: TapeOperation): boolean {
    if (op1.name !== 'H' && op1.name !== 'Hadamard') return false
    if (op2.name !== 'H' && op2.name !== 'Hadamard') return false
    return arraysEqual(op1.wires, op2.wires)
  }
}

export class CancelCNOTTransform extends Transform {
  constructor() {
    super({
      name: 'CancelCNOT',
      description: 'Cancel adjacent CNOT gates with same control and target'
    })
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = [...tape.operations]
    let totalRemoved = 0
    let changed = true

    while (changed) {
      changed = false

      for (let i = 0; i < operations.length - 1; i++) {
        const op1 = operations[i].operation
        const op2 = operations[i + 1].operation

        if (this.areCNOTPair(op1, op2)) {
          operations.splice(i, 2)
          totalRemoved += 2
          changed = true
          break
        }
      }
    }

    const newTape = new QuantumTape(tape.numWires)
    for (const record of operations) {
      newTape.addOperation({ ...record.operation })
    }

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: totalRemoved,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private areCNOTPair(op1: TapeOperation, op2: TapeOperation): boolean {
    const cnotNames = ['CNOT', 'CX']
    if (!cnotNames.includes(op1.name)) return false
    if (!cnotNames.includes(op2.name)) return false
    return arraysEqual(op1.wires, op2.wires)
  }
}

export class CancelDaggerTransform extends Transform {
  constructor() {
    super({
      name: 'CancelDagger',
      description: 'Cancel gate-dagger pairs (e.g., S and S†, T and T†)'
    })
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = [...tape.operations]
    let totalRemoved = 0
    let changed = true

    while (changed) {
      changed = false

      for (let i = 0; i < operations.length - 1; i++) {
        const op1 = operations[i].operation
        const op2 = operations[i + 1].operation

        if (this.areDaggerPair(op1, op2)) {
          operations.splice(i, 2)
          totalRemoved += 2
          changed = true
          break
        }
      }
    }

    const newTape = new QuantumTape(tape.numWires)
    for (const record of operations) {
      newTape.addOperation({ ...record.operation })
    }

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: totalRemoved,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private areDaggerPair(op1: TapeOperation, op2: TapeOperation): boolean {
    if (op1.name !== op2.name) return false
    if (!arraysEqual(op1.wires, op2.wires)) return false

    const daggerGates = ['S', 'T', 'SX', 'ISWAP']
    if (!daggerGates.includes(op1.name)) return false

    return op1.inverse !== op2.inverse
  }
}

export class CommuteThroughTransform extends Transform {
  private maxDepth: number

  constructor(config?: { maxDepth?: number }) {
    super({
      name: 'CommuteThrough',
      description: 'Commute gates to enable more cancellations'
    })
    this.maxDepth = config?.maxDepth ?? 10
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = [...tape.operations]
    let changed = true
    let iterations = 0

    while (changed && iterations < this.maxDepth) {
      changed = false
      iterations++

      for (let i = 0; i < operations.length - 1; i++) {
        const op1 = operations[i].operation
        const op2 = operations[i + 1].operation

        if (this.shouldSwap(op1, op2)) {
          [operations[i], operations[i + 1]] = [operations[i + 1], operations[i]]
          changed = true
        }
      }
    }

    const newTape = new QuantumTape(tape.numWires)
    for (const record of operations) {
      newTape.addOperation({ ...record.operation })
    }

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private shouldSwap(op1: TapeOperation, op2: TapeOperation): boolean {
    if (!this.canCommute(op1, op2)) return false

    const priority1 = this.getGatePriority(op1)
    const priority2 = this.getGatePriority(op2)

    if (priority1 !== priority2) {
      return priority2 < priority1
    }

    if (op1.name === op2.name && arraysEqual(op1.wires, op2.wires)) {
      return false
    }

    return op2.name < op1.name
  }

  private canCommute(op1: TapeOperation, op2: TapeOperation): boolean {
    if (!wiresOverlap([...op1.wires, ...op1.controlWires], [...op2.wires, ...op2.controlWires])) {
      return true
    }

    const diagonalGates = ['RZ', 'PhaseShift', 'CZ', 'CRZ', 'RZZ', 'PauliZ', 'Z', 'S', 'T']

    if (diagonalGates.includes(op1.name) && diagonalGates.includes(op2.name)) {
      return true
    }

    return false
  }

  private getGatePriority(op: TapeOperation): number {
    const priorities: Record<string, number> = {
      'PauliX': 1, 'X': 1,
      'PauliY': 2, 'Y': 2,
      'PauliZ': 3, 'Z': 3,
      'H': 4, 'Hadamard': 4,
      'S': 5, 'T': 6, 'SX': 7,
      'RX': 10, 'RY': 11, 'RZ': 12,
      'CNOT': 20, 'CX': 20, 'CY': 21, 'CZ': 22,
      'SWAP': 30
    }
    return priorities[op.name] ?? 50
  }
}

export function cancelInverses(config?: CancelInversesConfig): CancelInversesTransform {
  return new CancelInversesTransform(config)
}

export function cancelSelfInverse(): CancelSelfInverseTransform {
  return new CancelSelfInverseTransform()
}

export function cancelHadamard(): CancelHadamardTransform {
  return new CancelHadamardTransform()
}

export function cancelCNOT(): CancelCNOTTransform {
  return new CancelCNOTTransform()
}

export function cancelDagger(): CancelDaggerTransform {
  return new CancelDaggerTransform()
}

export function commuteThrough(config?: { maxDepth?: number }): CommuteThroughTransform {
  return new CommuteThroughTransform(config)
}
