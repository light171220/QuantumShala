import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function displacementEncoding(
  circuit: Circuit,
  data: number[],
  _config: EncoderConfig
): Circuit {
  const numQubits = circuit.numQubits

  for (let i = 0; i < numQubits; i++) {
    circuit.h(i)
  }

  for (let i = 0; i < Math.min(data.length, numQubits); i++) {
    const alpha = data[i]
    circuit.rx(i, 2 * alpha)
    circuit.rz(i, alpha * alpha)
  }

  for (let i = 0; i < numQubits - 1; i++) {
    if (i < data.length && i + 1 < data.length) {
      const coupling = data[i] * data[i + 1]
      circuit.rzz(i, i + 1, coupling)
    }
  }

  return circuit
}
