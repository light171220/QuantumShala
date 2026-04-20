import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function trainableEncoding(
  circuit: Circuit,
  data: number[],
  config: EncoderConfig
): Circuit {
  const numQubits = circuit.numQubits
  const entanglement = config.entanglement || 'linear'

  for (let i = 0; i < numQubits; i++) {
    circuit.paramRy(i)
  }

  for (let i = 0; i < Math.min(data.length, numQubits); i++) {
    circuit.ry(i, data[i] * Math.PI)
  }

  for (let i = 0; i < numQubits; i++) {
    circuit.paramRz(i)
  }

  applyEntanglement(circuit, numQubits, entanglement)

  for (let i = 0; i < numQubits; i++) {
    circuit.paramRy(i)
  }

  for (let i = 0; i < Math.min(data.length, numQubits); i++) {
    circuit.rz(i, data[i] * Math.PI)
  }

  for (let i = 0; i < numQubits; i++) {
    circuit.paramRz(i)
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
      break
    default:
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cnot(i, i + 1)
      }
  }
}
