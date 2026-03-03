import type { CircuitGate, QuantumCircuit } from '@/types/simulator'

export type PassCategory =
  | 'algebraic'
  | 'commutation'
  | 'template'
  | 'hardware'
  | 'mathematical'
  | 'zx'
  | 'peephole'
  | 'analysis'

export type PassTiming = 'fast' | 'standard' | 'deep'

export interface OptimizationPass {
  id: string
  name: string
  category: PassCategory
  description: string
  timing: PassTiming
  priority: number
  enabled: boolean
  estimatedTimeMs: number
  apply: (circuit: QuantumCircuit) => PassResult
}

export interface PassResult {
  circuit: QuantumCircuit
  actions: PassAction[]
  gatesRemoved: number
  gatesMerged: number
  gatesReplaced: number
  applied: boolean
}

export interface PassAction {
  type: 'remove' | 'merge' | 'replace' | 'reorder'
  gateIds: string[]
  description: string
  newGates?: CircuitGate[]
}

class PassRegistry {
  private passes: Map<string, OptimizationPass> = new Map()
  private categoryOrder: PassCategory[] = [
    'algebraic',
    'peephole',
    'commutation',
    'template',
    'mathematical',
    'hardware',
    'zx',
    'analysis',
  ]

  register(pass: OptimizationPass): void {
    this.passes.set(pass.id, pass)
  }

  get(id: string): OptimizationPass | undefined {
    return this.passes.get(id)
  }

  getAll(): OptimizationPass[] {
    return Array.from(this.passes.values())
  }

  getByCategory(category: PassCategory): OptimizationPass[] {
    return this.getAll().filter((p) => p.category === category)
  }

  getByTiming(timing: PassTiming): OptimizationPass[] {
    return this.getAll().filter((p) => p.timing === timing)
  }

  getEnabled(): OptimizationPass[] {
    return this.getAll().filter((p) => p.enabled)
  }

  getSorted(): OptimizationPass[] {
    return this.getAll().sort((a, b) => {
      const catOrderA = this.categoryOrder.indexOf(a.category)
      const catOrderB = this.categoryOrder.indexOf(b.category)
      if (catOrderA !== catOrderB) return catOrderA - catOrderB
      return a.priority - b.priority
    })
  }

  getFastPasses(): OptimizationPass[] {
    return this.getSorted().filter((p) => p.timing === 'fast' && p.enabled)
  }

  getStandardPasses(): OptimizationPass[] {
    return this.getSorted().filter(
      (p) => (p.timing === 'fast' || p.timing === 'standard') && p.enabled
    )
  }

  getDeepPasses(): OptimizationPass[] {
    return this.getSorted().filter((p) => p.enabled)
  }

  setEnabled(id: string, enabled: boolean): void {
    const pass = this.passes.get(id)
    if (pass) {
      pass.enabled = enabled
    }
  }

  enableCategory(category: PassCategory, enabled: boolean): void {
    for (const pass of this.passes.values()) {
      if (pass.category === category) {
        pass.enabled = enabled
      }
    }
  }

  getEstimatedTime(timing: PassTiming): number {
    let passes: OptimizationPass[]
    switch (timing) {
      case 'fast':
        passes = this.getFastPasses()
        break
      case 'standard':
        passes = this.getStandardPasses()
        break
      case 'deep':
        passes = this.getDeepPasses()
        break
    }
    return passes.reduce((sum, p) => sum + p.estimatedTimeMs, 0)
  }

  clear(): void {
    this.passes.clear()
  }
}

export const passRegistry = new PassRegistry()

export function createPass(
  config: Omit<OptimizationPass, 'apply'> & {
    apply: (circuit: QuantumCircuit) => PassResult
  }
): OptimizationPass {
  return config
}

export function noOpResult(circuit: QuantumCircuit): PassResult {
  return {
    circuit,
    actions: [],
    gatesRemoved: 0,
    gatesMerged: 0,
    gatesReplaced: 0,
    applied: false,
  }
}
