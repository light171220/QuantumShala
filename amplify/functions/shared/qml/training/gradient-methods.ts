import { Circuit, executeCircuit } from '../../quantum-core'

export type CostFunction = (params: number[]) => number

export function computeParameterShiftGradient(
  circuit: Circuit,
  params: number[],
  costFn: CostFunction,
  shift: number = Math.PI / 2
): number[] {
  const gradients: number[] = []

  for (let i = 0; i < params.length; i++) {
    const paramsPlus = [...params]
    const paramsMinus = [...params]
    paramsPlus[i] += shift
    paramsMinus[i] -= shift

    const costPlus = costFn(paramsPlus)
    const costMinus = costFn(paramsMinus)

    gradients.push((costPlus - costMinus) / (2 * Math.sin(shift)))
  }

  return gradients
}

export function computeFiniteDiffGradient(
  params: number[],
  costFn: CostFunction,
  epsilon: number = 1e-7
): number[] {
  const gradients: number[] = []
  const f0 = costFn(params)

  for (let i = 0; i < params.length; i++) {
    const paramsPlus = [...params]
    paramsPlus[i] += epsilon

    const fPlus = costFn(paramsPlus)
    gradients.push((fPlus - f0) / epsilon)
  }

  return gradients
}

export function computeAdjointGradient(
  circuit: Circuit,
  params: number[],
  observable: number[][]
): number[] {
  circuit.setParameters(params)
  const state = executeCircuit(circuit)
  const stateVector = state.toArray()

  const observableState = applyObservable(stateVector, observable)

  const gradients: number[] = []
  const shift = Math.PI / 2

  for (let i = 0; i < params.length; i++) {
    const paramsPlus = [...params]
    const paramsMinus = [...params]
    paramsPlus[i] += shift
    paramsMinus[i] -= shift

    const circuitPlus = circuit.clone()
    const circuitMinus = circuit.clone()
    circuitPlus.setParameters(paramsPlus)
    circuitMinus.setParameters(paramsMinus)

    const statePlus = executeCircuit(circuitPlus).toArray()
    const stateMinus = executeCircuit(circuitMinus).toArray()

    const expPlus = computeExpectationValue(statePlus, observableState)
    const expMinus = computeExpectationValue(stateMinus, observableState)

    gradients.push((expPlus - expMinus) / 2)
  }

  return gradients
}

function applyObservable(state: { re: number; im: number }[], observable: number[][]): { re: number; im: number }[] {
  const n = state.length
  const result: { re: number; im: number }[] = []

  for (let i = 0; i < n; i++) {
    let re = 0
    let im = 0
    for (let j = 0; j < n; j++) {
      re += observable[i][j] * state[j].re
      im += observable[i][j] * state[j].im
    }
    result.push({ re, im })
  }

  return result
}

function computeExpectationValue(
  state: { re: number; im: number }[],
  observableState: { re: number; im: number }[]
): number {
  let result = 0

  for (let i = 0; i < state.length; i++) {
    result += state[i].re * observableState[i].re + state[i].im * observableState[i].im
  }

  return result
}

export function computeNaturalGradient(
  circuit: Circuit,
  params: number[],
  costFn: CostFunction,
  regularization: number = 0.001
): number[] {
  const vanillaGrad = computeParameterShiftGradient(circuit, params, costFn)
  const qfi = computeQuantumFisherInformation(circuit, params)

  const n = params.length
  for (let i = 0; i < n; i++) {
    qfi[i][i] += regularization
  }

  const qfiInv = invertMatrix(qfi)
  const naturalGrad: number[] = []

  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j < n; j++) {
      sum += qfiInv[i][j] * vanillaGrad[j]
    }
    naturalGrad.push(sum)
  }

  return naturalGrad
}

function computeQuantumFisherInformation(circuit: Circuit, params: number[]): number[][] {
  const n = params.length
  const qfi: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
  const shift = Math.PI / 2

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const fij = computeFidelityDerivative(circuit, params, i, j, shift)
      qfi[i][j] = fij
      qfi[j][i] = fij
    }
  }

  return qfi
}

function computeFidelityDerivative(
  circuit: Circuit,
  params: number[],
  i: number,
  j: number,
  shift: number
): number {
  const variations = [
    [shift, shift],
    [shift, -shift],
    [-shift, shift],
    [-shift, -shift],
  ]

  let result = 0

  for (const [di, dj] of variations) {
    const newParams = [...params]
    newParams[i] += di
    newParams[j] += dj

    const c = circuit.clone()
    c.setParameters(newParams)
    const state = executeCircuit(c)

    const sign = Math.sign(di) * Math.sign(dj)
    result += sign * computeStateFidelity(state, params, circuit)
  }

  return -result / 8
}

function computeStateFidelity(state: any, refParams: number[], circuit: Circuit): number {
  const refCircuit = circuit.clone()
  refCircuit.setParameters(refParams)
  const refState = executeCircuit(refCircuit)

  const stateAmps = state.toArray()
  const refAmps = refState.toArray()

  let overlapRe = 0
  let overlapIm = 0
  for (let i = 0; i < stateAmps.length; i++) {
    overlapRe += stateAmps[i].re * refAmps[i].re + stateAmps[i].im * refAmps[i].im
    overlapIm += stateAmps[i].re * refAmps[i].im - stateAmps[i].im * refAmps[i].re
  }

  return overlapRe * overlapRe + overlapIm * overlapIm
}

function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length
  const augmented: number[][] = matrix.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0)),
  ])

  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]

    const pivot = augmented[i][i]
    if (Math.abs(pivot) < 1e-10) {
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] = 0
      }
      augmented[i][n + i] = 1
      continue
    }

    for (let j = 0; j < 2 * n; j++) {
      augmented[i][j] /= pivot
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = augmented[k][i]
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j]
        }
      }
    }
  }

  return augmented.map(row => row.slice(n))
}
