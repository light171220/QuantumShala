import { Circuit } from '../../quantum-core'
import type { AnsatzConfig } from '../types'

export function buildExpressibleAnsatz(circuit: Circuit, config: AnsatzConfig): Circuit {
  const { layers, entanglement = 'full' } = config
  const numQubits = circuit.numQubits

  for (let layer = 0; layer < layers; layer++) {
    for (let q = 0; q < numQubits; q++) {
      circuit.paramRx(q)
      circuit.paramRy(q)
      circuit.paramRz(q)
    }

    applyEntanglement(circuit, numQubits, entanglement, layer)
  }

  for (let q = 0; q < numQubits; q++) {
    circuit.paramRx(q)
    circuit.paramRy(q)
    circuit.paramRz(q)
  }

  return circuit
}

function applyEntanglement(
  circuit: Circuit,
  numQubits: number,
  pattern: string,
  layer: number
): void {
  switch (pattern) {
    case 'full':
      for (let i = 0; i < numQubits; i++) {
        for (let j = i + 1; j < numQubits; j++) {
          circuit.cz(i, j)
        }
      }
      break
    case 'linear':
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cz(i, i + 1)
      }
      break
    case 'circular':
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cz(i, i + 1)
      }
      if (numQubits > 2) {
        circuit.cz(numQubits - 1, 0)
      }
      break
    case 'pairwise':
      const offset = layer % 2
      for (let i = offset; i < numQubits - 1; i += 2) {
        circuit.cz(i, i + 1)
      }
      break
    case 'sca':
      if (layer % 2 === 0) {
        for (let i = 0; i < numQubits - 1; i++) {
          circuit.cz(i, i + 1)
        }
      } else {
        for (let i = numQubits - 1; i > 0; i--) {
          circuit.cz(i, i - 1)
        }
      }
      break
  }
}
