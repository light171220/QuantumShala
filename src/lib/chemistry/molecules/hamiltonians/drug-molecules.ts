import type { MoleculeInfo, MolecularHamiltonian, DrugMoleculeInfo } from '../types'

export const CAFFEINE_INFO: DrugMoleculeInfo = {
  id: 'caffeine',
  name: 'Caffeine (Simplified)',
  formula: 'C₈H₁₀N₄O₂',
  description: 'Simplified caffeine model for quantum simulation',
  numAtoms: 24,
  numElectrons: 102,
  equilibriumBondLength: 1.4,
  bondLengthRange: [1.2, 1.6],
  qubitsRequired: {
    sto3g: 12,
    '6-31g': 24,
    'cc-pvdz': 48
  },
  atomPositions: [
    { element: 'N', x: 0.0, y: 0.0, z: 0.0 },
    { element: 'C', x: 1.3, y: 0.0, z: 0.0 },
    { element: 'N', x: 2.0, y: 1.2, z: 0.0 },
    { element: 'C', x: 1.3, y: 2.4, z: 0.0 },
    { element: 'C', x: 0.0, y: 2.4, z: 0.0 },
    { element: 'C', x: -0.7, y: 1.2, z: 0.0 },
    { element: 'O', x: 2.0, y: -1.2, z: 0.0 },
    { element: 'O', x: -2.0, y: 1.2, z: 0.0 },
    { element: 'N', x: -0.7, y: 3.6, z: 0.0 },
    { element: 'C', x: 0.0, y: 4.8, z: 0.0 },
    { element: 'N', x: 1.3, y: 4.8, z: 0.0 },
    { element: 'C', x: 2.0, y: 3.6, z: 0.0 }
  ],
  bonds: [
    { atom1: 0, atom2: 1, order: 1 },
    { atom1: 1, atom2: 2, order: 1 },
    { atom1: 2, atom2: 3, order: 2 },
    { atom1: 3, atom2: 4, order: 1 },
    { atom1: 4, atom2: 5, order: 1 },
    { atom1: 5, atom2: 0, order: 1 },
    { atom1: 1, atom2: 6, order: 2 },
    { atom1: 5, atom2: 7, order: 2 },
    { atom1: 4, atom2: 8, order: 1 },
    { atom1: 8, atom2: 9, order: 2 },
    { atom1: 9, atom2: 10, order: 1 },
    { atom1: 10, atom2: 11, order: 2 },
    { atom1: 11, atom2: 3, order: 1 }
  ],
  drugClass: 'Stimulant',
  targetProtein: 'Adenosine Receptors',
  bindingAffinity: -6.5,
  therapeuticUse: 'Central nervous system stimulant'
}

export const CAFFEINE_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  'simplified': {
    numQubits: 12,
    terms: [
      { paulis: 'IIIIIIIIIIII', coefficient: -285.4521 },
      { paulis: 'ZIIIIIIIIIII', coefficient: 0.1823 },
      { paulis: 'IZIIIIIIIIII', coefficient: 0.1823 },
      { paulis: 'IIZIIIIIIIII', coefficient: -0.2156 },
      { paulis: 'IIIZIIIIIIII', coefficient: -0.2156 },
      { paulis: 'IIIIZIIIIIII', coefficient: 0.1432 },
      { paulis: 'IIIIIZIIIIII', coefficient: 0.1432 },
      { paulis: 'IIIIIIZIIIII', coefficient: -0.1876 },
      { paulis: 'IIIIIIIZIIII', coefficient: -0.1876 },
      { paulis: 'ZZIIIIIIIIII', coefficient: 0.0892 },
      { paulis: 'IIZZIIIIIIII', coefficient: 0.0756 },
      { paulis: 'XXIIIIIIIIII', coefficient: 0.0234 },
      { paulis: 'YYIIIIIIIIII', coefficient: 0.0234 }
    ],
    exactEnergy: -285.8934,
    hartreeFockEnergy: -285.7621
  }
}

