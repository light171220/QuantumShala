import { Circuit, executeCircuit } from '../../quantum-core'
import type { AnsatzConfig } from '../types'
import { buildAnsatz } from '../ansatze'

export interface TrainabilityResult {
  trainability: number
  gradientVariance: number
  averageGradientMagnitude: number
  effectiveDimension: number
  qfiTrace: number
}

export class TrainabilityAnalyzer {
  private numSamples: number

  constructor(numSamples: number = 100) {
    this.numSamples = numSamples
  }

  analyze(ansatzConfig: AnsatzConfig): TrainabilityResult {
    const circuit = buildAnsatz(ansatzConfig)
    const numParams = circuit.getParameterCount()
    const numQubits = ansatzConfig.numQubits

    const gradientNorms: number[] = []
    const gradients: number[][] = []

    for (let sample = 0; sample < this.numSamples; sample++) {
      const params = Array.from({ length: numParams }, () => Math.random() * 2 * Math.PI)
      const grad = this.computeGradients(circuit, params, numQubits)
      gradients.push(grad)

      const norm = Math.sqrt(grad.reduce((sum, g) => sum + g * g, 0))
      gradientNorms.push(norm)
    }

    const gradientVariance = this.computeVariance(gradientNorms)
    const averageGradientMagnitude = gradientNorms.reduce((a, b) => a + b, 0) / gradientNorms.length

    const qfi = this.estimateQFI(gradients)
    const qfiTrace = qfi.reduce((sum, row, i) => sum + row[i], 0)

    const effectiveDimension = this.computeEffectiveDimension(qfi, numParams)

    const trainability = this.normalizeTrainability(gradientVariance, numQubits)

    return {
      trainability,
      gradientVariance,
      averageGradientMagnitude,
      effectiveDimension,
      qfiTrace,
    }
  }

  private computeGradients(circuit: Circuit, params: number[], numQubits: number): number[] {
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

      const expPlus = this.computeExpectation(circuitPlus, numQubits)
      const expMinus = this.computeExpectation(circuitMinus, numQubits)

      grads.push((expPlus - expMinus) / 2)
    }

    return grads
  }

  private computeExpectation(circuit: Circuit, numQubits: number): number {
    const state = executeCircuit(circuit)
    let expectation = 0

    for (let i = 0; i < Math.pow(2, numQubits); i++) {
      const prob = state.getProbability(i)
      let parity = 0
      let temp = i
      while (temp > 0) {
        parity ^= temp & 1
        temp >>= 1
      }
      expectation += (parity === 0 ? 1 : -1) * prob
    }

    return expectation
  }

  private computeVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  }

  private estimateQFI(gradients: number[][]): number[][] {
    const numParams = gradients[0].length
    const qfi: number[][] = Array.from({ length: numParams }, () => Array(numParams).fill(0))

    for (const grad of gradients) {
      for (let i = 0; i < numParams; i++) {
        for (let j = 0; j < numParams; j++) {
          qfi[i][j] += grad[i] * grad[j]
        }
      }
    }

    for (let i = 0; i < numParams; i++) {
      for (let j = 0; j < numParams; j++) {
        qfi[i][j] /= gradients.length
      }
    }

    return qfi
  }

  private computeEffectiveDimension(qfi: number[][], numParams: number): number {
    let nonZeroEigenvalues = 0
    const trace = qfi.reduce((sum, row, i) => sum + row[i], 0)
    const threshold = trace / numParams * 0.01

    for (let i = 0; i < numParams; i++) {
      if (qfi[i][i] > threshold) {
        nonZeroEigenvalues++
      }
    }

    return nonZeroEigenvalues
  }

  private normalizeTrainability(variance: number, numQubits: number): number {
    const expectedVariance = Math.pow(2, -numQubits)
    const ratio = variance / expectedVariance
    return Math.min(1, Math.max(0, Math.log10(ratio + 1) / 2))
  }
}

export function computeTrainability(
  ansatzConfig: AnsatzConfig,
  numSamples: number = 50
): TrainabilityResult {
  const analyzer = new TrainabilityAnalyzer(numSamples)
  return analyzer.analyze(ansatzConfig)
}
