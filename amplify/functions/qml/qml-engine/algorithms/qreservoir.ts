import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import type { QMLRequest, QMLResponse, ClassificationResult, TrainingHistory } from '../../../shared/qml/types'
import { loadDataset } from '../../../shared/qml/datasets'
import { preprocessForQML } from '../../../shared/qml/datasets/preprocessing'

export async function runQReservoir(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    datasetId,
    customData,
    trainTestSplit = 0.8,
    qreservoirConfig,
  } = request

  const reservoirSize = qreservoirConfig?.reservoirSize || numQubits
  const inputScaling = qreservoirConfig?.inputScaling || 1.0
  const spectralRadius = qreservoirConfig?.spectralRadius || 0.9
  const leakingRate = qreservoirConfig?.leakingRate || 0.3
  const readoutRegularization = qreservoirConfig?.readoutRegularization || 1e-6

  let X: number[][]
  let y: number[]

  if (customData) {
    X = customData.X
    y = customData.y
  } else if (datasetId) {
    const dataset = await loadDataset(datasetId)
    X = dataset.X
    y = dataset.y
  } else {
    throw new Error('Either datasetId or customData must be provided')
  }

  const { XTrain, yTrain, XTest, yTest } = preprocessForQML(X, y, {
    normalization: 'minmax',
    trainRatio: trainTestSplit,
    scaleToRange: [0, 1],
  })

  const numClasses = Math.max(...y) + 1
  const numObservables = numQubits * 3

  const reservoirParams = generateReservoirParameters(numQubits, spectralRadius)

  const buildReservoirCircuit = (input: number[]): Circuit => {
    const circuit = new Circuit(numQubits)

    for (let q = 0; q < numQubits; q++) {
      const inputIdx = q % input.length
      circuit.ry(q, input[inputIdx] * inputScaling * Math.PI)
    }

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, reservoirParams.rotations[q * 2])
      circuit.rz(q, reservoirParams.rotations[q * 2 + 1])
    }

    for (const [ctrl, tgt, angle] of reservoirParams.entanglement) {
      if (ctrl < numQubits && tgt < numQubits) {
        circuit.cnot(ctrl, tgt)
        circuit.rz(tgt, angle)
      }
    }

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, reservoirParams.rotations[numQubits * 2 + q * 2])
      circuit.rz(q, reservoirParams.rotations[numQubits * 2 + q * 2 + 1])
    }

    return circuit
  }

  const getReservoirFeatures = (input: number[]): number[] => {
    const circuit = buildReservoirCircuit(input)
    const state = executeCircuit(circuit)

    const features: number[] = []

    for (let q = 0; q < numQubits; q++) {
      let expZ = 0
      for (let i = 0; i < Math.pow(2, numQubits); i++) {
        const bit = (i >> q) & 1
        const sign = bit === 0 ? 1 : -1
        expZ += sign * state.getProbability(i)
      }
      features.push(expZ)
    }

    for (let q = 0; q < numQubits; q++) {
      features.push(state.getProbability(1 << q))
    }

    for (let q = 0; q < numQubits - 1; q++) {
      let expZZ = 0
      for (let i = 0; i < Math.pow(2, numQubits); i++) {
        const bit1 = (i >> q) & 1
        const bit2 = (i >> (q + 1)) & 1
        const sign = (bit1 ^ bit2) === 0 ? 1 : -1
        expZZ += sign * state.getProbability(i)
      }
      features.push(expZZ)
    }

    return features
  }

  const trainFeatures: number[][] = XTrain.map(x => getReservoirFeatures(x))
  const testFeatures: number[][] = XTest.map(x => getReservoirFeatures(x))

  const yTrainOneHot: number[][] = yTrain.map(label => {
    const oneHot = new Array(numClasses).fill(0)
    oneHot[label] = 1
    return oneHot
  })

  const featureDim = trainFeatures[0].length
  const readoutWeights = trainReadout(
    trainFeatures,
    yTrainOneHot,
    featureDim,
    numClasses,
    readoutRegularization
  )

  const predict = (features: number[]): number => {
    const outputs: number[] = []
    for (let c = 0; c < numClasses; c++) {
      let sum = readoutWeights[c][featureDim]
      for (let f = 0; f < featureDim; f++) {
        sum += features[f] * readoutWeights[c][f]
      }
      outputs.push(sum)
    }
    return outputs.indexOf(Math.max(...outputs))
  }

  const trainPredictions = trainFeatures.map(f => predict(f))
  const testPredictions = testFeatures.map(f => predict(f))

  const computeAccuracy = (predictions: number[], labels: number[]): number => {
    let correct = 0
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === labels[i]) correct++
    }
    return correct / predictions.length
  }

  const trainAccuracy = computeAccuracy(trainPredictions, yTrain)
  const testAccuracy = computeAccuracy(testPredictions, yTest)

  const history: TrainingHistory[] = [
    { iteration: 0, loss: 1 - trainAccuracy, accuracy: trainAccuracy },
  ]

  const result: ClassificationResult = {
    accuracy: testAccuracy,
    trainAccuracy,
    loss: 1 - testAccuracy,
    parameters: readoutWeights.flat(),
    predictions: testPredictions,
    history,
  }

  return {
    result,
    metrics: {
      depth: 4,
      gateCount: numQubits * 4 + reservoirParams.entanglement.length * 2,
      cnotCount: reservoirParams.entanglement.length,
      parameterCount: (featureDim + 1) * numClasses,
      numQubits,
      executionTimeMs: 0,
    },
  }
}