export const ASPIRIN_INFO: DrugMoleculeInfo = {
  id: 'aspirin',
  name: 'Aspirin (Simplified)',
  formula: 'C₉H₈O₄',
  description: 'Simplified aspirin model for quantum simulation',
  numAtoms: 21,
  numElectrons: 68,
  equilibriumBondLength: 1.4,
  bondLengthRange: [1.2, 1.6],
  qubitsRequired: {
    sto3g: 10,
    '6-31g': 20,
    'cc-pvdz': 40
  },
  atomPositions: [
    { element: 'C', x: 0.0, y: 0.0, z: 0.0 },
    { element: 'C', x: 1.4, y: 0.0, z: 0.0 },
    { element: 'C', x: 2.1, y: 1.2, z: 0.0 },
    { element: 'C', x: 1.4, y: 2.4, z: 0.0 },
    { element: 'C', x: 0.0, y: 2.4, z: 0.0 },
    { element: 'C', x: -0.7, y: 1.2, z: 0.0 },
    { element: 'O', x: 1.4, y: 3.8, z: 0.0 },
    { element: 'C', x: 2.7, y: 4.2, z: 0.0 },
    { element: 'O', x: 3.5, y: 3.2, z: 0.0 },
    { element: 'C', x: 3.0, y: 5.6, z: 0.0 },
    { element: 'O', x: -0.7, y: -1.0, z: 0.0 },
    { element: 'O', x: -2.0, y: -0.5, z: 0.0 }
  ],
  bonds: [
    { atom1: 0, atom2: 1, order: 2 },
    { atom1: 1, atom2: 2, order: 1 },
    { atom1: 2, atom2: 3, order: 2 },
    { atom1: 3, atom2: 4, order: 1 },
    { atom1: 4, atom2: 5, order: 2 },
    { atom1: 5, atom2: 0, order: 1 },
    { atom1: 3, atom2: 6, order: 1 },
    { atom1: 6, atom2: 7, order: 1 },
    { atom1: 7, atom2: 8, order: 2 },
    { atom1: 7, atom2: 9, order: 1 },
    { atom1: 0, atom2: 10, order: 1 },
    { atom1: 10, atom2: 11, order: 2 }
  ],
  drugClass: 'NSAID',
  targetProtein: 'Cyclooxygenase (COX)',
  bindingAffinity: -7.2,
  therapeuticUse: 'Pain relief, anti-inflammatory'
}

export const ASPIRIN_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  'simplified': {
    numQubits: 10,
    terms: [
      { paulis: 'IIIIIIIIII', coefficient: -412.3245 },
      { paulis: 'ZIIIIIIIII', coefficient: 0.1654 },
      { paulis: 'IZIIIIIIII', coefficient: 0.1654 },
      { paulis: 'IIZIIIIIII', coefficient: -0.1987 },
      { paulis: 'IIIZIIIIII', coefficient: -0.1987 },
      { paulis: 'IIIIZIIIII', coefficient: 0.1234 },
      { paulis: 'IIIIIZIIII', coefficient: 0.1234 },
      { paulis: 'ZZIIIIIIII', coefficient: 0.0765 },
      { paulis: 'IIZZIIIIII', coefficient: 0.0654 },
      { paulis: 'XXIIIIIIII', coefficient: 0.0198 },
      { paulis: 'YYIIIIIIII', coefficient: 0.0198 }
    ],
    exactEnergy: -412.7823,
    hartreeFockEnergy: -412.6234
  }
}

