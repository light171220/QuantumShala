import { Circuit, executeCircuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'
import { encode } from '../encoders'

export class ProjectedKernel {
  private numQubits: number
  private encoderConfig: EncoderConfig
  private projectionDim: number
  private gamma: number

  constructor(
    numQubits: number,
    encoderConfig: EncoderConfig,
    projectionDim: number = 10,
    gamma: number = 1.0
  ) {
    this.numQubits = numQubits
    this.encoderConfig = encoderConfig
    this.projectionDim = projectionDim
    this.gamma = gamma
  }

  project(x: number[]): number[] {
    const circuit = new Circuit(this.numQubits)
    encode(circuit, x, this.encoderConfig)

    const state = executeCircuit(circuit)
    const projections: number[] = []

    for (let i = 0; i < this.projectionDim; i++) {
      const observable = this.getObservable(i)
      const expectation = this.computeExpectation(state, observable)
      projections.push(expectation)
    }

    return projections
  }

  compute(x1: number[], x2: number[]): number {
    const p1 = this.project(x1)
    const p2 = this.project(x2)

    let sqDist = 0
    for (let i = 0; i < this.projectionDim; i++) {
      sqDist += Math.pow(p1[i] - p2[i], 2)
    }

    return Math.exp(-this.gamma * sqDist)
  }

  computeMatrix(X: number[][]): number[][] {
    const projections = X.map(x => this.project(x))
    const n = X.length
    const K: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
      K[i][i] = 1.0
      for (let j = i + 1; j < n; j++) {
        let sqDist = 0
        for (let k = 0; k < this.projectionDim; k++) {
          sqDist += Math.pow(projections[i][k] - projections[j][k], 2)
        }
        const kij = Math.exp(-this.gamma * sqDist)
        K[i][j] = kij
        K[j][i] = kij
      }
    }

    return K
  }

  private getObservable(index: number): string {
    const paulis = ['Z', 'X', 'Y']
    const qubit = index % this.numQubits
    const pauliType = Math.floor(index / this.numQubits) % 3

    let observable = ''
    for (let q = 0; q < this.numQubits; q++) {
      observable += q === qubit ? paulis[pauliType] : 'I'
    }
    return observable
  }

  private computeExpectation(state: any, observable: string): number {
    const amps = state.toArray()
    let expectation = 0

    for (let i = 0; i < amps.length; i++) {
      let eigenvalue = 1
      for (let q = 0; q < this.numQubits; q++) {
        const bit = (i >> (this.numQubits - 1 - q)) & 1
        const pauli = observable[q]

        if (pauli === 'Z') {
          eigenvalue *= bit === 0 ? 1 : -1
        }
      }

      const prob = amps[i].re * amps[i].re + amps[i].im * amps[i].im
      expectation += eigenvalue * prob
    }

    return expectation
  }
}

export function computeProjectedKernel(
  X: number[][],
  numQubits: number,
  encoderConfig: EncoderConfig,
  projectionDim: number = 10,
  gamma: number = 1.0
): number[][] {
  const kernel = new ProjectedKernel(numQubits, encoderConfig, projectionDim, gamma)
  return kernel.computeMatrix(X)
}
