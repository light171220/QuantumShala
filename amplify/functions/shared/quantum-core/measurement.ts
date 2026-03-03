import type { PauliTerm, Hamiltonian, Complex } from '../types'
import { StateVector } from './state-vector'
import * as C from './complex'
import * as Gates from './gates'

export function measurePauliExpectation(
  state: StateVector,
  pauliTerm: PauliTerm
): number {
  if (pauliTerm.operators.length === 0) {
    return pauliTerm.coefficient
  }

  const tempState = state.clone()

  for (const op of pauliTerm.operators) {
    if (op.pauli === 'I') continue

    switch (op.pauli) {
      case 'X':
        tempState.applySingleQubitGate(op.qubit, Gates.H_GATE)
        break
      case 'Y':
        tempState.applySingleQubitGate(op.qubit, Gates.S_DAG_GATE)
        tempState.applySingleQubitGate(op.qubit, Gates.H_GATE)
        break
      case 'Z':
        break
    }
  }

  let expectation = 0
  const probs = tempState.getProbabilities()

  for (let i = 0; i < tempState.size; i++) {
    let parity = 0
    for (const op of pauliTerm.operators) {
      if (op.pauli !== 'I') {
        if ((i >> op.qubit) & 1) {
          parity ^= 1
        }
      }
    }
    expectation += (parity === 0 ? 1 : -1) * probs[i]
  }

  return pauliTerm.coefficient * expectation
}

export function measureHamiltonianExpectation(
  state: StateVector,
  hamiltonian: Hamiltonian
): number {
  let totalEnergy = hamiltonian.constantTerm

  for (const term of hamiltonian.terms) {
    totalEnergy += measurePauliExpectation(state, term)
  }

  return totalEnergy
}

export function measurePauliExpectationDirect(
  state: StateVector,
  operators: { qubit: number; pauli: 'I' | 'X' | 'Y' | 'Z' }[]
): number {
  if (operators.length === 0 || operators.every(op => op.pauli === 'I')) {
    return 1.0
  }

  let expectation = 0
  const size = state.size

  for (let i = 0; i < size; i++) {
    const ampI = state.getAmplitude(i)

    let j = i
    let phase = C.ONE

    for (const op of operators) {
      const bit = (i >> op.qubit) & 1
      const targetBit = (j >> op.qubit) & 1

      switch (op.pauli) {
        case 'X':
          j ^= (1 << op.qubit)
          break
        case 'Y':
          j ^= (1 << op.qubit)
          phase = C.multiply(phase, targetBit === 0 ? C.I : C.MINUS_I)
          break
        case 'Z':
          if (bit === 1) {
            phase = C.scale(phase, -1)
          }
          break
      }
    }

    const ampJ = state.getAmplitude(j)
    const conjI = C.conjugate(ampI)
    const product = C.multiply(conjI, C.multiply(phase, ampJ))
    expectation += product.re
  }

  return expectation
}

export function measurePauliStringExpectation(
  state: StateVector,
  pauliString: string,
  qubits: number[]
): number {
  const operators = pauliString.split('').map((p, i) => ({
    qubit: qubits[i],
    pauli: p as 'I' | 'X' | 'Y' | 'Z',
  }))
  return measurePauliExpectationDirect(state, operators)
}

export function computeGradient(
  state: StateVector,
  hamiltonian: Hamiltonian,
  circuit: { setParameters: (p: number[]) => void; getParameterCount: () => number },
  executeCircuit: (state: StateVector) => StateVector,
  parameters: number[],
  paramIndex: number,
  shift: number = Math.PI / 2
): number {
  const paramsPlus = [...parameters]
  paramsPlus[paramIndex] += shift

  const paramsMinus = [...parameters]
  paramsMinus[paramIndex] -= shift

  circuit.setParameters(paramsPlus)
  const statePlus = state.clone()
  executeCircuit(statePlus)
  const energyPlus = measureHamiltonianExpectation(statePlus, hamiltonian)

  circuit.setParameters(paramsMinus)
  const stateMinus = state.clone()
  executeCircuit(stateMinus)
  const energyMinus = measureHamiltonianExpectation(stateMinus, hamiltonian)

  return (energyPlus - energyMinus) / (2 * Math.sin(shift))
}

export function computeAllGradients(
  baseState: StateVector,
  hamiltonian: Hamiltonian,
  circuit: { setParameters: (p: number[]) => void; getParameterCount: () => number },
  executeCircuit: (state: StateVector) => StateVector,
  parameters: number[],
  shift: number = Math.PI / 2
): number[] {
  const gradients: number[] = []

  for (let i = 0; i < parameters.length; i++) {
    gradients.push(
      computeGradient(
        baseState,
        hamiltonian,
        circuit,
        executeCircuit,
        parameters,
        i,
        shift
      )
    )
  }

  return gradients
}

export function computeNumericalGradient(
  costFn: (params: number[]) => number,
  parameters: number[],
  epsilon: number = 1e-7
): number[] {
  const gradients: number[] = []

  for (let i = 0; i < parameters.length; i++) {
    const paramsPlus = [...parameters]
    paramsPlus[i] += epsilon

    const paramsMinus = [...parameters]
    paramsMinus[i] -= epsilon

    const fPlus = costFn(paramsPlus)
    const fMinus = costFn(paramsMinus)

    gradients.push((fPlus - fMinus) / (2 * epsilon))
  }

  return gradients
}

