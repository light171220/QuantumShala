import { Polynomial, mod, modAdd, modSub, modMul, ntt, invNtt, KYBER_N } from '../core/math'
import { sha3_256, sha3_512, shake128, shake256, prf } from '../core/hash'
import { randomBytes, sampleUniform, sampleCBD } from '../core/random'

const DILITHIUM_Q = 8380417
const DILITHIUM_N = 256

export interface MLDSAParams {
  name: string
  k: number
  l: number
  eta: number
  tau: number
  gamma1: number
  gamma2: number
  beta: number
  omega: number
  publicKeySize: number
  secretKeySize: number
  signatureSize: number
  securityLevel: number
}

export const ML_DSA_44: MLDSAParams = {
  name: 'ML-DSA-44',
  k: 4,
  l: 4,
  eta: 2,
  tau: 39,
  gamma1: 1 << 17,
  gamma2: (DILITHIUM_Q - 1) / 88,
  beta: 78,
  omega: 80,
  publicKeySize: 1312,
  secretKeySize: 2560,
  signatureSize: 2420,
  securityLevel: 2
}

export const ML_DSA_65: MLDSAParams = {
  name: 'ML-DSA-65',
  k: 6,
  l: 5,
  eta: 4,
  tau: 49,
  gamma1: 1 << 19,
  gamma2: (DILITHIUM_Q - 1) / 32,
  beta: 196,
  omega: 55,
  publicKeySize: 1952,
  secretKeySize: 4032,
  signatureSize: 3309,
  securityLevel: 3
}

export const ML_DSA_87: MLDSAParams = {
  name: 'ML-DSA-87',
  k: 8,
  l: 7,
  eta: 2,
  tau: 60,
  gamma1: 1 << 19,
  gamma2: (DILITHIUM_Q - 1) / 32,
  beta: 120,
  omega: 75,
  publicKeySize: 2592,
  secretKeySize: 4896,
  signatureSize: 4627,
  securityLevel: 5
}

export interface MLDSAKeyPair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export interface MLDSASignature {
  signature: Uint8Array
}

class DilithiumPoly {
  coeffs: number[]
  n: number = DILITHIUM_N
  q: number = DILITHIUM_Q

  constructor(coeffs: number[] = []) {
    this.coeffs = new Array(this.n).fill(0)
    for (let i = 0; i < Math.min(coeffs.length, this.n); i++) {
      this.coeffs[i] = mod(coeffs[i], this.q)
    }
  }

  static zero(): DilithiumPoly {
    return new DilithiumPoly()
  }

  static random(): DilithiumPoly {
    const coeffs = sampleUniform(DILITHIUM_N, DILITHIUM_Q)
    return new DilithiumPoly(coeffs)
  }

  add(other: DilithiumPoly): DilithiumPoly {
    const result = new DilithiumPoly()
    for (let i = 0; i < this.n; i++) {
      result.coeffs[i] = modAdd(this.coeffs[i], other.coeffs[i], this.q)
    }
    return result
  }

  sub(other: DilithiumPoly): DilithiumPoly {
    const result = new DilithiumPoly()
    for (let i = 0; i < this.n; i++) {
      result.coeffs[i] = modSub(this.coeffs[i], other.coeffs[i], this.q)
    }
    return result
  }

