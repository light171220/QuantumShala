import type { Complex } from '../types'

export function complex(re: number, im: number = 0): Complex {
  return { re, im }
}

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}

export function subtract(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im }
}

export function multiply(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }
}

export function scale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s }
}

export function conjugate(a: Complex): Complex {
  return { re: a.re, im: -a.im }
}

export function magnitude(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im)
}

export function magnitudeSquared(a: Complex): number {
  return a.re * a.re + a.im * a.im
}

export function phase(a: Complex): number {
  return Math.atan2(a.im, a.re)
}

export function fromPolar(r: number, theta: number): Complex {
  return { re: r * Math.cos(theta), im: r * Math.sin(theta) }
}

export function exp(a: Complex): Complex {
  const expRe = Math.exp(a.re)
  return { re: expRe * Math.cos(a.im), im: expRe * Math.sin(a.im) }
}

export function expI(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) }
}

export const ZERO: Complex = { re: 0, im: 0 }
export const ONE: Complex = { re: 1, im: 0 }
export const I: Complex = { re: 0, im: 1 }
export const MINUS_I: Complex = { re: 0, im: -1 }
export const SQRT2_INV: Complex = { re: 1 / Math.sqrt(2), im: 0 }
