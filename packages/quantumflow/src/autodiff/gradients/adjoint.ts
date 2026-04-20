import { QTensor } from '../../core/tensor'
import { Complex } from '../../core/complex'
import { QuantumTape, TapeOperation } from '../tape'

export interface AdjointDiffConfig {
  deviceState: QTensor
  observables: QTensor[]
}

export interface AdjointGradientResult {
  gradients: number[]
  expectationValues: number[]
}

export function adjointDifferentiation(
  tape: QuantumTape,
  observable: QTensor,
  initialState: QTensor,
  applyGate: (state: QTensor, op: TapeOperation) => QTensor,
  applyAdjointGate: (state: QTensor, op: TapeOperation) => QTensor,
  getGateGenerator: (op: TapeOperation) => QTensor | null
): number[] {
  const operations = tape.operations
  const parametricOps = tape.getParametricOperations()
  const numParams = parametricOps.length

  let forwardState = initialState.clone()
  for (const record of operations) {
    if (record.operation.type === 'gate') {
      forwardState = applyGate(forwardState, record.operation)
    }
  }

  let braState = applyObservable(forwardState, observable)

  const gradients: number[] = []

  for (let i = operations.length - 1; i >= 0; i--) {
    const record = operations[i]
    const op = record.operation

    if (op.type !== 'gate') continue

    braState = applyAdjointGate(braState, op)

    let ketState = initialState.clone()
    for (let j = 0; j < i; j++) {
      if (operations[j].operation.type === 'gate') {
        ketState = applyGate(ketState, operations[j].operation)
      }
    }

    if (op.params.length > 0 || op.paramTensors.length > 0) {
      const generator = getGateGenerator(op)
      if (generator) {
        const dKetState = applyGenerator(ketState, generator)
        const gradValue = computeInnerProduct(braState, dKetState)
        gradients.unshift(2 * gradValue.im)
      }
    }
  }

  return gradients
}

function applyObservable(state: QTensor, observable: QTensor): QTensor {
  if (state.dtype !== 'complex128' || observable.dtype !== 'complex128') {
    throw new Error('State and observable must be complex tensors')
  }

  const n = state.shape[0]
  const result = QTensor.zeros([n], { dtype: 'complex128' })

  for (let i = 0; i < n; i++) {
    let sumRe = 0
    let sumIm = 0
    for (let j = 0; j < n; j++) {
      const obsRe = observable.data[(i * n + j) * 2]
      const obsIm = observable.data[(i * n + j) * 2 + 1]
      const stateRe = state.data[j * 2]
      const stateIm = state.data[j * 2 + 1]

      sumRe += obsRe * stateRe - obsIm * stateIm
      sumIm += obsRe * stateIm + obsIm * stateRe
    }
    result.data[i * 2] = sumRe
    result.data[i * 2 + 1] = sumIm
  }

  return result
}

function applyGenerator(state: QTensor, generator: QTensor): QTensor {
  const n = state.shape[0]
  const result = QTensor.zeros([n], { dtype: 'complex128' })

  for (let i = 0; i < n; i++) {
    let sumRe = 0
    let sumIm = 0
    for (let j = 0; j < n; j++) {
      const genRe = generator.data[(i * n + j) * 2]
      const genIm = generator.data[(i * n + j) * 2 + 1]
      const stateRe = state.data[j * 2]
      const stateIm = state.data[j * 2 + 1]

      const mulRe = genRe * stateRe - genIm * stateIm
      const mulIm = genRe * stateIm + genIm * stateRe

      sumRe += -mulIm
      sumIm += mulRe
    }
    result.data[i * 2] = sumRe
    result.data[i * 2 + 1] = sumIm
  }

  return result
}

