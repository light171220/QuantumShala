import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import { createOptimizer } from '../../../shared/optimizers'
import type { QMLRequest, QMLResponse, AutoencoderResult, TrainingHistory } from '../../../shared/qml/types'
import { loadDataset } from '../../../shared/qml/datasets'
import { preprocessForQML } from '../../../shared/qml/datasets/preprocessing'

export async function runQAutoencoder(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    datasetId,
    customData,
    trainTestSplit = 0.8,
    optimizerType = 'adam',
    optimizerConfig = {},
    qautoencoderConfig,
  } = request

  const latentDim = qautoencoderConfig?.latentDim || Math.ceil(numQubits / 2)
  const encoderLayers = qautoencoderConfig?.encoderLayers || 2
  const decoderLayers = qautoencoderConfig?.decoderLayers || 2
  const reconstructionLoss = qautoencoderConfig?.reconstructionLoss || 'fidelity'

  let X: number[][]
  let y: number[]

  if (customData) {
    X = customData.X
    y = customData.y || Array(customData.X.length).fill(0)
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

  const trashQubits = numQubits - latentDim

  const encoderParams = numQubits * 2 * (encoderLayers + 1)
  const decoderParams = numQubits * 2 * (decoderLayers + 1)
  const totalParams = encoderParams + decoderParams

  let parameters = Array(totalParams).fill(0).map(() => (Math.random() - 0.5) * 0.1)
  const history: TrainingHistory[] = []

  const buildEncoder = (params: number[]): Circuit => {
    const circuit = new Circuit(numQubits)
    let paramIdx = 0

    for (let layer = 0; layer < encoderLayers; layer++) {
      for (let q = 0; q < numQubits; q++) {
        circuit.ry(q, params[paramIdx++])
        circuit.rz(q, params[paramIdx++])
      }

      for (let q = 0; q < numQubits - 1; q++) {
        circuit.cnot(q, q + 1)
      }
    }

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, params[paramIdx++])
      circuit.rz(q, params[paramIdx++])
    }

    return circuit
  }

  const buildDecoder = (params: number[], offset: number): Circuit => {
    const circuit = new Circuit(numQubits)
    let paramIdx = offset

    for (let layer = 0; layer < decoderLayers; layer++) {
      for (let q = 0; q < numQubits; q++) {
        circuit.ry(q, params[paramIdx++])
        circuit.rz(q, params[paramIdx++])
      }

      for (let q = numQubits - 1; q > 0; q--) {
        circuit.cnot(q, q - 1)
      }
    }

    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, params[paramIdx++])
      circuit.rz(q, params[paramIdx++])
    }

    return circuit
  }

  const encodeData = (circuit: Circuit, data: number[]): void => {
    for (let q = 0; q < numQubits; q++) {
      const dataIdx = q % data.length
      circuit.ry(q, data[dataIdx])
    }
  }

  const computeFidelityLoss = (inputData: number[], params: number[]): number => {
    const inputCircuit = new Circuit(numQubits)
    encodeData(inputCircuit, inputData)
    const inputState = executeCircuit(inputCircuit)
    const inputAmps = inputState.toArray()

    const fullCircuit = new Circuit(numQubits)
    encodeData(fullCircuit, inputData)

    const encoder = buildEncoder(params)
    for (const gate of encoder.gates) {
      fullCircuit.gates.push({ ...gate })
    }

    const decoder = buildDecoder(params, encoderParams)
    for (const gate of decoder.gates) {
      fullCircuit.gates.push({ ...gate })
    }

    const outputState = executeCircuit(fullCircuit)
    const outputAmps = outputState.toArray()

    let overlapRe = 0
    let overlapIm = 0
    for (let i = 0; i < inputAmps.length; i++) {
      overlapRe += inputAmps[i].re * outputAmps[i].re + inputAmps[i].im * outputAmps[i].im
      overlapIm += inputAmps[i].re * outputAmps[i].im - inputAmps[i].im * outputAmps[i].re
    }
    const fidelity = overlapRe * overlapRe + overlapIm * overlapIm

    return 1 - fidelity
  }

  const computeMSELoss = (inputData: number[], params: number[]): number => {
    const fullCircuit = new Circuit(numQubits)
    encodeData(fullCircuit, inputData)

    const encoder = buildEncoder(params)
    for (const gate of encoder.gates) {
      fullCircuit.gates.push({ ...gate })
    }

    const decoder = buildDecoder(params, encoderParams)
    for (const gate of decoder.gates) {
      fullCircuit.gates.push({ ...gate })
    }

    const outputState = executeCircuit(fullCircuit)

    let mse = 0
    for (let q = 0; q < numQubits; q++) {
      const dataIdx = q % inputData.length
      const targetVal = inputData[dataIdx] / Math.PI

      let expZ = 0
      for (let i = 0; i < Math.pow(2, numQubits); i++) {
        const bit = (i >> q) & 1
        const sign = bit === 0 ? 1 : -1
        expZ += sign * outputState.getProbability(i)
      }
      const reconstructedVal = (expZ + 1) / 2

      mse += Math.pow(targetVal - reconstructedVal, 2)
    }

    return mse / numQubits
  }

  const costFunction = (params: number[]): number => {
    let totalLoss = 0

    for (const sample of XTrain) {
      if (reconstructionLoss === 'fidelity') {
        totalLoss += computeFidelityLoss(sample, params)
      } else {
        totalLoss += computeMSELoss(sample, params)
      }
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
    (iteration, value) => {
      if (iteration % 10 === 0) {
        history.push({ iteration, loss: value })
      }
    }
  )

  parameters = optimResult.parameters

  const getLatentRepresentation = (data: number[], params: number[]): number[] => {
    const circuit = new Circuit(numQubits)
    encodeData(circuit, data)

    const encoder = buildEncoder(params)
    for (const gate of encoder.gates) {
      circuit.gates.push({ ...gate })
    }

    const state = executeCircuit(circuit)
    const latent: number[] = []

    for (let q = 0; q < latentDim; q++) {
      let expZ = 0
      for (let i = 0; i < Math.pow(2, numQubits); i++) {
        const bit = (i >> q) & 1
        const sign = bit === 0 ? 1 : -1
        expZ += sign * state.getProbability(i)
      }
      latent.push(expZ)
    }

    return latent
  }

  const getReconstruction = (data: number[], params: number[]): number[] => {
    const fullCircuit = new Circuit(numQubits)
    encodeData(fullCircuit, data)

    const encoder = buildEncoder(params)
    for (const gate of encoder.gates) {
      fullCircuit.gates.push({ ...gate })
    }

    const decoder = buildDecoder(params, encoderParams)
    for (const gate of decoder.gates) {
      fullCircuit.gates.push({ ...gate })
    }

    const state = executeCircuit(fullCircuit)
    const reconstructed: number[] = []

    for (let q = 0; q < numQubits; q++) {
      let expZ = 0
      for (let i = 0; i < Math.pow(2, numQubits); i++) {
        const bit = (i >> q) & 1
        const sign = bit === 0 ? 1 : -1
        expZ += sign * state.getProbability(i)
      }
      reconstructed.push((expZ + 1) / 2 * Math.PI)
    }

    return reconstructed
  }

  const latentRepresentations = XTest.map(x => getLatentRepresentation(x, parameters))
  const reconstructedData = XTest.map(x => getReconstruction(x, parameters))

  let testLoss = 0
  for (const sample of XTest) {
    if (reconstructionLoss === 'fidelity') {
      testLoss += computeFidelityLoss(sample, parameters)
    } else {
      testLoss += computeMSELoss(sample, parameters)
    }
  }
  testLoss /= XTest.length

  const result: AutoencoderResult = {
    reconstructionLoss: testLoss,
    latentRepresentations,
    reconstructedData,
    parameters,
    history,
  }

  return {
    result,
    metrics: {
      depth: (encoderLayers + decoderLayers) * 2,
      gateCount: totalParams + (encoderLayers + decoderLayers) * (numQubits - 1),
      cnotCount: (encoderLayers + decoderLayers) * (numQubits - 1),
      parameterCount: totalParams,
      numQubits,
      executionTimeMs: 0,
    },
  }
}
