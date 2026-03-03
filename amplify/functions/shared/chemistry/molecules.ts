import type { MoleculeInfo, Hamiltonian, PauliTerm } from '../types'

export const MOLECULES: Record<string, MoleculeInfo & { hamiltonians: Record<string, Hamiltonian> }> = {
  h2: {
    id: 'h2',
    name: 'Hydrogen',
    formula: 'H₂',
    numElectrons: 2,
    numOrbitals: 2,
    geometry: {
      atoms: [
        { element: 'H', x: 0, y: 0, z: 0 },
        { element: 'H', x: 0.74, y: 0, z: 0 },
      ],
    },
    bondLength: 0.74,
    exactEnergy: -1.137,
    hamiltonians: {
      '0.50': createH2Hamiltonian(0.50),
      '0.60': createH2Hamiltonian(0.60),
      '0.70': createH2Hamiltonian(0.70),
      '0.74': createH2Hamiltonian(0.74),
      '0.80': createH2Hamiltonian(0.80),
      '0.90': createH2Hamiltonian(0.90),
      '1.00': createH2Hamiltonian(1.00),
      '1.20': createH2Hamiltonian(1.20),
      '1.50': createH2Hamiltonian(1.50),
      '2.00': createH2Hamiltonian(2.00),
      '2.50': createH2Hamiltonian(2.50),
      '3.00': createH2Hamiltonian(3.00),
    },
  },
  lih: {
    id: 'lih',
    name: 'Lithium Hydride',
    formula: 'LiH',
    numElectrons: 4,
    numOrbitals: 6,
    geometry: {
      atoms: [
        { element: 'Li', x: 0, y: 0, z: 0 },
        { element: 'H', x: 1.595, y: 0, z: 0 },
      ],
    },
    bondLength: 1.595,
    exactEnergy: -7.882,
    hamiltonians: {
      '1.595': createLiHHamiltonian(1.595),
    },
  },
  beh2: {
    id: 'beh2',
    name: 'Beryllium Hydride',
    formula: 'BeH₂',
    numElectrons: 6,
    numOrbitals: 7,
    geometry: {
      atoms: [
        { element: 'H', x: -1.33, y: 0, z: 0 },
        { element: 'Be', x: 0, y: 0, z: 0 },
        { element: 'H', x: 1.33, y: 0, z: 0 },
      ],
    },
    bondLength: 1.33,
    exactEnergy: -15.595,
    hamiltonians: {
      '1.33': createBeH2Hamiltonian(1.33),
    },
  },
  h2o: {
    id: 'h2o',
    name: 'Water',
    formula: 'H₂O',
    numElectrons: 10,
    numOrbitals: 7,
    geometry: {
      atoms: [
        { element: 'O', x: 0, y: 0, z: 0 },
        { element: 'H', x: 0.958, y: 0, z: 0 },
        { element: 'H', x: -0.24, y: 0.927, z: 0 },
      ],
    },
    bondLength: 0.958,
    exactEnergy: -75.012,
    hamiltonians: {
      '0.958': createH2OHamiltonian(0.958),
    },
  },
  heh_plus: {
    id: 'heh_plus',
    name: 'Helium Hydride Ion',
    formula: 'HeH⁺',
    numElectrons: 2,
    numOrbitals: 2,
    geometry: {
      atoms: [
        { element: 'He', x: 0, y: 0, z: 0 },
        { element: 'H', x: 0.77, y: 0, z: 0 },
      ],
    },
    bondLength: 0.77,
    exactEnergy: -2.862,
    hamiltonians: {
      '0.77': createHeHPlusHamiltonian(0.77),
    },
  },
}

