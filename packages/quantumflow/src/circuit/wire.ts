export class Wire {
  readonly index: number
  readonly label: string
  private _classical: boolean

  constructor(index: number, options: { label?: string; classical?: boolean } = {}) {
    this.index = index
    this.label = options.label ?? `q${index}`
    this._classical = options.classical ?? false
  }

  get isClassical(): boolean {
    return this._classical
  }

  get isQuantum(): boolean {
    return !this._classical
  }

  toString(): string {
    return this.label
  }

  equals(other: Wire): boolean {
    return this.index === other.index && this._classical === other._classical
  }
}

export class WireSet {
  private _wires: Map<number, Wire>
  private _classicalWires: Map<number, Wire>
  private _numQubits: number
  private _numClassical: number

  constructor() {
    this._wires = new Map()
    this._classicalWires = new Map()
    this._numQubits = 0
    this._numClassical = 0
  }

  get numQubits(): number {
    return this._numQubits
  }

  get numClassical(): number {
    return this._numClassical
  }

  get totalWires(): number {
    return this._numQubits + this._numClassical
  }

  get quantumWires(): Wire[] {
    return Array.from(this._wires.values())
  }

  get classicalWires(): Wire[] {
    return Array.from(this._classicalWires.values())
  }

  get allWires(): Wire[] {
    return [...this.quantumWires, ...this.classicalWires]
  }

  addQuantumWire(label?: string): Wire {
    const wire = new Wire(this._numQubits, { label: label ?? `q${this._numQubits}` })
    this._wires.set(this._numQubits, wire)
    this._numQubits++
    return wire
  }

  addQuantumWires(count: number): Wire[] {
    const wires: Wire[] = []
    for (let i = 0; i < count; i++) {
      wires.push(this.addQuantumWire())
    }
    return wires
  }

  addClassicalWire(label?: string): Wire {
    const wire = new Wire(this._numClassical, {
      label: label ?? `c${this._numClassical}`,
      classical: true
    })
    this._classicalWires.set(this._numClassical, wire)
    this._numClassical++
    return wire
  }

  addClassicalWires(count: number): Wire[] {
    const wires: Wire[] = []
    for (let i = 0; i < count; i++) {
      wires.push(this.addClassicalWire())
    }
    return wires
  }

  getQuantumWire(index: number): Wire | undefined {
    return this._wires.get(index)
  }

  getClassicalWire(index: number): Wire | undefined {
    return this._classicalWires.get(index)
  }

  hasQuantumWire(index: number): boolean {
    return this._wires.has(index)
  }

  hasClassicalWire(index: number): boolean {
    return this._classicalWires.has(index)
  }

  validateQuantumWires(indices: number[]): boolean {
    return indices.every(i => this.hasQuantumWire(i))
  }

  validateClassicalWires(indices: number[]): boolean {
    return indices.every(i => this.hasClassicalWire(i))
  }

  clear(): void {
    this._wires.clear()
    this._classicalWires.clear()
    this._numQubits = 0
    this._numClassical = 0
  }

  [Symbol.iterator](): Iterator<Wire> {
    return this.allWires[Symbol.iterator]()
  }
}

export class WireRange {
  readonly start: number
  readonly end: number
  readonly step: number

  constructor(start: number, end: number, step: number = 1) {
    this.start = start
    this.end = end
    this.step = step
  }

  get length(): number {
    return Math.ceil((this.end - this.start) / this.step)
  }

  toArray(): number[] {
    const result: number[] = []
    for (let i = this.start; i < this.end; i += this.step) {
      result.push(i)
    }
    return result
  }

  includes(index: number): boolean {
    if (index < this.start || index >= this.end) {
      return false
    }
    return (index - this.start) % this.step === 0
  }

  [Symbol.iterator](): Iterator<number> {
    return this.toArray()[Symbol.iterator]()
  }
}

export function wire(index: number, options?: { label?: string; classical?: boolean }): Wire {
  return new Wire(index, options)
}

export function wires(count: number): Wire[] {
  return Array.from({ length: count }, (_, i) => new Wire(i))
}

export function classicalWires(count: number): Wire[] {
  return Array.from({ length: count }, (_, i) => new Wire(i, { classical: true }))
}

export function range(start: number, end: number, step?: number): WireRange {
  return new WireRange(start, end, step)
}

export function resolveWires(
  input: number | number[] | Wire | Wire[] | WireRange
): number[] {
  if (typeof input === 'number') {
    return [input]
  }
  if (input instanceof Wire) {
    return [input.index]
  }
  if (input instanceof WireRange) {
    return input.toArray()
  }
  if (Array.isArray(input)) {
    return input.map(w => (w instanceof Wire ? w.index : w))
  }
  throw new Error('Invalid wire specification')
}

export function validateWireIndices(
  wires: number[],
  numQubits: number,
  operationName: string
): void {
  for (const wire of wires) {
    if (wire < 0 || wire >= numQubits) {
      throw new Error(
        `Wire index ${wire} out of bounds for ${operationName} (numQubits=${numQubits})`
      )
    }
  }

  const uniqueWires = new Set(wires)
  if (uniqueWires.size !== wires.length) {
    throw new Error(`Duplicate wire indices in ${operationName}: [${wires.join(', ')}]`)
  }
}

export function wirePermutation(
  sourceWires: number[],
  targetWires: number[],
  numQubits: number
): number[] {
  if (sourceWires.length !== targetWires.length) {
    throw new Error('Source and target wire arrays must have same length')
  }

  const permutation = Array.from({ length: numQubits }, (_, i) => i)

  for (let i = 0; i < sourceWires.length; i++) {
    permutation[sourceWires[i]] = targetWires[i]
  }

  return permutation
}

export function adjacentPairs(wires: number[]): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < wires.length - 1; i++) {
    pairs.push([wires[i], wires[i + 1]])
  }
  return pairs
}

export function allPairs(wires: number[]): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      pairs.push([wires[i], wires[j]])
    }
  }
  return pairs
}

export function circularPairs(wires: number[]): [number, number][] {
  const pairs = adjacentPairs(wires)
  if (wires.length > 2) {
    pairs.push([wires[wires.length - 1], wires[0]])
  }
  return pairs
}
