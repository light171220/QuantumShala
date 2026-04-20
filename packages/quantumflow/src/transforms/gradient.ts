import { QuantumTape, TapeOperation, TapeRecord } from '../autodiff/tape'
import { QTensor } from '../core/tensor'
import { Complex } from '../core/complex'
import { Transform, TransformResult, TransformConfig, arraysEqual } from './base'

export interface GradientTransformConfig extends TransformConfig {
  shiftValue?: number
  method?: 'parameter-shift' | 'finite-diff' | 'adjoint' | 'backprop'
}

export class ParameterShiftTransform extends Transform {
  private shiftValue: number

  constructor(config?: Partial<GradientTransformConfig>) {
    super({
      name: 'ParameterShift',
      description: 'Transform circuit for parameter-shift rule gradient computation',
      preservesGrad: true,
      ...config
    })
    this.shiftValue = config?.shiftValue ?? Math.PI / 2
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const shiftedTapes = this.generateShiftedTapes(tape)

    const resultTape = new QuantumTape(tape.numWires)
    for (const record of tape.operations) {
      resultTape.addOperation({ ...record.operation })
    }

    return {
      tape: resultTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: resultTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  generateShiftedTapes(tape: QuantumTape): { plus: QuantumTape; minus: QuantumTape; paramIndex: number }[] {
    const parametricOps = tape.getParametricOperations()
    const shiftedTapes: { plus: QuantumTape; minus: QuantumTape; paramIndex: number }[] = []

    let paramIndex = 0
    for (const record of parametricOps) {
      const op = record.operation
      for (let i = 0; i < op.params.length; i++) {
        const plusTape = this.createShiftedTape(tape, op.id, i, this.shiftValue)
        const minusTape = this.createShiftedTape(tape, op.id, i, -this.shiftValue)
        shiftedTapes.push({ plus: plusTape, minus: minusTape, paramIndex })
        paramIndex++
      }
    }

    return shiftedTapes
  }

  private createShiftedTape(tape: QuantumTape, opId: number, paramIdx: number, shift: number): QuantumTape {
    const newTape = new QuantumTape(tape.numWires)

    for (const record of tape.operations) {
      const op = record.operation
      if (op.id === opId) {
        const newParams = [...op.params]
        newParams[paramIdx] += shift
        newTape.addOperation({
          type: op.type,
          name: op.name,
          wires: [...op.wires],
          params: newParams,
          paramTensors: op.paramTensors.map(t => t.clone()),
          inverse: op.inverse,
          controlWires: [...op.controlWires],
          matrix: op.matrix
        })
      } else {
        newTape.addOperation({ ...op })
      }
    }

    return newTape
  }

  computeGradient(
    plusResults: number[],
    minusResults: number[]
  ): number[] {
    const gradients: number[] = []
    const coefficient = 1 / (2 * Math.sin(this.shiftValue))

    for (let i = 0; i < plusResults.length; i++) {
      gradients.push(coefficient * (plusResults[i] - minusResults[i]))
    }

    return gradients
  }
}

export class FiniteDiffTransform extends Transform {
  private epsilon: number
  private method: 'forward' | 'backward' | 'central'

  constructor(config?: { epsilon?: number; method?: 'forward' | 'backward' | 'central' }) {
    super({
      name: 'FiniteDiff',
      description: 'Transform circuit for finite difference gradient computation'
    })
    this.epsilon = config?.epsilon ?? 1e-7
    this.method = config?.method ?? 'central'
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const resultTape = tape.copy()

    return {
      tape: resultTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: resultTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  generateDiffTapes(tape: QuantumTape): { tapes: QuantumTape[]; paramIndex: number; coefficient: number }[] {
    const parametricOps = tape.getParametricOperations()
    const diffTapes: { tapes: QuantumTape[]; paramIndex: number; coefficient: number }[] = []

    let paramIndex = 0
    for (const record of parametricOps) {
      const op = record.operation
      for (let i = 0; i < op.params.length; i++) {
        if (this.method === 'central') {
          const plusTape = this.createShiftedTape(tape, op.id, i, this.epsilon)
          const minusTape = this.createShiftedTape(tape, op.id, i, -this.epsilon)
          diffTapes.push({
            tapes: [plusTape, minusTape],
            paramIndex,
            coefficient: 1 / (2 * this.epsilon)
          })
        } else if (this.method === 'forward') {
          const plusTape = this.createShiftedTape(tape, op.id, i, this.epsilon)
          diffTapes.push({
            tapes: [plusTape, tape.copy()],
            paramIndex,
            coefficient: 1 / this.epsilon
          })
        } else {
          const minusTape = this.createShiftedTape(tape, op.id, i, -this.epsilon)
          diffTapes.push({
            tapes: [tape.copy(), minusTape],
            paramIndex,
            coefficient: 1 / this.epsilon
          })
        }
        paramIndex++
      }
    }

    return diffTapes
  }

  private createShiftedTape(tape: QuantumTape, opId: number, paramIdx: number, shift: number): QuantumTape {
    const newTape = new QuantumTape(tape.numWires)

    for (const record of tape.operations) {
      const op = record.operation
      if (op.id === opId) {
        const newParams = [...op.params]
        newParams[paramIdx] += shift
        newTape.addOperation({
          type: op.type,
          name: op.name,
          wires: [...op.wires],
          params: newParams,
          paramTensors: [...op.paramTensors],
          inverse: op.inverse,
          controlWires: [...op.controlWires],
          matrix: op.matrix
        })
      } else {
        newTape.addOperation({ ...op })
      }
    }

    return newTape
  }

  computeGradient(results: number[][]): number[] {
    const gradients: number[] = []

    for (let i = 0; i < results.length; i += 2) {
      const diff = results[i][0] - results[i + 1][0]
      gradients.push(diff / (this.method === 'central' ? 2 * this.epsilon : this.epsilon))
    }

    return gradients
  }
}

export class AdjointDiffTransform extends Transform {
  constructor() {
    super({
      name: 'AdjointDiff',
      description: 'Transform circuit for adjoint differentiation method'
    })
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const adjointTape = this.createAdjointTape(tape)

    return {
      tape: adjointTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: adjointTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private createAdjointTape(tape: QuantumTape): QuantumTape {
    return tape.adjoint()
  }

  createGradientCircuit(tape: QuantumTape): { forward: QuantumTape; backward: QuantumTape } {
    return {
      forward: tape.copy(),
      backward: tape.adjoint()
    }
  }

  getParameterGradientOperators(tape: QuantumTape): Map<number, { generator: QTensor; paramIdx: number }> {
    const generators = new Map<number, { generator: QTensor; paramIdx: number }>()
    const parametricOps = tape.getParametricOperations()

    let paramIdx = 0
    for (const record of parametricOps) {
      const op = record.operation
      const generator = this.getGeneratorForGate(op.name)
      if (generator) {
        for (let i = 0; i < op.params.length; i++) {
          generators.set(paramIdx, { generator, paramIdx: i })
          paramIdx++
        }
      }
    }

    return generators
  }

  private getGeneratorForGate(gateName: string): QTensor | null {
    const generators: Record<string, () => QTensor> = {
      'RX': () => QTensor.fromComplex([
        new Complex(0, 0), new Complex(-0.5, 0),
        new Complex(-0.5, 0), new Complex(0, 0)
      ], [2, 2]),
      'RY': () => QTensor.fromComplex([
        new Complex(0, 0), new Complex(0, 0.5),
        new Complex(0, -0.5), new Complex(0, 0)
      ], [2, 2]),
      'RZ': () => QTensor.fromComplex([
        new Complex(-0.5, 0), new Complex(0, 0),
        new Complex(0, 0), new Complex(0.5, 0)
      ], [2, 2]),
      'PhaseShift': () => QTensor.fromComplex([
        new Complex(0, 0), new Complex(0, 0),
        new Complex(0, 0), new Complex(1, 0)
      ], [2, 2])
    }

    const generatorFn = generators[gateName]
    return generatorFn ? generatorFn() : null
  }
}

export class BackpropTransform extends Transform {
  constructor() {
    super({
      name: 'Backprop',
      description: 'Transform circuit for backpropagation-based gradient computation'
    })
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const resultTape = this.annotateForBackprop(tape)

    return {
      tape: resultTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: resultTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  private annotateForBackprop(tape: QuantumTape): QuantumTape {
    const newTape = new QuantumTape(tape.numWires)

    for (const record of tape.operations) {
      const op = record.operation
      const paramTensors = op.paramTensors.map(t => {
        if (!t.requiresGrad) {
          return t.requireGrad(true)
        }
        return t
      })

      newTape.addOperation({
        type: op.type,
        name: op.name,
        wires: [...op.wires],
        params: [...op.params],
        paramTensors,
        inverse: op.inverse,
        controlWires: [...op.controlWires],
        matrix: op.matrix
      })
    }

    return newTape
  }
}

export class StochasticParameterShiftTransform extends Transform {
  private sampleSize: number
  private shiftValue: number

  constructor(config?: { sampleSize?: number; shiftValue?: number }) {
    super({
      name: 'StochasticParameterShift',
      description: 'Stochastic parameter-shift for gradient estimation with reduced samples'
    })
    this.sampleSize = config?.sampleSize ?? 1
    this.shiftValue = config?.shiftValue ?? Math.PI / 2
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const resultTape = tape.copy()

    return {
      tape: resultTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: resultTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  sampleGradientCircuits(tape: QuantumTape): { tapes: QuantumTape[]; indices: number[] } {
    const parametricOps = tape.getParametricOperations()
    const totalParams = parametricOps.reduce((sum, rec) => sum + rec.operation.params.length, 0)

    const sampledIndices: number[] = []
    for (let i = 0; i < this.sampleSize; i++) {
      sampledIndices.push(Math.floor(Math.random() * totalParams))
    }

    const tapes: QuantumTape[] = []
    let paramIndex = 0

    for (const record of parametricOps) {
      const op = record.operation
      for (let i = 0; i < op.params.length; i++) {
        if (sampledIndices.includes(paramIndex)) {
          tapes.push(this.createShiftedTape(tape, op.id, i, this.shiftValue))
          tapes.push(this.createShiftedTape(tape, op.id, i, -this.shiftValue))
        }
        paramIndex++
      }
    }

    return { tapes, indices: sampledIndices }
  }

  private createShiftedTape(tape: QuantumTape, opId: number, paramIdx: number, shift: number): QuantumTape {
    const newTape = new QuantumTape(tape.numWires)

    for (const record of tape.operations) {
      const op = record.operation
      if (op.id === opId) {
        const newParams = [...op.params]
        newParams[paramIdx] += shift
        newTape.addOperation({
          type: op.type,
          name: op.name,
          wires: [...op.wires],
          params: newParams,
          paramTensors: [...op.paramTensors],
          inverse: op.inverse,
          controlWires: [...op.controlWires],
          matrix: op.matrix
        })
      } else {
        newTape.addOperation({ ...op })
      }
    }

    return newTape
  }
}

export class NaturalGradientTransform extends Transform {
  private regularization: number

  constructor(config?: { regularization?: number }) {
    super({
      name: 'NaturalGradient',
      description: 'Transform for computing natural gradients using quantum Fisher information'
    })
    this.regularization = config?.regularization ?? 1e-3
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const resultTape = tape.copy()

    return {
      tape: resultTape,
      stats: {
        originalOps: tape.numOperations,
        transformedOps: resultTape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  generateFisherCircuits(tape: QuantumTape): QuantumTape[][] {
    const parametricOps = tape.getParametricOperations()
    const numParams = parametricOps.reduce((sum, rec) => sum + rec.operation.params.length, 0)
    const circuits: QuantumTape[][] = []

    for (let i = 0; i < numParams; i++) {
      const row: QuantumTape[] = []
      for (let j = 0; j <= i; j++) {
        row.push(this.createFisherCircuit(tape, i, j))
      }
      circuits.push(row)
    }

    return circuits
  }

  private createFisherCircuit(tape: QuantumTape, i: number, j: number): QuantumTape {
    const newTape = new QuantumTape(tape.numWires)

    for (const record of tape.operations) {
      newTape.addOperation({ ...record.operation })
    }

    return newTape
  }

  computeNaturalGradient(gradients: number[], fisherMatrix: number[][]): number[] {
    const n = gradients.length
    const regularized = fisherMatrix.map((row, i) =>
      row.map((val, j) => val + (i === j ? this.regularization : 0))
    )

    return this.solveLinearSystem(regularized, gradients)
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = b.length
    const augmented = A.map((row, i) => [...row, b[i]])

    for (let col = 0; col < n; col++) {
      let maxRow = col
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
          maxRow = row
        }
      }
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]]

      if (Math.abs(augmented[col][col]) < 1e-10) {
        continue
      }

      for (let row = col + 1; row < n; row++) {
        const factor = augmented[row][col] / augmented[col][col]
        for (let j = col; j <= n; j++) {
          augmented[row][j] -= factor * augmented[col][j]
        }
      }
    }

    const x = new Array(n).fill(0)
    for (let row = n - 1; row >= 0; row--) {
      let sum = augmented[row][n]
      for (let j = row + 1; j < n; j++) {
        sum -= augmented[row][j] * x[j]
      }
      x[row] = Math.abs(augmented[row][row]) > 1e-10 ? sum / augmented[row][row] : 0
    }

    return x
  }
}

export function parameterShift(config?: Partial<GradientTransformConfig>): ParameterShiftTransform {
  return new ParameterShiftTransform(config)
}

export function finiteDiff(config?: { epsilon?: number; method?: 'forward' | 'backward' | 'central' }): FiniteDiffTransform {
  return new FiniteDiffTransform(config)
}

export function adjointDiff(): AdjointDiffTransform {
  return new AdjointDiffTransform()
}

export function backprop(): BackpropTransform {
  return new BackpropTransform()
}

export function stochasticParameterShift(config?: { sampleSize?: number; shiftValue?: number }): StochasticParameterShiftTransform {
  return new StochasticParameterShiftTransform(config)
}

export function naturalGradient(config?: { regularization?: number }): NaturalGradientTransform {
  return new NaturalGradientTransform(config)
}
