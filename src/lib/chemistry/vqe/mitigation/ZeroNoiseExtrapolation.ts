import type { QMLCircuit, QMLGate } from '@/lib/qml/core/QMLCircuit'

export type ExtrapolationMethod = 'linear' | 'richardson' | 'polynomial' | 'exponential'

export type FoldingMethod = 'global' | 'local' | 'odd'

export interface ZNEConfig {
  scaleFactors: number[]
  extrapolationMethod: ExtrapolationMethod
  foldingMethod: FoldingMethod
  numSamples?: number
}

export interface ZNEResult {
  mitigatedValue: number
  scaledValues: { scaleFactor: number; value: number }[]
  extrapolationCoefficients: number[]
  estimatedError: number
  r2Score: number
}

export class ZeroNoiseExtrapolation {
  private config: ZNEConfig

  constructor(config: Partial<ZNEConfig> = {}) {
    this.config = {
      scaleFactors: config.scaleFactors ?? [1, 2, 3],
      extrapolationMethod: config.extrapolationMethod ?? 'richardson',
      foldingMethod: config.foldingMethod ?? 'global',
      numSamples: config.numSamples ?? 100
    }
  }

  foldCircuit(circuit: QMLCircuit, scaleFactor: number): QMLCircuit {
    switch (this.config.foldingMethod) {
      case 'global':
        return this.globalFolding(circuit, scaleFactor)
      case 'local':
        return this.localFolding(circuit, scaleFactor)
      case 'odd':
        return this.oddFolding(circuit, scaleFactor)
      default:
        return this.globalFolding(circuit, scaleFactor)
    }
  }

  private globalFolding(circuit: QMLCircuit, scaleFactor: number): QMLCircuit {
    const foldedCircuit = circuit.clone()
    const numFolds = Math.floor((scaleFactor - 1) / 2)

    for (let fold = 0; fold < numFolds; fold++) {
      const gates = foldedCircuit.getGates()

      for (let i = gates.length - 1; i >= 0; i--) {
        const gate = gates[i]
        this.appendInverseGate(foldedCircuit, gate)
      }

      for (const gate of gates) {
        this.appendGate(foldedCircuit, gate)
      }
    }

    return foldedCircuit
  }

  private localFolding(circuit: QMLCircuit, scaleFactor: number): QMLCircuit {
    const foldedCircuit = circuit.clone()
    const gates = foldedCircuit.getGates()

    const foldProbability = (scaleFactor - 1) / (2 * gates.length)

    for (let i = gates.length - 1; i >= 0; i--) {
      if (Math.random() < foldProbability) {
        const gate = gates[i]
        this.appendInverseGate(foldedCircuit, gate)
        this.appendGate(foldedCircuit, gate)
      }
    }

    return foldedCircuit
  }

  private oddFolding(circuit: QMLCircuit, scaleFactor: number): QMLCircuit {
    if (scaleFactor % 2 === 0) {
      throw new Error('Odd folding requires odd scale factors')
    }

    const foldedCircuit = circuit.clone()
    const gates = foldedCircuit.getGates()
    const numCopies = Math.floor(scaleFactor / 2)

    for (let copy = 0; copy < numCopies; copy++) {
      for (let i = gates.length - 1; i >= 0; i--) {
        this.appendInverseGate(foldedCircuit, gates[i])
      }

      for (const gate of gates) {
        this.appendGate(foldedCircuit, gate)
      }
    }

    return foldedCircuit
  }

  private appendGate(circuit: QMLCircuit, gate: QMLGate): void {
    if (gate.parameterIds && gate.parameterIds.length > 0) {
      const params = circuit.getParameters()
      const param = params.find(p => gate.parameterIds?.includes(p.id))
      if (param) {
        const gateType = gate.type as 'Rx' | 'Ry' | 'Rz'
        circuit.addGate(gateType, gate.qubits, [param.value])
      }
    } else {
      circuit.addGate(gate.type, gate.qubits, gate.fixedParams)
    }
  }

  private appendInverseGate(circuit: QMLCircuit, gate: QMLGate): void {
    const inverseGate = this.getInverseGate(gate, circuit)
    circuit.addGate(inverseGate.type, inverseGate.qubits, inverseGate.params)
  }