function generateReservoirParameters(numQubits: number, spectralRadius: number): {
  rotations: number[]
  entanglement: [number, number, number][]
} {
  const rotations: number[] = []
  for (let i = 0; i < numQubits * 4; i++) {
    rotations.push(Math.random() * 2 * Math.PI * spectralRadius)
  }

  const entanglement: [number, number, number][] = []
  for (let q = 0; q < numQubits - 1; q++) {
    entanglement.push([q, q + 1, Math.random() * Math.PI * spectralRadius])
  }
  if (numQubits > 2) {
    entanglement.push([numQubits - 1, 0, Math.random() * Math.PI * spectralRadius])
  }

  return { rotations, entanglement }
}

function trainReadout(
  features: number[][],
  targets: number[][],
  featureDim: number,
  numClasses: number,
  regularization: number
): number[][] {
  const n = features.length

  const X: number[][] = features.map(f => [...f, 1])

  const XTX: number[][] = Array.from({ length: featureDim + 1 }, () =>
    Array(featureDim + 1).fill(0)
  )

  for (let i = 0; i < featureDim + 1; i++) {
    for (let j = 0; j < featureDim + 1; j++) {
      for (let k = 0; k < n; k++) {
        XTX[i][j] += X[k][i] * X[k][j]
      }
    }
    XTX[i][i] += regularization
  }

  const XTy: number[][] = Array.from({ length: featureDim + 1 }, () =>
    Array(numClasses).fill(0)
  )

  for (let i = 0; i < featureDim + 1; i++) {
    for (let c = 0; c < numClasses; c++) {
      for (let k = 0; k < n; k++) {
        XTy[i][c] += X[k][i] * targets[k][c]
      }
    }
  }

  const XTXInv = invertMatrix(XTX)

  const weights: number[][] = Array.from({ length: numClasses }, () =>
    Array(featureDim + 1).fill(0)
  )

  for (let c = 0; c < numClasses; c++) {
    for (let i = 0; i < featureDim + 1; i++) {
      for (let j = 0; j < featureDim + 1; j++) {
        weights[c][i] += XTXInv[i][j] * XTy[j][c]
      }
    }
  }

  return weights
}

function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length
  const augmented: number[][] = matrix.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0)),
  ])

  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]

    const pivot = augmented[i][i]
    if (Math.abs(pivot) < 1e-10) continue

    for (let j = 0; j < 2 * n; j++) {
      augmented[i][j] /= pivot
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = augmented[k][i]
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j]
        }
      }
    }
  }

  return augmented.map(row => row.slice(n))
}
