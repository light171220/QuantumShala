import { Circuit, executeCircuit, StateVector } from '../../quantum-core'
import type { AnsatzConfig } from '../types'
import { buildAnsatz } from '../ansatze'

export interface BarrenPlateauResult {
  detected: boolean
  severity: 'none' | 'mild' | 'moderate' | 'severe'
  gradientVariance: number
  averageGradientMagnitude: number
  recommendations: string[]
}

export class BarrenPlateauAnalyzer {
  private numSamples: number
  private numQubits: number

  constructor(numQubits: number, numSamples: number = 100) {
    this.numQubits = numQubits
    this.numSamples = numSamples
  }

  analyze(ansatzConfig: AnsatzConfig): BarrenPlateauResult {
    const gradients: number[][] = []

    for (let sample = 0; sample < this.numSamples; sample++) {
      const circuit = buildAnsatz(ansatzConfig)
      const numParams = circuit.getParameterCount()
      const params = Array.from({ length: numParams }, () => Math.random() * 2 * Math.PI)
      circuit.setParameters(params)

      const grads = this.computeGradients(circuit, params)
      gradients.push(grads)
    }

    const variance = this.computeVariance(gradients)
    const avgMagnitude = this.computeAverageMagnitude(gradients)

    return this.interpretResults(variance, avgMagnitude, ansatzConfig)
  }

  private computeGradients(circuit: Circuit, params: number[]): number[] {
    const grads: number[] = []
    const shift = Math.PI / 2

    for (let i = 0; i < params.length; i++) {
      const paramsPlus = [...params]
      const paramsMinus = [...params]
      paramsPlus[i] += shift
      paramsMinus[i] -= shift

      const circuitPlus = circuit.clone()
      const circuitMinus = circuit.clone()
      circuitPlus.setParameters(paramsPlus)
      circuitMinus.setParameters(paramsMinus)

      const expPlus = this.computeExpectation(circuitPlus)
      const expMinus = this.computeExpectation(circuitMinus)

      grads.push((expPlus - expMinus) / 2)
    }

    return grads
  }

  private computeExpectation(circuit: Circuit): number {
    const state = executeCircuit(circuit)
    let expectation = 0

    for (let i = 0; i < Math.pow(2, this.numQubits); i++) {
      const prob = state.getProbability(i)
      const parity = this.computeParity(i)
      expectation += parity * prob
    }

    return expectation
  }

  private computeParity(state: number): number {
    let parity = 0
    while (state > 0) {
      parity ^= state & 1
      state >>= 1
    }
    return parity === 0 ? 1 : -1
  }

  private computeVariance(gradients: number[][]): number {
    if (gradients.length === 0 || gradients[0].length === 0) return 0

    const numParams = gradients[0].length
    let totalVariance = 0

    for (let p = 0; p < numParams; p++) {
      const values = gradients.map(g => g[p])
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
      totalVariance += variance
    }

    return totalVariance / numParams
  }

  private computeAverageMagnitude(gradients: number[][]): number {
    let total = 0
    let count = 0

    for (const grad of gradients) {
      for (const g of grad) {
        total += Math.abs(g)
        count++
      }
    }

    return count > 0 ? total / count : 0
  }

  private interpretResults(
    variance: number,
    avgMagnitude: number,
    config: AnsatzConfig
  ): BarrenPlateauResult {
    const recommendations: string[] = []

    let severity: 'none' | 'mild' | 'moderate' | 'severe'
    let detected = false

    const expectedVariance = Math.pow(2, -config.numQubits)

    if (variance < expectedVariance * 0.1) {
      severity = 'severe'
      detected = true
      recommendations.push('Consider using a shallower circuit')
      recommendations.push('Try layerwise training')
      recommendations.push('Use identity initialization')
      recommendations.push('Consider local cost functions')
    } else if (variance < expectedVariance) {
      severity = 'moderate'
      detected = true
      recommendations.push('Consider reducing circuit depth')
      recommendations.push('Try different entanglement pattern')
      recommendations.push('Use SPSA or QN-SPSA optimizer')
    } else if (variance < expectedVariance * 10) {
      severity = 'mild'
      detected = true
      recommendations.push('Monitor gradient norms during training')
      recommendations.push('Consider adaptive learning rate')
    } else {
      severity = 'none'
      detected = false
    }

    return {
      detected,
      severity,
      gradientVariance: variance,
      averageGradientMagnitude: avgMagnitude,
      recommendations,
    }
  }
}

export function detectBarrenPlateau(
  ansatzConfig: AnsatzConfig,
  numSamples: number = 50
): BarrenPlateauResult {
  const analyzer = new BarrenPlateauAnalyzer(ansatzConfig.numQubits, numSamples)
  return analyzer.analyze(ansatzConfig)
}
