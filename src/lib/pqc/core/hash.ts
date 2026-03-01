const RC: bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
]

const RHO = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14]
]

const PI: [number, number][] = []
for (let y = 0; y < 5; y++) {
  for (let x = 0; x < 5; x++) {
    PI.push([(x + 3 * y) % 5, x])
  }
}

function rotl64(x: bigint, n: number): bigint {
  n = n % 64
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & 0xFFFFFFFFFFFFFFFFn
}

function keccakF(state: bigint[][]): void {
  for (let round = 0; round < 24; round++) {
    const C: bigint[] = [0n, 0n, 0n, 0n, 0n]
    for (let x = 0; x < 5; x++) {
      C[x] = state[x][0] ^ state[x][1] ^ state[x][2] ^ state[x][3] ^ state[x][4]
    }

    const D: bigint[] = [0n, 0n, 0n, 0n, 0n]
    for (let x = 0; x < 5; x++) {
      D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1)
    }

    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x][y] ^= D[x]
      }
    }

    const B: bigint[][] = Array.from({ length: 5 }, () => [0n, 0n, 0n, 0n, 0n])
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        B[(2 * x + 3 * y) % 5][y] = rotl64(state[x][y], RHO[x][y])
      }
    }

    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x][y] = B[x][y] ^ ((~B[(x + 1) % 5][y]) & B[(x + 2) % 5][y])
      }
    }

    state[0][0] ^= RC[round]
  }
}

function bytesToState(bytes: Uint8Array, rate: number): bigint[][] {
  const state: bigint[][] = Array.from({ length: 5 }, () => [0n, 0n, 0n, 0n, 0n])

  for (let i = 0; i < Math.min(bytes.length, rate); i++) {
    const x = Math.floor((i % 8) + Math.floor(i / 8) * 8) % 5
    const y = Math.floor(Math.floor(i / 8) / 5)
    if (y < 5) {
      state[x][y] ^= BigInt(bytes[i]) << BigInt((i % 8) * 8)
    }
  }

  return state
}

function stateToBytes(state: bigint[][], length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let idx = 0

  for (let y = 0; y < 5 && idx < length; y++) {
    for (let x = 0; x < 5 && idx < length; x++) {
      for (let b = 0; b < 8 && idx < length; b++) {
        bytes[idx++] = Number((state[x][y] >> BigInt(b * 8)) & 0xFFn)
      }
    }
  }

  return bytes
}

function keccak(input: Uint8Array, outputLen: number, rate: number, suffix: number): Uint8Array {
  const blockSize = rate / 8

  const padLen = blockSize - (input.length % blockSize)
  const padded = new Uint8Array(input.length + padLen)
  padded.set(input)
  padded[input.length] = suffix
  padded[padded.length - 1] |= 0x80

  let state: bigint[][] = Array.from({ length: 5 }, () => [0n, 0n, 0n, 0n, 0n])

  for (let i = 0; i < padded.length; i += blockSize) {
    const block = padded.slice(i, i + blockSize)
    for (let j = 0; j < blockSize && j < block.length; j++) {
      const x = (j >> 3) % 5
      const y = Math.floor((j >> 3) / 5)
      if (y < 5) {
        state[x][y] ^= BigInt(block[j]) << BigInt((j % 8) * 8)
      }
    }
    keccakF(state)
  }

  const output = new Uint8Array(outputLen)
  let offset = 0

  while (offset < outputLen) {
    const chunk = stateToBytes(state, Math.min(blockSize, outputLen - offset))
    output.set(chunk, offset)
    offset += chunk.length
    if (offset < outputLen) {
      keccakF(state)
    }
  }

  return output
}

export function sha3_256(input: Uint8Array): Uint8Array {
  return keccak(input, 32, 1088, 0x06)
}

export function sha3_512(input: Uint8Array): Uint8Array {
  return keccak(input, 64, 576, 0x06)
}

export function shake128(input: Uint8Array, outputLen: number): Uint8Array {
  return keccak(input, outputLen, 1344, 0x1F)
}

export function shake256(input: Uint8Array, outputLen: number): Uint8Array {
  return keccak(input, outputLen, 1088, 0x1F)
}

export function hmacSha3_256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 136

  let processedKey: Uint8Array
  if (key.length > blockSize) {
    processedKey = sha3_256(key)
  } else {
    processedKey = new Uint8Array(blockSize)
    processedKey.set(key)
  }

  const oKeyPad = new Uint8Array(blockSize)
  const iKeyPad = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = processedKey[i] ^ 0x5c
    iKeyPad[i] = processedKey[i] ^ 0x36
  }

  const innerInput = new Uint8Array(blockSize + message.length)
  innerInput.set(iKeyPad)
  innerInput.set(message, blockSize)
  const innerHash = sha3_256(innerInput)

  const outerInput = new Uint8Array(blockSize + 32)
  outerInput.set(oKeyPad)
  outerInput.set(innerHash, blockSize)

  return sha3_256(outerInput)
}

export function kdf(input: Uint8Array, info: Uint8Array, outputLen: number): Uint8Array {
  const combined = new Uint8Array(input.length + info.length)
  combined.set(input)
  combined.set(info, input.length)
  return shake256(combined, outputLen)
}

export function prf(seed: Uint8Array, nonce: number, outputLen: number): Uint8Array {
  const input = new Uint8Array(seed.length + 2)
  input.set(seed)
  input[seed.length] = nonce & 0xFF
  input[seed.length + 1] = (nonce >> 8) & 0xFF
  return shake256(input, outputLen)
}

export function hashWithDomain(domain: string, message: Uint8Array): Uint8Array {
  const domainBytes = new TextEncoder().encode(domain)
  const input = new Uint8Array(domainBytes.length + 1 + message.length)
  input.set(domainBytes)
  input[domainBytes.length] = domainBytes.length
  input.set(message, domainBytes.length + 1)
  return sha3_256(input)
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

export const pqcHash = {
  sha3_256,
  sha3_512,
  shake128,
  shake256,
  hmacSha3_256,
  kdf,
  prf,
  hashWithDomain,
  hexToBytes,
  bytesToHex,
  concatBytes
}
