import type { QuantumCircuit, CircuitGate, CircuitAnalysis, SimulationTier, GateType } from '@/types/simulator'

const CLIFFORD_GATES: Set<GateType> = new Set(['H', 'S', 'Sdg', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'CY', 'SWAP', 'Barrier', 'Reset'])

const BROWSER_MAX = 20
const LAMBDA_SMALL_MAX = 24
const LAMBDA_MEDIUM_MAX = 26
const LAMBDA_LARGE_MAX = 27
const TENSOR_NETWORK_MAX = 100
const CIRCUIT_CUTTING_MAX = 54

export function analyzeCircuit(circuit: QuantumCircuit): CircuitAnalysis {
  const { numQubits, gates } = circuit

  const gateTypes = new Set<GateType>(gates.map(g => g.type))
  const isCliffordOnly = gates.every(g => CLIFFORD_GATES.has(g.type))
  const depth = calculateDepth(gates, numQubits)
  const entanglementScore = calculateEntanglementScore(gates, numQubits)
  const cutPoints = findCutPoints(gates, numQubits)

  const { recommendedTier, recommendedMethod } = getRecommendation(
    numQubits,
    isCliffordOnly,
    entanglementScore,
    cutPoints.length
  )

  return {
    numQubits,
    numGates: gates.length,
    depth,
    gateTypes,
    isCliffordOnly,
    entanglementScore,
    recommendedTier,
    recommendedMethod,
    estimatedTime: estimateTime(numQubits, gates.length, recommendedMethod),
    estimatedCost: estimateCost(recommendedTier),
    cutPoints: cutPoints.length > 0 ? cutPoints : undefined,
  }
}

function calculateDepth(gates: CircuitGate[], numQubits: number): number {
  const qubitLastPosition = new Array(numQubits).fill(0)
  let maxDepth = 0

  const sortedGates = [...gates].sort((a, b) => a.position - b.position)

  for (const gate of sortedGates) {
    const affectedQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    const maxPrev = Math.max(...affectedQubits.map(q => qubitLastPosition[q] || 0))
    const newDepth = maxPrev + 1

    for (const q of affectedQubits) {
      qubitLastPosition[q] = newDepth
    }

    maxDepth = Math.max(maxDepth, newDepth)
  }

  return maxDepth
}

function calculateEntanglementScore(gates: CircuitGate[], numQubits: number): number {
  if (numQubits <= 1) return 0

  const adjacency = Array.from({ length: numQubits }, () => new Set<number>())
  let twoQubitGateCount = 0

  for (const gate of gates) {
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    if (allQubits.length >= 2) {
      twoQubitGateCount++
      for (let i = 0; i < allQubits.length; i++) {
        for (let j = i + 1; j < allQubits.length; j++) {
          adjacency[allQubits[i]].add(allQubits[j])
          adjacency[allQubits[j]].add(allQubits[i])
        }
      }
    }
  }

  let totalConnections = 0
  for (let i = 0; i < numQubits; i++) {
    totalConnections += adjacency[i].size
  }
  const avgDegree = totalConnections / numQubits

  const maxPossible = numQubits - 1
  const connectivityScore = avgDegree / maxPossible

  const maxTwoQubitGates = numQubits * (numQubits - 1) / 2
  const densityScore = Math.min(1, twoQubitGateCount / maxTwoQubitGates)

  return (connectivityScore + densityScore) / 2
}

function findCutPoints(gates: CircuitGate[], numQubits: number): number[] {
  if (numQubits <= LAMBDA_LARGE_MAX) return []

  const crossings = new Array(numQubits - 1).fill(0)

  for (const gate of gates) {
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    if (allQubits.length >= 2) {
      const minQ = Math.min(...allQubits)
      const maxQ = Math.max(...allQubits)
      for (let i = minQ; i < maxQ; i++) {
        crossings[i]++
      }
    }
  }

  const cuts: number[] = []
  const targetSize = Math.ceil(numQubits / Math.ceil(numQubits / LAMBDA_LARGE_MAX))

  for (let start = targetSize - 1; start < numQubits - 1; start += targetSize) {
    let minCrossing = Infinity
    let bestCut = start

    for (let i = Math.max(0, start - 3); i <= Math.min(numQubits - 2, start + 3); i++) {
      if (crossings[i] < minCrossing) {
        minCrossing = crossings[i]
        bestCut = i
      }
    }

    cuts.push(bestCut)
  }

  return cuts
}

function getRecommendation(
  numQubits: number,
  isCliffordOnly: boolean,
  entanglementScore: number,
  numCuts: number
): { recommendedTier: SimulationTier; recommendedMethod: 'state-vector' | 'clifford' | 'tensor_network' | 'circuit_cutting' } {

  if (isCliffordOnly && numQubits > LAMBDA_LARGE_MAX) {
    return { recommendedTier: 'special', recommendedMethod: 'clifford' }
  }

  if (numQubits <= BROWSER_MAX) {
    return { recommendedTier: 'browser', recommendedMethod: 'state-vector' }
  }

  if (numQubits <= LAMBDA_SMALL_MAX) {
    return { recommendedTier: 'lambda_small', recommendedMethod: 'state-vector' }
  }

  if (numQubits <= LAMBDA_MEDIUM_MAX) {
    return { recommendedTier: 'lambda_medium', recommendedMethod: 'state-vector' }
  }

  if (numQubits <= LAMBDA_LARGE_MAX) {
    return { recommendedTier: 'lambda_large', recommendedMethod: 'state-vector' }
  }

  if (isCliffordOnly) {
    return { recommendedTier: 'special', recommendedMethod: 'clifford' }
  }

  if (entanglementScore < 0.3 && numQubits <= TENSOR_NETWORK_MAX) {
    return { recommendedTier: 'special', recommendedMethod: 'tensor_network' }
  }

  if (numQubits <= CIRCUIT_CUTTING_MAX && numCuts <= 3) {
    return { recommendedTier: 'special', recommendedMethod: 'circuit_cutting' }
  }

  if (isCliffordOnly) {
    return { recommendedTier: 'special', recommendedMethod: 'clifford' }
  }

  return { recommendedTier: 'special', recommendedMethod: 'tensor_network' }
}

