import type { QuantumCircuit, SimulationResult, SimulationConfig, SimulationBackend, CircuitAnalysis } from '@/types/simulator'
import { analyzeCircuit, canSimulate, getSimulationOptions } from './circuit-analyzer'
import { simulateCircuit, BROWSER_MAX_QUBITS } from './simulator'
import { simulateCliffordCircuit, isCliffordCircuit } from './clifford-simulator'
import { simulateWithTensorNetwork, estimateTensorNetworkFeasibility } from './tensor-network'
import { simulateWithCircuitCutting, prepareParallelPayloads } from './circuit-cutting'
import { client } from '@/lib/amplify-client'

export interface OrchestrationResult {
  result: SimulationResult
  analysis: CircuitAnalysis
  methodUsed: string
  tierUsed: string
  fallbackReason?: string
}

export interface SimulationProgress {
  stage: 'analyzing' | 'preparing' | 'simulating' | 'combining' | 'completed' | 'failed'
  progress: number
  message: string
  subcircuitsCompleted?: number
  totalSubcircuits?: number
}

export type ProgressCallback = (progress: SimulationProgress) => void

function extractResponseData(response: unknown): Record<string, unknown> | null {
  if (!response || typeof response !== 'object') return null
  if ('data' in response) {
    const data = (response as { data: unknown }).data
    return data ? JSON.parse(JSON.stringify(data)) : null
  }
  return response as Record<string, unknown>
}

