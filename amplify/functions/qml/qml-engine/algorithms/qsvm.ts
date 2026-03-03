import type { QMLRequest, QMLResponse, ClassificationResult, TrainingHistory } from '../../../shared/qml/types'
import { loadDataset } from '../../../shared/qml/datasets'
import { preprocessForQML } from '../../../shared/qml/datasets/preprocessing'
import { FidelityKernel, ProjectedKernel, TrainableKernel } from '../../../shared/qml/kernels'
import { createOptimizer } from '../../../shared/optimizers'

export async function runQSVM(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    datasetId,
    customData,
    trainTestSplit = 0.8,
    encoderType = 'zz_feature',
    encoderConfig = {},
    kernelConfig,
    optimizerType = 'cobyla',
    optimizerConfig = {},
  } = request

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
    scaleToRange: [0, Math.PI],
  })

  const yTrainBinary = yTrain.map(label => label === 0 ? -1 : 1)
  const yTestBinary = yTest.map(label => label === 0 ? -1 : 1)

  const fullEncoderConfig = {
    type: encoderType,
    numQubits,
    ...encoderConfig,
  }

  const kernelType = kernelConfig?.type || 'fidelity'
  let kernel: FidelityKernel | ProjectedKernel

  if (kernelType === 'projected') {
    kernel = new ProjectedKernel(
      numQubits,
      fullEncoderConfig,
      kernelConfig?.projectionDim || 10
    )
  } else {
    kernel = new FidelityKernel(numQubits, fullEncoderConfig)
  }

  const K = kernel.computeMatrix(XTrain)

  const C = (optimizerConfig as any).regularization || 1.0
  const { alphas, b } = trainSVM(K, yTrainBinary, C)

  const computeKernelRow = (x: number[]): number[] => {
    return XTrain.map(xi => kernel.compute(x, xi))
  }

  const predict = (x: number[]): number => {
    const kRow = computeKernelRow(x)
    let sum = -b
    for (let i = 0; i < alphas.length; i++) {
      sum += alphas[i] * yTrainBinary[i] * kRow[i]
    }
    return sum >= 0 ? 1 : -1
  }

  const trainPredictions = XTrain.map(x => predict(x) === 1 ? 1 : 0)
  const testPredictions = XTest.map(x => predict(x) === 1 ? 1 : 0)

  const trainAccuracy = computeAccuracy(trainPredictions, yTrain)
  const testAccuracy = computeAccuracy(testPredictions, yTest)

  const history: TrainingHistory[] = [
    { iteration: 0, loss: 1 - trainAccuracy, accuracy: trainAccuracy },
  ]

  const result: ClassificationResult = {
    accuracy: testAccuracy,
    trainAccuracy,
    loss: 1 - testAccuracy,
    parameters: alphas,
    predictions: testPredictions,
    history,
  }

  return {
    result,
    metrics: {
      depth: numQubits * 2,
      gateCount: numQubits * 4,
      cnotCount: numQubits - 1,
      parameterCount: alphas.length,
      numQubits,
      executionTimeMs: 0,
    },
  }
}

function trainSVM(K: number[][], y: number[], C: number, maxIter: number = 100): { alphas: number[], b: number } {
  const n = y.length
  const alphas = new Array(n).fill(0)
  let b = 0

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = 0

    for (let i = 0; i < n; i++) {
      let fi = -b
      for (let j = 0; j < n; j++) {
        fi += alphas[j] * y[j] * K[i][j]
      }

      const Ei = fi - y[i]

      if ((y[i] * Ei < -0.001 && alphas[i] < C) || (y[i] * Ei > 0.001 && alphas[i] > 0)) {
        let j = Math.floor(Math.random() * n)
        while (j === i) j = Math.floor(Math.random() * n)

        let fj = -b
        for (let k = 0; k < n; k++) {
          fj += alphas[k] * y[k] * K[j][k]
        }
        const Ej = fj - y[j]

        const eta = 2 * K[i][j] - K[i][i] - K[j][j]
        if (eta >= 0) continue

        const oldAlphaJ = alphas[j]
        alphas[j] -= (y[j] * (Ei - Ej)) / eta

        let L: number, H: number
        if (y[i] !== y[j]) {
          L = Math.max(0, alphas[j] - alphas[i])
          H = Math.min(C, C + alphas[j] - alphas[i])
        } else {
          L = Math.max(0, alphas[i] + alphas[j] - C)
          H = Math.min(C, alphas[i] + alphas[j])
        }

        alphas[j] = Math.max(L, Math.min(H, alphas[j]))

        if (Math.abs(alphas[j] - oldAlphaJ) < 1e-5) continue

        const oldAlphaI = alphas[i]
        alphas[i] += y[i] * y[j] * (oldAlphaJ - alphas[j])

        const b1 = b - Ei - y[i] * (alphas[i] - oldAlphaI) * K[i][i] - y[j] * (alphas[j] - oldAlphaJ) * K[i][j]
        const b2 = b - Ej - y[i] * (alphas[i] - oldAlphaI) * K[i][j] - y[j] * (alphas[j] - oldAlphaJ) * K[j][j]

        if (alphas[i] > 0 && alphas[i] < C) {
          b = b1
        } else if (alphas[j] > 0 && alphas[j] < C) {
          b = b2
        } else {
          b = (b1 + b2) / 2
        }

        changed++
      }
    }

    if (changed === 0) break
  }

  return { alphas, b }
}

function computeAccuracy(predictions: number[], labels: number[]): number {
  let correct = 0
  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i] === labels[i]) correct++
  }
  return correct / predictions.length
}
