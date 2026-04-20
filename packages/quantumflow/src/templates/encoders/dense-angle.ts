import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { rx, ry, rz, H } from '../../circuit/operations/gates'

export interface DenseAngleEncodingConfig {
  wires?: number[]
  rotations?: ('X' | 'Y' | 'Z')[]
  scaling?: number
}

export function denseAngleEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  config: DenseAngleEncodingConfig = {}
): void {
  const rotations = config.rotations ?? ['Y', 'Z']
  const scaling = config.scaling ?? 1.0

  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const featuresPerQubit = rotations.length
  const numQubits = Math.ceil(numFeatures / featuresPerQubit)
  const wires = config.wires ?? Array.from({ length: numQubits }, (_, i) => i)

  if (wires.length < numQubits) {
    throw new Error(`Not enough wires (${wires.length}) for ${numQubits} qubits`)
  }

  let featureIdx = 0

  for (let qubit = 0; qubit < numQubits; qubit++) {
    for (const rot of rotations) {
      if (featureIdx >= numFeatures) break

      const angle = features[featureIdx] * scaling
      const wire = wires[qubit]

      switch (rot) {
        case 'X':
          rx(tape, wire, angle)
          break
        case 'Y':
          ry(tape, wire, angle)
          break
        case 'Z':
          rz(tape, wire, angle)
          break
      }

      featureIdx++
    }
  }
}

export function doubleDenseEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  wires?: number[]
): void {
  denseAngleEncoding(tape, data, { wires, rotations: ['Y', 'Z'] })
}

export function tripleDenseEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  wires?: number[]
): void {
  denseAngleEncoding(tape, data, { wires, rotations: ['X', 'Y', 'Z'] })
}

export function layeredDenseEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number,
  config: DenseAngleEncodingConfig = {}
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const rotations = config.rotations ?? ['Y', 'Z']
  const featuresPerQubit = rotations.length
  const numQubits = Math.ceil(features.length / (featuresPerQubit * numLayers))
  const wires = config.wires ?? Array.from({ length: numQubits }, (_, i) => i)

  let featureIdx = 0
  const scaling = config.scaling ?? 1.0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let qubit = 0; qubit < numQubits; qubit++) {
      for (const rot of rotations) {
        if (featureIdx >= features.length) break

        const angle = features[featureIdx] * scaling
        const wire = wires[qubit]

        switch (rot) {
          case 'X':
            rx(tape, wire, angle)
            break
          case 'Y':
            ry(tape, wire, angle)
            break
          case 'Z':
            rz(tape, wire, angle)
            break
        }

        featureIdx++
      }
    }
  }
}

export function superDenseEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  wires?: number[]
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numQubits = Math.ceil(features.length / 3)
  const effectiveWires = wires ?? Array.from({ length: numQubits }, (_, i) => i)

  for (let i = 0; i < numQubits; i++) {
    H(tape, effectiveWires[i])
  }

  tripleDenseEncoding(tape, data, effectiveWires)
}

export function computeRequiredQubits(
  numFeatures: number,
  rotationsPerQubit: number = 2
): number {
  return Math.ceil(numFeatures / rotationsPerQubit)
}
