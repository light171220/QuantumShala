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


const ROTATION_GATES: GateType[] = ['Rx', 'Ry', 'Rz', 'Phase', 'U1', 'CRx', 'CRy', 'CRz', 'CPhase']

function identityRemovalPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()

  for (const gate of result.gates) {
    if (ROTATION_GATES.includes(gate.type)) {
      const angle = gate.parameters?.[0] ?? 0
      const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      if (Math.abs(normalizedAngle) < 1e-10 || Math.abs(normalizedAngle - 2 * Math.PI) < 1e-10) {
        toRemove.add(gate.id)
        actions.push({
          type: 'remove',
          gateIds: [gate.id],
          description: `Remove identity ${gate.type}(${angle.toFixed(4)})`,
        })
      }
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))

  return {
    circuit: result,
    actions,
    gatesRemoved: toRemove.size,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: true,
  }
}

export const identityRemoval = createPass({
  id: 'A1_identity_removal',
  name: 'Identity Removal',
  category: 'algebraic',
  description: 'Remove rotation gates with zero angle (Rz(0), Rx(0), etc.)',
  timing: 'fast',
  priority: 1,
  enabled: true,
  estimatedTimeMs: 2,
  apply: identityRemovalPass,
})


const SELF_INVERSE_GATES: GateType[] = ['H', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'SWAP']

function selfInverseCancelPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()

  const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedGates.length - 1; i++) {
    const g1 = sortedGates[i]
    if (toRemove.has(g1.id)) continue
    if (!SELF_INVERSE_GATES.includes(g1.type)) continue

    for (let j = i + 1; j < sortedGates.length; j++) {
      const g2 = sortedGates[j]
      if (toRemove.has(g2.id)) continue

      if (g1.type !== g2.type) continue
      if (!arraysEqual(g1.qubits, g2.qubits)) continue

      const c1 = g1.controlQubits || []
      const c2 = g2.controlQubits || []
      if (!arraysEqual(c1, c2)) continue

      const allQubits = [...g1.qubits, ...c1]
      const hasInterference = sortedGates.slice(i + 1, j).some(
        (g) =>
          !toRemove.has(g.id) &&
          (g.qubits.some((q) => allQubits.includes(q)) ||
            (g.controlQubits || []).some((q) => allQubits.includes(q)))
      )

      if (!hasInterference) {
        toRemove.add(g1.id)
        toRemove.add(g2.id)
        actions.push({
          type: 'remove',
          gateIds: [g1.id, g2.id],
          description: `Cancel ${g1.type}-${g2.type} pair (self-inverse)`,
        })
        break
      }
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))

  return {
    circuit: result,
    actions,
    gatesRemoved: toRemove.size,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: true,
  }
}

export const selfInverseCancel = createPass({
  id: 'A2_self_inverse_cancel',
  name: 'Self-Inverse Cancellation',
  category: 'algebraic',
  description: 'Cancel adjacent self-inverse gate pairs (HH=I, XX=I, etc.)',
  timing: 'fast',
  priority: 2,
  enabled: true,
  estimatedTimeMs: 2,
  apply: selfInverseCancelPass,
})


function rotationFoldingPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedGates.length; i++) {
    const g1 = sortedGates[i]
    if (toRemove.has(g1.id)) continue
    if (!ROTATION_GATES.includes(g1.type)) continue

    let totalAngle = g1.parameters?.[0] ?? 0
    const mergedIds = [g1.id]

    for (let j = i + 1; j < sortedGates.length; j++) {
      const g2 = sortedGates[j]
      if (toRemove.has(g2.id)) continue

      if (g1.type !== g2.type) continue
      if (!arraysEqual(g1.qubits, g2.qubits)) continue

      const hasInterference = sortedGates.slice(i + 1, j).some(
        (g) => !toRemove.has(g.id) && g.qubits.some((q) => g1.qubits.includes(q))
      )
      if (hasInterference) break

      totalAngle += g2.parameters?.[0] ?? 0
      mergedIds.push(g2.id)
      toRemove.add(g2.id)
    }

    if (mergedIds.length > 1) {
      toRemove.add(g1.id)

      const normalizedAngle = ((totalAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

      if (Math.abs(normalizedAngle) > 1e-10 && Math.abs(normalizedAngle - 2 * Math.PI) > 1e-10) {
        const mergedGate: CircuitGate = {
          id: uuid(),
          type: g1.type,
          qubits: [...g1.qubits],
          parameters: [normalizedAngle],
          position: g1.position,
        }
        newGates.push(mergedGate)

        actions.push({
          type: 'merge',
          gateIds: mergedIds,
          description: `Merge ${mergedIds.length} ${g1.type} gates: ${totalAngle.toFixed(4)} rad`,
          newGates: [mergedGate],
        })
      } else {
        actions.push({
          type: 'remove',
          gateIds: mergedIds,
          description: `Merged ${g1.type} gates sum to identity`,
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
    gatesMerged: actions.filter((a) => a.type === 'merge').length,
    gatesReplaced: 0,
    applied: true,
  }
}

export const rotationFolding = createPass({
  id: 'A3_rotation_folding',
  name: 'Rotation Folding',
  category: 'algebraic',
  description: 'Merge consecutive rotation gates: Rz(a)Rz(b) = Rz(a+b)',
  timing: 'fast',
  priority: 3,
  enabled: true,
  estimatedTimeMs: 2,
  apply: rotationFoldingPass,
})


const PHASE_GATE_ANGLES: Partial<Record<GateType, number>> = {
  S: Math.PI / 2,
  Sdg: -Math.PI / 2,
  T: Math.PI / 4,
  Tdg: -Math.PI / 4,
  Z: Math.PI,
}

function phaseMergingPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []
  const toRemove = new Set<string>()
  const newGates: CircuitGate[] = []

  const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

  for (let i = 0; i < sortedGates.length - 1; i++) {
    const g1 = sortedGates[i]
    if (toRemove.has(g1.id)) continue

    const g1IsRz = g1.type === 'Rz'
    const g1IsPhase = g1.type in PHASE_GATE_ANGLES

    if (!g1IsRz && !g1IsPhase) continue

    for (let j = i + 1; j < sortedGates.length; j++) {
      const g2 = sortedGates[j]
      if (toRemove.has(g2.id)) continue

      if (!arraysEqual(g1.qubits, g2.qubits)) continue

      const g2IsRz = g2.type === 'Rz'
      const g2IsPhase = g2.type in PHASE_GATE_ANGLES

      if (!g2IsRz && !g2IsPhase) continue

      const hasInterference = sortedGates.slice(i + 1, j).some(
        (g) => !toRemove.has(g.id) && g.qubits.some((q) => g1.qubits.includes(q))
      )
      if (hasInterference) break

      const angle1 = g1IsRz ? (g1.parameters?.[0] ?? 0) : (PHASE_GATE_ANGLES[g1.type] ?? 0)
      const angle2 = g2IsRz ? (g2.parameters?.[0] ?? 0) : (PHASE_GATE_ANGLES[g2.type] ?? 0)
      const totalAngle = angle1 + angle2

      const normalizedAngle = ((totalAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

      toRemove.add(g1.id)
      toRemove.add(g2.id)

      if (Math.abs(normalizedAngle) > 1e-10 && Math.abs(normalizedAngle - 2 * Math.PI) > 1e-10) {
        const mergedGate: CircuitGate = {
          id: uuid(),
          type: 'Rz',
          qubits: [...g1.qubits],
          parameters: [normalizedAngle],
          position: g1.position,
        }
        newGates.push(mergedGate)

        actions.push({
          type: 'merge',
          gateIds: [g1.id, g2.id],
          description: `Merge ${g1.type} + ${g2.type} → Rz(${normalizedAngle.toFixed(4)})`,
          newGates: [mergedGate],
        })
      } else {
        actions.push({
          type: 'remove',
          gateIds: [g1.id, g2.id],
          description: `${g1.type} + ${g2.type} = identity`,
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
    gatesMerged: actions.filter((a) => a.type === 'merge').length,
    gatesReplaced: 0,
    applied: true,
  }
}

export const phaseMerging = createPass({
  id: 'A4_phase_merging',
  name: 'Phase Merging',
  category: 'algebraic',
  description: 'Combine S, T gates with Rz gates',
  timing: 'standard',
  priority: 4,
  enabled: true,
  estimatedTimeMs: 3,
  apply: phaseMergingPass,
})


function deadGateEliminationPass(circuit: QuantumCircuit): PassResult {
  const result = cloneCircuit(circuit)
  const actions: PassAction[] = []

  const measuredQubits = new Set<number>()
  for (const measurement of result.measurements) {
    measuredQubits.add(measurement.qubit)
  }

  if (measuredQubits.size === 0) {
    return noOpResult(circuit)
  }

  const affectsOutput = new Set<number>(measuredQubits)
  let changed = true

  while (changed) {
    changed = false
    for (const gate of result.gates) {
      const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]

      if (allQubits.some((q) => affectsOutput.has(q))) {
        for (const q of allQubits) {
          if (!affectsOutput.has(q)) {
            affectsOutput.add(q)
            changed = true
          }
        }
      }
    }
  }

  const toRemove = new Set<string>()
  for (const gate of result.gates) {
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    if (!allQubits.some((q) => affectsOutput.has(q))) {
      toRemove.add(gate.id)
      actions.push({
        type: 'remove',
        gateIds: [gate.id],
        description: `Remove ${gate.type} on unmeasured qubit(s)`,
      })
    }
  }

  if (toRemove.size === 0) {
    return noOpResult(circuit)
  }

  result.gates = result.gates.filter((g) => !toRemove.has(g.id))

  return {
    circuit: result,
    actions,
    gatesRemoved: toRemove.size,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: true,
  }
}

export const deadGateElimination = createPass({
  id: 'A8_dead_gate_elimination',
  name: 'Dead Gate Elimination',
  category: 'algebraic',
  description: 'Remove gates on qubits that never affect measured output',
  timing: 'standard',
  priority: 8,
  enabled: true,
  estimatedTimeMs: 5,
  apply: deadGateEliminationPass,
})


export function registerAlgebraicPasses(): void {
  passRegistry.register(identityRemoval)
  passRegistry.register(selfInverseCancel)
  passRegistry.register(rotationFolding)
  passRegistry.register(phaseMerging)
  passRegistry.register(deadGateElimination)
}
