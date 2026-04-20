import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function dataReuploadingEncoding(
  circuit: Circuit,
  data: number[],
  config: EncoderConfig
): Circuit {
  const numQubits = circuit.numQubits
  const reps = config.reps || 1

  for (let r = 0; r < reps; r++) {
    for (let i = 0; i < numQubits; i++) {
      const featureIdx = i % data.length
      circuit.ry(i, data[featureIdx] * Math.PI)
    }

    for (let i = 0; i < numQubits; i++) {
      circuit.paramRy(i)
      circuit.paramRz(i)
    }

    if (r < reps - 1) {
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cnot(i, i + 1)
      }
    }
  }

  return circuit
}
