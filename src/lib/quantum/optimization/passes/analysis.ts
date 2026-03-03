import type { CircuitGate, GateType, QuantumCircuit } from '@/types/simulator'
import { createPass, noOpResult, passRegistry, type PassResult, type PassAction } from '../registry'


function cloneCircuit(circuit: QuantumCircuit): QuantumCircuit {
  return JSON.parse(JSON.stringify(circuit))
}


function entanglementAnalysisPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)

  const connected: Map<number, Set<number>> = new Map()

  for (let q = 0; q < result.numQubits; q++) {
    connected.set(q, new Set([q]))
  }

  for (const gate of result.gates) {
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    if (allQubits.length >= 2) {
      let mergedSet = new Set<number>()
      for (const q of allQubits) {
        const existing = connected.get(q)!
        for (const eq of existing) {
          mergedSet.add(eq)
        }
      }

      for (const q of mergedSet) {
        connected.set(q, mergedSet)
      }
    }
  }

  const subsystems: Set<number>[] = []
  const seen = new Set<number>()

  for (let q = 0; q < result.numQubits; q++) {
    if (!seen.has(q)) {
      const subsystem = connected.get(q)!
      subsystems.push(subsystem)
      for (const sq of subsystem) {
        seen.add(sq)
      }
    }
  }

  const actions: PassAction[] = []

  if (subsystems.length > 1) {
    actions.push({
      type: 'reorder',
      gateIds: [],
      description: `Circuit has ${subsystems.length} separable subsystems: ${
        subsystems.map((s) => `[${[...s].join(',')}]`).join(', ')
      }`,
    })
  }

  return {
    circuit: result,
    actions,
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: actions.length > 0,
  }
}

export const entanglementAnalysis = createPass({
  id: 'H3_entanglement_analysis',
  name: 'Entanglement Analysis',
  category: 'analysis',
  description: 'Find separable subsystems in the circuit',
  timing: 'deep',
  priority: 3,
  enabled: true,
  estimatedTimeMs: 5,
  apply: entanglementAnalysisPass,
})


export interface ResourceEstimate {
  gateCount: number
  depth: number
  twoQubitGates: number
  tCount: number
  cliffordCount: number
  rotationCount: number
  cnotCount: number
}

function resourceEstimationPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)

  const CLIFFORD_GATES: GateType[] = ['H', 'S', 'Sdg', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'CY', 'SWAP']
  const ROTATION_GATES: GateType[] = ['Rx', 'Ry', 'Rz', 'Phase', 'U', 'U1', 'U2', 'U3', 'CRx', 'CRy', 'CRz', 'CPhase']

  let tCount = 0
  let cliffordCount = 0
  let rotationCount = 0
  let cnotCount = 0
  let twoQubitGates = 0

  for (const gate of result.gates) {
    if (gate.type === 'T' || gate.type === 'Tdg') {
      tCount++
    }

    if (CLIFFORD_GATES.includes(gate.type)) {
      cliffordCount++
    }

    if (ROTATION_GATES.includes(gate.type)) {
      rotationCount++
    }

    if (gate.type === 'CNOT' || gate.type === 'CX') {
      cnotCount++
    }

    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    if (allQubits.length >= 2) {
      twoQubitGates++
    }
  }

  const qubitDepth: number[] = new Array(result.numQubits).fill(0)
  const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

  for (const gate of sortedGates) {
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    const maxDepth = Math.max(...allQubits.map((q) => qubitDepth[q] || 0))

    for (const q of allQubits) {
      qubitDepth[q] = maxDepth + 1
    }
  }

  const depth = Math.max(...qubitDepth, 0)

  const estimate: ResourceEstimate = {
    gateCount: result.gates.length,
    depth,
    twoQubitGates,
    tCount,
    cliffordCount,
    rotationCount,
    cnotCount,
  }


  const actions: PassAction[] = [{
    type: 'reorder',
    gateIds: [],
    description: `Resources: ${estimate.gateCount} gates, depth ${depth}, ${twoQubitGates} 2q gates, T-count ${tCount}`,
  }]

  return {
    circuit: result,
    actions,
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: true,
  }
}

