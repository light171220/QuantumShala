import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { ry, cnot, rz, X } from '../../circuit/operations/gates'

export interface AmplitudeEncodingConfig {
  wires?: number[]
  normalize?: boolean
  padZeros?: boolean
}

function normalizeAmplitudes(amplitudes: number[]): number[] {
  const sumSquares = amplitudes.reduce((sum, a) => sum + a * a, 0)
  if (sumSquares === 0) {
    throw new Error('Cannot normalize zero vector')
  }
  const norm = Math.sqrt(sumSquares)
  return amplitudes.map(a => a / norm)
}

function padToPowerOfTwo(data: number[]): number[] {
  const n = data.length
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)))
  if (n === nextPow2) return data
  return [...data, ...new Array(nextPow2 - n).fill(0)]
}

function grayCode(n: number): number {
  return n ^ (n >> 1)
}

function computeRotationAngles(amplitudes: number[]): number[] {
  const n = amplitudes.length
  const numQubits = Math.log2(n)
  const angles: number[] = []

  function computeAnglesRecursive(
    amps: number[],
    depth: number,
    offset: number
  ): void {
    if (amps.length === 1) return

    const half = amps.length / 2
    const leftAmps = amps.slice(0, half)
    const rightAmps = amps.slice(half)

    const leftNorm = Math.sqrt(leftAmps.reduce((s, a) => s + a * a, 0))
    const rightNorm = Math.sqrt(rightAmps.reduce((s, a) => s + a * a, 0))
    const totalNorm = Math.sqrt(leftNorm * leftNorm + rightNorm * rightNorm)

    let theta = 0
    if (totalNorm > 1e-10) {
      theta = 2 * Math.acos(leftNorm / totalNorm)
    }

    angles.push(theta)

    const normalizedLeft = leftNorm > 1e-10
      ? leftAmps.map(a => a / leftNorm)
      : leftAmps.map(() => 0)
    const normalizedRight = rightNorm > 1e-10
      ? rightAmps.map(a => a / rightNorm)
      : rightAmps.map(() => 0)

    computeAnglesRecursive(normalizedLeft, depth + 1, offset)
    computeAnglesRecursive(normalizedRight, depth + 1, offset + half)
  }

  computeAnglesRecursive(amplitudes, 0, 0)
  return angles
}

export function amplitudeEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  config: AmplitudeEncodingConfig = {}
): void {
  const normalize = config.normalize ?? true
  const padZeros = config.padZeros ?? true

  let amplitudes = data instanceof QTensor
    ? Array.from(data.data)
    : [...data]

  if (padZeros) {
    amplitudes = padToPowerOfTwo(amplitudes)
  }

  const n = amplitudes.length
  if ((n & (n - 1)) !== 0) {
    throw new Error('Amplitude vector length must be a power of 2')
  }

  if (normalize) {
    amplitudes = normalizeAmplitudes(amplitudes)
  }

  const numQubits = Math.log2(n)
  const wires = config.wires ?? Array.from({ length: numQubits }, (_, i) => i)

  if (wires.length < numQubits) {
    throw new Error(`Not enough wires (${wires.length}) for ${numQubits} qubits`)
  }

  const angles = computeRotationAngles(amplitudes)

  let angleIdx = 0

  function applyMultiplexedRotation(
    controlQubits: number[],
    targetQubit: number
  ): void {
    const numControls = controlQubits.length
    const numAngles = Math.pow(2, numControls)

    if (numControls === 0) {
      if (angleIdx < angles.length) {
        ry(tape, targetQubit, angles[angleIdx++])
      }
      return
    }

    const rotationAngles: number[] = []
    for (let i = 0; i < numAngles && angleIdx < angles.length; i++) {
      rotationAngles.push(angles[angleIdx++])
    }

    while (rotationAngles.length < numAngles) {
      rotationAngles.push(0)
    }

    const transformedAngles = uniformlyControlledRotationAngles(rotationAngles)

    for (let i = 0; i < numAngles; i++) {
      ry(tape, targetQubit, transformedAngles[i])
      if (i < numAngles - 1) {
        const grayDiff = grayCode(i) ^ grayCode(i + 1)
        const controlIdx = Math.floor(Math.log2(grayDiff))
        if (controlIdx < controlQubits.length) {
          cnot(tape, controlQubits[controlIdx], targetQubit)
        }
      }
    }
    if (numAngles > 1) {
      const lastGray = grayCode(numAngles - 1)
      const firstControl = Math.floor(Math.log2(lastGray & -lastGray))
      if (firstControl < controlQubits.length) {
        cnot(tape, controlQubits[firstControl], targetQubit)
      }
    }
  }

  for (let qubit = 0; qubit < numQubits; qubit++) {
    const controlQubits = wires.slice(0, qubit)
    applyMultiplexedRotation(controlQubits, wires[qubit])
  }
}

function uniformlyControlledRotationAngles(angles: number[]): number[] {
  const n = angles.length
  if (n === 1) return angles

  const result = [...angles]

  for (let step = n; step > 1; step = step >> 1) {
    for (let i = 0; i < n; i += step) {
      const half = step >> 1
      for (let j = 0; j < half; j++) {
        const a = result[i + j]
        const b = result[i + j + half]
        result[i + j] = (a + b) / 2
        result[i + j + half] = (a - b) / 2
      }
    }
  }

  return result
}

export function mottonenStatePrep(
  tape: QuantumTape,
  data: number[] | QTensor,
  wires?: number[]
): void {
  amplitudeEncoding(tape, data, { wires, normalize: true, padZeros: true })
}

export function sparseAmplitudeEncoding(
  tape: QuantumTape,
  indices: number[],
  amplitudes: number[],
  numQubits: number,
  wires?: number[]
): void {
  if (indices.length !== amplitudes.length) {
    throw new Error('Indices and amplitudes must have same length')
  }

  const fullAmplitudes = new Array(Math.pow(2, numQubits)).fill(0)
  for (let i = 0; i < indices.length; i++) {
    fullAmplitudes[indices[i]] = amplitudes[i]
  }

  amplitudeEncoding(tape, fullAmplitudes, { wires, normalize: true, padZeros: false })
}
