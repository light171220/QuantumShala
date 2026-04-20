import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { H, rz, cnot } from '../../circuit/operations/gates'

export interface ZZFeatureMapConfig {
  wires?: number[]
  numLayers?: number
  entanglement?: 'linear' | 'circular' | 'full' | 'sca' | [number, number][]
  alpha?: number
  insertBarriers?: boolean
}

export function zzFeatureMap(
  tape: QuantumTape,
  data: number[] | QTensor,
  config: ZZFeatureMapConfig = {}
): void {
  const numLayers = config.numLayers ?? 2
  const entanglement = config.entanglement ?? 'full'
  const alpha = config.alpha ?? 2.0

  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const wires = config.wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  if (wires.length < numFeatures) {
    throw new Error(`Not enough wires (${wires.length}) for features (${numFeatures})`)
  }

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numFeatures; i++) {
      H(tape, wires[i])
    }

    for (let i = 0; i < numFeatures; i++) {
      const phi = alpha * features[i]
      rz(tape, wires[i], phi)
    }

    const pairs = getEntanglementPairs(numFeatures, entanglement, layer)

    for (const [i, j] of pairs) {
      if (i >= numFeatures || j >= numFeatures) continue

      const phi = alpha * (Math.PI - features[i]) * (Math.PI - features[j])

      cnot(tape, wires[i], wires[j])
      rz(tape, wires[j], phi)
      cnot(tape, wires[i], wires[j])
    }
  }
}

function getEntanglementPairs(
  numQubits: number,
  entanglement: 'linear' | 'circular' | 'full' | 'sca' | [number, number][],
  layer: number
): [number, number][] {
  if (Array.isArray(entanglement)) {
    return entanglement
  }

  const pairs: [number, number][] = []

  switch (entanglement) {
    case 'linear':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      break

    case 'circular':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      if (numQubits > 2) {
        pairs.push([numQubits - 1, 0])
      }
      break

    case 'full':
      for (let i = 0; i < numQubits; i++) {
        for (let j = i + 1; j < numQubits; j++) {
          pairs.push([i, j])
        }
      }
      break

    case 'sca':
      const offset = layer % (numQubits - 1)
      for (let i = 0; i < numQubits - 1; i++) {
        const src = (i + offset) % numQubits
        const dst = (i + 1 + offset) % numQubits
        pairs.push([Math.min(src, dst), Math.max(src, dst)])
      }
      break
  }

  return pairs
}

export function firstOrderExpansion(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number = 2,
  wires?: number[]
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const effectiveWires = wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numFeatures; i++) {
      H(tape, effectiveWires[i])
    }

    for (let i = 0; i < numFeatures; i++) {
      rz(tape, effectiveWires[i], 2 * features[i])
    }
  }
}

export function secondOrderExpansion(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number = 2,
  wires?: number[]
): void {
  zzFeatureMap(tape, data, { numLayers, entanglement: 'full', wires })
}

export function zzFeatureMapLinear(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number = 2,
  wires?: number[]
): void {
  zzFeatureMap(tape, data, { numLayers, entanglement: 'linear', wires })
}

export function zzFeatureMapCircular(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number = 2,
  wires?: number[]
): void {
  zzFeatureMap(tape, data, { numLayers, entanglement: 'circular', wires })
}

export function zzFeatureMapFull(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number = 2,
  wires?: number[]
): void {
  zzFeatureMap(tape, data, { numLayers, entanglement: 'full', wires })
}

export function scaledZZFeatureMap(
  tape: QuantumTape,
  data: number[] | QTensor,
  scalingFactors: number[],
  numLayers: number = 2,
  wires?: number[]
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const scaledFeatures = features.map((f, i) => f * (scalingFactors[i] ?? 1.0))

  zzFeatureMap(tape, scaledFeatures, { numLayers, wires })
}

export function zzFeatureMapWithCustomFunction(
  tape: QuantumTape,
  data: number[] | QTensor,
  singleQubitFunc: (x: number) => number,
  twoQubitFunc: (x1: number, x2: number) => number,
  numLayers: number = 2,
  wires?: number[]
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const effectiveWires = wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numFeatures; i++) {
      H(tape, effectiveWires[i])
    }

    for (let i = 0; i < numFeatures; i++) {
      const phi = singleQubitFunc(features[i])
      rz(tape, effectiveWires[i], phi)
    }

    for (let i = 0; i < numFeatures; i++) {
      for (let j = i + 1; j < numFeatures; j++) {
        const phi = twoQubitFunc(features[i], features[j])

        cnot(tape, effectiveWires[i], effectiveWires[j])
        rz(tape, effectiveWires[j], phi)
        cnot(tape, effectiveWires[i], effectiveWires[j])
      }
    }
  }
}
