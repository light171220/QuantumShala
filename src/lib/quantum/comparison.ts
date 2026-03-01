import type {
  QuantumCircuit,
  SimulationResult,
  NoiseConfig,
  ComparisonBackend,
  ComparisonConfig,
  ComparisonResult,
  ComparisonMetrics,
  BackendResult,
} from '@/types/simulator'
import { simulateCircuit } from './simulator'
import { simulateNoisyCircuit, createNoiseConfig } from './noise-simulator'
import { simulateCliffordCircuit, isCliffordCircuit } from './clifford-simulator'
import { simulateWithTensorNetwork, estimateTensorNetworkFeasibility } from './tensor-network'

export const DEFAULT_BACKENDS: ComparisonBackend[] = [
  {
    id: 'browser_ideal',
    name: 'Browser (Ideal)',
    type: 'browser',
  },
  {
    id: 'browser_ibmq',
    name: 'Browser + IBMQ Noise',
    type: 'browser_noisy',
    noiseConfig: createNoiseConfig('ibmq'),
  },
  {
    id: 'browser_ionq',
    name: 'Browser + IonQ Noise',
    type: 'browser_noisy',
    noiseConfig: createNoiseConfig('ionq'),
  },
]

export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  backends: [DEFAULT_BACKENDS[0], DEFAULT_BACKENDS[1]],
  shots: 1024,
  includeStatistics: true,
}

export class CircuitComparator {
  private config: ComparisonConfig

  constructor(config: ComparisonConfig = DEFAULT_COMPARISON_CONFIG) {
    this.config = config
  }

  setConfig(config: Partial<ComparisonConfig>): void {
    this.config = { ...this.config, ...config }
  }

  async runComparison(circuit: QuantumCircuit): Promise<ComparisonResult> {
    const results: BackendResult[] = []

    for (const backend of this.config.backends) {
      const result = await this.runOnBackend(circuit, backend)
      results.push(result)
    }

    const metrics = this.calculateMetrics(results)

    return {
      results,
      metrics,
      timestamp: Date.now(),
    }
  }

  private async runOnBackend(
    circuit: QuantumCircuit,
    backend: ComparisonBackend
  ): Promise<BackendResult> {
    const startTime = performance.now()
    let result: SimulationResult

    switch (backend.type) {
      case 'browser':
        result = simulateCircuit(circuit, this.config.shots)
        break

      case 'browser_noisy':
        if (!backend.noiseConfig) {
          throw new Error(`Noise config required for noisy backend: ${backend.id}`)
        }
        result = simulateNoisyCircuit(circuit, this.config.shots, backend.noiseConfig)
        break

      case 'clifford':
        if (!isCliffordCircuit(circuit)) {
          throw new Error(`Circuit contains non-Clifford gates, cannot use Clifford backend`)
        }
        result = simulateCliffordCircuit(circuit, this.config.shots)
        break

      case 'tensor_network':
        const feasibility = estimateTensorNetworkFeasibility(circuit)
        if (!feasibility.feasible) {
          throw new Error(feasibility.reason || 'Tensor network simulation not feasible')
        }
        result = simulateWithTensorNetwork(circuit, this.config.shots)
        break

      default:
        result = simulateCircuit(circuit, this.config.shots)
    }

    return {
      backendId: backend.id,
      backendName: backend.name,
      result,
      executionTime: performance.now() - startTime,
    }
  }

  private calculateMetrics(results: BackendResult[]): ComparisonMetrics {
    const fidelityMatrix: Record<string, Record<string, number>> = {}
    const tvdMatrix: Record<string, Record<string, number>> = {}
    const klDivergenceMatrix: Record<string, Record<string, number>> = {}

    for (const r1 of results) {
      fidelityMatrix[r1.backendId] = {}
      tvdMatrix[r1.backendId] = {}
      klDivergenceMatrix[r1.backendId] = {}

      for (const r2 of results) {
        fidelityMatrix[r1.backendId][r2.backendId] = this.calculateFidelity(
          r1.result.probabilities,
          r2.result.probabilities
        )
        tvdMatrix[r1.backendId][r2.backendId] = this.calculateTVD(
          r1.result.probabilities,
          r2.result.probabilities
        )
        klDivergenceMatrix[r1.backendId][r2.backendId] = this.calculateKLDivergence(
          r1.result.probabilities,
          r2.result.probabilities
        )
      }
    }

    return {
      fidelityMatrix,
      tvdMatrix,
      klDivergenceMatrix,
      referenceBackend: results[0]?.backendId || '',
    }
  }

  private calculateFidelity(
    p: Record<string, number>,
    q: Record<string, number>
  ): number {
    const allStates = new Set([...Object.keys(p), ...Object.keys(q)])
    let fidelity = 0

    for (const state of allStates) {
      const pProb = p[state] || 0
      const qProb = q[state] || 0
      fidelity += Math.sqrt(pProb * qProb)
    }

    return fidelity * fidelity
  }

