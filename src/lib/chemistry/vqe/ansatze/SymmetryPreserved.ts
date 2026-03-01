import { QMLCircuit } from '@/lib/qml/core/QMLCircuit'
import type { AnsatzConfig, AnsatzResult, AnsatzMetrics } from './types'

export interface SymmetryConfig extends AnsatzConfig {
  preserveParticleNumber: boolean
  preserveSpinZ: boolean
  numAlpha: number
  numBeta: number
}

export class SymmetryPreservedAnsatz {
  private config: SymmetryConfig

  constructor(config: Partial<SymmetryConfig> & { numQubits: number; numElectrons: number }) {
    const numAlpha = Math.ceil(config.numElectrons / 2)
    const numBeta = Math.floor(config.numElectrons / 2)

    this.config = {
      type: 'symmetry_preserved',
      numQubits: config.numQubits,
      numElectrons: config.numElectrons,
      preserveParticleNumber: config.preserveParticleNumber ?? true,
      preserveSpinZ: config.preserveSpinZ ?? true,
      numAlpha: config.numAlpha ?? numAlpha,
      numBeta: config.numBeta ?? numBeta,
      numLayers: config.numLayers ?? 2
    }
  }

  buildCircuit(): AnsatzResult {
    const circuit = new QMLCircuit(this.config.numQubits)

    this.prepareInitialState(circuit)

    const numLayers = this.config.numLayers || 2
    for (let layer = 0; layer < numLayers; layer++) {
      this.addParticleConservingLayer(circuit)
    }

    return {
      circuit,
      numParameters: circuit.getTrainableParameters().length,
      estimatedDepth: Math.ceil(circuit.getGates().length / this.config.numQubits),
      operatorsUsed: ['particle_conserving', 'spin_preserving']
    }
  }

  private prepareInitialState(circuit: QMLCircuit): void {
    const numElectrons = this.config.numElectrons ?? 0
    for (let i = 0; i < numElectrons && i < this.config.numQubits; i++) {
      circuit.addGate('X', [i])
    }
  }

  private addParticleConservingLayer(circuit: QMLCircuit): void {
    for (let i = 0; i < this.config.numQubits - 1; i++) {
      this.addParticleConservingGate(circuit, i, i + 1)
    }

    if (this.config.preserveSpinZ) {
      this.addSpinConservingGates(circuit)
    }
  }

  private addParticleConservingGate(circuit: QMLCircuit, q1: number, q2: number): void {
    circuit.addGate('CNOT', [q1, q2])

    circuit.addParameterizedGate('Ry', q1)

    circuit.addGate('CNOT', [q2, q1])

    circuit.addParameterizedGate('Ry', q1)

    circuit.addGate('CNOT', [q2, q1])

    circuit.addGate('CNOT', [q1, q2])
  }

  private addSpinConservingGates(circuit: QMLCircuit): void {
    const numSpatial = Math.floor(this.config.numQubits / 2)

    for (let p = 0; p < numSpatial; p++) {
      const alpha = 2 * p
      const beta = 2 * p + 1

      if (beta < this.config.numQubits) {
        this.addSpinFlipGate(circuit, alpha, beta)
      }
    }
  }

  private addSpinFlipGate(circuit: QMLCircuit, alpha: number, beta: number): void {
    circuit.addGate('CNOT', [alpha, beta])
    circuit.addGate('CNOT', [beta, alpha])

    circuit.addParameterizedGate('Ry', alpha)

    circuit.addGate('CNOT', [beta, alpha])
    circuit.addGate('CNOT', [alpha, beta])
  }

  getMetrics(): AnsatzMetrics {
    const result = this.buildCircuit()
    const gates = result.circuit.getGates()

    let numCNOTs = 0
    for (const gate of gates) {
      if (gate.type === 'CNOT' || gate.type === 'CX') {
        numCNOTs++
      }
    }

    return {
      numGates: gates.length,
      numCNOTs,
      numParameters: result.numParameters,
      estimatedDepth: result.estimatedDepth
    }
  }
}

export class GivensRotationAnsatz {
  private numQubits: number
  private numElectrons: number
  private numLayers: number

  constructor(numQubits: number, numElectrons: number, numLayers: number = 1) {
    this.numQubits = numQubits
    this.numElectrons = numElectrons
    this.numLayers = numLayers
  }

  buildCircuit(): AnsatzResult {
    const circuit = new QMLCircuit(this.numQubits)

    for (let i = 0; i < this.numElectrons && i < this.numQubits; i++) {
      circuit.addGate('X', [i])
    }

    for (let layer = 0; layer < this.numLayers; layer++) {
      this.addGivensRotationLayer(circuit, layer % 2 === 0)
    }

    return {
      circuit,
      numParameters: circuit.getTrainableParameters().length,
      estimatedDepth: Math.ceil(circuit.getGates().length / this.numQubits),
      operatorsUsed: ['givens_rotation']
    }
  }

