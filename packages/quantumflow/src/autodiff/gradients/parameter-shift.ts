import { QTensor } from '../../core/tensor'
import { QuantumTape, TapeOperation } from '../tape'

export interface ParameterShiftConfig {
  shiftAmount: number
  order: 1 | 2
  broadcastUnshifted: boolean
}

const DEFAULT_CONFIG: ParameterShiftConfig = {
  shiftAmount: Math.PI / 2,
  order: 1,
  broadcastUnshifted: true
}

export interface ShiftedTape {
  tape: QuantumTape
  multiplier: number
  paramIndex: number
  paramElementIndex: number
}

export function generateShiftedTapes(
  tape: QuantumTape,
  config: Partial<ParameterShiftConfig> = {}
): ShiftedTape[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const shiftedTapes: ShiftedTape[] = []
  const parametricOps = tape.getParametricOperations()

  let paramIndex = 0

  for (const record of parametricOps) {
    const op = record.operation

    for (let i = 0; i < op.params.length; i++) {
      const plusTape = tape.copy()
      const minusTape = tape.copy()

      const plusOps = plusTape.operations
      const minusOps = minusTape.operations

      for (let j = 0; j < plusOps.length; j++) {
        if (plusOps[j].operation.id === op.id) {
          plusOps[j].operation.params[i] = op.params[i] + cfg.shiftAmount
          minusOps[j].operation.params[i] = op.params[i] - cfg.shiftAmount
          break
        }
      }

      shiftedTapes.push({
        tape: plusTape,
        multiplier: 0.5,
        paramIndex,
        paramElementIndex: i
      })

      shiftedTapes.push({
        tape: minusTape,
        multiplier: -0.5,
        paramIndex,
        paramElementIndex: i
      })

      paramIndex++
    }

    for (let i = 0; i < op.paramTensors.length; i++) {
      const tensor = op.paramTensors[i]

      for (let j = 0; j < tensor.size; j++) {
        const plusTape = tape.copy()
        const minusTape = tape.copy()

        const plusOps = plusTape.operations
        const minusOps = minusTape.operations

        for (let k = 0; k < plusOps.length; k++) {
          if (plusOps[k].operation.id === op.id) {
            const plusTensor = plusOps[k].operation.paramTensors[i].clone()
            const minusTensor = minusOps[k].operation.paramTensors[i].clone()

            plusTensor.data[j] += cfg.shiftAmount
            minusTensor.data[j] -= cfg.shiftAmount

            plusOps[k].operation.paramTensors[i] = plusTensor
            minusOps[k].operation.paramTensors[i] = minusTensor
            break
          }
        }

        shiftedTapes.push({
          tape: plusTape,
          multiplier: 0.5,
          paramIndex,
          paramElementIndex: j
        })

        shiftedTapes.push({
          tape: minusTape,
          multiplier: -0.5,
          paramIndex,
          paramElementIndex: j
        })
      }

      paramIndex++
    }
  }

  return shiftedTapes
}

export function parameterShiftGradient(
  tape: QuantumTape,
  executeFunc: (t: QuantumTape) => number,
  config: Partial<ParameterShiftConfig> = {}
): number[] {
  const shiftedTapes = generateShiftedTapes(tape, config)
  const gradients: Map<number, number> = new Map()

  for (const shifted of shiftedTapes) {
    const result = executeFunc(shifted.tape)
    const currentGrad = gradients.get(shifted.paramIndex) ?? 0
    gradients.set(shifted.paramIndex, currentGrad + result * shifted.multiplier * 2)
  }

  const sortedKeys = Array.from(gradients.keys()).sort((a, b) => a - b)
  return sortedKeys.map(k => gradients.get(k)!)
}

export function parameterShiftGradientBatch(
  tape: QuantumTape,
  executeBatchFunc: (tapes: QuantumTape[]) => number[],
  config: Partial<ParameterShiftConfig> = {}
): number[] {
  const shiftedTapes = generateShiftedTapes(tape, config)
  const tapes = shiftedTapes.map(s => s.tape)
  const results = executeBatchFunc(tapes)

  const gradients: Map<number, number> = new Map()

  for (let i = 0; i < shiftedTapes.length; i++) {
    const shifted = shiftedTapes[i]
    const currentGrad = gradients.get(shifted.paramIndex) ?? 0
    gradients.set(shifted.paramIndex, currentGrad + results[i] * shifted.multiplier * 2)
  }

  const sortedKeys = Array.from(gradients.keys()).sort((a, b) => a - b)
  return sortedKeys.map(k => gradients.get(k)!)
}

