import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import type { QMLRequest, QMLResponse, QRLResult } from '../../../shared/qml/types'
import { CartPoleEnvironment, GridWorldEnvironment, FrozenLakeEnvironment } from '../../../shared/qml/environments'
import type { Environment } from '../../../shared/qml/environments'

export async function runQRL(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    qrlConfig,
    optimizerConfig = {},
  } = request

  if (!qrlConfig) {
    throw new Error('qrlConfig is required for QRL')
  }

  const {
    algorithmType = 'quantum_policy_gradient',
    environmentId = 'cartpole',
    environmentConfig = {},
    numEpisodes = 100,
    maxStepsPerEpisode = 200,
    discountFactor = 0.99,
    explorationRate = 1.0,
    explorationDecay = 0.995,
  } = qrlConfig

  let env: Environment

  switch (environmentId) {
    case 'cartpole':
      env = new CartPoleEnvironment(maxStepsPerEpisode)
      break
    case 'gridworld':
      env = new GridWorldEnvironment(environmentConfig.gridSize || 5, maxStepsPerEpisode)
      break
    case 'frozen_lake':
      env = new FrozenLakeEnvironment(
        environmentConfig.gridSize || 4,
        environmentConfig.slippery !== false,
        maxStepsPerEpisode
      )
      break
    default:
      throw new Error(`Unknown environment: ${environmentId}`)
  }

  const spec = env.getSpec()
  const actionDim = spec.actionDim
  const observationDim = spec.observationDim

  const effectiveQubits = Math.min(numQubits, Math.max(4, Math.ceil(Math.log2(observationDim)) + 2))
  const numLayers = 2
  const paramsPerLayer = effectiveQubits * 2
  const totalParams = (numLayers + 1) * paramsPerLayer

  let policyParams = Array(totalParams).fill(0).map(() => (Math.random() - 0.5) * 0.1)

  const learningRate = optimizerConfig.learningRate || 0.01

  const buildPolicyCircuit = (observation: number[], params: number[]): Circuit => {
    const circuit = new Circuit(effectiveQubits)

    for (let q = 0; q < effectiveQubits; q++) {
      const obsIdx = q % observation.length
      circuit.ry(q, observation[obsIdx] * Math.PI)
    }

    let paramIdx = 0
    for (let layer = 0; layer < numLayers; layer++) {
      for (let q = 0; q < effectiveQubits; q++) {
        circuit.ry(q, params[paramIdx++])
        circuit.rz(q, params[paramIdx++])
      }
      for (let q = 0; q < effectiveQubits - 1; q++) {
        circuit.cnot(q, q + 1)
      }
    }
    for (let q = 0; q < effectiveQubits; q++) {
      circuit.ry(q, params[paramIdx++])
      circuit.rz(q, params[paramIdx++])
    }

    return circuit
  }

  const getActionProbabilities = (observation: number[], params: number[]): number[] => {
    const circuit = buildPolicyCircuit(observation, params)
    const state = executeCircuit(circuit)

    const probs: number[] = []
    for (let a = 0; a < actionDim; a++) {
      let actionProb = 0
      for (let i = 0; i < Math.pow(2, effectiveQubits); i++) {
        if (i % actionDim === a) {
          actionProb += state.getProbability(i)
        }
      }
      probs.push(actionProb)
    }

    const sum = probs.reduce((a, b) => a + b, 0)
    return probs.map(p => p / sum)
  }

  const selectAction = (observation: number[], params: number[], epsilon: number): number => {
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * actionDim)
    }

    const probs = getActionProbabilities(observation, params)
    const r = Math.random()
    let cumProb = 0
    for (let a = 0; a < actionDim; a++) {
      cumProb += probs[a]
      if (r < cumProb) return a
    }
    return actionDim - 1
  }

  const episodeRewards: number[] = []
  let epsilon = explorationRate
  let successCount = 0
  let totalSteps = 0

  for (let episode = 0; episode < numEpisodes; episode++) {
    let state = env.reset()
    let episodeReward = 0
    let episodeSteps = 0

    const trajectory: { observation: number[]; action: number; reward: number }[] = []

    while (!state.done && episodeSteps < maxStepsPerEpisode) {
      const action = selectAction(state.observation, policyParams, epsilon)
      const nextState = env.step(action)

      trajectory.push({
        observation: [...state.observation],
        action,
        reward: nextState.reward,
      })

      episodeReward += nextState.reward
      episodeSteps++
      state = nextState
    }

    if (algorithmType === 'quantum_policy_gradient') {
      const returns: number[] = []
      let G = 0
      for (let t = trajectory.length - 1; t >= 0; t--) {
        G = trajectory[t].reward + discountFactor * G
        returns.unshift(G)
      }

      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length
      const stdReturn = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
      ) + 1e-8
      const normalizedReturns = returns.map(r => (r - meanReturn) / stdReturn)

      for (let t = 0; t < trajectory.length; t++) {
        const { observation, action } = trajectory[t]
        const advantage = normalizedReturns[t]

        const gradients = computePolicyGradient(
          observation,
          action,
          policyParams,
          effectiveQubits,
          actionDim
        )

        for (let i = 0; i < policyParams.length; i++) {
          policyParams[i] += learningRate * advantage * gradients[i]
        }
      }
    }

    episodeRewards.push(episodeReward)
    totalSteps += episodeSteps

    if (state.done && episodeReward > 0) {
      successCount++
    }

    epsilon = Math.max(0.01, epsilon * explorationDecay)
  }

  const totalReward = episodeRewards.reduce((a, b) => a + b, 0)
  const averageReward = totalReward / numEpisodes
  const successRate = successCount / numEpisodes
  const averageSteps = totalSteps / numEpisodes

  const result: QRLResult = {
    totalReward,
    averageReward,
    episodeRewards,
    successRate,
    averageSteps,
    policyParameters: policyParams,
  }

  return {
    result,
    metrics: {
      depth: numLayers * 2,
      gateCount: totalParams + effectiveQubits * numLayers,
      cnotCount: numLayers * (effectiveQubits - 1),
      parameterCount: totalParams,
      numQubits: effectiveQubits,
      executionTimeMs: 0,
    },
  }
}