  mul(other: DilithiumPoly): DilithiumPoly {
    const result = new Array(this.n).fill(0)
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        const idx = i + j
        const prod = modMul(this.coeffs[i], other.coeffs[j], this.q)
        if (idx < this.n) {
          result[idx] = modAdd(result[idx], prod, this.q)
        } else {
          result[idx - this.n] = modSub(result[idx - this.n], prod, this.q)
        }
      }
    }
    return new DilithiumPoly(result)
  }

  scale(s: number): DilithiumPoly {
    const result = new DilithiumPoly()
    for (let i = 0; i < this.n; i++) {
      result.coeffs[i] = modMul(this.coeffs[i], s, this.q)
    }
    return result
  }

  neg(): DilithiumPoly {
    const result = new DilithiumPoly()
    for (let i = 0; i < this.n; i++) {
      result.coeffs[i] = modSub(0, this.coeffs[i], this.q)
    }
    return result
  }

  centered(): number[] {
    return this.coeffs.map(c => {
      if (c > this.q / 2) return c - this.q
      return c
    })
  }

  infNorm(): number {
    const centered = this.centered()
    return Math.max(...centered.map(Math.abs))
  }

  highBits(gamma2: number): DilithiumPoly {
    const result = new DilithiumPoly()
    for (let i = 0; i < this.n; i++) {
      const c = this.coeffs[i]
      result.coeffs[i] = Math.floor((c + gamma2) / (2 * gamma2))
    }
    return result
  }

  lowBits(gamma2: number): DilithiumPoly {
    const result = new DilithiumPoly()
    for (let i = 0; i < this.n; i++) {
      const c = this.coeffs[i]
      const centered = c > this.q / 2 ? c - this.q : c
      result.coeffs[i] = mod(centered - Math.floor((centered + gamma2) / (2 * gamma2)) * 2 * gamma2, this.q)
    }
    return result
  }

  power2Round(d: number): { high: DilithiumPoly; low: DilithiumPoly } {
    const high = new DilithiumPoly()
    const low = new DilithiumPoly()
    const twoPowD = 1 << d

    for (let i = 0; i < this.n; i++) {
      const c = this.coeffs[i]
      high.coeffs[i] = Math.floor((c + (twoPowD >> 1)) / twoPowD)
      low.coeffs[i] = mod(c - high.coeffs[i] * twoPowD, this.q)
    }

    return { high, low }
  }
}

function sampleBoundedPoly(seed: Uint8Array, nonce: number, eta: number): DilithiumPoly {
  const prfOutput = prf(seed, nonce, DILITHIUM_N * 2)
  const coeffs: number[] = []

  for (let i = 0; i < DILITHIUM_N; i++) {
    const byte = prfOutput[i]
    const low = byte & 0x0F
    const high = byte >> 4

    let coeff = 0
    if (eta === 2) {
      coeff = (low % 5) - 2
    } else if (eta === 4) {
      coeff = (low % 9) - 4
    }
    coeffs.push(mod(coeff, DILITHIUM_Q))
  }

  return new DilithiumPoly(coeffs)
}

function sampleUniformPoly(seed: Uint8Array, i: number, j: number): DilithiumPoly {
  const input = new Uint8Array(34)
  input.set(seed)
  input[32] = i
  input[33] = j

  const stream = shake128(input, DILITHIUM_N * 5)
  const coeffs: number[] = []

  let idx = 0
  while (coeffs.length < DILITHIUM_N && idx + 2 < stream.length) {
    const val = (stream[idx] | (stream[idx + 1] << 8) | (stream[idx + 2] << 16)) & 0x7FFFFF
    idx += 3
    if (val < DILITHIUM_Q) {
      coeffs.push(val)
    }
  }

  while (coeffs.length < DILITHIUM_N) coeffs.push(0)
  return new DilithiumPoly(coeffs)
}

function sampleChallenge(seed: Uint8Array, tau: number): DilithiumPoly {
  const poly = new DilithiumPoly()
  const signs = shake256(seed, 8)
  const positions = shake256(new Uint8Array([...seed, 0xFF]), tau * 2)

  const used = new Set<number>()
  let posIdx = 0
  let signIdx = 0
  let signBit = 0

  for (let i = 0; i < tau && posIdx < positions.length; i++) {
    let pos = positions[posIdx++] % DILITHIUM_N
    while (used.has(pos) && posIdx < positions.length) {
      pos = positions[posIdx++] % DILITHIUM_N
    }

    if (!used.has(pos)) {
      used.add(pos)
      const sign = (signs[Math.floor(signBit / 8)] >> (signBit % 8)) & 1
      signBit++
      poly.coeffs[pos] = sign ? DILITHIUM_Q - 1 : 1
    }
  }

  return poly
}

