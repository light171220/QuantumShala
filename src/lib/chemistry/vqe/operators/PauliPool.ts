export interface PauliOperator {
  pauliString: string
  coefficient: number
  label?: string
}

export interface OperatorPool {
  operators: PauliOperator[]
  numQubits: number
}

export function createPauliOperator(pauliString: string, coefficient: number = 1.0, label?: string): PauliOperator {
  return { pauliString, coefficient, label }
}

export function generateSingleQubitPool(numQubits: number): OperatorPool {
  const operators: PauliOperator[] = []

  for (let q = 0; q < numQubits; q++) {
    for (const pauli of ['X', 'Y', 'Z']) {
      const pauliString = 'I'.repeat(q) + pauli + 'I'.repeat(numQubits - q - 1)
      operators.push(createPauliOperator(pauliString, 1.0, `${pauli}_${q}`))
    }
  }

  return { operators, numQubits }
}

export function generateTwoQubitPool(numQubits: number): OperatorPool {
  const operators: PauliOperator[] = []
  const paulis = ['X', 'Y', 'Z']

  for (let i = 0; i < numQubits; i++) {
    for (let j = i + 1; j < numQubits; j++) {
      for (const p1 of paulis) {
        for (const p2 of paulis) {
          const chars = new Array(numQubits).fill('I')
          chars[i] = p1
          chars[j] = p2
          const pauliString = chars.join('')
          operators.push(createPauliOperator(pauliString, 1.0, `${p1}${p2}_${i}${j}`))
        }
      }
    }
  }

  return { operators, numQubits }
}

export function generateHardwareEfficientPool(numQubits: number): OperatorPool {
  const singleQubit = generateSingleQubitPool(numQubits)
  const twoQubit = generateTwoQubitPool(numQubits)

  return {
    operators: [...singleQubit.operators, ...twoQubit.operators],
    numQubits
  }
}

export function generateQubitAdaptPool(numQubits: number): OperatorPool {
  const operators: PauliOperator[] = []

  for (let i = 0; i < numQubits; i++) {
    for (let j = i + 1; j < numQubits; j++) {
      const xz = new Array(numQubits).fill('I')
      xz[i] = 'X'
      xz[j] = 'Z'
      operators.push(createPauliOperator(xz.join(''), 1.0, `XZ_${i}${j}`))

      const yz = new Array(numQubits).fill('I')
      yz[i] = 'Y'
      yz[j] = 'Z'
      operators.push(createPauliOperator(yz.join(''), 1.0, `YZ_${i}${j}`))

      const zx = new Array(numQubits).fill('I')
      zx[i] = 'Z'
      zx[j] = 'X'
      operators.push(createPauliOperator(zx.join(''), 1.0, `ZX_${i}${j}`))

      const zy = new Array(numQubits).fill('I')
      zy[i] = 'Z'
      zy[j] = 'Y'
      operators.push(createPauliOperator(zy.join(''), 1.0, `ZY_${i}${j}`))
    }
  }

  return { operators, numQubits }
}

export function multiplyPauliStrings(p1: string, p2: string): { result: string; phase: number } {
  if (p1.length !== p2.length) {
    throw new Error('Pauli strings must have equal length')
  }

  let phase = 0
  const result: string[] = []

  for (let i = 0; i < p1.length; i++) {
    const a = p1[i]
    const b = p2[i]

    if (a === 'I') {
      result.push(b)
    } else if (b === 'I') {
      result.push(a)
    } else if (a === b) {
      result.push('I')
    } else {
      const pauliProduct: Record<string, { result: string; phase: number }> = {
        'XY': { result: 'Z', phase: 1 },
        'YX': { result: 'Z', phase: -1 },
        'YZ': { result: 'X', phase: 1 },
        'ZY': { result: 'X', phase: -1 },
        'ZX': { result: 'Y', phase: 1 },
        'XZ': { result: 'Y', phase: -1 },
      }
      const key = a + b
      const product = pauliProduct[key]
      result.push(product.result)
      phase += product.phase
    }
  }

  return { result: result.join(''), phase: phase % 4 }
}

export function commutator(op1: PauliOperator, op2: PauliOperator): PauliOperator[] {
  const { result, phase } = multiplyPauliStrings(op1.pauliString, op2.pauliString)

  if (phase === 0) {
    return []
  }

  const coefficient = 2 * op1.coefficient * op2.coefficient * (phase === 1 ? 1 : -1)
  return [createPauliOperator(result, coefficient)]
}

export function qubitWiseCommuting(op1: PauliOperator, op2: PauliOperator): boolean {
  const s1 = op1.pauliString
  const s2 = op2.pauliString

  for (let i = 0; i < s1.length; i++) {
    const p1 = s1[i]
    const p2 = s2[i]

    if (p1 !== 'I' && p2 !== 'I' && p1 !== p2) {
      return false
    }
  }

  return true
}

export function groupQubitWiseCommuting(operators: PauliOperator[]): PauliOperator[][] {
  const groups: PauliOperator[][] = []
  const assigned = new Set<number>()

  for (let i = 0; i < operators.length; i++) {
    if (assigned.has(i)) continue

    const group: PauliOperator[] = [operators[i]]
    assigned.add(i)

    for (let j = i + 1; j < operators.length; j++) {
      if (assigned.has(j)) continue

      let commutesWithAll = true
      for (const member of group) {
        if (!qubitWiseCommuting(member, operators[j])) {
          commutesWithAll = false
          break
        }
      }

      if (commutesWithAll) {
        group.push(operators[j])
        assigned.add(j)
      }
    }

    groups.push(group)
  }

  return groups
}

export function computePauliWeight(pauliString: string): number {
  let weight = 0
  for (const char of pauliString) {
    if (char !== 'I') weight++
  }
  return weight
}

export function sortOperatorsByWeight(operators: PauliOperator[]): PauliOperator[] {
  return [...operators].sort((a, b) =>
    computePauliWeight(a.pauliString) - computePauliWeight(b.pauliString)
  )
}
