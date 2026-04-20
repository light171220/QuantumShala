import type { SymmetryConfig, Complex } from '../types'
import { StateVector } from '../quantum-core/state-vector'

export function verifySymmetry(
  state: StateVector,
  numElectrons: number,
  config: SymmetryConfig
): boolean {
  if (!config.enabled) {
    return true
  }

  for (const symmetry of config.symmetries) {
    switch (symmetry) {
      case 'particle_number':
        if (!verifyParticleNumber(state, numElectrons)) {
          return false
        }
        break
      case 'spin_z':
        if (!verifySpinZ(state)) {
          return false
        }
        break
      case 'point_group':
        break
    }
  }

  return true
}

export function verifyParticleNumber(state: StateVector, expectedElectrons: number): boolean {
  const amplitudes = state.getAmplitudes()
  const dim = amplitudes.length / 2
  let correctSectorWeight = 0
  let totalWeight = 0

  for (let i = 0; i < dim; i++) {
    const re = amplitudes[2 * i]
    const im = amplitudes[2 * i + 1]
    const prob = re * re + im * im

    if (prob > 1e-10) {
      totalWeight += prob
      const numOnes = countOnes(i)
      if (numOnes === expectedElectrons) {
        correctSectorWeight += prob
      }
    }
  }

  const ratio = correctSectorWeight / totalWeight
  return ratio > 0.99
}

export function verifySpinZ(state: StateVector, tolerance: number = 0.01): boolean {
  const amplitudes = state.getAmplitudes()
  const dim = amplitudes.length / 2
  const numQubits = Math.log2(dim)

  if (numQubits % 2 !== 0) {
    return true
  }

  const halfQubits = numQubits / 2
  let spinUpWeight = 0
  let spinDownWeight = 0
  let totalWeight = 0

  for (let i = 0; i < dim; i++) {
    const re = amplitudes[2 * i]
    const im = amplitudes[2 * i + 1]
    const prob = re * re + im * im

    if (prob > 1e-10) {
      totalWeight += prob

      let spinUp = 0
      let spinDown = 0
      for (let q = 0; q < halfQubits; q++) {
        if ((i >> (2 * q)) & 1) spinUp++
        if ((i >> (2 * q + 1)) & 1) spinDown++
      }

      spinUpWeight += prob * spinUp
      spinDownWeight += prob * spinDown
    }
  }

  const netSpin = (spinUpWeight - spinDownWeight) / totalWeight
  return Math.abs(netSpin) < tolerance * numQubits
}

function countOnes(n: number): number {
  let count = 0
  while (n > 0) {
    count += n & 1
    n >>= 1
  }
  return count
}

export interface SymmetryProjector {
  numQubits: number
  targetSector: number
}

export function projectToParticleSector(
  state: StateVector,
  numElectrons: number
): StateVector {
  const amplitudes = state.getAmplitudes()
  const dim = amplitudes.length / 2
  const numQubits = Math.log2(dim)

  const projected = new StateVector(numQubits)
  const projectedAmps = projected.getAmplitudes()

  let normSquared = 0
  for (let i = 0; i < dim; i++) {
    const numOnes = countOnes(i)
    if (numOnes === numElectrons) {
      projectedAmps[2 * i] = amplitudes[2 * i]
      projectedAmps[2 * i + 1] = amplitudes[2 * i + 1]
      normSquared += amplitudes[2 * i] ** 2 + amplitudes[2 * i + 1] ** 2
    }
  }

  if (normSquared > 1e-10) {
    const norm = Math.sqrt(normSquared)
    for (let i = 0; i < dim; i++) {
      projectedAmps[2 * i] /= norm
      projectedAmps[2 * i + 1] /= norm
    }
  }

  return projected
}

export function measureParticleNumber(state: StateVector): { expected: number; variance: number } {
  const amplitudes = state.getAmplitudes()
  const dim = amplitudes.length / 2

  let expectedN = 0
  let expectedN2 = 0

  for (let i = 0; i < dim; i++) {
    const re = amplitudes[2 * i]
    const im = amplitudes[2 * i + 1]
    const prob = re * re + im * im

    if (prob > 1e-10) {
      const n = countOnes(i)
      expectedN += prob * n
      expectedN2 += prob * n * n
    }
  }

  return {
    expected: expectedN,
    variance: expectedN2 - expectedN * expectedN,
  }
}

export function measureSpinZ(state: StateVector): { expected: number; variance: number } {
  const amplitudes = state.getAmplitudes()
  const dim = amplitudes.length / 2
  const numQubits = Math.log2(dim)
  const halfQubits = Math.floor(numQubits / 2)

  let expectedSz = 0
  let expectedSz2 = 0

  for (let i = 0; i < dim; i++) {
    const re = amplitudes[2 * i]
    const im = amplitudes[2 * i + 1]
    const prob = re * re + im * im

    if (prob > 1e-10) {
      let spinUp = 0
      let spinDown = 0

      for (let q = 0; q < halfQubits; q++) {
        if ((i >> (2 * q)) & 1) spinUp++
        if ((i >> (2 * q + 1)) & 1) spinDown++
      }

      const sz = (spinUp - spinDown) / 2
      expectedSz += prob * sz
      expectedSz2 += prob * sz * sz
    }
  }

  return {
    expected: expectedSz,
    variance: expectedSz2 - expectedSz * expectedSz,
  }
}

export interface SymmetryAnalysis {
  particleNumber: { expected: number; variance: number; isGood: boolean }
  spinZ: { expected: number; variance: number; isGood: boolean }
  overallValid: boolean
}

export function analyzeSymmetries(
  state: StateVector,
  numElectrons: number,
  tolerance: number = 0.01
): SymmetryAnalysis {
  const particleNumber = measureParticleNumber(state)
  const spinZ = measureSpinZ(state)

  const particleGood = Math.abs(particleNumber.expected - numElectrons) < tolerance &&
                       particleNumber.variance < tolerance

  const spinGood = spinZ.variance < tolerance

  return {
    particleNumber: { ...particleNumber, isGood: particleGood },
    spinZ: { ...spinZ, isGood: spinGood },
    overallValid: particleGood && spinGood,
  }
}

export function penalizeSymmetryViolation(
  energy: number,
  state: StateVector,
  numElectrons: number,
  penalty: number = 10.0
): number {
  const analysis = analyzeSymmetries(state, numElectrons)

  let penaltyTerm = 0

  if (!analysis.particleNumber.isGood) {
    penaltyTerm += penalty * Math.abs(analysis.particleNumber.expected - numElectrons)
  }

  if (!analysis.spinZ.isGood) {
    penaltyTerm += penalty * Math.sqrt(analysis.spinZ.variance)
  }

  return energy + penaltyTerm
}

export function buildNumberOperator(numQubits: number): { qubit: number; coefficient: number }[] {
  const terms: { qubit: number; coefficient: number }[] = []
  for (let q = 0; q < numQubits; q++) {
    terms.push({ qubit: q, coefficient: 0.5 })
  }
  return terms
}

export function buildSpinZOperator(numQubits: number): { qubit: number; coefficient: number }[] {
  const terms: { qubit: number; coefficient: number }[] = []
  const halfQubits = Math.floor(numQubits / 2)

  for (let i = 0; i < halfQubits; i++) {
    terms.push({ qubit: 2 * i, coefficient: 0.25 })
    terms.push({ qubit: 2 * i + 1, coefficient: -0.25 })
  }

  return terms
}
