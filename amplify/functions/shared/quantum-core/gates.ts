import type { Complex } from '../types'
import * as C from './complex'

export type GateMatrix = Complex[][]

export const I_GATE: GateMatrix = [
  [C.ONE, C.ZERO],
  [C.ZERO, C.ONE],
]

export const X_GATE: GateMatrix = [
  [C.ZERO, C.ONE],
  [C.ONE, C.ZERO],
]

export const Y_GATE: GateMatrix = [
  [C.ZERO, C.MINUS_I],
  [C.I, C.ZERO],
]

export const Z_GATE: GateMatrix = [
  [C.ONE, C.ZERO],
  [C.ZERO, { re: -1, im: 0 }],
]

export const H_GATE: GateMatrix = [
  [C.SQRT2_INV, C.SQRT2_INV],
  [C.SQRT2_INV, { re: -1 / Math.sqrt(2), im: 0 }],
]

export const S_GATE: GateMatrix = [
  [C.ONE, C.ZERO],
  [C.ZERO, C.I],
]

export const S_DAG_GATE: GateMatrix = [
  [C.ONE, C.ZERO],
  [C.ZERO, C.MINUS_I],
]

export const T_GATE: GateMatrix = [
  [C.ONE, C.ZERO],
  [C.ZERO, C.expI(Math.PI / 4)],
]

export const T_DAG_GATE: GateMatrix = [
  [C.ONE, C.ZERO],
  [C.ZERO, C.expI(-Math.PI / 4)],
]

export const SX_GATE: GateMatrix = [
  [{ re: 0.5, im: 0.5 }, { re: 0.5, im: -0.5 }],
  [{ re: 0.5, im: -0.5 }, { re: 0.5, im: 0.5 }],
]

export function RX(theta: number): GateMatrix {
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return [
    [{ re: c, im: 0 }, { re: 0, im: -s }],
    [{ re: 0, im: -s }, { re: c, im: 0 }],
  ]
}

export function RY(theta: number): GateMatrix {
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return [
    [{ re: c, im: 0 }, { re: -s, im: 0 }],
    [{ re: s, im: 0 }, { re: c, im: 0 }],
  ]
}

export function RZ(theta: number): GateMatrix {
  return [
    [C.expI(-theta / 2), C.ZERO],
    [C.ZERO, C.expI(theta / 2)],
  ]
}

export function P(theta: number): GateMatrix {
  return [
    [C.ONE, C.ZERO],
    [C.ZERO, C.expI(theta)],
  ]
}

export function U3(theta: number, phi: number, lambda: number): GateMatrix {
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return [
    [{ re: c, im: 0 }, C.scale(C.expI(lambda), -s)],
    [C.scale(C.expI(phi), s), C.scale(C.expI(phi + lambda), c)],
  ]
}

export function U2(phi: number, lambda: number): GateMatrix {
  return U3(Math.PI / 2, phi, lambda)
}

export function U1(lambda: number): GateMatrix {
  return P(lambda)
}

export function RXX(theta: number): GateMatrix {
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return [
    [{ re: c, im: 0 }, C.ZERO, C.ZERO, { re: 0, im: -s }],
    [C.ZERO, { re: c, im: 0 }, { re: 0, im: -s }, C.ZERO],
    [C.ZERO, { re: 0, im: -s }, { re: c, im: 0 }, C.ZERO],
    [{ re: 0, im: -s }, C.ZERO, C.ZERO, { re: c, im: 0 }],
  ] as GateMatrix
}

export function RYY(theta: number): GateMatrix {
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return [
    [{ re: c, im: 0 }, C.ZERO, C.ZERO, { re: 0, im: s }],
    [C.ZERO, { re: c, im: 0 }, { re: 0, im: -s }, C.ZERO],
    [C.ZERO, { re: 0, im: -s }, { re: c, im: 0 }, C.ZERO],
    [{ re: 0, im: s }, C.ZERO, C.ZERO, { re: c, im: 0 }],
  ] as GateMatrix
}

export function RZZ(theta: number): GateMatrix {
  return [
    [C.expI(-theta / 2), C.ZERO, C.ZERO, C.ZERO],
    [C.ZERO, C.expI(theta / 2), C.ZERO, C.ZERO],
    [C.ZERO, C.ZERO, C.expI(theta / 2), C.ZERO],
    [C.ZERO, C.ZERO, C.ZERO, C.expI(-theta / 2)],
  ] as GateMatrix
}

export const CNOT_MATRIX: GateMatrix = [
  [C.ONE, C.ZERO, C.ZERO, C.ZERO],
  [C.ZERO, C.ONE, C.ZERO, C.ZERO],
  [C.ZERO, C.ZERO, C.ZERO, C.ONE],
  [C.ZERO, C.ZERO, C.ONE, C.ZERO],
]

export const CZ_MATRIX: GateMatrix = [
  [C.ONE, C.ZERO, C.ZERO, C.ZERO],
  [C.ZERO, C.ONE, C.ZERO, C.ZERO],
  [C.ZERO, C.ZERO, C.ONE, C.ZERO],
  [C.ZERO, C.ZERO, C.ZERO, { re: -1, im: 0 }],
]

