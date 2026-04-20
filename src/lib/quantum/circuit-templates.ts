import type { CircuitGate, QuantumCircuit } from '@/types/simulator'
import { v4 as uuid } from 'uuid'

export interface CircuitTemplate {
  id: string
  name: string
  description: string
  category: 'basic' | 'entanglement' | 'algorithms' | 'error-correction'
  numQubits: number
  gates: Omit<CircuitGate, 'id'>[]
  icon: string
}

export const CIRCUIT_TEMPLATES: CircuitTemplate[] = [
  {
    id: 'bell-state',
    name: 'Bell State',
    description: 'Creates maximum entanglement between two qubits (|00⟩ + |11⟩)/√2',
    category: 'entanglement',
    numQubits: 2,
    icon: '🔔',
    gates: [
      { type: 'H', qubits: [0], position: 0, parameters: [] },
      { type: 'CNOT', qubits: [0, 1], position: 1, parameters: [], controlQubits: [0] },
    ],
  },
  {
    id: 'ghz-state',
    name: 'GHZ State',
    description: 'Greenberger–Horne–Zeilinger state: (|000⟩ + |111⟩)/√2',
    category: 'entanglement',
    numQubits: 3,
    icon: '🌐',
    gates: [
      { type: 'H', qubits: [0], position: 0, parameters: [] },
      { type: 'CNOT', qubits: [0, 1], position: 1, parameters: [], controlQubits: [0] },
      { type: 'CNOT', qubits: [1, 2], position: 2, parameters: [], controlQubits: [1] },
    ],
  },
  {
    id: 'w-state',
    name: 'W State',
    description: 'W state: (|001⟩ + |010⟩ + |100⟩)/√3',
    category: 'entanglement',
    numQubits: 3,
    icon: '🌊',
    gates: [
      { type: 'Ry', qubits: [0], position: 0, parameters: [1.9106] },
      { type: 'CNOT', qubits: [0, 1], position: 1, parameters: [], controlQubits: [0] },
      { type: 'Ry', qubits: [1], position: 2, parameters: [Math.PI / 4] },
      { type: 'CNOT', qubits: [1, 2], position: 3, parameters: [], controlQubits: [1] },
      { type: 'X', qubits: [0], position: 4, parameters: [] },
    ],
  },
  {
    id: 'superposition',
    name: 'Uniform Superposition',
    description: 'Creates equal superposition of all basis states',
    category: 'basic',
    numQubits: 3,
    icon: '✨',
    gates: [
      { type: 'H', qubits: [0], position: 0, parameters: [] },
      { type: 'H', qubits: [1], position: 0, parameters: [] },
      { type: 'H', qubits: [2], position: 0, parameters: [] },
    ],
  },
  {
    id: 'quantum-teleportation',
    name: 'Quantum Teleportation',
    description: 'Teleports quantum state from qubit 0 to qubit 2',
    category: 'algorithms',
    numQubits: 3,
    icon: '🚀',
    gates: [
      { type: 'H', qubits: [1], position: 0, parameters: [] },
      { type: 'CNOT', qubits: [1, 2], position: 1, parameters: [], controlQubits: [1] },
      { type: 'CNOT', qubits: [0, 1], position: 2, parameters: [], controlQubits: [0] },
      { type: 'H', qubits: [0], position: 3, parameters: [] },
      { type: 'CNOT', qubits: [1, 2], position: 4, parameters: [], controlQubits: [1] },
      { type: 'CZ', qubits: [0, 2], position: 5, parameters: [], controlQubits: [0] },
    ],
  },
  {
    id: 'qft-2qubit',
    name: 'QFT (2-qubit)',
    description: 'Quantum Fourier Transform on 2 qubits',
    category: 'algorithms',
    numQubits: 2,
    icon: '📊',
    gates: [
      { type: 'H', qubits: [0], position: 0, parameters: [] },
      { type: 'CRz', qubits: [1, 0], position: 1, parameters: [Math.PI / 2], controlQubits: [1] },
      { type: 'H', qubits: [1], position: 2, parameters: [] },
      { type: 'SWAP', qubits: [0, 1], position: 3, parameters: [] },
    ],
  },
  {
    id: 'qft-3qubit',
    name: 'QFT (3-qubit)',
    description: 'Quantum Fourier Transform on 3 qubits',
    category: 'algorithms',
    numQubits: 3,
    icon: '📊',
    gates: [
      { type: 'H', qubits: [0], position: 0, parameters: [] },
      { type: 'CRz', qubits: [1, 0], position: 1, parameters: [Math.PI / 2], controlQubits: [1] },
      { type: 'CRz', qubits: [2, 0], position: 2, parameters: [Math.PI / 4], controlQubits: [2] },
      { type: 'H', qubits: [1], position: 3, parameters: [] },
      { type: 'CRz', qubits: [2, 1], position: 4, parameters: [Math.PI / 2], controlQubits: [2] },
      { type: 'H', qubits: [2], position: 5, parameters: [] },
      { type: 'SWAP', qubits: [0, 2], position: 6, parameters: [] },
    ],
  },
  {
    id: 'grover-2qubit',
    name: 'Grover (2-qubit)',
    description: "Grover's search algorithm for 2 qubits (finds |11⟩)",
    category: 'algorithms',
    numQubits: 2,
    icon: '🔍',
    gates: [
      { type: 'H', qubits: [0], position: 0, parameters: [] },
      { type: 'H', qubits: [1], position: 0, parameters: [] },
      { type: 'CZ', qubits: [0, 1], position: 1, parameters: [], controlQubits: [0] },
      { type: 'H', qubits: [0], position: 2, parameters: [] },
      { type: 'H', qubits: [1], position: 2, parameters: [] },
      { type: 'X', qubits: [0], position: 3, parameters: [] },
      { type: 'X', qubits: [1], position: 3, parameters: [] },
      { type: 'CZ', qubits: [0, 1], position: 4, parameters: [], controlQubits: [0] },
      { type: 'X', qubits: [0], position: 5, parameters: [] },
      { type: 'X', qubits: [1], position: 5, parameters: [] },
      { type: 'H', qubits: [0], position: 6, parameters: [] },
      { type: 'H', qubits: [1], position: 6, parameters: [] },
    ],
  },
  {
    id: 'deutsch-jozsa',
    name: 'Deutsch-Jozsa',
    description: 'Determines if a function is constant or balanced',
    category: 'algorithms',
    numQubits: 3,
    icon: '⚖️',
    gates: [
      { type: 'X', qubits: [2], position: 0, parameters: [] },
      { type: 'H', qubits: [0], position: 1, parameters: [] },
      { type: 'H', qubits: [1], position: 1, parameters: [] },
      { type: 'H', qubits: [2], position: 1, parameters: [] },
      { type: 'CNOT', qubits: [0, 2], position: 2, parameters: [], controlQubits: [0] },
      { type: 'CNOT', qubits: [1, 2], position: 3, parameters: [], controlQubits: [1] },
      { type: 'H', qubits: [0], position: 4, parameters: [] },
      { type: 'H', qubits: [1], position: 4, parameters: [] },
    ],
  },
  {
    id: 'phase-estimation',
    name: 'Phase Estimation (simple)',
    description: 'Simple phase estimation circuit',
    category: 'algorithms',
    numQubits: 2,
    icon: '📐',
    gates: [
      { type: 'H', qubits: [0], position: 0, parameters: [] },
      { type: 'X', qubits: [1], position: 0, parameters: [] },
      { type: 'CRz', qubits: [0, 1], position: 1, parameters: [Math.PI / 4], controlQubits: [0] },
      { type: 'H', qubits: [0], position: 2, parameters: [] },
    ],
  },
  {
    id: 'bit-flip-code',
    name: 'Bit Flip Code',
    description: '3-qubit bit flip error correction code',
    category: 'error-correction',
    numQubits: 3,
    icon: '🛡️',
    gates: [
      { type: 'CNOT', qubits: [0, 1], position: 0, parameters: [], controlQubits: [0] },
      { type: 'CNOT', qubits: [0, 2], position: 1, parameters: [], controlQubits: [0] },
    ],
  },
  {
    id: 'phase-flip-code',
    name: 'Phase Flip Code',
    description: '3-qubit phase flip error correction code',
    category: 'error-correction',
    numQubits: 3,
    icon: '🔄',
    gates: [
      { type: 'CNOT', qubits: [0, 1], position: 0, parameters: [], controlQubits: [0] },
      { type: 'CNOT', qubits: [0, 2], position: 1, parameters: [], controlQubits: [0] },
      { type: 'H', qubits: [0], position: 2, parameters: [] },
      { type: 'H', qubits: [1], position: 2, parameters: [] },
      { type: 'H', qubits: [2], position: 2, parameters: [] },
    ],
  },
  {
    id: 'swap-test',
    name: 'SWAP Test',
    description: 'Tests similarity between two quantum states',
    category: 'algorithms',
    numQubits: 3,
    icon: '🔀',
    gates: [
      { type: 'H', qubits: [0], position: 0, parameters: [] },
      { type: 'Fredkin', qubits: [0, 1, 2], position: 1, parameters: [], controlQubits: [0] },
      { type: 'H', qubits: [0], position: 2, parameters: [] },
    ],
  },
  {
    id: 'toffoli-basic',
    name: 'Toffoli Gate Demo',
    description: 'Demonstrates the Toffoli (CCX) gate',
    category: 'basic',
    numQubits: 3,
    icon: '🎯',
    gates: [
      { type: 'X', qubits: [0], position: 0, parameters: [] },
      { type: 'X', qubits: [1], position: 0, parameters: [] },
      { type: 'Toffoli', qubits: [0, 1, 2], position: 1, parameters: [], controlQubits: [0, 1] },
    ],
  },
  {
    id: 'random-state',
    name: 'Random State',
    description: 'Creates a random quantum state',
    category: 'basic',
    numQubits: 2,
    icon: '🎲',
    gates: [
      { type: 'H', qubits: [0], position: 0, parameters: [] },
      { type: 'Ry', qubits: [1], position: 0, parameters: [Math.PI / 3] },
      { type: 'CNOT', qubits: [0, 1], position: 1, parameters: [], controlQubits: [0] },
      { type: 'Rz', qubits: [0], position: 2, parameters: [Math.PI / 5] },
      { type: 'T', qubits: [1], position: 2, parameters: [] },
    ],
  },
]

export function createCircuitFromTemplate(template: CircuitTemplate): QuantumCircuit {
  return {
    id: uuid(),
    name: template.name,
    numQubits: template.numQubits,
    gates: template.gates.map((gate) => ({
      ...gate,
      id: uuid(),
    })) as CircuitGate[],
    measurements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: false,
    likes: 0,
    tags: [template.category],
  }
}

export function getTemplatesByCategory(category: CircuitTemplate['category']): CircuitTemplate[] {
  return CIRCUIT_TEMPLATES.filter((t) => t.category === category)
}
