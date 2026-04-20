import type { QuantumCircuit, CircuitGate, GateType } from './simulator'

export type OptimizationPassType =
  | 'identity_removal'
  | 'rotation_merging'
  | 'cnot_cancellation'
  | 'gate_decomposition'
  | 'commutation'
  | 'template_matching'
  | 'self_inverse'
  | 'phase_merging'
  | 'global_phase_removal'
  | 'redundant_control'
  | 'constant_propagation'
  | 'dead_gate_elimination'
  | 'single_qubit_commute'
  | 'diagonal_commute'
  | 'cnot_single_rules'
  | 'cnot_cnot_commute'
  | 'rotation_commute'
  | 'barrier_aware'
  | 'measurement_commute'
  | 'swap_decomposition'
  | 'toffoli_decomposition'
  | 'cz_to_cnot'
  | 'hadamard_sandwich'
  | 'controlled_synthesis'
  | 'fredkin_decomposition'
  | 'qft_approximation'
  | 'cnot_swap_fusion'
  | 'y_rotation_synthesis'
  | 'iswap_decomposition'
  | 'qubit_routing'
  | 'direction_fixing'
  | 'native_decomposition'
  | 'coupling_aware'
  | 'pulse_optimization'
  | 'crosstalk_mitigation'
  | 't_gate_scheduling'
  | 'error_rate_opt'
  | 'euler_zyz'
  | 'euler_zxz'
  | 'kak_decomposition'
  | 'solovay_kitaev'
  | 'clifford_frame'
  | 'magic_state_opt'
  | 'unitary_synthesis'
  | 'spider_fusion'
  | 'zx_identity'
  | 'bialgebra_rules'
  | 'pivot_local_comp'
  | 'phase_gadget_fusion'
  | 'clifford_simplify'
  | 't_opt_via_zx'
  | 'window_2'
  | 'window_3'
  | 'window_4'
  | 'cnot_rotation'
  | 'rotation_rotation'
  | 'controlled_uncontrolled'
  | 'equivalence_check'
  | 'reversibility_check'
  | 'entanglement_analysis'
  | 'resource_estimation'
  | 'clifford_detection'

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