export const PENICILLIN_INFO: DrugMoleculeInfo = {
  id: 'penicillin',
  name: 'Penicillin G (Simplified)',
  formula: 'C₁₆H₁₈N₂O₄S',
  description: 'Simplified penicillin model for quantum simulation',
  numAtoms: 41,
  numElectrons: 142,
  equilibriumBondLength: 1.5,
  bondLengthRange: [1.2, 1.8],
  qubitsRequired: {
    sto3g: 14,
    '6-31g': 28,
    'cc-pvdz': 56
  },
  atomPositions: [
    { element: 'S', x: 0.0, y: 0.0, z: 0.0 },
    { element: 'C', x: 1.8, y: 0.0, z: 0.0 },
    { element: 'C', x: 2.3, y: 1.4, z: 0.0 },
    { element: 'N', x: 1.2, y: 2.2, z: 0.0 },
    { element: 'C', x: 0.0, y: 1.6, z: 0.0 },
    { element: 'C', x: 3.7, y: 1.8, z: 0.0 },
    { element: 'O', x: 4.5, y: 0.9, z: 0.0 },
    { element: 'N', x: 4.2, y: 3.1, z: 0.0 },
    { element: 'C', x: 5.5, y: 3.5, z: 0.0 },
    { element: 'O', x: 6.3, y: 2.6, z: 0.0 },
    { element: 'C', x: -1.2, y: 2.4, z: 0.0 },
    { element: 'O', x: -1.4, y: 3.6, z: 0.0 },
    { element: 'O', x: -2.2, y: 1.6, z: 0.0 }
  ],
  bonds: [
    { atom1: 0, atom2: 1, order: 1 },
    { atom1: 1, atom2: 2, order: 1 },
    { atom1: 2, atom2: 3, order: 1 },
    { atom1: 3, atom2: 4, order: 1 },
    { atom1: 4, atom2: 0, order: 1 },
    { atom1: 2, atom2: 5, order: 1 },
    { atom1: 5, atom2: 6, order: 2 },
    { atom1: 5, atom2: 7, order: 1 },
    { atom1: 7, atom2: 8, order: 1 },
    { atom1: 8, atom2: 9, order: 2 },
    { atom1: 4, atom2: 10, order: 1 },
    { atom1: 10, atom2: 11, order: 2 },
    { atom1: 10, atom2: 12, order: 1 }
  ],
  drugClass: 'Antibiotic',
  targetProtein: 'Penicillin-binding proteins',
  bindingAffinity: -8.1,
  therapeuticUse: 'Bacterial infection treatment'
}

export const PENICILLIN_HAMILTONIANS: Record<string, MolecularHamiltonian> = {
  'simplified': {
    numQubits: 14,
    terms: [
      { paulis: 'IIIIIIIIIIIIII', coefficient: -623.8765 },
      { paulis: 'ZIIIIIIIIIIIII', coefficient: 0.2134 },
      { paulis: 'IZIIIIIIIIIIII', coefficient: 0.2134 },
      { paulis: 'IIZIIIIIIIIIII', coefficient: -0.2567 },
      { paulis: 'IIIZIIIIIIIIII', coefficient: -0.2567 },
      { paulis: 'IIIIZIIIIIIIII', coefficient: 0.1876 },
      { paulis: 'IIIIIZIIIIIII', coefficient: 0.1876 },
      { paulis: 'ZZIIIIIIIIIIII', coefficient: 0.0987 },
      { paulis: 'IIZZIIIIIIIIII', coefficient: 0.0876 },
      { paulis: 'XXIIIIIIIIIIII', coefficient: 0.0312 },
      { paulis: 'YYIIIIIIIIIIII', coefficient: 0.0312 }
    ],
    exactEnergy: -624.4532,
    hartreeFockEnergy: -624.2187
  }
}

export const DRUG_DATABASE: Record<string, {
  info: DrugMoleculeInfo
  hamiltonians: Record<string, MolecularHamiltonian>
}> = {
  caffeine: { info: CAFFEINE_INFO, hamiltonians: CAFFEINE_HAMILTONIANS },
  aspirin: { info: ASPIRIN_INFO, hamiltonians: ASPIRIN_HAMILTONIANS },
  penicillin: { info: PENICILLIN_INFO, hamiltonians: PENICILLIN_HAMILTONIANS }
}

export function getDrugHamiltonian(drugId: string): MolecularHamiltonian | null {
  const drug = DRUG_DATABASE[drugId]
  if (!drug) return null
  return drug.hamiltonians['simplified'] || null
}

export function getDrugInfo(drugId: string): DrugMoleculeInfo | null {
  return DRUG_DATABASE[drugId]?.info || null
}

export function getAllDrugs(): DrugMoleculeInfo[] {
  return Object.values(DRUG_DATABASE).map(d => d.info)
}
