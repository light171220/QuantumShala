import type { MoleculeInfo, MolecularHamiltonian, CatalystInfo } from '../types'

export const AMMONIA_INFO: MoleculeInfo = {
  id: 'nh3',
  name: 'Ammonia (NH₃)',
  formula: 'NH₃',
  description: 'Trigonal pyramidal molecule, important in nitrogen chemistry',
  numAtoms: 4,
  numElectrons: 10,
  equilibriumBondLength: 1.01,
  bondLengthRange: [0.8, 1.4],
  bondAngle: 107.8,
  qubitsRequired: {
    sto3g: 6,
    '6-31g': 12,
    'cc-pvdz': 20
  },
  atomPositions: [
    { element: 'N', x: 0, y: 0, z: 0.38 },
    { element: 'H', x: 0.94, y: 0, z: -0.13 },
    { element: 'H', x: -0.47, y: 0.81, z: -0.13 },
    { element: 'H', x: -0.47, y: -0.81, z: -0.13 }
  ],
  bonds: [
    { atom1: 0, atom2: 1, order: 1 },
    { atom1: 0, atom2: 2, order: 1 },
    { atom1: 0, atom2: 3, order: 1 }
  ]
}

export const NH3_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  '1.01': {
    numQubits: 6,
    terms: [
      { paulis: 'IIIIII', coefficient: -55.4542 },
      { paulis: 'ZIIIII', coefficient: 0.1723 },
      { paulis: 'IZIIII', coefficient: 0.1723 },
      { paulis: 'IIZIII', coefficient: -0.2134 },
      { paulis: 'IIIZII', coefficient: -0.2134 },
      { paulis: 'IIIIZI', coefficient: -0.1876 },
      { paulis: 'IIIIIZ', coefficient: -0.1876 },
      { paulis: 'ZZIIII', coefficient: 0.0876 },
      { paulis: 'IIZZII', coefficient: 0.0765 },
      { paulis: 'IIIIZZ', coefficient: 0.0654 },
      { paulis: 'XXIIII', coefficient: 0.0234 },
      { paulis: 'YYIIII', coefficient: 0.0234 }
    ],
    exactEnergy: -56.2187,
    hartreeFockEnergy: -56.0876
  }
}

export const METHANE_INFO: MoleculeInfo = {
  id: 'ch4',
  name: 'Methane (CH₄)',
  formula: 'CH₄',
  description: 'Tetrahedral molecule, simplest hydrocarbon',
  numAtoms: 5,
  numElectrons: 10,
  equilibriumBondLength: 1.09,
  bondLengthRange: [0.9, 1.4],
  qubitsRequired: {
    sto3g: 6,
    '6-31g': 12,
    'cc-pvdz': 20
  },
  atomPositions: [
    { element: 'C', x: 0, y: 0, z: 0 },
    { element: 'H', x: 0.63, y: 0.63, z: 0.63 },
    { element: 'H', x: -0.63, y: -0.63, z: 0.63 },
    { element: 'H', x: -0.63, y: 0.63, z: -0.63 },
    { element: 'H', x: 0.63, y: -0.63, z: -0.63 }
  ],
  bonds: [
    { atom1: 0, atom2: 1, order: 1 },
    { atom1: 0, atom2: 2, order: 1 },
    { atom1: 0, atom2: 3, order: 1 },
    { atom1: 0, atom2: 4, order: 1 }
  ]
}

export const CH4_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  '1.09': {
    numQubits: 6,
    terms: [
      { paulis: 'IIIIII', coefficient: -39.7265 },
      { paulis: 'ZIIIII', coefficient: 0.1543 },
      { paulis: 'IZIIII', coefficient: 0.1543 },
      { paulis: 'IIZIII', coefficient: -0.1876 },
      { paulis: 'IIIZII', coefficient: -0.1876 },
      { paulis: 'IIIIZI', coefficient: -0.1654 },
      { paulis: 'IIIIIZ', coefficient: -0.1654 },
      { paulis: 'ZZIIII', coefficient: 0.0765 },
      { paulis: 'IIZZII', coefficient: 0.0654 },
      { paulis: 'XXIIII', coefficient: 0.0198 },
      { paulis: 'YYIIII', coefficient: 0.0198 }
    ],
    exactEnergy: -40.2134,
    hartreeFockEnergy: -40.0987
  }
}

