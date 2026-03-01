import type { PauliTerm, MolecularHamiltonian, MoleculeInfo, BondLengthData } from './types'

export type { PauliTerm, MolecularHamiltonian, MoleculeInfo, BondLengthData }

export const H2_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  '0.5': {
    numQubits: 2,
    terms: [
      { paulis: 'II', coefficient: -0.8162 },
      { paulis: 'ZI', coefficient: 0.1711 },
      { paulis: 'IZ', coefficient: 0.1711 },
      { paulis: 'ZZ', coefficient: 0.1686 },
      { paulis: 'XX', coefficient: 0.0454 },
      { paulis: 'YY', coefficient: 0.0454 }
    ],
    exactEnergy: -1.055,
    hartreeFockEnergy: -0.918
  },
  '0.74': {
    numQubits: 2,
    terms: [
      { paulis: 'II', coefficient: -1.0523 },
      { paulis: 'ZI', coefficient: 0.3979 },
      { paulis: 'IZ', coefficient: -0.3979 },
      { paulis: 'ZZ', coefficient: -0.0112 },
      { paulis: 'XX', coefficient: 0.1809 },
      { paulis: 'YY', coefficient: 0.1809 }
    ],
    exactEnergy: -1.1373,
    hartreeFockEnergy: -1.1167
  },
  '1.0': {
    numQubits: 2,
    terms: [
      { paulis: 'II', coefficient: -0.9699 },
      { paulis: 'ZI', coefficient: 0.4299 },
      { paulis: 'IZ', coefficient: -0.4299 },
      { paulis: 'ZZ', coefficient: -0.0820 },
      { paulis: 'XX', coefficient: 0.1743 },
      { paulis: 'YY', coefficient: 0.1743 }
    ],
    exactEnergy: -1.1011,
    hartreeFockEnergy: -1.0577
  },
  '1.5': {
    numQubits: 2,
    terms: [
      { paulis: 'II', coefficient: -0.7884 },
      { paulis: 'ZI', coefficient: 0.3858 },
      { paulis: 'IZ', coefficient: -0.3858 },
      { paulis: 'ZZ', coefficient: -0.1547 },
      { paulis: 'XX', coefficient: 0.1418 },
      { paulis: 'YY', coefficient: 0.1418 }
    ],
    exactEnergy: -0.9897,
    hartreeFockEnergy: -0.9084
  },
  '2.0': {
    numQubits: 2,
    terms: [
      { paulis: 'II', coefficient: -0.6753 },
      { paulis: 'ZI', coefficient: 0.3374 },
      { paulis: 'IZ', coefficient: -0.3374 },
      { paulis: 'ZZ', coefficient: -0.1893 },
      { paulis: 'XX', coefficient: 0.1179 },
      { paulis: 'YY', coefficient: 0.1179 }
    ],
    exactEnergy: -0.9049,
    hartreeFockEnergy: -0.8009
  }
}

export const H2_INFO: MoleculeInfo = {
  id: 'h2',
  name: 'Hydrogen (H₂)',
  formula: 'H₂',
  description: 'Simplest diatomic molecule, ideal for quantum computing demonstrations',
  numAtoms: 2,
  numElectrons: 2,
  equilibriumBondLength: 0.74,
  bondLengthRange: [0.5, 2.5],
  qubitsRequired: {
    sto3g: 2,
    '6-31g': 4,
    'cc-pvdz': 8
  },
  atomPositions: [
    { element: 'H', x: 0, y: 0, z: 0 },
    { element: 'H', x: 0.74, y: 0, z: 0 }
  ],
  bonds: [{ atom1: 0, atom2: 1, order: 1 }]
}