  private getInverseGate(
    gate: QMLGate,
    circuit: QMLCircuit
  ): { type: string; qubits: number[]; params?: number[] } {
    let params = gate.fixedParams

    if (gate.parameterIds && gate.parameterIds.length > 0) {
      const circuitParams = circuit.getParameters()
      const param = circuitParams.find(p => gate.parameterIds?.includes(p.id))
      if (param) {
        params = [param.value]
      }
    }

    switch (gate.type) {
      case 'Rx':
      case 'Ry':
      case 'Rz':
        return {
          type: gate.type,
          qubits: gate.qubits,
          params: params ? params.map(p => -p) : undefined
        }

      case 'H':
      case 'X':
      case 'Y':
      case 'Z':
      case 'CNOT':
      case 'CX':
      case 'SWAP':
        return { type: gate.type, qubits: gate.qubits }

      case 'S':
        return { type: 'Sdg', qubits: gate.qubits }
      case 'Sdg':
        return { type: 'S', qubits: gate.qubits }

      case 'T':
        return { type: 'Tdg', qubits: gate.qubits }
      case 'Tdg':
        return { type: 'T', qubits: gate.qubits }

      default:
        return { type: gate.type, qubits: gate.qubits, params }
    }
  }

  extrapolate(scaledValues: { scaleFactor: number; value: number }[]): ZNEResult {
    switch (this.config.extrapolationMethod) {
      case 'linear':
        return this.linearExtrapolation(scaledValues)
      case 'richardson':
        return this.richardsonExtrapolation(scaledValues)
      case 'polynomial':
        return this.polynomialExtrapolation(scaledValues)
      case 'exponential':
        return this.exponentialExtrapolation(scaledValues)
      default:
        return this.richardsonExtrapolation(scaledValues)
    }
  }

