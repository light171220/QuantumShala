import { Complex } from './complex'

export type TensorData = Float64Array | Complex[]
export type Shape = number[]
export type DType = 'float64' | 'complex128'

let tensorIdCounter = 0

export interface GradFn {
  (grad: QTensor): QTensor[]
  inputs: QTensor[]
  name: string
}

export class QTensor {
  readonly id: number
  readonly data: Float64Array
  readonly shape: Shape
  readonly dtype: DType
  readonly requiresGrad: boolean
  grad: QTensor | null
  gradFn: GradFn | null
  private _name: string | null

  constructor(
    data: Float64Array | number[],
    shape: Shape,
    options: {
      dtype?: DType
      requiresGrad?: boolean
      gradFn?: GradFn | null
      name?: string | null
    } = {}
  ) {
    this.id = tensorIdCounter++
    this.shape = [...shape]
    this.dtype = options.dtype ?? 'float64'
    this.requiresGrad = options.requiresGrad ?? false
    this.gradFn = options.gradFn ?? null
    this.grad = null
    this._name = options.name ?? null

    if (data instanceof Float64Array) {
      this.data = data
    } else {
      this.data = new Float64Array(data)
    }

    const expectedSize = this.dtype === 'complex128'
      ? shape.reduce((a, b) => a * b, 1) * 2
      : shape.reduce((a, b) => a * b, 1)

    if (this.data.length !== expectedSize) {
      throw new Error(`Data length ${this.data.length} does not match shape ${shape} (expected ${expectedSize})`)
    }
  }

  get name(): string | null {
    return this._name
  }

  set name(value: string | null) {
    this._name = value
  }

  get size(): number {
    return this.shape.reduce((a, b) => a * b, 1)
  }

  get ndim(): number {
    return this.shape.length
  }

  get strides(): number[] {
    const strides: number[] = new Array(this.shape.length)
    let stride = this.dtype === 'complex128' ? 2 : 1
    for (let i = this.shape.length - 1; i >= 0; i--) {
      strides[i] = stride
      stride *= this.shape[i]
    }
    return strides
  }

  static zeros(shape: Shape, options: { dtype?: DType; requiresGrad?: boolean } = {}): QTensor {
    const dtype = options.dtype ?? 'float64'
    const size = dtype === 'complex128'
      ? shape.reduce((a, b) => a * b, 1) * 2
      : shape.reduce((a, b) => a * b, 1)
    return new QTensor(new Float64Array(size), shape, options)
  }

  static ones(shape: Shape, options: { dtype?: DType; requiresGrad?: boolean } = {}): QTensor {
    const dtype = options.dtype ?? 'float64'
    const size = dtype === 'complex128'
      ? shape.reduce((a, b) => a * b, 1) * 2
      : shape.reduce((a, b) => a * b, 1)
    const data = new Float64Array(size)
    if (dtype === 'complex128') {
      for (let i = 0; i < size; i += 2) data[i] = 1
    } else {
      data.fill(1)
    }
    return new QTensor(data, shape, options)
  }

  static eye(n: number, options: { dtype?: DType; requiresGrad?: boolean } = {}): QTensor {
    const dtype = options.dtype ?? 'float64'
    const size = dtype === 'complex128' ? n * n * 2 : n * n
    const data = new Float64Array(size)
    const stride = dtype === 'complex128' ? 2 : 1
    const rowStride = n * stride
    for (let i = 0; i < n; i++) {
      data[i * rowStride + i * stride] = 1
    }
    return new QTensor(data, [n, n], options)
  }

  static rand(shape: Shape, options: { dtype?: DType; requiresGrad?: boolean } = {}): QTensor {
    const dtype = options.dtype ?? 'float64'
    const size = dtype === 'complex128'
      ? shape.reduce((a, b) => a * b, 1) * 2
      : shape.reduce((a, b) => a * b, 1)
    const data = new Float64Array(size)
    for (let i = 0; i < size; i++) {
      data[i] = Math.random()
    }
    return new QTensor(data, shape, options)
  }

