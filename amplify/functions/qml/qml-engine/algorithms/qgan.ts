import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import { createOptimizer } from '../../../shared/optimizers'
import type { QMLRequest, QMLResponse, GenerativeResult, TrainingHistory } from '../../../shared/qml/types'

export async function runQGAN(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    customData,
    optimizerType = 'adam',
    optimizerConfig = {},
    qganConfig,
  } = request

  const generatorLayers = qganConfig?.generatorLayers || 3
  const discriminatorLayers = qganConfig?.discriminatorLayers || 3
  const latentDim = qganConfig?.latentDim || Math.ceil(numQubits / 2)
  const genLr = qganConfig?.generatorLearningRate || 0.1
  const discLr = qganConfig?.discriminatorLearningRate || 0.1
  const discSteps = qganConfig?.discriminatorSteps || 1

  const rawTarget = customData?.X || generateTargetDistribution(numQubits)
  const targetDistribution: number[] = Array.isArray(rawTarget[0]) ? (rawTarget as number[][])[0] : rawTarget as number[]

  const genParams = numQubits * 2 * (generatorLayers + 1)
  const discParams = numQubits * 2 * (discriminatorLayers + 1)

  let generatorParams = Array(genParams).fill(0).map(() => (Math.random() - 0.5) * 0.1)
  let discriminatorParams = Array(discParams).fill(0).map(() => (Math.random() - 0.5) * 0.1)

  const history: TrainingHistory[] = []

  const buildGenerator = (params: number[], latentInput: number[]): Circuit => {
    const circuit = new Circuit(numQubits)

    for (let i = 0; i < Math.min(latentInput.length, numQubits); i++) {
      circuit.ry(i, latentInput[i] * Math.PI)
    }

    let paramIdx = 0
    for (let layer = 0; layer < generatorLayers; layer++) {
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

  const buildDiscriminator = (params: number[]): Circuit => {
    const circuit = new Circuit(numQubits)

    let paramIdx = 0
    for (let layer = 0; layer < discriminatorLayers; layer++) {
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

  const getGeneratedDistribution = (genParams: number[]): number[] => {
    const latentInput = Array(latentDim).fill(0).map(() => Math.random() * 2 - 1)
    const generator = buildGenerator(genParams, latentInput)
    const state = executeCircuit(generator)

    const probs: number[] = []
    for (let i = 0; i < Math.pow(2, numQubits); i++) {
      probs.push(state.getProbability(i))
    }
    return probs
  }

  const discriminate = (distribution: number[], discParams: number[]): number => {
    const circuit = new Circuit(numQubits)

    for (let q = 0; q < numQubits; q++) {
      const idx = q % distribution.length
      circuit.ry(q, distribution[idx] * Math.PI)
    }

    const disc = buildDiscriminator(discParams)
    for (const gate of disc.gates) {
      circuit.gates.push({ ...gate })
    }

    const state = executeCircuit(circuit)
    return state.getProbability(0)
  }

  const maxIterations = optimizerConfig.maxIterations || 100

  for (let iter = 0; iter < maxIterations; iter++) {
    for (let d = 0; d < discSteps; d++) {
      const discCost = (params: number[]): number => {
        const realScore = discriminate(targetDistribution, params)
        const fakeDistribution = getGeneratedDistribution(generatorParams)
        const fakeScore = discriminate(fakeDistribution, params)
        return -(Math.log(realScore + 1e-10) + Math.log(1 - fakeScore + 1e-10))
      }

      const discOptimizer = createOptimizer({
        type: optimizerType as any,
        maxIterations: 1,
        tolerance: 1e-6,
        learningRate: discLr,
      })

      const discResult = discOptimizer.optimize(discriminatorParams, discCost)
      discriminatorParams = discResult.parameters
    }

    const genCost = (params: number[]): number => {
      const fakeDistribution = getGeneratedDistribution(params)
      const fakeScore = discriminate(fakeDistribution, discriminatorParams)
      return -Math.log(fakeScore + 1e-10)
    }

    const genOptimizer = createOptimizer({
      type: optimizerType as any,
      maxIterations: 1,
      tolerance: 1e-6,
      learningRate: genLr,
    })

    const genResult = genOptimizer.optimize(generatorParams, genCost)
    generatorParams = genResult.parameters

    if (iter % 10 === 0) {
      history.push({
        iteration: iter,
        loss: genResult.value,
      })
    }
  }

  const generatedSamples: number[][] = []
  for (let i = 0; i < 10; i++) {
    generatedSamples.push(getGeneratedDistribution(generatorParams))
  }

  const fidelity = computeFidelity(
    getGeneratedDistribution(generatorParams),
    targetDistribution
  )

  const result: GenerativeResult = {
    generatedSamples,
    fidelity,
    parameters: [...generatorParams, ...discriminatorParams],
    history,
  }

  return {
    result,
    metrics: {
      depth: (generatorLayers + discriminatorLayers) * 2,
      gateCount: genParams + discParams,
      cnotCount: (generatorLayers + discriminatorLayers) * (numQubits - 1),
      parameterCount: genParams + discParams,
      numQubits,
      executionTimeMs: 0,
    },
  }
}

function generateTargetDistribution(numQubits: number): number[] {
  const n = Math.pow(2, numQubits)
  const probs = Array(n).fill(0).map(() => Math.random())
  const sum = probs.reduce((a, b) => a + b, 0)
  return probs.map(p => p / sum)
}

function computeFidelity(p: number[], q: number[]): number {
  let fidelity = 0
  for (let i = 0; i < Math.min(p.length, q.length); i++) {
    fidelity += Math.sqrt(p[i] * q[i])
  }
  return fidelity * fidelity
}
