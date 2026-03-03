import type { QuantumCircuit } from '@/types/simulator'
import type { OptimizationResult, OptimizationStats, OptimizationAction, OptimizationSuggestion } from '@/types/optimizer'
import { passRegistry, type PassResult, type OptimizationPass } from './registry'
import { registerAllPasses } from './passes'
import { applyPreset, type OptimizationPreset, PRESET_CONFIGS } from './presets'
import { runDiagnostics, type DiagnosticResult } from './diagnostics'
import type { ParsedCircuit } from '../parsers/types'
import { v4 as uuid } from 'uuid'

export interface OptimizationConfig {
  preset?: OptimizationPreset
  passes?: string[]
  maxIterations?: number
  timeoutMs?: number
  generateSuggestions?: boolean
  runDiagnostics?: boolean
}

const DEFAULT_CONFIG: Required<OptimizationConfig> = {
  preset: 'standard',
  passes: [],
  maxIterations: 10,
  timeoutMs: 5000,
  generateSuggestions: true,
  runDiagnostics: true,
}

export interface EnhancedOptimizationResult extends OptimizationResult {
  diagnostics?: DiagnosticResult
  passResults: PassResultSummary[]
  iterations: number
  timedOut: boolean
}

export interface PassResultSummary {
  passId: string
  passName: string
  applied: boolean
  gatesRemoved: number
  gatesMerged: number
  gatesReplaced: number
  timeMs: number
}

export class OptimizationEngine {
  private initialized = false

  constructor() {
    this.initialize()
  }

  private initialize(): void {
    if (this.initialized) return
    registerAllPasses()
    this.initialized = true
  }

  optimize(circuit: QuantumCircuit, config: OptimizationConfig = {}): EnhancedOptimizationResult {
    this.initialize()

    const mergedConfig = { ...DEFAULT_CONFIG, ...config }
    const startTime = performance.now()

    if (mergedConfig.passes && mergedConfig.passes.length > 0) {
      for (const pass of passRegistry.getAll()) {
        pass.enabled = false
      }
      for (const passId of mergedConfig.passes) {
        passRegistry.setEnabled(passId, true)
      }
    } else if (mergedConfig.preset) {
      applyPreset(mergedConfig.preset)
    }

    const passes = passRegistry.getSorted().filter((p) => p.enabled)

    const original = JSON.parse(JSON.stringify(circuit))
    let current = JSON.parse(JSON.stringify(circuit)) as QuantumCircuit

    const allActions: OptimizationAction[] = []
    const passResults: PassResultSummary[] = []
    const passesApplied: string[] = []

    let iterations = 0
    let changed = true
    let timedOut = false

    while (changed && iterations < mergedConfig.maxIterations) {
      const elapsed = performance.now() - startTime
      if (elapsed > mergedConfig.timeoutMs) {
        timedOut = true
        break
      }

      changed = false
      iterations++

      for (const pass of passes) {
        const passStartTime = performance.now()

        try {
          const result = pass.apply(current)

          const passTime = performance.now() - passStartTime

          passResults.push({
            passId: pass.id,
            passName: pass.name,
            applied: result.applied,
            gatesRemoved: result.gatesRemoved,
            gatesMerged: result.gatesMerged,
            gatesReplaced: result.gatesReplaced,
            timeMs: passTime,
          })

          if (result.applied) {
            current = result.circuit
            changed = true

            for (const action of result.actions) {
              allActions.push({
                type: action.type === 'reorder' ? 'replace' : action.type,
                details: {
                  gateIds: action.gateIds,
                  reason: action.description,
                } as any, // Type compatibility
              })
            }

            if (!passesApplied.includes(pass.id)) {
              passesApplied.push(pass.id)
            }
          }
        } catch (error) {
          console.error(`Pass ${pass.id} failed:`, error)
        }
      }
    }

    current = this.compactPositions(current)

    const stats = this.calculateStats(original, current, allActions)

    const suggestions = mergedConfig.generateSuggestions
      ? this.generateSuggestions(current)
      : []

    let diagnostics: DiagnosticResult | undefined
    if (mergedConfig.runDiagnostics) {
      // Convert QuantumCircuit to ParsedCircuit-like structure for diagnostics
      diagnostics = this.runCircuitDiagnostics(current)
    }

    const executionTimeMs = performance.now() - startTime

    return {
      original,
      optimized: current,
      actions: allActions,
      suggestions,
      stats,
      passesApplied: passesApplied as any[],
      executionTimeMs,
      diagnostics,
      passResults,
      iterations,
      timedOut,
    }
  }

  optimizeRealTime(circuit: QuantumCircuit): EnhancedOptimizationResult {
    return this.optimize(circuit, {
      preset: 'realtime',
      maxIterations: 2,
      timeoutMs: 50,
      generateSuggestions: false,
      runDiagnostics: false,
    })
  }

  optimizeStandard(circuit: QuantumCircuit): EnhancedOptimizationResult {
    return this.optimize(circuit, {
      preset: 'standard',
      maxIterations: 5,
      timeoutMs: 500,
    })
  }

  optimizeDeep(circuit: QuantumCircuit): EnhancedOptimizationResult {
    return this.optimize(circuit, {
      preset: 'deep',
      maxIterations: 10,
      timeoutMs: 5000,
    })
  }

  getAvailablePasses(): OptimizationPass[] {
    this.initialize()
    return passRegistry.getAll()
  }

  getEnabledPasses(): OptimizationPass[] {
    this.initialize()
    return passRegistry.getEnabled()
  }

