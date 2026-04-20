import { QuantumTape, TapeOperation, TapeRecord } from '../autodiff/tape'
import { QTensor } from '../core/tensor'

export type TransformFn = (tape: QuantumTape) => QuantumTape

export interface TransformConfig {
  name: string
  description?: string
  preservesGrad?: boolean
  inPlace?: boolean
}

export interface TransformResult {
  tape: QuantumTape
  stats: TransformStats
}

export interface TransformStats {
  originalOps: number
  transformedOps: number
  gatesRemoved: number
  gatesMerged: number
  gatesDecomposed: number
  executionTimeMs: number
}

export abstract class Transform {
  readonly name: string
  readonly description: string
  readonly preservesGrad: boolean
  readonly inPlace: boolean

  constructor(config: TransformConfig) {
    this.name = config.name
    this.description = config.description ?? ''
    this.preservesGrad = config.preservesGrad ?? true
    this.inPlace = config.inPlace ?? false
  }

  abstract apply(tape: QuantumTape): TransformResult

  transform(tape: QuantumTape): QuantumTape {
    return this.apply(tape).tape
  }

  compose(other: Transform): ComposedTransform {
    return new ComposedTransform([this, other])
  }

  then(other: Transform): ComposedTransform {
    return this.compose(other)
  }

  repeat(n: number): RepeatedTransform {
    return new RepeatedTransform(this, n)
  }

  conditional(predicate: (tape: QuantumTape) => boolean): ConditionalTransform {
    return new ConditionalTransform(this, predicate)
  }

  protected createStats(original: QuantumTape, transformed: QuantumTape, startTime: number): TransformStats {
    const originalOps = original.numOperations
    const transformedOps = transformed.numOperations
    return {
      originalOps,
      transformedOps,
      gatesRemoved: Math.max(0, originalOps - transformedOps),
      gatesMerged: 0,
      gatesDecomposed: 0,
      executionTimeMs: Date.now() - startTime
    }
  }
}

export class ComposedTransform extends Transform {
  private transforms: Transform[]

