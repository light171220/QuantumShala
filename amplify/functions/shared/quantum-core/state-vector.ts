import type { Complex } from '../types'
import * as C from './complex'

export class StateVector {
  readonly numQubits: number
  readonly size: number
  private amplitudes: Float64Array

  constructor(numQubits: number) {
    if (numQubits < 1 || numQubits > 30) {
      throw new Error(`Invalid qubit count: ${numQubits}. Must be 1-30.`)
    }
    this.numQubits = numQubits
    this.size = 1 << numQubits
    this.amplitudes = new Float64Array(this.size * 2)
    this.amplitudes[0] = 1
  }

  static fromAmplitudes(amplitudes: Complex[]): StateVector {
    const numQubits = Math.log2(amplitudes.length)
    if (!Number.isInteger(numQubits)) {
      throw new Error('Amplitude array length must be a power of 2')
    }
    const sv = new StateVector(numQubits)
    for (let i = 0; i < amplitudes.length; i++) {
      sv.amplitudes[i * 2] = amplitudes[i].re
      sv.amplitudes[i * 2 + 1] = amplitudes[i].im
    }
    return sv
  }

  clone(): StateVector {
    const sv = new StateVector(this.numQubits)
    sv.amplitudes.set(this.amplitudes)
    return sv
  }

  reset(): void {
    this.amplitudes.fill(0)
    this.amplitudes[0] = 1
  }

  setBasisState(index: number): void {
    if (index < 0 || index >= this.size) {
      throw new Error(`Invalid basis state index: ${index}`)
    }
    this.amplitudes.fill(0)
    this.amplitudes[index * 2] = 1
  }

  getAmplitude(index: number): Complex {
    return {
      re: this.amplitudes[index * 2],
      im: this.amplitudes[index * 2 + 1],
    }
  }

  setAmplitude(index: number, value: Complex): void {
    this.amplitudes[index * 2] = value.re
    this.amplitudes[index * 2 + 1] = value.im
  }

  getProbability(index: number): number {
    const re = this.amplitudes[index * 2]
    const im = this.amplitudes[index * 2 + 1]
    return re * re + im * im
  }

  getProbabilities(): Float64Array {
    const probs = new Float64Array(this.size)
    for (let i = 0; i < this.size; i++) {
      const re = this.amplitudes[i * 2]
      const im = this.amplitudes[i * 2 + 1]
      probs[i] = re * re + im * im
    }
    return probs
  }

  getAmplitudes(): Float64Array {
    return this.amplitudes
  }

  toArray(): Complex[] {
    const result: Complex[] = []
    for (let i = 0; i < this.size; i++) {
      result.push({
        re: this.amplitudes[i * 2],
        im: this.amplitudes[i * 2 + 1],
      })
    }
    return result
  }

  normalize(): void {
    let norm = 0
    for (let i = 0; i < this.size; i++) {
      const re = this.amplitudes[i * 2]
      const im = this.amplitudes[i * 2 + 1]
      norm += re * re + im * im
    }
    if (norm > 0 && Math.abs(norm - 1) > 1e-10) {
      const invNorm = 1 / Math.sqrt(norm)
      for (let i = 0; i < this.amplitudes.length; i++) {
        this.amplitudes[i] *= invNorm
      }
    }
  }

  applySingleQubitGate(qubit: number, matrix: Complex[][]): void {
    const stride = 1 << qubit
    const blockSize = stride << 1

    for (let block = 0; block < this.size; block += blockSize) {
      for (let i = 0; i < stride; i++) {
        const idx0 = block + i
        const idx1 = idx0 + stride

        const a0Re = this.amplitudes[idx0 * 2]
        const a0Im = this.amplitudes[idx0 * 2 + 1]
        const a1Re = this.amplitudes[idx1 * 2]
        const a1Im = this.amplitudes[idx1 * 2 + 1]

        const m00 = matrix[0][0]
        const m01 = matrix[0][1]
        const m10 = matrix[1][0]
        const m11 = matrix[1][1]

        const new0Re =
          m00.re * a0Re - m00.im * a0Im + m01.re * a1Re - m01.im * a1Im
        const new0Im =
          m00.re * a0Im + m00.im * a0Re + m01.re * a1Im + m01.im * a1Re

        const new1Re =
          m10.re * a0Re - m10.im * a0Im + m11.re * a1Re - m11.im * a1Im
        const new1Im =
          m10.re * a0Im + m10.im * a0Re + m11.re * a1Im + m11.im * a1Re

        this.amplitudes[idx0 * 2] = new0Re
        this.amplitudes[idx0 * 2 + 1] = new0Im
        this.amplitudes[idx1 * 2] = new1Re
        this.amplitudes[idx1 * 2 + 1] = new1Im
      }
    }
  }

  applyCNOT(control: number, target: number): void {
    const controlBit = 1 << control
    const targetBit = 1 << target

    for (let i = 0; i < this.size; i++) {
      if ((i & controlBit) !== 0 && (i & targetBit) === 0) {
        const j = i | targetBit
        const tempRe = this.amplitudes[i * 2]
        const tempIm = this.amplitudes[i * 2 + 1]
        this.amplitudes[i * 2] = this.amplitudes[j * 2]
        this.amplitudes[i * 2 + 1] = this.amplitudes[j * 2 + 1]
        this.amplitudes[j * 2] = tempRe
        this.amplitudes[j * 2 + 1] = tempIm
      }
    }
  }