export const ETHYLENE_INFO: MoleculeInfo = {
  id: 'c2h4',
  name: 'Ethylene (C₂H₄)',
  formula: 'C₂H₄',
  description: 'Planar molecule with C=C double bond',
  numAtoms: 6,
  numElectrons: 16,
  equilibriumBondLength: 1.33,
  bondLengthRange: [1.1, 1.6],
  qubitsRequired: {
    sto3g: 8,
    '6-31g': 16,
    'cc-pvdz': 28
  },
  atomPositions: [
    { element: 'C', x: 0, y: 0.67, z: 0 },
    { element: 'C', x: 0, y: -0.67, z: 0 },
    { element: 'H', x: 0.92, y: 1.24, z: 0 },
    { element: 'H', x: -0.92, y: 1.24, z: 0 },
    { element: 'H', x: 0.92, y: -1.24, z: 0 },
    { element: 'H', x: -0.92, y: -1.24, z: 0 }
  ],
  bonds: [
    { atom1: 0, atom2: 1, order: 2 },
    { atom1: 0, atom2: 2, order: 1 },
    { atom1: 0, atom2: 3, order: 1 },
    { atom1: 1, atom2: 4, order: 1 },
    { atom1: 1, atom2: 5, order: 1 }
  ]
}

export const C2H4_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  '1.33': {
    numQubits: 8,
    terms: [
      { paulis: 'IIIIIIII', coefficient: -77.8934 },
      { paulis: 'ZIIIIIII', coefficient: 0.1876 },
      { paulis: 'IZIIIIII', coefficient: 0.1876 },
      { paulis: 'IIZIIIII', coefficient: -0.2234 },
      { paulis: 'IIIZIIII', coefficient: -0.2234 },
      { paulis: 'IIIIZIII', coefficient: -0.1987 },
      { paulis: 'IIIIIZII', coefficient: -0.1987 },
      { paulis: 'ZZIIIIII', coefficient: 0.0987 },
      { paulis: 'IIZZIIII', coefficient: 0.0876 },
      { paulis: 'XXIIIIII', coefficient: 0.0267 },
      { paulis: 'YYIIIIII', coefficient: 0.0267 }
    ],
    exactEnergy: -78.4321,
    hartreeFockEnergy: -78.2876
  }
}

export const IRON_CATALYST_INFO: CatalystInfo = {
  id: 'fe-catalyst',
  name: 'Iron Center (Simplified)',
  formula: 'Fe',
  description: 'Simplified iron center for Haber process simulation',
  numAtoms: 1,
  numElectrons: 26,
  equilibriumBondLength: 0,
  bondLengthRange: [0, 0],
  qubitsRequired: {
    sto3g: 10,
    '6-31g': 20,
    'cc-pvdz': 40
  },
  atomPositions: [
    { element: 'Fe', x: 0, y: 0, z: 0 }
  ],
  bonds: [],
  catalystType: 'heterogeneous',
  reactionType: 'Haber Process (N₂ + 3H₂ → 2NH₃)',
  activationEnergy: 40.0
}

export const FE_CATALYST_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  'active': {
    numQubits: 10,
    terms: [
      { paulis: 'IIIIIIIIII', coefficient: -1262.4532 },
      { paulis: 'ZIIIIIIII', coefficient: 0.3245 },
      { paulis: 'IZIIIIIII', coefficient: 0.3245 },
      { paulis: 'IIZIIIIII', coefficient: -0.2876 },
      { paulis: 'IIIZIIII', coefficient: -0.2876 },
      { paulis: 'IIIIZIII', coefficient: 0.2543 },
      { paulis: 'IIIIIZI', coefficient: 0.2543 },
      { paulis: 'ZZIIIIIIII', coefficient: 0.1234 },
      { paulis: 'IIZZIIIII', coefficient: 0.1098 },
      { paulis: 'XXIIIIIIII', coefficient: 0.0432 },
      { paulis: 'YYIIIIIIII', coefficient: 0.0432 }
    ],
    exactEnergy: -1262.9876,
    hartreeFockEnergy: -1262.7654
  }
}

