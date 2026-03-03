export interface PauliOperator {
  qubit: number
  pauli: 'I' | 'X' | 'Y' | 'Z'
}

export interface PauliTerm {
  paulis: string
  coefficient: number
}

export interface PauliTermBackend {
  coefficient: number
  operators: PauliOperator[]
}

export interface MolecularHamiltonian {
  numQubits: number
  terms: PauliTerm[]
  exactEnergy: number
  hartreeFockEnergy: number
  constantTerm?: number
}

export interface HamiltonianBackend {
  numQubits: number
  terms: PauliTermBackend[]
  constantTerm: number
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
  exactEnergy?: number
  parameters: number[]
  iterations: number
  converged: boolean
  chemicalAccuracy?: boolean
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

export type AnsatzType = 'hea' | 'uccsd' | 'k_upccgsd' | 'adapt' | 'qubit_adapt' | 'symmetry_preserved'

export type EntanglementType = 'linear' | 'circular' | 'full' | 'pairwise' | 'sca'

export interface AnsatzConfig {
  type: AnsatzType
  layers?: number
  numLayers?: number
  entanglement?: EntanglementType
  trotterOrder?: 1 | 2
  kFactor?: number
  gradientThreshold?: number
  maxOperators?: number
  includeRx?: boolean
  includeRy?: boolean
  includeRz?: boolean
  includeTriples?: boolean
  spinAdapted?: boolean
}

export type OptimizerType =
  | 'cobyla'
  | 'nelder_mead'
  | 'powell'
  | 'adam'
  | 'sgd'
  | 'lbfgsb'
  | 'slsqp'
  | 'spsa'
  | 'qn_spsa'
  | 'qng'
  | 'rotosolve'

export interface VQEOptimizerConfig {
  type: OptimizerType
  maxIterations: number
  tolerance: number
  learningRate?: number
  beta1?: number
  beta2?: number
  epsilon?: number
  perturbation?: number
  momentum?: number
  decay?: number
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

export function convertPauliStringToOperators(
  pauliString: string,
  numQubits: number
): PauliOperator[] {
  const operators: PauliOperator[] = []
  const paddedString = pauliString.padEnd(numQubits, 'I')

  for (let i = 0; i < paddedString.length; i++) {
    const p = paddedString[i] as 'I' | 'X' | 'Y' | 'Z'
    if (p !== 'I') {
      operators.push({ qubit: i, pauli: p })
    }
  }

  return operators
}

export function convertOperatorsToPauliString(
  operators: PauliOperator[],
  numQubits: number
): string {
  const chars = new Array(numQubits).fill('I')

  for (const op of operators) {
    if (op.qubit < numQubits) {
      chars[op.qubit] = op.pauli
    }
  }

  return chars.join('')
}

export function convertFrontendToBackendHamiltonian(
  hamiltonian: MolecularHamiltonian
): HamiltonianBackend {
  return {
    numQubits: hamiltonian.numQubits,
    constantTerm: hamiltonian.constantTerm || 0,
    terms: hamiltonian.terms.map(term => ({
      coefficient: term.coefficient,
      operators: convertPauliStringToOperators(term.paulis, hamiltonian.numQubits)
    }))
  }
}

export function convertBackendToFrontendHamiltonian(
  hamiltonian: HamiltonianBackend,
  exactEnergy: number,
  hartreeFockEnergy: number
): MolecularHamiltonian {
  return {
    numQubits: hamiltonian.numQubits,
    exactEnergy,
    hartreeFockEnergy,
    constantTerm: hamiltonian.constantTerm,
    terms: hamiltonian.terms.map(term => ({
      coefficient: term.coefficient,
      paulis: convertOperatorsToPauliString(term.operators, hamiltonian.numQubits)
    }))
  }
}