export const SWAP_MATRIX: GateMatrix = [
  [C.ONE, C.ZERO, C.ZERO, C.ZERO],
  [C.ZERO, C.ZERO, C.ONE, C.ZERO],
  [C.ZERO, C.ONE, C.ZERO, C.ZERO],
  [C.ZERO, C.ZERO, C.ZERO, C.ONE],
]

export const ISWAP_MATRIX: GateMatrix = [
  [C.ONE, C.ZERO, C.ZERO, C.ZERO],
  [C.ZERO, C.ZERO, C.I, C.ZERO],
  [C.ZERO, C.I, C.ZERO, C.ZERO],
  [C.ZERO, C.ZERO, C.ZERO, C.ONE],
]

export function CRX(theta: number): GateMatrix {
  const rx = RX(theta)
  return [
    [C.ONE, C.ZERO, C.ZERO, C.ZERO],
    [C.ZERO, C.ONE, C.ZERO, C.ZERO],
    [C.ZERO, C.ZERO, rx[0][0], rx[0][1]],
    [C.ZERO, C.ZERO, rx[1][0], rx[1][1]],
  ]
}

export function CRY(theta: number): GateMatrix {
  const ry = RY(theta)
  return [
    [C.ONE, C.ZERO, C.ZERO, C.ZERO],
    [C.ZERO, C.ONE, C.ZERO, C.ZERO],
    [C.ZERO, C.ZERO, ry[0][0], ry[0][1]],
    [C.ZERO, C.ZERO, ry[1][0], ry[1][1]],
  ]
}

export function CRZ(theta: number): GateMatrix {
  const rz = RZ(theta)
  return [
    [C.ONE, C.ZERO, C.ZERO, C.ZERO],
    [C.ZERO, C.ONE, C.ZERO, C.ZERO],
    [C.ZERO, C.ZERO, rz[0][0], rz[0][1]],
    [C.ZERO, C.ZERO, rz[1][0], rz[1][1]],
  ]
}

export function CP(theta: number): GateMatrix {
  return [
    [C.ONE, C.ZERO, C.ZERO, C.ZERO],
    [C.ZERO, C.ONE, C.ZERO, C.ZERO],
    [C.ZERO, C.ZERO, C.ONE, C.ZERO],
    [C.ZERO, C.ZERO, C.ZERO, C.expI(theta)],
  ]
}

export function matrixMultiply(a: GateMatrix, b: GateMatrix): GateMatrix {
  const n = a.length
  const result: GateMatrix = []
  for (let i = 0; i < n; i++) {
    result[i] = []
    for (let j = 0; j < n; j++) {
      let sum = C.ZERO
      for (let k = 0; k < n; k++) {
        sum = C.add(sum, C.multiply(a[i][k], b[k][j]))
      }
      result[i][j] = sum
    }
  }
  return result
}

export function matrixDagger(m: GateMatrix): GateMatrix {
  const n = m.length
  const result: GateMatrix = []
  for (let i = 0; i < n; i++) {
    result[i] = []
    for (let j = 0; j < n; j++) {
      result[i][j] = C.conjugate(m[j][i])
    }
  }
  return result
}

export function tensorProduct(a: GateMatrix, b: GateMatrix): GateMatrix {
  const na = a.length
  const nb = b.length
  const n = na * nb
  const result: GateMatrix = []

  for (let i = 0; i < n; i++) {
    result[i] = []
    for (let j = 0; j < n; j++) {
      const ia = Math.floor(i / nb)
      const ib = i % nb
      const ja = Math.floor(j / nb)
      const jb = j % nb
      result[i][j] = C.multiply(a[ia][ja], b[ib][jb])
    }
  }

  return result
}

export function getGateByName(name: string, params?: number[]): GateMatrix {
  switch (name.toLowerCase()) {
    case 'i':
    case 'id':
      return I_GATE
    case 'x':
      return X_GATE
    case 'y':
      return Y_GATE
    case 'z':
      return Z_GATE
    case 'h':
      return H_GATE
    case 's':
      return S_GATE
    case 'sdg':
      return S_DAG_GATE
    case 't':
      return T_GATE
    case 'tdg':
      return T_DAG_GATE
    case 'sx':
      return SX_GATE
    case 'rx':
      return RX(params?.[0] ?? 0)
    case 'ry':
      return RY(params?.[0] ?? 0)
    case 'rz':
      return RZ(params?.[0] ?? 0)
    case 'p':
    case 'phase':
      return P(params?.[0] ?? 0)
    case 'u3':
    case 'u':
      return U3(params?.[0] ?? 0, params?.[1] ?? 0, params?.[2] ?? 0)
    case 'u2':
      return U2(params?.[0] ?? 0, params?.[1] ?? 0)
    case 'u1':
      return U1(params?.[0] ?? 0)
    default:
      throw new Error(`Unknown gate: ${name}`)
  }
}
