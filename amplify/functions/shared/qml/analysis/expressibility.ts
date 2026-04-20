import { Circuit, executeCircuit } from '../../quantum-core'
import type { AnsatzConfig } from '../types'
import { buildAnsatz } from '../ansatze'

export interface ExpressibilityResult {
  expressibility: number
  framePotential: number
  haarFramePotential: number
  numSamples: number
}

export class ExpressibilityAnalyzer {
  private numSamples: number

  constructor(numSamples: number = 1000) {
    this.numSamples = numSamples
  }

  analyze(ansatzConfig: AnsatzConfig): ExpressibilityResult {
    const circuit = buildAnsatz(ansatzConfig)
    const numParams = circuit.getParameterCount()
    const numQubits = ansatzConfig.numQubits

    const fidelities: number[] = []

    for (let i = 0; i < this.numSamples; i++) {
      const params1 = Array.from({ length: numParams }, () => Math.random() * 2 * Math.PI)
      const params2 = Array.from({ length: numParams }, () => Math.random() * 2 * Math.PI)

      const circuit1 = circuit.clone()
      const circuit2 = circuit.clone()
      circuit1.setParameters(params1)
      circuit2.setParameters(params2)

      const state1 = executeCircuit(circuit1)
      const state2 = executeCircuit(circuit2)

      const fidelity = computeFidelity(state1, state2)
      fidelities.push(fidelity)
    }

    const framePotential = computeFramePotential(fidelities)
    const haarFramePotential = computeHaarFramePotential(numQubits)

    const expressibility = Math.max(0, Math.min(1, haarFramePotential / framePotential))

    return {
      expressibility,
      framePotential,
      haarFramePotential,
      numSamples: this.numSamples,
    }
  }
}

function computeFidelity(state1: any, state2: any): number {
  const amps1 = state1.toArray()
  const amps2 = state2.toArray()

  let overlap = { re: 0, im: 0 }
  for (let i = 0; i < amps1.length; i++) {
    overlap.re += amps1[i].re * amps2[i].re + amps1[i].im * amps2[i].im
    overlap.im += amps1[i].re * amps2[i].im - amps1[i].im * amps2[i].re
  }

  return overlap.re * overlap.re + overlap.im * overlap.im
}

function computeFramePotential(fidelities: number[]): number {
  let sum = 0
  for (const f of fidelities) {
    sum += f * f
  }
  return sum / fidelities.length
}

function computeHaarFramePotential(numQubits: number): number {
  const d = Math.pow(2, numQubits)
  return 2 / (d * (d + 1))
}

export function computeExpressibility(
  ansatzConfig: AnsatzConfig,
  numSamples: number = 500
): ExpressibilityResult {
  const analyzer = new ExpressibilityAnalyzer(numSamples)
  return analyzer.analyze(ansatzConfig)
}
