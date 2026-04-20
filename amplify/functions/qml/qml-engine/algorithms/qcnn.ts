import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import { createOptimizer } from '../../../shared/optimizers'
import type { QMLRequest, QMLResponse, ClassificationResult, TrainingHistory } from '../../../shared/qml/types'
import { encode } from '../../../shared/qml/encoders'
import { loadDataset } from '../../../shared/qml/datasets'
import { preprocessForQML } from '../../../shared/qml/datasets/preprocessing'

export async function runQCNN(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    datasetId,
    customData,
    trainTestSplit = 0.8,
    encoderType = 'amplitude',
    encoderConfig = {},
    optimizerType = 'adam',
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

  const numClasses = Math.max(...y) + 1

  const fullEncoderConfig = {
    type: encoderType,
    numQubits,
    ...encoderConfig,
  }

  const numLayers = Math.ceil(Math.log2(numQubits))
  const paramsPerConv = 6
  const paramsPerPool = 2
  let totalParams = 0

  let activeQubits = numQubits
  for (let layer = 0; layer < numLayers && activeQubits > 1; layer++) {
    const firstConvPairs = Math.floor(activeQubits / 2)
    const secondConvPairs = Math.floor((activeQubits - 1) / 2)
    totalParams += firstConvPairs * paramsPerConv
    totalParams += secondConvPairs * paramsPerConv
    totalParams += firstConvPairs * paramsPerPool
    activeQubits = Math.ceil(activeQubits / 2)
  }
  totalParams += 2

  let parameters = Array(totalParams).fill(0).map(() => (Math.random() - 0.5) * 0.1)
  const history: TrainingHistory[] = []

  const buildQCNN = (params: number[]): Circuit => {
    const circuit = new Circuit(numQubits)
    let paramIdx = 0
    let qubits = Array.from({ length: numQubits }, (_, i) => i)

    while (qubits.length > 1) {
      for (let i = 0; i < qubits.length - 1; i += 2) {
        const q1 = qubits[i]
        const q2 = qubits[i + 1]

        circuit.ry(q1, params[paramIdx++])
        circuit.rz(q1, params[paramIdx++])
        circuit.ry(q2, params[paramIdx++])
        circuit.rz(q2, params[paramIdx++])
        circuit.cnot(q1, q2)
        circuit.ry(q1, params[paramIdx++])
        circuit.rz(q2, params[paramIdx++])
      }

      for (let i = 1; i < qubits.length - 1; i += 2) {
        const q1 = qubits[i]
        const q2 = qubits[i + 1]

        circuit.ry(q1, params[paramIdx++])
        circuit.rz(q1, params[paramIdx++])
        circuit.ry(q2, params[paramIdx++])
        circuit.rz(q2, params[paramIdx++])
        circuit.cnot(q1, q2)
        circuit.ry(q1, params[paramIdx++])
        circuit.rz(q2, params[paramIdx++])
      }

      const newQubits: number[] = []
      for (let i = 0; i < qubits.length - 1; i += 2) {
        const q1 = qubits[i]
        const q2 = qubits[i + 1]

        circuit.crz(q1, q2, params[paramIdx++])
        circuit.x(q1)
        circuit.crx(q1, q2, params[paramIdx++])

        newQubits.push(q2)
      }
      if (qubits.length % 2 === 1) {
        newQubits.push(qubits[qubits.length - 1])
      }

      qubits = newQubits
    }

    if (qubits.length > 0) {
      circuit.ry(qubits[0], params[paramIdx++])
      circuit.rz(qubits[0], params[paramIdx++])
    }

    return circuit
  }

  const computePredictions = (params: number[], data: number[][]): number[] => {
    const predictions: number[] = []

    for (const sample of data) {
      const circuit = new Circuit(numQubits)
      encode(circuit, sample, fullEncoderConfig)

      const qcnn = buildQCNN(params)
      for (const gate of qcnn.gates) {
        circuit.gates.push({ ...gate })
      }

      const state = executeCircuit(circuit)

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

      const circuit = new Circuit(numQubits)
      encode(circuit, sample, fullEncoderConfig)

      const qcnn = buildQCNN(params)
      for (const gate of qcnn.gates) {
        circuit.gates.push({ ...gate })
      }

      const state = executeCircuit(circuit)

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

  const trainPredictions = computePredictions(parameters, XTrain)
  const testPredictions = computePredictions(parameters, XTest)

  const trainAccuracy = computeAccuracy(trainPredictions, yTrain)
  const testAccuracy = computeAccuracy(testPredictions, yTest)

  const result: ClassificationResult = {
    accuracy: testAccuracy,
    trainAccuracy,
    loss: optimResult.value,
    parameters,
    predictions: testPredictions,
    history,
  }

  return {
    result,
    metrics: {
      depth: numLayers * 4,
      gateCount: totalParams,
      cnotCount: numQubits - 1,
      parameterCount: totalParams,
      numQubits,
      executionTimeMs: 0,
    },
  }
}
