import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { rx, ry, rz, H, cnot } from '../../circuit/operations/gates'

export interface DisplacementEncodingConfig {
  wires?: number[]
  method?: 'phase' | 'amplitude' | 'hybrid'
  scaling?: number
  numLayers?: number
}

export function displacementEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  config: DisplacementEncodingConfig = {}
): void {
  const method = config.method ?? 'phase'
  const scaling = config.scaling ?? 1.0
  const numLayers = config.numLayers ?? 1

  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const wires = config.wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  switch (method) {
    case 'phase':
      phaseDisplacementEncoding(tape, features, wires, scaling, numLayers)
      break
    case 'amplitude':
      amplitudeDisplacementEncoding(tape, features, wires, scaling, numLayers)
      break
    case 'hybrid':
      hybridDisplacementEncoding(tape, features, wires, scaling, numLayers)
      break
  }
}

function phaseDisplacementEncoding(
  tape: QuantumTape,
  features: number[],
  wires: number[],
  scaling: number,
  numLayers: number
): void {
  const numFeatures = Math.min(features.length, wires.length)

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numFeatures; i++) {
      H(tape, wires[i])
    }

    for (let i = 0; i < numFeatures; i++) {
      const displacement = features[i] * scaling * (layer + 1)
      rz(tape, wires[i], displacement)
    }

    for (let i = 0; i < numFeatures; i++) {
      H(tape, wires[i])
    }
  }
}

function amplitudeDisplacementEncoding(
  tape: QuantumTape,
  features: number[],
  wires: number[],
  scaling: number,
  numLayers: number
): void {
  const numFeatures = Math.min(features.length, wires.length)

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numFeatures; i++) {
      const displacement = features[i] * scaling * (layer + 1)
      const theta = 2 * Math.atan(displacement)
      ry(tape, wires[i], theta)
    }

    if (layer < numLayers - 1) {
      for (let i = 0; i < numFeatures - 1; i++) {
        cnot(tape, wires[i], wires[i + 1])
      }
    }
  }
}

function hybridDisplacementEncoding(
  tape: QuantumTape,
  features: number[],
  wires: number[],
  scaling: number,
  numLayers: number
): void {
  const numFeatures = Math.min(features.length, wires.length)
  const halfFeatures = Math.ceil(numFeatures / 2)

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < halfFeatures; i++) {
      const displacement = features[i] * scaling
      ry(tape, wires[i], displacement)
    }

    for (let i = halfFeatures; i < numFeatures; i++) {
      H(tape, wires[i])
      const displacement = features[i] * scaling
      rz(tape, wires[i], displacement)
      H(tape, wires[i])
    }

    if (layer < numLayers - 1) {
      for (let i = 0; i < numFeatures - 1; i++) {
        cnot(tape, wires[i], wires[i + 1])
      }
    }
  }
}

export function squeezeDisplacement(
  tape: QuantumTape,
  data: number[] | QTensor,
  squeezing: number[] | number,
  wires?: number[]
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const effectiveWires = wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  const squeezingArray = typeof squeezing === 'number'
    ? new Array(numFeatures).fill(squeezing)
    : squeezing

  for (let i = 0; i < numFeatures; i++) {
    const r = squeezingArray[i] ?? 0
    const phi = features[i]

    rx(tape, effectiveWires[i], r)
    rz(tape, effectiveWires[i], phi)
    rx(tape, effectiveWires[i], -r)
  }
}

export function coherentStateEncoding(
  tape: QuantumTape,
  alpha: number[] | QTensor,
  wires?: number[]
): void {
  const amplitudes = alpha instanceof QTensor
    ? Array.from(alpha.data)
    : alpha

  const numFeatures = amplitudes.length
  const effectiveWires = wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  for (let i = 0; i < numFeatures; i++) {
    const magnitude = Math.abs(amplitudes[i])
    const phase = amplitudes[i] >= 0 ? 0 : Math.PI

    const theta = 2 * Math.atan(magnitude)
    ry(tape, effectiveWires[i], theta)
    rz(tape, effectiveWires[i], phase)
  }
}

export function catStateEncoding(
  tape: QuantumTape,
  alpha: number,
  wire: number
): void {
  const theta = 2 * Math.atan(Math.exp(-2 * alpha * alpha))

  H(tape, wire)
  ry(tape, wire, theta)
}