  static randn(shape: Shape, options: { dtype?: DType; requiresGrad?: boolean } = {}): QTensor {
    const dtype = options.dtype ?? 'float64'
    const size = dtype === 'complex128'
      ? shape.reduce((a, b) => a * b, 1) * 2
      : shape.reduce((a, b) => a * b, 1)
    const data = new Float64Array(size)
    for (let i = 0; i < size; i += 2) {
      const u1 = Math.random()
      const u2 = Math.random()
      data[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      if (i + 1 < size) {
        data[i + 1] = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2)
      }
    }
    return new QTensor(data, shape, options)
  }

  static fromComplex(data: Complex[], shape: Shape, options: { requiresGrad?: boolean } = {}): QTensor {
    const flatData = new Float64Array(data.length * 2)
    for (let i = 0; i < data.length; i++) {
      flatData[i * 2] = data[i].re
      flatData[i * 2 + 1] = data[i].im
    }
    return new QTensor(flatData, shape, { ...options, dtype: 'complex128' })
  }

  static scalar(value: number, options: { requiresGrad?: boolean } = {}): QTensor {
    return new QTensor(new Float64Array([value]), [], options)
  }

  static complexScalar(re: number, im: number, options: { requiresGrad?: boolean } = {}): QTensor {
    return new QTensor(new Float64Array([re, im]), [], { ...options, dtype: 'complex128' })
  }