function computeInnerProduct(bra: QTensor, ket: QTensor): Complex {
  let sumRe = 0
  let sumIm = 0

  for (let i = 0; i < bra.shape[0]; i++) {
    const braRe = bra.data[i * 2]
    const braIm = bra.data[i * 2 + 1]
    const ketRe = ket.data[i * 2]
    const ketIm = ket.data[i * 2 + 1]

    sumRe += braRe * ketRe + braIm * ketIm
    sumIm += braRe * ketIm - braIm * ketRe
  }

  return new Complex(sumRe, sumIm)
}

export function adjointJacobian(
  tape: QuantumTape,
  observables: QTensor[],
  initialState: QTensor,
  applyGate: (state: QTensor, op: TapeOperation) => QTensor,
  applyAdjointGate: (state: QTensor, op: TapeOperation) => QTensor,
  getGateGenerator: (op: TapeOperation) => QTensor | null
): number[][] {
  const jacobian: number[][] = []

  for (const observable of observables) {
    const grads = adjointDifferentiation(
      tape,
      observable,
      initialState,
      applyGate,
      applyAdjointGate,
      getGateGenerator
    )
    jacobian.push(grads)
  }

  return jacobian
}

export class AdjointDiffExecutor {
  private numWires: number
  private gateMatrices: Map<string, (params: number[]) => QTensor>
  private gateGenerators: Map<string, (params: number[]) => QTensor>

  constructor(numWires: number) {
    this.numWires = numWires
    this.gateMatrices = new Map()
    this.gateGenerators = new Map()

    this.registerDefaultGates()
  }

  private registerDefaultGates(): void {
    this.gateMatrices.set('RX', (params) => this.createRXMatrix(params[0]))
    this.gateMatrices.set('RY', (params) => this.createRYMatrix(params[0]))
    this.gateMatrices.set('RZ', (params) => this.createRZMatrix(params[0]))
    this.gateMatrices.set('Rot', (params) => this.createRotMatrix(params[0], params[1], params[2]))

    this.gateGenerators.set('RX', () => this.createPauliX())
    this.gateGenerators.set('RY', () => this.createPauliY())
    this.gateGenerators.set('RZ', () => this.createPauliZ())
  }

