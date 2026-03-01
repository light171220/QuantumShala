export interface ReadoutError {
  qubit: number
  p0Given1: number
  p1Given0: number
}

export interface CalibrationMatrix {
  numQubits: number
  matrix: number[][]
  inverse: number[][]
}

export interface MitigatedCounts {
  originalCounts: Record<string, number>
  mitigatedCounts: Record<string, number>
  totalShots: number
  mitigationApplied: boolean
}

export class ReadoutErrorMitigation {
  private calibrationMatrix: CalibrationMatrix | null = null
  private qubitErrors: ReadoutError[] = []

  setQubitErrors(errors: ReadoutError[]): void {
    this.qubitErrors = errors
    this.calibrationMatrix = null
  }

  calibrate(numQubits: number, errorRate: number = 0.02): void {
    this.qubitErrors = []

    for (let q = 0; q < numQubits; q++) {
      const p01 = errorRate * (0.8 + 0.4 * Math.random())
      const p10 = errorRate * (0.8 + 0.4 * Math.random())

      this.qubitErrors.push({
        qubit: q,
        p0Given1: p10,
        p1Given0: p01
      })
    }

    this.buildCalibrationMatrix(numQubits)
  }

  private buildCalibrationMatrix(numQubits: number): void {
    const dim = Math.pow(2, numQubits)
    const matrix: number[][] = []

    for (let i = 0; i < dim; i++) {
      matrix.push(new Array(dim).fill(0))
    }

    for (let measured = 0; measured < dim; measured++) {
      for (let actual = 0; actual < dim; actual++) {
        let probability = 1

        for (let q = 0; q < numQubits; q++) {
          const actualBit = (actual >> q) & 1
          const measuredBit = (measured >> q) & 1
          const error = this.qubitErrors[q]

          if (actualBit === 0 && measuredBit === 0) {
            probability *= 1 - error.p1Given0
          } else if (actualBit === 0 && measuredBit === 1) {
            probability *= error.p1Given0
          } else if (actualBit === 1 && measuredBit === 0) {
            probability *= error.p0Given1
          } else {
            probability *= 1 - error.p0Given1
          }
        }

        matrix[measured][actual] = probability
      }
    }

    const inverse = this.invertMatrix(matrix)

    this.calibrationMatrix = {
      numQubits,
      matrix,
      inverse
    }
  }

  private invertMatrix(matrix: number[][]): number[][] {
    const n = matrix.length
    const augmented = matrix.map((row, i) => {
      const identityRow = new Array(n).fill(0)
      identityRow[i] = 1
      return [...row, ...identityRow]
    })

    for (let col = 0; col < n; col++) {
      let maxRow = col
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
          maxRow = row
        }
      }
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]]

      const pivot = augmented[col][col]
      if (Math.abs(pivot) < 1e-10) continue

      for (let j = 0; j < 2 * n; j++) {
        augmented[col][j] /= pivot
      }

      for (let row = 0; row < n; row++) {
        if (row !== col) {
          const factor = augmented[row][col]
          for (let j = 0; j < 2 * n; j++) {
            augmented[row][j] -= factor * augmented[col][j]
          }
        }
      }
    }

    return augmented.map(row => row.slice(n))
  }

  mitigate(counts: Record<string, number>): MitigatedCounts {
    if (!this.calibrationMatrix) {
      return {
        originalCounts: counts,
        mitigatedCounts: counts,
        totalShots: Object.values(counts).reduce((a, b) => a + b, 0),
        mitigationApplied: false
      }
    }

    const totalShots = Object.values(counts).reduce((a, b) => a + b, 0)
    const numQubits = this.calibrationMatrix.numQubits
    const dim = Math.pow(2, numQubits)

    const measuredVector = new Array(dim).fill(0)
    for (const [bitstring, count] of Object.entries(counts)) {
      const index = parseInt(bitstring, 2)
      if (index < dim) {
        measuredVector[index] = count / totalShots
      }
    }

    const mitigatedVector = new Array(dim).fill(0)
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        mitigatedVector[i] += this.calibrationMatrix.inverse[i][j] * measuredVector[j]
      }
    }

    for (let i = 0; i < dim; i++) {
      mitigatedVector[i] = Math.max(0, mitigatedVector[i])
    }

    const sum = mitigatedVector.reduce((a, b) => a + b, 0)
    if (sum > 0) {
      for (let i = 0; i < dim; i++) {
        mitigatedVector[i] /= sum
      }
    }

    const mitigatedCounts: Record<string, number> = {}
    for (let i = 0; i < dim; i++) {
      const count = Math.round(mitigatedVector[i] * totalShots)
      if (count > 0) {
        const bitstring = i.toString(2).padStart(numQubits, '0')
        mitigatedCounts[bitstring] = count
      }
    }

    return {
      originalCounts: counts,
      mitigatedCounts,
      totalShots,
      mitigationApplied: true
    }
  }

  mitigateExpectation(
    counts: Record<string, number>,
    pauliString: string
  ): { original: number; mitigated: number; correction: number } {
    const mitigated = this.mitigate(counts)

    const originalExpectation = this.computePauliExpectation(counts, pauliString)
    const mitigatedExpectation = this.computePauliExpectation(mitigated.mitigatedCounts, pauliString)

    return {
      original: originalExpectation,
      mitigated: mitigatedExpectation,
      correction: mitigatedExpectation - originalExpectation
    }
  }

  private computePauliExpectation(counts: Record<string, number>, pauliString: string): number {
    let expectation = 0
    let totalCounts = 0

    for (const [bitstring, count] of Object.entries(counts)) {
      totalCounts += count
      let parity = 1

      for (let i = 0; i < pauliString.length; i++) {
        const pauli = pauliString[i]
        const bit = bitstring[bitstring.length - 1 - i]

        if (pauli !== 'I' && bit === '1') {
          parity *= -1
        }
      }

      expectation += parity * count
    }

    return totalCounts > 0 ? expectation / totalCounts : 0
  }

  getCalibrationMatrix(): CalibrationMatrix | null {
    return this.calibrationMatrix
  }

  getQubitErrors(): ReadoutError[] {
    return [...this.qubitErrors]
  }
}

