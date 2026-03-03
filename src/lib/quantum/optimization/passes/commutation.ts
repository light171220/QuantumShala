import type { CircuitGate, GateType, QuantumCircuit } from '@/types/simulator'
import { createPass, noOpResult, passRegistry, type PassResult, type PassAction } from '../registry'


function cloneCircuit(circuit: QuantumCircuit): QuantumCircuit {
  return JSON.parse(JSON.stringify(circuit))
}


type CommutationType = 'always' | 'never' | 'conditional'

interface CommutationRule {
  gate1: GateType | GateType[]
  gate2: GateType | GateType[]
  type: CommutationType
  condition?: (g1: CircuitGate, g2: CircuitGate) => boolean
}

const SINGLE_QUBIT_COMMUTATION: CommutationRule[] = [
  {
    gate1: ['Z', 'S', 'Sdg', 'T', 'Tdg', 'Rz', 'Phase', 'U1'],
    gate2: ['Z', 'S', 'Sdg', 'T', 'Tdg', 'Rz', 'Phase', 'U1'],
    type: 'always',
  },
  {
    gate1: ['X', 'Rx'],
    gate2: ['X', 'Rx'],
    type: 'always',
  },
  {
    gate1: ['Y', 'Ry'],
    gate2: ['Y', 'Ry'],
    type: 'always',
  },
]

const TWO_QUBIT_COMMUTATION: CommutationRule[] = [
  { gate1: 'CZ', gate2: 'CZ', type: 'always' },
  {
    gate1: 'CZ',
    gate2: ['Z', 'S', 'Sdg', 'T', 'Tdg', 'Rz'],
    type: 'always',
  },
  {
    gate1: ['CNOT', 'CX'],
    gate2: ['Z', 'S', 'Sdg', 'T', 'Tdg', 'Rz'],
    type: 'conditional',
    condition: (g1, g2) => {
      const control = g1.controlQubits?.[0] ?? g1.qubits[0]
      return g2.qubits[0] === control
    },
  },
  {
    gate1: ['CNOT', 'CX'],
    gate2: ['X', 'Rx'],
    type: 'conditional',
    condition: (g1, g2) => {
      const target = g1.qubits[g1.controlQubits?.length ? 0 : 1]
      return g2.qubits[0] === target
    },
  },
]

function gatesCommute(g1: CircuitGate, g2: CircuitGate): boolean {
  const qubits1 = [...g1.qubits, ...(g1.controlQubits || [])]
  const qubits2 = [...g2.qubits, ...(g2.controlQubits || [])]

  if (!qubits1.some((q) => qubits2.includes(q))) {
    return true
  }

  for (const rule of SINGLE_QUBIT_COMMUTATION) {
    const types1 = Array.isArray(rule.gate1) ? rule.gate1 : [rule.gate1]
    const types2 = Array.isArray(rule.gate2) ? rule.gate2 : [rule.gate2]

    if (types1.includes(g1.type) && types2.includes(g2.type)) {
      if (rule.type === 'always') return true
      if (rule.type === 'never') return false
      if (rule.type === 'conditional' && rule.condition) {
        return rule.condition(g1, g2)
      }
    }
  }

  for (const rule of TWO_QUBIT_COMMUTATION) {
    const types1 = Array.isArray(rule.gate1) ? rule.gate1 : [rule.gate1]
    const types2 = Array.isArray(rule.gate2) ? rule.gate2 : [rule.gate2]

    if (types1.includes(g1.type) && types2.includes(g2.type)) {
      if (rule.type === 'always') return true
      if (rule.type === 'never') return false
      if (rule.type === 'conditional' && rule.condition) {
        return rule.condition(g1, g2)
      }
    }
    if (types2.includes(g1.type) && types1.includes(g2.type)) {
      if (rule.type === 'always') return true
      if (rule.type === 'never') return false
      if (rule.type === 'conditional' && rule.condition) {
        return rule.condition(g2, g1)
      }
    }
  }

  return false
}

function singleQubitCommutePass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  let changed = false

  const gatesByQubit: Map<number, CircuitGate[]> = new Map()
  for (const gate of result.gates) {
    if (gate.qubits.length === 1 && (!gate.controlQubits || gate.controlQubits.length === 0)) {
      const qubit = gate.qubits[0]
      if (!gatesByQubit.has(qubit)) {
        gatesByQubit.set(qubit, [])
      }
      gatesByQubit.get(qubit)!.push(gate)
    }
  }

  for (const [qubit, gates] of gatesByQubit) {
    const sorted = gates.sort((a, b) => a.position - b.position)

    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = 0; j < sorted.length - 1 - i; j++) {
        const g1 = sorted[j]
        const g2 = sorted[j + 1]

        if (g1.type === g2.type) continue

        const shouldSwap =
          gatesCommute(g1, g2) &&
          (j > 0 && sorted[j - 1].type === g2.type && sorted[j - 1].type !== g1.type)

        if (shouldSwap) {
          const tempPos = g1.position
          g1.position = g2.position
          g2.position = tempPos

          sorted[j] = g2
          sorted[j + 1] = g1

          changed = true
          actions.push({
            type: 'reorder',
            gateIds: [g1.id, g2.id],
            description: `Swap ${g1.type} and ${g2.type} on qubit ${qubit}`,
          })
        }
      }
    }
  }

  if (!changed) {
    return noOpResult(circuit)
  }

  return {
    circuit: result,
    actions,
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: true,
  }
}

