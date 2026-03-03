import { QTensor } from '../../core/tensor'
import { Complex } from '../../core/complex'
import { QuantumTape, recordOperation } from '../../autodiff/tape'
import { resolveWires } from '../wire'

export interface Observable {
  name: string
  wires: number[]
  coefficients?: number[]
  terms?: Observable[]
  matrix(): QTensor
  eigenvalues(): number[]
}

export class PauliXObservable implements Observable {
  readonly name = 'PauliX'
  readonly wires: number[]

  constructor(wire: number) {
    this.wires = [wire]
  }

  matrix(): QTensor {
    return QTensor.fromComplex([
      Complex.zero(), Complex.one(),
      Complex.one(), Complex.zero()
    ], [2, 2])
  }

  eigenvalues(): number[] {
    return [1, -1]
  }
}

export class PauliYObservable implements Observable {
  readonly name = 'PauliY'
  readonly wires: number[]

  constructor(wire: number) {
    this.wires = [wire]
  }

  matrix(): QTensor {
    return QTensor.fromComplex([
      Complex.zero(), new Complex(0, -1),
      new Complex(0, 1), Complex.zero()
    ], [2, 2])
  }

  eigenvalues(): number[] {
    return [1, -1]
  }
}

export class PauliZObservable implements Observable {
  readonly name = 'PauliZ'
  readonly wires: number[]

  constructor(wire: number) {
    this.wires = [wire]
  }

  matrix(): QTensor {
    return QTensor.fromComplex([
      Complex.one(), Complex.zero(),
      Complex.zero(), new Complex(-1, 0)
    ], [2, 2])
  }

  eigenvalues(): number[] {
    return [1, -1]
  }
}

export class IdentityObservable implements Observable {
  readonly name = 'Identity'
  readonly wires: number[]

  constructor(wire: number) {
    this.wires = [wire]
  }

  matrix(): QTensor {
    return QTensor.fromComplex([
      Complex.one(), Complex.zero(),
      Complex.zero(), Complex.one()
    ], [2, 2])
  }

  eigenvalues(): number[] {
    return [1, 1]
  }
}

export class HadamardObservable implements Observable {
  readonly name = 'Hadamard'
  readonly wires: number[]

  constructor(wire: number) {
    this.wires = [wire]
  }

  matrix(): QTensor {
    const s = 1 / Math.SQRT2
    return QTensor.fromComplex([
      new Complex(s, 0), new Complex(s, 0),
      new Complex(s, 0), new Complex(-s, 0)
    ], [2, 2])
  }

  eigenvalues(): number[] {
    return [1, -1]
  }
}

export class HermitianObservable implements Observable {
  readonly name = 'Hermitian'
  readonly wires: number[]
  private _matrix: QTensor

  constructor(matrix: QTensor, wires: number | number[]) {
    this._matrix = matrix
    this.wires = resolveWires(wires)

    const expectedDim = 1 << this.wires.length
    if (matrix.shape[0] !== expectedDim || matrix.shape[1] !== expectedDim) {
      throw new Error(`Matrix dimension ${matrix.shape} does not match ${this.wires.length} wires`)
    }
  }

  matrix(): QTensor {
    return this._matrix
  }

  eigenvalues(): number[] {
    const n = this._matrix.shape[0]
    const eigenvals: number[] = []

    for (let i = 0; i < n; i++) {
      eigenvals.push(this._matrix.data[i * n * 2 + i * 2])
    }

    return eigenvals.sort((a, b) => b - a)
  }
}

export class TensorProductObservable implements Observable {
  readonly name = 'Tensor'
  readonly wires: number[]
  readonly observables: Observable[]

  constructor(observables: Observable[]) {
    this.observables = observables
    this.wires = observables.flatMap(o => o.wires)

    const uniqueWires = new Set(this.wires)
    if (uniqueWires.size !== this.wires.length) {
      throw new Error('Tensor product observables cannot share wires')
    }
  }

  matrix(): QTensor {
    let result = this.observables[0].matrix()
    for (let i = 1; i < this.observables.length; i++) {
      result = result.kron(this.observables[i].matrix())
    }
    return result
  }

  eigenvalues(): number[] {
    let eigenvals = this.observables[0].eigenvalues()
    for (let i = 1; i < this.observables.length; i++) {
      const newEigenvals: number[] = []
      const obsEigenvals = this.observables[i].eigenvalues()
      for (const e1 of eigenvals) {
        for (const e2 of obsEigenvals) {
          newEigenvals.push(e1 * e2)
        }
      }
      eigenvals = newEigenvals
    }
    return eigenvals.sort((a, b) => b - a)
  }
}