function estimateTime(numQubits: number, numGates: number, method: string): string {
  if (method === 'state-vector') {
    if (numQubits <= BROWSER_MAX) return 'Instant'
    const stateSize = Math.pow(2, numQubits)
    const ops = stateSize * numGates
    const seconds = ops / 1e9
    if (seconds < 1) return '<1s'
    if (seconds < 60) return `~${Math.ceil(seconds)}s`
    return `~${Math.ceil(seconds / 60)}min`
  }

  if (method === 'clifford') {
    const ops = numQubits * numQubits * numGates
    const seconds = ops / 1e9
    if (seconds < 1) return 'Instant'
    return `~${Math.ceil(seconds)}s`
  }

  if (method === 'tensor_network') {
    return numQubits <= 50 ? '~30s' : '~2min'
  }

  if (method === 'circuit_cutting') {
    return '~1-5min'
  }

  return 'Unknown'
}

function estimateCost(tier: SimulationTier): number {
  switch (tier) {
    case 'browser':
      return 0
    case 'lambda_small':
      return 0.00001
    case 'lambda_medium':
      return 0.00005
    case 'lambda_large':
      return 0.0001
    case 'special':
      return 0.001
    default:
      return 0
  }
}

export function canSimulate(circuit: QuantumCircuit): { canSimulate: boolean; reason?: string; analysis: CircuitAnalysis } {
  const analysis = analyzeCircuit(circuit)

  if (analysis.numQubits > 10000 && analysis.isCliffordOnly) {
    return { canSimulate: true, analysis }
  }

  if (analysis.numQubits > TENSOR_NETWORK_MAX && !analysis.isCliffordOnly && analysis.entanglementScore >= 0.3) {
    return {
      canSimulate: false,
      reason: `Circuit has ${analysis.numQubits} qubits with high entanglement (${(analysis.entanglementScore * 100).toFixed(1)}%). Maximum for general circuits is ${TENSOR_NETWORK_MAX} qubits.`,
      analysis
    }
  }

  if (analysis.numQubits > CIRCUIT_CUTTING_MAX && !analysis.isCliffordOnly) {
    return {
      canSimulate: false,
      reason: `Circuit has ${analysis.numQubits} qubits. Circuit cutting supports up to ${CIRCUIT_CUTTING_MAX} qubits with optimal cuts.`,
      analysis
    }
  }

  return { canSimulate: true, analysis }
}

export function getSimulationOptions(circuit: QuantumCircuit): {
  primary: { method: string; tier: SimulationTier; reason: string };
  alternatives: { method: string; tier: SimulationTier; reason: string }[];
} {
  const analysis = analyzeCircuit(circuit)
  const options: { method: string; tier: SimulationTier; reason: string }[] = []

  if (analysis.numQubits <= BROWSER_MAX) {
    options.push({
      method: 'state-vector',
      tier: 'browser',
      reason: 'Free, instant, works offline'
    })
  }

  if (analysis.numQubits > BROWSER_MAX && analysis.numQubits <= LAMBDA_LARGE_MAX) {
    const tier = analysis.numQubits <= LAMBDA_SMALL_MAX
      ? 'lambda_small'
      : analysis.numQubits <= LAMBDA_MEDIUM_MAX
        ? 'lambda_medium'
        : 'lambda_large'
    options.push({
      method: 'state-vector',
      tier,
      reason: 'Full state-vector simulation in cloud'
    })
  }

  if (analysis.isCliffordOnly) {
    options.push({
      method: 'clifford',
      tier: 'special',
      reason: `Clifford circuits: O(n²) memory, supports 1000+ qubits`
    })
  }

  if (analysis.entanglementScore < 0.3 && analysis.numQubits <= TENSOR_NETWORK_MAX) {
    options.push({
      method: 'tensor_network',
      tier: 'special',
      reason: `Low entanglement (${(analysis.entanglementScore * 100).toFixed(1)}%): efficient tensor contraction`
    })
  }

  if (analysis.numQubits > LAMBDA_LARGE_MAX && analysis.cutPoints && analysis.cutPoints.length <= 3) {
    options.push({
      method: 'circuit_cutting',
      tier: 'special',
      reason: `Split into ${analysis.cutPoints.length + 1} subcircuits with parallel execution`
    })
  }

  const primary = options.find(o => o.method === analysis.recommendedMethod && o.tier === analysis.recommendedTier) || options[0]
  const alternatives = options.filter(o => o !== primary)

  return { primary, alternatives }
}
