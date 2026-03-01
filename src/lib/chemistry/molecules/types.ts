export interface PauliTerm {
  paulis: string
  coefficient: number
}

export interface MolecularHamiltonian {
  numQubits: number
  terms: PauliTerm[]
  exactEnergy: number
  hartreeFockEnergy: number
}

export interface AtomPosition {
  element: string
  x: number
  y: number
  z: number
}

export interface ChemicalBond {
  atom1: number
  atom2: number
  order: 1 | 2 | 3
}

export interface MoleculeInfo {
  id: string
  name: string
  formula: string
  description: string
  numAtoms: number
  numElectrons: number
  equilibriumBondLength: number
  bondLengthRange: [number, number]
  bondAngle?: number
  qubitsRequired: {
    sto3g: number
    '6-31g': number
    'cc-pvdz': number
  }
  atomPositions: AtomPosition[]
  bonds: ChemicalBond[]
}

export interface BondLengthData {
  bondLength: number
  exactEnergy: number
  hartreeFockEnergy: number
  vqeEnergy?: number
}

export interface VQEResult {
  energy: number
  parameters: number[]
  iterations: number
  converged: boolean
  errorFromExact: number
  errorInKcalMol: number
  history: VQEIterationData[]
}

export interface VQEIterationData {
  iteration: number
  energy: number
  parameters: number[]
  gradientNorm?: number
}

export type AnsatzType = 'hea' | 'uccsd' | 'adaptive' | 'adapt' | 'qubit_adapt' | 'symmetry_preserved'

export interface AnsatzConfig {
  type: AnsatzType
  numLayers?: number
  entanglement?: 'linear' | 'circular' | 'full'
  includeRx?: boolean
  includeRy?: boolean
  includeRz?: boolean
}

export interface VQEOptimizerConfig {
  type: 'cobyla' | 'spsa' | 'adam' | 'nelder_mead' | 'slsqp' | 'lbfgsb' | 'rotosolve' | 'qng'
  maxIterations: number
  tolerance: number
  learningRate?: number
}

export interface VQEConfig {
  molecule: string
  bondLength: number
  ansatz: AnsatzConfig
  optimizer: VQEOptimizerConfig
  shots?: number
}

export type ExpectationMethod = 'exact' | 'sampling'

export type GroupingStrategy = 'qwc' | 'gc' | 'none'

export interface ChemistrySimulationState {
  isRunning: boolean
  currentIteration: number
  currentEnergy: number
  bestEnergy: number
  progress: number
  estimatedTimeRemaining?: number
}

export interface MolecularOrbital {
  index: number
  energy: number
  occupation: number
  type: 'bonding' | 'antibonding' | 'nonbonding'
  symmetry?: string
}

export interface DrugMoleculeInfo extends MoleculeInfo {
  drugClass: string
  targetProtein?: string
  bindingAffinity?: number
  therapeuticUse: string
}

export interface CatalystInfo extends MoleculeInfo {
  catalystType: 'homogeneous' | 'heterogeneous'
  reactionType: string
  activationEnergy?: number
}

export const CHEMICAL_ACCURACY_HARTREE = 0.0016
export const CHEMICAL_ACCURACY_KCAL_MOL = 1.0

export const HARTREE_TO_KCAL_MOL = 627.5094740631

export function hartreeToKcalMol(hartree: number): number {
  return hartree * HARTREE_TO_KCAL_MOL
}

export function isChemicallyAccurate(errorHartree: number): boolean {
  return Math.abs(errorHartree) <= CHEMICAL_ACCURACY_HARTREE
}
