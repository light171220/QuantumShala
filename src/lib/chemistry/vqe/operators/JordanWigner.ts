import type { PauliOperator } from './PauliPool'
import { createPauliOperator } from './PauliPool'

export interface FermionOperator {
  index: number
  type: 'creation' | 'annihilation'
}

export interface FermionTerm {
  operators: FermionOperator[]
  coefficient: number
}

export function jordanWignerCreation(site: number, numQubits: number): PauliOperator[] {
  const z_chain = 'Z'.repeat(site) + 'I'.repeat(numQubits - site)

  const xPauli = z_chain.substring(0, site) + 'X' + 'I'.repeat(numQubits - site - 1)
  const yPauli = z_chain.substring(0, site) + 'Y' + 'I'.repeat(numQubits - site - 1)

  return [
    createPauliOperator(xPauli, 0.5, `a†_${site}_X`),
    createPauliOperator(yPauli, -0.5, `a†_${site}_Y`)
  ]
}

export function jordanWignerAnnihilation(site: number, numQubits: number): PauliOperator[] {
  const z_chain = 'Z'.repeat(site) + 'I'.repeat(numQubits - site)

  const xPauli = z_chain.substring(0, site) + 'X' + 'I'.repeat(numQubits - site - 1)
  const yPauli = z_chain.substring(0, site) + 'Y' + 'I'.repeat(numQubits - site - 1)

  return [
    createPauliOperator(xPauli, 0.5, `a_${site}_X`),
    createPauliOperator(yPauli, 0.5, `a_${site}_Y`)
  ]
}

export function jordanWignerNumberOperator(site: number, numQubits: number): PauliOperator[] {
  const identity = 'I'.repeat(numQubits)
  const zPauli = identity.substring(0, site) + 'Z' + identity.substring(site + 1)

  return [
    createPauliOperator(identity, 0.5, `n_${site}_I`),
    createPauliOperator(zPauli, -0.5, `n_${site}_Z`)
  ]
}

export function jordanWignerExcitation(
  from: number,
  to: number,
  numQubits: number
): PauliOperator[] {
  if (from === to) {
    return jordanWignerNumberOperator(from, numQubits)
  }

  const minSite = Math.min(from, to)
  const maxSite = Math.max(from, to)

  const paulis: PauliOperator[] = []

  let xString = ''
  let yString = ''

  for (let i = 0; i < numQubits; i++) {
    if (i === minSite) {
      xString += 'X'
      yString += 'Y'
    } else if (i === maxSite) {
      xString += 'X'
      yString += 'Y'
    } else if (i > minSite && i < maxSite) {
      xString += 'Z'
      yString += 'Z'
    } else {
      xString += 'I'
      yString += 'I'
    }
  }

  paulis.push(createPauliOperator(xString, 0.5, `T_${from}${to}_XX`))
  paulis.push(createPauliOperator(yString, 0.5, `T_${from}${to}_YY`))

  let xyString = ''
  let yxString = ''

  for (let i = 0; i < numQubits; i++) {
    if (i === minSite) {
      xyString += 'X'
      yxString += 'Y'
    } else if (i === maxSite) {
      xyString += 'Y'
      yxString += 'X'
    } else if (i > minSite && i < maxSite) {
      xyString += 'Z'
      yxString += 'Z'
    } else {
      xyString += 'I'
      yxString += 'I'
    }
  }

  const sign = from < to ? 1 : -1
  paulis.push(createPauliOperator(xyString, sign * 0.5, `T_${from}${to}_XY`))
  paulis.push(createPauliOperator(yxString, -sign * 0.5, `T_${from}${to}_YX`))

  return paulis
}

export function jordanWignerDoubleExcitation(
  i: number,
  j: number,
  k: number,
  l: number,
  numQubits: number
): PauliOperator[] {
  const paulis: PauliOperator[] = []
  const indices = [i, j, k, l].sort((a, b) => a - b)

  const pauliTypes = [
    ['X', 'X', 'X', 'X'],
    ['X', 'X', 'Y', 'Y'],
    ['X', 'Y', 'X', 'Y'],
    ['X', 'Y', 'Y', 'X'],
    ['Y', 'X', 'X', 'Y'],
    ['Y', 'X', 'Y', 'X'],
    ['Y', 'Y', 'X', 'X'],
    ['Y', 'Y', 'Y', 'Y'],
  ]

  const coefficients = [0.125, -0.125, 0.125, 0.125, 0.125, -0.125, 0.125, -0.125]

  for (let p = 0; p < pauliTypes.length; p++) {
    const types = pauliTypes[p]
    let pauliString = ''
    let typeIndex = 0

    for (let q = 0; q < numQubits; q++) {
      if (indices.includes(q)) {
        pauliString += types[typeIndex]
        typeIndex++
      } else if (q > indices[0] && q < indices[3]) {
        pauliString += 'Z'
      } else {
        pauliString += 'I'
      }
    }

    paulis.push(createPauliOperator(pauliString, coefficients[p], `D_${i}${j}${k}${l}_${p}`))
  }

  return paulis
}

