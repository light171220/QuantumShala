import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { ry, rz, cnot, cz } from '../../circuit/operations/gates'

export interface EfficientSU2Config {
  wires?: number[]
  numLayers?: number
  entanglement?: 'linear' | 'circular' | 'full' | 'pairwise' | 'sca' | [number, number][]
  suGate?: 'SU2' | 'YZ' | 'ZYZ'
  skipFinalRotation?: boolean
  entanglementGate?: 'CX' | 'CZ'
}

export function efficientSU2(
  tape: QuantumTape,
  params: number[] | QTensor,
  config: EfficientSU2Config = {}
): void {
  const numLayers = config.numLayers ?? 1
  const entanglement = config.entanglement ?? 'linear'
  const suGate = config.suGate ?? 'YZ'
  const skipFinalRotation = config.skipFinalRotation ?? false
  const entanglementGate = config.entanglementGate ?? 'CX'

  const parameters = params instanceof QTensor
    ? Array.from(params.data)
    : params

  const paramsPerQubit = suGate === 'ZYZ' ? 3 : 2
  const defaultNumWires = Math.ceil(
    parameters.length / ((numLayers + (skipFinalRotation ? 0 : 1)) * paramsPerQubit)
  )
  const wires = config.wires ?? Array.from({ length: defaultNumWires }, (_, i) => i)
  const numWires = wires.length

  let paramIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numWires; i++) {
      applySURotation(tape, wires[i], parameters, paramIdx, suGate)
      paramIdx += paramsPerQubit
    }

    const pairs = getEntanglementPairs(numWires, entanglement, layer)
    for (const [i, j] of pairs) {
      if (entanglementGate === 'CX') {
        cnot(tape, wires[i], wires[j])
      } else {
        cz(tape, wires[i], wires[j])
      }
    }
  }

  if (!skipFinalRotation) {
    for (let i = 0; i < numWires; i++) {
      applySURotation(tape, wires[i], parameters, paramIdx, suGate)
      paramIdx += paramsPerQubit
    }
  }
}

function applySURotation(
  tape: QuantumTape,
  wire: number,
  params: number[],
  startIdx: number,
  suGate: 'SU2' | 'YZ' | 'ZYZ'
): void {
  switch (suGate) {
    case 'YZ':
      ry(tape, wire, params[startIdx] ?? 0)
      rz(tape, wire, params[startIdx + 1] ?? 0)
      break

    case 'ZYZ':
      rz(tape, wire, params[startIdx] ?? 0)
      ry(tape, wire, params[startIdx + 1] ?? 0)
      rz(tape, wire, params[startIdx + 2] ?? 0)
      break

    case 'SU2':
      ry(tape, wire, params[startIdx] ?? 0)
      rz(tape, wire, params[startIdx + 1] ?? 0)
      break
  }
}

function getEntanglementPairs(
  numQubits: number,
  entanglement: 'linear' | 'circular' | 'full' | 'pairwise' | 'sca' | [number, number][],
  layer: number
): [number, number][] {
  if (Array.isArray(entanglement)) {
    return entanglement
  }

  const pairs: [number, number][] = []

  switch (entanglement) {
    case 'linear':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      break

    case 'circular':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      if (numQubits > 2) {
        pairs.push([numQubits - 1, 0])
      }
      break

    case 'full':
      for (let i = 0; i < numQubits; i++) {
        for (let j = i + 1; j < numQubits; j++) {
          pairs.push([i, j])
        }
      }
      break

    case 'pairwise':
      const offset = layer % 2
      for (let i = offset; i < numQubits - 1; i += 2) {
        pairs.push([i, i + 1])
      }
      break

    case 'sca':
      const scaOffset = layer % (numQubits - 1)
      for (let i = 0; i < numQubits - 1; i++) {
        const src = (i + scaOffset) % numQubits
        const dst = (i + 1 + scaOffset) % numQubits
        pairs.push([Math.min(src, dst), Math.max(src, dst)])
      }
      break
  }

  return pairs
}

export function efficientSU2Linear(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  efficientSU2(tape, params, {
    wires,
    numLayers,
    entanglement: 'linear'
  })
}

export function efficientSU2Circular(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  efficientSU2(tape, params, {
    wires,
    numLayers,
    entanglement: 'circular'
  })
}

export function efficientSU2Full(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  efficientSU2(tape, params, {
    wires,
    numLayers,
    entanglement: 'full'
  })
}

export function getEfficientSU2ParamCount(
  numWires: number,
  numLayers: number,
  suGate: 'SU2' | 'YZ' | 'ZYZ' = 'YZ',
  skipFinalRotation: boolean = false
): number {
  const paramsPerQubit = suGate === 'ZYZ' ? 3 : 2
  const rotationLayers = numLayers + (skipFinalRotation ? 0 : 1)
  return numWires * rotationLayers * paramsPerQubit
}

export function initEfficientSU2Params(
  numWires: number,
  numLayers: number,
  suGate: 'SU2' | 'YZ' | 'ZYZ' = 'YZ',
  initMethod: 'zeros' | 'random' | 'small_random' = 'small_random'
): number[] {
  const count = getEfficientSU2ParamCount(numWires, numLayers, suGate)

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
