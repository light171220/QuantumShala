import type { Handler } from 'aws-lambda'

interface PauliTerm {
  paulis: string
  coefficient: number
}

interface VQEInput {
  moleculeId: string
  moleculeName?: string
  numQubits: number
  numElectrons: number
  hamiltonianTerms: PauliTerm[]
  exactEnergy: number
  hartreeFockEnergy: number
  ansatzType: 'hea' | 'uccsd' | 'adapt' | 'qubit_adapt'
  numLayers: number
  optimizerType: 'cobyla' | 'spsa' | 'adam' | 'slsqp'
  maxIterations: number
  tolerance: number
  shots?: number
}

interface VQEOutput {
  success: boolean
  energy?: number
  parameters?: number[]
  iterations?: number
  converged?: boolean
  errorFromExact?: number
  errorInKcalMol?: number
  history?: { iteration: number; energy: number }[]
  executionTimeMs?: number
  error?: string
}

interface Complex {
  re: number
  im: number
}

class QuantumSimulator {
  private numQubits: number
  private stateVector: Complex[]

  constructor(numQubits: number) {
    this.numQubits = numQubits
    const dim = Math.pow(2, numQubits)
    this.stateVector = Array(dim).fill(null).map(() => ({ re: 0, im: 0 }))
    this.stateVector[0] = { re: 1, im: 0 }
  }

  applyGate(type: string, qubits: number[], params?: number[]): void {
    switch (type) {
      case 'X':
        this.applyPauliX(qubits[0])
        break
      case 'Y':
        this.applyPauliY(qubits[0])
        break
      case 'Z':
        this.applyPauliZ(qubits[0])
        break
      case 'H':
        this.applyHadamard(qubits[0])
        break
      case 'Rx':
        this.applyRx(qubits[0], params?.[0] || 0)
        break
      case 'Ry':
        this.applyRy(qubits[0], params?.[0] || 0)
        break
      case 'Rz':
        this.applyRz(qubits[0], params?.[0] || 0)
        break
      case 'CNOT':
      case 'CX':
        this.applyCNOT(qubits[0], qubits[1])
        break
      case 'S':
        this.applyS(qubits[0])
        break
      case 'Sdg':
        this.applySdg(qubits[0])
        break
    }
  }

  private applyPauliX(qubit: number): void {
    const dim = this.stateVector.length
    for (let i = 0; i < dim; i++) {
      const flipped = i ^ (1 << qubit)
      if (i < flipped) {
        const temp = this.stateVector[i]
        this.stateVector[i] = this.stateVector[flipped]
        this.stateVector[flipped] = temp
      }
    }
  }

  private applyPauliY(qubit: number): void {
    const dim = this.stateVector.length
    for (let i = 0; i < dim; i++) {
      const flipped = i ^ (1 << qubit)
      if (i < flipped) {
        const bit = (i >> qubit) & 1
        const temp = this.stateVector[i]
        if (bit === 0) {
          this.stateVector[i] = { re: this.stateVector[flipped].im, im: -this.stateVector[flipped].re }
          this.stateVector[flipped] = { re: -temp.im, im: temp.re }
        } else {
          this.stateVector[i] = { re: -this.stateVector[flipped].im, im: this.stateVector[flipped].re }
          this.stateVector[flipped] = { re: temp.im, im: -temp.re }
        }
      }
    }
  }

  private applyPauliZ(qubit: number): void {
    const dim = this.stateVector.length
    for (let i = 0; i < dim; i++) {
      if ((i >> qubit) & 1) {
        this.stateVector[i] = { re: -this.stateVector[i].re, im: -this.stateVector[i].im }
      }
    }
  }