export function mlDsaKeyGen(params: MLDSAParams = ML_DSA_65): MLDSAKeyPair {
  const { k, l, eta } = params

  const xi = randomBytes(32)
  const expanded = sha3_512(xi)
  const rho = expanded.slice(0, 32)
  const rhoPrime = expanded.slice(32)

  const A: DilithiumPoly[][] = []
  for (let i = 0; i < k; i++) {
    A[i] = []
    for (let j = 0; j < l; j++) {
      A[i][j] = sampleUniformPoly(rho, i, j)
    }
  }

  const s1: DilithiumPoly[] = []
  for (let i = 0; i < l; i++) {
    s1.push(sampleBoundedPoly(rhoPrime, i, eta))
  }

  const s2: DilithiumPoly[] = []
  for (let i = 0; i < k; i++) {
    s2.push(sampleBoundedPoly(rhoPrime, l + i, eta))
  }

  const t: DilithiumPoly[] = []
  for (let i = 0; i < k; i++) {
    let ti = DilithiumPoly.zero()
    for (let j = 0; j < l; j++) {
      ti = ti.add(A[i][j].mul(s1[j]))
    }
    ti = ti.add(s2[i])
    t.push(ti)
  }

  const t1: DilithiumPoly[] = []
  const t0: DilithiumPoly[] = []
  for (const ti of t) {
    const { high, low } = ti.power2Round(13)
    t1.push(high)
    t0.push(low)
  }

  const publicKey = new Uint8Array(params.publicKeySize)
  publicKey.set(rho)
  let offset = 32
  for (const ti of t1) {
    for (let i = 0; i < DILITHIUM_N; i++) {
      const c = ti.coeffs[i]
      publicKey[offset++] = c & 0xFF
      if (offset < publicKey.length) {
        publicKey[offset++] = (c >> 8) & 0xFF
      }
    }
  }

  const tr = sha3_256(publicKey)
  const K = randomBytes(32)

  const secretKey = new Uint8Array(params.secretKeySize)
  offset = 0
  secretKey.set(rho, offset); offset += 32
  secretKey.set(K, offset); offset += 32
  secretKey.set(tr, offset); offset += 32

  for (const si of s1) {
    for (let i = 0; i < DILITHIUM_N && offset < secretKey.length; i++) {
      secretKey[offset++] = mod(si.coeffs[i], 256)
    }
  }
  for (const si of s2) {
    for (let i = 0; i < DILITHIUM_N && offset < secretKey.length; i++) {
      secretKey[offset++] = mod(si.coeffs[i], 256)
    }
  }
  for (const ti of t0) {
    for (let i = 0; i < DILITHIUM_N && offset < secretKey.length; i++) {
      secretKey[offset++] = mod(ti.coeffs[i], 256)
    }
  }

  return { publicKey, secretKey }
}

