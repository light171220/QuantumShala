import { useState, useEffect } from 'react'
import {
  FlaskConical,
  Database,
  Atom,
  LineChart,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { MoleculeExplorerTab } from '@/components/chemistry/tabs/MoleculeExplorerTab'
import { VQESimulatorTab } from '@/components/chemistry/tabs/VQESimulatorTab'
import { AnalysisToolsTab } from '@/components/chemistry/tabs/AnalysisToolsTab'
import { LearningCenterTab } from '@/components/chemistry/tabs/LearningCenterTab'
import { useChemistryStore } from '@/stores/chemistryStore'

export default function ChemistryLabPage() {
  const { activeTab, setActiveTab, _ensureInitialized } = useChemistryStore()
  const [selectedMoleculeForVQE, setSelectedMoleculeForVQE] = useState<string | null>(null)

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
          <Button variant="secondary" leftIcon={<BookOpen className="w-4 h-4" />} size="sm">
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
    </div>
  )
}