export async function orchestrateSimulation(
  circuit: QuantumCircuit,
  config: SimulationConfig = { shots: 1024 },
  onProgress?: ProgressCallback
): Promise<OrchestrationResult> {
  const shots = config.shots || 1024
  const preferredMethod = config.preferredMethod || 'auto'

  onProgress?.({
    stage: 'analyzing',
    progress: 0,
    message: 'Analyzing circuit...'
  })

  const analysis = analyzeCircuit(circuit)
  const { canSimulate: isSimulatable, reason } = canSimulate(circuit)

  if (!isSimulatable) {
    throw new Error(reason || 'Circuit cannot be simulated with available methods')
  }

  onProgress?.({
    stage: 'preparing',
    progress: 10,
    message: `Preparing ${analysis.recommendedMethod} simulation...`
  })

  if (preferredMethod !== 'auto') {
    try {
      const result = await runWithMethod(circuit, preferredMethod, shots, onProgress)
      return {
        result,
        analysis,
        methodUsed: preferredMethod,
        tierUsed: analysis.recommendedTier
      }
    } catch (error) {
      const fallbackResult = await runWithMethod(circuit, analysis.recommendedMethod, shots, onProgress)
      return {
        result: fallbackResult,
        analysis,
        methodUsed: analysis.recommendedMethod,
        tierUsed: analysis.recommendedTier,
        fallbackReason: `Preferred method '${preferredMethod}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  const result = await runWithMethod(circuit, analysis.recommendedMethod, shots, onProgress)
  return {
    result,
    analysis,
    methodUsed: analysis.recommendedMethod,
    tierUsed: analysis.recommendedTier
  }
}

async function runWithMethod(
  circuit: QuantumCircuit,
  method: string,
  shots: number,
  onProgress?: ProgressCallback
): Promise<SimulationResult> {
  switch (method) {
    case 'state-vector':
      return runStateVectorSimulation(circuit, shots, onProgress)
    case 'clifford':
      return runCliffordSimulation(circuit, shots, onProgress)
    case 'tensor_network':
      return runTensorNetworkSimulation(circuit, shots, onProgress)
    case 'circuit_cutting':
      return runCircuitCuttingSimulation(circuit, shots, onProgress)
    default:
      throw new Error(`Unknown simulation method: ${method}`)
  }
}

async function runStateVectorSimulation(
  circuit: QuantumCircuit,
  shots: number,
  onProgress?: ProgressCallback
): Promise<SimulationResult> {
  onProgress?.({
    stage: 'simulating',
    progress: 20,
    message: 'Running state-vector simulation...'
  })

  if (circuit.numQubits <= BROWSER_MAX_QUBITS) {
    const result = simulateCircuit(circuit, shots)
    onProgress?.({
      stage: 'completed',
      progress: 100,
      message: 'Simulation completed'
    })
    return result
  }

  const gates = circuit.gates.map(g => ({
    type: g.type,
    qubits: g.qubits,
    controlQubits: g.controlQubits,
    parameters: g.parameters,
    position: g.position
  }))

  let mutationName: string
  if (circuit.numQubits <= 24) {
    mutationName = 'runSimulationSmall'
  } else if (circuit.numQubits <= 26) {
    mutationName = 'runSimulationMedium'
  } else {
    mutationName = 'runSimulationLarge'
  }

  onProgress?.({
    stage: 'simulating',
    progress: 50,
    message: `Running cloud simulation (${mutationName})...`
  })

  const response = await (client.mutations as Record<string, Function>)[mutationName]?.({
    circuitId: circuit.id,
    numQubits: circuit.numQubits,
    gates: JSON.stringify(gates),
    shots,
    includeStateVector: circuit.numQubits <= 12
  })

  const data = extractResponseData(response)

  if (!data || !(data as Record<string, unknown>).success) {
    throw new Error((data as Record<string, unknown>)?.error as string || 'Lambda simulation failed')
  }

  onProgress?.({
    stage: 'completed',
    progress: 100,
    message: 'Simulation completed'
  })

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
    backend: mutationName.replace('runSimulation', 'lambda_').toLowerCase() as SimulationBackend,
    method: 'state-vector',
    executionTime: typedData.executionTimeMs || 0,
    shots,
    counts: typedData.counts || {},
    probabilities: typedData.probabilities || {},
    stateVector: typedData.stateVector?.map((sv: number[]) => ({ re: sv[0], im: sv[1] })),
    metadata: {
      tier: typedData.tier as 'browser' | 'lambda_small' | 'lambda_medium' | 'lambda_large' | 'special' || 'lambda_small'
    }
  }
}

async function runCliffordSimulation(
  circuit: QuantumCircuit,
  shots: number,
  onProgress?: ProgressCallback
): Promise<SimulationResult> {
  if (!isCliffordCircuit(circuit)) {
    throw new Error('Circuit contains non-Clifford gates')
  }

  onProgress?.({
    stage: 'simulating',
    progress: 30,
    message: `Running Clifford simulation (${circuit.numQubits} qubits)...`
  })

  const batchSize = Math.ceil(shots / 10)
  for (let i = 0; i < 10; i++) {
    onProgress?.({
      stage: 'simulating',
      progress: 30 + i * 7,
      message: `Processing batch ${i + 1}/10...`
    })
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  const result = simulateCliffordCircuit(circuit, shots)

  onProgress?.({
    stage: 'completed',
    progress: 100,
    message: 'Clifford simulation completed'
  })

  return result
}

async function runTensorNetworkSimulation(
  circuit: QuantumCircuit,
  shots: number,
  onProgress?: ProgressCallback
): Promise<SimulationResult> {
  const feasibility = estimateTensorNetworkFeasibility(circuit)

  if (!feasibility.feasible) {
    throw new Error(feasibility.reason || 'Tensor network simulation not feasible')
  }

  onProgress?.({
    stage: 'simulating',
    progress: 30,
    message: `Running tensor network simulation (bond dim ~${feasibility.estimatedBondDimension})...`
  })

  const result = simulateWithTensorNetwork(circuit, shots)

  onProgress?.({
    stage: 'completed',
    progress: 100,
    message: 'Tensor network simulation completed'
  })

  return result
}

async function runCircuitCuttingSimulation(
  circuit: QuantumCircuit,
  shots: number,
  onProgress?: ProgressCallback
): Promise<SimulationResult> {
  const payloads = prepareParallelPayloads(circuit, shots)

  onProgress?.({
    stage: 'preparing',
    progress: 20,
    message: `Preparing ${payloads.length} subcircuit simulations...`,
    totalSubcircuits: payloads.length,
    subcircuitsCompleted: 0
  })

  onProgress?.({
    stage: 'simulating',
    progress: 30,
    message: 'Running subcircuit simulations...',
    totalSubcircuits: payloads.length,
    subcircuitsCompleted: 0
  })

  const result = simulateWithCircuitCutting(circuit, shots)

  for (let i = 0; i < payloads.length; i++) {
    onProgress?.({
      stage: 'simulating',
      progress: 30 + (i + 1) * (50 / payloads.length),
      message: `Completed subcircuit ${i + 1}/${payloads.length}`,
      totalSubcircuits: payloads.length,
      subcircuitsCompleted: i + 1
    })
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  onProgress?.({
    stage: 'combining',
    progress: 85,
    message: 'Combining subcircuit results...'
  })

  onProgress?.({
    stage: 'completed',
    progress: 100,
    message: 'Circuit cutting simulation completed'
  })

  return result
}

export function getRecommendedSimulation(circuit: QuantumCircuit): {
  method: string
  tier: string
  estimatedTime: string
  estimatedCost: number
  capabilities: string[]
  limitations: string[]
} {
  const analysis = analyzeCircuit(circuit)
  const options = getSimulationOptions(circuit)

  const capabilities: string[] = []
  const limitations: string[] = []

  switch (analysis.recommendedMethod) {
    case 'state-vector':
      capabilities.push('Full state vector access', 'Exact probabilities', 'Bloch sphere visualization')
      if (circuit.numQubits > BROWSER_MAX_QUBITS) {
        limitations.push('Requires cloud execution', 'No offline support')
      }
      break
    case 'clifford':
      capabilities.push('Supports 1000+ qubits', 'O(n²) memory', 'Fast execution')
      limitations.push('Clifford gates only', 'No state vector', 'Sampling only')
      break
    case 'tensor_network':
      capabilities.push('Efficient for low entanglement', 'Up to 100 qubits')
      limitations.push('Slow for high entanglement', 'Approximate results possible')
      break
    case 'circuit_cutting':
      capabilities.push('Handles large circuits', 'Parallel execution')
      limitations.push('Exponential overhead per cut', 'Approximate results')
      break
  }

  return {
    method: analysis.recommendedMethod,
    tier: analysis.recommendedTier,
    estimatedTime: analysis.estimatedTime,
    estimatedCost: analysis.estimatedCost,
    capabilities,
    limitations
  }
}
