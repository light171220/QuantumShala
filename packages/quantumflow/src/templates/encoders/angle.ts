import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { rx, ry, rz, H } from '../../circuit/operations/gates'

export type AngleEncodingRotation = 'X' | 'Y' | 'Z'

export interface AngleEncodingConfig {
  rotation?: AngleEncodingRotation
  wires?: number[]
  scaling?: number
  hadamardFirst?: boolean
}

export function angleEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  config: AngleEncodingConfig = {}
): void {
  const rotation = config.rotation ?? 'Y'
  const scaling = config.scaling ?? 1.0
  const hadamardFirst = config.hadamardFirst ?? false

  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const wires = config.wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  if (wires.length < numFeatures) {
    throw new Error(`Not enough wires (${wires.length}) for features (${numFeatures})`)
  }

  for (let i = 0; i < numFeatures; i++) {
    const wire = wires[i]
    const angle = features[i] * scaling

    if (hadamardFirst) {
      H(tape, wire)
    }

    switch (rotation) {
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
  }
}

export function multiAngleEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number,
  config: AngleEncodingConfig = {}
): void {
  for (let layer = 0; layer < numLayers; layer++) {
    angleEncoding(tape, data, config)
  }
}

export function rxEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  wires?: number[]
): void {
  angleEncoding(tape, data, { rotation: 'X', wires })
}

export function ryEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  wires?: number[]
): void {
  angleEncoding(tape, data, { rotation: 'Y', wires })
}

export function rzEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  wires?: number[]
): void {
  angleEncoding(tape, data, { rotation: 'Z', wires })
}
