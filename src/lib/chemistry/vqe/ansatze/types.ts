import type { QMLCircuit } from '@/lib/qml/core/QMLCircuit'
import type { MolecularHamiltonian } from '../../molecules/types'

export type AnsatzType = 'hea' | 'uccsd' | 'adapt' | 'qubit_adapt' | 'symmetry_preserved' | 'k_upccgsd'

export interface AnsatzConfig {
  type: AnsatzType
  numLayers?: number
  numQubits: number
  numElectrons?: number
  entanglement?: 'linear' | 'circular' | 'full' | 'pairwise'
  includeRx?: boolean
  includeRy?: boolean
  includeRz?: boolean
  trotterOrder?: 1 | 2
  trotterSteps?: number
}

export interface AdaptConfig extends AnsatzConfig {
  gradientThreshold: number
  maxOperators: number
  operatorPoolType: 'fermionic' | 'qubit' | 'hardware_efficient'
}

export interface AnsatzResult {
  circuit: QMLCircuit
  numParameters: number
  estimatedDepth: number
  operatorsUsed: string[]
}

export interface OperatorGradient {
  operatorLabel: string
  pauliString: string
  gradient: number
  absGradient: number
}

export interface AdaptIteration {
  iteration: number
  selectedOperator: string
  gradient: number
  energy: number
  numParameters: number
}

export interface AnsatzMetrics {
  numGates: number
  numCNOTs: number
  numParameters: number
  estimatedDepth: number
  expressibility?: number
  entanglingCapability?: number
}

export interface AnsatzBuilder {
  buildCircuit(config: AnsatzConfig, hamiltonian?: MolecularHamiltonian): QMLCircuit
  getMetrics(circuit: QMLCircuit): AnsatzMetrics
  getDescription(): string
}

export function computeAnsatzMetrics(circuit: QMLCircuit): AnsatzMetrics {
  const gates = circuit.getGates()
  let numCNOTs = 0

  for (const gate of gates) {
    if (gate.type === 'CNOT' || gate.type === 'CX') {
      numCNOTs++
    }
  }

  return {
    numGates: gates.length,
    numCNOTs,
    numParameters: circuit.getTrainableParameters().length,
    estimatedDepth: Math.ceil(gates.length / circuit.getNumQubits())
  }
}

export function estimateExpressibility(
  circuit: QMLCircuit,
  samples: number = 100
): number {
  const fidelities: number[] = []

  for (let i = 0; i < samples; i++) {
    const circuit1 = circuit.clone()
    const circuit2 = circuit.clone()

    circuit1.initializeRandom()
    circuit2.initializeRandom()

    const state1 = circuit1.execute()
    const state2 = circuit2.execute()

    let fidelity = 0
    for (let j = 0; j < state1.length; j++) {
      const re = state1[j].re * state2[j].re + state1[j].im * state2[j].im
      const im = state1[j].re * state2[j].im - state1[j].im * state2[j].re
      fidelity += re * re + im * im
    }

    fidelities.push(fidelity)
  }

  const avgFidelity = fidelities.reduce((a, b) => a + b, 0) / samples

  const numQubits = circuit.getNumQubits()
  const haarAvg = 2 / (Math.pow(2, numQubits) + 1)

  return 1 - Math.abs(avgFidelity - haarAvg)
}

export function estimateEntanglingCapability(circuit: QMLCircuit): number {
  const numQubits = circuit.getNumQubits()
  const gates = circuit.getGates()

  let twoQubitGates = 0
  for (const gate of gates) {
    if (gate.qubits.length >= 2 || gate.type === 'CNOT' || gate.type === 'CX') {
      twoQubitGates++
    }
  }

  const maxEntangling = numQubits * (numQubits - 1) / 2
  return Math.min(1, twoQubitGates / maxEntangling)
}

export const ANSATZ_INFO: Record<AnsatzType, {
  name: string
  description: string
  recommended: boolean
  complexity: 'low' | 'medium' | 'high'
}> = {
  hea: {
    name: 'Hardware-Efficient Ansatz',
    description: 'General-purpose ansatz using hardware-native gates. Fast but may require more iterations.',
    recommended: false,
    complexity: 'low'
  },
  uccsd: {
    name: 'UCCSD',
    description: 'Unitary Coupled Cluster with Singles and Doubles. Chemistry-inspired, captures electron correlation.',
    recommended: true,
    complexity: 'high'
  },
  adapt: {
    name: 'ADAPT-VQE',
    description: 'Adaptive ansatz that grows dynamically based on gradient information. Balances accuracy and depth.',
    recommended: true,
    complexity: 'medium'
  },
  qubit_adapt: {
    name: 'Qubit-ADAPT',
    description: 'Hardware-efficient version of ADAPT using Pauli strings instead of fermionic operators.',
    recommended: true,
    complexity: 'medium'
  },
  symmetry_preserved: {
    name: 'Symmetry-Preserved',
    description: 'Ansatz that preserves particle number and spin symmetry. Reduces parameter space.',
    recommended: false,
    complexity: 'medium'
  },
  k_upccgsd: {
    name: 'k-UpCCGSD',
    description: 'k-fold Unitary Paired Coupled Cluster Generalized Singles and Doubles.',
    recommended: false,
    complexity: 'high'
  }
}