export const singleQubitCommutation = createPass({
  id: 'B1_single_qubit_commute',
  name: 'Single-Qubit Commutation',
  category: 'commutation',
  description: 'Reorder single-qubit gates to enable cancellation',
  timing: 'standard',
  priority: 1,
  enabled: true,
  estimatedTimeMs: 5,
  apply: singleQubitCommutePass,
})

function diagonalCommutePass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  let changed = false

  const DIAGONAL_GATES: GateType[] = ['CZ', 'CRz', 'CPhase', 'Z', 'S', 'Sdg', 'T', 'Tdg', 'Rz', 'Phase', 'U1']

  const diagonalGates = result.gates.filter((g) => DIAGONAL_GATES.includes(g.type))
  const sortedDiagonal = [...diagonalGates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedDiagonal.length - 1; i++) {
    const g1 = sortedDiagonal[i]
    const g2 = sortedDiagonal[i + 1]

    if (g2.position - g1.position > 1) {
      const gatesBetween = result.gates.filter(
        (g) => g.position > g1.position && g.position < g2.position
      )

      const canMove = gatesBetween.every((g) => gatesCommute(g, g2))

      if (canMove) {
        const newPos = g1.position + 0.5

        result.gates.forEach((g) => {
          if (g.position > g1.position && g.id !== g2.id) {
            g.position += 1
          }
        })
        g2.position = g1.position + 1

        changed = true
        actions.push({
          type: 'reorder',
          gateIds: [g2.id],
          description: `Move ${g2.type} to be adjacent to ${g1.type}`,
        })
      }
    }
  }

  if (!changed) {
    return noOpResult(circuit)
  }

  return {
    circuit: result,
    actions,
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: true,
  }
}

export const diagonalCommutation = createPass({
  id: 'B2_diagonal_commute',
  name: 'Diagonal Gate Commutation',
  category: 'commutation',
  description: 'Group diagonal gates (CZ, phase) together',
  timing: 'standard',
  priority: 2,
  enabled: true,
  estimatedTimeMs: 6,
  apply: diagonalCommutePass,
})

function cnotCommutePass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  let changed = false

  const cnotGates = result.gates.filter((g) => g.type === 'CNOT' || g.type === 'CX')
  const sortedCnots = [...cnotGates].sort((a, b) => a.position - b.position)

  const byControl: Map<number, CircuitGate[]> = new Map()
  for (const cnot of sortedCnots) {
    const control = cnot.controlQubits?.[0] ?? cnot.qubits[0]
    if (!byControl.has(control)) {
      byControl.set(control, [])
    }
    byControl.get(control)!.push(cnot)
  }

  for (const [control, cnots] of byControl) {
    if (cnots.length < 2) continue

    for (let i = 0; i < cnots.length - 1; i++) {
      const c1 = cnots[i]
      const c2 = cnots[i + 1]

      if (c2.position - c1.position > 1) {
        const gatesBetween = result.gates.filter(
          (g) => g.position > c1.position && g.position < c2.position
        )

        const target1 = c1.qubits[c1.controlQubits?.length ? 0 : 1]
        const target2 = c2.qubits[c2.controlQubits?.length ? 0 : 1]

        const canMove = gatesBetween.every((g) => {
          const gQubits = [...g.qubits, ...(g.controlQubits || [])]
          return !gQubits.includes(control) && !gQubits.includes(target2)
        })

        if (canMove) {
          result.gates.forEach((g) => {
            if (g.position > c1.position && g.id !== c2.id) {
              g.position += 1
            }
          })
          c2.position = c1.position + 1

          changed = true
          actions.push({
            type: 'reorder',
            gateIds: [c1.id, c2.id],
            description: `Group CNOTs with control qubit ${control}`,
          })
        }
      }
    }
  }

  if (!changed) {
    return noOpResult(circuit)
  }

  return {
    circuit: result,
    actions,
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: true,
  }
}

export const cnotCommutation = createPass({
  id: 'B4_cnot_commute',
  name: 'CNOT Commutation',
  category: 'commutation',
  description: 'Reorder CNOTs with same control to enable cancellation',
  timing: 'standard',
  priority: 4,
  enabled: true,
  estimatedTimeMs: 6,
  apply: cnotCommutePass,
})

function barrierAwareReorderPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const barriers = result.gates.filter((g) => g.type === 'Barrier')

  if (barriers.length === 0) {
    return noOpResult(circuit)
  }

  return noOpResult(circuit)
}

export const barrierAwareCommutation = createPass({
  id: 'B6_barrier_aware',
  name: 'Barrier-Aware Commutation',
  category: 'commutation',
  description: 'Ensure commutation respects barrier boundaries',
  timing: 'deep',
  priority: 6,
  enabled: true,
  estimatedTimeMs: 2,
  apply: barrierAwareReorderPass,
})

export function registerCommutationPasses(): void {
  passRegistry.register(singleQubitCommutation)
  passRegistry.register(diagonalCommutation)
  passRegistry.register(cnotCommutation)
  passRegistry.register(barrierAwareCommutation)
}
