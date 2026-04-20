import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function qaoaEmbedding(
  circuit: Circuit,
  data: number[],
  config: EncoderConfig
): Circuit {
  const numQubits = circuit.numQubits
  const reps = config.reps || 1

  for (let i = 0; i < numQubits; i++) {
    circuit.h(i)
  }

  for (let r = 0; r < reps; r++) {
    for (let i = 0; i < Math.min(data.length, numQubits); i++) {
      circuit.rz(i, data[i])
    }

    for (let i = 0; i < numQubits - 1; i++) {
      if (i < data.length && i + 1 < data.length) {
        circuit.rzz(i, i + 1, data[i] * data[i + 1])
      }
    }

    for (let i = 0; i < numQubits; i++) {
      circuit.paramRx(i)
    }

    for (let i = 0; i < numQubits; i++) {
      circuit.paramRy(i)
    }
  }

  return circuit
}