  private compactPositions(circuit: QuantumCircuit): QuantumCircuit {
    const result = JSON.parse(JSON.stringify(circuit)) as QuantumCircuit
    const sortedGates = [...result.gates].sort((a, b) => a.position - b.position)

    const qubitLastPosition: Record<number, number> = {}

    for (const gate of sortedGates) {
      const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
      let newPos = 0

      for (const qubit of allQubits) {
        if (qubitLastPosition[qubit] !== undefined) {
          newPos = Math.max(newPos, qubitLastPosition[qubit] + 1)
        }
      }

      gate.position = newPos

      for (const qubit of allQubits) {
        qubitLastPosition[qubit] = newPos
      }
    }

    return result
  }

  private calculateStats(
    original: QuantumCircuit,
    optimized: QuantumCircuit,
    actions: OptimizationAction[]
  ): OptimizationStats {
    const originalDepth = this.calculateDepth(original)
    const optimizedDepth = this.calculateDepth(optimized)
    const gatesRemoved = original.gates.length - optimized.gates.length
    const gatesMerged = actions.filter((a) => a.type === 'merge').length

    return {
      originalGateCount: original.gates.length,
      optimizedGateCount: optimized.gates.length,
      originalDepth,
      optimizedDepth,
      gatesRemoved: Math.max(0, gatesRemoved),
      gatesMerged,
      reductionPercent:
        original.gates.length > 0
          ? ((original.gates.length - optimized.gates.length) / original.gates.length) * 100
          : 0,
    }
  }

  private calculateDepth(circuit: QuantumCircuit): number {
    if (circuit.gates.length === 0) return 0

    const qubitDepth: Record<number, number> = {}

    const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

    for (const gate of sortedGates) {
      const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
      const maxDepth = Math.max(...allQubits.map((q) => qubitDepth[q] || 0))

      for (const q of allQubits) {
        qubitDepth[q] = maxDepth + 1
      }
    }

    return Math.max(...Object.values(qubitDepth), 0)
  }

  private generateSuggestions(circuit: QuantumCircuit): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = []
    const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

    const swaps = sortedGates.filter((g) => g.type === 'SWAP')
    if (swaps.length > 0) {
      suggestions.push({
        id: uuid(),
        type: 'gate_decomposition',
        description: `${swaps.length} SWAP gate(s) could be decomposed to CNOTs for hardware compatibility`,
        gateIds: swaps.map((g) => g.id),
        potentialSavings: 0,
        applied: false,
      })
    }

    const toffolies = sortedGates.filter((g) => g.type === 'Toffoli')
    if (toffolies.length > 0) {
      suggestions.push({
        id: uuid(),
        type: 'gate_decomposition',
        description: `${toffolies.length} Toffoli gate(s) could be decomposed to native gates`,
        gateIds: toffolies.map((g) => g.id),
        potentialSavings: 0,
        applied: false,
      })
    }

    const rotations = sortedGates.filter((g) =>
      ['Rx', 'Ry', 'Rz', 'Phase', 'U1'].includes(g.type)
    )
    if (rotations.length > 10) {
      suggestions.push({
        id: uuid(),
        type: 'rotation_merging',
        description: `Circuit has ${rotations.length} rotation gates. Enable commutation passes for more merging.`,
        gateIds: rotations.slice(0, 5).map((g) => g.id),
        potentialSavings: Math.floor(rotations.length * 0.2),
        applied: false,
      })
    }

    return suggestions
  }

  private runCircuitDiagnostics(circuit: QuantumCircuit): DiagnosticResult {
    const parsedCircuit: ParsedCircuit = {
      numQubits: circuit.numQubits,
      numClassicalBits: circuit.measurements.length,
      gates: circuit.gates.map((g) => ({
        id: g.id,
        type: g.type,
        qubits: g.qubits,
        parameters: g.parameters || [],
        controlQubits: g.controlQubits || [],
        position: g.position,
        line: 0,
        column: 0,
        sourceCode: '',
        isConditional: false,
      })),
      measurements: circuit.measurements.map((m) => ({
        qubit: m.qubit,
        classicalBit: m.classicalBit,
        position: m.position,
        line: 0,
        column: 0,
      })),
      registers: [{ name: 'q', size: circuit.numQubits, startIndex: 0 }],
      classicalRegisters: [{ name: 'c', size: circuit.measurements.length, startIndex: 0 }],
      metadata: {
        hasBarriers: circuit.gates.some((g) => g.type === 'Barrier'),
        hasCustomGates: false,
        hasConditionals: false,
        totalOperations: circuit.gates.length + circuit.measurements.length,
        circuitDepth: this.calculateDepth(circuit),
        maxQubitIndex: circuit.numQubits - 1,
      },
    }

    return runDiagnostics(parsedCircuit)
  }
}

export const optimizationEngine = new OptimizationEngine()

export function optimizeCircuitEnhanced(
  circuit: QuantumCircuit,
  config?: OptimizationConfig
): EnhancedOptimizationResult {
  return optimizationEngine.optimize(circuit, config)
}

export function optimizeRealTime(circuit: QuantumCircuit): EnhancedOptimizationResult {
  return optimizationEngine.optimizeRealTime(circuit)
}

export function getOptimizationSuggestionsEnhanced(circuit: QuantumCircuit): OptimizationSuggestion[] {
  const result = optimizationEngine.optimize(circuit, {
    preset: 'minimal',
    generateSuggestions: true,
  })
  return result.suggestions
}
