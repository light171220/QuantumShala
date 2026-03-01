import { v4 as uuid } from 'uuid'
import type { QuantumCircuit, CircuitGate, GateType } from '@/types/simulator'
import type {
  OptimizationResult,
  OptimizationPass,
  OptimizationPassType,
  OptimizationAction,
  OptimizationSuggestion,
  OptimizationStats,
  DEFAULT_OPTIMIZATION_PASSES,
} from '@/types/optimizer'

const SELF_INVERSE_GATES: GateType[] = ['H', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'SWAP']
const ROTATION_GATES: GateType[] = ['Rx', 'Ry', 'Rz', 'Phase', 'U1']

function cloneCircuit(circuit: QuantumCircuit): QuantumCircuit {
  return JSON.parse(JSON.stringify(circuit))
}

function calculateDepth(gates: CircuitGate[]): number {
  if (gates.length === 0) return 0
  return Math.max(...gates.map((g) => g.position)) + 1
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}

function gatesAreAdjacent(g1: CircuitGate, g2: CircuitGate): boolean {
  return Math.abs(g1.position - g2.position) === 1
}

function gatesOnSameQubits(g1: CircuitGate, g2: CircuitGate): boolean {
  return arraysEqual(g1.qubits, g2.qubits)
}

export class CircuitOptimizer {
  private passes: OptimizationPass[]

  constructor(passes?: OptimizationPass[]) {
    this.passes = passes || [
      { type: 'identity_removal', name: 'Identity Removal', description: 'Remove adjacent inverse gate pairs', enabled: true },
      { type: 'rotation_merging', name: 'Rotation Merging', description: 'Merge consecutive rotation gates', enabled: true },
      { type: 'cnot_cancellation', name: 'CNOT Cancellation', description: 'Cancel adjacent CNOT gates', enabled: true },
    ]
  }

  setPasses(passes: OptimizationPass[]): void {
    this.passes = passes
  }

  optimize(circuit: QuantumCircuit): OptimizationResult {
    const startTime = performance.now()
    const original = cloneCircuit(circuit)
    let current = cloneCircuit(circuit)
    const actions: OptimizationAction[] = []
    const passesApplied: OptimizationPassType[] = []

    for (const pass of this.passes) {
      if (!pass.enabled) continue

      const before = current.gates.length
      current = this.applyPass(current, pass.type, actions)
      if (current.gates.length < before) {
        passesApplied.push(pass.type)
      }
    }

    current = this.compactPositions(current)

    const suggestions = this.generateSuggestions(current)

    const stats: OptimizationStats = {
      originalGateCount: original.gates.length,
      optimizedGateCount: current.gates.length,
      originalDepth: calculateDepth(original.gates),
      optimizedDepth: calculateDepth(current.gates),
      gatesRemoved: original.gates.length - current.gates.length,
      gatesMerged: actions.filter((a) => a.type === 'merge').length,
      reductionPercent:
        original.gates.length > 0
          ? ((original.gates.length - current.gates.length) / original.gates.length) * 100
          : 0,
    }

    return {
      original,
      optimized: current,
      actions,
      suggestions,
      stats,
      passesApplied,
      executionTimeMs: performance.now() - startTime,
    }
  }

  private applyPass(
    circuit: QuantumCircuit,
    passType: OptimizationPassType,
    actions: OptimizationAction[]
  ): QuantumCircuit {
    switch (passType) {
      case 'identity_removal':
        return this.removeIdentities(circuit, actions)
      case 'rotation_merging':
        return this.mergeRotations(circuit, actions)
      case 'cnot_cancellation':
        return this.cancelCNOTs(circuit, actions)
      default:
        return circuit
    }
  }

  private removeIdentities(circuit: QuantumCircuit, actions: OptimizationAction[]): QuantumCircuit {
    const result = cloneCircuit(circuit)
    const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)
    const toRemove = new Set<string>()

