import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function angleEncoding(
  circuit: Circuit,
  data: number[],
  config: EncoderConfig
): Circuit {
  const rotation = config.rotation || 'Y'
  const numQubits = circuit.numQubits

  for (let i = 0; i < Math.min(data.length, numQubits); i++) {
    const angle = data[i] * Math.PI

    switch (rotation) {
      case 'X':
        circuit.rx(i, angle)
        break
      case 'Y':
        circuit.ry(i, angle)
        break
      case 'Z':
        circuit.rz(i, angle)
        break
    }
  }

  return circuit
}
