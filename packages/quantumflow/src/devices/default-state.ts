import { QTensor } from '../core/tensor'
import { Complex } from '../core/complex'
import { QuantumTape, TapeOperation } from '../autodiff/tape'
import { QubitDevice, DeviceCapabilities, ExecutionConfig, registerDevice } from './base-device'
import { Observable, PauliZObservable } from '../circuit/operations/observables'
import { getGate } from '../circuit/operations/gates'

export class DefaultStateVectorDevice extends QubitDevice {
  private _rng: () => number

  constructor(options: { wires?: number; shots?: number | null; seed?: number } = {}) {
    super('default.state', options)

    if (options.seed !== undefined) {
      this._rng = this.seededRandom(options.seed)
    } else {
      this._rng = Math.random
    }
  }

  get capabilities(): DeviceCapabilities {
    return {
      supportsAdjoint: true,
      supportsBackprop: true,
      supportsBatchExecution: true,
      supportsDerivatives: true,
      maxWires: 28,
      nativeGates: [
        'PauliX', 'PauliY', 'PauliZ', 'Hadamard', 'S', 'T', 'SX',
        'RX', 'RY', 'RZ', 'PhaseShift', 'Rot', 'U3',
        'CNOT', 'CY', 'CZ', 'SWAP', 'ISWAP',
        'CRX', 'CRY', 'CRZ', 'RXX', 'RYY', 'RZZ',
        'Toffoli', 'CSWAP',
        'X', 'Y', 'Z', 'H', 'CX', 'CCX', 'Fredkin'
      ],
      supportedObservables: [
        'PauliX', 'PauliY', 'PauliZ', 'Identity', 'Hadamard', 'Hermitian', 'Tensor', 'Hamiltonian'
      ]
    }
  }

