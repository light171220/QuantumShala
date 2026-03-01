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
  memoryUsedMB?: number
  error?: string
}

interface Complex {
  re: number
  im: number
}

class LargeQuantumSimulator {
  private numQubits: number
  private stateReal: Float64Array
  private stateImag: Float64Array

  constructor(numQubits: number) {
    this.numQubits = numQubits
    const dim = Math.pow(2, numQubits)

    if (dim > 268435456) {
      throw new Error(`State vector too large: ${numQubits} qubits requires ${dim * 16 / 1e9} GB`)
    }

    this.stateReal = new Float64Array(dim)
    this.stateImag = new Float64Array(dim)
    this.stateReal[0] = 1
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
    const dim = this.stateReal.length
    const mask = 1 << qubit
    for (let i = 0; i < dim; i++) {
      const flipped = i ^ mask
      if (i < flipped) {
        let temp = this.stateReal[i]
        this.stateReal[i] = this.stateReal[flipped]
        this.stateReal[flipped] = temp
        temp = this.stateImag[i]
        this.stateImag[i] = this.stateImag[flipped]
        this.stateImag[flipped] = temp
      }
    }
  }

  private applyPauliY(qubit: number): void {
    const dim = this.stateReal.length
    const mask = 1 << qubit
    for (let i = 0; i < dim; i++) {
      const flipped = i ^ mask
      if (i < flipped) {
        const bit = (i >> qubit) & 1
        const tempRe = this.stateReal[i]
        const tempIm = this.stateImag[i]
        if (bit === 0) {
          this.stateReal[i] = this.stateImag[flipped]
          this.stateImag[i] = -this.stateReal[flipped]
          this.stateReal[flipped] = -tempIm
          this.stateImag[flipped] = tempRe
        } else {
          this.stateReal[i] = -this.stateImag[flipped]
          this.stateImag[i] = this.stateReal[flipped]
          this.stateReal[flipped] = tempIm
          this.stateImag[flipped] = -tempRe
        }
      }
    }
  }

  private applyPauliZ(qubit: number): void {
    const dim = this.stateReal.length
    const mask = 1 << qubit
    for (let i = 0; i < dim; i++) {
      if (i & mask) {
        this.stateReal[i] = -this.stateReal[i]
        this.stateImag[i] = -this.stateImag[i]
      }
    }
  }

  private applyHadamard(qubit: number): void {
    const dim = this.stateReal.length
    const mask = 1 << qubit
    const sqrt2Inv = 1 / Math.sqrt(2)
    for (let i = 0; i < dim; i++) {
      const flipped = i ^ mask
      if (i < flipped) {
        const aRe = this.stateReal[i]
        const aIm = this.stateImag[i]
        const bRe = this.stateReal[flipped]
        const bIm = this.stateImag[flipped]
        this.stateReal[i] = sqrt2Inv * (aRe + bRe)
        this.stateImag[i] = sqrt2Inv * (aIm + bIm)
        this.stateReal[flipped] = sqrt2Inv * (aRe - bRe)
        this.stateImag[flipped] = sqrt2Inv * (aIm - bIm)
      }
    }
  }

  private applyRx(qubit: number, theta: number): void {
    const cos = Math.cos(theta / 2)
    const sin = Math.sin(theta / 2)
    const dim = this.stateReal.length
    const mask = 1 << qubit

    for (let i = 0; i < dim; i++) {
      const flipped = i ^ mask
      if (i < flipped) {
        const aRe = this.stateReal[i]
        const aIm = this.stateImag[i]
        const bRe = this.stateReal[flipped]
        const bIm = this.stateImag[flipped]
        this.stateReal[i] = cos * aRe + sin * bIm
        this.stateImag[i] = cos * aIm - sin * bRe
        this.stateReal[flipped] = cos * bRe + sin * aIm
        this.stateImag[flipped] = cos * bIm - sin * aRe
      }
    }
  }

  private applyRy(qubit: number, theta: number): void {
    const cos = Math.cos(theta / 2)
    const sin = Math.sin(theta / 2)
    const dim = this.stateReal.length
    const mask = 1 << qubit

    for (let i = 0; i < dim; i++) {
      const flipped = i ^ mask
      if (i < flipped) {
        const aRe = this.stateReal[i]
        const aIm = this.stateImag[i]
        const bRe = this.stateReal[flipped]
        const bIm = this.stateImag[flipped]
        this.stateReal[i] = cos * aRe - sin * bRe
        this.stateImag[i] = cos * aIm - sin * bIm
        this.stateReal[flipped] = sin * aRe + cos * bRe
        this.stateImag[flipped] = sin * aIm + cos * bIm
      }
    }
  }