export class TensoredMitigation {
  private singleQubitMatrices: Map<number, { matrix: number[][]; inverse: number[][] }> = new Map()

  calibrateSingleQubit(qubit: number, p01: number, p10: number): void {
    const matrix = [
      [1 - p10, p01],
      [p10, 1 - p01]
    ]

    const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]
    const inverse = [
      [matrix[1][1] / det, -matrix[0][1] / det],
      [-matrix[1][0] / det, matrix[0][0] / det]
    ]

    this.singleQubitMatrices.set(qubit, { matrix, inverse })
  }

  mitigate(counts: Record<string, number>, numQubits: number): Record<string, number> {
    let current = counts

    for (let q = 0; q < numQubits; q++) {
      const calibration = this.singleQubitMatrices.get(q)
      if (calibration) {
        current = this.applySingleQubitMitigation(current, q, calibration.inverse, numQubits)
      }
    }

    return current
  }

  private applySingleQubitMitigation(
    counts: Record<string, number>,
    qubit: number,
    inverse: number[][],
    numQubits: number
  ): Record<string, number> {
    const totalShots = Object.values(counts).reduce((a, b) => a + b, 0)
    const mitigated: Record<string, number> = {}

    const groupedCounts: Map<string, { count0: number; count1: number }> = new Map()

    for (const [bitstring, count] of Object.entries(counts)) {
      const bit = bitstring[numQubits - 1 - qubit]
      const otherBits = bitstring.slice(0, numQubits - 1 - qubit) + '_' + bitstring.slice(numQubits - qubit)

      if (!groupedCounts.has(otherBits)) {
        groupedCounts.set(otherBits, { count0: 0, count1: 0 })
      }

      const group = groupedCounts.get(otherBits)!
      if (bit === '0') {
        group.count0 += count
      } else {
        group.count1 += count
      }
    }

    for (const [pattern, { count0, count1 }] of groupedCounts) {
      const prob0 = count0 / totalShots
      const prob1 = count1 / totalShots

      const mitigated0 = inverse[0][0] * prob0 + inverse[0][1] * prob1
      const mitigated1 = inverse[1][0] * prob0 + inverse[1][1] * prob1

      const [before, after] = pattern.split('_')

      if (Math.max(0, mitigated0) > 1e-10) {
        const bitstring0 = before + '0' + after
        mitigated[bitstring0] = Math.round(Math.max(0, mitigated0) * totalShots)
      }
      if (Math.max(0, mitigated1) > 1e-10) {
        const bitstring1 = before + '1' + after
        mitigated[bitstring1] = Math.round(Math.max(0, mitigated1) * totalShots)
      }
    }

    return mitigated
  }
}

export function createReadoutMitigation(numQubits: number, errorRate: number = 0.02): ReadoutErrorMitigation {
  const mitigation = new ReadoutErrorMitigation()
  mitigation.calibrate(numQubits, errorRate)
  return mitigation
}

export function createTensoredMitigation(
  numQubits: number,
  errorRate: number = 0.02
): TensoredMitigation {
  const mitigation = new TensoredMitigation()

  for (let q = 0; q < numQubits; q++) {
    const p01 = errorRate * (0.8 + 0.4 * Math.random())
    const p10 = errorRate * (0.8 + 0.4 * Math.random())
    mitigation.calibrateSingleQubit(q, p01, p10)
  }

  return mitigation
}

export function simulateReadoutErrors(
  idealCounts: Record<string, number>,
  errorRate: number = 0.02
): Record<string, number> {
  const numQubits = Object.keys(idealCounts)[0]?.length || 0
  const noisyCounts: Record<string, number> = {}

  for (const [bitstring, count] of Object.entries(idealCounts)) {
    for (let shot = 0; shot < count; shot++) {
      let measured = ''

      for (let q = 0; q < numQubits; q++) {
        const actualBit = bitstring[q]

        if (Math.random() < errorRate) {
          measured += actualBit === '0' ? '1' : '0'
        } else {
          measured += actualBit
        }
      }

      noisyCounts[measured] = (noisyCounts[measured] || 0) + 1
    }
  }

  return noisyCounts
}