  private addGivensRotationLayer(circuit: QMLCircuit, evenLayer: boolean): void {
    const start = evenLayer ? 0 : 1

    for (let i = start; i < this.numQubits - 1; i += 2) {
      this.addGivensRotation(circuit, i, i + 1)
    }
  }

  private addGivensRotation(circuit: QMLCircuit, q1: number, q2: number): void {
    circuit.addGate('CNOT', [q2, q1])

    circuit.addParameterizedGate('Ry', q2)

    circuit.addGate('CNOT', [q1, q2])

    circuit.addParameterizedGate('Ry', q2)

    circuit.addGate('CNOT', [q1, q2])

    circuit.addGate('CNOT', [q2, q1])
  }
}

export class JastrowAnsatz {
  private numQubits: number
  private numElectrons: number
  private correlationDepth: number

  constructor(numQubits: number, numElectrons: number, correlationDepth: number = 2) {
    this.numQubits = numQubits
    this.numElectrons = numElectrons
    this.correlationDepth = correlationDepth
  }

  buildCircuit(): AnsatzResult {
    const circuit = new QMLCircuit(this.numQubits)

    for (let i = 0; i < this.numElectrons && i < this.numQubits; i++) {
      circuit.addGate('X', [i])
    }

    this.addJastrowCorrelations(circuit)

    for (let d = 0; d < this.correlationDepth; d++) {
      this.addOrbitalOptimization(circuit)
    }

    return {
      circuit,
      numParameters: circuit.getTrainableParameters().length,
      estimatedDepth: Math.ceil(circuit.getGates().length / this.numQubits),
      operatorsUsed: ['jastrow_correlation', 'orbital_optimization']
    }
  }

  private addJastrowCorrelations(circuit: QMLCircuit): void {
    for (let i = 0; i < this.numQubits; i++) {
      for (let j = i + 1; j < this.numQubits; j++) {
        this.addTwoBodyCorrelation(circuit, i, j)
      }
    }
  }

  private addTwoBodyCorrelation(circuit: QMLCircuit, q1: number, q2: number): void {
    circuit.addGate('CNOT', [q1, q2])
    circuit.addParameterizedGate('Rz', q2)
    circuit.addGate('CNOT', [q1, q2])
  }

  private addOrbitalOptimization(circuit: QMLCircuit): void {
    for (let i = 0; i < this.numQubits; i++) {
      circuit.addParameterizedGate('Ry', i)
      circuit.addParameterizedGate('Rz', i)
    }
  }
}

export function createSymmetryPreservedAnsatz(
  numQubits: number,
  numElectrons: number,
  options?: Partial<SymmetryConfig>
): AnsatzResult {
  const builder = new SymmetryPreservedAnsatz({
    numQubits,
    numElectrons,
    ...options
  })

  return builder.buildCircuit()
}

export function createGivensRotationAnsatz(
  numQubits: number,
  numElectrons: number,
  numLayers: number = 1
): AnsatzResult {
  const builder = new GivensRotationAnsatz(numQubits, numElectrons, numLayers)
  return builder.buildCircuit()
}

export function createJastrowAnsatz(
  numQubits: number,
  numElectrons: number,
  correlationDepth: number = 2
): AnsatzResult {
  const builder = new JastrowAnsatz(numQubits, numElectrons, correlationDepth)
  return builder.buildCircuit()
}

export function selectBestAnsatz(
  numQubits: number,
  numElectrons: number,
  prioritize: 'accuracy' | 'depth' | 'balanced' = 'balanced'
): {
  ansatzType: string
  recommendation: string
  circuit: AnsatzResult
} {
  if (numQubits <= 4) {
    return {
      ansatzType: 'uccsd',
      recommendation: 'Small system - full UCCSD is feasible',
      circuit: createGivensRotationAnsatz(numQubits, numElectrons, 2)
    }
  }

  if (prioritize === 'accuracy') {
    return {
      ansatzType: 'symmetry_preserved',
      recommendation: 'Symmetry-preserved for maximum accuracy',
      circuit: createSymmetryPreservedAnsatz(numQubits, numElectrons, { numLayers: 3 })
    }
  }

  if (prioritize === 'depth') {
    return {
      ansatzType: 'givens',
      recommendation: 'Givens rotation for minimal depth',
      circuit: createGivensRotationAnsatz(numQubits, numElectrons, 1)
    }
  }

  return {
    ansatzType: 'symmetry_preserved',
    recommendation: 'Balanced choice for general use',
    circuit: createSymmetryPreservedAnsatz(numQubits, numElectrons, { numLayers: 2 })
  }
}
