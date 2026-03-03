export * from './registry'
export * from './diagnostics'
export * from './presets'
export * from './engine'
export * from './passes'

import { optimizationEngine, optimizeCircuitEnhanced, optimizeRealTime } from './engine'
import { applyPreset, getPresetPasses, getAvailablePresets, type OptimizationPreset } from './presets'
import { runDiagnostics, hasCircuitErrors, getCircuitSummary } from './diagnostics'
import { passRegistry } from './registry'
import { registerAllPasses } from './passes'

registerAllPasses()

export {
  optimizationEngine,
  optimizeCircuitEnhanced,
  optimizeRealTime,

  applyPreset,
  getPresetPasses,
  getAvailablePresets,
  type OptimizationPreset,

  runDiagnostics,
  hasCircuitErrors,
  getCircuitSummary,

  passRegistry,
  registerAllPasses,
}