    for (let i = 0; i < sortedGates.length - 1; i++) {
      const g1 = sortedGates[i]
      if (toRemove.has(g1.id)) continue

      if (!SELF_INVERSE_GATES.includes(g1.type)) continue

      for (let j = i + 1; j < sortedGates.length; j++) {
        const g2 = sortedGates[j]
        if (toRemove.has(g2.id)) continue

        if (!gatesOnSameQubits(g1, g2)) continue

        if (g2.position > g1.position + 1) {
          const hasInterference = sortedGates.some(
            (g) =>
              !toRemove.has(g.id) &&
              g.position > g1.position &&
              g.position < g2.position &&
              g.qubits.some((q) => g1.qubits.includes(q))
          )
          if (hasInterference) break
        }

        if (g1.type === g2.type && arraysEqual(g1.qubits, g2.qubits)) {
          if (g1.type === 'CNOT' || g1.type === 'CX') {
            const c1 = g1.controlQubits?.[0] ?? g1.qubits[0]
            const c2 = g2.controlQubits?.[0] ?? g2.qubits[0]
            if (c1 !== c2) continue
          }

          toRemove.add(g1.id)
          toRemove.add(g2.id)
          actions.push({
            type: 'remove',
            details: {
              gateIds: [g1.id, g2.id],
              reason: `Adjacent ${g1.type}-${g2.type} pair forms identity`,
            },
          })
          break
        }
      }
    }

