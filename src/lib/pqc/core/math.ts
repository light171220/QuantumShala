export const KYBER_N = 256
export const KYBER_Q = 3329

export const DILITHIUM_N = 256
export const DILITHIUM_Q = 8380417

export function mod(a: number, m: number): number {
  return ((a % m) + m) % m
}

export function modAdd(a: number, b: number, m: number): number {
  return mod(a + b, m)
}

export function modSub(a: number, b: number, m: number): number {
  return mod(a - b, m)
}

export function modMul(a: number, b: number, m: number): number {
  if (m <= 65536) {
    return mod(a * b, m)
  }
  return Number(BigInt(a) * BigInt(b) % BigInt(m))
}

export function modPow(base: number, exp: number, m: number): number {
  let result = 1
  base = mod(base, m)
  while (exp > 0) {
    if (exp % 2 === 1) {
      result = modMul(result, base, m)
    }
    exp = Math.floor(exp / 2)
    base = modMul(base, base, m)
  }
  return result
}

export function extendedGCD(a: number, b: number): { gcd: number; x: number; y: number } {
  if (b === 0) {
    return { gcd: a, x: 1, y: 0 }
  }
  const result = extendedGCD(b, a % b)
  return {
    gcd: result.gcd,
    x: result.y,
    y: result.x - Math.floor(a / b) * result.y
  }
}

export function modInverse(a: number, m: number): number {
  const result = extendedGCD(mod(a, m), m)
  if (result.gcd !== 1) {
    throw new Error(`Modular inverse does not exist for ${a} mod ${m}`)
  }
  return mod(result.x, m)
}

export function bitReverse(x: number, bits: number): number {
  let result = 0
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1)
    x >>= 1
  }
  return result
}

export function findPrimitiveRoot(n: number, q: number): number {
  if (q === KYBER_Q && n === KYBER_N) {
    return 17
  }

  if (q === DILITHIUM_Q && n === DILITHIUM_N) {
    return 1753
  }

  const phi = q - 1
  if (phi % n !== 0) {
    throw new Error(`${n}th root of unity does not exist mod ${q}`)
  }

  for (let g = 2; g < q; g++) {
    if (modPow(g, phi, q) === 1 && modPow(g, phi / 2, q) !== 1) {
      return modPow(g, phi / n, q)
    }
  }
  throw new Error('No primitive root found')
}

export function computeNTTRoots(n: number, q: number): number[] {
  const omega = findPrimitiveRoot(n, q)
  const roots: number[] = new Array(n)
  roots[0] = 1
  for (let i = 1; i < n; i++) {
    roots[i] = modMul(roots[i - 1], omega, q)
  }
  return roots
}

export function computeInvNTTRoots(n: number, q: number): number[] {
  const roots = computeNTTRoots(n, q)
  const invRoots = roots.map(r => modInverse(r, q))
  return invRoots
}

let kyberRoots: number[] | null = null
let kyberInvRoots: number[] | null = null
let kyberNInv: number | null = null

function getKyberRoots(): { roots: number[]; invRoots: number[]; nInv: number } {
  if (!kyberRoots) {
    kyberRoots = computeNTTRoots(KYBER_N, KYBER_Q)
    kyberInvRoots = computeInvNTTRoots(KYBER_N, KYBER_Q)
    kyberNInv = modInverse(KYBER_N, KYBER_Q)
  }
  return { roots: kyberRoots, invRoots: kyberInvRoots!, nInv: kyberNInv! }
}

export function ntt(a: number[], q: number = KYBER_Q): number[] {
  const n = a.length
  const { roots } = getKyberRoots()

  const bits = Math.log2(n)
  const result = new Array(n)
  for (let i = 0; i < n; i++) {
    result[bitReverse(i, bits)] = a[i]
  }

  for (let len = 2; len <= n; len *= 2) {
    const wLen = n / len
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < len / 2; j++) {
        const u = result[i + j]
        const v = modMul(result[i + j + len / 2], roots[wLen * j], q)
        result[i + j] = modAdd(u, v, q)
        result[i + j + len / 2] = modSub(u, v, q)
      }
    }
  }

  return result
}

export function invNtt(a: number[], q: number = KYBER_Q): number[] {
  const n = a.length
  const { invRoots, nInv } = getKyberRoots()

  const result = [...a]

  for (let len = n; len >= 2; len /= 2) {
    const wLen = n / len
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < len / 2; j++) {
        const u = result[i + j]
        const v = result[i + j + len / 2]
        result[i + j] = modAdd(u, v, q)
        result[i + j + len / 2] = modMul(modSub(u, v, q), invRoots[wLen * j], q)
      }
    }
  }

  const bits = Math.log2(n)
  const output = new Array(n)
  for (let i = 0; i < n; i++) {
    output[bitReverse(i, bits)] = modMul(result[i], nInv, q)
  }

  return output
}

export class Polynomial {
  coeffs: number[]
  n: number
  q: number

  constructor(coeffs: number[], n: number = KYBER_N, q: number = KYBER_Q) {
    this.n = n
    this.q = q
    this.coeffs = new Array(n).fill(0)
    for (let i = 0; i < Math.min(coeffs.length, n); i++) {
      this.coeffs[i] = mod(coeffs[i], q)
    }
  }

