import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import { createOptimizer } from '../../../shared/optimizers'
import type { QMLRequest, QMLResponse, GenerativeResult, TrainingHistory } from '../../../shared/qml/types'
import { loadDataset } from '../../../shared/qml/datasets'
import { preprocessForQML } from '../../../shared/qml/datasets/preprocessing'

export async function runQVAE(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    datasetId,
    customData,
    trainTestSplit = 0.8,
    optimizerType = 'adam',
    optimizerConfig = {},
    qvaeConfig,
  } = request

  const latentDim = qvaeConfig?.latentDim || Math.ceil(numQubits / 2)
  const encoderLayers = qvaeConfig?.encoderLayers || 2
  const decoderLayers = qvaeConfig?.decoderLayers || 2
  const klWeight = qvaeConfig?.klWeight || 0.1
  const numSamples = qvaeConfig?.numSamples || 10

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

  const { XTrain } = preprocessForQML(X, y, {
    normalization: 'minmax',
    trainRatio: trainTestSplit,
    scaleToRange: [0, Math.PI],
  })

  const encoderParams = numQubits * 2 * (encoderLayers + 1)
  const decoderParams = numQubits * 2 * (decoderLayers + 1)
  const variationalParams = latentDim * 2
  const totalParams = encoderParams + decoderParams + variationalParams

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

  const sampleFromPosterior = (
    encodedState: any,
    variationalParams: number[]
  ): number[] => {
    const latentSamples: number[] = []

    for (let l = 0; l < latentDim; l++) {
      const mean = variationalParams[l * 2]
      const logVar = variationalParams[l * 2 + 1]
      const std = Math.exp(0.5 * logVar)

      const u1 = Math.random()
      const u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)

      latentSamples.push(mean + std * z)
    }

    return latentSamples
  }

  const computeKLDivergence = (variationalParams: number[]): number => {
    let kl = 0

    for (let l = 0; l < latentDim; l++) {
      const mean = variationalParams[l * 2]
      const logVar = variationalParams[l * 2 + 1]

      kl += -0.5 * (1 + logVar - mean * mean - Math.exp(logVar))
    }

    return kl
  }

  const encodeData = (circuit: Circuit, data: number[]): void => {
    for (let q = 0; q < numQubits; q++) {
      const dataIdx = q % data.length
      circuit.ry(q, data[dataIdx])
    }
  }

  const computeReconstructionLoss = (
    inputData: number[],
    latentSample: number[],
    params: number[]
  ): number => {
    const decoderCircuit = new Circuit(numQubits)

    for (let q = 0; q < latentDim; q++) {
      decoderCircuit.ry(q, latentSample[q])
    }

    const decoder = buildDecoder(params, encoderParams)
    for (const gate of decoder.gates) {
      decoderCircuit.gates.push({ ...gate })
    }

    const outputState = executeCircuit(decoderCircuit)

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

    const varParams = params.slice(encoderParams + decoderParams)

    for (const sample of XTrain) {
      const encoderCircuit = new Circuit(numQubits)
      encodeData(encoderCircuit, sample)

      const encoder = buildEncoder(params)
      for (const gate of encoder.gates) {
        encoderCircuit.gates.push({ ...gate })
      }

      const encodedState = executeCircuit(encoderCircuit)

      let reconLoss = 0
      for (let s = 0; s < Math.min(numSamples, 3); s++) {
        const latentSample = sampleFromPosterior(encodedState, varParams)
        reconLoss += computeReconstructionLoss(sample, latentSample, params)
      }
      reconLoss /= Math.min(numSamples, 3)

      const klLoss = computeKLDivergence(varParams)

      totalLoss += reconLoss + klWeight * klLoss
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

  const generateSamples = (numGenSamples: number): number[][] => {
    const samples: number[][] = []
    const varParams = parameters.slice(encoderParams + decoderParams)

    for (let s = 0; s < numGenSamples; s++) {
      const latentSample: number[] = []
      for (let l = 0; l < latentDim; l++) {
        const u1 = Math.random()
        const u2 = Math.random()
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        latentSample.push(z)
      }

      const decoderCircuit = new Circuit(numQubits)
      for (let q = 0; q < latentDim; q++) {
        decoderCircuit.ry(q, latentSample[q])
      }

      const decoder = buildDecoder(parameters, encoderParams)
      for (const gate of decoder.gates) {
        decoderCircuit.gates.push({ ...gate })
      }

      const state = executeCircuit(decoderCircuit)

      const generated: number[] = []
      for (let q = 0; q < numQubits; q++) {
        let expZ = 0
        for (let i = 0; i < Math.pow(2, numQubits); i++) {
          const bit = (i >> q) & 1
          const sign = bit === 0 ? 1 : -1
          expZ += sign * state.getProbability(i)
        }
        generated.push((expZ + 1) / 2)
      }

      samples.push(generated)
    }

    return samples
  }

  const generatedSamples = generateSamples(10)

  const varParams = parameters.slice(encoderParams + decoderParams)
  const kldivergence = computeKLDivergence(varParams)

  const result: GenerativeResult = {
    generatedSamples,
    kldivergence,
    parameters,
    history,
  }

  return {
    result,
    metrics: {
      depth: (encoderLayers + decoderLayers) * 2,
      gateCount: totalParams,
      cnotCount: (encoderLayers + decoderLayers) * (numQubits - 1),
      parameterCount: totalParams,
      numQubits,
      executionTimeMs: 0,
    },
  }
}