  static arange(start: number, stop: number, step: number = 1, options: { requiresGrad?: boolean } = {}): QTensor {
    const n = Math.ceil((stop - start) / step)
    const data = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      data[i] = start + i * step
    }
    return new QTensor(data, [n], options)
  }

  static linspace(start: number, stop: number, num: number, options: { requiresGrad?: boolean } = {}): QTensor {
    const data = new Float64Array(num)
    const step = (stop - start) / (num - 1)
    for (let i = 0; i < num; i++) {
      data[i] = start + i * step
    }
    return new QTensor(data, [num], options)
  }

  clone(): QTensor {
    return new QTensor(new Float64Array(this.data), this.shape, {
      dtype: this.dtype,
      requiresGrad: this.requiresGrad
    })
  }

  detach(): QTensor {
    return new QTensor(this.data, this.shape, {
      dtype: this.dtype,
      requiresGrad: false
    })
  }

  requireGrad(requires: boolean = true): QTensor {
    return new QTensor(this.data, this.shape, {
      dtype: this.dtype,
      requiresGrad: requires,
      gradFn: this.gradFn
    })
  }

  item(): number {
    if (this.size !== 1) {
      throw new Error('item() only works on tensors with a single element')
    }
    return this.data[0]
  }

  getComplex(index: number): Complex {
    if (this.dtype !== 'complex128') {
      return new Complex(this.data[index], 0)
    }
    return new Complex(this.data[index * 2], this.data[index * 2 + 1])
  }

  setComplex(index: number, value: Complex): void {
    if (this.dtype !== 'complex128') {
      throw new Error('setComplex only works on complex tensors')
    }
    this.data[index * 2] = value.re
    this.data[index * 2 + 1] = value.im
  }

  get(index: number): number {
    return this.data[index]
  }

  set(index: number, value: number): void {
    this.data[index] = value
  }

  private flatIndex(indices: number[]): number {
    if (indices.length !== this.shape.length) {
      throw new Error(`Expected ${this.shape.length} indices, got ${indices.length}`)
    }
    let idx = 0
    let stride = this.dtype === 'complex128' ? 2 : 1
    for (let i = this.shape.length - 1; i >= 0; i--) {
      idx += indices[i] * stride
      stride *= this.shape[i]
    }
    return idx
  }

  getAt(...indices: number[]): number {
    return this.data[this.flatIndex(indices)]
  }

  setAt(value: number, ...indices: number[]): void {
    this.data[this.flatIndex(indices)] = value
  }

  reshape(newShape: Shape): QTensor {
    const newSize = newShape.reduce((a, b) => a * b, 1)
    const expectedSize = this.dtype === 'complex128' ? newSize * 2 : newSize
    if (this.data.length !== expectedSize) {
      throw new Error(`Cannot reshape tensor of size ${this.size} to shape ${newShape}`)
    }
    return new QTensor(this.data, newShape, {
      dtype: this.dtype,
      requiresGrad: this.requiresGrad,
      gradFn: this.requiresGrad ? {
        inputs: [this],
        name: 'reshape',
        fn: (grad: QTensor) => [grad.reshape(this.shape)]
      } as unknown as GradFn : null
    })
  }

  transpose(dim0: number = 0, dim1: number = 1): QTensor {
    if (this.ndim < 2) {
      return this.clone()
    }

    const newShape = [...this.shape]
    ;[newShape[dim0], newShape[dim1]] = [newShape[dim1], newShape[dim0]]

    const stride = this.dtype === 'complex128' ? 2 : 1
    const newData = new Float64Array(this.data.length)

    const oldStrides = this.strides
    const indices = new Array(this.ndim).fill(0)

    const transposeIndices = (idx: number[]): number[] => {
      const result = [...idx]
      ;[result[dim0], result[dim1]] = [result[dim1], result[dim0]]
      return result
    }

    for (let i = 0; i < this.size; i++) {
      let remaining = i
      for (let d = 0; d < this.ndim; d++) {
        indices[d] = Math.floor(remaining / (oldStrides[d] / stride))
        remaining %= (oldStrides[d] / stride)
      }

      const newIndices = transposeIndices(indices)
      let newIdx = 0
      let newStride = stride
      for (let d = this.ndim - 1; d >= 0; d--) {
        const sd = d === dim0 ? dim1 : d === dim1 ? dim0 : d
        newIdx += newIndices[d] * newStride
        newStride *= newShape[sd]
      }

      if (this.dtype === 'complex128') {
        newData[newIdx] = this.data[i * 2]
        newData[newIdx + 1] = this.data[i * 2 + 1]
      } else {
        newData[i] = this.data[this.flatIndex(indices)]
      }
    }

    const self = this
    return new QTensor(newData, newShape, {
      dtype: this.dtype,
      requiresGrad: this.requiresGrad,
      gradFn: this.requiresGrad ? {
        inputs: [this],
        name: 'transpose',
        fn: (grad: QTensor) => [grad.transpose(dim0, dim1)]
      } as unknown as GradFn : null
    })
  }

  T(): QTensor {
    if (this.ndim !== 2) {
      throw new Error('T() only works on 2D tensors')
    }
    return this.transpose(0, 1)
  }

  conj(): QTensor {
    if (this.dtype !== 'complex128') {
      return this.clone()
    }
    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i += 2) {
      newData[i] = this.data[i]
      newData[i + 1] = -this.data[i + 1]
    }
    return new QTensor(newData, this.shape, {
      dtype: this.dtype,
      requiresGrad: this.requiresGrad,
      gradFn: this.requiresGrad ? {
        inputs: [this],
        name: 'conj',
        fn: (grad: QTensor) => [grad.conj()]
      } as unknown as GradFn : null
    })
  }

  dag(): QTensor {
    return this.conj().T()
  }

  add(other: QTensor | number): QTensor {
    if (typeof other === 'number') {
      const newData = new Float64Array(this.data.length)
      if (this.dtype === 'complex128') {
        for (let i = 0; i < this.data.length; i += 2) {
          newData[i] = this.data[i] + other
          newData[i + 1] = this.data[i + 1]
        }
      } else {
        for (let i = 0; i < this.data.length; i++) {
          newData[i] = this.data[i] + other
        }
      }
      return new QTensor(newData, this.shape, {
        dtype: this.dtype,
        requiresGrad: this.requiresGrad,
        gradFn: this.requiresGrad ? {
          inputs: [this],
          name: 'add_scalar',
          fn: (grad: QTensor) => [grad.clone()]
        } as unknown as GradFn : null
      })
    }

    this.assertSameShape(other)
    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = this.data[i] + other.data[i]
    }

    const needsGrad = this.requiresGrad || other.requiresGrad
    return new QTensor(newData, this.shape, {
      dtype: this.dtype,
      requiresGrad: needsGrad,
      gradFn: needsGrad ? {
        inputs: [this, other],
        name: 'add',
        fn: (grad: QTensor) => [grad.clone(), grad.clone()]
      } as unknown as GradFn : null
    })
  }

  sub(other: QTensor | number): QTensor {
    if (typeof other === 'number') {
      return this.add(-other)
    }

    this.assertSameShape(other)
    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = this.data[i] - other.data[i]
    }

    const needsGrad = this.requiresGrad || other.requiresGrad
    return new QTensor(newData, this.shape, {
      dtype: this.dtype,
      requiresGrad: needsGrad,
      gradFn: needsGrad ? {
        inputs: [this, other],
        name: 'sub',
        fn: (grad: QTensor) => [grad.clone(), grad.neg()]
      } as unknown as GradFn : null
    })
  }

  mul(other: QTensor | number): QTensor {
    if (typeof other === 'number') {
      const newData = new Float64Array(this.data.length)
      for (let i = 0; i < this.data.length; i++) {
        newData[i] = this.data[i] * other
      }
      const self = this
      return new QTensor(newData, this.shape, {
        dtype: this.dtype,
        requiresGrad: this.requiresGrad,
        gradFn: this.requiresGrad ? {
          inputs: [this],
          name: 'mul_scalar',
          fn: (grad: QTensor) => [grad.mul(other)]
        } as unknown as GradFn : null
      })
    }

    this.assertSameShape(other)

    if (this.dtype === 'complex128' || other.dtype === 'complex128') {
      const newData = new Float64Array(this.data.length)
      for (let i = 0; i < this.size; i++) {
        const a = this.getComplex(i)
        const b = other.getComplex(i)
        const c = a.mul(b)
        newData[i * 2] = c.re
        newData[i * 2 + 1] = c.im
      }
      const needsGrad = this.requiresGrad || other.requiresGrad
      const self = this
      return new QTensor(newData, this.shape, {
        dtype: 'complex128',
        requiresGrad: needsGrad,
        gradFn: needsGrad ? {
          inputs: [this, other],
          name: 'mul_complex',
          fn: (grad: QTensor) => [grad.mul(other.conj()), grad.mul(self.conj())]
        } as unknown as GradFn : null
      })
    }

    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = this.data[i] * other.data[i]
    }

    const needsGrad = this.requiresGrad || other.requiresGrad
    const self = this
    return new QTensor(newData, this.shape, {
      dtype: this.dtype,
      requiresGrad: needsGrad,
      gradFn: needsGrad ? {
        inputs: [this, other],
        name: 'mul',
        fn: (grad: QTensor) => [grad.mul(other), grad.mul(self)]
      } as unknown as GradFn : null
    })
  }

  div(other: QTensor | number): QTensor {
    if (typeof other === 'number') {
      return this.mul(1 / other)
    }

    this.assertSameShape(other)

    if (this.dtype === 'complex128' || other.dtype === 'complex128') {
      const newData = new Float64Array(this.data.length)
      for (let i = 0; i < this.size; i++) {
        const a = this.getComplex(i)
        const b = other.getComplex(i)
        const c = a.div(b)
        newData[i * 2] = c.re
        newData[i * 2 + 1] = c.im
      }
      return new QTensor(newData, this.shape, {
        dtype: 'complex128',
        requiresGrad: this.requiresGrad || other.requiresGrad
      })
    }

    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = this.data[i] / other.data[i]
    }
    return new QTensor(newData, this.shape, {
      dtype: this.dtype,
      requiresGrad: this.requiresGrad || other.requiresGrad
    })
  }

  neg(): QTensor {
    return this.mul(-1)
  }

  matmul(other: QTensor): QTensor {
    if (this.ndim !== 2 || other.ndim !== 2) {
      throw new Error('matmul requires 2D tensors')
    }
    if (this.shape[1] !== other.shape[0]) {
      throw new Error(`matmul shape mismatch: ${this.shape} vs ${other.shape}`)
    }

    const m = this.shape[0]
    const k = this.shape[1]
    const n = other.shape[1]

    if (this.dtype === 'complex128' || other.dtype === 'complex128') {
      const newData = new Float64Array(m * n * 2)
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          let sumRe = 0
          let sumIm = 0
          for (let l = 0; l < k; l++) {
            const a = this.getComplex(i * k + l)
            const b = other.getComplex(l * n + j)
            const c = a.mul(b)
            sumRe += c.re
            sumIm += c.im
          }
          newData[(i * n + j) * 2] = sumRe
          newData[(i * n + j) * 2 + 1] = sumIm
        }
      }

      const needsGrad = this.requiresGrad || other.requiresGrad
      const self = this
      return new QTensor(newData, [m, n], {
        dtype: 'complex128',
        requiresGrad: needsGrad,
        gradFn: needsGrad ? {
          inputs: [this, other],
          name: 'matmul_complex',
          fn: (grad: QTensor) => [
            grad.matmul(other.dag()),
            self.dag().matmul(grad)
          ]
        } as unknown as GradFn : null
      })
    }

    const newData = new Float64Array(m * n)
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0
        for (let l = 0; l < k; l++) {
          sum += this.data[i * k + l] * other.data[l * n + j]
        }
        newData[i * n + j] = sum
      }
    }

    const needsGrad = this.requiresGrad || other.requiresGrad
    const self = this
    return new QTensor(newData, [m, n], {
      dtype: 'float64',
      requiresGrad: needsGrad,
      gradFn: needsGrad ? {
        inputs: [this, other],
        name: 'matmul',
        fn: (grad: QTensor) => [
          grad.matmul(other.T()),
          self.T().matmul(grad)
        ]
      } as unknown as GradFn : null
    })
  }

  dot(other: QTensor): QTensor {
    if (this.ndim !== 1 || other.ndim !== 1) {
      throw new Error('dot requires 1D tensors')
    }
    if (this.shape[0] !== other.shape[0]) {
      throw new Error(`dot shape mismatch: ${this.shape} vs ${other.shape}`)
    }

    if (this.dtype === 'complex128' || other.dtype === 'complex128') {
      let sumRe = 0
      let sumIm = 0
      for (let i = 0; i < this.shape[0]; i++) {
        const a = this.getComplex(i)
        const b = other.getComplex(i)
        const c = a.mul(b.conj())
        sumRe += c.re
        sumIm += c.im
      }
      return QTensor.complexScalar(sumRe, sumIm, {
        requiresGrad: this.requiresGrad || other.requiresGrad
      })
    }

    let sum = 0
    for (let i = 0; i < this.data.length; i++) {
      sum += this.data[i] * other.data[i]
    }
    return QTensor.scalar(sum, {
      requiresGrad: this.requiresGrad || other.requiresGrad
    })
  }

  sum(): QTensor {
    if (this.dtype === 'complex128') {
      let sumRe = 0
      let sumIm = 0
      for (let i = 0; i < this.data.length; i += 2) {
        sumRe += this.data[i]
        sumIm += this.data[i + 1]
      }
      return QTensor.complexScalar(sumRe, sumIm, {
        requiresGrad: this.requiresGrad,
        gradFn: this.requiresGrad ? {
          inputs: [this],
          name: 'sum',
          fn: (grad: QTensor) => [QTensor.ones(this.shape, { dtype: 'complex128' }).mul(grad)]
        } as unknown as GradFn : null
      } as { requiresGrad: boolean; gradFn?: GradFn })
    }

    let sum = 0
    for (let i = 0; i < this.data.length; i++) {
      sum += this.data[i]
    }
    return QTensor.scalar(sum, {
      requiresGrad: this.requiresGrad,
      gradFn: this.requiresGrad ? {
        inputs: [this],
        name: 'sum',
        fn: (grad: QTensor) => [QTensor.ones(this.shape).mul(grad)]
      } as unknown as GradFn : null
    } as { requiresGrad: boolean; gradFn?: GradFn })
  }

  mean(): QTensor {
    return this.sum().div(this.size)
  }

  max(): number {
    if (this.dtype === 'complex128') {
      throw new Error('max() not supported for complex tensors')
    }
    return Math.max(...this.data)
  }

  min(): number {
    if (this.dtype === 'complex128') {
      throw new Error('min() not supported for complex tensors')
    }
    return Math.min(...this.data)
  }

  abs(): QTensor {
    if (this.dtype === 'complex128') {
      const newData = new Float64Array(this.size)
      for (let i = 0; i < this.size; i++) {
        const c = this.getComplex(i)
        newData[i] = c.abs()
      }
      return new QTensor(newData, this.shape, {
        dtype: 'float64',
        requiresGrad: this.requiresGrad
      })
    }

    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = Math.abs(this.data[i])
    }
    return new QTensor(newData, this.shape, {
      dtype: 'float64',
      requiresGrad: this.requiresGrad
    })
  }

  abs2(): QTensor {
    if (this.dtype === 'complex128') {
      const newData = new Float64Array(this.size)
      for (let i = 0; i < this.size; i++) {
        const c = this.getComplex(i)
        newData[i] = c.abs2()
      }
      return new QTensor(newData, this.shape, {
        dtype: 'float64',
        requiresGrad: this.requiresGrad
      })
    }

    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = this.data[i] * this.data[i]
    }
    return new QTensor(newData, this.shape, {
      dtype: 'float64',
      requiresGrad: this.requiresGrad
    })
  }

  exp(): QTensor {
    if (this.dtype === 'complex128') {
      const newData = new Float64Array(this.data.length)
      for (let i = 0; i < this.size; i++) {
        const c = this.getComplex(i).exp()
        newData[i * 2] = c.re
        newData[i * 2 + 1] = c.im
      }
      const result = new QTensor(newData, this.shape, {
        dtype: 'complex128',
        requiresGrad: this.requiresGrad,
        gradFn: this.requiresGrad ? {
          inputs: [this],
          name: 'exp',
          fn: (grad: QTensor) => [grad.mul(result)]
        } as unknown as GradFn : null
      })
      return result
    }

    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = Math.exp(this.data[i])
    }
    const result = new QTensor(newData, this.shape, {
      dtype: 'float64',
      requiresGrad: this.requiresGrad,
      gradFn: this.requiresGrad ? {
        inputs: [this],
        name: 'exp',
        fn: (grad: QTensor) => [grad.mul(result)]
      } as unknown as GradFn : null
    })
    return result
  }

  log(): QTensor {
    if (this.dtype === 'complex128') {
      const newData = new Float64Array(this.data.length)
      for (let i = 0; i < this.size; i++) {
        const c = this.getComplex(i).log()
        newData[i * 2] = c.re
        newData[i * 2 + 1] = c.im
      }
      const self = this
      return new QTensor(newData, this.shape, {
        dtype: 'complex128',
        requiresGrad: this.requiresGrad,
        gradFn: this.requiresGrad ? {
          inputs: [this],
          name: 'log',
          fn: (grad: QTensor) => [grad.div(self)]
        } as unknown as GradFn : null
      })
    }

    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = Math.log(this.data[i])
    }
    const self = this
    return new QTensor(newData, this.shape, {
      dtype: 'float64',
      requiresGrad: this.requiresGrad,
      gradFn: this.requiresGrad ? {
        inputs: [this],
        name: 'log',
        fn: (grad: QTensor) => [grad.div(self)]
      } as unknown as GradFn : null
    })
  }

  sqrt(): QTensor {
    if (this.dtype === 'complex128') {
      const newData = new Float64Array(this.data.length)
      for (let i = 0; i < this.size; i++) {
        const c = this.getComplex(i).sqrt()
        newData[i * 2] = c.re
        newData[i * 2 + 1] = c.im
      }
      return new QTensor(newData, this.shape, {
        dtype: 'complex128',
        requiresGrad: this.requiresGrad
      })
    }

    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = Math.sqrt(this.data[i])
    }
    const result = new QTensor(newData, this.shape, {
      dtype: 'float64',
      requiresGrad: this.requiresGrad
    })
    return result
  }

  sin(): QTensor {
    const newData = new Float64Array(this.data.length)
    if (this.dtype === 'complex128') {
      for (let i = 0; i < this.size; i++) {
        const c = this.getComplex(i).sin()
        newData[i * 2] = c.re
        newData[i * 2 + 1] = c.im
      }
    } else {
      for (let i = 0; i < this.data.length; i++) {
        newData[i] = Math.sin(this.data[i])
      }
    }
    const self = this
    return new QTensor(newData, this.shape, {
      dtype: this.dtype,
      requiresGrad: this.requiresGrad,
      gradFn: this.requiresGrad ? {
        inputs: [this],
        name: 'sin',
        fn: (grad: QTensor) => [grad.mul(self.cos())]
      } as unknown as GradFn : null
    })
  }

  cos(): QTensor {
    const newData = new Float64Array(this.data.length)
    if (this.dtype === 'complex128') {
      for (let i = 0; i < this.size; i++) {
        const c = this.getComplex(i).cos()
        newData[i * 2] = c.re
        newData[i * 2 + 1] = c.im
      }
    } else {
      for (let i = 0; i < this.data.length; i++) {
        newData[i] = Math.cos(this.data[i])
      }
    }
    const self = this
    return new QTensor(newData, this.shape, {
      dtype: this.dtype,
      requiresGrad: this.requiresGrad,
      gradFn: this.requiresGrad ? {
        inputs: [this],
        name: 'cos',
        fn: (grad: QTensor) => [grad.mul(self.sin().neg())]
      } as unknown as GradFn : null
    })
  }

  tan(): QTensor {
    return this.sin().div(this.cos())
  }

  pow(n: number): QTensor {
    if (this.dtype === 'complex128') {
      const newData = new Float64Array(this.data.length)
      for (let i = 0; i < this.size; i++) {
        const c = this.getComplex(i).pow(n)
        newData[i * 2] = c.re
        newData[i * 2 + 1] = c.im
      }
      return new QTensor(newData, this.shape, {
        dtype: 'complex128',
        requiresGrad: this.requiresGrad
      })
    }

    const newData = new Float64Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      newData[i] = Math.pow(this.data[i], n)
    }
    const self = this
    return new QTensor(newData, this.shape, {
      dtype: 'float64',
      requiresGrad: this.requiresGrad,
      gradFn: this.requiresGrad ? {
        inputs: [this],
        name: 'pow',
        fn: (grad: QTensor) => [grad.mul(self.pow(n - 1)).mul(n)]
      } as unknown as GradFn : null
    })
  }

  slice(start: number[], end: number[]): QTensor {
    if (start.length !== this.ndim || end.length !== this.ndim) {
      throw new Error('Slice dimensions must match tensor dimensions')
    }

    const newShape = end.map((e, i) => e - start[i])
    const newSize = newShape.reduce((a, b) => a * b, 1)
    const stride = this.dtype === 'complex128' ? 2 : 1
    const newData = new Float64Array(newSize * stride)

    const indices = new Array(this.ndim).fill(0)
    for (let i = 0; i < newSize; i++) {
      let remaining = i
      for (let d = this.ndim - 1; d >= 0; d--) {
        indices[d] = remaining % newShape[d]
        remaining = Math.floor(remaining / newShape[d])
      }

      const srcIndices = indices.map((idx, d) => idx + start[d])
      const srcIdx = this.flatIndex(srcIndices)

      if (this.dtype === 'complex128') {
        newData[i * 2] = this.data[srcIdx]
        newData[i * 2 + 1] = this.data[srcIdx + 1]
      } else {
        newData[i] = this.data[srcIdx]
      }
    }

    return new QTensor(newData, newShape, {
      dtype: this.dtype,
      requiresGrad: this.requiresGrad
    })
  }

  kron(other: QTensor): QTensor {
    if (this.ndim !== 2 || other.ndim !== 2) {
      throw new Error('kron requires 2D tensors')
    }

    const m1 = this.shape[0], n1 = this.shape[1]
    const m2 = other.shape[0], n2 = other.shape[1]
    const newShape = [m1 * m2, n1 * n2]

    const isComplex = this.dtype === 'complex128' || other.dtype === 'complex128'
    const stride = isComplex ? 2 : 1
    const newData = new Float64Array(newShape[0] * newShape[1] * stride)

    for (let i1 = 0; i1 < m1; i1++) {
      for (let j1 = 0; j1 < n1; j1++) {
        for (let i2 = 0; i2 < m2; i2++) {
          for (let j2 = 0; j2 < n2; j2++) {
            const newI = i1 * m2 + i2
            const newJ = j1 * n2 + j2
            const newIdx = (newI * newShape[1] + newJ) * stride

            if (isComplex) {
              const a = this.getComplex(i1 * n1 + j1)
              const b = other.getComplex(i2 * n2 + j2)
              const c = a.mul(b)
              newData[newIdx] = c.re
              newData[newIdx + 1] = c.im
            } else {
              newData[newIdx] = this.data[i1 * n1 + j1] * other.data[i2 * n2 + j2]
            }
          }
        }
      }
    }

    return new QTensor(newData, newShape, {
      dtype: isComplex ? 'complex128' : 'float64',
      requiresGrad: this.requiresGrad || other.requiresGrad
    })
  }

  trace(): QTensor {
    if (this.ndim !== 2 || this.shape[0] !== this.shape[1]) {
      throw new Error('trace requires square 2D tensor')
    }

    const n = this.shape[0]
    if (this.dtype === 'complex128') {
      let sumRe = 0, sumIm = 0
      for (let i = 0; i < n; i++) {
        const c = this.getComplex(i * n + i)
        sumRe += c.re
        sumIm += c.im
      }
      return QTensor.complexScalar(sumRe, sumIm, { requiresGrad: this.requiresGrad })
    }

    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += this.data[i * n + i]
    }
    return QTensor.scalar(sum, { requiresGrad: this.requiresGrad })
  }

  norm(p: number = 2): number {
    if (this.dtype === 'complex128') {
      let sum = 0
      for (let i = 0; i < this.size; i++) {
        sum += Math.pow(this.getComplex(i).abs(), p)
      }
      return Math.pow(sum, 1 / p)
    }

    let sum = 0
    for (let i = 0; i < this.data.length; i++) {
      sum += Math.pow(Math.abs(this.data[i]), p)
    }
    return Math.pow(sum, 1 / p)
  }

  normalize(): QTensor {
    const n = this.norm(2)
    return this.div(n)
  }

  toArray(): number[] | Complex[] {
    if (this.dtype === 'complex128') {
      const result: Complex[] = []
      for (let i = 0; i < this.size; i++) {
        result.push(this.getComplex(i))
      }
      return result
    }
    return Array.from(this.data)
  }

  toNestedArray(): any {
    if (this.ndim === 0) {
      return this.data[0]
    }
    if (this.ndim === 1) {
      return this.toArray()
    }

    const result: any[] = []
    const stride = this.dtype === 'complex128' ? 2 : 1
    const innerSize = this.shape.slice(1).reduce((a, b) => a * b, 1)

    for (let i = 0; i < this.shape[0]; i++) {
      const start = i * innerSize * stride
      const end = (i + 1) * innerSize * stride
      const slice = new QTensor(
        this.data.slice(start, end),
        this.shape.slice(1),
        { dtype: this.dtype }
      )
      result.push(slice.toNestedArray())
    }

    return result
  }

  toString(): string {
    return `QTensor(shape=[${this.shape.join(', ')}], dtype=${this.dtype}, requiresGrad=${this.requiresGrad})`
  }

  private assertSameShape(other: QTensor): void {
    if (this.shape.length !== other.shape.length) {
      throw new Error(`Shape mismatch: ${this.shape} vs ${other.shape}`)
    }
    for (let i = 0; i < this.shape.length; i++) {
      if (this.shape[i] !== other.shape[i]) {
        throw new Error(`Shape mismatch at dimension ${i}: ${this.shape} vs ${other.shape}`)
      }
    }
  }
}

