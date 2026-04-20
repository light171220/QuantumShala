import type { PauliOperator } from './PauliPool'
import { createPauliOperator } from './PauliPool'
import { jordanWignerExcitation, jordanWignerDoubleExcitation } from './JordanWigner'

export interface ExcitationOperator {
  type: 'single' | 'double'
  from: number[]
  to: number[]
  coefficient: number
  label: string
}

export interface UCCOperatorPool {
  singles: ExcitationOperator[]
  doubles: ExcitationOperator[]
  numQubits: number
  numElectrons: number
  numOrbitals: number
}

export function generateSingleExcitations(
  numOrbitals: number,
  numElectrons: number
): ExcitationOperator[] {
  const occupied = Array.from({ length: numElectrons }, (_, i) => i)
  const virtual = Array.from({ length: numOrbitals - numElectrons }, (_, i) => i + numElectrons)

  const excitations: ExcitationOperator[] = []

  for (const i of occupied) {
    for (const a of virtual) {
      excitations.push({
        type: 'single',
        from: [i],
        to: [a],
        coefficient: 1.0,
        label: `S_${i}→${a}`
      })
    }
  }

  return excitations
}

export function generateDoubleExcitations(
  numOrbitals: number,
  numElectrons: number
): ExcitationOperator[] {
  const occupied = Array.from({ length: numElectrons }, (_, i) => i)
  const virtual = Array.from({ length: numOrbitals - numElectrons }, (_, i) => i + numElectrons)

  const excitations: ExcitationOperator[] = []

  for (let i = 0; i < occupied.length; i++) {
    for (let j = i + 1; j < occupied.length; j++) {
      for (let a = 0; a < virtual.length; a++) {
        for (let b = a + 1; b < virtual.length; b++) {
          excitations.push({
            type: 'double',
            from: [occupied[i], occupied[j]],
            to: [virtual[a], virtual[b]],
            coefficient: 1.0,
            label: `D_${occupied[i]}${occupied[j]}→${virtual[a]}${virtual[b]}`
          })
        }
      }
    }
  }

  return excitations
}

export function generateUCCSDPool(numOrbitals: number, numElectrons: number): UCCOperatorPool {
  return {
    singles: generateSingleExcitations(numOrbitals, numElectrons),
    doubles: generateDoubleExcitations(numOrbitals, numElectrons),
    numQubits: numOrbitals,
    numElectrons,
    numOrbitals
  }
}

export function generateSpinAdaptedSingles(
  numSpatialOrbitals: number,
  numElectrons: number
): ExcitationOperator[] {
  const numAlpha = Math.ceil(numElectrons / 2)
  const numBeta = Math.floor(numElectrons / 2)

  const occupiedAlpha = Array.from({ length: numAlpha }, (_, i) => 2 * i)
  const occupiedBeta = Array.from({ length: numBeta }, (_, i) => 2 * i + 1)
  const virtualAlpha = Array.from(
    { length: numSpatialOrbitals - numAlpha },
    (_, i) => 2 * (i + numAlpha)
  )
  const virtualBeta = Array.from(
    { length: numSpatialOrbitals - numBeta },
    (_, i) => 2 * (i + numBeta) + 1
  )

  const excitations: ExcitationOperator[] = []

  for (const i of occupiedAlpha) {
    for (const a of virtualAlpha) {
      excitations.push({
        type: 'single',
        from: [i],
        to: [a],
        coefficient: 1.0,
        label: `Sα_${i/2}→${a/2}`
      })
    }
  }

  for (const i of occupiedBeta) {
    for (const a of virtualBeta) {
      excitations.push({
        type: 'single',
        from: [i],
        to: [a],
        coefficient: 1.0,
        label: `Sβ_${(i-1)/2}→${(a-1)/2}`
      })
    }
  }

  return excitations
}

export function excitationToPauli(
  excitation: ExcitationOperator,
  numQubits: number
): PauliOperator[] {
  if (excitation.type === 'single') {
    return jordanWignerExcitation(excitation.from[0], excitation.to[0], numQubits)
      .map(op => ({
        ...op,
        coefficient: op.coefficient * excitation.coefficient
      }))
  } else {
    return jordanWignerDoubleExcitation(
      excitation.from[0],
      excitation.from[1],
      excitation.to[0],
      excitation.to[1],
      numQubits
    ).map(op => ({
      ...op,
      coefficient: op.coefficient * excitation.coefficient
    }))
  }
}

export function generateAntihermitianGenerator(
  excitation: ExcitationOperator,
  numQubits: number
): PauliOperator[] {
  const paulis = excitationToPauli(excitation, numQubits)

  return paulis.filter(op => {
    const yCount = (op.pauliString.match(/Y/g) || []).length
    return yCount % 2 === 1
  })
}

export function countExcitations(numOrbitals: number, numElectrons: number): {
  singles: number
  doubles: number
  total: number
} {
  const numOccupied = numElectrons
  const numVirtual = numOrbitals - numElectrons

  const singles = numOccupied * numVirtual
  const doubles = (numOccupied * (numOccupied - 1) / 2) * (numVirtual * (numVirtual - 1) / 2)

  return {
    singles,
    doubles,
    total: singles + doubles
  }
}

export function getExcitationParameters(
  pool: UCCOperatorPool
): { numSingles: number; numDoubles: number; totalParams: number } {
  return {
    numSingles: pool.singles.length,
    numDoubles: pool.doubles.length,
    totalParams: pool.singles.length + pool.doubles.length
  }
}

export function generateSymmetryAdaptedPool(
  numOrbitals: number,
  numElectrons: number,
  pointGroup: 'C1' | 'C2' | 'D2' | 'C2v' = 'C1'
): UCCOperatorPool {
  const basePool = generateUCCSDPool(numOrbitals, numElectrons)

  if (pointGroup === 'C1') {
    return basePool
  }

  return basePool
}

export function generateGSDPool(
  numOrbitals: number,
  numElectrons: number
): UCCOperatorPool {
  const singles: ExcitationOperator[] = []
  const doubles: ExcitationOperator[] = []

  for (let p = 0; p < numOrbitals; p++) {
    for (let q = p + 1; q < numOrbitals; q++) {
      singles.push({
        type: 'single',
        from: [p],
        to: [q],
        coefficient: 1.0,
        label: `GS_${p}→${q}`
      })
    }
  }

  for (let p = 0; p < numOrbitals; p++) {
    for (let q = p + 1; q < numOrbitals; q++) {
      for (let r = q + 1; r < numOrbitals; r++) {
        for (let s = r + 1; s < numOrbitals; s++) {
          doubles.push({
            type: 'double',
            from: [p, q],
            to: [r, s],
            coefficient: 1.0,
            label: `GD_${p}${q}→${r}${s}`
          })
        }
      }
    }
  }

  return {
    singles,
    doubles,
    numQubits: numOrbitals,
    numElectrons,
    numOrbitals
  }
}

export function estimateUCCSDCircuitDepth(
  numOrbitals: number,
  numElectrons: number
): { gateCount: number; estimatedDepth: number; trotterSteps: number } {
  const { singles, doubles } = countExcitations(numOrbitals, numElectrons)

  const singleGates = singles * 4
  const doubleGates = doubles * 16

  const totalGates = singleGates + doubleGates
  const trotterSteps = 1

  return {
    gateCount: totalGates * trotterSteps,
    estimatedDepth: Math.ceil(totalGates / numOrbitals) * trotterSteps,
    trotterSteps
  }
}