  private applyHadamard(qubit: number): void {
    const dim = this.stateVector.length
    const sqrt2Inv = 1 / Math.sqrt(2)
    for (let i = 0; i < dim; i++) {
      const flipped = i ^ (1 << qubit)
      if (i < flipped) {
        const a = this.stateVector[i]
        const b = this.stateVector[flipped]
        this.stateVector[i] = {
          re: sqrt2Inv * (a.re + b.re),
          im: sqrt2Inv * (a.im + b.im)
        }
        this.stateVector[flipped] = {
          re: sqrt2Inv * (a.re - b.re),
          im: sqrt2Inv * (a.im - b.im)
        }
      }
    }
  }

  private applyRx(qubit: number, theta: number): void {
    const cos = Math.cos(theta / 2)
    const sin = Math.sin(theta / 2)
    const dim = this.stateVector.length

    for (let i = 0; i < dim; i++) {
      const flipped = i ^ (1 << qubit)
      if (i < flipped) {
        const a = this.stateVector[i]
        const b = this.stateVector[flipped]
        this.stateVector[i] = {
          re: cos * a.re + sin * b.im,
          im: cos * a.im - sin * b.re
        }
        this.stateVector[flipped] = {
          re: cos * b.re + sin * a.im,
          im: cos * b.im - sin * a.re
        }
      }
    }
  }

  private applyRy(qubit: number, theta: number): void {
    const cos = Math.cos(theta / 2)
    const sin = Math.sin(theta / 2)
    const dim = this.stateVector.length

    for (let i = 0; i < dim; i++) {
      const flipped = i ^ (1 << qubit)
      if (i < flipped) {
        const a = this.stateVector[i]
        const b = this.stateVector[flipped]
        this.stateVector[i] = {
          re: cos * a.re - sin * b.re,
          im: cos * a.im - sin * b.im
        }
        this.stateVector[flipped] = {
          re: sin * a.re + cos * b.re,
          im: sin * a.im + cos * b.im
        }
      }
    }
  }

  private applyRz(qubit: number, theta: number): void {
    const cos = Math.cos(theta / 2)
    const sin = Math.sin(theta / 2)
    const dim = this.stateVector.length

    for (let i = 0; i < dim; i++) {
      const bit = (i >> qubit) & 1
      const phase = bit === 0 ? { re: cos, im: -sin } : { re: cos, im: sin }
      const a = this.stateVector[i]
      this.stateVector[i] = {
        re: a.re * phase.re - a.im * phase.im,
        im: a.re * phase.im + a.im * phase.re
      }
    }
  }

  private applyCNOT(control: number, target: number): void {
    const dim = this.stateVector.length
    for (let i = 0; i < dim; i++) {
      if ((i >> control) & 1) {
        const flipped = i ^ (1 << target)
        if (i < flipped) {
          const temp = this.stateVector[i]
          this.stateVector[i] = this.stateVector[flipped]
          this.stateVector[flipped] = temp
        }
      }
    }
  }

  private applyS(qubit: number): void {
    const dim = this.stateVector.length
    for (let i = 0; i < dim; i++) {
      if ((i >> qubit) & 1) {
        const a = this.stateVector[i]
        this.stateVector[i] = { re: -a.im, im: a.re }
      }
    }
  }

  private applySdg(qubit: number): void {
    const dim = this.stateVector.length
    for (let i = 0; i < dim; i++) {
      if ((i >> qubit) & 1) {
        const a = this.stateVector[i]
        this.stateVector[i] = { re: a.im, im: -a.re }
      }
    }
  }

  getStateVector(): Complex[] {
    return this.stateVector
  }

  reset(): void {
    const dim = this.stateVector.length
    for (let i = 0; i < dim; i++) {
      this.stateVector[i] = { re: 0, im: 0 }
    }
    this.stateVector[0] = { re: 1, im: 0 }
  }
}

interface Gate {
  type: string
  qubits: number[]
  paramIdx?: number
  fixedParam?: number
}

