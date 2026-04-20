import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import { createOptimizer } from '../../../shared/optimizers'
import type { QMLRequest, QMLResponse, ClassificationResult, TrainingHistory } from '../../../shared/qml/types'
import { encode, getRequiredQubits } from '../../../shared/qml/encoders'
import { buildAnsatz } from '../../../shared/qml/ansatze'
import { loadDataset } from '../../../shared/qml/datasets'
import { preprocessForQML } from '../../../shared/qml/datasets/preprocessing'

export async function runVQC(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    datasetId,
    customData,
    trainTestSplit = 0.8,
    encoderType = 'angle',
    encoderConfig = {},
    ansatzType = 'real_amplitudes',
    ansatzConfig = {},
    optimizerType = 'adam',
    optimizerConfig = {},
    shots,
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

  const numClasses = Math.max(...y) + 1
  const numFeatures = X[0].length

  const fullEncoderConfig = {
    type: encoderType,
    numQubits,
    ...encoderConfig,
  }

  const fullAnsatzConfig = {
    type: ansatzType,
    numQubits,
    layers: ansatzConfig.layers || 2,
    entanglement: ansatzConfig.entanglement || 'linear',
    ...ansatzConfig,
  }

  const circuit = buildAnsatz(fullAnsatzConfig)
  const numParams = circuit.getParameterCount()

  let parameters = Array(numParams).fill(0).map(() => (Math.random() - 0.5) * 0.1)

  const history: TrainingHistory[] = []

  const computePredictions = (params: number[], data: number[][]): number[] => {
    const predictions: number[] = []

    for (const sample of data) {
      const sampleCircuit = new Circuit(numQubits)
      encode(sampleCircuit, sample, fullEncoderConfig)

      for (const gate of circuit.gates) {
        sampleCircuit.gates.push({ ...gate, params: gate.params ? [...gate.params] : undefined })
      }

      sampleCircuit.setParameters(params)
      const state = executeCircuit(sampleCircuit)

      const probs: number[] = []
      for (let c = 0; c < numClasses; c++) {
        let classProb = 0
        for (let i = 0; i < Math.pow(2, numQubits); i++) {
          if (i % numClasses === c) {
            classProb += state.getProbability(i)
          }
        }
        probs.push(classProb)
      }

      predictions.push(probs.indexOf(Math.max(...probs)))
    }

    return predictions
  }

  const computeAccuracy = (predictions: number[], labels: number[]): number => {
    let correct = 0
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === labels[i]) correct++
    }
    return correct / predictions.length
  }

  const costFunction = (params: number[]): number => {
    let totalLoss = 0

    for (let i = 0; i < XTrain.length; i++) {
      const sample = XTrain[i]
      const label = yTrain[i]

      const sampleCircuit = new Circuit(numQubits)
      encode(sampleCircuit, sample, fullEncoderConfig)

      for (const gate of circuit.gates) {
        sampleCircuit.gates.push({ ...gate, params: gate.params ? [...gate.params] : undefined })
      }

      sampleCircuit.setParameters(params)
      const state = executeCircuit(sampleCircuit)

      const probs: number[] = []
      for (let c = 0; c < numClasses; c++) {
        let classProb = 0
        for (let j = 0; j < Math.pow(2, numQubits); j++) {
          if (j % numClasses === c) {
            classProb += state.getProbability(j)
          }
        }
        probs.push(classProb)
      }

      const targetProb = Math.max(probs[label], 1e-10)
      totalLoss -= Math.log(targetProb)
    }

    return totalLoss / XTrain.length
  }

  const optimizer = createOptimizer({
    type: optimizerType as any,
    maxIterations: optimizerConfig.maxIterations || 100,
    tolerance: optimizerConfig.tolerance || 1e-6,
    learningRate: optimizerConfig.learningRate || 0.1,
  })

  const optimResult = optimizer.optimize(
    parameters,
    costFunction,
    undefined,
    (iteration, value, params) => {
      const trainPreds = computePredictions(params, XTrain)
      const trainAcc = computeAccuracy(trainPreds, yTrain)
      history.push({ iteration, loss: value, accuracy: trainAcc })
    }
  )

  parameters = optimResult.parameters
  const finalLoss = optimResult.value

  const trainPredictions = computePredictions(parameters, XTrain)
  const testPredictions = computePredictions(parameters, XTest)

  const trainAccuracy = computeAccuracy(trainPredictions, yTrain)
  const testAccuracy = computeAccuracy(testPredictions, yTest)

  const confusionMatrix: number[][] = Array.from({ length: numClasses }, () =>
    Array(numClasses).fill(0)
  )
  for (let i = 0; i < testPredictions.length; i++) {
    confusionMatrix[yTest[i]][testPredictions[i]]++
  }

  const metrics = circuit.getMetrics()

  const result: ClassificationResult = {
    accuracy: testAccuracy,
    trainAccuracy,
    loss: finalLoss,
    parameters,
    predictions: testPredictions,
    confusionMatrix,
    history,
  }

  return {
    result,
    metrics: {
      depth: metrics.depth,
      gateCount: metrics.gateCount,
      cnotCount: metrics.cnotCount,
      parameterCount: metrics.parameterCount,
      numQubits,
      executionTimeMs: 0,
    },
  }
}
