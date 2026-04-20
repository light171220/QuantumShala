import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { ry, rz, rx, cnot, cz, H } from '../../circuit/operations/gates'

export interface QCNNConfig {
  wires?: number[]
  convolutionType?: 'u2' | 'u4' | 'ry_rz'
  poolingType?: 'measure' | 'controlled'
  numConvLayers?: number
}

export function qcnnAnsatz(
  tape: QuantumTape,
  params: number[] | QTensor,
  config: QCNNConfig = {}
): void {
  const convolutionType = config.convolutionType ?? 'ry_rz'
  const poolingType = config.poolingType ?? 'controlled'
  const numConvLayers = config.numConvLayers ?? 1

  const parameters = params instanceof QTensor
    ? Array.from(params.data)
    : params

  const numWires = config.wires?.length ?? inferNumWires(parameters.length, convolutionType, numConvLayers)
  const wires = config.wires ?? Array.from({ length: numWires }, (_, i) => i)

  if (!isPowerOfTwo(numWires)) {
    throw new Error('QCNN requires power-of-2 qubits')
  }

  let paramIdx = 0
  let currentWires = [...wires]

  while (currentWires.length > 1) {
    for (let conv = 0; conv < numConvLayers; conv++) {
      for (let i = 0; i < currentWires.length - 1; i += 2) {
        paramIdx = applyConvolution(
          tape,
          currentWires[i],
          currentWires[i + 1],
          parameters,
          paramIdx,
          convolutionType
        )
      }

      for (let i = 1; i < currentWires.length - 1; i += 2) {
        paramIdx = applyConvolution(
          tape,
          currentWires[i],
          currentWires[i + 1],
          parameters,
          paramIdx,
          convolutionType
        )
      }
    }

    const pooledWires: number[] = []
    for (let i = 0; i < currentWires.length; i += 2) {
      paramIdx = applyPooling(
        tape,
        currentWires[i],
        currentWires[i + 1],
        parameters,
        paramIdx,
        poolingType
      )
      pooledWires.push(currentWires[i + 1])
    }

    currentWires = pooledWires
  }

  if (currentWires.length === 1) {
    ry(tape, currentWires[0], parameters[paramIdx++] ?? 0)
    rz(tape, currentWires[0], parameters[paramIdx++] ?? 0)
  }
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

function inferNumWires(
  numParams: number,
  convolutionType: 'u2' | 'u4' | 'ry_rz',
  numConvLayers: number
): number {
  for (let n = 2; n <= 64; n *= 2) {
    const count = getQCNNParamCount(n, convolutionType, numConvLayers)
    if (count >= numParams) {
      return n
    }
  }
  return 4
}

function applyConvolution(
  tape: QuantumTape,
  wire1: number,
  wire2: number,
  params: number[],
  paramIdx: number,
  convType: 'u2' | 'u4' | 'ry_rz'
): number {
  switch (convType) {
    case 'ry_rz':
      ry(tape, wire1, params[paramIdx] ?? 0)
      rz(tape, wire1, params[paramIdx + 1] ?? 0)
      ry(tape, wire2, params[paramIdx + 2] ?? 0)
      rz(tape, wire2, params[paramIdx + 3] ?? 0)
      cnot(tape, wire1, wire2)
      ry(tape, wire1, params[paramIdx + 4] ?? 0)
      rz(tape, wire2, params[paramIdx + 5] ?? 0)
      return paramIdx + 6

    case 'u2':
      ry(tape, wire1, params[paramIdx] ?? 0)
      ry(tape, wire2, params[paramIdx + 1] ?? 0)
      cz(tape, wire1, wire2)
      ry(tape, wire1, params[paramIdx + 2] ?? 0)
      ry(tape, wire2, params[paramIdx + 3] ?? 0)
      return paramIdx + 4

    case 'u4':
      ry(tape, wire1, params[paramIdx] ?? 0)
      rz(tape, wire1, params[paramIdx + 1] ?? 0)
      ry(tape, wire2, params[paramIdx + 2] ?? 0)
      rz(tape, wire2, params[paramIdx + 3] ?? 0)
      cnot(tape, wire1, wire2)
      ry(tape, wire1, params[paramIdx + 4] ?? 0)
      rz(tape, wire1, params[paramIdx + 5] ?? 0)
      ry(tape, wire2, params[paramIdx + 6] ?? 0)
      rz(tape, wire2, params[paramIdx + 7] ?? 0)
      cnot(tape, wire2, wire1)
      ry(tape, wire1, params[paramIdx + 8] ?? 0)
      rz(tape, wire1, params[paramIdx + 9] ?? 0)
      ry(tape, wire2, params[paramIdx + 10] ?? 0)
      rz(tape, wire2, params[paramIdx + 11] ?? 0)
      cnot(tape, wire1, wire2)
      ry(tape, wire1, params[paramIdx + 12] ?? 0)
      rz(tape, wire1, params[paramIdx + 13] ?? 0)
      ry(tape, wire2, params[paramIdx + 14] ?? 0)
      return paramIdx + 15
  }
}

function applyPooling(
  tape: QuantumTape,
  wire1: number,
  wire2: number,
  params: number[],
  paramIdx: number,
  poolType: 'measure' | 'controlled'
): number {
  switch (poolType) {
    case 'controlled':
      cnot(tape, wire1, wire2)
      ry(tape, wire2, params[paramIdx] ?? 0)
      return paramIdx + 1

    case 'measure':
      cnot(tape, wire1, wire2)
      return paramIdx
  }
}

function getConvParamsPerPair(convType: 'u2' | 'u4' | 'ry_rz'): number {
  switch (convType) {
    case 'ry_rz':
      return 6
    case 'u2':
      return 4
    case 'u4':
      return 15
  }
}

export function qcnn(
  tape: QuantumTape,
  params: number[] | QTensor,
  wires?: number[]
): void {
  qcnnAnsatz(tape, params, { wires })
}

export function convolutionalLayer(
  tape: QuantumTape,
  params: number[] | QTensor,
  wires: number[],
  stride: number = 2
): void {
  const parameters = params instanceof QTensor
    ? Array.from(params.data)
    : params

  let paramIdx = 0

  for (let i = 0; i < wires.length - 1; i += stride) {
    const wire1 = wires[i]
    const wire2 = wires[i + 1]

    ry(tape, wire1, parameters[paramIdx++] ?? 0)
    rz(tape, wire1, parameters[paramIdx++] ?? 0)
    ry(tape, wire2, parameters[paramIdx++] ?? 0)
    rz(tape, wire2, parameters[paramIdx++] ?? 0)
    cnot(tape, wire1, wire2)
    ry(tape, wire1, parameters[paramIdx++] ?? 0)
    rz(tape, wire2, parameters[paramIdx++] ?? 0)
  }
}

export function poolingLayer(
  tape: QuantumTape,
  params: number[] | QTensor,
  wires: number[]
): number[] {
  const parameters = params instanceof QTensor
    ? Array.from(params.data)
    : params

  const outputWires: number[] = []
  let paramIdx = 0

  for (let i = 0; i < wires.length; i += 2) {
    const wire1 = wires[i]
    const wire2 = wires[i + 1]

    cnot(tape, wire1, wire2)
    ry(tape, wire2, parameters[paramIdx++] ?? 0)

    outputWires.push(wire2)
  }

  return outputWires
}

export function getQCNNParamCount(
  numWires: number,
  convolutionType: 'u2' | 'u4' | 'ry_rz' = 'ry_rz',
  numConvLayers: number = 1,
  poolingType: 'measure' | 'controlled' = 'controlled'
): number {
  if (!isPowerOfTwo(numWires)) {
    throw new Error('QCNN requires power-of-2 qubits')
  }

  const convParamsPerPair = getConvParamsPerPair(convolutionType)
  const poolParamsPerPair = poolingType === 'controlled' ? 1 : 0

  let totalParams = 0
  let currentWidth = numWires

  while (currentWidth > 1) {
    const numPairs = currentWidth / 2
    const convPairs = numConvLayers * (numPairs + Math.max(0, numPairs - 1))
    totalParams += convPairs * convParamsPerPair
    totalParams += numPairs * poolParamsPerPair
    currentWidth = currentWidth / 2
  }

  totalParams += 2

  return totalParams
}

export function initQCNNParams(
  numWires: number,
  convolutionType: 'u2' | 'u4' | 'ry_rz' = 'ry_rz',
  numConvLayers: number = 1,
  initMethod: 'zeros' | 'random' | 'small_random' = 'small_random'
): number[] {
  const count = getQCNNParamCount(numWires, convolutionType, numConvLayers)

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