export const LiH_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  '1.6': {
    numQubits: 4,
    terms: [
      { paulis: 'IIII', coefficient: -7.4983 },
      { paulis: 'ZIII', coefficient: 0.2251 },
      { paulis: 'IZII', coefficient: 0.2251 },
      { paulis: 'IIZI', coefficient: -0.2379 },
      { paulis: 'IIIZ', coefficient: -0.2379 },
      { paulis: 'ZZII', coefficient: 0.1208 },
      { paulis: 'ZIZI', coefficient: 0.1656 },
      { paulis: 'ZIIZ', coefficient: 0.0453 },
      { paulis: 'IZZI', coefficient: 0.0453 },
      { paulis: 'IZIZ', coefficient: 0.1656 },
      { paulis: 'IIZZ', coefficient: 0.1746 },
      { paulis: 'XXII', coefficient: 0.0119 },
      { paulis: 'YYII', coefficient: 0.0119 },
      { paulis: 'IIXX', coefficient: 0.0389 },
      { paulis: 'IIYY', coefficient: 0.0389 },
      { paulis: 'XZXI', coefficient: 0.0082 },
      { paulis: 'YZYI', coefficient: 0.0082 },
      { paulis: 'XIIX', coefficient: 0.0082 },
      { paulis: 'YIIY', coefficient: 0.0082 }
    ],
    exactEnergy: -7.8823,
    hartreeFockEnergy: -7.8631
  }
}

export const LiH_INFO: MoleculeInfo = {
  id: 'lih',
  name: 'Lithium Hydride (LiH)',
  formula: 'LiH',
  description: 'Polar diatomic molecule, benchmark for quantum chemistry algorithms',
  numAtoms: 2,
  numElectrons: 4,
  equilibriumBondLength: 1.6,
  bondLengthRange: [1.0, 3.0],
  qubitsRequired: {
    sto3g: 4,
    '6-31g': 8,
    'cc-pvdz': 14
  },
  atomPositions: [
    { element: 'Li', x: 0, y: 0, z: 0 },
    { element: 'H', x: 1.6, y: 0, z: 0 }
  ],
  bonds: [{ atom1: 0, atom2: 1, order: 1 }]
}

export const BeH2_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  '1.33': {
    numQubits: 6,
    terms: [
      { paulis: 'IIIIII', coefficient: -14.9635 },
      { paulis: 'ZIIIII', coefficient: 0.1823 },
      { paulis: 'IZIIII', coefficient: 0.1823 },
      { paulis: 'IIZIII', coefficient: -0.3456 },
      { paulis: 'IIIZII', coefficient: -0.3456 },
      { paulis: 'IIIIZI', coefficient: -0.2196 },
      { paulis: 'IIIIIZ', coefficient: -0.2196 },
      { paulis: 'ZZIIII', coefficient: 0.0894 },
      { paulis: 'IIZZII', coefficient: 0.1327 },
      { paulis: 'IIIIZZ', coefficient: 0.1247 },
      { paulis: 'XXIIII', coefficient: 0.0156 },
      { paulis: 'YYIIII', coefficient: 0.0156 },
      { paulis: 'IIXXII', coefficient: 0.0412 },
      { paulis: 'IIYYII', coefficient: 0.0412 },
      { paulis: 'IIIIXX', coefficient: 0.0298 },
      { paulis: 'IIIIYY', coefficient: 0.0298 }
    ],
    exactEnergy: -15.5951,
    hartreeFockEnergy: -15.5612
  }
}

export const BeH2_INFO: MoleculeInfo = {
  id: 'beh2',
  name: 'Beryllium Hydride (BeH₂)',
  formula: 'BeH₂',
  description: 'Linear triatomic molecule with D∞h symmetry',
  numAtoms: 3,
  numElectrons: 6,
  equilibriumBondLength: 1.33,
  bondLengthRange: [1.0, 2.5],
  qubitsRequired: {
    sto3g: 6,
    '6-31g': 12,
    'cc-pvdz': 20
  },
  atomPositions: [
    { element: 'H', x: -1.33, y: 0, z: 0 },
    { element: 'Be', x: 0, y: 0, z: 0 },
    { element: 'H', x: 1.33, y: 0, z: 0 }
  ],
  bonds: [
    { atom1: 0, atom2: 1, order: 1 },
    { atom1: 1, atom2: 2, order: 1 }
  ]
}

