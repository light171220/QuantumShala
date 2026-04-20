import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { rx, ry, rz, H, cnot, cz } from '../../circuit/operations/gates'

export interface DataReuploadingConfig {
  wires?: number[]
  numLayers: number
  entanglement?: 'linear' | 'circular' | 'full' | 'none'
  rotations?: ('X' | 'Y' | 'Z')[]
  parameterSharing?: boolean
}

export function dataReuploading(
  tape: QuantumTape,
  data: number[] | QTensor,
  trainableParams: number[] | QTensor,
  config: DataReuploadingConfig
): void {
  const numLayers = config.numLayers
  const entanglement = config.entanglement ?? 'linear'
  const rotations = config.rotations ?? ['Y', 'Z']

  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const params = trainableParams instanceof QTensor
    ? Array.from(trainableParams.data)
    : trainableParams

  const numFeatures = features.length
  const wires = config.wires ?? Array.from({ length: numFeatures }, (_, i) => i)
  const numWires = wires.length

  let paramIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numWires; i++) {
      const wire = wires[i]

      for (const rot of rotations) {
        const featureIdx = i % numFeatures
        const angle = features[featureIdx] + (params[paramIdx % params.length] ?? 0)
        paramIdx++

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
      }
    }

    if (entanglement !== 'none') {
      applyEntanglement(tape, wires, entanglement)
    }
  }
}

function applyEntanglement(
  tape: QuantumTape,
  wires: number[],
  pattern: 'linear' | 'circular' | 'full'
): void {
  const numWires = wires.length

  switch (pattern) {
    case 'linear':
      for (let i = 0; i < numWires - 1; i++) {
        cnot(tape, wires[i], wires[i + 1])
      }
      break

    case 'circular':
      for (let i = 0; i < numWires - 1; i++) {
        cnot(tape, wires[i], wires[i + 1])
      }
      if (numWires > 2) {
        cnot(tape, wires[numWires - 1], wires[0])
      }
      break

    case 'full':
      for (let i = 0; i < numWires; i++) {
        for (let j = i + 1; j < numWires; j++) {
          cz(tape, wires[i], wires[j])
        }
      }
      break
  }
}

export function universalDataReuploading(
  tape: QuantumTape,
  data: number[] | QTensor,
  weights: number[][] | QTensor,
  numLayers: number,
  wires?: number[]
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  let weightMatrix: number[][]
  if (weights instanceof QTensor) {
    const flatWeights = Array.from(weights.data)
    const numFeatures = features.length
    weightMatrix = []
    for (let i = 0; i < numLayers; i++) {
      weightMatrix.push(flatWeights.slice(i * numFeatures * 3, (i + 1) * numFeatures * 3))
    }
  } else {
    weightMatrix = weights
  }

  const numFeatures = features.length
  const effectiveWires = wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  for (let layer = 0; layer < numLayers; layer++) {
    const layerWeights = weightMatrix[layer] ?? []

    for (let i = 0; i < numFeatures; i++) {
      const wire = effectiveWires[i]

      const w0 = layerWeights[i * 3] ?? 0
      const w1 = layerWeights[i * 3 + 1] ?? 0
      const w2 = layerWeights[i * 3 + 2] ?? 0

      rx(tape, wire, features[i] * w0)
      ry(tape, wire, features[i] * w1)
      rz(tape, wire, features[i] * w2)
    }

    if (layer < numLayers - 1) {
      for (let i = 0; i < numFeatures - 1; i++) {
        cnot(tape, effectiveWires[i], effectiveWires[i + 1])
      }
    }
  }
}

export function singleQubitDataReuploading(
  tape: QuantumTape,
  data: number[] | QTensor,
  trainableParams: number[] | QTensor,
  numLayers: number,
  wire: number = 0
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const params = trainableParams instanceof QTensor
    ? Array.from(trainableParams.data)
    : trainableParams

  let paramIdx = 0
  let featureIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    const dataAngle = features[featureIdx % features.length]
    featureIdx++

    const param1 = params[paramIdx % params.length] ?? 0
    paramIdx++
    const param2 = params[paramIdx % params.length] ?? 0
    paramIdx++
    const param3 = params[paramIdx % params.length] ?? 0
    paramIdx++

    rx(tape, wire, dataAngle + param1)
    ry(tape, wire, param2)
    rz(tape, wire, param3)
  }
}

export function parallelDataReuploading(
  tape: QuantumTape,
  dataPoints: number[][],
  trainableParams: number[] | QTensor,
  numLayers: number,
  config: Omit<DataReuploadingConfig, 'numLayers'> = {}
): void {
  const entanglement = config.entanglement ?? 'none'
  const params = trainableParams instanceof QTensor
    ? Array.from(trainableParams.data)
    : trainableParams

  const numDataPoints = dataPoints.length
  const numFeaturesPerPoint = dataPoints[0]?.length ?? 0
  const totalWires = numDataPoints * numFeaturesPerPoint
  const wires = config.wires ?? Array.from({ length: totalWires }, (_, i) => i)

  let paramIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let d = 0; d < numDataPoints; d++) {
      const dataPoint = dataPoints[d]
      const wireOffset = d * numFeaturesPerPoint

      for (let i = 0; i < numFeaturesPerPoint; i++) {
        const wire = wires[wireOffset + i]
        const angle = dataPoint[i] + (params[paramIdx % params.length] ?? 0)
        paramIdx++

        ry(tape, wire, angle)
      }
    }

    if (entanglement !== 'none' && layer < numLayers - 1) {
      applyEntanglement(tape, wires, entanglement)
    }
  }
}

export function getRequiredParams(
  numWires: number,
  numLayers: number,
  rotationsPerQubit: number = 2
): number {
  return numWires * numLayers * rotationsPerQubit
}
