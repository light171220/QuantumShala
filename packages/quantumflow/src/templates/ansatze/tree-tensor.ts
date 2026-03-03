import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { ry, rz, cnot, cz, H } from '../../circuit/operations/gates'

export interface TreeTensorConfig {
  wires?: number[]
  unitaryType?: 'YZ' | 'ZYZ' | 'general'
  entanglementGate?: 'CX' | 'CZ'
  bottomUp?: boolean
}

export function treeTensor(
  tape: QuantumTape,
  params: number[] | QTensor,
  config: TreeTensorConfig = {}
): void {
  const unitaryType = config.unitaryType ?? 'YZ'
  const entanglementGate = config.entanglementGate ?? 'CX'
  const bottomUp = config.bottomUp ?? true

  const parameters = params instanceof QTensor
    ? Array.from(params.data)
    : params

  const paramsPerUnitary = unitaryType === 'ZYZ' ? 3 : unitaryType === 'general' ? 3 : 2

  const numWires = config.wires?.length ?? inferNumWiresFromParams(parameters.length, paramsPerUnitary)
  const wires = config.wires ?? Array.from({ length: numWires }, (_, i) => i)

  if (!isPowerOfTwo(numWires)) {
    throw new Error('Tree tensor network requires power-of-2 qubits')
  }

  let paramIdx = 0

  if (bottomUp) {
    paramIdx = applyBottomUp(tape, wires, parameters, paramIdx, unitaryType, entanglementGate)
  } else {
    paramIdx = applyTopDown(tape, wires, parameters, paramIdx, unitaryType, entanglementGate)
  }
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

function inferNumWiresFromParams(numParams: number, paramsPerUnitary: number): number {
  for (let n = 2; n <= 64; n *= 2) {
    const totalUnitaries = 2 * n - 1
    if (totalUnitaries * paramsPerUnitary >= numParams) {
      return n
    }
  }
  return 4
}

function applyBottomUp(
  tape: QuantumTape,
  wires: number[],
  params: number[],
  paramIdx: number,
  unitaryType: 'YZ' | 'ZYZ' | 'general',
  entanglementGate: 'CX' | 'CZ'
): number {
  const numWires = wires.length

  for (let i = 0; i < numWires; i++) {
    paramIdx = applyUnitary(tape, wires[i], params, paramIdx, unitaryType)
  }

  let currentWires = [...wires]

  while (currentWires.length > 1) {
    const nextWires: number[] = []

    for (let i = 0; i < currentWires.length; i += 2) {
      const wire1 = currentWires[i]
      const wire2 = currentWires[i + 1]

      if (entanglementGate === 'CX') {
        cnot(tape, wire1, wire2)
      } else {
        cz(tape, wire1, wire2)
      }

      paramIdx = applyUnitary(tape, wire2, params, paramIdx, unitaryType)

      nextWires.push(wire2)
    }

    currentWires = nextWires
  }

  return paramIdx
}

function applyTopDown(
  tape: QuantumTape,
  wires: number[],
  params: number[],
  paramIdx: number,
  unitaryType: 'YZ' | 'ZYZ' | 'general',
  entanglementGate: 'CX' | 'CZ'
): number {
  const numWires = wires.length
  const numLevels = Math.log2(numWires)

  let currentWires = [wires[0]]

  paramIdx = applyUnitary(tape, wires[0], params, paramIdx, unitaryType)

  for (let level = 0; level < numLevels; level++) {
    const nextWires: number[] = []

    for (const wire of currentWires) {
      const wireIdx = wires.indexOf(wire)
      const leftChild = wires[wireIdx]
      const rightChild = wires[wireIdx + Math.pow(2, numLevels - level - 1)]

      if (entanglementGate === 'CX') {
        cnot(tape, leftChild, rightChild)
      } else {
        cz(tape, leftChild, rightChild)
      }

      paramIdx = applyUnitary(tape, leftChild, params, paramIdx, unitaryType)
      paramIdx = applyUnitary(tape, rightChild, params, paramIdx, unitaryType)

      nextWires.push(leftChild, rightChild)
    }

    currentWires = nextWires
  }

  return paramIdx
}

function applyUnitary(
  tape: QuantumTape,
  wire: number,
  params: number[],
  paramIdx: number,
  unitaryType: 'YZ' | 'ZYZ' | 'general'
): number {
  switch (unitaryType) {
    case 'YZ':
      ry(tape, wire, params[paramIdx] ?? 0)
      rz(tape, wire, params[paramIdx + 1] ?? 0)
      return paramIdx + 2

    case 'ZYZ':
      rz(tape, wire, params[paramIdx] ?? 0)
      ry(tape, wire, params[paramIdx + 1] ?? 0)
      rz(tape, wire, params[paramIdx + 2] ?? 0)
      return paramIdx + 3

    case 'general':
      rz(tape, wire, params[paramIdx] ?? 0)
      ry(tape, wire, params[paramIdx + 1] ?? 0)
      rz(tape, wire, params[paramIdx + 2] ?? 0)
      return paramIdx + 3
  }
}

export function mera(
  tape: QuantumTape,
  params: number[] | QTensor,
  numLevels: number,
  wires?: number[]
): void {
  const parameters = params instanceof QTensor
    ? Array.from(params.data)
    : params

  const numWires = wires?.length ?? Math.pow(3, numLevels)
  const effectiveWires = wires ?? Array.from({ length: numWires }, (_, i) => i)

  let paramIdx = 0

  for (let i = 0; i < numWires; i++) {
    ry(tape, effectiveWires[i], parameters[paramIdx++] ?? 0)
    rz(tape, effectiveWires[i], parameters[paramIdx++] ?? 0)
  }

  for (let level = 0; level < numLevels; level++) {
    const stride = Math.pow(3, level)

    for (let i = 0; i < numWires - stride; i += 2 * stride) {
      const wire1 = effectiveWires[i]
      const wire2 = effectiveWires[i + stride]

      cnot(tape, wire1, wire2)
      ry(tape, wire1, parameters[paramIdx++] ?? 0)
      ry(tape, wire2, parameters[paramIdx++] ?? 0)
    }

    for (let i = stride; i < numWires - stride; i += 2 * stride) {
      const wire1 = effectiveWires[i]
      const wire2 = effectiveWires[i + stride]

      cnot(tape, wire1, wire2)
      ry(tape, wire1, parameters[paramIdx++] ?? 0)
      ry(tape, wire2, parameters[paramIdx++] ?? 0)
    }
  }
}

export function ttn(
  tape: QuantumTape,
  params: number[] | QTensor,
  wires?: number[]
): void {
  treeTensor(tape, params, { wires, bottomUp: true })
}

export function getTreeTensorParamCount(
  numWires: number,
  unitaryType: 'YZ' | 'ZYZ' | 'general' = 'YZ'
): number {
  if (!isPowerOfTwo(numWires)) {
    throw new Error('Tree tensor network requires power-of-2 qubits')
  }

  const paramsPerUnitary = unitaryType === 'ZYZ' || unitaryType === 'general' ? 3 : 2
  const totalUnitaries = 2 * numWires - 1

  return totalUnitaries * paramsPerUnitary
}

export function initTreeTensorParams(
  numWires: number,
  unitaryType: 'YZ' | 'ZYZ' | 'general' = 'YZ',
  initMethod: 'zeros' | 'random' | 'small_random' = 'small_random'
): number[] {
  const count = getTreeTensorParamCount(numWires, unitaryType)

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