  private applyRz(qubit: number, theta: number): void {
    const cos = Math.cos(theta / 2)
    const sin = Math.sin(theta / 2)
    const dim = this.stateReal.length
    const mask = 1 << qubit

    for (let i = 0; i < dim; i++) {
      const bit = (i & mask) ? 1 : 0
      const phaseRe = bit === 0 ? cos : cos
      const phaseIm = bit === 0 ? -sin : sin
      const aRe = this.stateReal[i]
      const aIm = this.stateImag[i]
      this.stateReal[i] = aRe * phaseRe - aIm * phaseIm
      this.stateImag[i] = aRe * phaseIm + aIm * phaseRe
    }
  }

  private applyCNOT(control: number, target: number): void {
    const dim = this.stateReal.length
    const controlMask = 1 << control
    const targetMask = 1 << target

    for (let i = 0; i < dim; i++) {
      if (i & controlMask) {
        const flipped = i ^ targetMask
        if (i < flipped) {
          let temp = this.stateReal[i]
          this.stateReal[i] = this.stateReal[flipped]
          this.stateReal[flipped] = temp
          temp = this.stateImag[i]
          this.stateImag[i] = this.stateImag[flipped]
          this.stateImag[flipped] = temp
        }
      }
    }
  }

  private applyS(qubit: number): void {
    const dim = this.stateReal.length
    const mask = 1 << qubit
    for (let i = 0; i < dim; i++) {
      if (i & mask) {
        const temp = this.stateReal[i]
        this.stateReal[i] = -this.stateImag[i]
        this.stateImag[i] = temp
      }
    }
  }

  private applySdg(qubit: number): void {
    const dim = this.stateReal.length
    const mask = 1 << qubit
    for (let i = 0; i < dim; i++) {
      if (i & mask) {
        const temp = this.stateReal[i]
        this.stateReal[i] = this.stateImag[i]
        this.stateImag[i] = -temp
      }
    }
  }

  getStateVector(): Complex[] {
    const result: Complex[] = []
    for (let i = 0; i < this.stateReal.length; i++) {
      result.push({ re: this.stateReal[i], im: this.stateImag[i] })
    }
    return result
  }

  getProbability(index: number): number {
    return this.stateReal[index] ** 2 + this.stateImag[index] ** 2
  }

  reset(): void {
    this.stateReal.fill(0)
    this.stateImag.fill(0)
    this.stateReal[0] = 1
  }

  getMemoryUsageMB(): number {
    return (this.stateReal.byteLength + this.stateImag.byteLength) / (1024 * 1024)
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

  const occupied = Array.from({ length: Math.min(numElectrons, numQubits) }, (_, i) => i)
  const virtual = Array.from({ length: Math.max(0, numQubits - numElectrons) }, (_, i) => i + numElectrons)

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
  simulator: LargeQuantumSimulator,
  gates: Gate[],
  parameters: number[]
): void {
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
}

function computePauliExpectation(simulator: LargeQuantumSimulator, pauliString: string): number {
  const numQubits = pauliString.length
  const numStates = Math.pow(2, numQubits)

  const activeQubits: number[] = []
  for (let q = 0; q < numQubits; q++) {
    if (pauliString[numQubits - 1 - q] !== 'I') {
      activeQubits.push(q)
    }
  }

  let expectation = 0
  for (let i = 0; i < numStates; i++) {
    const probability = simulator.getProbability(i)

    let parity = 1
    for (const q of activeQubits) {
      if ((i >> q) & 1) parity *= -1
    }

    expectation += parity * probability
  }

  return expectation
}

function computeEnergy(
  simulator: LargeQuantumSimulator,
  hamiltonianTerms: PauliTerm[]
): number {
  let energy = 0

  for (const term of hamiltonianTerms) {
    if (term.paulis.split('').every(p => p === 'I')) {
      energy += term.coefficient
    } else {
      const expectation = computePauliExpectation(simulator, term.paulis)
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

    if (numQubits > 28) {
      return {
        success: false,
        error: 'Large VQE Lambda supports up to 28 qubits (10GB memory limit).'
      }
    }

    const simulator = new LargeQuantumSimulator(numQubits)
    const memoryUsedMB = simulator.getMemoryUsageMB()

    let gates: Gate[]
    if (ansatzType === 'uccsd') {
      gates = buildUCCSDCircuit(numQubits, numElectrons)
    } else {
      gates = buildHEACircuit(numQubits, Math.min(numLayers, 3))
    }

    const numParams = gates.filter(g => g.paramIdx !== undefined).length
    const initialParams = Array.from({ length: numParams }, () => (Math.random() - 0.5) * Math.PI)

    const history: { iteration: number; energy: number }[] = []

    const costFunction = (params: number[]) => {
      runCircuit(simulator, gates, params)
      return computeEnergy(simulator, hamiltonianTerms)
    }

    const effectiveMaxIter = Math.min(maxIterations, numQubits > 20 ? 50 : 100)

    const result = optimizeCOBYLA(
      costFunction,
      initialParams,
      effectiveMaxIter,
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
      executionTimeMs: Date.now() - startTime,
      memoryUsedMB
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      executionTimeMs: Date.now() - startTime
    }
  }
}