function buildHEACircuit(numQubits: number, numLayers: number): Gate[] {
  const gates: Gate[] = []
  let paramIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let q = 0; q < numQubits; q++) {
      gates.push({ type: 'Ry', qubits: [q], paramIdx: paramIdx++ })
      gates.push({ type: 'Rz', qubits: [q], paramIdx: paramIdx++ })
    }

    for (let q = 0; q < numQubits - 1; q++) {
      gates.push({ type: 'CNOT', qubits: [q, q + 1] })
    }
  }

  return gates
}

function buildUCCSDCircuit(numQubits: number, numElectrons: number): Gate[] {
  const gates: Gate[] = []
  let paramIdx = 0

  for (let i = 0; i < numElectrons && i < numQubits; i++) {
    gates.push({ type: 'X', qubits: [i] })
  }

  const occupied = Array.from({ length: numElectrons }, (_, i) => i)
  const virtual = Array.from({ length: numQubits - numElectrons }, (_, i) => i + numElectrons)

  for (const i of occupied) {
    for (const a of virtual) {
      if (a < numQubits) {
        gates.push({ type: 'CNOT', qubits: [i, a] })
        gates.push({ type: 'Ry', qubits: [a], paramIdx: paramIdx++ })
        gates.push({ type: 'CNOT', qubits: [i, a] })
      }
    }
  }

  return gates
}

function runCircuit(
  simulator: QuantumSimulator,
  gates: Gate[],
  parameters: number[]
): Complex[] {
  simulator.reset()

  for (const gate of gates) {
    let params: number[] | undefined
    if (gate.paramIdx !== undefined) {
      params = [parameters[gate.paramIdx]]
    } else if (gate.fixedParam !== undefined) {
      params = [gate.fixedParam]
    }
    simulator.applyGate(gate.type, gate.qubits, params)
  }

  return simulator.getStateVector()
}

function computePauliExpectation(stateVector: Complex[], pauliString: string): number {
  const numQubits = pauliString.length
  const numStates = stateVector.length

  const rotatedState = [...stateVector]

  for (let q = 0; q < numQubits; q++) {
    const pauli = pauliString[numQubits - 1 - q]
    if (pauli === 'X' || pauli === 'Y') {
      const sqrt2Inv = 1 / Math.sqrt(2)
      for (let i = 0; i < numStates; i++) {
        const flipped = i ^ (1 << q)
        if (i < flipped) {
          const a = rotatedState[i]
          const b = rotatedState[flipped]

          if (pauli === 'X') {
            rotatedState[i] = { re: sqrt2Inv * (a.re + b.re), im: sqrt2Inv * (a.im + b.im) }
            rotatedState[flipped] = { re: sqrt2Inv * (a.re - b.re), im: sqrt2Inv * (a.im - b.im) }
          } else {
            const aTransformed = { re: a.im, im: -a.re }
            rotatedState[i] = { re: sqrt2Inv * (a.re + aTransformed.re), im: sqrt2Inv * (a.im + aTransformed.im) }
            rotatedState[flipped] = { re: sqrt2Inv * (b.re - aTransformed.re), im: sqrt2Inv * (b.im - aTransformed.im) }
          }
        }
      }
    }
  }

  const activeQubits: number[] = []
  for (let q = 0; q < numQubits; q++) {
    if (pauliString[numQubits - 1 - q] !== 'I') {
      activeQubits.push(q)
    }
  }

  let expectation = 0
  for (let i = 0; i < numStates; i++) {
    const amplitude = rotatedState[i]
    const probability = amplitude.re * amplitude.re + amplitude.im * amplitude.im

    let parity = 1
    for (const q of activeQubits) {
      if ((i >> q) & 1) parity *= -1
    }

    expectation += parity * probability
  }

  return expectation
}

function computeEnergy(
  stateVector: Complex[],
  hamiltonianTerms: PauliTerm[]
): number {
  let energy = 0
  const numQubits = hamiltonianTerms[0]?.paulis.length || 0

  for (const term of hamiltonianTerms) {
    if (term.paulis.split('').every(p => p === 'I')) {
      energy += term.coefficient
    } else {
      const expectation = computePauliExpectation(stateVector, term.paulis)
      energy += term.coefficient * expectation
    }
  }

  return energy
}

