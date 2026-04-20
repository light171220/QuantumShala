import { Circuit, executeCircuit } from '../../../shared/quantum-core'
import { createOptimizer } from '../../../shared/optimizers'
import type { QMLRequest, QMLResponse, QAOAResult, TrainingHistory } from '../../../shared/qml/types'
import { MaxCutProblem, TSPProblem, PortfolioProblem } from '../../../shared/qml/problems'

export async function runQAOA(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    optimizerType = 'cobyla',
    optimizerConfig = {},
    qaoaConfig,
    shots = 1024,
  } = request

  if (!qaoaConfig) {
    throw new Error('qaoaConfig is required for QAOA')
  }

  const { problemType, problemData, numLayers, mixerType = 'x', warmStart = false } = qaoaConfig

  let costHamiltonian: { terms: { qubits: number[]; coeff: number }[] }
  let evaluateSolution: (bitstring: number[]) => number
  let optimalValue: number | undefined

  switch (problemType) {
    case 'maxcut': {
      const graph = problemData.graph || { nodes: numQubits, edges: [] }
      const problem = new MaxCutProblem(graph)
      const hamiltonian = problem.createHamiltonian()

      costHamiltonian = {
        terms: hamiltonian.terms.map(term => ({
          qubits: term.operators.filter(op => op.pauli === 'Z').map(op => op.qubit),
          coeff: term.coefficient,
        })),
      }

      evaluateSolution = (bs) => problem.evaluateCut(bs)

      if (numQubits <= 10) {
        const optimal = problem.getOptimalCut()
        optimalValue = optimal.value
      }
      break
    }

    case 'tsp': {
      const cities = problemData.cities || TSPProblem.createRandomCities(Math.sqrt(numQubits))
      const problem = new TSPProblem(cities)
      const hamiltonian = problem.createHamiltonian()

      costHamiltonian = {
        terms: hamiltonian.terms.map(term => ({
          qubits: term.operators.filter(op => op.pauli === 'Z').map(op => op.qubit),
          coeff: term.coefficient,
        })),
      }

      evaluateSolution = (bs) => {
        const tour = problem.decodeResult(bs)
        return tour ? -problem.evaluateTour(tour) : -1000
      }
      break
    }

    case 'portfolio': {
      const portfolioData = problemData.assets
        ? {
            returns: problemData.assets.returns,
            covariance: problemData.assets.covariance,
            budget: Math.ceil(problemData.assets.returns.length / 2),
            riskAversion: 0.5
          }
        : PortfolioProblem.generateRandomPortfolio(numQubits)
      const problem = new PortfolioProblem(portfolioData)
      const hamiltonian = problem.createHamiltonian()

      costHamiltonian = {
        terms: hamiltonian.terms.map(term => ({
          qubits: term.operators.filter(op => op.pauli === 'Z').map(op => op.qubit),
          coeff: term.coefficient,
        })),
      }

      evaluateSolution = (bs) => {
        const result = problem.evaluatePortfolio(bs)
        return result.expectedReturn - result.budgetViolation * 10
      }
      break
    }

    default:
      throw new Error(`Unknown problem type: ${problemType}`)
  }

  const totalParams = numLayers * 2
  let parameters: number[]

  if (warmStart) {
    parameters = Array(totalParams).fill(0).map((_, i) =>
      i % 2 === 0 ? 0.5 : 0.5
    )
  } else {
    parameters = Array(totalParams).fill(0).map(() => Math.random() * Math.PI)
  }

  const history: TrainingHistory[] = []

  const buildQAOACircuit = (gammas: number[], betas: number[]): Circuit => {
    const circuit = new Circuit(numQubits)

    for (let q = 0; q < numQubits; q++) {
      circuit.h(q)
    }

    for (let layer = 0; layer < numLayers; layer++) {
      const gamma = gammas[layer]

      for (const term of costHamiltonian.terms) {
        if (term.qubits.length === 1) {
          circuit.rz(term.qubits[0], 2 * gamma * term.coeff)
        } else if (term.qubits.length === 2) {
          const [q1, q2] = term.qubits
          circuit.cnot(q1, q2)
          circuit.rz(q2, 2 * gamma * term.coeff)
          circuit.cnot(q1, q2)
        }
      }

      const beta = betas[layer]

      switch (mixerType) {
        case 'x':
          for (let q = 0; q < numQubits; q++) {
            circuit.rx(q, 2 * beta)
          }
          break
        case 'xy':
          for (let q = 0; q < numQubits - 1; q++) {
            circuit.rxx(q, q + 1, beta)
            circuit.ryy(q, q + 1, beta)
          }
          break
        case 'grover':
          for (let q = 0; q < numQubits; q++) {
            circuit.h(q)
          }
          for (let q = 0; q < numQubits; q++) {
            circuit.x(q)
          }
          if (numQubits === 2) {
            circuit.cz(0, 1)
          } else if (numQubits >= 3) {
            circuit.h(numQubits - 1)
            for (let q = 0; q < numQubits - 1; q++) {
              circuit.cnot(q, numQubits - 1)
            }
            circuit.rz(numQubits - 1, beta)
            for (let q = numQubits - 2; q >= 0; q--) {
              circuit.cnot(q, numQubits - 1)
            }
            circuit.h(numQubits - 1)
          }
          for (let q = 0; q < numQubits; q++) {
            circuit.x(q)
          }
          for (let q = 0; q < numQubits; q++) {
            circuit.h(q)
          }
          break
        default:
          for (let q = 0; q < numQubits; q++) {
            circuit.rx(q, 2 * beta)
          }
      }
    }

    return circuit
  }

  const costFunction = (params: number[]): number => {
    const gammas = params.slice(0, numLayers)
    const betas = params.slice(numLayers)

    const circuit = buildQAOACircuit(gammas, betas)
    const state = executeCircuit(circuit)

    let expectation = 0
    for (let i = 0; i < Math.pow(2, numQubits); i++) {
      const prob = state.getProbability(i)
      const bitstring = Array.from({ length: numQubits }, (_, j) => (i >> j) & 1)
      const cost = evaluateSolution(bitstring)
      expectation += prob * cost
    }

    return -expectation
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
      history.push({ iteration, loss: value })
    }
  )

  parameters = optimResult.parameters
  const gammas = parameters.slice(0, numLayers)
  const betas = parameters.slice(numLayers)

  const finalCircuit = buildQAOACircuit(gammas, betas)
  const finalState = executeCircuit(finalCircuit)

  const solutionDistribution: Record<string, number> = {}
  let bestSolution: number[] = []
  let bestValue = -Infinity

  for (let i = 0; i < Math.pow(2, numQubits); i++) {
    const prob = finalState.getProbability(i)
    if (prob > 0.001) {
      const bitstring = Array.from({ length: numQubits }, (_, j) => (i >> j) & 1)
      const key = bitstring.join('')
      solutionDistribution[key] = prob

      const value = evaluateSolution(bitstring)
      if (value > bestValue) {
        bestValue = value
        bestSolution = bitstring
      }
    }
  }

  const approximationRatio = optimalValue ? bestValue / optimalValue : undefined

  const result: QAOAResult = {
    optimalSolution: bestSolution,
    optimalValue: bestValue,
    approximationRatio,
    solutionDistribution,
    gammas,
    betas,
    history,
  }

  const metrics = finalCircuit.getMetrics()

  return {
    result,
    metrics: {
      depth: metrics.depth,
      gateCount: metrics.gateCount,
      cnotCount: metrics.cnotCount,
      parameterCount: totalParams,
      numQubits,
      executionTimeMs: 0,
    },
  }
}