function createH2Hamiltonian(bondLength: number): Hamiltonian {
  const r = bondLength

  const g0 = -0.81054 + 0.16614 * r - 0.013 * r * r
  const g1 = 0.17120 - 0.22279 * r + 0.061 * r * r
  const g2 = -0.22575 + 0.16868 * r - 0.038 * r * r
  const g3 = 0.17464 - 0.08227 * r + 0.013 * r * r
  const g4 = 0.12062 - 0.01546 * r - 0.003 * r * r

  const terms: PauliTerm[] = [
    { coefficient: g1, operators: [{ qubit: 0, pauli: 'Z' }] },
    { coefficient: g1, operators: [{ qubit: 1, pauli: 'Z' }] },
    { coefficient: g2, operators: [{ qubit: 2, pauli: 'Z' }] },
    { coefficient: g2, operators: [{ qubit: 3, pauli: 'Z' }] },
    { coefficient: g3, operators: [{ qubit: 0, pauli: 'Z' }, { qubit: 1, pauli: 'Z' }] },
    { coefficient: g4, operators: [{ qubit: 0, pauli: 'Z' }, { qubit: 2, pauli: 'Z' }] },
    { coefficient: g4, operators: [{ qubit: 1, pauli: 'Z' }, { qubit: 3, pauli: 'Z' }] },
    { coefficient: g3, operators: [{ qubit: 2, pauli: 'Z' }, { qubit: 3, pauli: 'Z' }] },
    { coefficient: g4, operators: [{ qubit: 0, pauli: 'Z' }, { qubit: 3, pauli: 'Z' }] },
    { coefficient: g4, operators: [{ qubit: 1, pauli: 'Z' }, { qubit: 2, pauli: 'Z' }] },
    {
      coefficient: 0.04523 - 0.03872 * r + 0.008 * r * r,
      operators: [
        { qubit: 0, pauli: 'X' },
        { qubit: 1, pauli: 'X' },
        { qubit: 2, pauli: 'Y' },
        { qubit: 3, pauli: 'Y' },
      ],
    },
    {
      coefficient: 0.04523 - 0.03872 * r + 0.008 * r * r,
      operators: [
        { qubit: 0, pauli: 'Y' },
        { qubit: 1, pauli: 'Y' },
        { qubit: 2, pauli: 'X' },
        { qubit: 3, pauli: 'X' },
      ],
    },
    {
      coefficient: -0.04523 + 0.03872 * r - 0.008 * r * r,
      operators: [
        { qubit: 0, pauli: 'X' },
        { qubit: 1, pauli: 'Y' },
        { qubit: 2, pauli: 'Y' },
        { qubit: 3, pauli: 'X' },
      ],
    },
    {
      coefficient: -0.04523 + 0.03872 * r - 0.008 * r * r,
      operators: [
        { qubit: 0, pauli: 'Y' },
        { qubit: 1, pauli: 'X' },
        { qubit: 2, pauli: 'X' },
        { qubit: 3, pauli: 'Y' },
      ],
    },
  ]

  return {
    numQubits: 4,
    terms,
    constantTerm: g0,
  }
}

function createLiHHamiltonian(bondLength: number): Hamiltonian {
  const terms: PauliTerm[] = [
    { coefficient: 0.096022, operators: [{ qubit: 0, pauli: 'Z' }] },
    { coefficient: 0.096022, operators: [{ qubit: 1, pauli: 'Z' }] },
    { coefficient: -0.206128, operators: [{ qubit: 2, pauli: 'Z' }] },
    { coefficient: -0.206128, operators: [{ qubit: 3, pauli: 'Z' }] },
    { coefficient: -0.050302, operators: [{ qubit: 4, pauli: 'Z' }] },
    { coefficient: -0.050302, operators: [{ qubit: 5, pauli: 'Z' }] },
    { coefficient: 0.168336, operators: [{ qubit: 0, pauli: 'Z' }, { qubit: 1, pauli: 'Z' }] },
    { coefficient: 0.120546, operators: [{ qubit: 0, pauli: 'Z' }, { qubit: 2, pauli: 'Z' }] },
    { coefficient: 0.165868, operators: [{ qubit: 0, pauli: 'Z' }, { qubit: 3, pauli: 'Z' }] },
    { coefficient: 0.174349, operators: [{ qubit: 1, pauli: 'Z' }, { qubit: 2, pauli: 'Z' }] },
    { coefficient: 0.120546, operators: [{ qubit: 1, pauli: 'Z' }, { qubit: 3, pauli: 'Z' }] },
    { coefficient: 0.174868, operators: [{ qubit: 2, pauli: 'Z' }, { qubit: 3, pauli: 'Z' }] },
    {
      coefficient: -0.044750,
      operators: [
        { qubit: 0, pauli: 'X' },
        { qubit: 1, pauli: 'X' },
        { qubit: 2, pauli: 'Y' },
        { qubit: 3, pauli: 'Y' },
      ],
    },
    {
      coefficient: -0.044750,
      operators: [
        { qubit: 0, pauli: 'Y' },
        { qubit: 1, pauli: 'Y' },
        { qubit: 2, pauli: 'X' },
        { qubit: 3, pauli: 'X' },
      ],
    },
    {
      coefficient: 0.044750,
      operators: [
        { qubit: 0, pauli: 'X' },
        { qubit: 1, pauli: 'Y' },
        { qubit: 2, pauli: 'Y' },
        { qubit: 3, pauli: 'X' },
      ],
    },
    {
      coefficient: 0.044750,
      operators: [
        { qubit: 0, pauli: 'Y' },
        { qubit: 1, pauli: 'X' },
        { qubit: 2, pauli: 'X' },
        { qubit: 3, pauli: 'Y' },
      ],
    },
  ]

  return {
    numQubits: 12,
    terms,
    constantTerm: -7.50916,
  }
}

