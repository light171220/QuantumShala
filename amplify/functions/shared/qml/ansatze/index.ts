import { Circuit } from '../../quantum-core'
import type { AnsatzConfig, AnsatzType } from '../types'

export { buildRealAmplitudes } from './real-amplitudes'
export { buildEfficientSU2 } from './efficient-su2'
export { buildTwoLocal } from './two-local'
export { buildTreeTensor } from './tree-tensor'
export { buildQCNNAnsatz } from './qcnn-ansatz'
export { buildExpressibleAnsatz } from './expressible-ansatz'

import { buildRealAmplitudes } from './real-amplitudes'
import { buildEfficientSU2 } from './efficient-su2'
import { buildTwoLocal } from './two-local'
import { buildTreeTensor } from './tree-tensor'
import { buildQCNNAnsatz } from './qcnn-ansatz'
import { buildExpressibleAnsatz } from './expressible-ansatz'

export function buildAnsatz(config: AnsatzConfig): Circuit {
  const circuit = new Circuit(config.numQubits)

  switch (config.type) {
    case 'real_amplitudes':
      return buildRealAmplitudes(circuit, config)
    case 'efficient_su2':
      return buildEfficientSU2(circuit, config)
    case 'two_local':
      return buildTwoLocal(circuit, config)
    case 'tree_tensor':
      return buildTreeTensor(circuit, config)
    case 'hea':
      return buildHEA(circuit, config)
    case 'qcnn_ansatz':
      return buildQCNNAnsatz(circuit, config)
    case 'expressible':
      return buildExpressibleAnsatz(circuit, config)
    default:
      return buildRealAmplitudes(circuit, config)
  }
}

function buildHEA(circuit: Circuit, config: AnsatzConfig): Circuit {
  const { layers, entanglement = 'linear' } = config
  const numQubits = circuit.numQubits

  for (let layer = 0; layer < layers; layer++) {
    for (let q = 0; q < numQubits; q++) {
      circuit.paramRy(q)
      circuit.paramRz(q)
    }

    applyEntanglement(circuit, numQubits, entanglement)
  }

  for (let q = 0; q < numQubits; q++) {
    circuit.paramRy(q)
    circuit.paramRz(q)
  }

  return circuit
}

function applyEntanglement(circuit: Circuit, numQubits: number, pattern: string): void {
  switch (pattern) {
    case 'linear':
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cnot(i, i + 1)
      }
      break
    case 'circular':
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cnot(i, i + 1)
      }
      if (numQubits > 2) {
        circuit.cnot(numQubits - 1, 0)
      }
      break
    case 'full':
      for (let i = 0; i < numQubits; i++) {
        for (let j = i + 1; j < numQubits; j++) {
          circuit.cnot(i, j)
        }
      }
      break
    case 'pairwise':
      for (let i = 0; i < numQubits - 1; i += 2) {
        circuit.cnot(i, i + 1)
      }
      for (let i = 1; i < numQubits - 1; i += 2) {
        circuit.cnot(i, i + 1)
      }
      break
    case 'sca':
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cnot(i, i + 1)
      }
      for (let i = numQubits - 1; i > 0; i--) {
        circuit.cnot(i, i - 1)
      }
      break
  }
}

export function getAnsatzInfo(type: AnsatzType): {
  name: string
  description: string
  expressibility: 'low' | 'medium' | 'high'
  trainability: 'low' | 'medium' | 'high'
} {
  const info: Record<AnsatzType, { name: string; description: string; expressibility: 'low' | 'medium' | 'high'; trainability: 'low' | 'medium' | 'high' }> = {
    real_amplitudes: {
      name: 'RealAmplitudes',
      description: 'Ry rotations with linear entanglement',
      expressibility: 'medium',
      trainability: 'high',
    },
    efficient_su2: {
      name: 'EfficientSU2',
      description: 'Ry-Rz rotations with configurable entanglement',
      expressibility: 'high',
      trainability: 'medium',
    },
    two_local: {
      name: 'TwoLocal',
      description: 'Configurable single and two-qubit gates',
      expressibility: 'high',
      trainability: 'medium',
    },
    tree_tensor: {
      name: 'TreeTensor',
      description: 'Hierarchical tree structure for efficient training',
      expressibility: 'medium',
      trainability: 'high',
    },
    hea: {
      name: 'Hardware Efficient',
      description: 'Native gate set with flexible entanglement',
      expressibility: 'high',
      trainability: 'low',
    },
    qcnn_ansatz: {
      name: 'QCNN Ansatz',
      description: 'Convolutional and pooling layers',
      expressibility: 'medium',
      trainability: 'high',
    },
    expressible: {
      name: 'Expressible',
      description: 'Maximally expressible circuit structure',
      expressibility: 'high',
      trainability: 'low',
    },
  }

  return info[type]
}

export function countParameters(config: AnsatzConfig): number {
  const { type, numQubits, layers } = config

  switch (type) {
    case 'real_amplitudes':
      return numQubits * (layers + 1)
    case 'efficient_su2':
      return 2 * numQubits * (layers + 1)
    case 'two_local':
      return 2 * numQubits * (layers + 1)
    case 'tree_tensor':
      return 2 * numQubits * layers
    case 'hea':
      return 2 * numQubits * (layers + 1)
    case 'qcnn_ansatz':
      return Math.floor(numQubits / 2) * 6 * Math.ceil(Math.log2(numQubits))
    case 'expressible':
      return 3 * numQubits * (layers + 1)
    default:
      return 2 * numQubits * (layers + 1)
  }
}
