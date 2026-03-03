import { Circuit, executeCircuit } from '../../quantum-core'
import type { AnsatzConfig } from '../types'
import { buildAnsatz } from '../ansatze'

export interface EntanglementResult {
  meyerWallach: number
  averagePurity: number
  entanglingCapability: number
  maxEntanglement: number
}

export class EntanglementAnalyzer {
  private numSamples: number

  constructor(numSamples: number = 100) {
    this.numSamples = numSamples
  }

  analyze(ansatzConfig: AnsatzConfig): EntanglementResult {
    const circuit = buildAnsatz(ansatzConfig)
    const numParams = circuit.getParameterCount()
    const numQubits = ansatzConfig.numQubits

    const meyerWallachValues: number[] = []
    const purities: number[] = []

    for (let sample = 0; sample < this.numSamples; sample++) {
      const params = Array.from({ length: numParams }, () => Math.random() * 2 * Math.PI)
      const c = circuit.clone()
      c.setParameters(params)

      const state = executeCircuit(c)
      const amplitudes = state.toArray()

      const mw = this.computeMeyerWallach(amplitudes, numQubits)
      meyerWallachValues.push(mw)

      const purity = this.computeAveragePurity(amplitudes, numQubits)
      purities.push(purity)
    }

    const avgMeyerWallach = meyerWallachValues.reduce((a, b) => a + b, 0) / meyerWallachValues.length
    const avgPurity = purities.reduce((a, b) => a + b, 0) / purities.length
    const maxEntanglement = Math.max(...meyerWallachValues)

    const entanglingCapability = this.computeEntanglingCapability(meyerWallachValues)

    return {
      meyerWallach: avgMeyerWallach,
      averagePurity: avgPurity,
      entanglingCapability,
      maxEntanglement,
    }
  }

  private computeMeyerWallach(
    amplitudes: { re: number; im: number }[],
    numQubits: number
  ): number {
    let totalEntanglement = 0

    for (let qubit = 0; qubit < numQubits; qubit++) {
      const reducedDensity = this.computeReducedDensityMatrix(amplitudes, numQubits, qubit)
      const linearEntropy = this.computeLinearEntropy(reducedDensity)
      totalEntanglement += linearEntropy
    }

    return (2 / numQubits) * totalEntanglement
  }

  private computeReducedDensityMatrix(
    amplitudes: { re: number; im: number }[],
    numQubits: number,
    targetQubit: number
  ): { re: number; im: number }[][] {
    const rho: { re: number; im: number }[][] = [
      [{ re: 0, im: 0 }, { re: 0, im: 0 }],
      [{ re: 0, im: 0 }, { re: 0, im: 0 }],
    ]

    const n = amplitudes.length

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const biti = (i >> (numQubits - 1 - targetQubit)) & 1
        const bitj = (j >> (numQubits - 1 - targetQubit)) & 1

        const restI = i ^ (biti << (numQubits - 1 - targetQubit))
        const restJ = j ^ (bitj << (numQubits - 1 - targetQubit))

        if (restI === restJ) {
          const prodRe = amplitudes[i].re * amplitudes[j].re + amplitudes[i].im * amplitudes[j].im
          const prodIm = amplitudes[i].im * amplitudes[j].re - amplitudes[i].re * amplitudes[j].im

          rho[biti][bitj].re += prodRe
          rho[biti][bitj].im += prodIm
        }
      }
    }

    return rho
  }

  private computeLinearEntropy(rho: { re: number; im: number }[][]): number {
    let trace_rho_sq = 0

    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < 2; k++) {
        const prod = {
          re: rho[i][k].re * rho[k][i].re - rho[i][k].im * rho[k][i].im,
          im: rho[i][k].re * rho[k][i].im + rho[i][k].im * rho[k][i].re,
        }
        trace_rho_sq += prod.re
      }
    }

    return 1 - trace_rho_sq
  }

  private computeAveragePurity(
    amplitudes: { re: number; im: number }[],
    numQubits: number
  ): number {
    let totalPurity = 0

    for (let qubit = 0; qubit < numQubits; qubit++) {
      const rho = this.computeReducedDensityMatrix(amplitudes, numQubits, qubit)
      let purity = 0
      for (let i = 0; i < 2; i++) {
        for (let k = 0; k < 2; k++) {
          purity += rho[i][k].re * rho[k][i].re - rho[i][k].im * rho[k][i].im
        }
      }
      totalPurity += purity
    }

    return totalPurity / numQubits
  }

  private computeEntanglingCapability(meyerWallachValues: number[]): number {
    const threshold = 0.5
    const highEntanglementCount = meyerWallachValues.filter(mw => mw > threshold).length
    return highEntanglementCount / meyerWallachValues.length
  }
}

export function computeEntanglement(
  ansatzConfig: AnsatzConfig,
  numSamples: number = 50
): EntanglementResult {
  const analyzer = new EntanglementAnalyzer(numSamples)
  return analyzer.analyze(ansatzConfig)
}
