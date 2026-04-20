import { Polynomial, PolyMatrix, KYBER_N, KYBER_Q, mod, modAdd, modSub, ntt, invNtt } from '../core/math'
import { sha3_256, sha3_512, shake128, shake256, prf } from '../core/hash'
import { randomBytes, sampleCBD, sampleUniform } from '../core/random'

export interface MLKEMParams {
  name: string
  k: number
  eta1: number
  eta2: number
  du: number
  dv: number
  publicKeySize: number
  secretKeySize: number
  ciphertextSize: number
  sharedSecretSize: number
  securityLevel: number
}

export const ML_KEM_512: MLKEMParams = {
  name: 'ML-KEM-512',
  k: 2,
  eta1: 3,
  eta2: 2,
  du: 10,
  dv: 4,
  publicKeySize: 800,
  secretKeySize: 1632,
  ciphertextSize: 768,
  sharedSecretSize: 32,
  securityLevel: 1
}

export const ML_KEM_768: MLKEMParams = {
  name: 'ML-KEM-768',
  k: 3,
  eta1: 2,
  eta2: 2,
  du: 10,
  dv: 4,
  publicKeySize: 1184,
  secretKeySize: 2400,
  ciphertextSize: 1088,
  sharedSecretSize: 32,
  securityLevel: 3
}

export const ML_KEM_1024: MLKEMParams = {
  name: 'ML-KEM-1024',
  k: 4,
  eta1: 2,
  eta2: 2,
  du: 11,
  dv: 5,
  publicKeySize: 1568,
  secretKeySize: 3168,
  ciphertextSize: 1568,
  sharedSecretSize: 32,
  securityLevel: 5
}

export interface MLKEMKeyPair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export interface MLKEMEncapsulation {
  ciphertext: Uint8Array
  sharedSecret: Uint8Array
}

function samplePolyCBD(seed: Uint8Array, nonce: number, eta: number): Polynomial {
  const prfOutput = prf(seed, nonce, 64 * eta)
  const coeffs = sampleCBD(prfOutput, eta)
  return new Polynomial(coeffs)
}

function samplePolyUniform(seed: Uint8Array, i: number, j: number): Polynomial {
  const input = new Uint8Array(34)
  input.set(seed)
  input[32] = j
  input[33] = i

  const stream = shake128(input, KYBER_N * 3)
  const coeffs: number[] = []

  let idx = 0
  while (coeffs.length < KYBER_N && idx + 2 < stream.length) {
    const d1 = stream[idx] | ((stream[idx + 1] & 0x0F) << 8)
    const d2 = (stream[idx + 1] >> 4) | (stream[idx + 2] << 4)
    idx += 3

    if (d1 < KYBER_Q) coeffs.push(d1)
    if (coeffs.length < KYBER_N && d2 < KYBER_Q) coeffs.push(d2)
  }

  while (coeffs.length < KYBER_N) coeffs.push(0)
  return new Polynomial(coeffs)
}

function expandA(seed: Uint8Array, k: number): PolyMatrix {
  const A = new PolyMatrix(k, k)
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      A.set(i, j, samplePolyUniform(seed, i, j))
    }
  }
  return A
}

function compress(poly: Polynomial, d: number): number[] {
  const q = KYBER_Q
  const twoPowD = 1 << d
  return poly.coeffs.map(c => {
    return Math.round((c * twoPowD) / q) % twoPowD
  })
}

function decompress(compressed: number[], d: number): Polynomial {
  const q = KYBER_Q
  const twoPowD = 1 << d
  const coeffs = compressed.map(c => {
    return Math.round((c * q) / twoPowD) % q
  })
  return new Polynomial(coeffs)
}

function encodePoly(poly: Polynomial, bits: number): Uint8Array {
  const coeffs = bits === 12 ? poly.coeffs : compress(poly, bits)
  const totalBits = KYBER_N * bits
  const bytes = new Uint8Array(Math.ceil(totalBits / 8))

  let bitIdx = 0
  for (const c of coeffs) {
    for (let b = 0; b < bits; b++) {
      if ((c >> b) & 1) {
        bytes[Math.floor(bitIdx / 8)] |= (1 << (bitIdx % 8))
      }
      bitIdx++
    }
  }

  return bytes
}

