import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { rx, ry, rz, H, cnot, cz, u3 } from '../../circuit/operations/gates'

export interface ExpressibleAnsatzConfig {
  wires?: number[]
  numLayers?: number
  expressibility?: 'low' | 'medium' | 'high' | 'maximal'
  entanglementStrategy?: 'alternating' | 'ladder' | 'all-to-all' | 'random'
  seed?: number
}

export function expressibleAnsatz(
  tape: QuantumTape,
  params: number[] | QTensor,
  config: ExpressibleAnsatzConfig = {}
): void {
  const numLayers = config.numLayers ?? 1
  const expressibility = config.expressibility ?? 'medium'
  const entanglementStrategy = config.entanglementStrategy ?? 'alternating'

  const parameters = params instanceof QTensor
    ? Array.from(params.data)
    : params

  const paramsPerQubit = getParamsPerQubit(expressibility)
  const defaultNumWires = Math.ceil(parameters.length / ((numLayers + 1) * paramsPerQubit))
  const wires = config.wires ?? Array.from({ length: defaultNumWires }, (_, i) => i)
  const numWires = wires.length

  let paramIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numWires; i++) {
      paramIdx = applyExpressibleRotation(tape, wires[i], parameters, paramIdx, expressibility)
    }

    const pairs = getEntanglementPairs(numWires, entanglementStrategy, layer, config.seed)

    for (const [i, j] of pairs) {
      cnot(tape, wires[i], wires[j])
    }
  }

  for (let i = 0; i < numWires; i++) {
    paramIdx = applyExpressibleRotation(tape, wires[i], parameters, paramIdx, expressibility)
  }
}

function getParamsPerQubit(expressibility: 'low' | 'medium' | 'high' | 'maximal'): number {
  switch (expressibility) {
    case 'low':
      return 1
    case 'medium':
      return 2
    case 'high':
      return 3
    case 'maximal':
      return 3
  }
}

function applyExpressibleRotation(
  tape: QuantumTape,
  wire: number,
  params: number[],
  startIdx: number,
  expressibility: 'low' | 'medium' | 'high' | 'maximal'
): number {
  switch (expressibility) {
    case 'low':
      ry(tape, wire, params[startIdx] ?? 0)
      return startIdx + 1

    case 'medium':
      ry(tape, wire, params[startIdx] ?? 0)
      rz(tape, wire, params[startIdx + 1] ?? 0)
      return startIdx + 2

    case 'high':
      rz(tape, wire, params[startIdx] ?? 0)
      ry(tape, wire, params[startIdx + 1] ?? 0)
      rz(tape, wire, params[startIdx + 2] ?? 0)
      return startIdx + 3

    case 'maximal':
      u3(tape, wire, params[startIdx] ?? 0, params[startIdx + 1] ?? 0, params[startIdx + 2] ?? 0)
      return startIdx + 3
  }
}

function getEntanglementPairs(
  numQubits: number,
  strategy: 'alternating' | 'ladder' | 'all-to-all' | 'random',
  layer: number,
  seed?: number
): [number, number][] {
  const pairs: [number, number][] = []

  switch (strategy) {
    case 'alternating':
      const offset = layer % 2
      for (let i = offset; i < numQubits - 1; i += 2) {
        pairs.push([i, i + 1])
      }
      break

    case 'ladder':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      break

    case 'all-to-all':
      for (let i = 0; i < numQubits; i++) {
        for (let j = i + 1; j < numQubits; j++) {
          pairs.push([i, j])
        }
      }
      break

    case 'random':
      const rng = seededRandom(seed ?? layer)
      const shuffled = Array.from({ length: numQubits }, (_, i) => i)
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      for (let i = 0; i < numQubits - 1; i += 2) {
        pairs.push([shuffled[i], shuffled[i + 1]])
      }
      break
  }

  return pairs
}

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

export function circuit1(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  expressibleAnsatz(tape, params, {
    wires,
    numLayers,
    expressibility: 'low',
    entanglementStrategy: 'ladder'
  })
}

export function circuit9(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  expressibleAnsatz(tape, params, {
    wires,
    numLayers,
    expressibility: 'high',
    entanglementStrategy: 'alternating'
  })
}

export function circuit19(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  expressibleAnsatz(tape, params, {
    wires,
    numLayers,
    expressibility: 'maximal',
    entanglementStrategy: 'all-to-all'
  })
}

export function simCircuit(
  tape: QuantumTape,
  params: number[] | QTensor,
  circuitId: number,
  numLayers: number = 1,
  wires?: number[]
): void {
  const expressibilities: ('low' | 'medium' | 'high' | 'maximal')[] = [
    'low', 'medium', 'high', 'maximal'
  ]
  const strategies: ('alternating' | 'ladder' | 'all-to-all' | 'random')[] = [
    'alternating', 'ladder', 'all-to-all', 'random'
  ]

  const expressibility = expressibilities[circuitId % 4]
  const strategy = strategies[Math.floor(circuitId / 4) % 4]

  expressibleAnsatz(tape, params, {
    wires,
    numLayers,
    expressibility,
    entanglementStrategy: strategy,
    seed: circuitId
  })
}

export function getExpressibleParamCount(
  numWires: number,
  numLayers: number,
  expressibility: 'low' | 'medium' | 'high' | 'maximal' = 'medium'
): number {
  const paramsPerQubit = getParamsPerQubit(expressibility)
  return numWires * (numLayers + 1) * paramsPerQubit
}

export function initExpressibleParams(
  numWires: number,
  numLayers: number,
  expressibility: 'low' | 'medium' | 'high' | 'maximal' = 'medium',
  initMethod: 'zeros' | 'random' | 'small_random' = 'small_random'
): number[] {
  const count = getExpressibleParamCount(numWires, numLayers, expressibility)

  switch (initMethod) {
    case 'zeros':
      return new Array(count).fill(0)

    case 'random':
      return Array.from({ length: count }, () => Math.random() * 2 * Math.PI)

    case 'small_random':
    default:
      return Array.from({ length: count }, () => (Math.random() - 0.5) * 0.1)
  }
}
