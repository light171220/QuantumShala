import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  MoleculeInfo,
  MolecularHamiltonian,
  VQEResult,
  VQEIterationData,
  AnsatzType,
  BondLengthData
} from '@/lib/chemistry/molecules/types'
import { getAllMolecules, getMoleculeInfo, getHamiltonian, getPESData } from '@/lib/chemistry/molecules/database'

export type VisualizationMode = 'ball-stick' | 'space-fill' | 'wireframe'

export type ChemistryTab = 'explorer' | 'vqe' | 'analysis' | 'learning'

export type SearchSource = 'all' | 'local' | 'pubchem'

export type AnalysisTool = 'pes' | 'orbitals' | 'bonds' | 'thermo'

export interface VQERun {
  id: string
  moleculeId: string
  moleculeName: string
  ansatz: string
  optimizer: string
  energy: number
  error: number
  iterations: number
  converged: boolean
  timestamp: Date
  history: VQEIterationData[]
}

export interface OrbitalData {
  index: number
  energy: number
  occupation: number
  type: 'bonding' | 'antibonding' | 'nonbonding'
  label: string
}

export interface PESResult {
  bondLength: number
  exactEnergy: number
  hartreeFockEnergy: number
  vqeEnergy?: number
}

export interface VQEConfiguration {
  ansatzType: AnsatzType
  numLayers: number
  entanglement: 'linear' | 'circular' | 'full'
  optimizerType: 'cobyla' | 'spsa' | 'adam' | 'nelder_mead'
  maxIterations: number
  tolerance: number
  learningRate: number
}

interface ChemistryState {
  selectedMolecule: string
  availableMolecules: MoleculeInfo[]
  moleculeInfo: MoleculeInfo | null
  hamiltonian: MolecularHamiltonian | null

  currentBondLength: number
  bondLengthRange: [number, number]

  vqeConfig: VQEConfiguration

  isRunningVQE: boolean
  vqeResult: VQEResult | null
  vqeHistory: VQEIterationData[]
  currentIteration: number
  currentEnergy: number

  pesData: BondLengthData[]
  pesVQEData: BondLengthData[]
  isRunningScan: boolean
  scanProgress: number

  visualizationMode: VisualizationMode
  showBonds: boolean
  showLabels: boolean
  rotationSpeed: number

  activeTab: ChemistryTab
  showSettings: boolean
  error: string | null

  searchSource: SearchSource
  vqeRunHistory: VQERun[]
  noiseModelEnabled: boolean
  noiseLevel: number
  pesResults: PESResult[]
  orbitalData: OrbitalData[]
  activeAnalysisTool: AnalysisTool
}

interface ChemistryActions {
  _ensureInitialized: () => void
  selectMolecule: (moleculeId: string) => void
  setBondLength: (length: number) => void

  setVQEConfig: (config: Partial<VQEConfiguration>) => void
  setAnsatzType: (type: AnsatzType) => void
  setNumLayers: (layers: number) => void
  setOptimizer: (type: VQEConfiguration['optimizerType']) => void

  startVQE: () => void
  stopVQE: () => void
  updateVQEProgress: (iteration: number, energy: number, params: number[]) => void
  setVQEResult: (result: VQEResult) => void
  resetVQE: () => void

  startPESScan: () => void
  stopPESScan: () => void
  updatePESProgress: (progress: number, data: BondLengthData) => void
  setPESVQEData: (data: BondLengthData[]) => void

  setVisualizationMode: (mode: VisualizationMode) => void
  toggleBonds: () => void
  toggleLabels: () => void
  setRotationSpeed: (speed: number) => void

  setActiveTab: (tab: ChemistryTab) => void
  toggleSettings: () => void
  setError: (error: string | null) => void
  reset: () => void

  setSearchSource: (source: SearchSource) => void
  addVQERun: (run: VQERun) => void
  clearVQEHistory: () => void
  setNoiseModel: (enabled: boolean, level?: number) => void
  setPESResults: (results: PESResult[]) => void
  setOrbitalData: (data: OrbitalData[]) => void
  setActiveAnalysisTool: (tool: AnalysisTool) => void
}

const defaultVQEConfig: VQEConfiguration = {
  ansatzType: 'hea',
  numLayers: 2,
  entanglement: 'linear',
  optimizerType: 'cobyla',
  maxIterations: 100,
  tolerance: 1e-6,
  learningRate: 0.1
}

