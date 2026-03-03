import { QuantumTape, TapeOperation, TapeRecord } from '../../autodiff/tape'
import { QTensor } from '../../core/tensor'
import { Transform, TransformResult, arraysEqual } from '../base'

export interface MergeRotationsConfig {
  tolerance?: number
  mergeAcrossTypes?: boolean
  maxMergeDistance?: number
}

export class MergeRotationsTransform extends Transform {
  private tolerance: number
  private mergeAcrossTypes: boolean
  private maxMergeDistance: number

  constructor(config?: MergeRotationsConfig) {
    super({
      name: 'MergeRotations',
      description: 'Merge consecutive rotation gates on the same wire'
    })
    this.tolerance = config?.tolerance ?? 1e-10
    this.mergeAcrossTypes = config?.mergeAcrossTypes ?? false
    this.maxMergeDistance = config?.maxMergeDistance ?? 1
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = tape.operations
    const merged = this.mergeOperations(operations)
    const newTape = this.buildTape(tape.numWires, merged)

    const gatesMerged = operations.length - merged.length

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: gatesMerged,
        gatesMerged,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private mergeOperations(operations: TapeRecord[]): TapeRecord[] {
    if (operations.length === 0) return []

    const result: TapeRecord[] = []
    const toSkip = new Set<number>()

    for (let i = 0; i < operations.length; i++) {
      if (toSkip.has(i)) continue

      const op1 = operations[i].operation

      if (!this.isRotationGate(op1)) {
        result.push(operations[i])
        continue
      }

      let mergedOp = { ...op1, params: [...op1.params] }
      let mergeCount = 0

      for (let j = i + 1; j < Math.min(i + 1 + this.maxMergeDistance, operations.length); j++) {
        if (toSkip.has(j)) continue

        const op2 = operations[j].operation

        if (!this.canMerge(mergedOp, op2)) {
          if (this.blocksMerge(mergedOp, op2)) break
          continue
        }

        mergedOp = this.mergeGates(mergedOp, op2)
        toSkip.add(j)
        mergeCount++
      }

      if (this.isNegligible(mergedOp)) {
        continue
      }

      result.push({
        operation: mergedOp,
        timestamp: operations[i].timestamp
      })
    }

    return result
  }

  private isRotationGate(op: TapeOperation): boolean {
    const rotationGates = ['RX', 'RY', 'RZ', 'PhaseShift', 'Rot', 'CRX', 'CRY', 'CRZ', 'RXX', 'RYY', 'RZZ', 'U1', 'U3']
    return op.type === 'gate' && rotationGates.includes(op.name)
  }

  private canMerge(op1: TapeOperation, op2: TapeOperation): boolean {
    if (op2.type !== 'gate') return false

    if (!arraysEqual(op1.wires, op2.wires)) return false

    if (this.mergeAcrossTypes) {
      return this.isRotationGate(op2) && this.isSameAxis(op1, op2)
    }

    return op1.name === op2.name
  }

  private isSameAxis(op1: TapeOperation, op2: TapeOperation): boolean {
    const xRotations = ['RX', 'CRX']
    const yRotations = ['RY', 'CRY']
    const zRotations = ['RZ', 'CRZ', 'PhaseShift', 'U1']

    if (xRotations.includes(op1.name) && xRotations.includes(op2.name)) return true
    if (yRotations.includes(op1.name) && yRotations.includes(op2.name)) return true
    if (zRotations.includes(op1.name) && zRotations.includes(op2.name)) return true

    return false
  }

  private blocksMerge(op1: TapeOperation, op2: TapeOperation): boolean {
    const wires1 = new Set([...op1.wires, ...op1.controlWires])
    const wires2 = new Set([...op2.wires, ...op2.controlWires])
    const wires1Array = Array.from(wires1)

    for (let i = 0; i < wires1Array.length; i++) {
      if (wires2.has(wires1Array[i])) return true
    }

    return false
  }

  private mergeGates(op1: TapeOperation, op2: TapeOperation): TapeOperation {
    if (op1.name === op2.name) {
      const newParams = op1.params.map((p, i) => p + op2.params[i])
      return {
        ...op1,
        params: newParams,
        paramTensors: this.mergeParamTensors(op1.paramTensors, op2.paramTensors)
      }
    }

    if (this.mergeAcrossTypes) {
      return this.mergeAcrossAxisTypes(op1, op2)
    }

    return op1
  }

  private mergeAcrossAxisTypes(op1: TapeOperation, op2: TapeOperation): TapeOperation {
    const totalAngle = op1.params[0] + op2.params[0]
    return {
      ...op1,
      params: [this.normalizeAngle(totalAngle)],
      paramTensors: this.mergeParamTensors(op1.paramTensors, op2.paramTensors)
    }
  }

  private mergeParamTensors(tensors1: QTensor[], tensors2: QTensor[]): QTensor[] {
    if (tensors1.length === 0 && tensors2.length === 0) return []
    if (tensors1.length === 0) return tensors2
    if (tensors2.length === 0) return tensors1

    return tensors1.map((t, i) => {
      if (i < tensors2.length) {
        return t.add(tensors2[i])
      }
      return t
    })
  }

  private isNegligible(op: TapeOperation): boolean {
    if (!this.isRotationGate(op)) return false

    for (const param of op.params) {
      const normalizedAngle = this.normalizeAngle(param)
      if (Math.abs(normalizedAngle) > this.tolerance) {
        return false
      }
    }

    return true
  }

  private normalizeAngle(angle: number): number {
    let normalized = angle % (2 * Math.PI)
    if (normalized > Math.PI) {
      normalized -= 2 * Math.PI
    } else if (normalized < -Math.PI) {
      normalized += 2 * Math.PI
    }
    return normalized
  }

  private buildTape(numWires: number, operations: TapeRecord[]): QuantumTape {
    const newTape = new QuantumTape(numWires)

    for (const record of operations) {
      const op = record.operation
      newTape.addOperation({
        type: op.type,
        name: op.name,
        wires: [...op.wires],
        params: [...op.params],
        paramTensors: [...op.paramTensors],
        inverse: op.inverse,
        controlWires: [...op.controlWires],
        matrix: op.matrix
      })
    }

    return newTape
  }
}

export class MergeAdjacentRotationsTransform extends Transform {
  private tolerance: number

