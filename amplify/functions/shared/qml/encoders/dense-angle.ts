import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function denseAngleEncoding(
  circuit: Circuit,
  data: number[],
  _config: EncoderConfig
): Circuit {
  const numQubits = circuit.numQubits

  for (let i = 0; i < numQubits; i++) {
    const idx1 = 2 * i
    const idx2 = 2 * i + 1

    if (idx1 < data.length) {
      circuit.ry(i, data[idx1] * Math.PI)
    }
    if (idx2 < data.length) {
      circuit.rz(i, data[idx2] * Math.PI)
    }
  }

  return circuit
}