export const H2O_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  '0.96': {
    numQubits: 8,
    terms: [
      { paulis: 'IIIIIIII', coefficient: -73.5152 },
      { paulis: 'ZIIIIIII', coefficient: 0.1247 },
      { paulis: 'IZIIIIII', coefficient: 0.1247 },
      { paulis: 'IIZIIIII', coefficient: -0.3891 },
      { paulis: 'IIIZIIII', coefficient: -0.3891 },
      { paulis: 'IIIIZIII', coefficient: -0.2673 },
      { paulis: 'IIIIIZII', coefficient: -0.2673 },
      { paulis: 'IIIIIIZI', coefficient: -0.1982 },
      { paulis: 'IIIIIIIZ', coefficient: -0.1982 },
      { paulis: 'ZZIIIIII', coefficient: 0.1124 },
      { paulis: 'IIZZIIII', coefficient: 0.1456 },
      { paulis: 'IIIIZZII', coefficient: 0.1287 },
      { paulis: 'IIIIIIZZ', coefficient: 0.0943 }
    ],
    exactEnergy: -75.0159,
    hartreeFockEnergy: -74.9629
  }
}

export const H2O_INFO: MoleculeInfo = {
  id: 'h2o',
  name: 'Water (H₂O)',
  formula: 'H₂O',
  description: 'Bent triatomic molecule, essential for understanding chemical bonding',
  numAtoms: 3,
  numElectrons: 10,
  equilibriumBondLength: 0.96,
  bondLengthRange: [0.8, 1.5],
  bondAngle: 104.5,
  qubitsRequired: {
    sto3g: 8,
    '6-31g': 14,
    'cc-pvdz': 24
  },
  atomPositions: [
    { element: 'O', x: 0, y: 0, z: 0 },
    { element: 'H', x: 0.757, y: 0.587, z: 0 },
    { element: 'H', x: -0.757, y: 0.587, z: 0 }
  ],
  bonds: [
    { atom1: 0, atom2: 1, order: 1 },
    { atom1: 0, atom2: 2, order: 1 }
  ]
}

export const MOLECULE_DATABASE: Record<string, {
  info: MoleculeInfo
  hamiltonians: Record<string, MolecularHamiltonian>
}> = {
  h2: { info: H2_INFO, hamiltonians: H2_HAMILTONIANS },
  lih: { info: LiH_INFO, hamiltonians: LiH_HAMILTONIANS },
  beh2: { info: BeH2_INFO, hamiltonians: BeH2_HAMILTONIANS },
  h2o: { info: H2O_INFO, hamiltonians: H2O_HAMILTONIANS }
}

export function getHamiltonian(moleculeId: string, bondLength: number): MolecularHamiltonian | null {
  const molecule = MOLECULE_DATABASE[moleculeId]
  if (!molecule) return null

  const availableLengths = Object.keys(molecule.hamiltonians).map(Number)
  const closest = availableLengths.reduce((prev, curr) =>
    Math.abs(curr - bondLength) < Math.abs(prev - bondLength) ? curr : prev
  )

  return molecule.hamiltonians[closest.toString()] || null
}

export function getMoleculeInfo(moleculeId: string): MoleculeInfo | null {
  return MOLECULE_DATABASE[moleculeId]?.info || null
}

export function getAllMolecules(): MoleculeInfo[] {
  return Object.values(MOLECULE_DATABASE).map(m => m.info)
}

export function getPESData(moleculeId: string): BondLengthData[] {
  const molecule = MOLECULE_DATABASE[moleculeId]
  if (!molecule) return []

  return Object.entries(molecule.hamiltonians).map(([length, ham]) => ({
    bondLength: parseFloat(length),
    exactEnergy: ham.exactEnergy,
    hartreeFockEnergy: ham.hartreeFockEnergy
  })).sort((a, b) => a.bondLength - b.bondLength)
}

export const ELEMENT_COLORS: Record<string, string> = {
  H: '#FFFFFF',
  He: '#D9FFFF',
  Li: '#CC80FF',
  Be: '#C2FF00',
  B: '#FFB5B5',
  C: '#909090',
  N: '#3050F8',
  O: '#FF0D0D',
  F: '#90E050',
  Ne: '#B3E3F5'
}

export const COVALENT_RADII: Record<string, number> = {
  H: 0.31,
  He: 0.28,
  Li: 1.28,
  Be: 0.96,
  B: 0.84,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  Ne: 0.58
}