export const PLATINUM_CATALYST_INFO: CatalystInfo = {
  id: 'pt-catalyst',
  name: 'Platinum Surface (Simplified)',
  formula: 'Pt₄',
  description: 'Simplified platinum cluster for catalysis simulation',
  numAtoms: 4,
  numElectrons: 312,
  equilibriumBondLength: 2.77,
  bondLengthRange: [2.5, 3.0],
  qubitsRequired: {
    sto3g: 16,
    '6-31g': 32,
    'cc-pvdz': 64
  },
  atomPositions: [
    { element: 'Pt', x: 0, y: 0, z: 0 },
    { element: 'Pt', x: 2.77, y: 0, z: 0 },
    { element: 'Pt', x: 1.39, y: 2.40, z: 0 },
    { element: 'Pt', x: 1.39, y: 0.80, z: 2.26 }
  ],
  bonds: [
    { atom1: 0, atom2: 1, order: 1 },
    { atom1: 0, atom2: 2, order: 1 },
    { atom1: 0, atom2: 3, order: 1 },
    { atom1: 1, atom2: 2, order: 1 },
    { atom1: 1, atom2: 3, order: 1 },
    { atom1: 2, atom2: 3, order: 1 }
  ],
  catalystType: 'heterogeneous',
  reactionType: 'Hydrogenation reactions',
  activationEnergy: 25.0
}

export const PT_CATALYST_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  'active': {
    numQubits: 16,
    terms: [
      { paulis: 'IIIIIIIIIIIIIIII', coefficient: -4823.7654 },
      { paulis: 'ZIIIIIIIIIIIIIII', coefficient: 0.4532 },
      { paulis: 'IZIIIIIIIIIIIIII', coefficient: 0.4532 },
      { paulis: 'IIZIIIIIIIIIIIII', coefficient: -0.3876 },
      { paulis: 'IIIZIIIIIIIIIIII', coefficient: -0.3876 },
      { paulis: 'ZZIIIIIIIIIIIIII', coefficient: 0.1654 },
      { paulis: 'IIZZIIIIIIIIIIII', coefficient: 0.1432 },
      { paulis: 'XXIIIIIIIIIIIIII', coefficient: 0.0567 },
      { paulis: 'YYIIIIIIIIIIIIII', coefficient: 0.0567 }
    ],
    exactEnergy: -4824.5432,
    hartreeFockEnergy: -4824.2187
  }
}

export const MATERIALS_DATABASE: Record<string, {
  info: MoleculeInfo | CatalystInfo
  hamiltonians: Record<string, MolecularHamiltonian>
}> = {
  nh3: { info: AMMONIA_INFO, hamiltonians: NH3_HAMILTONIANS },
  ch4: { info: METHANE_INFO, hamiltonians: CH4_HAMILTONIANS },
  c2h4: { info: ETHYLENE_INFO, hamiltonians: C2H4_HAMILTONIANS },
  'fe-catalyst': { info: IRON_CATALYST_INFO, hamiltonians: FE_CATALYST_HAMILTONIANS },
  'pt-catalyst': { info: PLATINUM_CATALYST_INFO, hamiltonians: PT_CATALYST_HAMILTONIANS }
}

export function getMaterialHamiltonian(materialId: string, key?: string): MolecularHamiltonian | null {
  const material = MATERIALS_DATABASE[materialId]
  if (!material) return null
  const hamiltonianKey = key || Object.keys(material.hamiltonians)[0]
  return material.hamiltonians[hamiltonianKey] || null
}

export function getMaterialInfo(materialId: string): MoleculeInfo | CatalystInfo | null {
  return MATERIALS_DATABASE[materialId]?.info || null
}

export function getAllMaterials(): (MoleculeInfo | CatalystInfo)[] {
  return Object.values(MATERIALS_DATABASE).map(m => m.info)
}