function createBeH2Hamiltonian(bondLength: number): Hamiltonian {
  const terms: PauliTerm[] = [
    { coefficient: -0.143021, operators: [{ qubit: 0, pauli: 'Z' }] },
    { coefficient: -0.143021, operators: [{ qubit: 1, pauli: 'Z' }] },
    { coefficient: 0.104962, operators: [{ qubit: 2, pauli: 'Z' }] },
    { coefficient: 0.104962, operators: [{ qubit: 3, pauli: 'Z' }] },
    { coefficient: 0.038195, operators: [{ qubit: 4, pauli: 'Z' }] },
    { coefficient: 0.038195, operators: [{ qubit: 5, pauli: 'Z' }] },
    { coefficient: -0.132681, operators: [{ qubit: 6, pauli: 'Z' }] },
    { coefficient: -0.132681, operators: [{ qubit: 7, pauli: 'Z' }] },
    { coefficient: 0.156847, operators: [{ qubit: 0, pauli: 'Z' }, { qubit: 1, pauli: 'Z' }] },
    { coefficient: 0.110577, operators: [{ qubit: 2, pauli: 'Z' }, { qubit: 3, pauli: 'Z' }] },
    { coefficient: 0.111042, operators: [{ qubit: 4, pauli: 'Z' }, { qubit: 5, pauli: 'Z' }] },
    { coefficient: 0.095646, operators: [{ qubit: 6, pauli: 'Z' }, { qubit: 7, pauli: 'Z' }] },
  ]

  return {
    numQubits: 14,
    terms,
    constantTerm: -14.8696,
  }
}

function createH2OHamiltonian(bondLength: number): Hamiltonian {
  const terms: PauliTerm[] = [
    { coefficient: -0.0970662, operators: [{ qubit: 0, pauli: 'Z' }] },
    { coefficient: -0.0970662, operators: [{ qubit: 1, pauli: 'Z' }] },
    { coefficient: -0.2067851, operators: [{ qubit: 2, pauli: 'Z' }] },
    { coefficient: -0.2067851, operators: [{ qubit: 3, pauli: 'Z' }] },
    { coefficient: 0.1757901, operators: [{ qubit: 4, pauli: 'Z' }] },
    { coefficient: 0.1757901, operators: [{ qubit: 5, pauli: 'Z' }] },
    { coefficient: 0.0515177, operators: [{ qubit: 6, pauli: 'Z' }] },
    { coefficient: 0.0515177, operators: [{ qubit: 7, pauli: 'Z' }] },
    { coefficient: 0.0515177, operators: [{ qubit: 8, pauli: 'Z' }] },
    { coefficient: 0.0515177, operators: [{ qubit: 9, pauli: 'Z' }] },
    { coefficient: 0.1209126, operators: [{ qubit: 10, pauli: 'Z' }] },
    { coefficient: 0.1209126, operators: [{ qubit: 11, pauli: 'Z' }] },
    { coefficient: 0.1209126, operators: [{ qubit: 12, pauli: 'Z' }] },
    { coefficient: 0.1209126, operators: [{ qubit: 13, pauli: 'Z' }] },
    { coefficient: 0.1689419, operators: [{ qubit: 0, pauli: 'Z' }, { qubit: 1, pauli: 'Z' }] },
    { coefficient: 0.1216839, operators: [{ qubit: 2, pauli: 'Z' }, { qubit: 3, pauli: 'Z' }] },
  ]

  return {
    numQubits: 14,
    terms,
    constantTerm: -73.5594,
  }
}

