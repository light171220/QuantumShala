import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { rx, ry, rz, H, cnot, cz, swap, rzz, rxx, ryy } from '../../circuit/operations/gates'

export type RotationGate = 'RX' | 'RY' | 'RZ' | 'H'
export type EntanglementGate = 'CX' | 'CZ' | 'SWAP' | 'RZZ' | 'RXX' | 'RYY'

export interface TwoLocalConfig {
  wires?: number[]
  numLayers?: number
  rotationBlocks?: RotationGate[]
  entanglementBlocks?: EntanglementGate[]
  entanglement?: 'linear' | 'circular' | 'full' | 'pairwise' | 'sca' | [number, number][]
  skipFinalRotation?: boolean
  skipUnentangledQubits?: boolean
  parameterPrefix?: string
}

export function twoLocal(
  tape: QuantumTape,
  params: number[] | QTensor,
  config: TwoLocalConfig = {}
): void {
  const numLayers = config.numLayers ?? 1
  const rotationBlocks = config.rotationBlocks ?? ['RY', 'RZ']
  const entanglementBlocks = config.entanglementBlocks ?? ['CX']
  const entanglement = config.entanglement ?? 'linear'
  const skipFinalRotation = config.skipFinalRotation ?? false

  const parameters = params instanceof QTensor
    ? Array.from(params.data)
    : params

  const parametricRotations = rotationBlocks.filter(g => g !== 'H')
  const parametricEntanglements = entanglementBlocks.filter(g =>
    ['RZZ', 'RXX', 'RYY'].includes(g)
  )

  const rotationParamsPerQubit = parametricRotations.length

  const numWires = config.wires?.length ?? inferNumWires(
    parameters.length,
    numLayers,
    rotationParamsPerQubit,
    parametricEntanglements.length,
    entanglement,
    skipFinalRotation
  )

  const wires = config.wires ?? Array.from({ length: numWires }, (_, i) => i)

  let paramIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numWires; i++) {
      for (const gate of rotationBlocks) {
        applyRotationGate(tape, wires[i], gate, parameters, paramIdx)
        if (gate !== 'H') {
          paramIdx++
        }
      }
    }

    const pairs = getEntanglementPairs(numWires, entanglement, layer)

    for (const [i, j] of pairs) {
      for (const gate of entanglementBlocks) {
        paramIdx = applyEntanglementGate(tape, wires[i], wires[j], gate, parameters, paramIdx)
      }
    }
  }

  if (!skipFinalRotation) {
    for (let i = 0; i < numWires; i++) {
      for (const gate of rotationBlocks) {
        applyRotationGate(tape, wires[i], gate, parameters, paramIdx)
        if (gate !== 'H') {
          paramIdx++
        }
      }
    }
  }
}

function applyRotationGate(
  tape: QuantumTape,
  wire: number,
  gate: RotationGate,
  params: number[],
  paramIdx: number
): void {
  switch (gate) {
    case 'RX':
      rx(tape, wire, params[paramIdx] ?? 0)
      break
    case 'RY':
      ry(tape, wire, params[paramIdx] ?? 0)
      break
    case 'RZ':
      rz(tape, wire, params[paramIdx] ?? 0)
      break
    case 'H':
      H(tape, wire)
      break
  }
}

function applyEntanglementGate(
  tape: QuantumTape,
  wire1: number,
  wire2: number,
  gate: EntanglementGate,
  params: number[],
  paramIdx: number
): number {
  switch (gate) {
    case 'CX':
      cnot(tape, wire1, wire2)
      return paramIdx
    case 'CZ':
      cz(tape, wire1, wire2)
      return paramIdx
    case 'SWAP':
      swap(tape, wire1, wire2)
      return paramIdx
    case 'RZZ':
      rzz(tape, wire1, wire2, params[paramIdx] ?? 0)
      return paramIdx + 1
    case 'RXX':
      rxx(tape, wire1, wire2, params[paramIdx] ?? 0)
      return paramIdx + 1
    case 'RYY':
      ryy(tape, wire1, wire2, params[paramIdx] ?? 0)
      return paramIdx + 1
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

function inferNumWires(
  numParams: number,
  numLayers: number,
  rotationParamsPerQubit: number,
  entanglementParamsPerPair: number,
  entanglement: 'linear' | 'circular' | 'full' | 'pairwise' | 'sca' | [number, number][],
  skipFinalRotation: boolean
): number {
  for (let n = 1; n <= 20; n++) {
    const count = getTwoLocalParamCount(
      n,
      numLayers,
      rotationParamsPerQubit,
      entanglementParamsPerPair,
      entanglement,
      skipFinalRotation
    )
    if (count >= numParams) {
      return n
    }
  }
  return Math.ceil(Math.sqrt(numParams))
}

export function getTwoLocalParamCount(
  numWires: number,
  numLayers: number,
  rotationParamsPerQubit: number = 2,
  entanglementParamsPerPair: number = 0,
  entanglement: 'linear' | 'circular' | 'full' | 'pairwise' | 'sca' | [number, number][] = 'linear',
  skipFinalRotation: boolean = false
): number {
  const rotationLayers = numLayers + (skipFinalRotation ? 0 : 1)
  const rotationParams = numWires * rotationLayers * rotationParamsPerQubit

  let numPairs: number
  if (Array.isArray(entanglement)) {
    numPairs = entanglement.length
  } else {
    switch (entanglement) {
      case 'linear':
        numPairs = numWires - 1
        break
      case 'circular':
        numPairs = numWires
        break
      case 'full':
        numPairs = (numWires * (numWires - 1)) / 2
        break
      case 'pairwise':
        numPairs = Math.floor(numWires / 2)
        break
      case 'sca':
        numPairs = numWires - 1
        break
    }
  }

  const entanglementParams = numLayers * numPairs * entanglementParamsPerPair

  return rotationParams + entanglementParams
}

export function excitationPreserving(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  twoLocal(tape, params, {
    wires,
    numLayers,
    rotationBlocks: ['RZ'],
    entanglementBlocks: ['RXX', 'RYY'],
    entanglement: 'linear'
  })
}

export function hardwareEfficient(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  twoLocal(tape, params, {
    wires,
    numLayers,
    rotationBlocks: ['RY', 'RZ'],
    entanglementBlocks: ['CX'],
    entanglement: 'linear'
  })
}

export function initTwoLocalParams(
  numWires: number,
  numLayers: number,
  config: Partial<TwoLocalConfig> = {},
  initMethod: 'zeros' | 'random' | 'small_random' = 'small_random'
): number[] {
  const rotationBlocks = config.rotationBlocks ?? ['RY', 'RZ']
  const entanglementBlocks = config.entanglementBlocks ?? ['CX']

  const rotationParamsPerQubit = rotationBlocks.filter(g => g !== 'H').length
  const entanglementParamsPerPair = entanglementBlocks.filter(g =>
    ['RZZ', 'RXX', 'RYY'].includes(g)
  ).length

  const count = getTwoLocalParamCount(
    numWires,
    numLayers,
    rotationParamsPerQubit,
    entanglementParamsPerPair,
    config.entanglement ?? 'linear',
    config.skipFinalRotation ?? false
  )

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