const staticInitialState: ChemistryState = {
  selectedMolecule: 'h2',
  availableMolecules: [],
  moleculeInfo: null,
  hamiltonian: null,
  currentBondLength: 0.74,
  bondLengthRange: [0.5, 2.5],
  vqeConfig: defaultVQEConfig,
  isRunningVQE: false,
  vqeResult: null,
  vqeHistory: [],
  currentIteration: 0,
  currentEnergy: 0,
  pesData: [],
  pesVQEData: [],
  isRunningScan: false,
  scanProgress: 0,
  visualizationMode: 'ball-stick',
  showBonds: true,
  showLabels: true,
  rotationSpeed: 0.5,
  activeTab: 'vqe',
  showSettings: false,
  error: null,
  searchSource: 'all',
  vqeRunHistory: [],
  noiseModelEnabled: false,
  noiseLevel: 0.01,
  pesResults: [],
  orbitalData: [],
  activeAnalysisTool: 'pes'
}

let _isInitialized = false

export const useChemistryStore = create<ChemistryState & ChemistryActions>()(
  immer((set, get) => ({
    ...staticInitialState,

    _ensureInitialized: () => {
      if (!_isInitialized) {
        _isInitialized = true
        set((state) => {
          state.availableMolecules = getAllMolecules()
          state.moleculeInfo = getMoleculeInfo('h2')
          state.hamiltonian = getHamiltonian('h2', 0.74)
          state.pesData = getPESData('h2')
        })
      }
    },

    selectMolecule: (moleculeId) =>
      set((state) => {
        const info = getMoleculeInfo(moleculeId)
        if (!info) {
          state.error = `Molecule ${moleculeId} not found`
          return
        }

        state.selectedMolecule = moleculeId
        state.moleculeInfo = info
        state.currentBondLength = info.equilibriumBondLength
        state.bondLengthRange = info.bondLengthRange
        state.hamiltonian = getHamiltonian(moleculeId, info.equilibriumBondLength)
        state.pesData = getPESData(moleculeId)
        state.pesVQEData = []
        state.vqeResult = null
        state.vqeHistory = []
        state.error = null
      }),

    setBondLength: (length) =>
      set((state) => {
        state.currentBondLength = length
        state.hamiltonian = getHamiltonian(state.selectedMolecule, length)

        if (state.moleculeInfo && state.moleculeInfo.atomPositions.length >= 2) {
          const ratio = length / state.moleculeInfo.equilibriumBondLength
        }
      }),

    setVQEConfig: (config) =>
      set((state) => {
        Object.assign(state.vqeConfig, config)
      }),

    setAnsatzType: (type) =>
      set((state) => {
        state.vqeConfig.ansatzType = type
        state.vqeResult = null
        state.vqeHistory = []
      }),

    setNumLayers: (layers) =>
      set((state) => {
        state.vqeConfig.numLayers = layers
        state.vqeResult = null
        state.vqeHistory = []
      }),

    setOptimizer: (type) =>
      set((state) => {
        state.vqeConfig.optimizerType = type
      }),

    startVQE: () =>
      set((state) => {
        state.isRunningVQE = true
        state.vqeHistory = []
        state.currentIteration = 0
        state.currentEnergy = 0
        state.error = null
      }),

    stopVQE: () =>
      set((state) => {
        state.isRunningVQE = false
      }),

    updateVQEProgress: (iteration, energy, params) =>
      set((state) => {
        state.currentIteration = iteration
        state.currentEnergy = energy
        state.vqeHistory.push({
          iteration,
          energy,
          parameters: params
        })
      }),

    setVQEResult: (result) =>
      set((state) => {
        state.vqeResult = result
        state.isRunningVQE = false
        state.vqeHistory = result.history
      }),

    resetVQE: () =>
      set((state) => {
        state.vqeResult = null
        state.vqeHistory = []
        state.currentIteration = 0
        state.currentEnergy = 0
        state.isRunningVQE = false
      }),

    startPESScan: () =>
      set((state) => {
        state.isRunningScan = true
        state.scanProgress = 0
        state.pesVQEData = []
        state.error = null
      }),

    stopPESScan: () =>
      set((state) => {
        state.isRunningScan = false
      }),

    updatePESProgress: (progress, data) =>
      set((state) => {
        state.scanProgress = progress
        state.pesVQEData.push(data)
      }),

    setPESVQEData: (data) =>
      set((state) => {
        state.pesVQEData = data
        state.isRunningScan = false
      }),

    setVisualizationMode: (mode) =>
      set((state) => {
        state.visualizationMode = mode
      }),

    toggleBonds: () =>
      set((state) => {
        state.showBonds = !state.showBonds
      }),

    toggleLabels: () =>
      set((state) => {
        state.showLabels = !state.showLabels
      }),

    setRotationSpeed: (speed) =>
      set((state) => {
        state.rotationSpeed = speed
      }),

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab
      }),

    toggleSettings: () =>
      set((state) => {
        state.showSettings = !state.showSettings
      }),

    setError: (error) =>
      set((state) => {
        state.error = error
        state.isRunningVQE = false
        state.isRunningScan = false
      }),

    reset: () => {
      _isInitialized = false
      set(() => staticInitialState)
    },

    setSearchSource: (source) =>
      set((state) => {
        state.searchSource = source
      }),

    addVQERun: (run) =>
      set((state) => {
        state.vqeRunHistory.push(run)
        if (state.vqeRunHistory.length > 20) {
          state.vqeRunHistory = state.vqeRunHistory.slice(-20)
        }
      }),

    clearVQEHistory: () =>
      set((state) => {
        state.vqeRunHistory = []
      }),

    setNoiseModel: (enabled, level) =>
      set((state) => {
        state.noiseModelEnabled = enabled
        if (level !== undefined) {
          state.noiseLevel = level
        }
      }),

    setPESResults: (results) =>
      set((state) => {
        state.pesResults = results
      }),

    setOrbitalData: (data) =>
      set((state) => {
        state.orbitalData = data
      }),

    setActiveAnalysisTool: (tool) =>
      set((state) => {
        state.activeAnalysisTool = tool
      })
  }))
)

