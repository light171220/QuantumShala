import { QuantumSimulator } from '@/lib/quantum/simulator'
import type { CircuitGate, Complex } from '@/types/simulator'

export interface QMLParameter {
  id: string
  name: string
  value: number
  gateIndices: number[]
  trainable: boolean
}

export interface QMLGate {
  type: string
  qubits: number[]
  controlQubits?: number[]
  parameterIds?: string[]
  fixedParams?: number[]
}

export interface QMLCircuitConfig {
  numQubits: number
  numLayers?: number
  entanglement?: 'linear' | 'circular' | 'full' | 'custom'
  insertBarriers?: boolean
}

export interface ExpectationResult {
  value: number
  stateVector?: Complex[]
}

export class QMLCircuit {
  private numQubits: number
  private gates: QMLGate[] = []
  private parameters: Map<string, QMLParameter> = new Map()
  private parameterCounter = 0

  constructor(numQubits: number) {
    this.numQubits = numQubits
  }

  getNumQubits(): number {
    return this.numQubits
  }

  getGates(): QMLGate[] {
    return [...this.gates]
  }

  getParameters(): QMLParameter[] {
    return Array.from(this.parameters.values())
  }

  getTrainableParameters(): QMLParameter[] {
    return this.getParameters().filter(p => p.trainable)
  }

  getParameterVector(): number[] {
    return this.getTrainableParameters().map(p => p.value)
  }

  setParameterVector(values: number[]): void {
    const trainable = this.getTrainableParameters()
    if (values.length !== trainable.length) {
      throw new Error(`Expected ${trainable.length} parameters, got ${values.length}`)
    }
    trainable.forEach((p, i) => {
      p.value = values[i]
    })
  }

  addParameterizedGate(
    type: 'Rx' | 'Ry' | 'Rz',
    qubit: number,
    paramName?: string,
    initialValue: number = 0
  ): string {
    const paramId = `param_${this.parameterCounter++}`
    const param: QMLParameter = {
      id: paramId,
      name: paramName || paramId,
      value: initialValue,
      gateIndices: [this.gates.length],
      trainable: true
    }
    this.parameters.set(paramId, param)

    this.gates.push({
      type,
      qubits: [qubit],
      parameterIds: [paramId]
    })

    return paramId
  }

  addGate(type: string, qubits: number[], params?: number[], controlQubits?: number[]): void {
    this.gates.push({
      type,
      qubits,
      controlQubits,
      fixedParams: params
    })
  }

  addEntanglingLayer(entanglement: 'linear' | 'circular' | 'full' = 'linear'): void {
    switch (entanglement) {
      case 'linear':
        for (let i = 0; i < this.numQubits - 1; i++) {
          this.addGate('CNOT', [i, i + 1])
        }
        break
      case 'circular':
        for (let i = 0; i < this.numQubits - 1; i++) {
          this.addGate('CNOT', [i, i + 1])
        }
        if (this.numQubits > 2) {
          this.addGate('CNOT', [this.numQubits - 1, 0])
        }
        break
      case 'full':
        for (let i = 0; i < this.numQubits; i++) {
          for (let j = i + 1; j < this.numQubits; j++) {
            this.addGate('CNOT', [i, j])
          }
        }
        break
    }
  }

  addRotationLayer(rotationType: 'Ry' | 'RyRz' | 'RxRyRz' = 'RyRz'): string[] {
    const paramIds: string[] = []

    for (let q = 0; q < this.numQubits; q++) {
      if (rotationType === 'RxRyRz') {
        paramIds.push(this.addParameterizedGate('Rx', q))
      }
      if (rotationType === 'RyRz' || rotationType === 'RxRyRz') {
        paramIds.push(this.addParameterizedGate('Ry', q))
      }
      paramIds.push(this.addParameterizedGate('Rz', q))
    }

    return paramIds
  }

  buildHEA(numLayers: number, entanglement: 'linear' | 'circular' | 'full' = 'linear'): void {
    for (let layer = 0; layer < numLayers; layer++) {
      this.addRotationLayer('RyRz')
      if (layer < numLayers - 1 || this.numQubits > 1) {
        this.addEntanglingLayer(entanglement)
      }
    }
  }

  buildStronglyEntangling(numLayers: number): void {
    for (let layer = 0; layer < numLayers; layer++) {
      this.addRotationLayer('RxRyRz')

      const offset = layer % this.numQubits
      for (let i = 0; i < this.numQubits - 1; i++) {
        const q1 = (i + offset) % this.numQubits
        const q2 = (i + 1 + offset) % this.numQubits
        this.addGate('CNOT', [q1, q2])
      }
    }
  }