export class HamiltonianObservable implements Observable {
  readonly name = 'Hamiltonian'
  readonly wires: number[]
  readonly coefficients: number[]
  readonly terms: Observable[]

  constructor(coefficients: number[], terms: Observable[]) {
    if (coefficients.length !== terms.length) {
      throw new Error('Number of coefficients must match number of terms')
    }

    this.coefficients = coefficients
    this.terms = terms

    const allWires = new Set<number>()
    for (const term of terms) {
      for (const wire of term.wires) {
        allWires.add(wire)
      }
    }
    this.wires = Array.from(allWires).sort((a, b) => a - b)
  }

  matrix(): QTensor {
    const dim = 1 << this.wires.length
    let result = QTensor.zeros([dim, dim], { dtype: 'complex128' })

    for (let i = 0; i < this.terms.length; i++) {
      const coeff = this.coefficients[i]
      const termMatrix = this.expandTermMatrix(this.terms[i])
      result = result.add(termMatrix.mul(coeff))
    }

    return result
  }

  private expandTermMatrix(term: Observable): QTensor {
    const dim = 1 << this.wires.length
    const termWires = term.wires
    const termMatrix = term.matrix()

    if (termWires.length === this.wires.length &&
        termWires.every((w, i) => w === this.wires[i])) {
      return termMatrix
    }

    const result = QTensor.zeros([dim, dim], { dtype: 'complex128' })
    const termDim = 1 << termWires.length

    const wireIndices = termWires.map(w => this.wires.indexOf(w))

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        let termI = 0
        let termJ = 0
        let match = true

        for (let k = 0; k < this.wires.length; k++) {
          const bitI = (i >> (this.wires.length - 1 - k)) & 1
          const bitJ = (j >> (this.wires.length - 1 - k)) & 1

          const termWireIdx = wireIndices.indexOf(k)
          if (termWireIdx !== -1) {
            termI |= bitI << (termWires.length - 1 - termWireIdx)
            termJ |= bitJ << (termWires.length - 1 - termWireIdx)
          } else {
            if (bitI !== bitJ) {
              match = false
              break
            }
          }
        }

        if (match) {
          const termVal = termMatrix.getComplex(termI * termDim + termJ)
          result.setComplex(i * dim + j, termVal)
        }
      }
    }

    return result
  }

  eigenvalues(): number[] {
    const matrix = this.matrix()
    const n = matrix.shape[0]
    const eigenvals: number[] = []

    for (let i = 0; i < n; i++) {
      eigenvals.push(matrix.data[i * n * 2 + i * 2])
    }

    return eigenvals.sort((a, b) => b - a)
  }

  groundStateEnergy(): number {
    return Math.min(...this.eigenvalues())
  }
}

export class SparseHamiltonian implements Observable {
  readonly name = 'SparseHamiltonian'
  readonly wires: number[]
  private _terms: Map<string, { coefficient: number; paulis: string }>

  constructor(numWires: number) {
    this.wires = Array.from({ length: numWires }, (_, i) => i)
    this._terms = new Map()
  }

  addTerm(coefficient: number, pauliString: string): void {
    if (pauliString.length !== this.wires.length) {
      throw new Error(`Pauli string length must match number of wires`)
    }

    const existing = this._terms.get(pauliString)
    if (existing) {
      existing.coefficient += coefficient
    } else {
      this._terms.set(pauliString, { coefficient, paulis: pauliString })
    }
  }

  matrix(): QTensor {
    const dim = 1 << this.wires.length
    const result = QTensor.zeros([dim, dim], { dtype: 'complex128' })

    for (const [, term] of this._terms) {
      const termMatrix = this.pauliStringToMatrix(term.paulis)
      const scaled = termMatrix.mul(term.coefficient)

      for (let i = 0; i < dim * dim; i++) {
        result.data[i * 2] += scaled.data[i * 2]
        result.data[i * 2 + 1] += scaled.data[i * 2 + 1]
      }
    }

    return result
  }

  private pauliStringToMatrix(pauliString: string): QTensor {
    const pauliMatrices: Record<string, QTensor> = {
      'I': QTensor.fromComplex([Complex.one(), Complex.zero(), Complex.zero(), Complex.one()], [2, 2]),
      'X': QTensor.fromComplex([Complex.zero(), Complex.one(), Complex.one(), Complex.zero()], [2, 2]),
      'Y': QTensor.fromComplex([Complex.zero(), new Complex(0, -1), new Complex(0, 1), Complex.zero()], [2, 2]),
      'Z': QTensor.fromComplex([Complex.one(), Complex.zero(), Complex.zero(), new Complex(-1, 0)], [2, 2])
    }

    let result = pauliMatrices[pauliString[0]]
    for (let i = 1; i < pauliString.length; i++) {
      result = result.kron(pauliMatrices[pauliString[i]])
    }

    return result
  }

