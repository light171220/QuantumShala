import { useCallback, useState } from 'react'
import { useSimulatorStore } from '@/stores/simulatorStore'
import { simulateCircuit, BROWSER_MAX_QUBITS } from '@/lib/quantum/simulator'
import { simulateCliffordCircuit, isCliffordCircuit } from '@/lib/quantum/clifford-simulator'
import { simulateWithTensorNetwork, estimateTensorNetworkFeasibility } from '@/lib/quantum/tensor-network'
import { simulateWithCircuitCutting } from '@/lib/quantum/circuit-cutting'
import { analyzeCircuit } from '@/lib/quantum/circuit-analyzer'
import { client } from '@/lib/amplify-client'
import type { SimulationResult, SimulationConfig, SimulationTier, CircuitAnalysis, SimulationBackend } from '@/types/simulator'

const LAMBDA_SMALL_MAX = 24
const LAMBDA_MEDIUM_MAX = 26
const LAMBDA_LARGE_MAX = 27

function extractResponseData(response: unknown): Record<string, unknown> | null {
  if (!response || typeof response !== 'object') return null
  if ('data' in response) {
    const data = (response as { data: unknown }).data
    return data ? JSON.parse(JSON.stringify(data)) : null
  }
  return response as Record<string, unknown>
}

export function useSimulator() {
  const {
    circuit,
    simulationResult,
    isSimulating,
    simulationConfig,
    setSimulationResult,
    setSimulating,
    setError,
  } = useSimulatorStore()

  const [analysis, setAnalysis] = useState<CircuitAnalysis | null>(null)

  const runBrowserSimulation = useCallback(
    (shots: number): SimulationResult => {
      return simulateCircuit(circuit, shots)
    },
    [circuit]
  )

  const runCliffordSimulation = useCallback(
    (shots: number): SimulationResult => {
      return simulateCliffordCircuit(circuit, shots)
    },
    [circuit]
  )

  const runTensorNetworkSimulation = useCallback(
    (shots: number): SimulationResult => {
      return simulateWithTensorNetwork(circuit, shots)
    },
    [circuit]
  )

  const runCircuitCuttingSimulation = useCallback(
    (shots: number): SimulationResult => {
      return simulateWithCircuitCutting(circuit, shots)
    },
    [circuit]
  )

  const runLambdaSimulation = useCallback(
    async (shots: number, tier: 'small' | 'medium' | 'large'): Promise<SimulationResult> => {
      const gates = circuit.gates.map((g) => ({
        name: g.type,
        qubits: g.qubits,
        params: g.parameters,
      }))

      const circuitData = {
        numQubits: circuit.numQubits,
        gates: gates
      }

      const mutationMap = {
        small: 'runSimulatorSmall',
        medium: 'runSimulatorMedium',
        large: 'runSimulatorLarge',
      }

      const mutationName = mutationMap[tier]
      const mutation = (client.mutations as Record<string, Function>)[mutationName]

      if (!mutation) {
        throw new Error(`Mutation ${mutationName} not available`)
      }

      const response = await mutation({
        circuitId: circuit.id,
        numQubits: circuit.numQubits,
        gates: JSON.stringify(circuitData),
        shots,
        measureQubits: Array.from({ length: circuit.numQubits }, (_, i) => i),
      })

      const data = extractResponseData(response)

      if (!data || !(data as Record<string, unknown>).success) {
        throw new Error((data as Record<string, unknown>)?.error as string || 'Lambda simulation failed')
      }

      const typedData = data as {
        circuitId?: string
        executionTimeMs?: number
        counts?: Record<string, number>
        probabilities?: Record<string, number>
        stateVector?: number[][]
        tier?: string
      }

      return {
        circuitId: circuit.id,
        backend: `lambda_${tier}` as SimulationBackend,
        method: 'state-vector',
        executionTime: typedData.executionTimeMs || 0,
        shots,
        counts: typedData.counts || {},
        probabilities: typedData.probabilities || {},
        stateVector: typedData.stateVector?.map((sv: number[]) => ({ re: sv[0], im: sv[1] })),
        blochVectors: [],
        metadata: {
          tier: `lambda_${tier}` as SimulationTier
        }
      }
    },
    [circuit]
  )

  const runSimulation = useCallback(
    async (config?: Partial<SimulationConfig>) => {
      setSimulating(true)
      setError(null)

      try {
        const finalConfig = { ...simulationConfig, ...config }
        const shots = finalConfig.shots || 1024
        const preferredMethod = finalConfig.preferredMethod || 'auto'

        const circuitAnalysis = analyzeCircuit(circuit)
        setAnalysis(circuitAnalysis)

        let result: SimulationResult

        if (preferredMethod !== 'auto') {
          switch (preferredMethod) {
            case 'clifford':
              if (!isCliffordCircuit(circuit)) {
                throw new Error('Circuit contains non-Clifford gates')
              }
              result = runCliffordSimulation(shots)
              break
            case 'tensor_network':
              const feasibility = estimateTensorNetworkFeasibility(circuit)
              if (!feasibility.feasible) {
                throw new Error(feasibility.reason || 'Tensor network not feasible')
              }
              result = runTensorNetworkSimulation(shots)
              break
            case 'circuit_cutting':
              result = runCircuitCuttingSimulation(shots)
              break
            case 'state-vector':
            default:
              if (circuit.numQubits <= BROWSER_MAX_QUBITS) {
                result = runBrowserSimulation(shots)
              } else if (circuit.numQubits <= LAMBDA_SMALL_MAX) {
                result = await runLambdaSimulation(shots, 'small')
              } else if (circuit.numQubits <= LAMBDA_MEDIUM_MAX) {
                result = await runLambdaSimulation(shots, 'medium')
              } else if (circuit.numQubits <= LAMBDA_LARGE_MAX) {
                result = await runLambdaSimulation(shots, 'large')
              } else {
                throw new Error(`State-vector simulation supports max ${LAMBDA_LARGE_MAX} qubits`)
              }
              break
          }
        } else {
          switch (circuitAnalysis.recommendedMethod) {
            case 'clifford':
              result = runCliffordSimulation(shots)
              break
            case 'tensor_network':
              result = runTensorNetworkSimulation(shots)
              break
            case 'circuit_cutting':
              result = runCircuitCuttingSimulation(shots)
              break
            case 'state-vector':
            default:
              if (circuit.numQubits <= BROWSER_MAX_QUBITS) {
                result = runBrowserSimulation(shots)
              } else if (circuit.numQubits <= LAMBDA_SMALL_MAX) {
                result = await runLambdaSimulation(shots, 'small')
              } else if (circuit.numQubits <= LAMBDA_MEDIUM_MAX) {
                result = await runLambdaSimulation(shots, 'medium')
              } else if (circuit.numQubits <= LAMBDA_LARGE_MAX) {
                result = await runLambdaSimulation(shots, 'large')
              } else {
                throw new Error(
                  `Circuit has ${circuit.numQubits} qubits. Maximum for state-vector is ${LAMBDA_LARGE_MAX}.`
                )
              }
              break
          }
        }

        setSimulationResult(result)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Simulation failed'
        setError(message)
        throw err
      } finally {
        setSimulating(false)
      }
    },
    [
      circuit,
      simulationConfig,
      setSimulating,
      setSimulationResult,
      setError,
      runBrowserSimulation,
      runCliffordSimulation,
      runTensorNetworkSimulation,
      runCircuitCuttingSimulation,
      runLambdaSimulation,
    ]
  )

  const getSimulationBackend = useCallback((): SimulationBackend => {
    const circuitAnalysis = analyzeCircuit(circuit)

    if (circuitAnalysis.recommendedMethod === 'clifford') {
      return 'clifford'
    }
    if (circuitAnalysis.recommendedMethod === 'tensor_network') {
      return 'tensor_network'
    }
    if (circuitAnalysis.recommendedMethod === 'circuit_cutting') {
      return 'circuit_cutting'
    }

    if (circuit.numQubits <= BROWSER_MAX_QUBITS) {
      return 'browser'
    } else if (circuit.numQubits <= LAMBDA_SMALL_MAX) {
      return 'lambda_small'
    } else if (circuit.numQubits <= LAMBDA_MEDIUM_MAX) {
      return 'lambda_medium'
    } else if (circuit.numQubits <= LAMBDA_LARGE_MAX) {
      return 'lambda_large'
    } else {
      return 'unsupported'
    }
  }, [circuit])

  const getEstimatedCost = useCallback((): number => {
    const backend = getSimulationBackend()
    switch (backend) {
      case 'browser':
        return 0
      case 'lambda_small':
        return 0.00001
      case 'lambda_medium':
        return 0.00005
      case 'lambda_large':
        return 0.0001
      case 'clifford':
      case 'tensor_network':
      case 'circuit_cutting':
        return 0.001
      default:
        return 0
    }
  }, [getSimulationBackend])

  const getEstimatedTime = useCallback((): string => {
    const circuitAnalysis = analyzeCircuit(circuit)
    return circuitAnalysis.estimatedTime
  }, [circuit])

  const getCircuitAnalysis = useCallback((): CircuitAnalysis => {
    return analyzeCircuit(circuit)
  }, [circuit])

  return {
    circuit,
    simulationResult,
    isSimulating,
    analysis,

    runSimulation,

    getSimulationBackend,
    getEstimatedCost,
    getEstimatedTime,
    getCircuitAnalysis,

    maxBrowserQubits: BROWSER_MAX_QUBITS,
    maxLambdaSmallQubits: LAMBDA_SMALL_MAX,
    maxLambdaMediumQubits: LAMBDA_MEDIUM_MAX,
    maxLambdaLargeQubits: LAMBDA_LARGE_MAX,
  }
}