export function tensor(
  data: number[] | Float64Array,
  shape?: Shape,
  options: { dtype?: DType; requiresGrad?: boolean } = {}
): QTensor {
  const arr = data instanceof Float64Array ? data : new Float64Array(data)
  const inferredShape = shape ?? [arr.length]
  return new QTensor(arr, inferredShape, options)
}

export function zeros(shape: Shape, options?: { dtype?: DType; requiresGrad?: boolean }): QTensor {
  return QTensor.zeros(shape, options)
}

export function ones(shape: Shape, options?: { dtype?: DType; requiresGrad?: boolean }): QTensor {
  return QTensor.ones(shape, options)
}

export function eye(n: number, options?: { dtype?: DType; requiresGrad?: boolean }): QTensor {
  return QTensor.eye(n, options)
}

export function rand(shape: Shape, options?: { dtype?: DType; requiresGrad?: boolean }): QTensor {
  return QTensor.rand(shape, options)
}

export function randn(shape: Shape, options?: { dtype?: DType; requiresGrad?: boolean }): QTensor {
  return QTensor.randn(shape, options)
}

export function arange(start: number, stop: number, step?: number, options?: { requiresGrad?: boolean }): QTensor {
  return QTensor.arange(start, stop, step, options)
}

export function linspace(start: number, stop: number, num: number, options?: { requiresGrad?: boolean }): QTensor {
  return QTensor.linspace(start, stop, num, options)
}

export function kron(a: QTensor, b: QTensor): QTensor {
  return a.kron(b)
}

export function matmul(a: QTensor, b: QTensor): QTensor {
  return a.matmul(b)
}

export function dot(a: QTensor, b: QTensor): QTensor {
  return a.dot(b)
}
