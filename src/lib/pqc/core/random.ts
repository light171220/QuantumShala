export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    console.warn('Using insecure Math.random() - not suitable for production!')
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return bytes
}

export function randomUint32(): number {
  const bytes = randomBytes(4)
  return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0
}

export function randomRange(max: number): number {
  if (max <= 0) return 0
  if (max > 0xFFFFFFFF) {
    throw new Error('Max value too large')
  }

  const limit = Math.floor(0xFFFFFFFF / max) * max
  let value: number
  do {
    value = randomUint32()
  } while (value >= limit)

  return value % max
}

export function randomSmallPoly(length: number, eta: number): number[] {
  const coeffs: number[] = new Array(length)
  const bytes = randomBytes(length * 2)

  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let j = 0; j < eta; j++) {
      const byte = bytes[i * 2 + Math.floor(j / 4)]
      const bit1 = (byte >> ((j * 2) % 8)) & 1
      const bit2 = (byte >> ((j * 2 + 1) % 8)) & 1
      sum += bit1 - bit2
    }
    coeffs[i] = sum
  }

  return coeffs
}

export function sampleCBD(bytes: Uint8Array, eta: number): number[] {
  const n = bytes.length * 4 / eta
  const coeffs: number[] = new Array(n)

  if (eta === 2) {
    for (let i = 0; i < n; i++) {
      const byteIdx = Math.floor(i / 2)
      const shift = (i % 2) * 4
      const bits = (bytes[byteIdx] >> shift) & 0xF

      const a = (bits & 1) + ((bits >> 1) & 1)
      const b = ((bits >> 2) & 1) + ((bits >> 3) & 1)
      coeffs[i] = a - b
    }
  } else if (eta === 3) {
    for (let i = 0; i < n; i++) {
      const bitPos = i * 6
      const bytePos = Math.floor(bitPos / 8)
      const bitOffset = bitPos % 8

      let bits: number
      if (bitOffset <= 2) {
        bits = (bytes[bytePos] >> bitOffset) & 0x3F
      } else {
        bits = ((bytes[bytePos] >> bitOffset) | (bytes[bytePos + 1] << (8 - bitOffset))) & 0x3F
      }

      const a = (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1)
      const b = ((bits >> 3) & 1) + ((bits >> 4) & 1) + ((bits >> 5) & 1)
      coeffs[i] = a - b
    }
  } else {
    throw new Error(`Unsupported eta: ${eta}`)
  }

  return coeffs
}

export function sampleUniform(length: number, q: number): number[] {
  const coeffs: number[] = new Array(length)

  const bytesPerCoeff = Math.ceil(Math.log2(q) / 8)
  const bytes = randomBytes(length * bytesPerCoeff * 2)

  let byteIdx = 0
  for (let i = 0; i < length; i++) {
    let value: number
    do {
      value = 0
      for (let j = 0; j < bytesPerCoeff && byteIdx < bytes.length; j++) {
        value |= bytes[byteIdx++] << (j * 8)
      }
      value = value % (q * 2)
    } while (value >= q && byteIdx < bytes.length)

    coeffs[i] = value % q
  }

  return coeffs
}

export function sampleTernary(length: number, weight: number = -1): number[] {
  const coeffs: number[] = new Array(length).fill(0)

  if (weight < 0) {
    const bytes = randomBytes(Math.ceil(length / 4))
    for (let i = 0; i < length; i++) {
      const bits = (bytes[Math.floor(i / 4)] >> ((i % 4) * 2)) & 0x3
      if (bits === 0) coeffs[i] = 0
      else if (bits === 1) coeffs[i] = 1
      else if (bits === 2) coeffs[i] = -1
      else coeffs[i] = 0
    }
  } else {
    const indices = new Array(length).fill(0).map((_, i) => i)
    shuffleArray(indices)

    for (let i = 0; i < weight && i < length; i++) {
      coeffs[indices[i]] = (randomBytes(1)[0] & 1) ? 1 : -1
    }
  }

  return coeffs
}

export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomRange(i + 1)
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export function randomBits(numBits: number): Uint8Array {
  const numBytes = Math.ceil(numBits / 8)
  const bytes = randomBytes(numBytes)

  const extraBits = numBits % 8
  if (extraBits > 0) {
    bytes[numBytes - 1] &= (1 << extraBits) - 1
  }

  return bytes
}

export function constantTimeCompare(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    return 1
  }

  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }

  return diff
}

export function constantTimeSelect(select: number, a: Uint8Array, b: Uint8Array): Uint8Array {
  const mask = -Math.sign(select)
  const result = new Uint8Array(a.length)

  for (let i = 0; i < a.length; i++) {
    result[i] = (a[i] & ~mask) | (b[i] & mask)
  }

  return result
}

export function zeroize(bytes: Uint8Array): void {
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = 0
  }
}

export class DeterministicRNG {
  private state: Uint32Array

  constructor(seed: Uint8Array) {
    this.state = new Uint32Array(4)
    for (let i = 0; i < Math.min(seed.length, 16); i++) {
      this.state[Math.floor(i / 4)] |= seed[i] << ((i % 4) * 8)
    }
    for (let i = 0; i < 20; i++) {
      this.next()
    }
  }

  private next(): number {
    const result = this.rotl(this.state[1] * 5, 7) * 9
    const t = this.state[1] << 9

    this.state[2] ^= this.state[0]
    this.state[3] ^= this.state[1]
    this.state[1] ^= this.state[2]
    this.state[0] ^= this.state[3]
    this.state[2] ^= t
    this.state[3] = this.rotl(this.state[3], 11)

    return result >>> 0
  }

  private rotl(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0
  }

  randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length)
    for (let i = 0; i < length; i += 4) {
      const value = this.next()
      for (let j = 0; j < 4 && i + j < length; j++) {
        bytes[i + j] = (value >> (j * 8)) & 0xFF
      }
    }
    return bytes
  }
}

export const pqcRandom = {
  randomBytes,
  randomUint32,
  randomRange,
  randomSmallPoly,
  sampleCBD,
  sampleUniform,
  sampleTernary,
  shuffleArray,
  randomBits,
  constantTimeCompare,
  constantTimeSelect,
  zeroize,
  DeterministicRNG
}
