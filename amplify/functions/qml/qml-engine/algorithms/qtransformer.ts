import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import { createOptimizer } from '../../../shared/optimizers'
import type { QMLRequest, QMLResponse, ClassificationResult, TrainingHistory } from '../../../shared/qml/types'
import { loadDataset } from '../../../shared/qml/datasets'
import { preprocessForQML } from '../../../shared/qml/datasets/preprocessing'

export async function runQTransformer(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    datasetId,
    customData,
    trainTestSplit = 0.8,
    optimizerType = 'adam',
    optimizerConfig = {},
    qtransformerConfig,
  } = request

  const numHeads = qtransformerConfig?.numHeads || 2
  const sequenceLength = qtransformerConfig?.sequenceLength || 4
  const embeddingDim = qtransformerConfig?.embeddingDim || numQubits
  const numEncoderLayers = qtransformerConfig?.numEncoderLayers || 2
  const usePositionalEncoding = qtransformerConfig?.usePositionalEncoding !== false

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

  const paramsPerHead = numQubits * 6
  const paramsPerLayer = numHeads * paramsPerHead + numQubits * 4
  const totalParams = numEncoderLayers * paramsPerLayer + numQubits * 2

  let parameters = Array(totalParams).fill(0).map(() => (Math.random() - 0.5) * 0.1)
  const history: TrainingHistory[] = []

  const buildQuantumAttention = (
    circuit: Circuit,
    params: number[],
    paramOffset: number,
    headIdx: number
  ): number => {
    let idx = paramOffset

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, params[idx++])
      circuit.rz(q, params[idx++])
    }

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, params[idx++])
      circuit.rz(q, params[idx++])
    }

    for (let q = 0; q < numQubits - 1; q++) {
      circuit.cz(q, q + 1)
    }

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, params[idx++])
      circuit.rz(q, params[idx++])
    }

    return idx - paramOffset
  }

  const buildTransformerLayer = (
    circuit: Circuit,
    params: number[],
    paramOffset: number
  ): number => {
    let idx = paramOffset

    for (let head = 0; head < numHeads; head++) {
      const paramsUsed = buildQuantumAttention(circuit, params, idx, head)
      idx += paramsUsed
    }

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, params[idx++])
      circuit.rz(q, params[idx++])
    }

    for (let q = 0; q < numQubits - 1; q++) {
      circuit.cnot(q, q + 1)
    }

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, params[idx++])
      circuit.rz(q, params[idx++])
    }

    return idx - paramOffset
  }

  const buildFullCircuit = (input: number[], params: number[]): Circuit => {
    const circuit = new Circuit(numQubits)

    for (let q = 0; q < numQubits; q++) {
      const inputIdx = q % input.length
      circuit.ry(q, input[inputIdx])
    }

    if (usePositionalEncoding) {
      for (let q = 0; q < numQubits; q++) {
        const pos = q / numQubits
        circuit.rz(q, pos * Math.PI)
      }
    }

    let paramIdx = 0
    for (let layer = 0; layer < numEncoderLayers; layer++) {
      const paramsUsed = buildTransformerLayer(circuit, params, paramIdx)
      paramIdx += paramsUsed
    }

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, params[paramIdx++])
      circuit.rz(q, params[paramIdx++])
    }

    return circuit
  }

  const computePredictions = (params: number[], data: number[][]): number[] => {
    const predictions: number[] = []

    for (const sample of data) {
      const circuit = buildFullCircuit(sample, params)
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
      const circuit = buildFullCircuit(XTrain[i], params)
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

      const targetProb = Math.max(probs[yTrain[i]], 1e-10)
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
      if (iteration % 10 === 0) {
        const trainPreds = computePredictions(params, XTrain)
        const trainAcc = computeAccuracy(trainPreds, yTrain)
        history.push({ iteration, loss: value, accuracy: trainAcc })
      }
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
      depth: numEncoderLayers * (numHeads + 2) * 2,
      gateCount: totalParams,
      cnotCount: numEncoderLayers * (numQubits - 1),
      parameterCount: totalParams,
      numQubits,
      executionTimeMs: 0,
    },
  }
}
