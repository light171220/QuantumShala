import type { QuantumCircuit, CircuitGate, GateType } from './simulator'

export type OptimizationPassType =
  | 'identity_removal'
  | 'rotation_merging'
  | 'cnot_cancellation'
  | 'gate_decomposition'
  | 'commutation'
  | 'template_matching'

export interface OptimizationPass {
  type: OptimizationPassType
  name: string
  description: string
  enabled: boolean
}

export interface GateRemoval {
  gateIds: string[]
  reason: string
}

export interface GateMerge {
  sourceGateIds: string[]
  resultGate: CircuitGate
  reason: string
}

export interface OptimizationAction {
  type: 'remove' | 'merge' | 'replace'
  details: GateRemoval | GateMerge
}

export interface OptimizationSuggestion {
  id: string
  type: OptimizationPassType
  description: string
  gateIds: string[]
  potentialSavings: number
  applied: boolean
}

export interface OptimizationStats {
  originalGateCount: number
  optimizedGateCount: number
  originalDepth: number
  optimizedDepth: number
  gatesRemoved: number
  gatesMerged: number
  reductionPercent: number
}

export interface OptimizationResult {
  original: QuantumCircuit
  optimized: QuantumCircuit
  actions: OptimizationAction[]
  suggestions: OptimizationSuggestion[]
  stats: OptimizationStats
  passesApplied: OptimizationPassType[]
  executionTimeMs: number
}

export const DEFAULT_OPTIMIZATION_PASSES: OptimizationPass[] = [
  {
    type: 'identity_removal',
    name: 'Identity Removal',
    description: 'Remove adjacent inverse gate pairs (H-H, X-X, CNOT-CNOT)',
    enabled: true,
  },
  {
    type: 'rotation_merging',
    name: 'Rotation Merging',
    description: 'Merge consecutive rotation gates (Rz(a) + Rz(b) = Rz(a+b))',
    enabled: true,
  },
  {
    type: 'cnot_cancellation',
    name: 'CNOT Cancellation',
    description: 'Cancel adjacent CNOT gates on same qubits',
    enabled: true,
  },
  {
    type: 'commutation',
    name: 'Gate Commutation',
    description: 'Reorder commuting gates to enable more optimizations',
    enabled: false,
  },
]