export function convertFermionToQubit(
  fermionTerms: FermionTerm[],
  numQubits: number
): PauliOperator[] {
  const pauliTerms: PauliOperator[] = []

  for (const term of fermionTerms) {
    let currentPaulis: PauliOperator[] = [createPauliOperator('I'.repeat(numQubits), term.coefficient)]

    for (const op of term.operators) {
      const jwPaulis = op.type === 'creation'
        ? jordanWignerCreation(op.index, numQubits)
        : jordanWignerAnnihilation(op.index, numQubits)

      const newPaulis: PauliOperator[] = []

      for (const p1 of currentPaulis) {
        for (const p2 of jwPaulis) {
          const combined = multiplyPauliOperators(p1, p2)
          newPaulis.push(combined)
        }
      }

      currentPaulis = newPaulis
    }

    pauliTerms.push(...currentPaulis)
  }

  return simplifyPauliSum(pauliTerms)
}

function multiplyPauliOperators(op1: PauliOperator, op2: PauliOperator): PauliOperator {
  const s1 = op1.pauliString
  const s2 = op2.pauliString
  let result = ''
  let phase = 1

  for (let i = 0; i < s1.length; i++) {
    const p1 = s1[i]
    const p2 = s2[i]

    if (p1 === 'I') {
      result += p2
    } else if (p2 === 'I') {
      result += p1
    } else if (p1 === p2) {
      result += 'I'
    } else {
      const products: Record<string, { r: string; p: number }> = {
        'XY': { r: 'Z', p: 1 },
        'YX': { r: 'Z', p: -1 },
        'YZ': { r: 'X', p: 1 },
        'ZY': { r: 'X', p: -1 },
        'ZX': { r: 'Y', p: 1 },
        'XZ': { r: 'Y', p: -1 },
      }
      const key = p1 + p2
      result += products[key].r
      phase *= products[key].p
    }
  }

  return createPauliOperator(result, op1.coefficient * op2.coefficient * phase)
}

function simplifyPauliSum(paulis: PauliOperator[]): PauliOperator[] {
  const coeffMap = new Map<string, number>()

  for (const pauli of paulis) {
    const current = coeffMap.get(pauli.pauliString) || 0
    coeffMap.set(pauli.pauliString, current + pauli.coefficient)
  }

  const result: PauliOperator[] = []

  for (const [pauliString, coefficient] of coeffMap) {
    if (Math.abs(coefficient) > 1e-10) {
      result.push(createPauliOperator(pauliString, coefficient))
    }
  }

  return result
}

export function parityMapping(site: number, numQubits: number): PauliOperator[] {
  let xString = ''
  let yString = ''

  for (let i = 0; i < numQubits; i++) {
    if (i < site) {
      xString += 'Z'
      yString += 'Z'
    } else if (i === site) {
      xString += 'X'
      yString += 'Y'
    } else {
      xString += 'I'
      yString += 'I'
    }
  }

  return [
    createPauliOperator(xString, 0.5),
    createPauliOperator(yString, -0.5)
  ]
}

export function bravyiKitaevMapping(site: number, numQubits: number): PauliOperator[] {
  const updateSet = getUpdateSet(site, numQubits)
  const paritySet = getParitySet(site, numQubits)
  const flipSet = getFlipSet(site, numQubits)

  let xString = ''
  let yString = ''

  for (let i = 0; i < numQubits; i++) {
    if (updateSet.has(i)) {
      xString += 'X'
      yString += 'X'
    } else if (paritySet.has(i) && !flipSet.has(i)) {
      xString += 'Z'
      yString += 'Z'
    } else if (flipSet.has(i)) {
      xString += 'Y'
      yString += 'Y'
    } else {
      xString += 'I'
      yString += 'I'
    }
  }

  return [
    createPauliOperator(xString, 0.5),
    createPauliOperator(yString, -0.5)
  ]
}

function getUpdateSet(j: number, n: number): Set<number> {
  const set = new Set<number>()
  let current = j

  while (current < n) {
    set.add(current)
    current = current | (current + 1)
  }

  return set
}

function getParitySet(j: number, n: number): Set<number> {
  const set = new Set<number>()
  let current = j - 1

  while (current >= 0) {
    set.add(current)
    current = (current & (current + 1)) - 1
  }

  return set
}

function getFlipSet(j: number, _n: number): Set<number> {
  const set = new Set<number>()

  if ((j & 1) === 0) {
    set.add(j)
  }

  return set
}