function optimizeCOBYLA(
  costFunction: (params: number[]) => number,
  initialParams: number[],
  maxIterations: number,
  tolerance: number,
  onIteration?: (iter: number, energy: number) => void
): { params: number[]; energy: number; iterations: number; converged: boolean } {
  let params = [...initialParams]
  let bestEnergy = costFunction(params)
  let bestParams = [...params]
  let prevEnergy = Infinity

  for (let iter = 0; iter < maxIterations; iter++) {
    const delta = Array.from({ length: params.length }, () => (Math.random() - 0.5) * 0.2)

    const paramsPlus = params.map((p, i) => p + delta[i])
    const paramsMinus = params.map((p, i) => p - delta[i])

    const energyPlus = costFunction(paramsPlus)
    const energyMinus = costFunction(paramsMinus)

    if (energyPlus < bestEnergy) {
      bestEnergy = energyPlus
      bestParams = [...paramsPlus]
      params = [...paramsPlus]
    } else if (energyMinus < bestEnergy) {
      bestEnergy = energyMinus
      bestParams = [...paramsMinus]
      params = [...paramsMinus]
    } else {
      const gradient = delta.map((d, i) => (energyPlus - energyMinus) / (2 * d))
      const lr = 0.1 / (1 + iter * 0.01)
      params = params.map((p, i) => p - lr * gradient[i])
    }

    if (onIteration) {
      onIteration(iter, bestEnergy)
    }

    if (Math.abs(prevEnergy - bestEnergy) < tolerance) {
      return { params: bestParams, energy: bestEnergy, iterations: iter + 1, converged: true }
    }
    prevEnergy = bestEnergy
  }

  return { params: bestParams, energy: bestEnergy, iterations: maxIterations, converged: false }
}

export const handler: Handler<VQEInput, VQEOutput> = async (event) => {
  const startTime = Date.now()

  try {
    const {
      numQubits,
      numElectrons,
      hamiltonianTerms,
      exactEnergy,
      ansatzType,
      numLayers,
      maxIterations,
      tolerance
    } = event

    if (numQubits > 20) {
      return {
        success: false,
        error: 'Standard VQE Lambda supports up to 20 qubits. Use run-vqe-large for larger molecules.'
      }
    }

    const simulator = new QuantumSimulator(numQubits)

    let gates: Gate[]
    if (ansatzType === 'uccsd') {
      gates = buildUCCSDCircuit(numQubits, numElectrons)
    } else {
      gates = buildHEACircuit(numQubits, numLayers)
    }

    const numParams = gates.filter(g => g.paramIdx !== undefined).length
    const initialParams = Array.from({ length: numParams }, () => (Math.random() - 0.5) * Math.PI)

    const history: { iteration: number; energy: number }[] = []

    const costFunction = (params: number[]) => {
      const stateVector = runCircuit(simulator, gates, params)
      return computeEnergy(stateVector, hamiltonianTerms)
    }

    const result = optimizeCOBYLA(
      costFunction,
      initialParams,
      maxIterations,
      tolerance,
      (iter, energy) => {
        if (iter % 5 === 0) {
          history.push({ iteration: iter, energy })
        }
      }
    )

    const errorFromExact = result.energy - exactEnergy
    const HARTREE_TO_KCAL_MOL = 627.5094740631
    const errorInKcalMol = errorFromExact * HARTREE_TO_KCAL_MOL

    return {
      success: true,
      energy: result.energy,
      parameters: result.params,
      iterations: result.iterations,
      converged: result.converged,
      errorFromExact,
      errorInKcalMol,
      history,
      executionTimeMs: Date.now() - startTime
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      executionTimeMs: Date.now() - startTime
    }
  }
}
