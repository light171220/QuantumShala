import { useState, useEffect } from 'react'
import {
  FlaskConical,
  Database,
  Atom,
  LineChart,
  BookOpen,
  Search,
  Zap,
  Target,
  TrendingDown,
  Lightbulb,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { MoleculeExplorerTab } from '@/components/chemistry/tabs/MoleculeExplorerTab'
import { VQESimulatorTab } from '@/components/chemistry/tabs/VQESimulatorTab'
import { AnalysisToolsTab } from '@/components/chemistry/tabs/AnalysisToolsTab'
import { LearningCenterTab } from '@/components/chemistry/tabs/LearningCenterTab'
import { useChemistryStore } from '@/stores/chemistryStore'

const GUIDE_SECTIONS = [
  {
    icon: Search,
    title: 'Molecule Explorer',
    color: 'from-blue-500 to-cyan-500',
    description: 'Search and explore molecules from PubChem\'s database of 116+ million compounds.',
    features: [
      'Search by molecule name, formula, or SMILES',
      'Browse molecules by category (pharmaceuticals, vitamins, etc.)',
      'View 3D molecular structures with interactive controls',
      'Download molecule data in XYZ or JSON format',
    ]
  },
  {
    icon: Atom,
    title: 'VQE Simulator',
    color: 'from-orange-500 to-yellow-500',
    description: 'Run Variational Quantum Eigensolver simulations to find molecular ground state energies.',
    features: [
      'Choose from multiple ansatz types (HEA, UCCSD, ADAPT-VQE)',
      'Configure optimizer settings (COBYLA, SPSA, Adam)',
      'Watch real-time convergence with energy plots',
      'Compare VQE results with exact and Hartree-Fock energies',
    ]
  },
  {
    icon: LineChart,
    title: 'Analysis Tools',
    color: 'from-purple-500 to-pink-500',
    description: 'Analyze molecular properties and visualize quantum chemistry results.',
    features: [
      'Generate Potential Energy Surface (PES) curves',
      'Visualize molecular orbitals and electron density',
      'Analyze bond characteristics and molecular geometry',
      'Export analysis results for further study',
    ]
  },
  {
    icon: Lightbulb,
    title: 'Learning Center',
    color: 'from-green-500 to-emerald-500',
    description: 'Learn quantum chemistry concepts with interactive tutorials and explanations.',
    features: [
      'Understand VQE algorithm and its applications',
      'Learn about molecular Hamiltonians and basis sets',
      'Explore ansatz design and optimization strategies',
      'Practice with guided examples and exercises',
    ]
  },
]

const QUICK_START_STEPS = [
  { step: 1, text: 'Search for a molecule in the Molecule Explorer tab' },
  { step: 2, text: 'Click "Run VQE" to start a quantum simulation' },
  { step: 3, text: 'Configure ansatz and optimizer settings' },
  { step: 4, text: 'Watch the energy converge to the ground state' },
]

export default function ChemistryLabPage() {
  const { activeTab, setActiveTab, _ensureInitialized } = useChemistryStore()
  const [selectedMoleculeForVQE, setSelectedMoleculeForVQE] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    _ensureInitialized()
  }, [_ensureInitialized])

  const handleMoleculeSelect = (molecule: any) => {
    setSelectedMoleculeForVQE(molecule.id || String(molecule.cid))
  }

  const handleRunVQE = (moleculeId: string) => {
    setSelectedMoleculeForVQE(moleculeId)
    setActiveTab('vqe')
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-white">
              Chemistry Lab
            </h1>
            <p className="text-sm text-slate-400">
              Quantum Chemistry Simulations with VQE
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="warning" size="sm">VQE</Badge>
          <Badge variant="success" size="sm">116M+ Molecules</Badge>
          <Button
            variant="secondary"
            leftIcon={<BookOpen className="w-4 h-4" />}
            size="sm"
            onClick={() => setShowGuide(true)}
          >
            <span className="hidden sm:inline">Guide</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as any)}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="explorer" className="text-xs md:text-sm">
              <Database className="w-4 h-4 mr-1" />
              Molecule Explorer
            </TabsTrigger>
            <TabsTrigger value="vqe" className="text-xs md:text-sm">
              <Atom className="w-4 h-4 mr-1" />
              VQE Simulator
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs md:text-sm">
              <LineChart className="w-4 h-4 mr-1" />
              Analysis Tools
            </TabsTrigger>
            <TabsTrigger value="learning" className="text-xs md:text-sm">
              <BookOpen className="w-4 h-4 mr-1" />
              Learning Center
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="explorer" className="mt-4 md:mt-6">
          <MoleculeExplorerTab
            onMoleculeSelect={handleMoleculeSelect}
            onRunVQE={handleRunVQE}
          />
        </TabsContent>

        <TabsContent value="vqe" className="mt-4 md:mt-6">
          <VQESimulatorTab initialMoleculeId={selectedMoleculeForVQE || undefined} />
        </TabsContent>

        <TabsContent value="analysis" className="mt-4 md:mt-6">
          <AnalysisToolsTab />
        </TabsContent>

        <TabsContent value="learning" className="mt-4 md:mt-6">
          <LearningCenterTab />
        </TabsContent>
      </Tabs>

      <Modal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        title="Chemistry Lab Guide"
        description="Learn how to use quantum chemistry simulations"
        size="full"
        variant="neumorph"
      >
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-400" />
              Quick Start
            </h3>
            <div className="space-y-2">
              {QUICK_START_STEPS.map(({ step, text }) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400">
                    {step}
                  </div>
                  <span className="text-sm text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GUIDE_SECTIONS.map((section) => (
              <div
                key={section.title}
                className="bg-neumorph-darker rounded-xl p-4 border border-white/5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center flex-shrink-0`}>
                    <section.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">{section.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{section.description}</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {section.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <ChevronRight className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="bg-neumorph-darker rounded-xl p-4 border border-white/5">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              What is VQE?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              The <span className="text-orange-400 font-medium">Variational Quantum Eigensolver (VQE)</span> is a hybrid quantum-classical algorithm used to find the ground state energy of molecules. It uses a parameterized quantum circuit (ansatz) to prepare trial states, measures the energy, and uses a classical optimizer to adjust parameters until the minimum energy is found.
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-green-400" />
                <span className="text-slate-400">Chemical accuracy: &lt;1.6 mHa error</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
