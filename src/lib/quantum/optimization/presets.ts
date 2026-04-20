import { passRegistry, type PassTiming, type PassCategory } from './registry'
import { registerAllPasses } from './passes'

export type OptimizationPreset = 'realtime' | 'standard' | 'deep' | 'hardware' | 'fault-tolerant' | 'minimal'

export interface PresetConfig {
  name: string
  description: string
  timing: PassTiming
  categories: PassCategory[]
  maxTimeMs: number
  passIds?: string[]
}

export const PRESET_CONFIGS: Record<OptimizationPreset, PresetConfig> = {
  realtime: {
    name: 'Real-time',
    description: 'Fast optimizations for live preview (<50ms)',
    timing: 'fast',
    categories: ['algebraic', 'peephole'],
    maxTimeMs: 50,
    passIds: [
      'A1_identity_removal',
      'A2_self_inverse_cancel',
      'A3_rotation_folding',
      'G1_window_2',
      'G2_window_3',
      'C4_hadamard_sandwich',
      'H4_resource_estimation',
    ],
  },

  standard: {
    name: 'Standard',
    description: 'Balanced optimization for typical circuits',
    timing: 'standard',
    categories: ['algebraic', 'peephole', 'commutation', 'template'],
    maxTimeMs: 500,
    passIds: [
      'A1_identity_removal',
      'A2_self_inverse_cancel',
      'A3_rotation_folding',
      'A4_phase_merging',
      'A8_dead_gate_elimination',
      'G1_window_2',
      'G2_window_3',
      'G4_cnot_rotation',
      'G6_controlled_uncontrolled',
      'B1_single_qubit_commute',
      'B2_diagonal_commute',
      'B4_cnot_commute',
      'C4_hadamard_sandwich',
      'C8_cnot_swap_fusion',
      'E1_euler_zyz',
      'H4_resource_estimation',
      'H5_clifford_detection',
    ],
  },

  deep: {
    name: 'Deep',
    description: 'Maximum optimization for complex circuits',
    timing: 'deep',
    categories: ['algebraic', 'peephole', 'commutation', 'template', 'mathematical', 'analysis'],
    maxTimeMs: 5000,
  },

  hardware: {
    name: 'Hardware',
    description: 'Optimize for hardware execution (decompose to native gates)',
    timing: 'deep',
    categories: ['algebraic', 'template', 'mathematical'],
    maxTimeMs: 2000,
    passIds: [
      'A1_identity_removal',
      'A2_self_inverse_cancel',
      'A3_rotation_folding',
      'C1_swap_decomposition',
      'C2_toffoli_decomposition',
      'C3_cz_to_cnot',
      'E1_euler_zyz',
      'H4_resource_estimation',
    ],
  },

  'fault-tolerant': {
    name: 'Fault-Tolerant',
    description: 'Minimize T-count for fault-tolerant quantum computing',
    timing: 'deep',
    categories: ['algebraic', 'peephole', 'mathematical'],
    maxTimeMs: 10000,
    passIds: [
      'A1_identity_removal',
      'A2_self_inverse_cancel',
      'A3_rotation_folding',
      'A4_phase_merging',
      'G1_window_2',
      'G2_window_3',
      'E5_clifford_frame',
      'H4_resource_estimation',
      'H3_entanglement_analysis',
    ],
  },

  minimal: {
    name: 'Minimal',
    description: 'Only remove obvious identities',
    timing: 'fast',
    categories: ['algebraic'],
    maxTimeMs: 20,
    passIds: [
      'A1_identity_removal',
      'A2_self_inverse_cancel',
    ],
  },
}

export function applyPreset(preset: OptimizationPreset): void {
  registerAllPasses()

  const config = PRESET_CONFIGS[preset]

  for (const pass of passRegistry.getAll()) {
    pass.enabled = false
  }

  if (config.passIds) {
    for (const passId of config.passIds) {
      passRegistry.setEnabled(passId, true)
    }
  } else {
    for (const pass of passRegistry.getAll()) {
      const timingMatch =
        config.timing === 'deep' ||
        (config.timing === 'standard' && (pass.timing === 'fast' || pass.timing === 'standard')) ||
        (config.timing === 'fast' && pass.timing === 'fast')

      const categoryMatch = config.categories.includes(pass.category)

      pass.enabled = timingMatch && categoryMatch
    }
  }
}

export function getPresetPasses(preset: OptimizationPreset): string[] {
  applyPreset(preset)
  return passRegistry.getEnabled().map((p) => p.id)
}

export function getAvailablePresets(): OptimizationPreset[] {
  return Object.keys(PRESET_CONFIGS) as OptimizationPreset[]
}

export function getPresetConfig(preset: OptimizationPreset): PresetConfig {
  return PRESET_CONFIGS[preset]
}

export function getRealTimePasses(): string[] {
  return getPresetPasses('realtime')
}

export function getStandardPasses(): string[] {
  return getPresetPasses('standard')
}

export function getDeepPasses(): string[] {
  return getPresetPasses('deep')
}