function computePolicyGradient(
  observation: number[],
  action: number,
  params: number[],
  numQubits: number,
  actionDim: number
): number[] {
  const gradients: number[] = []
  const shift = Math.PI / 2

  const buildCircuit = (obs: number[], p: number[]): Circuit => {
    const circuit = new Circuit(numQubits)
    for (let q = 0; q < numQubits; q++) {
      const obsIdx = q % obs.length
      circuit.ry(q, obs[obsIdx] * Math.PI)
    }
    let paramIdx = 0
    const numLayers = 2
    for (let layer = 0; layer < numLayers; layer++) {
      for (let q = 0; q < numQubits; q++) {
        circuit.ry(q, p[paramIdx++])
        circuit.rz(q, p[paramIdx++])
      }
      for (let q = 0; q < numQubits - 1; q++) {
        circuit.cnot(q, q + 1)
      }
    }
    for (let q = 0; q < numQubits; q++) {
      circuit.ry(q, p[paramIdx++])
      circuit.rz(q, p[paramIdx++])
    }
    return circuit
  }

  const getActionProb = (p: number[]): number => {
    const circuit = buildCircuit(observation, p)
    const state = executeCircuit(circuit)
    let actionProb = 0
    for (let i = 0; i < Math.pow(2, numQubits); i++) {
      if (i % actionDim === action) {
        actionProb += state.getProbability(i)
      }
    }
    return actionProb
  }

  for (let i = 0; i < params.length; i++) {
    const paramsPlus = [...params]
    const paramsMinus = [...params]
    paramsPlus[i] += shift
    paramsMinus[i] -= shift

    const probPlus = getActionProb(paramsPlus)
    const probMinus = getActionProb(paramsMinus)

    const prob = getActionProb(params)
    const grad = prob > 1e-10 ? (probPlus - probMinus) / (2 * prob) : 0

    gradients.push(grad)
  }

  return gradients
}