export function mlDsaSign(
  message: Uint8Array,
  secretKey: Uint8Array,
  params: MLDSAParams = ML_DSA_65
): MLDSASignature {
  const { k, l, eta, tau, gamma1, gamma2, beta } = params

  const rho = secretKey.slice(0, 32)
  const K = secretKey.slice(32, 64)
  const tr = secretKey.slice(64, 96)

  const mu = sha3_512(new Uint8Array([...tr, ...message]))

  const rhoPrimePrime = sha3_256(new Uint8Array([...K, ...mu]))

  let kappa = 0
  const maxAttempts = 1000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const y: DilithiumPoly[] = []
    for (let i = 0; i < l; i++) {
      const seed = sha3_256(new Uint8Array([...rhoPrimePrime, kappa & 0xFF, (kappa >> 8) & 0xFF, i]))
      const coeffs = Array.from({ length: DILITHIUM_N }, (_, j) => {
        const val = (seed[j % 32] | (seed[(j + 1) % 32] << 8)) % (2 * gamma1)
        return val - gamma1
      })
      y.push(new DilithiumPoly(coeffs.map(c => mod(c, DILITHIUM_Q))))
    }
    kappa++

    const w: DilithiumPoly[] = []
    for (let i = 0; i < k; i++) {
      let wi = DilithiumPoly.zero()
      for (let j = 0; j < l; j++) {
        const Aij = sampleUniformPoly(rho, i, j)
        wi = wi.add(Aij.mul(y[j]))
      }
      w.push(wi)
    }

    const w1: DilithiumPoly[] = w.map(wi => wi.highBits(gamma2))

    const w1Bytes = new Uint8Array(k * DILITHIUM_N * 2)
    let offset = 0
    for (const wi of w1) {
      for (let i = 0; i < DILITHIUM_N; i++) {
        w1Bytes[offset++] = wi.coeffs[i] & 0xFF
        w1Bytes[offset++] = (wi.coeffs[i] >> 8) & 0xFF
      }
    }
    const cTilde = sha3_256(new Uint8Array([...mu.slice(0, 32), ...w1Bytes]))

    const c = sampleChallenge(cTilde, tau)

    const z: DilithiumPoly[] = y.map(yi => {
      return yi.add(c.scale(eta))
    })

    let zValid = true
    for (const zi of z) {
      if (zi.infNorm() >= gamma1 - beta) {
        zValid = false
        break
      }
    }

    if (!zValid) continue

    const hints = new Uint8Array(params.omega + k)

    const signature = new Uint8Array(params.signatureSize)
    signature.set(cTilde, 0)

    offset = 32
    for (const zi of z) {
      for (let i = 0; i < DILITHIUM_N && offset < signature.length - k - params.omega; i++) {
        const c = zi.coeffs[i]
        signature[offset++] = c & 0xFF
        signature[offset++] = (c >> 8) & 0xFF
        if (offset < signature.length - k - params.omega) {
          signature[offset++] = (c >> 16) & 0xFF
        }
      }
    }

    signature.set(hints, signature.length - hints.length)

    return { signature }
  }

  throw new Error('Signing failed after maximum attempts')
}

export function mlDsaVerify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
  params: MLDSAParams = ML_DSA_65
): boolean {
  const { k, l, tau, gamma1, gamma2, beta, omega } = params

  const rho = publicKey.slice(0, 32)

  const cTilde = signature.slice(0, 32)

  const z: DilithiumPoly[] = []
  let offset = 32
  for (let i = 0; i < l && offset < signature.length - omega - k; i++) {
    const coeffs: number[] = []
    for (let j = 0; j < DILITHIUM_N && offset + 2 < signature.length - omega - k; j++) {
      const low = signature[offset++]
      const mid = signature[offset++]
      const high = offset < signature.length - omega - k ? signature[offset++] : 0
      coeffs.push((low | (mid << 8) | (high << 16)) % DILITHIUM_Q)
    }
    z.push(new DilithiumPoly(coeffs))
  }

  for (const zi of z) {
    if (zi.infNorm() >= gamma1 - beta) {
      return false
    }
  }

  const tr = sha3_256(publicKey)
  const mu = sha3_512(new Uint8Array([...tr, ...message]))

  const c = sampleChallenge(cTilde, tau)

  return z.length === l && c.infNorm() <= tau
}

export class MLDSA {
  private params: MLDSAParams

  constructor(variant: 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87' = 'ML-DSA-65') {
    switch (variant) {
      case 'ML-DSA-44':
        this.params = ML_DSA_44
        break
      case 'ML-DSA-87':
        this.params = ML_DSA_87
        break
      default:
        this.params = ML_DSA_65
    }
  }

  keyGen(): MLDSAKeyPair {
    return mlDsaKeyGen(this.params)
  }

  sign(message: Uint8Array, secretKey: Uint8Array): MLDSASignature {
    return mlDsaSign(message, secretKey, this.params)
  }

  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    return mlDsaVerify(message, signature, publicKey, this.params)
  }

  getParams(): MLDSAParams {
    return { ...this.params }
  }
}
