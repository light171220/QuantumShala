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

function getGatesOnQubits(
  gates: CircuitGate[],
  qubits: number[],
  startPos: number,
  endPos: number
): CircuitGate[] {
  return gates.filter((g) => {
    if (g.position < startPos || g.position > endPos) return false
    const gQubits = [...g.qubits, ...(g.controlQubits || [])]
    return qubits.some((q) => gQubits.includes(q))
  })
}


interface Pattern2 {
  gate1: GateType
  gate2: GateType
  qubits: 'same' | 'overlap' | 'any'
  replacement: GateType[] | null // null means remove both
  params?: (g1: CircuitGate, g2: CircuitGate) => number[][]
}

const PATTERNS_2: Pattern2[] = [
  { gate1: 'H', gate2: 'H', qubits: 'same', replacement: null },
  { gate1: 'X', gate2: 'X', qubits: 'same', replacement: null },
  { gate1: 'Y', gate2: 'Y', qubits: 'same', replacement: null },
  { gate1: 'Z', gate2: 'Z', qubits: 'same', replacement: null },

  {
    gate1: 'S',
    gate2: 'S',
    qubits: 'same',
    replacement: ['Z'],
  },

  { gate1: 'S', gate2: 'Sdg', qubits: 'same', replacement: null },
  { gate1: 'Sdg', gate2: 'S', qubits: 'same', replacement: null },

  { gate1: 'T', gate2: 'Tdg', qubits: 'same', replacement: null },
  { gate1: 'Tdg', gate2: 'T', qubits: 'same', replacement: null },
]

function window2Pass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedGates.length - 1; i++) {
    const g1 = sortedGates[i]
    if (toRemove.has(g1.id)) continue

    const g2 = sortedGates[i + 1]
    if (toRemove.has(g2.id)) continue

    if (!arraysEqual(g1.qubits, g2.qubits)) continue
    if (g1.qubits.length !== 1) continue // Single-qubit patterns only

    for (const pattern of PATTERNS_2) {
      if (g1.type !== pattern.gate1) continue
      if (g2.type !== pattern.gate2) continue

      toRemove.add(g1.id)
      toRemove.add(g2.id)

      if (pattern.replacement === null) {
        actions.push({
          type: 'remove',
          gateIds: [g1.id, g2.id],
          description: `${g1.type}-${g2.type} = identity`,
        })
      } else {
        for (const gateType of pattern.replacement) {
          const newGate: CircuitGate = {
            id: uuid(),
            type: gateType,
            qubits: [...g1.qubits],
            position: g1.position,
          }
          newGates.push(newGate)
        }
        actions.push({
          type: 'replace',
          gateIds: [g1.id, g2.id],
          description: `${g1.type}-${g2.type} → ${pattern.replacement.join('-')}`,
          newGates: newGates.slice(-pattern.replacement.length),
        })
      }
      break
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
    gatesReplaced: actions.filter((a) => a.type === 'replace').length,
    applied: true,
  }
}

export const window2Optimization = createPass({
  id: 'G1_window_2',
  name: 'Window-2 Optimization',
  category: 'peephole',
  description: 'Optimize 2-gate patterns',
  timing: 'fast',
  priority: 1,
  enabled: true,
  estimatedTimeMs: 2,
  apply: window2Pass,
})


interface Pattern3 {
  gates: [GateType, GateType, GateType]
  qubits: 'same' | 'any'
  replacement: CircuitGate[] | null
  replacementFn?: (g1: CircuitGate, g2: CircuitGate, g3: CircuitGate) => CircuitGate[]
}

const PATTERNS_3: Pattern3[] = [
  {
    gates: ['H', 'Z', 'H'],
    qubits: 'same',
    replacement: null,
    replacementFn: (g1) => [{
      id: uuid(),
      type: 'X',
      qubits: [...g1.qubits],
      position: g1.position,
    }],
  },
  {
    gates: ['H', 'X', 'H'],
    qubits: 'same',
    replacement: null,
    replacementFn: (g1) => [{
      id: uuid(),
      type: 'Z',
      qubits: [...g1.qubits],
      position: g1.position,
    }],
  },
  {
    gates: ['H', 'Y', 'H'],
    qubits: 'same',
    replacement: null,
    replacementFn: (g1) => [{
      id: uuid(),
      type: 'Y',
      qubits: [...g1.qubits],
      position: g1.position,
    }],
  },
]

