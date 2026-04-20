import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { H, rx, ry, rz, rzz, cnot } from '../../circuit/operations/gates'

export interface QAOAEmbeddingConfig {
  wires?: number[]
  numLayers?: number
  localFields?: 'X' | 'Y' | 'Z'
  weights?: number[] | QTensor
}

export function qaoaEmbedding(
  tape: QuantumTape,
  data: number[] | QTensor,
  config: QAOAEmbeddingConfig = {}
): void {
  const numLayers = config.numLayers ?? 1
  const localFields = config.localFields ?? 'Y'

  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const wires = config.wires ?? Array.from({ length: numFeatures }, (_, i) => i)
  const numWires = wires.length

  const weights = config.weights
    ? (config.weights instanceof QTensor ? Array.from(config.weights.data) : config.weights)
    : []

  for (let i = 0; i < numWires; i++) {
    H(tape, wires[i])
  }

  let weightIdx = 0
  let featureIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numWires - 1; i++) {
      const gamma = features[featureIdx % numFeatures]
      featureIdx++

      rzz(tape, wires[i], wires[i + 1], gamma)
    }

    for (let i = 0; i < numWires; i++) {
      const beta = weights.length > 0 ? weights[weightIdx % weights.length] : Math.PI / 4
      weightIdx++

      switch (localFields) {
        case 'X':
          rx(tape, wires[i], beta)
          break
        case 'Y':
          ry(tape, wires[i], beta)
          break
        case 'Z':
          rz(tape, wires[i], beta)
          break
      }
    }
  }
}

export interface GraphEmbeddingConfig {
  wires?: number[]
  numLayers?: number
  edges: [number, number][]
  edgeWeights?: number[]
  mixerType?: 'X' | 'XY'
}

export function graphEmbedding(
  tape: QuantumTape,
  gammas: number[] | QTensor,
  betas: number[] | QTensor,
  config: GraphEmbeddingConfig
): void {
  const numLayers = config.numLayers ?? 1
  const edges = config.edges
  const edgeWeights = config.edgeWeights ?? edges.map(() => 1.0)
  const mixerType = config.mixerType ?? 'X'

  const gammaArray = gammas instanceof QTensor
    ? Array.from(gammas.data)
    : gammas

  const betaArray = betas instanceof QTensor
    ? Array.from(betas.data)
    : betas

  const maxNode = Math.max(...edges.flat()) + 1
  const wires = config.wires ?? Array.from({ length: maxNode }, (_, i) => i)
  const numWires = wires.length

  for (let i = 0; i < numWires; i++) {
    H(tape, wires[i])
  }

  for (let layer = 0; layer < numLayers; layer++) {
    const gamma = gammaArray[layer % gammaArray.length]

    for (let e = 0; e < edges.length; e++) {
      const [i, j] = edges[e]
      const weight = edgeWeights[e]
      rzz(tape, wires[i], wires[j], gamma * weight)
    }

    const beta = betaArray[layer % betaArray.length]

    if (mixerType === 'X') {
      for (let i = 0; i < numWires; i++) {
        rx(tape, wires[i], 2 * beta)
      }
    } else {
      for (let i = 0; i < numWires - 1; i++) {
        cnot(tape, wires[i], wires[i + 1])
        ry(tape, wires[i], beta)
        ry(tape, wires[i + 1], beta)
        cnot(tape, wires[i], wires[i + 1])
      }
    }
  }
}

export function maxCutEmbedding(
  tape: QuantumTape,
  edges: [number, number][],
  gammas: number[] | QTensor,
  betas: number[] | QTensor,
  wires?: number[]
): void {
  graphEmbedding(tape, gammas, betas, {
    wires,
    edges,
    numLayers: (gammas instanceof QTensor ? gammas.data : gammas).length,
    mixerType: 'X'
  })
}

export function weightedGraphEmbedding(
  tape: QuantumTape,
  edges: [number, number][],
  weights: number[],
  gammas: number[] | QTensor,
  betas: number[] | QTensor,
  wires?: number[]
): void {
  graphEmbedding(tape, gammas, betas, {
    wires,
    edges,
    edgeWeights: weights,
    numLayers: (gammas instanceof QTensor ? gammas.data : gammas).length,
    mixerType: 'X'
  })
}

export function isingEmbedding(
  tape: QuantumTape,
  couplings: number[] | QTensor,
  fields: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  const J = couplings instanceof QTensor
    ? Array.from(couplings.data)
    : couplings

  const h = fields instanceof QTensor
    ? Array.from(fields.data)
    : fields

  const numQubits = h.length
  const effectiveWires = wires ?? Array.from({ length: numQubits }, (_, i) => i)

  for (let i = 0; i < numQubits; i++) {
    H(tape, effectiveWires[i])
  }

  for (let layer = 0; layer < numLayers; layer++) {
    let couplingIdx = 0
    for (let i = 0; i < numQubits - 1; i++) {
      for (let j = i + 1; j < numQubits; j++) {
        const coupling = J[couplingIdx % J.length]
        couplingIdx++
        rzz(tape, effectiveWires[i], effectiveWires[j], coupling)
      }
    }

    for (let i = 0; i < numQubits; i++) {
      rx(tape, effectiveWires[i], h[i])
    }
  }
}

export function qaoaFeatureMap(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number = 2,
  wires?: number[]
): void {
  qaoaEmbedding(tape, data, {
    wires,
    numLayers,
    localFields: 'Y'
  })
}
