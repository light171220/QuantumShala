import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { X } from '../../circuit/operations/gates'

export interface BasisEncodingConfig {
  wires?: number[]
  msbFirst?: boolean
}

export function basisEncoding(
  tape: QuantumTape,
  data: number | number[] | QTensor,
  config: BasisEncodingConfig = {}
): void {
  const msbFirst = config.msbFirst ?? true

  let bits: number[]

  if (typeof data === 'number') {
    bits = integerToBits(data)
  } else if (data instanceof QTensor) {
    bits = Array.from(data.data).map(v => Math.round(v) & 1)
  } else {
    bits = data.map(v => Math.round(v) & 1)
  }

  const numBits = bits.length
  const wires = config.wires ?? Array.from({ length: numBits }, (_, i) => i)

  if (wires.length < numBits) {
    throw new Error(`Not enough wires (${wires.length}) for ${numBits} bits`)
  }

  const orderedBits = msbFirst ? bits : [...bits].reverse()

  for (let i = 0; i < numBits; i++) {
    if (orderedBits[i] === 1) {
      X(tape, wires[i])
    }
  }
}

function integerToBits(n: number, minBits?: number): number[] {
  if (n < 0) {
    throw new Error('Cannot encode negative integers')
  }

  if (n === 0) {
    return minBits ? new Array(minBits).fill(0) : [0]
  }

  const bits: number[] = []
  let value = Math.floor(n)

  while (value > 0) {
    bits.unshift(value & 1)
    value = value >> 1
  }

  if (minBits && bits.length < minBits) {
    const padding = new Array(minBits - bits.length).fill(0)
    return [...padding, ...bits]
  }

  return bits
}

export function basisEncodingInteger(
  tape: QuantumTape,
  value: number,
  numQubits: number,
  config: BasisEncodingConfig = {}
): void {
  const bits = integerToBits(value, numQubits)

  if (bits.length > numQubits) {
    throw new Error(`Value ${value} requires more than ${numQubits} qubits`)
  }

  basisEncoding(tape, bits, config)
}

export function basisEncodingBitstring(
  tape: QuantumTape,
  bitstring: string,
  config: BasisEncodingConfig = {}
): void {
  const bits = bitstring.split('').map(c => {
    if (c !== '0' && c !== '1') {
      throw new Error(`Invalid character in bitstring: ${c}`)
    }
    return parseInt(c, 10)
  })

  basisEncoding(tape, bits, config)
}

export function multiBasisEncoding(
  tape: QuantumTape,
  dataPoints: number[][],
  wiresPerPoint: number,
  config: BasisEncodingConfig = {}
): void {
  const msbFirst = config.msbFirst ?? true

  let currentWire = 0

  for (const data of dataPoints) {
    const wires = Array.from(
      { length: wiresPerPoint },
      (_, i) => currentWire + i
    )

    const bits = data.length > wiresPerPoint
      ? data.slice(0, wiresPerPoint)
      : [...data, ...new Array(wiresPerPoint - data.length).fill(0)]

    basisEncoding(tape, bits, { wires, msbFirst })
    currentWire += wiresPerPoint
  }
}

export function thermometerEncoding(
  tape: QuantumTape,
  value: number,
  numLevels: number,
  wires?: number[]
): void {
  const level = Math.min(Math.max(Math.floor(value), 0), numLevels)
  const effectiveWires = wires ?? Array.from({ length: numLevels }, (_, i) => i)

  for (let i = 0; i < level; i++) {
    X(tape, effectiveWires[i])
  }
}

export function oneHotEncoding(
  tape: QuantumTape,
  index: number,
  numClasses: number,
  wires?: number[]
): void {
  if (index < 0 || index >= numClasses) {
    throw new Error(`Index ${index} out of range for ${numClasses} classes`)
  }

  const effectiveWires = wires ?? Array.from({ length: numClasses }, (_, i) => i)
  X(tape, effectiveWires[index])
}
