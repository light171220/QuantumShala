export interface ComplexNumber {
  re: number
  im: number
}

export class Complex implements ComplexNumber {
  readonly re: number
  readonly im: number

  constructor(re: number, im: number = 0) {
    this.re = re
    this.im = im
  }

  static from(re: number, im: number = 0): Complex {
    return new Complex(re, im)
  }

  static fromPolar(r: number, theta: number): Complex {
    return new Complex(r * Math.cos(theta), r * Math.sin(theta))
  }

  static zero(): Complex {
    return new Complex(0, 0)
  }

  static one(): Complex {
    return new Complex(1, 0)
  }

  static i(): Complex {
    return new Complex(0, 1)
  }

  static expI(theta: number): Complex {
    return new Complex(Math.cos(theta), Math.sin(theta))
  }

  add(other: Complex | number): Complex {
    if (typeof other === 'number') {
      return new Complex(this.re + other, this.im)
    }
    return new Complex(this.re + other.re, this.im + other.im)
  }

  sub(other: Complex | number): Complex {
    if (typeof other === 'number') {
      return new Complex(this.re - other, this.im)
    }
    return new Complex(this.re - other.re, this.im - other.im)
  }

  mul(other: Complex | number): Complex {
    if (typeof other === 'number') {
      return new Complex(this.re * other, this.im * other)
    }
    return new Complex(
      this.re * other.re - this.im * other.im,
      this.re * other.im + this.im * other.re
    )
  }

  div(other: Complex | number): Complex {
    if (typeof other === 'number') {
      return new Complex(this.re / other, this.im / other)
    }
    const denom = other.re * other.re + other.im * other.im
    return new Complex(
      (this.re * other.re + this.im * other.im) / denom,
      (this.im * other.re - this.re * other.im) / denom
    )
  }

  conj(): Complex {
    return new Complex(this.re, -this.im)
  }

  neg(): Complex {
    return new Complex(-this.re, -this.im)
  }

  abs(): number {
    return Math.sqrt(this.re * this.re + this.im * this.im)
  }

  abs2(): number {
    return this.re * this.re + this.im * this.im
  }

  arg(): number {
    return Math.atan2(this.im, this.re)
  }

  exp(): Complex {
    const expRe = Math.exp(this.re)
    return new Complex(expRe * Math.cos(this.im), expRe * Math.sin(this.im))
  }

  log(): Complex {
    return new Complex(Math.log(this.abs()), this.arg())
  }

  sqrt(): Complex {
    const r = Math.sqrt(this.abs())
    const theta = this.arg() / 2
    return Complex.fromPolar(r, theta)
  }

  pow(n: number): Complex {
    const r = Math.pow(this.abs(), n)
    const theta = this.arg() * n
    return Complex.fromPolar(r, theta)
  }

  sin(): Complex {
    return new Complex(
      Math.sin(this.re) * Math.cosh(this.im),
      Math.cos(this.re) * Math.sinh(this.im)
    )
  }

  cos(): Complex {
    return new Complex(
      Math.cos(this.re) * Math.cosh(this.im),
      -Math.sin(this.re) * Math.sinh(this.im)
    )
  }

  tan(): Complex {
    return this.sin().div(this.cos())
  }

  equals(other: Complex, tol: number = 1e-10): boolean {
    return Math.abs(this.re - other.re) < tol && Math.abs(this.im - other.im) < tol
  }

  isReal(tol: number = 1e-10): boolean {
    return Math.abs(this.im) < tol
  }

  isImaginary(tol: number = 1e-10): boolean {
    return Math.abs(this.re) < tol
  }

  isZero(tol: number = 1e-10): boolean {
    return this.abs() < tol
  }

  toString(): string {
    if (this.im === 0) return `${this.re}`
    if (this.re === 0) return `${this.im}i`
    const sign = this.im >= 0 ? '+' : '-'
    return `${this.re}${sign}${Math.abs(this.im)}i`
  }

  toArray(): [number, number] {
    return [this.re, this.im]
  }
}

export const COMPLEX_ZERO = Complex.zero()
export const COMPLEX_ONE = Complex.one()
export const COMPLEX_I = Complex.i()
export const COMPLEX_MINUS_I = new Complex(0, -1)
export const COMPLEX_SQRT2_INV = new Complex(1 / Math.SQRT2, 0)
export const COMPLEX_SQRT2 = new Complex(Math.SQRT2, 0)

export function complex(re: number, im: number = 0): Complex {
  return new Complex(re, im)
}

export function cexp(theta: number): Complex {
  return Complex.expI(theta)
}

export function cadd(a: Complex, b: Complex): Complex {
  return a.add(b)
}

export function csub(a: Complex, b: Complex): Complex {
  return a.sub(b)
}

export function cmul(a: Complex, b: Complex): Complex {
  return a.mul(b)
}

export function cdiv(a: Complex, b: Complex): Complex {
  return a.div(b)
}

export function cconj(a: Complex): Complex {
  return a.conj()
}

export function cabs(a: Complex): number {
  return a.abs()
}

export function cabs2(a: Complex): number {
  return a.abs2()
}

export function carg(a: Complex): number {
  return a.arg()
}