function decodePoly(bytes: Uint8Array, bits: number): Polynomial {
  const coeffs: number[] = []
  let bitIdx = 0

  for (let i = 0; i < KYBER_N; i++) {
    let c = 0
    for (let b = 0; b < bits; b++) {
      if (bytes[Math.floor(bitIdx / 8)] & (1 << (bitIdx % 8))) {
        c |= (1 << b)
      }
      bitIdx++
    }
    coeffs.push(c)
  }

  return bits === 12 ? new Polynomial(coeffs) : decompress(coeffs, bits)
}

export function mlKemKeyGen(params: MLKEMParams = ML_KEM_768): MLKEMKeyPair {
  const { k, eta1 } = params

  const d = randomBytes(32)
  const hash = sha3_512(d)
  const rho = hash.slice(0, 32)
  const sigma = hash.slice(32)

  const A = expandA(rho, k)

  const s: Polynomial[] = []
  for (let i = 0; i < k; i++) {
    s.push(samplePolyCBD(sigma, i, eta1))
  }

  const e: Polynomial[] = []
  for (let i = 0; i < k; i++) {
    e.push(samplePolyCBD(sigma, k + i, eta1))
  }

  const sNtt = s.map(si => {
    const nttCoeffs = ntt(si.coeffs)
    return new Polynomial(nttCoeffs)
  })

  const t: Polynomial[] = []
  for (let i = 0; i < k; i++) {
    let ti = Polynomial.zero()
    for (let j = 0; j < k; j++) {
      const Aij = A.get(i, j)
      const AijNtt = new Polynomial(ntt(Aij.coeffs))
      const prod = AijNtt.mul(sNtt[j])
      ti = ti.add(prod)
    }
    ti = new Polynomial(invNtt(ti.coeffs))
    ti = ti.add(e[i])
    t.push(ti)
  }

  const pkParts: Uint8Array[] = []
  for (const ti of t) {
    pkParts.push(encodePoly(ti, 12))
  }
  pkParts.push(rho)

  const publicKey = new Uint8Array(params.publicKeySize)
  let offset = 0
  for (const part of pkParts) {
    publicKey.set(part, offset)
    offset += part.length
  }

  const z = randomBytes(32)
  const pkHash = sha3_256(publicKey)

  const skParts: Uint8Array[] = []
  for (const si of s) {
    skParts.push(encodePoly(si, 12))
  }
  skParts.push(publicKey)
  skParts.push(pkHash)
  skParts.push(z)

  const secretKey = new Uint8Array(params.secretKeySize)
  offset = 0
  for (const part of skParts) {
    secretKey.set(part, offset)
    offset += part.length
  }

  return { publicKey, secretKey }
}

export function mlKemEncaps(publicKey: Uint8Array, params: MLKEMParams = ML_KEM_768): MLKEMEncapsulation {
  const { k, eta1, eta2, du, dv } = params
  const polyBytes = KYBER_N * 12 / 8

  const t: Polynomial[] = []
  for (let i = 0; i < k; i++) {
    const polyData = publicKey.slice(i * polyBytes, (i + 1) * polyBytes)
    t.push(decodePoly(polyData, 12))
  }
  const rho = publicKey.slice(k * polyBytes)

  const m = randomBytes(32)

  const pkHash = sha3_256(publicKey)
  const mPkHash = new Uint8Array(64)
  mPkHash.set(m)
  mPkHash.set(pkHash, 32)
  const coins = sha3_512(mPkHash)
  const r = coins.slice(0, 32)

  const A = expandA(rho, k)

  const rVec: Polynomial[] = []
  for (let i = 0; i < k; i++) {
    rVec.push(samplePolyCBD(r, i, eta1))
  }

  const e1: Polynomial[] = []
  for (let i = 0; i < k; i++) {
    e1.push(samplePolyCBD(r, k + i, eta2))
  }

  const e2 = samplePolyCBD(r, 2 * k, eta2)

  const rNtt = rVec.map(ri => new Polynomial(ntt(ri.coeffs)))

  const u: Polynomial[] = []
  for (let i = 0; i < k; i++) {
    let ui = Polynomial.zero()
    for (let j = 0; j < k; j++) {
      const Aji = A.get(j, i)
      const AjiNtt = new Polynomial(ntt(Aji.coeffs))
      const prod = AjiNtt.mul(rNtt[j])
      ui = ui.add(prod)
    }
    ui = new Polynomial(invNtt(ui.coeffs))
    ui = ui.add(e1[i])
    u.push(ui)
  }

  let v = Polynomial.zero()
  for (let i = 0; i < k; i++) {
    const tiNtt = new Polynomial(ntt(t[i].coeffs))
    const prod = tiNtt.mul(rNtt[i])
    v = v.add(new Polynomial(invNtt(prod.coeffs)))
  }
  v = v.add(e2)

  const mPoly = new Polynomial(
    Array.from(m).flatMap(byte =>
      Array.from({ length: 8 }, (_, i) => ((byte >> i) & 1) * Math.floor(KYBER_Q / 2))
    )
  )
  v = v.add(mPoly)

  const ctParts: Uint8Array[] = []
  for (const ui of u) {
    ctParts.push(encodePoly(ui, du))
  }
  ctParts.push(encodePoly(v, dv))

  const ciphertext = new Uint8Array(params.ciphertextSize)
  let offset = 0
  for (const part of ctParts) {
    ciphertext.set(part, offset)
    offset += part.length
  }

  const sharedSecret = shake256(new Uint8Array([...coins.slice(32), ...sha3_256(ciphertext)]), 32)

  return { ciphertext, sharedSecret }
}

