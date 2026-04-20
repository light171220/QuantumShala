import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Atom,
  Activity,
  Target,
  Zap,
  Cpu,
  Info,
  ArrowRight,
  Download,
  History,
  Volume2,
  VolumeX,
  Cloud,
  Monitor,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { MoleculeViewer3D } from '@/components/chemistry/MoleculeViewer3D'
import { VQEProgressChart } from '@/components/chemistry/VQEProgressChart'
import {
  getAllMolecules,
  getMoleculeInfo,
  getHamiltonian,
} from '@/lib/chemistry/molecules/database'
import {
  getAllMaterials,
  getMaterialInfo,
  MATERIALS_DATABASE,
} from '@/lib/chemistry/molecules/hamiltonians/materials'
import {
  getAllDrugs,
  getDrugInfo,
  DRUG_DATABASE,
} from '@/lib/chemistry/molecules/hamiltonians/drug-molecules'
import { VQEEngine } from '@/lib/chemistry/vqe/engine'
import { selectVQEBackend, getBackendDescription, runVQEOnLambda } from '@/services/vqeLambda'
import type { MoleculeInfo, MolecularHamiltonian, VQEIterationData } from '@/lib/chemistry/molecules/types'

const ANSATZE = [
  { id: 'hea', name: 'HEA', fullName: 'Hardware Efficient Ansatz', description: 'Fast, hardware-optimized' },
  { id: 'uccsd', name: 'UCCSD', fullName: 'Unitary Coupled Cluster', description: 'High accuracy, deeper circuit' },
  { id: 'adapt', name: 'ADAPT', fullName: 'ADAPT-VQE', description: 'Adaptive growth' },
]

const OPTIMIZERS = [
  { id: 'cobyla', name: 'COBYLA', description: 'Gradient-free, robust' },
  { id: 'spsa', name: 'SPSA', description: 'Noise-resilient' },
  { id: 'adam', name: 'Adam', description: 'Adaptive learning rate' },
  { id: 'slsqp', name: 'SLSQP', description: 'Sequential quadratic' },
  { id: 'rotosolve', name: 'Rotosolve', description: 'Exact parameter opt' },
]

interface VQESimulatorTabProps {
  initialMoleculeId?: string
}

interface VQERun {
  id: string
  moleculeId: string
  ansatz: string
  optimizer: string
  energy: number
  error: number
  iterations: number
  converged: boolean
  timestamp: Date
  history: VQEIterationData[]
}