  static zero(n: number = KYBER_N, q: number = KYBER_Q): Polynomial {
    return new Polynomial(new Array(n).fill(0), n, q)
  }

  static random(n: number = KYBER_N, q: number = KYBER_Q): Polynomial {
    const coeffs = new Array(n).fill(0).map(() => Math.floor(Math.random() * q))
    return new Polynomial(coeffs, n, q)
  }

  static fromBytes(bytes: Uint8Array, n: number = KYBER_N, q: number = KYBER_Q): Polynomial {
    const coeffs: number[] = []
    for (let i = 0; i + 1 < bytes.length && coeffs.length < n; i += 2) {
      coeffs.push((bytes[i] | (bytes[i + 1] << 8)) % q)
    }
    while (coeffs.length < n) coeffs.push(0)
    return new Polynomial(coeffs, n, q)
  }

  toBytes(): Uint8Array {
    const bytes = new Uint8Array(this.n * 2)
    for (let i = 0; i < this.n; i++) {
      bytes[2 * i] = this.coeffs[i] & 0xFF
      bytes[2 * i + 1] = (this.coeffs[i] >> 8) & 0xFF
    }
    return bytes
  }

  clone(): Polynomial {
    return new Polynomial([...this.coeffs], this.n, this.q)
  }

  add(other: Polynomial): Polynomial {
    const result = new Array(this.n)
    for (let i = 0; i < this.n; i++) {
      result[i] = modAdd(this.coeffs[i], other.coeffs[i], this.q)
    }
    return new Polynomial(result, this.n, this.q)
  }

  sub(other: Polynomial): Polynomial {
    const result = new Array(this.n)
    for (let i = 0; i < this.n; i++) {
      result[i] = modSub(this.coeffs[i], other.coeffs[i], this.q)
    }
    return new Polynomial(result, this.n, this.q)
  }

  mulSchoolbook(other: Polynomial): Polynomial {
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
    return new Polynomial(result, this.n, this.q)
  }

  mul(other: Polynomial): Polynomial {
    const aNtt = ntt(this.coeffs, this.q)
    const bNtt = ntt(other.coeffs, this.q)
    const cNtt = new Array(this.n)
    for (let i = 0; i < this.n; i++) {
      cNtt[i] = modMul(aNtt[i], bNtt[i], this.q)
    }
    const result = invNtt(cNtt, this.q)
    return new Polynomial(result, this.n, this.q)
  }

  scale(s: number): Polynomial {
    const result = this.coeffs.map(c => modMul(c, s, this.q))
    return new Polynomial(result, this.n, this.q)
  }

  neg(): Polynomial {
    const result = this.coeffs.map(c => modSub(0, c, this.q))
    return new Polynomial(result, this.n, this.q)
  }

  compress(d: number): number[] {
    return this.coeffs.map(c => {
      return Math.round((c * (1 << d)) / this.q) % (1 << d)
    })
  }

  static decompress(compressed: number[], d: number, n: number = KYBER_N, q: number = KYBER_Q): Polynomial {
    const coeffs = compressed.map(c => {
      return Math.round((c * q) / (1 << d)) % q
    })
    return new Polynomial(coeffs, n, q)
  }

  isSmall(bound: number): boolean {
    return this.coeffs.every(c => {
      const centered = c > this.q / 2 ? c - this.q : c
      return Math.abs(centered) <= bound
    })
  }
}

export class PolyMatrix {
  rows: number
  cols: number
  data: Polynomial[][]

  constructor(rows: number, cols: number, n: number = KYBER_N, q: number = KYBER_Q) {
    this.rows = rows
    this.cols = cols
    this.data = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Polynomial.zero(n, q))
    )
  }

  static random(rows: number, cols: number, n: number = KYBER_N, q: number = KYBER_Q): PolyMatrix {
    const mat = new PolyMatrix(rows, cols, n, q)
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        mat.data[i][j] = Polynomial.random(n, q)
      }
    }
    return mat
  }

  get(i: number, j: number): Polynomial {
    return this.data[i][j]
  }

  set(i: number, j: number, poly: Polynomial): void {
    this.data[i][j] = poly
  }

  mulVector(v: Polynomial[]): Polynomial[] {
    const result: Polynomial[] = []
    for (let i = 0; i < this.rows; i++) {
      let sum = Polynomial.zero(this.data[0][0].n, this.data[0][0].q)
      for (let j = 0; j < this.cols; j++) {
        sum = sum.add(this.data[i][j].mul(v[j]))
      }
      result.push(sum)
    }
    return result
  }

  transpose(): PolyMatrix {
    const result = new PolyMatrix(this.cols, this.rows, this.data[0][0].n, this.data[0][0].q)
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[j][i] = this.data[i][j]
      }
    }
    return result
  }
}

export const kyberMath = {
  KYBER_N,
  KYBER_Q,
  mod,
  modAdd,
  modSub,
  modMul,
  modPow,
  modInverse,
  ntt,
  invNtt,
  Polynomial,
  PolyMatrix
}