  private calculateTVD(
    p: Record<string, number>,
    q: Record<string, number>
  ): number {
    const allStates = new Set([...Object.keys(p), ...Object.keys(q)])
    let tvd = 0

    for (const state of allStates) {
      const pProb = p[state] || 0
      const qProb = q[state] || 0
      tvd += Math.abs(pProb - qProb)
    }

    return tvd / 2
  }

  private calculateKLDivergence(
    p: Record<string, number>,
    q: Record<string, number>
  ): number {
    const epsilon = 1e-10
    let kl = 0

    for (const state of Object.keys(p)) {
      const pProb = p[state] || epsilon
      const qProb = q[state] || epsilon

      if (pProb > epsilon) {
        kl += pProb * Math.log(pProb / qProb)
      }
    }

    return Math.max(0, kl)
  }
}

export function runComparison(
  circuit: QuantumCircuit,
  config?: Partial<ComparisonConfig>
): Promise<ComparisonResult> {
  const comparator = new CircuitComparator({ ...DEFAULT_COMPARISON_CONFIG, ...config })
  return comparator.runComparison(circuit)
}

export function getAvailableBackends(circuit: QuantumCircuit): ComparisonBackend[] {
  const backends: ComparisonBackend[] = [
    {
      id: 'browser_ideal',
      name: 'Browser (Ideal)',
      type: 'browser',
    },
    {
      id: 'browser_depolarizing_low',
      name: 'Depolarizing (0.1%)',
      type: 'browser_noisy',
      noiseConfig: createNoiseConfig('custom', {
        model: { type: 'depolarizing', errorRate: 0.001 },
      }),
    },
    {
      id: 'browser_depolarizing_high',
      name: 'Depolarizing (1%)',
      type: 'browser_noisy',
      noiseConfig: createNoiseConfig('custom', {
        model: { type: 'depolarizing', errorRate: 0.01 },
      }),
    },
    {
      id: 'browser_ibmq',
      name: 'IBMQ-style Noise',
      type: 'browser_noisy',
      noiseConfig: createNoiseConfig('ibmq'),
    },
    {
      id: 'browser_ionq',
      name: 'IonQ-style Noise',
      type: 'browser_noisy',
      noiseConfig: createNoiseConfig('ionq'),
    },
  ]

  if (isCliffordCircuit(circuit)) {
    backends.push({
      id: 'clifford',
      name: 'Clifford Simulator',
      type: 'clifford',
    })
  }

  const tnFeasibility = estimateTensorNetworkFeasibility(circuit)
  if (tnFeasibility.feasible) {
    backends.push({
      id: 'tensor_network',
      name: 'Tensor Network',
      type: 'tensor_network',
    })
  }

  return backends
}

export function formatMetricValue(value: number, type: 'fidelity' | 'tvd' | 'kl'): string {
  switch (type) {
    case 'fidelity':
      return `${(value * 100).toFixed(2)}%`
    case 'tvd':
      return value.toFixed(4)
    case 'kl':
      return value.toFixed(4)
    default:
      return value.toFixed(4)
  }
}

export function getMetricDescription(type: 'fidelity' | 'tvd' | 'kl'): string {
  switch (type) {
    case 'fidelity':
      return 'Classical fidelity measures how similar two probability distributions are. 100% means identical.'
    case 'tvd':
      return 'Total Variation Distance is the maximum difference in probability for any event. 0 means identical.'
    case 'kl':
      return 'KL Divergence measures information loss when using one distribution to approximate another. 0 means identical.'
    default:
      return ''
  }
}

export function summarizeComparison(result: ComparisonResult): {
  bestMatch: { backend1: string; backend2: string; fidelity: number }
  worstMatch: { backend1: string; backend2: string; fidelity: number }
  averageFidelity: number
} {
  let bestMatch = { backend1: '', backend2: '', fidelity: 0 }
  let worstMatch = { backend1: '', backend2: '', fidelity: 1 }
  let totalFidelity = 0
  let count = 0

  const backendIds = Object.keys(result.metrics.fidelityMatrix)

  for (let i = 0; i < backendIds.length; i++) {
    for (let j = i + 1; j < backendIds.length; j++) {
      const b1 = backendIds[i]
      const b2 = backendIds[j]
      const fidelity = result.metrics.fidelityMatrix[b1][b2]

      totalFidelity += fidelity
      count++

      if (fidelity > bestMatch.fidelity) {
        bestMatch = { backend1: b1, backend2: b2, fidelity }
      }
      if (fidelity < worstMatch.fidelity) {
        worstMatch = { backend1: b1, backend2: b2, fidelity }
      }
    }
  }

  return {
    bestMatch,
    worstMatch,
    averageFidelity: count > 0 ? totalFidelity / count : 0,
  }
}
