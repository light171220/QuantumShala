import { QTensor, Shape, DType } from './tensor'

let variableIdCounter = 0

export class Variable {
  readonly id: number
  readonly name: string
  private _tensor: QTensor
  private _frozen: boolean

  constructor(
    data: number[] | Float64Array | QTensor,
    options: {
      name?: string
      shape?: Shape
      dtype?: DType
      frozen?: boolean
    } = {}
  ) {
    this.id = variableIdCounter++
    this.name = options.name ?? `var_${this.id}`
    this._frozen = options.frozen ?? false

    if (data instanceof QTensor) {
      this._tensor = data.requireGrad(!this._frozen)
    } else {
      const shape = options.shape ?? (Array.isArray(data) ? [data.length] : [data.length])
      this._tensor = new QTensor(
        data instanceof Float64Array ? data : new Float64Array(data),
        shape,
        {
          dtype: options.dtype ?? 'float64',
          requiresGrad: !this._frozen
        }
      )
    }
    this._tensor.name = this.name
  }

  get tensor(): QTensor {
    return this._tensor
  }

  get data(): Float64Array {
    return this._tensor.data
  }

  get shape(): Shape {
    return this._tensor.shape
  }

  get dtype(): DType {
    return this._tensor.dtype
  }

  get size(): number {
    return this._tensor.size
  }

  get grad(): QTensor | null {
    return this._tensor.grad
  }

  get frozen(): boolean {
    return this._frozen
  }

  get requiresGrad(): boolean {
    return this._tensor.requiresGrad
  }

  freeze(): void {
    this._frozen = true
    this._tensor = this._tensor.requireGrad(false)
  }

  unfreeze(): void {
    this._frozen = false
    this._tensor = this._tensor.requireGrad(true)
  }

  update(newData: number[] | Float64Array): void {
    if (this._frozen) {
      throw new Error(`Cannot update frozen variable: ${this.name}`)
    }
    const arr = newData instanceof Float64Array ? newData : new Float64Array(newData)
    if (arr.length !== this._tensor.data.length) {
      throw new Error(`Data length mismatch: expected ${this._tensor.data.length}, got ${arr.length}`)
    }
    for (let i = 0; i < arr.length; i++) {
      this._tensor.data[i] = arr[i]
    }
  }

  set(index: number, value: number): void {
    if (this._frozen) {
      throw new Error(`Cannot update frozen variable: ${this.name}`)
    }
    this._tensor.data[index] = value
  }

  get(index: number): number {
    return this._tensor.data[index]
  }

  zeroGrad(): void {
    if (this._tensor.grad) {
      for (let i = 0; i < this._tensor.grad.data.length; i++) {
        this._tensor.grad.data[i] = 0
      }
    }
  }

  clone(): Variable {
    return new Variable(new Float64Array(this._tensor.data), {
      name: `${this.name}_clone`,
      shape: [...this.shape],
      dtype: this.dtype,
      frozen: this._frozen
    })
  }

  detach(): QTensor {
    return this._tensor.detach()
  }

  toArray(): number[] {
    return Array.from(this._tensor.data)
  }

  toString(): string {
    return `Variable(name=${this.name}, shape=[${this.shape.join(', ')}], frozen=${this._frozen})`
  }

  static fromTensor(tensor: QTensor, name?: string): Variable {
    return new Variable(tensor, { name })
  }

  static uniform(shape: Shape, low: number = 0, high: number = 1, options: { name?: string; dtype?: DType } = {}): Variable {
    const size = shape.reduce((a, b) => a * b, 1)
    const data = new Float64Array(size)
    const range = high - low
    for (let i = 0; i < size; i++) {
      data[i] = low + Math.random() * range
    }
    return new Variable(data, { ...options, shape })
  }