    result.gates = result.gates.filter((g) => !toRemove.has(g.id))
    return result
  }

  private mergeRotations(circuit: QuantumCircuit, actions: OptimizationAction[]): QuantumCircuit {
    const result = cloneCircuit(circuit)
    const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)
    const toRemove = new Set<string>()
    const newGates: CircuitGate[] = []

    for (let i = 0; i < sortedGates.length; i++) {
      const g1 = sortedGates[i]
      if (toRemove.has(g1.id)) continue

      if (!ROTATION_GATES.includes(g1.type)) continue

      let totalAngle = g1.parameters?.[0] ?? 0
      const mergedIds = [g1.id]

      for (let j = i + 1; j < sortedGates.length; j++) {
        const g2 = sortedGates[j]
        if (toRemove.has(g2.id)) continue

        if (!gatesOnSameQubits(g1, g2) || g1.type !== g2.type) continue

        const hasInterference = sortedGates.some(
          (g) =>
            !toRemove.has(g.id) &&
            g.position > g1.position &&
            g.position < g2.position &&
            g.qubits.some((q) => g1.qubits.includes(q))
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
            details: {
              sourceGateIds: mergedIds,
              resultGate: mergedGate,
              reason: `Merged ${mergedIds.length} ${g1.type} gates: total angle ${totalAngle.toFixed(4)} rad`,
            },
          })
        } else {
          actions.push({
            type: 'remove',
            details: {
              gateIds: mergedIds,
              reason: `Merged ${g1.type} gates sum to identity (${normalizedAngle.toFixed(4)} rad)`,
            },
          })
        }
      }
    }

    result.gates = result.gates.filter((g) => !toRemove.has(g.id))
    result.gates.push(...newGates)
    return result
  }

  private cancelCNOTs(circuit: QuantumCircuit, actions: OptimizationAction[]): QuantumCircuit {
    const result = cloneCircuit(circuit)
    const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)
    const toRemove = new Set<string>()

    for (let i = 0; i < sortedGates.length - 1; i++) {
      const g1 = sortedGates[i]
      if (toRemove.has(g1.id)) continue
      if (g1.type !== 'CNOT' && g1.type !== 'CX') continue

      for (let j = i + 1; j < sortedGates.length; j++) {
        const g2 = sortedGates[j]
        if (toRemove.has(g2.id)) continue
        if (g2.type !== 'CNOT' && g2.type !== 'CX') continue

        if (!gatesOnSameQubits(g1, g2)) continue

        const c1 = g1.controlQubits?.[0] ?? g1.qubits[0]
        const c2 = g2.controlQubits?.[0] ?? g2.qubits[0]
        if (c1 !== c2) continue

        const hasInterference = sortedGates.some(
          (g) =>
            !toRemove.has(g.id) &&
            g.position > g1.position &&
            g.position < g2.position &&
            g.qubits.some((q) => g1.qubits.includes(q))
        )
        if (hasInterference) break

        toRemove.add(g1.id)
        toRemove.add(g2.id)
        actions.push({
          type: 'remove',
          details: {
            gateIds: [g1.id, g2.id],
            reason: 'Adjacent CNOT gates on same qubits cancel',
          },
        })
        break
      }
    }

    result.gates = result.gates.filter((g) => !toRemove.has(g.id))
    return result
  }

  private compactPositions(circuit: QuantumCircuit): QuantumCircuit {
    const result = cloneCircuit(circuit)
    const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

    const qubitLastPosition: Record<number, number> = {}

    for (const gate of sortedGates) {
      let newPos = 0
      for (const qubit of gate.qubits) {
        if (qubitLastPosition[qubit] !== undefined) {
          newPos = Math.max(newPos, qubitLastPosition[qubit] + 1)
        }
      }

      gate.position = newPos

      for (const qubit of gate.qubits) {
        qubitLastPosition[qubit] = newPos
      }
    }

    return result
  }

  private generateSuggestions(circuit: QuantumCircuit): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = []
    const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

    for (let i = 0; i < sortedGates.length - 1; i++) {
      const g1 = sortedGates[i]
      const g2 = sortedGates[i + 1]

      if (
        g1.type === 'H' &&
        g2.type === 'Z' &&
        arraysEqual(g1.qubits, g2.qubits)
      ) {
        suggestions.push({
          id: uuid(),
          type: 'gate_decomposition',
          description: `H followed by Z can be replaced with Y and a global phase`,
          gateIds: [g1.id, g2.id],
          potentialSavings: 1,
          applied: false,
        })
      }

      if (
        g1.type === 'SWAP' &&
        arraysEqual(g1.qubits, g2.qubits) &&
        (g2.type === 'CNOT' || g2.type === 'CX')
      ) {
        suggestions.push({
          id: uuid(),
          type: 'template_matching',
          description: 'SWAP followed by CNOT can be simplified',
          gateIds: [g1.id, g2.id],
          potentialSavings: 2,
          applied: false,
        })
      }
    }

    const rzGates = sortedGates.filter((g) => g.type === 'Rz')
    const rzByQubit: Record<number, CircuitGate[]> = {}
    for (const g of rzGates) {
      const q = g.qubits[0]
      if (!rzByQubit[q]) rzByQubit[q] = []
      rzByQubit[q].push(g)
    }

    for (const [qubit, gates] of Object.entries(rzByQubit)) {
      if (gates.length > 2) {
        suggestions.push({
          id: uuid(),
          type: 'rotation_merging',
          description: `${gates.length} Rz gates on qubit ${qubit} could be merged`,
          gateIds: gates.map((g) => g.id),
          potentialSavings: gates.length - 1,
          applied: false,
        })
      }
    }

    return suggestions
  }

  analyzeCircuit(circuit: QuantumCircuit): {
    gateCount: number
    depth: number
    twoQubitGates: number
    potentialOptimizations: number
  } {
    const result = this.optimize(circuit)
    return {
      gateCount: circuit.gates.length,
      depth: calculateDepth(circuit.gates),
      twoQubitGates: circuit.gates.filter((g) => g.qubits.length > 1).length,
      potentialOptimizations: result.stats.gatesRemoved + result.suggestions.length,
    }
  }
}

export function optimizeCircuit(circuit: QuantumCircuit): OptimizationResult {
  const optimizer = new CircuitOptimizer()
  return optimizer.optimize(circuit)
}

export function getOptimizationSuggestions(circuit: QuantumCircuit): OptimizationSuggestion[] {
  const optimizer = new CircuitOptimizer()
  const result = optimizer.optimize(circuit)
  return result.suggestions
}