  toSimulatorGates(): CircuitGate[] {
    const simulatorGates: CircuitGate[] = []

    this.gates.forEach((gate, idx) => {
      const params: number[] = []

      if (gate.parameterIds) {
        gate.parameterIds.forEach(paramId => {
          const param = this.parameters.get(paramId)
          if (param) {
            params.push(param.value)
          }
        })
      }
      if (gate.fixedParams) {
        params.push(...gate.fixedParams)
      }

      simulatorGates.push({
        id: `gate_${idx}`,
        type: gate.type as CircuitGate['type'],
        qubits: gate.qubits,
        controlQubits: gate.controlQubits,
        parameters: params.length > 0 ? params : undefined,
        position: idx
      })
    })

    return simulatorGates
  }

  execute(): Complex[] {
    const sim = new QuantumSimulator(this.numQubits)
    const gates = this.toSimulatorGates()

    for (const gate of gates) {
      sim.applyGate(gate)
    }

    return sim.getStateVector()
  }

  expectationZ(measureQubits: number[]): ExpectationResult {
    const stateVector = this.execute()
    const numStates = Math.pow(2, this.numQubits)
    let expectation = 0

    for (let i = 0; i < numStates; i++) {
      const amplitude = stateVector[i]
      const probability = amplitude.re * amplitude.re + amplitude.im * amplitude.im

      let parity = 1
      for (const q of measureQubits) {
        if ((i >> q) & 1) {
          parity *= -1
        }
      }

      expectation += parity * probability
    }

    return { value: expectation, stateVector }
  }

  expectationPauli(pauliString: string): ExpectationResult {
    if (pauliString.length !== this.numQubits) {
      throw new Error(`Pauli string length must match number of qubits`)
    }

    const rotatedCircuit = this.clone()

    for (let q = 0; q < this.numQubits; q++) {
      const pauli = pauliString[this.numQubits - 1 - q]
      switch (pauli) {
        case 'X':
          rotatedCircuit.addGate('H', [q])
          break
        case 'Y':
          rotatedCircuit.addGate('Sdg', [q])
          rotatedCircuit.addGate('H', [q])
          break
      }
    }

    const stateVector = rotatedCircuit.execute()
    const numStates = Math.pow(2, this.numQubits)
    let expectation = 0

    const activeQubits: number[] = []
    for (let q = 0; q < this.numQubits; q++) {
      if (pauliString[this.numQubits - 1 - q] !== 'I') {
        activeQubits.push(q)
      }
    }

    for (let i = 0; i < numStates; i++) {
      const amplitude = stateVector[i]
      const probability = amplitude.re * amplitude.re + amplitude.im * amplitude.im

      let parity = 1
      for (const q of activeQubits) {
        if ((i >> q) & 1) {
          parity *= -1
        }
      }

      expectation += parity * probability
    }

    return { value: expectation, stateVector }
  }

  computeGradient(
    costFunction: (circuit: QMLCircuit) => number,
    parameterShift: number = Math.PI / 2
  ): number[] {
    const trainableParams = this.getTrainableParameters()
    const gradients: number[] = []

    for (const param of trainableParams) {
      const originalValue = param.value

      param.value = originalValue + parameterShift
      const forwardCost = costFunction(this)

      param.value = originalValue - parameterShift
      const backwardCost = costFunction(this)

      param.value = originalValue

      const gradient = (forwardCost - backwardCost) / (2 * Math.sin(parameterShift))
      gradients.push(gradient)
    }

    return gradients
  }

  clone(): QMLCircuit {
    const cloned = new QMLCircuit(this.numQubits)

    this.parameters.forEach((param, id) => {
      cloned.parameters.set(id, { ...param, gateIndices: [...param.gateIndices] })
    })

    cloned.gates = this.gates.map(gate => ({
      ...gate,
      qubits: [...gate.qubits],
      controlQubits: gate.controlQubits ? [...gate.controlQubits] : undefined,
      parameterIds: gate.parameterIds ? [...gate.parameterIds] : undefined,
      fixedParams: gate.fixedParams ? [...gate.fixedParams] : undefined
    }))

    cloned.parameterCounter = this.parameterCounter

    return cloned
  }

  initializeRandom(scale: number = Math.PI): void {
    this.getTrainableParameters().forEach(param => {
      param.value = (Math.random() * 2 - 1) * scale
    })
  }

  executeShotBased(shots: number = 1000): Record<string, number> {
    const stateVector = this.execute()
    const numStates = Math.pow(2, this.numQubits)
    const counts: Record<string, number> = {}

    const probabilities: number[] = []
    for (let i = 0; i < numStates; i++) {
      const amplitude = stateVector[i]
      probabilities.push(amplitude.re * amplitude.re + amplitude.im * amplitude.im)
    }

    for (let shot = 0; shot < shots; shot++) {
      const rand = Math.random()
      let cumulative = 0
      let outcome = 0

      for (let i = 0; i < numStates; i++) {
        cumulative += probabilities[i]
        if (rand < cumulative) {
          outcome = i
          break
        }
      }

      const bitstring = outcome.toString(2).padStart(this.numQubits, '0')
      counts[bitstring] = (counts[bitstring] || 0) + 1
    }

    return counts
  }

