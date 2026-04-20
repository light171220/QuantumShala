import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function basisEncoding(
  circuit: Circuit,
  data: number[],
  _config: EncoderConfig
): Circuit {
  const numQubits = circuit.numQubits

  for (let i = 0; i < Math.min(data.length, numQubits); i++) {
    if (data[i] >= 0.5 || data[i] === 1) {
      circuit.x(i)
    }
  }

  return circuit
}
