import { Circuit, executeCircuit } from '../../quantum-core'
import type { EncoderConfig, AnsatzConfig } from '../types'
import { encode } from '../encoders'
import { buildAnsatz } from '../ansatze'

export class TrainableKernel {
  private numQubits: number
  private encoderConfig: EncoderConfig
  private ansatzConfig: AnsatzConfig
  private parameters: number[]

  constructor(
    numQubits: number,
    encoderConfig: EncoderConfig,
    ansatzConfig: AnsatzConfig,
    initialParameters?: number[]
  ) {
    this.numQubits = numQubits
    this.encoderConfig = encoderConfig
    this.ansatzConfig = ansatzConfig

    const testCircuit = this.buildFeatureMap([0, 0])
    const numParams = testCircuit.getParameterCount()
    this.parameters = initialParameters ?? Array(numParams).fill(0).map(() => Math.random() * 2 * Math.PI)
  }

  private buildFeatureMap(x: number[]): Circuit {
    const circuit = new Circuit(this.numQubits)
    encode(circuit, x, this.encoderConfig)

    const ansatz = buildAnsatz(this.ansatzConfig)
    for (const gate of ansatz.gates) {
      circuit.gates.push({ ...gate })
    }

    return circuit
  }

  compute(x1: number[], x2: number[]): number {
    const circuit1 = this.buildFeatureMap(x1)
    const circuit2 = this.buildFeatureMap(x2)

    circuit1.setParameters(this.parameters)
    circuit2.setParameters(this.parameters)

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

  setParameters(params: number[]): void {
    this.parameters = [...params]
  }

  getParameters(): number[] {
    return [...this.parameters]
  }

  getNumParameters(): number {
    return this.parameters.length
  }

  computeKernelTargetAlignment(X: number[][], y: number[]): number {
    const K = this.computeMatrix(X)
    const n = X.length

    const Y: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Y[i][j] = y[i] === y[j] ? 1 : -1
      }
    }

    let kyCross = 0
    let kNorm = 0
    let yNorm = 0

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        kyCross += K[i][j] * Y[i][j]
        kNorm += K[i][j] * K[i][j]
        yNorm += Y[i][j] * Y[i][j]
      }
    }

    return kyCross / Math.sqrt(kNorm * yNorm)
  }
}
