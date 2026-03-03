import { v4 as uuid } from 'uuid'
import type { CircuitGate, GateType, QuantumCircuit } from '@/types/simulator'
import { createPass, noOpResult, passRegistry, type PassResult, type PassAction } from '../registry'


function cloneCircuit(circuit: QuantumCircuit): QuantumCircuit {
  return JSON.parse(JSON.stringify(circuit))
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}


function swapDecompositionPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  for (const gate of result.gates) {
    if (gate.type === 'SWAP') {
      const [q1, q2] = gate.qubits

      toRemove.add(gate.id)

      const cnot1: CircuitGate = {
        id: uuid(),
        type: 'CNOT',
        qubits: [q2],
        controlQubits: [q1],
        position: gate.position,
      }
      const cnot2: CircuitGate = {
        id: uuid(),
        type: 'CNOT',
        qubits: [q1],
        controlQubits: [q2],
        position: gate.position + 0.1,
      }
      const cnot3: CircuitGate = {
        id: uuid(),
        type: 'CNOT',
        qubits: [q2],
        controlQubits: [q1],
        position: gate.position + 0.2,
      }

      newGates.push(cnot1, cnot2, cnot3)

      actions.push({
        type: 'replace',
        gateIds: [gate.id],
        description: 'SWAP → 3 CNOTs',
        newGates: [cnot1, cnot2, cnot3],
      })
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))
  result.gates.push(...newGates)

  return {
    circuit: result,
    actions,
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: toRemove.size,
    applied: true,
  }
}

export const swapDecomposition = createPass({
  id: 'C1_swap_decomposition',
  name: 'SWAP Decomposition',
  category: 'template',
  description: 'Decompose SWAP into 3 CNOTs for hardware compatibility',
  timing: 'standard',
  priority: 1,
  enabled: false, // Off by default - increases gate count
  estimatedTimeMs: 3,
  apply: swapDecompositionPass,
})


function toffoliDecompositionPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  for (const gate of result.gates) {
    if (gate.type === 'Toffoli' && gate.controlQubits?.length === 2) {
      const [c1, c2] = gate.controlQubits
      const target = gate.qubits[0]

      toRemove.add(gate.id)

      const pos = gate.position
      let offset = 0

      const addGate = (type: GateType, qubits: number[], controlQubits?: number[]): CircuitGate => {
        const g: CircuitGate = {
          id: uuid(),
          type,
          qubits,
          controlQubits,
          position: pos + offset * 0.01,
        }
        offset++
        return g
      }

      const decomposed = [
        addGate('H', [target]),
        addGate('CNOT', [target], [c2]),
        addGate('Tdg', [target]),
        addGate('CNOT', [target], [c1]),
        addGate('T', [target]),
        addGate('CNOT', [target], [c2]),
        addGate('Tdg', [target]),
        addGate('CNOT', [target], [c1]),
        addGate('T', [c2]),
        addGate('T', [target]),
        addGate('H', [target]),
        addGate('CNOT', [c2], [c1]),
        addGate('T', [c1]),
        addGate('Tdg', [c2]),
        addGate('CNOT', [c2], [c1]),
      ]

      newGates.push(...decomposed)

      actions.push({
        type: 'replace',
        gateIds: [gate.id],
        description: 'Toffoli → 6 CNOTs + single-qubit gates',
        newGates: decomposed,
      })
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))
  result.gates.push(...newGates)

  return {
    circuit: result,
    actions,
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: toRemove.size,
    applied: true,
  }
}

export const toffoliDecomposition = createPass({
  id: 'C2_toffoli_decomposition',
  name: 'Toffoli Decomposition',
  category: 'template',
  description: 'Decompose Toffoli into native gates',
  timing: 'deep',
  priority: 2,
  enabled: false, // Off by default - increases gate count
  estimatedTimeMs: 5,
  apply: toffoliDecompositionPass,
})


function czToCnotPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  for (const gate of result.gates) {
    if (gate.type === 'CZ') {
      const control = gate.controlQubits?.[0] ?? gate.qubits[0]
      const target = gate.controlQubits?.length ? gate.qubits[0] : gate.qubits[1]

      toRemove.add(gate.id)

      const pos = gate.position
      const h1: CircuitGate = {
        id: uuid(),
        type: 'H',
        qubits: [target],
        position: pos,
      }
      const cnot: CircuitGate = {
        id: uuid(),
        type: 'CNOT',
        qubits: [target],
        controlQubits: [control],
        position: pos + 0.01,
      }
      const h2: CircuitGate = {
        id: uuid(),
        type: 'H',
        qubits: [target],
        position: pos + 0.02,
      }

      newGates.push(h1, cnot, h2)

      actions.push({
        type: 'replace',
        gateIds: [gate.id],
        description: 'CZ → H-CNOT-H',
        newGates: [h1, cnot, h2],
      })
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))
  result.gates.push(...newGates)

  return {
    circuit: result,
    actions,
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: toRemove.size,
    applied: true,
  }
}