export const selectIsChemicallyAccurate = (state: ChemistryState): boolean => {
  if (!state.vqeResult) return false
  return Math.abs(state.vqeResult.errorFromExact) <= 0.0016
}

export const selectEnergyImprovement = (state: ChemistryState): number => {
  if (!state.hamiltonian || !state.vqeResult) return 0
  return state.hamiltonian.hartreeFockEnergy - state.vqeResult.energy
}

export const selectCorrelationEnergy = (state: ChemistryState): number => {
  if (!state.hamiltonian) return 0
  return state.hamiltonian.exactEnergy - state.hamiltonian.hartreeFockEnergy
}

export const ANSATZ_DESCRIPTIONS: Record<AnsatzType, { name: string; description: string }> = {
  hea: {
    name: 'Hardware-Efficient Ansatz (HEA)',
    description: 'General-purpose ansatz with parameterized single-qubit rotations and entangling gates. Fast to run but may require more iterations.'
  },
  uccsd: {
    name: 'UCCSD',
    description: 'Unitary Coupled Cluster Singles and Doubles. Chemistry-inspired ansatz that captures electron correlation. More accurate but deeper circuits.'
  },
  k_upccgsd: {
    name: 'k-UpCCGSD',
    description: 'k-fold Unitary Paired Coupled Cluster with Generalized Singles and Doubles. Compact ansatz for strongly correlated systems.'
  },
  adapt: {
    name: 'ADAPT-VQE',
    description: 'Adaptive ansatz that grows dynamically based on gradient information. Balances accuracy and circuit depth.'
  },
  qubit_adapt: {
    name: 'Qubit-ADAPT',
    description: 'Hardware-efficient Pauli string version of ADAPT-VQE. Uses single and two-qubit Pauli rotations.'
  },
  symmetry_preserved: {
    name: 'Symmetry-Preserved',
    description: 'Ansatz that preserves particle number and spin symmetries. Ensures physically meaningful states.'
  }
}

export const OPTIMIZER_DESCRIPTIONS: Record<VQEConfiguration['optimizerType'], { name: string; description: string }> = {
  cobyla: {
    name: 'COBYLA',
    description: 'Constrained Optimization BY Linear Approximations. Gradient-free, works well for noisy objectives.'
  },
  spsa: {
    name: 'SPSA',
    description: 'Simultaneous Perturbation Stochastic Approximation. Efficient gradient estimation, robust to noise.'
  },
  adam: {
    name: 'Adam',
    description: 'Adaptive Moment Estimation. Gradient-based with momentum, fast convergence for smooth objectives.'
  },
  nelder_mead: {
    name: 'Nelder-Mead',
    description: 'Simplex-based optimization. Gradient-free, good for low-dimensional problems.'
  }
}