  expectationPauliSampled(pauliString: string, shots: number = 1000): {
    value: number
    variance: number
    standardError: number
    counts: Record<string, number>
  } {
    if (pauliString.length !== this.numQubits) {
      throw new Error(`Pauli string length must match number of qubits`)
    }

    const rotatedCircuit = this.clone()

    for (let q = 0; q < this.numQubits; q++) {
      const pauli = pauliString[this.numQubits - 1 - q]
      switch (pauli) {
        case 'X':
          rotatedCircuit.addGate('H', [q])
          break
        case 'Y':
          rotatedCircuit.addGate('Sdg', [q])
          rotatedCircuit.addGate('H', [q])
          break
      }
    }

    const counts = rotatedCircuit.executeShotBased(shots)

    const activeQubits: number[] = []
    for (let q = 0; q < this.numQubits; q++) {
      if (pauliString[this.numQubits - 1 - q] !== 'I') {
        activeQubits.push(q)
      }
    }

    let expectation = 0
    let sumSquared = 0

    for (const [bitstring, count] of Object.entries(counts)) {
      let parity = 1
      for (const q of activeQubits) {
        const bit = bitstring[this.numQubits - 1 - q]
        if (bit === '1') {
          parity *= -1
        }
      }
      expectation += parity * count
      sumSquared += count
    }

    const normalizedExpectation = expectation / shots

    let variance = 0
    for (const [bitstring, count] of Object.entries(counts)) {
      let parity = 1
      for (const q of activeQubits) {
        const bit = bitstring[this.numQubits - 1 - q]
        if (bit === '1') {
          parity *= -1
        }
      }
      variance += count * Math.pow(parity - normalizedExpectation, 2)
    }
    variance = variance / shots

    const standardError = Math.sqrt(variance / shots)

    return {
      value: normalizedExpectation,
      variance,
      standardError,
      counts
    }
  }

  computeHamiltonianExpectationSampled(
    terms: { paulis: string; coefficient: number }[],
    shots: number = 1000
  ): {
    energy: number
    standardError: number
    termContributions: { paulis: string; expectation: number; contribution: number }[]
  } {
    const termContributions: { paulis: string; expectation: number; contribution: number }[] = []
    let totalEnergy = 0
    let totalVariance = 0

    for (const term of terms) {
      if (term.paulis.split('').every(p => p === 'I')) {
        totalEnergy += term.coefficient
        termContributions.push({
          paulis: term.paulis,
          expectation: 1,
          contribution: term.coefficient
        })
      } else {
        const result = this.expectationPauliSampled(term.paulis, shots)
        const contribution = term.coefficient * result.value
        totalEnergy += contribution
        totalVariance += term.coefficient * term.coefficient * result.variance

        termContributions.push({
          paulis: term.paulis,
          expectation: result.value,
          contribution
        })
      }
    }

    return {
      energy: totalEnergy,
      standardError: Math.sqrt(totalVariance / shots),
      termContributions
    }
  }

  describe(): string {
    let desc = `QMLCircuit with ${this.numQubits} qubits, ${this.gates.length} gates, ${this.parameters.size} parameters\n`
    desc += `Trainable parameters: ${this.getTrainableParameters().length}\n`
    desc += `Gates:\n`
    this.gates.forEach((gate, i) => {
      desc += `  ${i}: ${gate.type} on qubits [${gate.qubits.join(',')}]`
      if (gate.parameterIds) {
        const params = gate.parameterIds.map(id => {
          const p = this.parameters.get(id)
          return p ? `${p.name}=${p.value.toFixed(4)}` : id
        })
        desc += ` params=[${params.join(',')}]`
      }
      desc += '\n'
    })
    return desc
  }
}

export function createHEACircuit(
  numQubits: number,
  numLayers: number = 2,
  entanglement: 'linear' | 'circular' | 'full' = 'linear'
): QMLCircuit {
  const circuit = new QMLCircuit(numQubits)
  circuit.buildHEA(numLayers, entanglement)
  circuit.initializeRandom()
  return circuit
}

export function createStronglyEntanglingCircuit(
  numQubits: number,
  numLayers: number = 2
): QMLCircuit {
  const circuit = new QMLCircuit(numQubits)
  circuit.buildStronglyEntangling(numLayers)
  circuit.initializeRandom()
  return circuit
}