export const czToCnot = createPass({
  id: 'C3_cz_to_cnot',
  name: 'CZ to CNOT',
  category: 'template',
  description: 'Convert CZ to H-CNOT-H',
  timing: 'deep',
  priority: 3,
  enabled: false, // Off by default
  estimatedTimeMs: 3,
  apply: czToCnotPass,
})


function hadamardSandwichPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedGates.length - 2; i++) {
    const g1 = sortedGates[i]
    const g2 = sortedGates[i + 1]
    const g3 = sortedGates[i + 2]

    if (toRemove.has(g1.id) || toRemove.has(g2.id) || toRemove.has(g3.id)) continue

    if (
      g1.type === 'H' &&
      g3.type === 'H' &&
      arraysEqual(g1.qubits, g3.qubits) &&
      arraysEqual(g1.qubits, g2.qubits)
    ) {
      let replacement: GateType | null = null

      if (g2.type === 'Z') replacement = 'X'
      else if (g2.type === 'X') replacement = 'Z'
      else if (g2.type === 'Y') replacement = 'Y' // H-Y-H = -Y ≈ Y (global phase)

      if (replacement) {
        toRemove.add(g1.id)
        toRemove.add(g2.id)
        toRemove.add(g3.id)

        const newGate: CircuitGate = {
          id: uuid(),
          type: replacement,
          qubits: [...g1.qubits],
          position: g1.position,
        }
        newGates.push(newGate)

        actions.push({
          type: 'replace',
          gateIds: [g1.id, g2.id, g3.id],
          description: `H-${g2.type}-H → ${replacement}`,
          newGates: [newGate],
        })
      }
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))
  result.gates.push(...newGates)

  return {
    circuit: result,
    actions,
    gatesRemoved: toRemove.size - newGates.length,
    gatesMerged: 0,
    gatesReplaced: actions.length,
    applied: true,
  }
}

export const hadamardSandwich = createPass({
  id: 'C4_hadamard_sandwich',
  name: 'Hadamard Sandwich',
  category: 'template',
  description: 'H-Z-H = X, H-X-H = Z optimization',
  timing: 'fast',
  priority: 4,
  enabled: true,
  estimatedTimeMs: 3,
  apply: hadamardSandwichPass,
})


function cnotSwapFusionPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedGates.length - 2; i++) {
    const g1 = sortedGates[i]
    const g2 = sortedGates[i + 1]
    const g3 = sortedGates[i + 2]

    if (toRemove.has(g1.id) || toRemove.has(g2.id) || toRemove.has(g3.id)) continue

    if (
      (g1.type === 'CNOT' || g1.type === 'CX') &&
      (g2.type === 'CNOT' || g2.type === 'CX') &&
      (g3.type === 'CNOT' || g3.type === 'CX')
    ) {
      const c1 = g1.controlQubits?.[0] ?? g1.qubits[0]
      const t1 = g1.qubits[g1.controlQubits?.length ? 0 : 1]
      const c2 = g2.controlQubits?.[0] ?? g2.qubits[0]
      const t2 = g2.qubits[g2.controlQubits?.length ? 0 : 1]
      const c3 = g3.controlQubits?.[0] ?? g3.qubits[0]
      const t3 = g3.qubits[g3.controlQubits?.length ? 0 : 1]

      if (c1 === c3 && t1 === t3 && c1 === t2 && t1 === c2) {
        toRemove.add(g1.id)
        toRemove.add(g2.id)
        toRemove.add(g3.id)

        const swap: CircuitGate = {
          id: uuid(),
          type: 'SWAP',
          qubits: [c1, t1].sort(),
          position: g1.position,
        }
        newGates.push(swap)

        actions.push({
          type: 'replace',
          gateIds: [g1.id, g2.id, g3.id],
          description: '3 CNOTs → SWAP',
          newGates: [swap],
        })
      }
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))
  result.gates.push(...newGates)

  return {
    circuit: result,
    actions,
    gatesRemoved: toRemove.size - newGates.length,
    gatesMerged: 0,
    gatesReplaced: actions.length,
    applied: true,
  }
}

export const cnotSwapFusion = createPass({
  id: 'C8_cnot_swap_fusion',
  name: 'CNOT-SWAP Fusion',
  category: 'template',
  description: 'Recognize 3 CNOTs as SWAP',
  timing: 'standard',
  priority: 8,
  enabled: true,
  estimatedTimeMs: 4,
  apply: cnotSwapFusionPass,
})


export function registerTemplatePasses(): void {
  passRegistry.register(swapDecomposition)
  passRegistry.register(toffoliDecomposition)
  passRegistry.register(czToCnot)
  passRegistry.register(hadamardSandwich)
  passRegistry.register(cnotSwapFusion)
}