export function VQESimulatorTab({ initialMoleculeId }: VQESimulatorTabProps) {
  const [moleculeCategory, setMoleculeCategory] = useState<'basic' | 'materials' | 'drugs'>('basic')
  const [selectedMoleculeId, setSelectedMoleculeId] = useState(initialMoleculeId || 'h2')
  const [selectedAnsatz, setSelectedAnsatz] = useState(ANSATZE[0])
  const [selectedOptimizer, setSelectedOptimizer] = useState(OPTIMIZERS[0])
  const [maxIterations, setMaxIterations] = useState(50)
  const [numLayers, setNumLayers] = useState(2)
  const [noiseEnabled, setNoiseEnabled] = useState(false)
  const [noiseLevel, setNoiseLevel] = useState(0.01)

  const [isOptimizing, setIsOptimizing] = useState(false)
  const [vqeHistory, setVqeHistory] = useState<VQEIterationData[]>([])
  const [currentIteration, setCurrentIteration] = useState(0)
  const [vqeResult, setVqeResult] = useState<{
    energy: number
    error: number
    iterations: number
    converged: boolean
  } | null>(null)

  const [runHistory, setRunHistory] = useState<VQERun[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const allMolecules = useMemo(() => getAllMolecules(), [])
  const allMaterials = useMemo(() => getAllMaterials(), [])
  const allDrugs = useMemo(() => getAllDrugs(), [])

  const currentMoleculeList = useMemo(() => {
    if (moleculeCategory === 'basic') return allMolecules
    if (moleculeCategory === 'materials') return allMaterials
    return allDrugs
  }, [moleculeCategory, allMolecules, allMaterials, allDrugs])

  const selectedMolecule = useMemo((): MoleculeInfo | null => {
    if (moleculeCategory === 'basic') return getMoleculeInfo(selectedMoleculeId)
    if (moleculeCategory === 'materials') return getMaterialInfo(selectedMoleculeId)
    return getDrugInfo(selectedMoleculeId)
  }, [selectedMoleculeId, moleculeCategory])

  const selectedHamiltonian = useMemo((): MolecularHamiltonian | null => {
    if (moleculeCategory === 'basic') {
      const info = getMoleculeInfo(selectedMoleculeId)
      if (!info) return null
      return getHamiltonian(selectedMoleculeId, info.equilibriumBondLength)
    }
    if (moleculeCategory === 'materials') {
      const material = MATERIALS_DATABASE[selectedMoleculeId]
      if (!material) return null
      return Object.values(material.hamiltonians)[0] || null
    }
    const drug = DRUG_DATABASE[selectedMoleculeId]
    if (!drug) return null
    return drug.hamiltonians['simplified'] || null
  }, [selectedMoleculeId, moleculeCategory])

  const vqeBackend = useMemo(() => {
    if (!selectedHamiltonian) return 'browser'
    return selectVQEBackend(selectedHamiltonian.numQubits)
  }, [selectedHamiltonian])

  const backendInfo = useMemo(() => getBackendDescription(vqeBackend), [vqeBackend])

  const handleRunVQE = useCallback(async () => {
    if (!selectedHamiltonian || !selectedMolecule) return

    setIsOptimizing(true)
    setVqeHistory([])
    setCurrentIteration(0)
    setVqeResult(null)

    try {
      if (vqeBackend === 'browser') {
        const vqe = new VQEEngine({
          molecule: selectedMoleculeId,
          bondLength: selectedMolecule.equilibriumBondLength,
          ansatz: {
            type: selectedAnsatz.id as 'hea' | 'uccsd' | 'adapt',
            numLayers,
            entanglement: 'linear'
          },
          optimizer: {
            type: selectedOptimizer.id as 'cobyla' | 'spsa' | 'adam' | 'slsqp' | 'rotosolve',
            maxIterations,
            tolerance: 1e-6
          }
        })

        const result = vqe.run((iteration, energy) => {
          setCurrentIteration(iteration)
          setVqeHistory(prev => [...prev, { iteration, energy, parameters: [] }])
        })

        const vqeRes = {
          energy: result.energy,
          error: result.errorInKcalMol,
          iterations: result.iterations,
          converged: result.converged
        }

        setVqeResult(vqeRes)

        setRunHistory(prev => [...prev, {
          id: Date.now().toString(),
          moleculeId: selectedMoleculeId,
          ansatz: selectedAnsatz.name,
          optimizer: selectedOptimizer.name,
          energy: result.energy,
          error: result.errorInKcalMol,
          iterations: result.iterations,
          converged: result.converged,
          timestamp: new Date(),
          history: result.history
        }])
      } else {
        const result = await runVQEOnLambda({
          moleculeId: selectedMoleculeId,
          moleculeName: selectedMolecule.name,
          numQubits: selectedHamiltonian.numQubits,
          numElectrons: selectedMolecule.numElectrons,
          hamiltonian: selectedHamiltonian,
          ansatzType: selectedAnsatz.id as 'hea' | 'uccsd' | 'adapt' | 'qubit_adapt',
          numLayers,
          optimizerType: selectedOptimizer.id as 'cobyla' | 'spsa' | 'adam' | 'slsqp',
          maxIterations,
          tolerance: 1e-6
        })

        if (result.success) {
          setVqeResult({
            energy: result.energy || 0,
            error: result.errorInKcalMol || 0,
            iterations: result.iterations || 0,
            converged: result.converged || false
          })

          if (result.history) {
            setVqeHistory(result.history.map(h => ({
              iteration: h.iteration,
              energy: h.energy,
              parameters: []
            })))
          }
        }
      }
    } catch (error) {
      console.error('VQE error:', error)
    }

    setIsOptimizing(false)
  }, [
    selectedHamiltonian,
    selectedMolecule,
    selectedMoleculeId,
    selectedAnsatz,
    selectedOptimizer,
    maxIterations,
    numLayers,
    vqeBackend
  ])

  const stopOptimization = () => {
    setIsOptimizing(false)
  }

  const resetVQE = () => {
    setVqeHistory([])
    setCurrentIteration(0)
    setVqeResult(null)
  }

  const exportResults = () => {
    if (!vqeResult || !selectedMolecule) return

    const data = {
      molecule: selectedMolecule,
      hamiltonian: selectedHamiltonian,
      config: {
        ansatz: selectedAnsatz,
        optimizer: selectedOptimizer,
        maxIterations,
        numLayers
      },
      result: vqeResult,
      history: vqeHistory
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vqe_${selectedMoleculeId}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
      <div className="lg:col-span-3 order-2 lg:order-1 space-y-4">
        <Card variant="neumorph" className="p-4">
          <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
            <Atom className="w-4 h-4 text-orange-400" />
            Molecules
          </h3>

          <div className="flex gap-1 mb-3">
            {(['basic', 'materials', 'drugs'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setMoleculeCategory(cat)
                  setSelectedMoleculeId(cat === 'basic' ? 'h2' : cat === 'materials' ? 'nh3' : 'caffeine')
                  resetVQE()
                }}
                className={`px-2 py-1 text-xs rounded ${
                  moleculeCategory === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-400'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {currentMoleculeList.map((mol) => (
              <button
                key={mol.id}
                onClick={() => { setSelectedMoleculeId(mol.id); resetVQE() }}
                className={`w-full p-2 rounded-lg text-left transition-all ${
                  selectedMoleculeId === mol.id
                    ? 'bg-orange-500/20 border border-orange-500'
                    : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:bg-neumorph-base'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white text-sm">{mol.formula}</span>
                  <Badge variant="warning" size="sm">{mol.qubitsRequired.sto3g}q</Badge>
                </div>
                <div className="text-xs text-slate-400">{mol.name}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card variant="neumorph" className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-orange-400" />
              Configuration
            </h3>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-xs text-slate-400 hover:text-white"
            >
              {showSettings ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Ansatz</label>
              <div className="grid grid-cols-3 gap-1">
                {ANSATZE.map(ans => (
                  <button
                    key={ans.id}
                    onClick={() => setSelectedAnsatz(ans)}
                    className={`px-2 py-1.5 text-xs rounded ${
                      selectedAnsatz.id === ans.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-400'
                    }`}
                  >
                    {ans.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Optimizer</label>
              <div className="grid grid-cols-2 gap-1">
                {OPTIMIZERS.slice(0, 4).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedOptimizer(opt)}
                    className={`px-2 py-1.5 text-xs rounded ${
                      selectedOptimizer.id === opt.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-400'
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Max Iterations: {maxIterations}
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={200}
                      value={maxIterations}
                      onChange={(e) => setMaxIterations(Number(e.target.value))}
                      className="w-full accent-orange-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Ansatz Layers: {numLayers}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={numLayers}
                      onChange={(e) => setNumLayers(Number(e.target.value))}
                      className="w-full accent-orange-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Noise Simulation</span>
                    <button
                      onClick={() => setNoiseEnabled(!noiseEnabled)}
                      className={`p-1 rounded ${noiseEnabled ? 'bg-orange-500' : 'bg-neumorph-base'}`}
                    >
                      {noiseEnabled ? (
                        <Volume2 className="w-4 h-4 text-white" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>

        <Card variant="neumorph" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            {vqeBackend === 'browser' ? (
              <Monitor className="w-4 h-4 text-green-400" />
            ) : (
              <Cloud className="w-4 h-4 text-blue-400" />
            )}
            <span className="text-sm font-medium text-white">{backendInfo.name}</span>
          </div>
          <p className="text-xs text-slate-500">{backendInfo.description}</p>
          <div className="mt-2 text-xs text-slate-400">
            Max {backendInfo.maxQubits} qubits | {backendInfo.memory}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-6 space-y-4 order-1 lg:order-2">
        {selectedMolecule && (
          <Card variant="neumorph" className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedMolecule.name}</h2>
                <p className="text-sm text-slate-400">{selectedMolecule.formula}</p>
              </div>
              <div className="flex gap-2">
                {isOptimizing ? (
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Pause className="w-4 h-4" />}
                    onClick={stopOptimization}
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Play className="w-4 h-4" />}
                    onClick={handleRunVQE}
                    disabled={!selectedHamiltonian}
                  >
                    Run VQE
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  onClick={resetVQE}
                >
                  Reset
                </Button>
              </div>
            </div>

            {selectedHamiltonian && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-neumorph-darker p-3 rounded-lg">
                  <div className="text-xs text-slate-500">Qubits</div>
                  <div className="text-lg font-semibold text-white">{selectedHamiltonian.numQubits}</div>
                </div>
                <div className="bg-neumorph-darker p-3 rounded-lg">
                  <div className="text-xs text-slate-500">Terms</div>
                  <div className="text-lg font-semibold text-white">{selectedHamiltonian.terms.length}</div>
                </div>
                <div className="bg-neumorph-darker p-3 rounded-lg">
                  <div className="text-xs text-slate-500">Exact Energy</div>
                  <div className="text-lg font-semibold text-cyan-400">
                    {selectedHamiltonian.exactEnergy.toFixed(4)} Ha
                  </div>
                </div>
                <div className="bg-neumorph-darker p-3 rounded-lg">
                  <div className="text-xs text-slate-500">HF Energy</div>
                  <div className="text-lg font-semibold text-yellow-400">
                    {selectedHamiltonian.hartreeFockEnergy.toFixed(4)} Ha
                  </div>
                </div>
              </div>
            )}

            {isOptimizing && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">
                    Iteration {currentIteration} / {maxIterations}
                  </span>
                  <span className="text-sm text-orange-400">
                    {((currentIteration / maxIterations) * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={(currentIteration / maxIterations) * 100} variant="warning" />
              </div>
            )}

            {vqeResult && (
              <div className="bg-neumorph-darker p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  {vqeResult.converged ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  )}
                  <span className="font-medium text-white">
                    {vqeResult.converged ? 'Converged!' : 'Did not converge'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="text-xs text-slate-500">Final Energy</div>
                    <div className="text-lg font-semibold text-green-400">
                      {vqeResult.energy.toFixed(6)} Ha
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Error</div>
                    <div className={`text-lg font-semibold ${
                      Math.abs(vqeResult.error) < 1 ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {vqeResult.error.toFixed(3)} kcal/mol
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Iterations</div>
                    <div className="text-lg font-semibold text-white">{vqeResult.iterations}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Chem. Accuracy</div>
                    <div className={`text-lg font-semibold ${
                      Math.abs(vqeResult.error) < 1 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {Math.abs(vqeResult.error) < 1 ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={exportResults}
                  >
                    Export
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<History className="w-4 h-4" />}
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    History
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {vqeHistory.length > 0 && selectedHamiltonian && (
          <VQEProgressChart
            history={vqeHistory}
            hamiltonian={selectedHamiltonian}
          />
        )}
      </div>

      <div className="lg:col-span-3 order-3 space-y-4">
        {selectedMolecule && (
          <Card variant="neumorph" className="overflow-hidden">
            <div className="h-[250px]">
              <MoleculeViewer3D molecule={selectedMolecule} />
            </div>
          </Card>
        )}

        {showHistory && runHistory.length > 0 && (
          <Card variant="neumorph" className="p-4">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-orange-400" />
              Run History
            </h3>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {runHistory.slice().reverse().map(run => (
                <div
                  key={run.id}
                  className="p-2 bg-neumorph-darker rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{run.moleculeId}</span>
                    {run.converged ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {run.ansatz} | {run.optimizer} | {run.iterations} iters
                  </div>
                  <div className="text-xs text-green-400">
                    {run.energy.toFixed(6)} Ha ({run.error.toFixed(2)} kcal/mol)
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
