import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { ry, cnot, cz } from '../../circuit/operations/gates'

export interface RealAmplitudesConfig {
  wires?: number[]
  numLayers?: number
  entanglement?: 'linear' | 'circular' | 'full' | 'pairwise' | 'sca' | [number, number][]
  skipFinalRotation?: boolean
  insertBarriers?: boolean
  initialState?: 'zero' | 'plus'
}

export function realAmplitudes(
  tape: QuantumTape,
  params: number[] | QTensor,
  config: RealAmplitudesConfig = {}
): void {
  const numLayers = config.numLayers ?? 1
  const entanglement = config.entanglement ?? 'linear'
  const skipFinalRotation = config.skipFinalRotation ?? false

  const parameters = params instanceof QTensor
    ? Array.from(params.data)
    : params

  const defaultNumWires = Math.ceil(parameters.length / (numLayers + (skipFinalRotation ? 0 : 1)))
  const wires = config.wires ?? Array.from({ length: defaultNumWires }, (_, i) => i)
  const numWires = wires.length

  let paramIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numWires; i++) {
      const theta = parameters[paramIdx++] ?? 0
      ry(tape, wires[i], theta)
    }

    const pairs = getEntanglementPairs(numWires, entanglement, layer)
    for (const [i, j] of pairs) {
      cnot(tape, wires[i], wires[j])
    }
  }

  if (!skipFinalRotation) {
    for (let i = 0; i < numWires; i++) {
      const theta = parameters[paramIdx++] ?? 0
      ry(tape, wires[i], theta)
    }
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

export function realAmplitudesLinear(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  realAmplitudes(tape, params, {
    wires,
    numLayers,
    entanglement: 'linear'
  })
}

export function realAmplitudesCircular(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  realAmplitudes(tape, params, {
    wires,
    numLayers,
    entanglement: 'circular'
  })
}

export function realAmplitudesFull(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  realAmplitudes(tape, params, {
    wires,
    numLayers,
    entanglement: 'full'
  })
}

export function getRealAmplitudesParamCount(
  numWires: number,
  numLayers: number,
  skipFinalRotation: boolean = false
): number {
  const rotationLayers = numLayers + (skipFinalRotation ? 0 : 1)
  return numWires * rotationLayers
}

export function initRealAmplitudesParams(
  numWires: number,
  numLayers: number,
  initMethod: 'zeros' | 'random' | 'small_random' = 'small_random'
): number[] {
  const count = getRealAmplitudesParamCount(numWires, numLayers)

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
