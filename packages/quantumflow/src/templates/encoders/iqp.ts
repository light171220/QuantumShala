import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { H, rz, rzz } from '../../circuit/operations/gates'

export interface IQPEncodingConfig {
  wires?: number[]
  numLayers?: number
  pattern?: 'linear' | 'circular' | 'full'
  scaling?: number
}

export function iqpEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  config: IQPEncodingConfig = {}
): void {
  const numLayers = config.numLayers ?? 1
  const pattern = config.pattern ?? 'linear'
  const scaling = config.scaling ?? 1.0

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
      const angle = features[i] * scaling
      rz(tape, wires[i], angle)
    }

    const pairs = getEntanglementPairs(numFeatures, pattern)

    for (const [i, j] of pairs) {
      const angle = (Math.PI - features[i]) * (Math.PI - features[j]) * scaling
      rzz(tape, wires[i], wires[j], angle)
    }
  }
}

function getEntanglementPairs(
  numQubits: number,
  pattern: 'linear' | 'circular' | 'full'
): [number, number][] {
  const pairs: [number, number][] = []

  switch (pattern) {
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
  }

  return pairs
}

export function iqpEmbedding(
  tape: QuantumTape,
  data: number[] | QTensor,
  wires?: number[]
): void {
  iqpEncoding(tape, data, { wires, numLayers: 1, pattern: 'linear' })
}

export function deepIQPEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number,
  config: Omit<IQPEncodingConfig, 'numLayers'> = {}
): void {
  iqpEncoding(tape, data, { ...config, numLayers })
}

export function iqpWithCustomPairs(
  tape: QuantumTape,
  data: number[] | QTensor,
  entanglementPairs: [number, number][],
  config: Omit<IQPEncodingConfig, 'pattern'> = {}
): void {
  const numLayers = config.numLayers ?? 1
  const scaling = config.scaling ?? 1.0

  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const wires = config.wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numFeatures; i++) {
      H(tape, wires[i])
    }

    for (let i = 0; i < numFeatures; i++) {
      const angle = features[i] * scaling
      rz(tape, wires[i], angle)
    }

    for (const [i, j] of entanglementPairs) {
      if (i < numFeatures && j < numFeatures) {
        const angle = (Math.PI - features[i]) * (Math.PI - features[j]) * scaling
        rzz(tape, wires[i], wires[j], angle)
      }
    }
  }
}

export function sparseIQPEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  connectivity: number,
  config: Omit<IQPEncodingConfig, 'pattern'> = {}
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const pairs: [number, number][] = []

  for (let i = 0; i < numFeatures; i++) {
    for (let k = 1; k <= connectivity && i + k < numFeatures; k++) {
      pairs.push([i, i + k])
    }
  }

  iqpWithCustomPairs(tape, data, pairs, config)
}