  eigenvalues(): number[] {
    const matrix = this.matrix()
    const n = matrix.shape[0]
    const eigenvals: number[] = []

    for (let i = 0; i < n; i++) {
      eigenvals.push(matrix.data[i * n * 2 + i * 2])
    }

    return eigenvals.sort((a, b) => b - a)
  }

  toHamiltonian(): HamiltonianObservable {
    const coefficients: number[] = []
    const terms: Observable[] = []

    for (const [, term] of this._terms) {
      coefficients.push(term.coefficient)

      const observables: Observable[] = []
      for (let i = 0; i < term.paulis.length; i++) {
        switch (term.paulis[i]) {
          case 'X':
            observables.push(new PauliXObservable(i))
            break
          case 'Y':
            observables.push(new PauliYObservable(i))
            break
          case 'Z':
            observables.push(new PauliZObservable(i))
            break
          case 'I':
            observables.push(new IdentityObservable(i))
            break
        }
      }

      if (observables.length === 1) {
        terms.push(observables[0])
      } else {
        terms.push(new TensorProductObservable(observables))
      }
    }

    return new HamiltonianObservable(coefficients, terms)
  }
}

export function PauliXObs(wire: number): PauliXObservable {
  return new PauliXObservable(wire)
}

export function PauliYObs(wire: number): PauliYObservable {
  return new PauliYObservable(wire)
}

export function PauliZObs(wire: number): PauliZObservable {
  return new PauliZObservable(wire)
}

export function Identity(wire: number): IdentityObservable {
  return new IdentityObservable(wire)
}

export function Hermitian(matrix: QTensor, wires: number | number[]): HermitianObservable {
  return new HermitianObservable(matrix, wires)
}

export function tensorObs(...observables: Observable[]): TensorProductObservable {
  return new TensorProductObservable(observables)
}

export function hamiltonian(coefficients: number[], terms: Observable[]): HamiltonianObservable {
  return new HamiltonianObservable(coefficients, terms)
}

export function sparseHamiltonian(numWires: number): SparseHamiltonian {
  return new SparseHamiltonian(numWires)
}

export type MeasurementType = 'expval' | 'var' | 'sample' | 'probs' | 'counts' | 'state'

export interface Measurement {
  type: MeasurementType
  observable?: Observable
  wires: number[]
  shots?: number
}

export function expval(tape: QuantumTape, observable: Observable): void {
  tape.addMeasurement('expval', observable.wires, observable.matrix())

  recordOperation({
    type: 'measurement',
    name: 'expval',
    wires: observable.wires,
    params: [],
    paramTensors: [observable.matrix()],
    inverse: false,
    controlWires: []
  })
}

export function variance(tape: QuantumTape, observable: Observable): void {
  tape.addMeasurement('var', observable.wires, observable.matrix())

  recordOperation({
    type: 'measurement',
    name: 'var',
    wires: observable.wires,
    params: [],
    paramTensors: [observable.matrix()],
    inverse: false,
    controlWires: []
  })
}

export function sample(tape: QuantumTape, wires: number | number[], shots: number = 1000): void {
  const wireArray = resolveWires(wires)
  tape.addMeasurement('sample', wireArray)

  recordOperation({
    type: 'measurement',
    name: 'sample',
    wires: wireArray,
    params: [shots],
    paramTensors: [],
    inverse: false,
    controlWires: []
  })
}

export function probs(tape: QuantumTape, wires: number | number[]): void {
  const wireArray = resolveWires(wires)
  tape.addMeasurement('probs', wireArray)

  recordOperation({
    type: 'measurement',
    name: 'probs',
    wires: wireArray,
    params: [],
    paramTensors: [],
    inverse: false,
    controlWires: []
  })
}

export function counts(tape: QuantumTape, wires: number | number[], shots: number = 1000): void {
  const wireArray = resolveWires(wires)
  tape.addMeasurement('counts', wireArray)

  recordOperation({
    type: 'measurement',
    name: 'counts',
    wires: wireArray,
    params: [shots],
    paramTensors: [],
    inverse: false,
    controlWires: []
  })
}

export function state(tape: QuantumTape): void {
  tape.addMeasurement('state', [])

  recordOperation({
    type: 'measurement',
    name: 'state',
    wires: [],
    params: [],
    paramTensors: [],
    inverse: false,
    controlWires: []
  })
}