function createHeHPlusHamiltonian(bondLength: number): Hamiltonian {
  const r = bondLength
  const g0 = -2.1433 + 0.562 * r - 0.091 * r * r
  const g1 = 0.3975 - 0.415 * r + 0.097 * r * r
  const g2 = -0.3975 + 0.415 * r - 0.097 * r * r
  const g3 = 0.1812 - 0.104 * r + 0.016 * r * r

  const terms: PauliTerm[] = [
    { coefficient: g1, operators: [{ qubit: 0, pauli: 'Z' }] },
    { coefficient: g1, operators: [{ qubit: 1, pauli: 'Z' }] },
    { coefficient: g2, operators: [{ qubit: 2, pauli: 'Z' }] },
    { coefficient: g2, operators: [{ qubit: 3, pauli: 'Z' }] },
    { coefficient: g3, operators: [{ qubit: 0, pauli: 'Z' }, { qubit: 1, pauli: 'Z' }] },
    { coefficient: g3, operators: [{ qubit: 2, pauli: 'Z' }, { qubit: 3, pauli: 'Z' }] },
  ]

  return {
    numQubits: 4,
    terms,
    constantTerm: g0,
  }
}

export function getMolecule(id: string): (MoleculeInfo & { hamiltonians: Record<string, Hamiltonian> }) | undefined {
  return MOLECULES[id]
}

export function getHamiltonian(moleculeId: string, bondLength?: number): Hamiltonian | undefined {
  const molecule = MOLECULES[moleculeId]
  if (!molecule) return undefined

  const bl = bondLength ?? molecule.bondLength
  const key = bl?.toFixed(2)

  if (key && molecule.hamiltonians[key]) {
    return molecule.hamiltonians[key]
  }

  const keys = Object.keys(molecule.hamiltonians)
  if (keys.length > 0) {
    const closest = keys.reduce((prev, curr) => {
      return Math.abs(parseFloat(curr) - (bl ?? 0)) < Math.abs(parseFloat(prev) - (bl ?? 0)) ? curr : prev
    })
    return molecule.hamiltonians[closest]
  }

  return undefined
}

export function getAllMolecules(): MoleculeInfo[] {
  return Object.values(MOLECULES).map(({ hamiltonians, ...info }) => info)
}

export function getAvailableBondLengths(moleculeId: string): number[] {
  const molecule = MOLECULES[moleculeId]
  if (!molecule) return []
  return Object.keys(molecule.hamiltonians).map(parseFloat).sort((a, b) => a - b)
}

export function getExactEnergy(moleculeId: string, bondLength?: number): number | undefined {
  const molecule = MOLECULES[moleculeId]
  if (!molecule) return undefined

  const bl = bondLength ?? molecule.bondLength

  if (moleculeId === 'h2' && bl !== undefined) {
    return -1.174 + 0.4 * (1 - Math.exp(-1.5 * (bl - 0.74)))
  }

  return molecule.exactEnergy
}

export function getMoleculeByIdOrName(idOrName: string): (MoleculeInfo & { hamiltonians: Record<string, Hamiltonian> }) | undefined {
  if (MOLECULES[idOrName]) {
    return MOLECULES[idOrName]
  }

  const byName = Object.values(MOLECULES).find(
    mol => mol.name.toLowerCase() === idOrName.toLowerCase() ||
           mol.formula.toLowerCase() === idOrName.toLowerCase()
  )
  return byName
}

export function computeHamiltonianForMolecule(
  molecule: MoleculeInfo & { hamiltonians?: Record<string, Hamiltonian> },
  qubitMapping: 'jordan_wigner' | 'bravyi_kitaev' | 'parity' = 'jordan_wigner',
  bondLength?: number
): Hamiltonian | null {
  if (!molecule.hamiltonians) {
    return getHamiltonian(molecule.id, bondLength) || null
  }

  const bl = bondLength ?? molecule.bondLength
  const key = bl?.toFixed(2)

  if (key && molecule.hamiltonians[key]) {
    return molecule.hamiltonians[key]
  }

  const keys = Object.keys(molecule.hamiltonians)
  if (keys.length > 0) {
    const closest = keys.reduce((prev, curr) => {
      return Math.abs(parseFloat(curr) - (bl ?? 0)) < Math.abs(parseFloat(prev) - (bl ?? 0)) ? curr : prev
    })
    return molecule.hamiltonians[closest]
  }

  return null
}
