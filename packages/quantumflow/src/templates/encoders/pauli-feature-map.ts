import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { H, rz, rx, ry, cnot, cz } from '../../circuit/operations/gates'

export type PauliString = ('I' | 'X' | 'Y' | 'Z')[]

export interface PauliFeatureMapConfig {
  wires?: number[]
  numLayers?: number
  paulis?: PauliString[]
  entanglement?: 'linear' | 'circular' | 'full' | 'pairwise' | [number, number][]
  alpha?: number
  dataMapFunc?: (x: number) => number
}

export function pauliFeatureMap(
  tape: QuantumTape,
  data: number[] | QTensor,
  config: PauliFeatureMapConfig = {}
): void {
  const numLayers = config.numLayers ?? 2
  const alpha = config.alpha ?? 2.0

  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const numFeatures = features.length
  const wires = config.wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  const paulis = config.paulis ?? [['Z'], ['Z', 'Z']] as PauliString[]

  const dataMapFunc = config.dataMapFunc ?? ((x: number) => x)

  const entanglement = config.entanglement ?? 'full'

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numFeatures; i++) {
      H(tape, wires[i])
    }

    for (const pauliString of paulis) {
      if (pauliString.length === 1) {
        applySingleQubitPauliRotation(
          tape,
          features,
          wires,
          pauliString[0],
          alpha,
          dataMapFunc
        )
      } else if (pauliString.length === 2) {
        const pairs = getEntanglementPairs(numFeatures, entanglement)
        applyTwoQubitPauliRotation(
          tape,
          features,
          wires,
          pairs,
          pauliString as [string, string],
          alpha,
          dataMapFunc
        )
      }
    }
  }
}

function applySingleQubitPauliRotation(
  tape: QuantumTape,
  features: number[],
  wires: number[],
  pauli: string,
  alpha: number,
  dataMapFunc: (x: number) => number
): void {
  for (let i = 0; i < features.length; i++) {
    const phi = alpha * dataMapFunc(features[i])

    switch (pauli) {
      case 'X':
        H(tape, wires[i])
        rz(tape, wires[i], phi)
        H(tape, wires[i])
        break
      case 'Y':
        rx(tape, wires[i], Math.PI / 2)
        rz(tape, wires[i], phi)
        rx(tape, wires[i], -Math.PI / 2)
        break
      case 'Z':
        rz(tape, wires[i], phi)
        break
    }
  }
}

function applyTwoQubitPauliRotation(
  tape: QuantumTape,
  features: number[],
  wires: number[],
  pairs: [number, number][],
  paulis: [string, string],
  alpha: number,
  dataMapFunc: (x: number) => number
): void {
  for (const [i, j] of pairs) {
    if (i >= features.length || j >= features.length) continue

    const phi = alpha * (Math.PI - dataMapFunc(features[i])) * (Math.PI - dataMapFunc(features[j]))

    applyPauliBasisChange(tape, wires[i], paulis[0], true)
    applyPauliBasisChange(tape, wires[j], paulis[1], true)

    cnot(tape, wires[i], wires[j])
    rz(tape, wires[j], phi)
    cnot(tape, wires[i], wires[j])

    applyPauliBasisChange(tape, wires[j], paulis[1], false)
    applyPauliBasisChange(tape, wires[i], paulis[0], false)
  }
}

function applyPauliBasisChange(
  tape: QuantumTape,
  wire: number,
  pauli: string,
  forward: boolean
): void {
  const sign = forward ? 1 : -1

  switch (pauli) {
    case 'X':
      if (forward) {
        H(tape, wire)
      } else {
        H(tape, wire)
      }
      break
    case 'Y':
      rx(tape, wire, sign * Math.PI / 2)
      break
    case 'Z':
      break
  }
}

function getEntanglementPairs(
  numQubits: number,
  entanglement: 'linear' | 'circular' | 'full' | 'pairwise' | [number, number][]
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
      for (let i = 0; i < numQubits - 1; i += 2) {
        pairs.push([i, i + 1])
      }
      break
  }

  return pairs
}

export function zFeatureMap(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number = 2,
  wires?: number[]
): void {
  pauliFeatureMap(tape, data, {
    wires,
    numLayers,
    paulis: [['Z']],
    entanglement: 'linear'
  })
}

export function zzFeatureMapAlias(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number = 2,
  wires?: number[]
): void {
  pauliFeatureMap(tape, data, {
    wires,
    numLayers,
    paulis: [['Z'], ['Z', 'Z']],
    entanglement: 'full'
  })
}

export function xxFeatureMap(
  tape: QuantumTape,
  data: number[] | QTensor,
  numLayers: number = 2,
  wires?: number[]
): void {
  pauliFeatureMap(tape, data, {
    wires,
    numLayers,
    paulis: [['X'], ['X', 'X']],
    entanglement: 'full'
  })
}

export function customPauliFeatureMap(
  tape: QuantumTape,
  data: number[] | QTensor,
  pauliStrings: string[],
  numLayers: number = 2,
  wires?: number[]
): void {
  const paulis = pauliStrings.map(s => s.split('') as PauliString)
  pauliFeatureMap(tape, data, {
    wires,
    numLayers,
    paulis
  })
}