export const resourceEstimation = createPass({
  id: 'H4_resource_estimation',
  name: 'Resource Estimation',
  category: 'analysis',
  description: 'Count gates, depth, T-count, etc.',
  timing: 'fast',
  priority: 4,
  enabled: true,
  estimatedTimeMs: 2,
  apply: resourceEstimationPass,
})


function cliffordDetectionPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)

  const CLIFFORD_GATES: GateType[] = ['H', 'S', 'Sdg', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'CY', 'SWAP']

  const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

  const sections: { start: number; end: number; gateCount: number }[] = []
  let currentStart: number | null = null
  let currentCount = 0

  for (let i = 0; i < sortedGates.length; i++) {
    const gate = sortedGates[i]
    const isClifford = CLIFFORD_GATES.includes(gate.type)

    if (isClifford) {
      if (currentStart === null) {
        currentStart = i
        currentCount = 1
      } else {
        currentCount++
      }
    } else {
      if (currentStart !== null && currentCount >= 3) {
        sections.push({ start: currentStart, end: i - 1, gateCount: currentCount })
      }
      currentStart = null
      currentCount = 0
    }
  }

  if (currentStart !== null && currentCount >= 3) {
    sections.push({ start: currentStart, end: sortedGates.length - 1, gateCount: currentCount })
  }

  const actions: PassAction[] = []

  if (sections.length > 0) {
    const totalClifford = sections.reduce((sum, s) => sum + s.gateCount, 0)
    actions.push({
      type: 'reorder',
      gateIds: [],
      description: `Found ${sections.length} Clifford sections (${totalClifford} gates) - can use stabilizer simulation`,
    })
  }

  const allClifford = result.gates.every((g) => CLIFFORD_GATES.includes(g.type))
  if (allClifford && result.gates.length > 0) {
    actions.push({
      type: 'reorder',
      gateIds: [],
      description: 'Circuit is entirely Clifford - can use efficient stabilizer simulation',
    })
  }

  return {
    circuit: result,
    actions,
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: actions.length > 0,
  }
}

export const cliffordDetection = createPass({
  id: 'H5_clifford_detection',
  name: 'Clifford Detection',
  category: 'analysis',
  description: 'Find Clifford-only sections for efficient simulation',
  timing: 'standard',
  priority: 5,
  enabled: true,
  estimatedTimeMs: 3,
  apply: cliffordDetectionPass,
})


export function getResourceEstimate(circuit: QuantumCircuit): ResourceEstimate {
  const result = resourceEstimationPass(circuit)

  const CLIFFORD_GATES: GateType[] = ['H', 'S', 'Sdg', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'CY', 'SWAP']
  const ROTATION_GATES: GateType[] = ['Rx', 'Ry', 'Rz', 'Phase', 'U', 'U1', 'U2', 'U3', 'CRx', 'CRy', 'CRz', 'CPhase']

  let tCount = 0
  let cliffordCount = 0
  let rotationCount = 0
  let cnotCount = 0
  let twoQubitGates = 0

  for (const gate of circuit.gates) {
    if (gate.type === 'T' || gate.type === 'Tdg') tCount++
    if (CLIFFORD_GATES.includes(gate.type)) cliffordCount++
    if (ROTATION_GATES.includes(gate.type)) rotationCount++
    if (gate.type === 'CNOT' || gate.type === 'CX') cnotCount++
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    if (allQubits.length >= 2) twoQubitGates++
  }

  const qubitDepth: number[] = new Array(circuit.numQubits).fill(0)
  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

  for (const gate of sortedGates) {
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    const maxDepth = Math.max(...allQubits.map((q) => qubitDepth[q] || 0))
    for (const q of allQubits) qubitDepth[q] = maxDepth + 1
  }

  return {
    gateCount: circuit.gates.length,
    depth: Math.max(...qubitDepth, 0),
    twoQubitGates,
    tCount,
    cliffordCount,
    rotationCount,
    cnotCount,
  }
}


export function registerAnalysisPasses(): void {
  passRegistry.register(entanglementAnalysis)
  passRegistry.register(resourceEstimation)
  passRegistry.register(cliffordDetection)
}