  static normal(shape: Shape, mean: number = 0, std: number = 1, options: { name?: string; dtype?: DType } = {}): Variable {
    const size = shape.reduce((a, b) => a * b, 1)
    const data = new Float64Array(size)
    for (let i = 0; i < size; i += 2) {
      const u1 = Math.random()
      const u2 = Math.random()
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2)
      data[i] = mean + z0 * std
      if (i + 1 < size) {
        data[i + 1] = mean + z1 * std
      }
    }
    return new Variable(data, { ...options, shape })
  }

  static zeros(shape: Shape, options: { name?: string; dtype?: DType } = {}): Variable {
    const size = shape.reduce((a, b) => a * b, 1)
    return new Variable(new Float64Array(size), { ...options, shape })
  }

  static ones(shape: Shape, options: { name?: string; dtype?: DType } = {}): Variable {
    const size = shape.reduce((a, b) => a * b, 1)
    const data = new Float64Array(size)
    data.fill(1)
    return new Variable(data, { ...options, shape })
  }

  static constant(value: number, shape: Shape, options: { name?: string; dtype?: DType } = {}): Variable {
    const size = shape.reduce((a, b) => a * b, 1)
    const data = new Float64Array(size)
    data.fill(value)
    const v = new Variable(data, { ...options, shape })
    v.freeze()
    return v
  }

  static xavier(shape: Shape, options: { name?: string; dtype?: DType } = {}): Variable {
    const fanIn = shape.length > 1 ? shape[shape.length - 2] : shape[0]
    const fanOut = shape[shape.length - 1]
    const std = Math.sqrt(2.0 / (fanIn + fanOut))
    return Variable.normal(shape, 0, std, options)
  }

  static he(shape: Shape, options: { name?: string; dtype?: DType } = {}): Variable {
    const fanIn = shape.length > 1 ? shape[shape.length - 2] : shape[0]
    const std = Math.sqrt(2.0 / fanIn)
    return Variable.normal(shape, 0, std, options)
  }
}

export class VariableCollection {
  private _variables: Map<string, Variable>

  constructor() {
    this._variables = new Map()
  }

  add(variable: Variable): void {
    if (this._variables.has(variable.name)) {
      throw new Error(`Variable with name ${variable.name} already exists`)
    }
    this._variables.set(variable.name, variable)
  }

  get(name: string): Variable | undefined {
    return this._variables.get(name)
  }

  has(name: string): boolean {
    return this._variables.has(name)
  }

  remove(name: string): boolean {
    return this._variables.delete(name)
  }

  all(): Variable[] {
    return Array.from(this._variables.values())
  }

  trainable(): Variable[] {
    return this.all().filter(v => !v.frozen)
  }

  frozen(): Variable[] {
    return this.all().filter(v => v.frozen)
  }

  tensors(): QTensor[] {
    return this.all().map(v => v.tensor)
  }

  trainableTensors(): QTensor[] {
    return this.trainable().map(v => v.tensor)
  }

  zeroGrad(): void {
    for (const v of this._variables.values()) {
      v.zeroGrad()
    }
  }

  freeze(): void {
    for (const v of this._variables.values()) {
      v.freeze()
    }
  }

  unfreeze(): void {
    for (const v of this._variables.values()) {
      v.unfreeze()
    }
  }

  size(): number {
    return this._variables.size
  }

  totalParameters(): number {
    let total = 0
    for (const v of this._variables.values()) {
      total += v.size
    }
    return total
  }

  trainableParameters(): number {
    let total = 0
    for (const v of this._variables.values()) {
      if (!v.frozen) {
        total += v.size
      }
    }
    return total
  }

  state(): Map<string, Float64Array> {
    const state = new Map<string, Float64Array>()
    for (const [name, v] of this._variables) {
      state.set(name, new Float64Array(v.data))
    }
    return state
  }

  loadState(state: Map<string, Float64Array>): void {
    for (const [name, data] of state) {
      const v = this._variables.get(name)
      if (v) {
        v.update(data)
      }
    }
  }

  [Symbol.iterator](): Iterator<Variable> {
    return this._variables.values()
  }
}

export function variable(
  data: number[] | Float64Array | QTensor,
  options?: { name?: string; shape?: Shape; dtype?: DType; frozen?: boolean }
): Variable {
  return new Variable(data, options)
}

export function trainable(
  data: number[] | Float64Array | QTensor,
  name?: string
): Variable {
  return new Variable(data, { name, frozen: false })
}

export function constant(
  data: number[] | Float64Array | QTensor,
  name?: string
): Variable {
  return new Variable(data, { name, frozen: true })
}