  constructor(transforms: Transform[]) {
    super({
      name: `Composed(${transforms.map(t => t.name).join(', ')})`,
      description: `Composition of ${transforms.length} transforms`,
      preservesGrad: transforms.every(t => t.preservesGrad)
    })
    this.transforms = transforms
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const originalOps = tape.numOperations
    let currentTape = tape
    let totalRemoved = 0
    let totalMerged = 0
    let totalDecomposed = 0

    for (const transform of this.transforms) {
      const result = transform.apply(currentTape)
      totalRemoved += result.stats.gatesRemoved
      totalMerged += result.stats.gatesMerged
      totalDecomposed += result.stats.gatesDecomposed
      currentTape = result.tape
    }

    return {
      tape: currentTape,
      stats: {
        originalOps,
        transformedOps: currentTape.numOperations,
        gatesRemoved: totalRemoved,
        gatesMerged: totalMerged,
        gatesDecomposed: totalDecomposed,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  add(transform: Transform): ComposedTransform {
    return new ComposedTransform([...this.transforms, transform])
  }

  getTransforms(): Transform[] {
    return [...this.transforms]
  }
}

export class RepeatedTransform extends Transform {
  private baseTransform: Transform
  private repetitions: number

  constructor(transform: Transform, n: number) {
    super({
      name: `Repeat(${transform.name}, ${n})`,
      description: `Repeat ${transform.name} ${n} times`,
      preservesGrad: transform.preservesGrad
    })
    this.baseTransform = transform
    this.repetitions = n
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const originalOps = tape.numOperations
    let currentTape = tape
    let totalRemoved = 0
    let totalMerged = 0
    let totalDecomposed = 0

    for (let i = 0; i < this.repetitions; i++) {
      const result = this.baseTransform.apply(currentTape)
      totalRemoved += result.stats.gatesRemoved
      totalMerged += result.stats.gatesMerged
      totalDecomposed += result.stats.gatesDecomposed
      currentTape = result.tape
    }

    return {
      tape: currentTape,
      stats: {
        originalOps,
        transformedOps: currentTape.numOperations,
        gatesRemoved: totalRemoved,
        gatesMerged: totalMerged,
        gatesDecomposed: totalDecomposed,
        executionTimeMs: Date.now() - startTime
      }
    }
  }
}

export class ConditionalTransform extends Transform {
  private baseTransform: Transform
  private predicate: (tape: QuantumTape) => boolean

  constructor(transform: Transform, predicate: (tape: QuantumTape) => boolean) {
    super({
      name: `Conditional(${transform.name})`,
      description: `Conditionally apply ${transform.name}`,
      preservesGrad: transform.preservesGrad
    })
    this.baseTransform = transform
    this.predicate = predicate
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()

    if (this.predicate(tape)) {
      return this.baseTransform.apply(tape)
    }

    return {
      tape: tape.copy(),
      stats: {
        originalOps: tape.numOperations,
        transformedOps: tape.numOperations,
        gatesRemoved: 0,
        gatesMerged: 0,
        gatesDecomposed: 0,
        executionTimeMs: Date.now() - startTime
      }
    }
  }
}

export class IdentityTransform extends Transform {
  constructor() {
    super({
      name: 'Identity',
      description: 'Returns the tape unchanged'
    })
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    return {
      tape: tape.copy(),
      stats: this.createStats(tape, tape, startTime)
    }
  }
}

export class FunctionTransform extends Transform {
  private fn: TransformFn

  constructor(name: string, fn: TransformFn, config?: Partial<TransformConfig>) {
    super({
      name,
      ...config
    })
    this.fn = fn
  }

  apply(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const transformed = this.fn(tape)
    return {
      tape: transformed,
      stats: this.createStats(tape, transformed, startTime)
    }
  }
}

export function createTransform(name: string, fn: TransformFn, config?: Partial<TransformConfig>): Transform {
  return new FunctionTransform(name, fn, config)
}

export function compose(...transforms: Transform[]): ComposedTransform {
  return new ComposedTransform(transforms)
}

export function identity(): IdentityTransform {
  return new IdentityTransform()
}

export function applyTransforms(tape: QuantumTape, transforms: Transform[]): TransformResult {
  return compose(...transforms).apply(tape)
}

export interface TransformPass {
  name: string
  transforms: Transform[]
  maxIterations?: number
  convergenceThreshold?: number
}

export class TransformPipeline {
  private passes: TransformPass[]

  constructor() {
    this.passes = []
  }

  addPass(pass: TransformPass): TransformPipeline {
    this.passes.push(pass)
    return this
  }

  addTransform(name: string, ...transforms: Transform[]): TransformPipeline {
    this.passes.push({ name, transforms })
    return this
  }

  run(tape: QuantumTape): TransformResult {
    const startTime = Date.now()
    const originalOps = tape.numOperations
    let currentTape = tape
    let totalRemoved = 0
    let totalMerged = 0
    let totalDecomposed = 0

    for (const pass of this.passes) {
      const maxIter = pass.maxIterations ?? 1
      const threshold = pass.convergenceThreshold ?? 0

      for (let i = 0; i < maxIter; i++) {
        const prevOps = currentTape.numOperations
        const result = compose(...pass.transforms).apply(currentTape)

        totalRemoved += result.stats.gatesRemoved
        totalMerged += result.stats.gatesMerged
        totalDecomposed += result.stats.gatesDecomposed
        currentTape = result.tape

        if (threshold > 0 && Math.abs(prevOps - currentTape.numOperations) <= threshold) {
          break
        }
      }
    }

    return {
      tape: currentTape,
      stats: {
        originalOps,
        transformedOps: currentTape.numOperations,
        gatesRemoved: totalRemoved,
        gatesMerged: totalMerged,
        gatesDecomposed: totalDecomposed,
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  getPasses(): TransformPass[] {
    return [...this.passes]
  }
}

export function pipeline(): TransformPipeline {
  return new TransformPipeline()
}

export function matchGates(
  operations: TapeRecord[],
  pattern: (op: TapeOperation) => boolean
): number[] {
  const indices: number[] = []
  for (let i = 0; i < operations.length; i++) {
    if (pattern(operations[i].operation)) {
      indices.push(i)
    }
  }
  return indices
}

export function findConsecutivePairs(
  operations: TapeRecord[],
  predicate: (op1: TapeOperation, op2: TapeOperation) => boolean
): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < operations.length - 1; i++) {
    if (predicate(operations[i].operation, operations[i + 1].operation)) {
      pairs.push([i, i + 1])
    }
  }
  return pairs
}

export function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function wiresOverlap(wires1: number[], wires2: number[]): boolean {
  const set1 = new Set(wires1)
  for (const w of wires2) {
    if (set1.has(w)) return true
  }
  return false
}

export function canCommute(op1: TapeOperation, op2: TapeOperation): boolean {
  if (!wiresOverlap(op1.wires, op2.wires) && !wiresOverlap(op1.controlWires, op2.wires)) {
    return true
  }

  const commutingPairs = [
    ['RZ', 'RZ'],
    ['RZ', 'CZ'],
    ['CZ', 'CZ'],
    ['RZ', 'CNOT'],
    ['PauliZ', 'PauliZ'],
    ['PauliZ', 'RZ'],
    ['PhaseShift', 'PhaseShift'],
    ['PhaseShift', 'RZ']
  ]

  for (const [g1, g2] of commutingPairs) {
    if ((op1.name === g1 && op2.name === g2) || (op1.name === g2 && op2.name === g1)) {
      return true
    }
  }

  return false
}