  applyCZ(qubit1: number, qubit2: number): void {
    const bit1 = 1 << qubit1
    const bit2 = 1 << qubit2

    for (let i = 0; i < this.size; i++) {
      if ((i & bit1) !== 0 && (i & bit2) !== 0) {
        this.amplitudes[i * 2] = -this.amplitudes[i * 2]
        this.amplitudes[i * 2 + 1] = -this.amplitudes[i * 2 + 1]
      }
    }
  }

  applySWAP(qubit1: number, qubit2: number): void {
    const bit1 = 1 << qubit1
    const bit2 = 1 << qubit2

    for (let i = 0; i < this.size; i++) {
      const has1 = (i & bit1) !== 0
      const has2 = (i & bit2) !== 0
      if (has1 !== has2) {
        const j = i ^ bit1 ^ bit2
        if (i < j) {
          const tempRe = this.amplitudes[i * 2]
          const tempIm = this.amplitudes[i * 2 + 1]
          this.amplitudes[i * 2] = this.amplitudes[j * 2]
          this.amplitudes[i * 2 + 1] = this.amplitudes[j * 2 + 1]
          this.amplitudes[j * 2] = tempRe
          this.amplitudes[j * 2 + 1] = tempIm
        }
      }
    }
  }

  applyControlledGate(
    control: number,
    target: number,
    matrix: Complex[][]
  ): void {
    const controlBit = 1 << control
    const targetBit = 1 << target

    for (let i = 0; i < this.size; i++) {
      if ((i & controlBit) !== 0 && (i & targetBit) === 0) {
        const idx0 = i
        const idx1 = i | targetBit

        const a0Re = this.amplitudes[idx0 * 2]
        const a0Im = this.amplitudes[idx0 * 2 + 1]
        const a1Re = this.amplitudes[idx1 * 2]
        const a1Im = this.amplitudes[idx1 * 2 + 1]

        const m00 = matrix[0][0]
        const m01 = matrix[0][1]
        const m10 = matrix[1][0]
        const m11 = matrix[1][1]

        this.amplitudes[idx0 * 2] =
          m00.re * a0Re - m00.im * a0Im + m01.re * a1Re - m01.im * a1Im
        this.amplitudes[idx0 * 2 + 1] =
          m00.re * a0Im + m00.im * a0Re + m01.re * a1Im + m01.im * a1Re
        this.amplitudes[idx1 * 2] =
          m10.re * a0Re - m10.im * a0Im + m11.re * a1Re - m11.im * a1Im
        this.amplitudes[idx1 * 2 + 1] =
          m10.re * a0Im + m10.im * a0Re + m11.re * a1Im + m11.im * a1Re
      }
    }
  }

  measure(qubit: number, rng?: () => number): { result: 0 | 1; probability: number } {
    const random = rng?.() ?? Math.random()
    const bit = 1 << qubit
    let prob0 = 0

    for (let i = 0; i < this.size; i++) {
      if ((i & bit) === 0) {
        const re = this.amplitudes[i * 2]
        const im = this.amplitudes[i * 2 + 1]
        prob0 += re * re + im * im
      }
    }

    const result: 0 | 1 = random < prob0 ? 0 : 1
    const probability = result === 0 ? prob0 : 1 - prob0

    const normFactor = 1 / Math.sqrt(probability)
    for (let i = 0; i < this.size; i++) {
      const hasOne = (i & bit) !== 0
      if ((result === 0 && hasOne) || (result === 1 && !hasOne)) {
        this.amplitudes[i * 2] = 0
        this.amplitudes[i * 2 + 1] = 0
      } else {
        this.amplitudes[i * 2] *= normFactor
        this.amplitudes[i * 2 + 1] *= normFactor
      }
    }

    return { result, probability }
  }

  measureAll(rng?: () => number): number {
    const random = rng?.() ?? Math.random()
    let cumulative = 0

    for (let i = 0; i < this.size; i++) {
      const re = this.amplitudes[i * 2]
      const im = this.amplitudes[i * 2 + 1]
      cumulative += re * re + im * im
      if (random < cumulative) {
        this.amplitudes.fill(0)
        this.amplitudes[i * 2] = 1
        return i
      }
    }

    const lastIdx = this.size - 1
    this.amplitudes.fill(0)
    this.amplitudes[lastIdx * 2] = 1
    return lastIdx
  }

  sample(numSamples: number, rng?: () => number): Map<number, number> {
    const probs = this.getProbabilities()
    const counts = new Map<number, number>()

    for (let s = 0; s < numSamples; s++) {
      const random = rng?.() ?? Math.random()
      let cumulative = 0
      for (let i = 0; i < this.size; i++) {
        cumulative += probs[i]
        if (random < cumulative) {
          counts.set(i, (counts.get(i) ?? 0) + 1)
          break
        }
      }
    }

    return counts
  }

  innerProduct(other: StateVector): Complex {
    if (this.numQubits !== other.numQubits) {
      throw new Error('State vectors must have same number of qubits')
    }

    let re = 0
    let im = 0
    for (let i = 0; i < this.size; i++) {
      const aRe = this.amplitudes[i * 2]
      const aIm = this.amplitudes[i * 2 + 1]
      const bRe = other.amplitudes[i * 2]
      const bIm = other.amplitudes[i * 2 + 1]
      re += aRe * bRe + aIm * bIm
      im += aRe * bIm - aIm * bRe
    }

    return { re, im }
  }

  getMemoryUsageMB(): number {
    return (this.amplitudes.byteLength / 1024 / 1024)
  }
}