  private createRXMatrix(theta: number): QTensor {
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      new Complex(c, 0), new Complex(0, -s),
      new Complex(0, -s), new Complex(c, 0)
    ], [2, 2])
  }

  private createRYMatrix(theta: number): QTensor {
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      new Complex(c, 0), new Complex(-s, 0),
      new Complex(s, 0), new Complex(c, 0)
    ], [2, 2])
  }

  private createRZMatrix(theta: number): QTensor {
    return QTensor.fromComplex([
      Complex.expI(-theta / 2), Complex.zero(),
      Complex.zero(), Complex.expI(theta / 2)
    ], [2, 2])
  }

  private createRotMatrix(phi: number, theta: number, omega: number): QTensor {
    const rz1 = this.createRZMatrix(phi)
    const ry = this.createRYMatrix(theta)
    const rz2 = this.createRZMatrix(omega)
    return rz2.matmul(ry).matmul(rz1)
  }

  private createPauliX(): QTensor {
    return QTensor.fromComplex([
      Complex.zero(), Complex.one(),
      Complex.one(), Complex.zero()
    ], [2, 2])
  }

  private createPauliY(): QTensor {
    return QTensor.fromComplex([
      Complex.zero(), new Complex(0, -1),
      new Complex(0, 1), Complex.zero()
    ], [2, 2])
  }

  private createPauliZ(): QTensor {
    return QTensor.fromComplex([
      Complex.one(), Complex.zero(),
      Complex.zero(), new Complex(-1, 0)
    ], [2, 2])
  }

  registerGate(
    name: string,
    matrixFn: (params: number[]) => QTensor,
    generatorFn?: (params: number[]) => QTensor
  ): void {
    this.gateMatrices.set(name, matrixFn)
    if (generatorFn) {
      this.gateGenerators.set(name, generatorFn)
    }
  }

  applyGate(state: QTensor, op: TapeOperation): QTensor {
    const matrixFn = this.gateMatrices.get(op.name)
    if (!matrixFn) {
      throw new Error(`Unknown gate: ${op.name}`)
    }

    const matrix = matrixFn(op.params)
    return this.applyGateMatrix(state, matrix, op.wires)
  }

  applyAdjointGate(state: QTensor, op: TapeOperation): QTensor {
    const matrixFn = this.gateMatrices.get(op.name)
    if (!matrixFn) {
      throw new Error(`Unknown gate: ${op.name}`)
    }

    const matrix = matrixFn(op.params).dag()
    return this.applyGateMatrix(state, matrix, op.wires)
  }

  getGateGenerator(op: TapeOperation): QTensor | null {
    const generatorFn = this.gateGenerators.get(op.name)
    if (!generatorFn) {
      return null
    }
    return generatorFn(op.params)
  }

  private applyGateMatrix(state: QTensor, matrix: QTensor, wires: number[]): QTensor {
    const stateDim = 1 << this.numWires
    const result = QTensor.zeros([stateDim], { dtype: 'complex128' })

    if (wires.length === 1) {
      const wire = wires[0]
      const mask = 1 << (this.numWires - 1 - wire)

      for (let i = 0; i < stateDim; i++) {
        const bit = (i & mask) ? 1 : 0
        const partner = bit ? i & ~mask : i | mask

        const idx0 = bit ? partner : i
        const idx1 = bit ? i : partner

        if (i <= partner) {
          const s0 = state.getComplex(idx0)
          const s1 = state.getComplex(idx1)

          const m00 = matrix.getComplex(0)
          const m01 = matrix.getComplex(1)
          const m10 = matrix.getComplex(2)
          const m11 = matrix.getComplex(3)

          const r0 = m00.mul(s0).add(m01.mul(s1))
          const r1 = m10.mul(s0).add(m11.mul(s1))

          result.setComplex(idx0, r0)
          result.setComplex(idx1, r1)
        }
      }
    } else {
      for (let i = 0; i < stateDim; i++) {
        let sumRe = 0
        let sumIm = 0

        for (let j = 0; j < stateDim; j++) {
          let matrixIdx = 0
          let valid = true

          for (let w = 0; w < wires.length; w++) {
            const wire = wires[w]
            const iBit = (i >> (this.numWires - 1 - wire)) & 1
            const jBit = (j >> (this.numWires - 1 - wire)) & 1
            matrixIdx |= (iBit << (wires.length - 1 - w))
            matrixIdx |= (jBit << (2 * wires.length - 1 - w))
          }

          for (let k = 0; k < this.numWires; k++) {
            if (!wires.includes(k)) {
              if (((i >> (this.numWires - 1 - k)) & 1) !== ((j >> (this.numWires - 1 - k)) & 1)) {
                valid = false
                break
              }
            }
          }

          if (valid) {
            const mRe = matrix.data[matrixIdx * 2]
            const mIm = matrix.data[matrixIdx * 2 + 1]
            const sRe = state.data[j * 2]
            const sIm = state.data[j * 2 + 1]

            sumRe += mRe * sRe - mIm * sIm
            sumIm += mRe * sIm + mIm * sRe
          }
        }

        result.data[i * 2] = sumRe
        result.data[i * 2 + 1] = sumIm
      }
    }

    return result
  }

  computeGradients(
    tape: QuantumTape,
    observable: QTensor,
    initialState?: QTensor
  ): number[] {
    const stateDim = 1 << this.numWires
    const state = initialState ?? this.createZeroState(stateDim)

    return adjointDifferentiation(
      tape,
      observable,
      state,
      (s, op) => this.applyGate(s, op),
      (s, op) => this.applyAdjointGate(s, op),
      (op) => this.getGateGenerator(op)
    )
  }

  private createZeroState(dim: number): QTensor {
    const state = QTensor.zeros([dim], { dtype: 'complex128' })
    state.data[0] = 1
    return state
  }
}