export function secondOrderParameterShift(
  tape: QuantumTape,
  executeFunc: (t: QuantumTape) => number,
  paramIndex1: number,
  paramIndex2: number,
  shiftAmount: number = Math.PI / 2
): number {
  const parametricOps = tape.getParametricOperations()
  const ops = tape.operations

  let param1Found = false
  let param2Found = false
  let param1OpIdx = -1
  let param1ParamIdx = -1
  let param2OpIdx = -1
  let param2ParamIdx = -1

  let currentParamIdx = 0
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i].operation
    for (let j = 0; j < op.params.length; j++) {
      if (currentParamIdx === paramIndex1) {
        param1OpIdx = i
        param1ParamIdx = j
        param1Found = true
      }
      if (currentParamIdx === paramIndex2) {
        param2OpIdx = i
        param2ParamIdx = j
        param2Found = true
      }
      currentParamIdx++
    }
  }

  if (!param1Found || !param2Found) {
    throw new Error('Parameter indices out of range')
  }

  const createShiftedTape = (shift1: number, shift2: number): QuantumTape => {
    const newTape = tape.copy()
    const newOps = newTape.operations
    newOps[param1OpIdx].operation.params[param1ParamIdx] += shift1
    newOps[param2OpIdx].operation.params[param2ParamIdx] += shift2
    return newTape
  }

  const fPlusPlus = executeFunc(createShiftedTape(shiftAmount, shiftAmount))
  const fPlusMinus = executeFunc(createShiftedTape(shiftAmount, -shiftAmount))
  const fMinusPlus = executeFunc(createShiftedTape(-shiftAmount, shiftAmount))
  const fMinusMinus = executeFunc(createShiftedTape(-shiftAmount, -shiftAmount))

  return (fPlusPlus - fPlusMinus - fMinusPlus + fMinusMinus) / 4
}

export function hessianParameterShift(
  tape: QuantumTape,
  executeFunc: (t: QuantumTape) => number
): number[][] {
  const numParams = tape.numParameters
  const hessian: number[][] = []

  for (let i = 0; i < numParams; i++) {
    hessian[i] = []
    for (let j = 0; j < numParams; j++) {
      hessian[i][j] = secondOrderParameterShift(tape, executeFunc, i, j)
    }
  }

  return hessian
}

export function generalizedParameterShift(
  tape: QuantumTape,
  executeFunc: (t: QuantumTape) => number,
  frequencies: number[]
): number[] {
  const parametricOps = tape.getParametricOperations()
  const numParams = tape.numParameters

  if (frequencies.length !== numParams) {
    throw new Error('Number of frequencies must match number of parameters')
  }

  const gradients: number[] = []

  let paramIdx = 0
  for (const record of parametricOps) {
    const op = record.operation

    for (let i = 0; i < op.params.length; i++) {
      const freq = frequencies[paramIdx]
      const shift = Math.PI / (4 * freq)

      const plusTape = tape.copy()
      const minusTape = tape.copy()

      const plusOps = plusTape.operations
      const minusOps = minusTape.operations

      for (let j = 0; j < plusOps.length; j++) {
        if (plusOps[j].operation.id === op.id) {
          plusOps[j].operation.params[i] = op.params[i] + shift
          minusOps[j].operation.params[i] = op.params[i] - shift
          break
        }
      }

      const fPlus = executeFunc(plusTape)
      const fMinus = executeFunc(minusTape)

      gradients.push(freq * (fPlus - fMinus))

      paramIdx++
    }
  }

  return gradients
}

export function stochasticParameterShift(
  tape: QuantumTape,
  executeFunc: (t: QuantumTape) => number,
  numSamples: number = 1,
  shiftAmount: number = Math.PI / 2
): number[] {
  const numParams = tape.numParameters
  const gradients: number[] = new Array(numParams).fill(0)

  for (let sample = 0; sample < numSamples; sample++) {
    const paramIdx = Math.floor(Math.random() * numParams)
    const direction = Math.random() < 0.5 ? 1 : -1

    const shiftedTape = tape.copy()
    const ops = shiftedTape.operations

    let currentIdx = 0
    for (const op of ops) {
      for (let i = 0; i < op.operation.params.length; i++) {
        if (currentIdx === paramIdx) {
          op.operation.params[i] += direction * shiftAmount
        }
        currentIdx++
      }
    }

    const originalResult = executeFunc(tape)
    const shiftedResult = executeFunc(shiftedTape)

    gradients[paramIdx] += direction * (shiftedResult - originalResult) / shiftAmount
  }

  for (let i = 0; i < numParams; i++) {
    gradients[i] *= numParams / numSamples
  }

  return gradients
}
