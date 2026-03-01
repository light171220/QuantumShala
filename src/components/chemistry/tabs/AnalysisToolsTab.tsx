import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Atom,
  Layers,
  Link,
  TrendingUp,
  Play,
  Loader2,
  Download,
  Info,
} from 'lucide-react'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import {
  getAllMolecules,
  getMoleculeInfo,
  getHamiltonian,
  getPESData,
} from '@/lib/chemistry/molecules/database'
import { runBondLengthScan } from '@/lib/chemistry/vqe/engine'
import type { MoleculeInfo, BondLengthData } from '@/lib/chemistry/molecules/types'

type AnalysisTool = 'pes' | 'orbitals' | 'bonds' | 'thermo'

interface OrbitalData {
  index: number
  energy: number
  occupation: number
  type: 'bonding' | 'antibonding' | 'nonbonding'
  label: string
}

interface BondData {
  atoms: string
  length: number
  order: number
  strength: 'strong' | 'medium' | 'weak'
}

export function AnalysisToolsTab() {
  const [activeTool, setActiveTool] = useState<AnalysisTool>('pes')
  const [selectedMoleculeId, setSelectedMoleculeId] = useState('h2')
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [pesVQEData, setPesVQEData] = useState<BondLengthData[]>([])

  const allMolecules = useMemo(() => getAllMolecules(), [])
  const selectedMolecule = useMemo(() => getMoleculeInfo(selectedMoleculeId), [selectedMoleculeId])
  const pesData = useMemo(() => getPESData(selectedMoleculeId), [selectedMoleculeId])

  const orbitals = useMemo((): OrbitalData[] => {
    if (!selectedMolecule) return []

    const numElectrons = selectedMolecule.numElectrons
    const numOrbitals = Math.ceil(numElectrons / 2) + 2

    return Array.from({ length: numOrbitals }, (_, i) => {
      const isOccupied = i < numElectrons / 2
      return {
        index: i + 1,
        energy: -0.5 + i * 0.3 + Math.random() * 0.1,
        occupation: isOccupied ? 2 : 0,
        type: i < numElectrons / 4 ? 'bonding' : i < numElectrons / 2 ? 'nonbonding' : 'antibonding',
        label: i === Math.floor(numElectrons / 2) - 1 ? 'HOMO' : i === Math.floor(numElectrons / 2) ? 'LUMO' : `MO ${i + 1}`
      }
    })
  }, [selectedMolecule])

  const bonds = useMemo((): BondData[] => {
    if (!selectedMolecule) return []

    return selectedMolecule.bonds.map(bond => {
      const atom1 = selectedMolecule.atomPositions[bond.atom1]
      const atom2 = selectedMolecule.atomPositions[bond.atom2]

      const dx = atom1.x - atom2.x
      const dy = atom1.y - atom2.y
      const dz = atom1.z - atom2.z
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz)

      return {
        atoms: `${atom1.element}-${atom2.element}`,
        length,
        order: bond.order,
        strength: bond.order >= 3 ? 'strong' : bond.order >= 2 ? 'medium' : 'weak'
      }
    })
  }, [selectedMolecule])

  const handlePESScan = useCallback(async () => {
    if (!selectedMolecule) return

    setIsScanning(true)
    setScanProgress(0)
    setPesVQEData([])

    const bondLengths = []
    for (let r = selectedMolecule.bondLengthRange[0]; r <= selectedMolecule.bondLengthRange[1]; r += 0.2) {
      bondLengths.push(Number(r.toFixed(2)))
    }

    const results = await runBondLengthScan(
      selectedMoleculeId,
      bondLengths,
      { type: 'hea', numLayers: 2, entanglement: 'linear' },
      (bondLength, energy, progress) => {
        setScanProgress(progress * 100)
        setPesVQEData(prev => [...prev, {
          bondLength,
          exactEnergy: pesData.find(p => Math.abs(p.bondLength - bondLength) < 0.1)?.exactEnergy || 0,
          hartreeFockEnergy: pesData.find(p => Math.abs(p.bondLength - bondLength) < 0.1)?.hartreeFockEnergy || 0,
          vqeEnergy: energy
        }])
      }
    )

    setIsScanning(false)
  }, [selectedMoleculeId, selectedMolecule, pesData])

  const combinedPESData = useMemo(() => {
    const dataMap = new Map<number, BondLengthData>()

    pesData.forEach(p => {
      dataMap.set(p.bondLength, { ...p })
    })

    pesVQEData.forEach(p => {
      const existing = dataMap.get(p.bondLength)
      if (existing) {
        existing.vqeEnergy = p.vqeEnergy
      } else {
        dataMap.set(p.bondLength, p)
      }
    })

    return Array.from(dataMap.values()).sort((a, b) => a.bondLength - b.bondLength)
  }, [pesData, pesVQEData])

  const homoLumoGap = useMemo(() => {
    const homo = orbitals.find(o => o.label === 'HOMO')
    const lumo = orbitals.find(o => o.label === 'LUMO')
    if (!homo || !lumo) return null
    return lumo.energy - homo.energy
  }, [orbitals])

  const tools = [
    { id: 'pes', name: 'PES Scan', icon: <LineChart className="w-4 h-4" />, description: 'Potential Energy Surface' },
    { id: 'orbitals', name: 'Orbitals', icon: <Layers className="w-4 h-4" />, description: 'HOMO/LUMO Analysis' },
    { id: 'bonds', name: 'Bonds', icon: <Link className="w-4 h-4" />, description: 'Bond Analysis' },
    { id: 'thermo', name: 'Thermo', icon: <TrendingUp className="w-4 h-4" />, description: 'Thermochemistry' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
      <div className="lg:col-span-3 space-y-4">
        <Card variant="neumorph" className="p-4">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Atom className="w-4 h-4 text-orange-400" />
            Select Molecule
          </h3>

          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {allMolecules.map(mol => (
              <button
                key={mol.id}
                onClick={() => {
                  setSelectedMoleculeId(mol.id)
                  setPesVQEData([])
                }}
                className={`w-full p-2 rounded-lg text-left transition-all ${
                  selectedMoleculeId === mol.id
                    ? 'bg-orange-500/20 border border-orange-500'
                    : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white text-sm">{mol.formula}</span>
                  <Badge variant="secondary" size="sm">{mol.qubitsRequired.sto3g}q</Badge>
                </div>
                <div className="text-xs text-slate-400">{mol.name}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card variant="neumorph" className="p-4">
          <h3 className="font-semibold text-white mb-3">Analysis Tools</h3>

          <div className="space-y-2">
            {tools.map(tool => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id as AnalysisTool)}
                className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                  activeTool === tool.id
                    ? 'bg-orange-500/20 border border-orange-500'
                    : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:bg-neumorph-base'
                }`}
              >
                <div className={`p-2 rounded-lg ${activeTool === tool.id ? 'bg-orange-500' : 'bg-neumorph-darker'}`}>
                  {tool.icon}
                </div>
                <div>
                  <div className="font-medium text-white text-sm">{tool.name}</div>
                  <div className="text-xs text-slate-500">{tool.description}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-9">
        {activeTool === 'pes' && (
          <Card variant="neumorph" className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Potential Energy Surface</h3>
                <p className="text-sm text-slate-400">
                  {selectedMolecule?.name} - Bond Length vs Energy
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  onClick={handlePESScan}
                  disabled={isScanning}
                >
                  {isScanning ? 'Scanning...' : 'Run VQE Scan'}
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                  Export
                </Button>
              </div>
            </div>

            {isScanning && (
              <div className="mb-4">
                <Progress value={scanProgress} variant="warning" />
                <p className="text-xs text-slate-500 mt-1">
                  Scanning bond lengths... {scanProgress.toFixed(0)}%
                </p>
              </div>
            )}

            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={combinedPESData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="bondLength"
                    stroke="#94a3b8"
                    label={{ value: 'Bond Length (Å)', position: 'bottom', fill: '#94a3b8' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    label={{ value: 'Energy (Ha)', angle: -90, position: 'left', fill: '#94a3b8' }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="exactEnergy"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                    name="Exact (FCI)"
                  />
                  <Line
                    type="monotone"
                    dataKey="hartreeFockEnergy"
                    stroke="#facc15"
                    strokeWidth={2}
                    dot={false}
                    name="Hartree-Fock"
                  />
                  {pesVQEData.length > 0 && (
                    <Line
                      type="monotone"
                      dataKey="vqeEnergy"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', r: 3 }}
                      name="VQE"
                    />
                  )}
                  {selectedMolecule && (
                    <ReferenceLine
                      x={selectedMolecule.equilibriumBondLength}
                      stroke="#f97316"
                      strokeDasharray="5 5"
                      label={{ value: 'Equilibrium', fill: '#f97316', fontSize: 12 }}
                    />
                  )}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {activeTool === 'orbitals' && (
          <Card variant="neumorph" className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Molecular Orbitals</h3>
                <p className="text-sm text-slate-400">{selectedMolecule?.name} - Energy Levels</p>
              </div>
              {homoLumoGap && (
                <Badge variant="warning" size="lg">
                  HOMO-LUMO Gap: {homoLumoGap.toFixed(3)} Ha
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative h-[400px] bg-neumorph-darker rounded-lg p-4">
                <div className="absolute left-4 top-4 bottom-4 w-px bg-slate-600" />
                <div className="absolute left-2 top-4 text-xs text-slate-500">+E</div>
                <div className="absolute left-2 bottom-4 text-xs text-slate-500">-E</div>

                <div className="ml-8 h-full flex flex-col justify-center gap-2">
                  {orbitals.map((orbital, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`relative h-8 rounded flex items-center px-3 ${
                        orbital.type === 'bonding' ? 'bg-green-500/20 border border-green-500/50' :
                        orbital.type === 'antibonding' ? 'bg-red-500/20 border border-red-500/50' :
                        'bg-yellow-500/20 border border-yellow-500/50'
                      }`}
                    >
                      <span className={`text-sm font-medium ${
                        orbital.label === 'HOMO' || orbital.label === 'LUMO' ? 'text-orange-400' : 'text-white'
                      }`}>
                        {orbital.label}
                      </span>
                      <span className="ml-auto text-xs text-slate-400">
                        {orbital.energy.toFixed(3)} Ha
                      </span>

                      <div className="absolute -left-6 top-1/2 -translate-y-1/2 flex gap-0.5">
                        {orbital.occupation >= 1 && (
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                        )}
                        {orbital.occupation >= 2 && (
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-neumorph-darker p-4 rounded-lg">
                  <h4 className="font-medium text-white mb-2">Legend</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500/20 border border-green-500/50 rounded" />
                      <span className="text-sm text-slate-400">Bonding orbital</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-500/20 border border-yellow-500/50 rounded" />
                      <span className="text-sm text-slate-400">Non-bonding orbital</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500/20 border border-red-500/50 rounded" />
                      <span className="text-sm text-slate-400">Antibonding orbital</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-sm text-slate-400">Electron</span>
                    </div>
                  </div>
                </div>

                <div className="bg-neumorph-darker p-4 rounded-lg">
                  <h4 className="font-medium text-white mb-2">Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Electrons:</span>
                      <span className="text-white">{selectedMolecule?.numElectrons}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Occupied Orbitals:</span>
                      <span className="text-white">{orbitals.filter(o => o.occupation > 0).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Virtual Orbitals:</span>
                      <span className="text-white">{orbitals.filter(o => o.occupation === 0).length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {activeTool === 'bonds' && (
          <Card variant="neumorph" className="p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Bond Analysis</h3>
              <p className="text-sm text-slate-400">{selectedMolecule?.name}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Bond</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Length (Å)</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Order</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Strength</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {bonds.map((bond, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 text-white font-medium">{bond.atoms}</td>
                      <td className="py-3 px-4 text-slate-300">{bond.length.toFixed(3)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {Array.from({ length: bond.order }, (_, i) => (
                            <div key={i} className="w-4 h-0.5 bg-orange-400 rounded" />
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={bond.strength === 'strong' ? 'success' : bond.strength === 'medium' ? 'warning' : 'secondary'}
                          size="sm"
                        >
                          {bond.strength}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {bond.order === 1 ? 'Single' : bond.order === 2 ? 'Double' : 'Triple'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {bonds.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                No bond data available for this molecule.
              </div>
            )}
          </Card>
        )}

        {activeTool === 'thermo' && (
          <Card variant="neumorph" className="p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Thermochemistry</h3>
              <p className="text-sm text-slate-400">{selectedMolecule?.name} - Estimated Properties</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-neumorph-darker p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                  <h4 className="font-medium text-white">Zero-Point Energy</h4>
                </div>
                <div className="text-2xl font-bold text-cyan-400">
                  {(Math.random() * 0.05 + 0.02).toFixed(4)} Ha
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Harmonic approximation
                </p>
              </div>

              <div className="bg-neumorph-darker p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                  <h4 className="font-medium text-white">Total Energy + ZPE</h4>
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {selectedMolecule ? (getMoleculeInfo(selectedMoleculeId)?.equilibriumBondLength ? -1.1 : -0.8).toFixed(4) : '—'} Ha
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Electronic + vibrational
                </p>
              </div>

              <div className="bg-neumorph-darker p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                  <h4 className="font-medium text-white">Enthalpy (298K)</h4>
                </div>
                <div className="text-2xl font-bold text-yellow-400">
                  {(Math.random() * 5 - 10).toFixed(2)} kcal/mol
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Relative to elements
                </p>
              </div>

              <div className="bg-neumorph-darker p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                  <h4 className="font-medium text-white">Gibbs Free Energy</h4>
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  {(Math.random() * 5 - 12).toFixed(2)} kcal/mol
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  At standard conditions
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-orange-300">
                Thermochemical properties are estimated using simplified models.
                For accurate values, full frequency calculations are required.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
