import { Circuit, executeCircuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'
import { encode } from '../encoders'

export class FidelityKernel {
  private numQubits: number
  private encoderConfig: EncoderConfig

  constructor(numQubits: number, encoderConfig: EncoderConfig) {
    this.numQubits = numQubits
    this.encoderConfig = encoderConfig
  }

  compute(x1: number[], x2: number[]): number {
    const circuit1 = new Circuit(this.numQubits)
    const circuit2 = new Circuit(this.numQubits)

    encode(circuit1, x1, this.encoderConfig)
    encode(circuit2, x2, this.encoderConfig)

    const state1 = executeCircuit(circuit1)
    const state2 = executeCircuit(circuit2)

    const amps1 = state1.toArray()
    const amps2 = state2.toArray()

    let overlapRe = 0
    let overlapIm = 0
    for (let i = 0; i < amps1.length; i++) {
      overlapRe += amps1[i].re * amps2[i].re + amps1[i].im * amps2[i].im
      overlapIm += amps1[i].re * amps2[i].im - amps1[i].im * amps2[i].re
    }

    return overlapRe * overlapRe + overlapIm * overlapIm
  }

  computeMatrix(X: number[][]): number[][] {
    const n = X.length
    const K: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
      K[i][i] = 1.0
      for (let j = i + 1; j < n; j++) {
        const kij = this.compute(X[i], X[j])
        K[i][j] = kij
        K[j][i] = kij
      }
    }

    return K
  }
}

export function computeFidelityKernel(
  X: number[][],
  numQubits: number,
  encoderConfig: EncoderConfig
): number[][] {
  const kernel = new FidelityKernel(numQubits, encoderConfig)
  return kernel.computeMatrix(X)
}