export function computeSPSAGradient(
  costFn: (params: number[]) => number,
  parameters: number[],
  perturbation: number = 0.1,
  rng?: () => number
): number[] {
  const delta = parameters.map(() => (rng?.() ?? Math.random()) < 0.5 ? -1 : 1)

  const paramsPlus = parameters.map((p, i) => p + perturbation * delta[i])
  const paramsMinus = parameters.map((p, i) => p - perturbation * delta[i])

  const fPlus = costFn(paramsPlus)
  const fMinus = costFn(paramsMinus)

  return delta.map(d => (fPlus - fMinus) / (2 * perturbation * d))
}

export function groupCommutingTerms(hamiltonian: Hamiltonian): PauliTerm[][] {
  const groups: PauliTerm[][] = []
  const assigned = new Set<number>()

  for (let i = 0; i < hamiltonian.terms.length; i++) {
    if (assigned.has(i)) continue

    const group: PauliTerm[] = [hamiltonian.terms[i]]
    assigned.add(i)

    for (let j = i + 1; j < hamiltonian.terms.length; j++) {
      if (assigned.has(j)) continue

      let commutes = true
      for (const term of group) {
        if (!termsCommute(term, hamiltonian.terms[j])) {
          commutes = false
          break
        }
      }

      if (commutes) {
        group.push(hamiltonian.terms[j])
        assigned.add(j)
      }
    }

    groups.push(group)
  }

  return groups
}

function termsCommute(term1: PauliTerm, term2: PauliTerm): boolean {
  let anticommutations = 0

  const qubits1 = new Map(term1.operators.map(op => [op.qubit, op.pauli]))
  const qubits2 = new Map(term2.operators.map(op => [op.qubit, op.pauli]))

  for (const [qubit, pauli1] of qubits1) {
    const pauli2 = qubits2.get(qubit)
    if (pauli2 && pauli1 !== 'I' && pauli2 !== 'I' && pauli1 !== pauli2) {
      anticommutations++
    }
  }

  return anticommutations % 2 === 0
}

export function computeVariance(
  state: StateVector,
  hamiltonian: Hamiltonian
): number {
  const expectation = measureHamiltonianExpectation(state, hamiltonian)

  let expectationSquared = hamiltonian.constantTerm * hamiltonian.constantTerm

  for (let i = 0; i < hamiltonian.terms.length; i++) {
    const term1 = hamiltonian.terms[i]
    for (let j = 0; j < hamiltonian.terms.length; j++) {
      const term2 = hamiltonian.terms[j]
      const productTerm = multiplyPauliTerms(term1, term2)
      expectationSquared += measurePauliExpectation(state, productTerm)
    }
  }

  return expectationSquared - expectation * expectation
}

function multiplyPauliTerms(term1: PauliTerm, term2: PauliTerm): PauliTerm {
  const coefficient = term1.coefficient * term2.coefficient
  const operators: { qubit: number; pauli: 'I' | 'X' | 'Y' | 'Z' }[] = []
  const qubitMap = new Map<number, 'I' | 'X' | 'Y' | 'Z'>()

  for (const op of term1.operators) {
    qubitMap.set(op.qubit, op.pauli)
  }

  let phaseFactor = 1

  for (const op of term2.operators) {
    const existing = qubitMap.get(op.qubit)
    if (existing) {
      const [result, phase] = multiplyPaulis(existing, op.pauli)
      phaseFactor *= phase
      if (result !== 'I') {
        qubitMap.set(op.qubit, result)
      } else {
        qubitMap.delete(op.qubit)
      }
    } else {
      qubitMap.set(op.qubit, op.pauli)
    }
  }

  for (const [qubit, pauli] of qubitMap) {
    operators.push({ qubit, pauli })
  }

  return { coefficient: coefficient * phaseFactor, operators }
}

function multiplyPaulis(p1: 'I' | 'X' | 'Y' | 'Z', p2: 'I' | 'X' | 'Y' | 'Z'): ['I' | 'X' | 'Y' | 'Z', number] {
  if (p1 === 'I') return [p2, 1]
  if (p2 === 'I') return [p1, 1]
  if (p1 === p2) return ['I', 1]

  if (p1 === 'X' && p2 === 'Y') return ['Z', 1]
  if (p1 === 'Y' && p2 === 'X') return ['Z', -1]
  if (p1 === 'Y' && p2 === 'Z') return ['X', 1]
  if (p1 === 'Z' && p2 === 'Y') return ['X', -1]
  if (p1 === 'Z' && p2 === 'X') return ['Y', 1]
  if (p1 === 'X' && p2 === 'Z') return ['Y', -1]

  return ['I', 1]
}

export const computeHamiltonianExpectation = measureHamiltonianExpectation

import { Circuit, executeCircuit as execCircuit } from './circuit'

export function computeParameterShiftGradient(
  circuit: Circuit,
  hamiltonian: Hamiltonian,
  parameters: number[],
  shift: number = Math.PI / 2
): number[] {
  const gradients: number[] = []

  for (let i = 0; i < parameters.length; i++) {
    const paramsPlus = [...parameters]
    paramsPlus[i] += shift

    const paramsMinus = [...parameters]
    paramsMinus[i] -= shift

    const circuitPlus = circuit.clone()
    circuitPlus.setParameters(paramsPlus)
    const statePlus = execCircuit(circuitPlus)
    const energyPlus = measureHamiltonianExpectation(statePlus, hamiltonian)

    const circuitMinus = circuit.clone()
    circuitMinus.setParameters(paramsMinus)
    const stateMinus = execCircuit(circuitMinus)
    const energyMinus = measureHamiltonianExpectation(stateMinus, hamiltonian)

    gradients.push((energyPlus - energyMinus) / (2 * Math.sin(shift)))
  }

  return gradients
}