  private linearExtrapolation(
    scaledValues: { scaleFactor: number; value: number }[]
  ): ZNEResult {
    const n = scaledValues.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0

    for (const { scaleFactor, value } of scaledValues) {
      sumX += scaleFactor
      sumY += value
      sumXY += scaleFactor * value
      sumX2 += scaleFactor * scaleFactor
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const mitigatedValue = intercept

    let ssRes = 0, ssTot = 0
    const meanY = sumY / n
    for (const { scaleFactor, value } of scaledValues) {
      const predicted = intercept + slope * scaleFactor
      ssRes += (value - predicted) ** 2
      ssTot += (value - meanY) ** 2
    }
    const r2Score = 1 - ssRes / (ssTot || 1)

    return {
      mitigatedValue,
      scaledValues,
      extrapolationCoefficients: [intercept, slope],
      estimatedError: Math.sqrt(ssRes / n),
      r2Score
    }
  }

  private richardsonExtrapolation(
    scaledValues: { scaleFactor: number; value: number }[]
  ): ZNEResult {
    const n = scaledValues.length
    const lambdas = scaledValues.map(sv => sv.scaleFactor)
    const values = scaledValues.map(sv => sv.value)

    const A: number[][] = []
    for (let i = 0; i < n; i++) {
      const row: number[] = []
      for (let j = 0; j < n; j++) {
        row.push(Math.pow(lambdas[i], j))
      }
      A.push(row)
    }

    const coeffs = this.solveLinearSystem(A, values)

    const mitigatedValue = coeffs[0]

    let ssRes = 0, ssTot = 0
    const meanY = values.reduce((a, b) => a + b, 0) / n
    for (let i = 0; i < n; i++) {
      let predicted = 0
      for (let j = 0; j < n; j++) {
        predicted += coeffs[j] * Math.pow(lambdas[i], j)
      }
      ssRes += (values[i] - predicted) ** 2
      ssTot += (values[i] - meanY) ** 2
    }
    const r2Score = 1 - ssRes / (ssTot || 1)

    return {
      mitigatedValue,
      scaledValues,
      extrapolationCoefficients: coeffs,
      estimatedError: Math.sqrt(ssRes / n),
      r2Score
    }
  }

  private polynomialExtrapolation(
    scaledValues: { scaleFactor: number; value: number }[]
  ): ZNEResult {
    const degree = Math.min(scaledValues.length - 1, 3)
    const n = scaledValues.length

    const A: number[][] = []
    const b: number[] = []

    for (let i = 0; i < n; i++) {
      const row: number[] = []
      for (let j = 0; j <= degree; j++) {
        row.push(Math.pow(scaledValues[i].scaleFactor, j))
      }
      A.push(row)
      b.push(scaledValues[i].value)
    }

    const AtA: number[][] = []
    const Atb: number[] = []

    for (let i = 0; i <= degree; i++) {
      AtA.push([])
      Atb.push(0)
      for (let j = 0; j <= degree; j++) {
        let sum = 0
        for (let k = 0; k < n; k++) {
          sum += A[k][i] * A[k][j]
        }
        AtA[i].push(sum)
      }
      for (let k = 0; k < n; k++) {
        Atb[i] += A[k][i] * b[k]
      }
    }

    const coeffs = this.solveLinearSystem(AtA, Atb)
    const mitigatedValue = coeffs[0]

    let ssRes = 0, ssTot = 0
    const meanY = b.reduce((a, c) => a + c, 0) / n
    for (let i = 0; i < n; i++) {
      let predicted = 0
      for (let j = 0; j <= degree; j++) {
        predicted += coeffs[j] * Math.pow(scaledValues[i].scaleFactor, j)
      }
      ssRes += (scaledValues[i].value - predicted) ** 2
      ssTot += (scaledValues[i].value - meanY) ** 2
    }
    const r2Score = 1 - ssRes / (ssTot || 1)

    return {
      mitigatedValue,
      scaledValues,
      extrapolationCoefficients: coeffs,
      estimatedError: Math.sqrt(ssRes / n),
      r2Score
    }
  }

  private exponentialExtrapolation(
    scaledValues: { scaleFactor: number; value: number }[]
  ): ZNEResult {
    const logValues = scaledValues.map(sv => ({
      scaleFactor: sv.scaleFactor,
      value: Math.log(Math.abs(sv.value) + 1e-10)
    }))

    const linearResult = this.linearExtrapolation(logValues)

    const a = Math.exp(linearResult.extrapolationCoefficients[0])
    const b = linearResult.extrapolationCoefficients[1]
    const mitigatedValue = a * Math.sign(scaledValues[0].value)

    return {
      mitigatedValue,
      scaledValues,
      extrapolationCoefficients: [a, b],
      estimatedError: linearResult.estimatedError,
      r2Score: linearResult.r2Score
    }
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = b.length
    const augmented = A.map((row, i) => [...row, b[i]])

    for (let col = 0; col < n; col++) {
      let maxRow = col
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
          maxRow = row
        }
      }
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]]

      for (let row = col + 1; row < n; row++) {
        const factor = augmented[row][col] / augmented[col][col]
        for (let j = col; j <= n; j++) {
          augmented[row][j] -= factor * augmented[col][j]
        }
      }
    }

    const x = new Array(n).fill(0)
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n]
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j]
      }
      x[i] /= augmented[i][i]
    }

    return x
  }
}

export function createZNE(config?: Partial<ZNEConfig>): ZeroNoiseExtrapolation {
  return new ZeroNoiseExtrapolation(config)
}

export function runZNE(
  circuit: QMLCircuit,
  expectationFunction: (c: QMLCircuit) => number,
  config?: Partial<ZNEConfig>
): ZNEResult {
  const zne = new ZeroNoiseExtrapolation(config)

  const scaleFactors = config?.scaleFactors ?? [1, 2, 3]
  const scaledValues: { scaleFactor: number; value: number }[] = []

  for (const scaleFactor of scaleFactors) {
    const foldedCircuit = zne.foldCircuit(circuit, scaleFactor)
    const value = expectationFunction(foldedCircuit)
    scaledValues.push({ scaleFactor, value })
  }

  return zne.extrapolate(scaledValues)
}

export function estimateOptimalScaleFactors(
  estimatedErrorRate: number,
  maxScaleFactor: number = 5
): number[] {
  const factors: number[] = [1]
  let current = 1

  while (current < maxScaleFactor) {
    current = Math.min(current + 2, maxScaleFactor)
    factors.push(current)
  }

  return factors
}
