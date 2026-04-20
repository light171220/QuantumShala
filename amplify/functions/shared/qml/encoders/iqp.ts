import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function iqpEncoding(
  circuit: Circuit,
  data: number[],
  config: EncoderConfig
): Circuit {
  const numQubits = circuit.numQubits
  const entanglement = config.entanglement || 'linear'

  for (let i = 0; i < numQubits; i++) {
    circuit.h(i)
  }

  for (let i = 0; i < Math.min(data.length, numQubits); i++) {
    circuit.rz(i, data[i] * 2)
  }

  const pairs = getEntanglementPairs(numQubits, entanglement)
  for (const [i, j] of pairs) {
    if (i < data.length && j < data.length) {
      const phi = (Math.PI - data[i]) * (Math.PI - data[j])
      circuit.cnot(i, j)
      circuit.rz(j, 2 * phi)
      circuit.cnot(i, j)
    }
  }

  return circuit
}

function getEntanglementPairs(
  numQubits: number,
  pattern: string
): [number, number][] {
  const pairs: [number, number][] = []

  switch (pattern) {
    case 'linear':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      break
    case 'circular':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      if (numQubits > 2) {
        pairs.push([numQubits - 1, 0])
      }
      break
    case 'full':
      for (let i = 0; i < numQubits; i++) {
        for (let j = i + 1; j < numQubits; j++) {
          pairs.push([i, j])
        }
      }
      break
    default:
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
  }

  return pairs
}