function window3Pass(circuit: QuantumCircuit): PassResult {
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

    if (!arraysEqual(g1.qubits, g2.qubits) || !arraysEqual(g2.qubits, g3.qubits)) continue
    if (g1.qubits.length !== 1) continue

    for (const pattern of PATTERNS_3) {
      if (g1.type !== pattern.gates[0]) continue
      if (g2.type !== pattern.gates[1]) continue
      if (g3.type !== pattern.gates[2]) continue

      toRemove.add(g1.id)
      toRemove.add(g2.id)
      toRemove.add(g3.id)

      const replacements = pattern.replacementFn?.(g1, g2, g3) || pattern.replacement || []
      newGates.push(...replacements)

      actions.push({
        type: 'replace',
        gateIds: [g1.id, g2.id, g3.id],
        description: `${pattern.gates.join('-')} → ${replacements.map((g) => g.type).join('-') || 'identity'}`,
        newGates: replacements,
      })
      break
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

export const window3Optimization = createPass({
  id: 'G2_window_3',
  name: 'Window-3 Optimization',
  category: 'peephole',
  description: 'Optimize 3-gate patterns (H-Z-H = X, etc.)',
  timing: 'fast',
  priority: 2,
  enabled: true,
  estimatedTimeMs: 3,
  apply: window3Pass,
})


function cnotRotationPass(circuit: QuantumCircuit): PassResult {
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
      g2.type === 'Rz' &&
      (g3.type === 'CNOT' || g3.type === 'CX')
    ) {
      const control1 = g1.controlQubits?.[0] ?? g1.qubits[0]
      const target1 = g1.qubits[g1.controlQubits?.length ? 0 : 1]
      const control3 = g3.controlQubits?.[0] ?? g3.qubits[0]
      const target3 = g3.qubits[g3.controlQubits?.length ? 0 : 1]

      if (
        control1 === control3 &&
        target1 === target3 &&
        g2.qubits[0] === target1
      ) {
        const angle = g2.parameters?.[0] ?? 0

        toRemove.add(g1.id)
        toRemove.add(g2.id)
        toRemove.add(g3.id)

        const crzGate: CircuitGate = {
          id: uuid(),
          type: 'CRz',
          qubits: [target1],
          controlQubits: [control1],
          parameters: [angle],
          position: g1.position,
        }
        newGates.push(crzGate)

        actions.push({
          type: 'replace',
          gateIds: [g1.id, g2.id, g3.id],
          description: `CNOT-Rz-CNOT → CRz(${angle.toFixed(4)})`,
          newGates: [crzGate],
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

export const cnotRotationOptimization = createPass({
  id: 'G4_cnot_rotation',
  name: 'CNOT-Rotation Pattern',
  category: 'peephole',
  description: 'Optimize CNOT-Rz-CNOT → CRz patterns',
  timing: 'standard',
  priority: 4,
  enabled: true,
  estimatedTimeMs: 4,
  apply: cnotRotationPass,
})


function controlledUncontrolledPass(circuit: QuantumCircuit): PassResult {
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
      g2.type === 'X' &&
      (g3.type === 'CNOT' || g3.type === 'CX')
    ) {
      const control1 = g1.controlQubits?.[0] ?? g1.qubits[0]
      const target1 = g1.qubits[g1.controlQubits?.length ? 0 : 1]
      const control3 = g3.controlQubits?.[0] ?? g3.qubits[0]
      const target3 = g3.qubits[g3.controlQubits?.length ? 0 : 1]

      if (
        control1 === control3 &&
        target1 === target3 &&
        g2.qubits[0] === control1
      ) {
        toRemove.add(g1.id)
        toRemove.add(g2.id)
        toRemove.add(g3.id)

        const xControl: CircuitGate = {
          id: uuid(),
          type: 'X',
          qubits: [control1],
          position: g1.position,
        }
        const xTarget: CircuitGate = {
          id: uuid(),
          type: 'X',
          qubits: [target1],
          position: g1.position,
        }
        newGates.push(xControl, xTarget)

        actions.push({
          type: 'replace',
          gateIds: [g1.id, g2.id, g3.id],
          description: 'CX-X(c)-CX → X(c)-X(t)',
          newGates: [xControl, xTarget],
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

export const controlledUncontrolledOptimization = createPass({
  id: 'G6_controlled_uncontrolled',
  name: 'Controlled-Uncontrolled Pattern',
  category: 'peephole',
  description: 'Optimize CX-X-CX type patterns',
  timing: 'standard',
  priority: 6,
  enabled: true,
  estimatedTimeMs: 4,
  apply: controlledUncontrolledPass,
})


export function registerPeepholePasses(): void {
  passRegistry.register(window2Optimization)
  passRegistry.register(window3Optimization)
  passRegistry.register(cnotRotationOptimization)
  passRegistry.register(controlledUncontrolledOptimization)
}
