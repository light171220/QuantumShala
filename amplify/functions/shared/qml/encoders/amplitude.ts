import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function amplitudeEncoding(
  circuit: Circuit,
  data: number[],
  _config: EncoderConfig
): Circuit {
  const numQubits = circuit.numQubits
  const stateSize = Math.pow(2, numQubits)

  const paddedData = new Array(stateSize).fill(0)
  for (let i = 0; i < Math.min(data.length, stateSize); i++) {
    paddedData[i] = data[i]
  }

  const norm = Math.sqrt(paddedData.reduce((sum, x) => sum + x * x, 0))
  if (norm > 1e-10) {
    for (let i = 0; i < stateSize; i++) {
      paddedData[i] /= norm
    }
  }

  buildAmplitudeCircuit(circuit, paddedData, 0, numQubits - 1)

  return circuit
}

function buildAmplitudeCircuit(
  circuit: Circuit,
  amplitudes: number[],
  startQubit: number,
  endQubit: number
): void {
  if (startQubit > endQubit) return

  const n = amplitudes.length
  if (n === 2) {
    const theta = 2 * Math.atan2(amplitudes[1], amplitudes[0])
    if (Math.abs(theta) > 1e-10) {
      circuit.ry(startQubit, theta)
    }
    return
  }

  const halfN = n / 2
  const leftAmps = amplitudes.slice(0, halfN)
  const rightAmps = amplitudes.slice(halfN)

  const leftNorm = Math.sqrt(leftAmps.reduce((s, x) => s + x * x, 0))
  const rightNorm = Math.sqrt(rightAmps.reduce((s, x) => s + x * x, 0))

  if (leftNorm > 1e-10 || rightNorm > 1e-10) {
    const theta = 2 * Math.atan2(rightNorm, leftNorm)
    if (Math.abs(theta) > 1e-10) {
      circuit.ry(startQubit, theta)
    }
  }

  if (leftNorm > 1e-10) {
    const normalizedLeft = leftAmps.map(x => x / leftNorm)
    buildAmplitudeCircuit(circuit, normalizedLeft, startQubit + 1, endQubit)
  }

  if (rightNorm > 1e-10) {
    circuit.x(startQubit)
    const normalizedRight = rightAmps.map(x => x / rightNorm)
    buildAmplitudeCircuit(circuit, normalizedRight, startQubit + 1, endQubit)
    circuit.x(startQubit)
  }
}