  constructor(config?: { tolerance?: number }) {
    super({
      name: 'MergeAdjacentRotations',
      description: 'Merge immediately adjacent rotation gates'
    })
    this.tolerance = config?.tolerance ?? 1e-10
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = [...tape.operations]
    let changed = true
    let gatesMerged = 0

    while (changed) {
      changed = false
      for (let i = 0; i < operations.length - 1; i++) {
        const op1 = operations[i].operation
        const op2 = operations[i + 1].operation

        if (this.canMerge(op1, op2)) {
          const merged = this.merge(op1, op2)

          if (this.isNegligible(merged)) {
            operations.splice(i, 2)
            gatesMerged += 2
          } else {
            operations.splice(i, 2, {
              operation: merged,
              timestamp: operations[i].timestamp
            })
            gatesMerged++
          }

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
        gatesRemoved: gatesMerged,
        gatesMerged,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private canMerge(op1: TapeOperation, op2: TapeOperation): boolean {
    if (op1.type !== 'gate' || op2.type !== 'gate') return false
    if (op1.name !== op2.name) return false
    if (!arraysEqual(op1.wires, op2.wires)) return false

    const rotationGates = ['RX', 'RY', 'RZ', 'PhaseShift', 'CRX', 'CRY', 'CRZ', 'RXX', 'RYY', 'RZZ']
    return rotationGates.includes(op1.name)
  }

  private merge(op1: TapeOperation, op2: TapeOperation): TapeOperation {
    const newParams = op1.params.map((p, i) => p + op2.params[i])
    return {
      ...op1,
      params: newParams
    }
  }

  private isNegligible(op: TapeOperation): boolean {
    for (const param of op.params) {
      const normalized = param % (2 * Math.PI)
      if (Math.abs(normalized) > this.tolerance && Math.abs(normalized - 2 * Math.PI) > this.tolerance) {
        return false
      }
    }
    return true
  }
}

export class MergeRotIntoU3Transform extends Transform {
  private tolerance: number

  constructor(config?: { tolerance?: number }) {
    super({
      name: 'MergeRotIntoU3',
      description: 'Merge consecutive single-qubit rotations into U3 gates'
    })
    this.tolerance = config?.tolerance ?? 1e-10
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const operations = tape.operations
    const result: TapeRecord[] = []
    const toSkip = new Set<number>()

    for (let i = 0; i < operations.length; i++) {
      if (toSkip.has(i)) continue

      const op = operations[i].operation

      if (!this.isSingleQubitRotation(op)) {
        result.push(operations[i])
        continue
      }

      let accumulated = this.toZYZ(op)
      let mergeCount = 0

      for (let j = i + 1; j < operations.length; j++) {
        const nextOp = operations[j].operation

        if (!this.canMergeIntoU3(op, nextOp)) {
          break
        }

        const nextZYZ = this.toZYZ(nextOp)
        accumulated = this.composeZYZ(accumulated, nextZYZ)
        toSkip.add(j)
        mergeCount++
      }

      if (mergeCount > 0 || this.shouldConvertToU3(op)) {
        const u3Op = this.createU3(op.wires[0], accumulated)
        result.push({
          operation: u3Op,
          timestamp: operations[i].timestamp
        })
      } else {
        result.push(operations[i])
      }
    }

    const newTape = new QuantumTape(tape.numWires)
    for (const record of result) {
      newTape.addOperation({ ...record.operation })
    }

    return {
      tape: newTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: newTape.numOperations,
        gatesRemoved: tape.numOperations - newTape.numOperations,
        gatesMerged: tape.numOperations - newTape.numOperations,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private isSingleQubitRotation(op: TapeOperation): boolean {
    const singleQubitRots = ['RX', 'RY', 'RZ', 'PhaseShift', 'Rot', 'U3', 'H', 'S', 'T', 'SX']
    return op.type === 'gate' && singleQubitRots.includes(op.name) && op.wires.length === 1
  }

  private canMergeIntoU3(op1: TapeOperation, op2: TapeOperation): boolean {
    if (!this.isSingleQubitRotation(op2)) return false
    return arraysEqual(op1.wires, op2.wires)
  }

  private shouldConvertToU3(op: TapeOperation): boolean {
    return false
  }

  private toZYZ(op: TapeOperation): [number, number, number] {
    switch (op.name) {
      case 'RX': {
        const theta = op.params[0]
        return [-Math.PI / 2, theta, Math.PI / 2]
      }
      case 'RY': {
        const theta = op.params[0]
        return [0, theta, 0]
      }
      case 'RZ': {
        const phi = op.params[0]
        return [phi, 0, 0]
      }
      case 'PhaseShift': {
        const phi = op.params[0]
        return [phi, 0, 0]
      }
      case 'Rot': {
        return [op.params[0], op.params[1], op.params[2]]
      }
      case 'U3': {
        return [op.params[2], op.params[0], op.params[1]]
      }
      case 'H': {
        return [Math.PI, Math.PI / 2, 0]
      }
      case 'S': {
        return [Math.PI / 2, 0, 0]
      }
      case 'T': {
        return [Math.PI / 4, 0, 0]
      }
      case 'SX': {
        return [-Math.PI / 2, Math.PI / 2, Math.PI / 2]
      }
      default:
        return [0, 0, 0]
    }
  }

  private composeZYZ(zyz1: [number, number, number], zyz2: [number, number, number]): [number, number, number] {
    const [phi1, theta1, lambda1] = zyz1
    const [phi2, theta2, lambda2] = zyz2

    const c1 = Math.cos(theta1 / 2)
    const s1 = Math.sin(theta1 / 2)
    const c2 = Math.cos(theta2 / 2)
    const s2 = Math.sin(theta2 / 2)

    const alpha = lambda1 + phi2

    const cosHalfTheta = c1 * c2 * Math.cos(alpha / 2) - s1 * s2 * Math.cos(alpha / 2)
    const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta)

    const theta = 2 * Math.acos(Math.max(-1, Math.min(1, cosHalfTheta)))

    let phi = phi1
    let lambda = lambda2

    if (Math.abs(sinHalfTheta) > this.tolerance) {
      const argPhi = Math.atan2(
        c1 * s2 * Math.sin(lambda2 / 2) + s1 * c2 * Math.sin(phi1 / 2),
        c1 * s2 * Math.cos(lambda2 / 2) + s1 * c2 * Math.cos(phi1 / 2)
      )
      const argLambda = Math.atan2(
        s1 * c2 * Math.sin(lambda1 / 2) + c1 * s2 * Math.sin(phi2 / 2),
        s1 * c2 * Math.cos(lambda1 / 2) + c1 * s2 * Math.cos(phi2 / 2)
      )
      phi = 2 * argPhi
      lambda = 2 * argLambda
    } else {
      phi = phi1 + phi2
      lambda = lambda1 + lambda2
    }

    return [this.normalizeAngle(phi), Math.abs(theta), this.normalizeAngle(lambda)]
  }

  private normalizeAngle(angle: number): number {
    let normalized = angle % (2 * Math.PI)
    if (normalized > Math.PI) {
      normalized -= 2 * Math.PI
    } else if (normalized < -Math.PI) {
      normalized += 2 * Math.PI
    }
    return normalized
  }

  private createU3(wire: number, zyz: [number, number, number]): TapeOperation {
    const [phi, theta, lambda] = zyz
    return {
      id: 0,
      type: 'gate',
      name: 'U3',
      wires: [wire],
      params: [theta, phi, lambda],
      paramTensors: [],
      inverse: false,
      controlWires: []
    }
  }
}

export function mergeRotations(config?: MergeRotationsConfig): MergeRotationsTransform {
  return new MergeRotationsTransform(config)
}

export function mergeAdjacentRotations(config?: { tolerance?: number }): MergeAdjacentRotationsTransform {
  return new MergeAdjacentRotationsTransform(config)
}

export function mergeRotIntoU3(config?: { tolerance?: number }): MergeRotIntoU3Transform {
  return new MergeRotIntoU3Transform(config)
}