export function mlKemDecaps(
  ciphertext: Uint8Array,
  secretKey: Uint8Array,
  params: MLKEMParams = ML_KEM_768
): Uint8Array {
  const { k, du, dv } = params
  const polyBytes = KYBER_N * 12 / 8
  const uBytes = KYBER_N * du / 8

  const s: Polynomial[] = []
  let offset = 0
  for (let i = 0; i < k; i++) {
    s.push(decodePoly(secretKey.slice(offset, offset + polyBytes), 12))
    offset += polyBytes
  }

  const publicKey = secretKey.slice(offset, offset + params.publicKeySize)
  offset += params.publicKeySize

  const pkHash = secretKey.slice(offset, offset + 32)
  offset += 32

  const z = secretKey.slice(offset, offset + 32)

  const u: Polynomial[] = []
  offset = 0
  for (let i = 0; i < k; i++) {
    u.push(decodePoly(ciphertext.slice(offset, offset + uBytes), du))
    offset += uBytes
  }
  const v = decodePoly(ciphertext.slice(offset), dv)

  const sNtt = s.map(si => new Polynomial(ntt(si.coeffs)))

  let sTransposeU = Polynomial.zero()
  for (let i = 0; i < k; i++) {
    const uiNtt = new Polynomial(ntt(u[i].coeffs))
    const prod = sNtt[i].mul(uiNtt)
    sTransposeU = sTransposeU.add(new Polynomial(invNtt(prod.coeffs)))
  }

  const mPoly = v.sub(sTransposeU)

  const mDecoded = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    let byte = 0
    for (let j = 0; j < 8; j++) {
      const idx = i * 8 + j
      const coeff = mPoly.coeffs[idx]
      const centered = coeff > KYBER_Q / 2 ? coeff - KYBER_Q : coeff
      if (Math.abs(centered - KYBER_Q / 2) < KYBER_Q / 4 ||
          Math.abs(centered + KYBER_Q / 2) < KYBER_Q / 4) {
        byte |= (1 << j)
      }
    }
    mDecoded[i] = byte
  }

  const { ciphertext: ctPrime, sharedSecret: ssPrime } = mlKemEncaps(publicKey, params)

  let equal = true
  for (let i = 0; i < ciphertext.length; i++) {
    if (ciphertext[i] !== ctPrime[i]) equal = false
  }

  if (equal) {
    return ssPrime
  } else {
    const implicit = new Uint8Array(32 + ciphertext.length)
    implicit.set(z)
    implicit.set(ciphertext, 32)
    return shake256(implicit, 32)
  }
}

export class MLKEM {
  private params: MLKEMParams

  constructor(variant: 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024' = 'ML-KEM-768') {
    switch (variant) {
      case 'ML-KEM-512':
        this.params = ML_KEM_512
        break
      case 'ML-KEM-1024':
        this.params = ML_KEM_1024
        break
      default:
        this.params = ML_KEM_768
    }
  }

  keyGen(): MLKEMKeyPair {
    return mlKemKeyGen(this.params)
  }

  encaps(publicKey: Uint8Array): MLKEMEncapsulation {
    return mlKemEncaps(publicKey, this.params)
  }

  decaps(ciphertext: Uint8Array, secretKey: Uint8Array): Uint8Array {
    return mlKemDecaps(ciphertext, secretKey, this.params)
  }

  getParams(): MLKEMParams {
    return { ...this.params }
  }
}
