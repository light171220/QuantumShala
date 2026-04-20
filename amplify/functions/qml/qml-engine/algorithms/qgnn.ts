import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import { createOptimizer } from '../../../shared/optimizers'
import type { QMLRequest, QMLResponse, ClassificationResult, TrainingHistory, GraphData } from '../../../shared/qml/types'

export async function runQGNN(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    customData,
    optimizerType = 'adam',
    optimizerConfig = {},
    qgnnConfig,
  } = request

  const numMessagePassingLayers = qgnnConfig?.numMessagePassingLayers || 3
  const aggregationType = qgnnConfig?.aggregationType || 'sum'
  const readoutType = qgnnConfig?.readoutType || 'sum'

  if (!customData) {
    throw new Error('customData with graph information is required for QGNN')
  }

  const graphs: GraphData[] = customData.X as any
  const labels = customData.y

  const trainSize = Math.floor(graphs.length * 0.8)
  const trainGraphs = graphs.slice(0, trainSize)
  const trainLabels = labels.slice(0, trainSize)
  const testGraphs = graphs.slice(trainSize)
  const testLabels = labels.slice(trainSize)

  const numClasses = Math.max(...labels) + 1

  const paramsPerNode = 4
  const paramsPerEdge = 2
  const paramsPerLayer = numQubits * paramsPerNode + numQubits * paramsPerEdge
  const readoutParams = numQubits * 2
  const totalParams = numMessagePassingLayers * paramsPerLayer + readoutParams

  let parameters = Array(totalParams).fill(0).map(() => (Math.random() - 0.5) * 0.1)
  const history: TrainingHistory[] = []

  const buildMessagePassingLayer = (
    circuit: Circuit,
    graph: GraphData,
    params: number[],
    paramOffset: number
  ): number => {
    let idx = paramOffset

    for (let node = 0; node < Math.min(graph.numNodes, numQubits); node++) {
      circuit.ry(node, params[idx++])
      circuit.rz(node, params[idx++])
    }

    for (const [src, dst] of graph.edges) {
      if (src < numQubits && dst < numQubits) {
        circuit.cnot(src, dst)
        circuit.rz(dst, params[idx])
        idx++
      }
    }

    for (let node = 0; node < Math.min(graph.numNodes, numQubits); node++) {
      circuit.ry(node, params[idx++])
      circuit.rz(node, params[idx++])
    }

    return idx - paramOffset
  }

  const buildReadoutLayer = (
    circuit: Circuit,
    params: number[],
    paramOffset: number
  ): number => {
    let idx = paramOffset

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, params[idx++])
      circuit.rz(q, params[idx++])
    }

    return idx - paramOffset
  }

  const encodeGraph = (circuit: Circuit, graph: GraphData): void => {
    for (let node = 0; node < Math.min(graph.numNodes, numQubits); node++) {
      if (graph.nodeFeatures && graph.nodeFeatures[node]) {
        const feature = graph.nodeFeatures[node][0] || 0
        circuit.ry(node, feature * Math.PI)
      } else {
        circuit.h(node)
      }
    }

    const degree = new Array(numQubits).fill(0)
    for (const [src, dst] of graph.edges) {
      if (src < numQubits) degree[src]++
      if (dst < numQubits) degree[dst]++
    }

    for (let node = 0; node < Math.min(graph.numNodes, numQubits); node++) {
      circuit.rz(node, degree[node] * 0.1)
    }
  }

  const buildFullCircuit = (graph: GraphData, params: number[]): Circuit => {
    const circuit = new Circuit(numQubits)

    encodeGraph(circuit, graph)

    let paramIdx = 0
    for (let layer = 0; layer < numMessagePassingLayers; layer++) {
      const paramsUsed = buildMessagePassingLayer(circuit, graph, params, paramIdx)
      paramIdx += paramsUsed
    }

    buildReadoutLayer(circuit, params, paramIdx)

    return circuit
  }

  const computeGraphPrediction = (graph: GraphData, params: number[]): number => {
    const circuit = buildFullCircuit(graph, params)
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

    return probs.indexOf(Math.max(...probs))
  }

  const computePredictions = (graphList: GraphData[], params: number[]): number[] => {
    return graphList.map(graph => computeGraphPrediction(graph, params))
  }

  const computeAccuracy = (predictions: number[], labelList: number[]): number => {
    let correct = 0
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === labelList[i]) correct++
    }
    return correct / predictions.length
  }

  const costFunction = (params: number[]): number => {
    let totalLoss = 0

    for (let i = 0; i < trainGraphs.length; i++) {
      const graph = trainGraphs[i]
      const label = trainLabels[i]

      const circuit = buildFullCircuit(graph, params)
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

    return totalLoss / trainGraphs.length
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
        const trainPreds = computePredictions(trainGraphs, params)
        const trainAcc = computeAccuracy(trainPreds, trainLabels)
        history.push({ iteration, loss: value, accuracy: trainAcc })
      }
    }
  )

  parameters = optimResult.parameters

  const trainPredictions = computePredictions(trainGraphs, parameters)
  const testPredictions = computePredictions(testGraphs, parameters)

  const trainAccuracy = computeAccuracy(trainPredictions, trainLabels)
  const testAccuracy = computeAccuracy(testPredictions, testLabels)

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
      depth: numMessagePassingLayers * 4,
      gateCount: totalParams,
      cnotCount: numMessagePassingLayers * numQubits,
      parameterCount: totalParams,
      numQubits,
      executionTimeMs: 0,
    },
  }
}
