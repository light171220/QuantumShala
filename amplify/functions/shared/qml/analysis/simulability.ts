import { Circuit } from '../../quantum-core'
import type { AnsatzConfig } from '../types'
import { buildAnsatz } from '../ansatze'

export interface SimulabilityResult {
  simulable: boolean
  reason: string
  tGateCount: number
  cnotCount: number
  depth: number
  isClifford: boolean
  estimatedClassicalCost: 'polynomial' | 'subexponential' | 'exponential'
}

export class SimulabilityAnalyzer {
  analyze(ansatzConfig: AnsatzConfig): SimulabilityResult {
    const circuit = buildAnsatz(ansatzConfig)
    const metrics = circuit.getMetrics()

    const tGateCount = this.countTGates(circuit)
    const isClifford = tGateCount === 0 && this.isOnlyCliffordGates(circuit)

    let simulable = false
    let reason = ''
    let estimatedClassicalCost: 'polynomial' | 'subexponential' | 'exponential' = 'exponential'

    if (isClifford) {
      simulable = true
      reason = 'Circuit contains only Clifford gates (efficiently simulable via stabilizer formalism)'
      estimatedClassicalCost = 'polynomial'
    } else if (tGateCount <= 10) {
      simulable = true
      reason = `Low T-gate count (${tGateCount}) allows efficient simulation via stabilizer decomposition`
      estimatedClassicalCost = 'polynomial'
    } else if (metrics.depth <= 3 && ansatzConfig.numQubits <= 50) {
      simulable = true
      reason = 'Shallow circuit depth allows tensor network contraction'
      estimatedClassicalCost = 'polynomial'
    } else if (this.hasMatchgateStructure(circuit)) {
      simulable = true
      reason = 'Circuit has matchgate structure (nearest-neighbor, fermionic)'
      estimatedClassicalCost = 'polynomial'
    } else if (tGateCount <= 50) {
      simulable = false
      reason = `Moderate T-gate count (${tGateCount}) may allow subexponential simulation`
      estimatedClassicalCost = 'subexponential'
    } else {
      simulable = false
      reason = `High T-gate count (${tGateCount}) and circuit depth (${metrics.depth}) suggest quantum advantage`
      estimatedClassicalCost = 'exponential'
    }

    return {
      simulable,
      reason,
      tGateCount,
      cnotCount: metrics.cnotCount,
      depth: metrics.depth,
      isClifford,
      estimatedClassicalCost,
    }
  }

  private countTGates(circuit: Circuit): number {
    let count = 0
    for (const gate of circuit.gates) {
      const name = gate.name.toLowerCase()
      if (name === 't' || name === 'tdg') {
        count++
      }
      if (name === 'rz' || name === 'rx' || name === 'ry') {
        const angle = gate.params?.[0] ?? 0
        if (!this.isCliffordAngle(angle)) {
          count++
        }
      }
    }
    return count
  }

  private isCliffordAngle(angle: number): boolean {
    const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const cliffordAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]
    return cliffordAngles.some(ca => Math.abs(normalizedAngle - ca) < 1e-6)
  }

  private isOnlyCliffordGates(circuit: Circuit): boolean {
    const cliffordGates = new Set([
      'h', 'x', 'y', 'z', 's', 'sdg', 'cx', 'cnot', 'cz', 'swap',
    ])

    for (const gate of circuit.gates) {
      const name = gate.name.toLowerCase()
      if (name === 'barrier') continue

      if (name === 'rz' || name === 'rx' || name === 'ry' || name === 'p') {
        const angle = gate.params?.[0] ?? 0
        if (!this.isCliffordAngle(angle)) {
          return false
        }
      } else if (!cliffordGates.has(name)) {
        if (name !== 't' && name !== 'tdg') {
          continue
        }
        return false
      }
    }

    return true
  }

  private hasMatchgateStructure(circuit: Circuit): boolean {
    for (const gate of circuit.gates) {
      if (gate.qubits.length === 2) {
        const [q1, q2] = gate.qubits
        if (Math.abs(q1 - q2) > 1) {
          return false
        }
      }
    }
    return true
  }
}

export function checkSimulability(ansatzConfig: AnsatzConfig): SimulabilityResult {
  const analyzer = new SimulabilityAnalyzer()
  return analyzer.analyze(ansatzConfig)
}