  private seededRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff
      return state / 0x7fffffff
    }
  }

  execute(tape: QuantumTape, config?: ExecutionConfig): number | number[] | QTensor {
    const shots = config?.shots ?? this._shots
    this._numWires = tape.numWires

    this.reset()

    const operations = tape.operations
    const measurements = tape.getMeasurements()

    for (const record of operations) {
      if (record.operation.type === 'gate') {
        this.applyOperation(record.operation)
      }
    }

    if (measurements.length === 0) {
      return this.getStateVector()
    }

    const results: (number | number[])[] = []

    for (const measurement of measurements) {
      const op = measurement.operation

      switch (op.name) {
        case 'expval': {
          const observable = this.operationToObservable(op)
          results.push(this.measure(observable, op.wires))
          break
        }
        case 'var': {
          const observable = this.operationToObservable(op)
          results.push(this.variance(observable, op.wires))
          break
        }
        case 'probs': {
          results.push(this.getProbabilities(op.wires))
          break
        }
        case 'sample': {
          const numShots = shots ?? 1000
          const samples = this.sampleCircuit(numShots)
          const marginalSamples = samples.map(s =>
            op.wires.map(w => s[w])
          )
          results.push(marginalSamples.flat())
          break
        }
        case 'counts': {
          const numShots = shots ?? 1000
          const samples = this.sampleCircuit(numShots)
          const counts: Record<string, number> = {}
          for (const sample of samples) {
            const key = op.wires.map(w => sample[w]).join('')
            counts[key] = (counts[key] ?? 0) + 1
          }
          results.push(Object.values(counts))
          break
        }
        case 'state': {
          return this.getStateVector()
        }
      }
    }

    if (results.length === 1) {
      const result = results[0]
      if (typeof result === 'number') {
        return result
      }
      return result
    }

    return results.flat()
  }

  private operationToObservable(op: TapeOperation): Observable {
    if (op.paramTensors.length > 0) {
      const matrix = op.paramTensors[0]
      return {
        name: 'Hermitian',
        wires: op.wires,
        matrix: () => matrix,
        eigenvalues: () => []
      }
    }

    return new PauliZObservable(op.wires[0])
  }

  applyOperation(op: TapeOperation): void {
    if (!this._stateVector) {
      throw new Error('State vector not initialized')
    }

    const gate = getGate(op.name)
    if (!gate) {
      throw new Error(`Unknown gate: ${op.name}`)
    }

    let matrix: QTensor
    if (op.matrix) {
      matrix = op.inverse ? op.matrix.dag() : op.matrix
    } else {
      const params = op.paramTensors.length > 0
        ? op.paramTensors.map(t => t.item())
        : op.params
      matrix = gate.matrix(params)
      if (op.inverse) {
        matrix = matrix.dag()
      }
    }

    this.applyGateMatrix(matrix, op.wires)
  }

  private applyGateMatrix(matrix: QTensor, wires: number[]): void {
    if (!this._stateVector) return

    const dim = 1 << this._numWires
    const gateDim = 1 << wires.length

    if (wires.length === 1) {
      this.applySingleQubitGate(matrix, wires[0])
    } else if (wires.length === 2) {
      this.applyTwoQubitGate(matrix, wires[0], wires[1])
    } else {
      this.applyMultiQubitGate(matrix, wires)
    }
  }

  private applySingleQubitGate(matrix: QTensor, wire: number): void {
    if (!this._stateVector) return

    const dim = 1 << this._numWires
    const newState = QTensor.zeros([dim], { dtype: 'complex128' })
    const stride = 1 << (this._numWires - 1 - wire)

    for (let i = 0; i < dim; i += stride * 2) {
      for (let j = 0; j < stride; j++) {
        const idx0 = i + j
        const idx1 = i + j + stride

        const s0 = this._stateVector.getComplex(idx0)
        const s1 = this._stateVector.getComplex(idx1)

        const m00 = matrix.getComplex(0)
        const m01 = matrix.getComplex(1)
        const m10 = matrix.getComplex(2)
        const m11 = matrix.getComplex(3)

        newState.setComplex(idx0, m00.mul(s0).add(m01.mul(s1)))
        newState.setComplex(idx1, m10.mul(s0).add(m11.mul(s1)))
      }
    }

    this._stateVector = newState
  }

  private applyTwoQubitGate(matrix: QTensor, wire0: number, wire1: number): void {
    if (!this._stateVector) return

    const dim = 1 << this._numWires
    const newState = QTensor.zeros([dim], { dtype: 'complex128' })

    const [controlWire, targetWire] = wire0 < wire1 ? [wire0, wire1] : [wire1, wire0]
    const isSwapped = wire0 > wire1

    for (let i = 0; i < dim; i++) {
      let sumRe = 0
      let sumIm = 0

      for (let j = 0; j < dim; j++) {
        let match = true

        for (let k = 0; k < this._numWires; k++) {
          if (k !== wire0 && k !== wire1) {
            if (((i >> (this._numWires - 1 - k)) & 1) !== ((j >> (this._numWires - 1 - k)) & 1)) {
              match = false
              break
            }
          }
        }

        if (match) {
          const iBit0 = (i >> (this._numWires - 1 - wire0)) & 1
          const iBit1 = (i >> (this._numWires - 1 - wire1)) & 1
          const jBit0 = (j >> (this._numWires - 1 - wire0)) & 1
          const jBit1 = (j >> (this._numWires - 1 - wire1)) & 1

          const matrixRow = iBit0 * 2 + iBit1
          const matrixCol = jBit0 * 2 + jBit1

          const matrixElement = matrix.getComplex(matrixRow * 4 + matrixCol)
          const stateElement = this._stateVector.getComplex(j)

          const product = matrixElement.mul(stateElement)
          sumRe += product.re
          sumIm += product.im
        }
      }

      newState.setComplex(i, new Complex(sumRe, sumIm))
    }

    this._stateVector = newState
  }

  private applyMultiQubitGate(matrix: QTensor, wires: number[]): void {
    if (!this._stateVector) return

    const dim = 1 << this._numWires
    const gateDim = 1 << wires.length
    const newState = QTensor.zeros([dim], { dtype: 'complex128' })

    for (let i = 0; i < dim; i++) {
      let sumRe = 0
      let sumIm = 0

      for (let j = 0; j < dim; j++) {
        let match = true

        for (let k = 0; k < this._numWires; k++) {
          if (!wires.includes(k)) {
            if (((i >> (this._numWires - 1 - k)) & 1) !== ((j >> (this._numWires - 1 - k)) & 1)) {
              match = false
              break
            }
          }
        }

        if (match) {
          let matrixRow = 0
          let matrixCol = 0

          for (let w = 0; w < wires.length; w++) {
            const wire = wires[w]
            const iBit = (i >> (this._numWires - 1 - wire)) & 1
            const jBit = (j >> (this._numWires - 1 - wire)) & 1
            matrixRow |= iBit << (wires.length - 1 - w)
            matrixCol |= jBit << (wires.length - 1 - w)
          }

          const matrixElement = matrix.getComplex(matrixRow * gateDim + matrixCol)
          const stateElement = this._stateVector.getComplex(j)

          const product = matrixElement.mul(stateElement)
          sumRe += product.re
          sumIm += product.im
        }
      }

      newState.setComplex(i, new Complex(sumRe, sumIm))
    }

    this._stateVector = newState
  }

  adjointJacobian(tape: QuantumTape, observables: QTensor[]): number[][] {
    const parametricOps = tape.getParametricOperations()
    const numParams = parametricOps.length
    const numObs = observables.length

    const jacobian: number[][] = Array.from({ length: numObs }, () => new Array(numParams).fill(0))

    this._numWires = tape.numWires
    this.reset()

    for (const record of tape.operations) {
      if (record.operation.type === 'gate') {
        this.applyOperation(record.operation)
      }
    }

    const forwardStates: QTensor[] = [this._stateVector!.clone()]

    for (const observable of observables) {
      const braState = this.applyObservableToState(this._stateVector!, observable)

      let ketState = this._stateVector!.clone()
      const operations = tape.operations.filter(r => r.operation.type === 'gate')

      for (let i = operations.length - 1; i >= 0; i--) {
        const op = operations[i].operation
        const adjointOp = { ...op, inverse: !op.inverse }
        const tempState = this._stateVector
        this._stateVector = ketState
        this.applyOperation(adjointOp)
        ketState = this._stateVector
        this._stateVector = tempState

        const paramIdx = parametricOps.findIndex(p => p.operation.id === op.id)
        if (paramIdx !== -1 && (op.params.length > 0 || op.paramTensors.length > 0)) {
          const generator = this.getGateGenerator(op)
          if (generator) {
            const dKetState = this.applyGeneratorToState(ketState, generator, op.wires)
            const gradValue = this.computeInnerProduct(braState, dKetState)
            jacobian[observables.indexOf(observable)][paramIdx] = 2 * gradValue.im
          }
        }
      }
    }

    return jacobian
  }

  private applyObservableToState(state: QTensor, observable: QTensor): QTensor {
    const dim = state.shape[0]
    const result = QTensor.zeros([dim], { dtype: 'complex128' })

    for (let i = 0; i < dim; i++) {
      let sumRe = 0
      let sumIm = 0

      for (let j = 0; j < dim; j++) {
        const obsElement = observable.getComplex(i * dim + j)
        const stateElement = state.getComplex(j)
        const product = obsElement.mul(stateElement)
        sumRe += product.re
        sumIm += product.im
      }

      result.setComplex(i, new Complex(sumRe, sumIm))
    }

    return result
  }

  private applyGeneratorToState(state: QTensor, generator: QTensor, wires: number[]): QTensor {
    const dim = state.shape[0]
    const result = QTensor.zeros([dim], { dtype: 'complex128' })
    const genDim = generator.shape[0]

    for (let i = 0; i < dim; i++) {
      let sumRe = 0
      let sumIm = 0

      for (let j = 0; j < dim; j++) {
        let match = true

        for (let k = 0; k < this._numWires; k++) {
          if (!wires.includes(k)) {
            if (((i >> (this._numWires - 1 - k)) & 1) !== ((j >> (this._numWires - 1 - k)) & 1)) {
              match = false
              break
            }
          }
        }

        if (match) {
          let genRow = 0
          let genCol = 0

          for (let w = 0; w < wires.length; w++) {
            const wire = wires[w]
            genRow |= ((i >> (this._numWires - 1 - wire)) & 1) << (wires.length - 1 - w)
            genCol |= ((j >> (this._numWires - 1 - wire)) & 1) << (wires.length - 1 - w)
          }

          const genElement = generator.getComplex(genRow * genDim + genCol)
          const stateElement = state.getComplex(j)

          const product = new Complex(0, -1).mul(genElement).mul(stateElement)
          sumRe += product.re
          sumIm += product.im
        }
      }

      result.setComplex(i, new Complex(sumRe, sumIm))
    }

    return result
  }

  private computeInnerProduct(bra: QTensor, ket: QTensor): Complex {
    let sumRe = 0
    let sumIm = 0

    for (let i = 0; i < bra.shape[0]; i++) {
      const braElement = bra.getComplex(i)
      const ketElement = ket.getComplex(i)

      sumRe += braElement.re * ketElement.re + braElement.im * ketElement.im
      sumIm += braElement.re * ketElement.im - braElement.im * ketElement.re
    }

    return new Complex(sumRe, sumIm)
  }

  private getGateGenerator(op: TapeOperation): QTensor | null {
    const gate = getGate(op.name)
    if (gate?.generator) {
      return gate.generator(op.params)
    }
    return null
  }
}

registerDevice('default.state', DefaultStateVectorDevice)
registerDevice('default.qubit', DefaultStateVectorDevice)
