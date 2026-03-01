import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Loader2,
  Download,
  Copy,
  ExternalLink,
  Atom,
  Database,
  Filter,
  Zap,
  Info,
  CheckCircle,
  Pill,
  Brain,
  Apple,
  Dna,
  Droplets,
  FlaskConical,
  Beaker,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { MoleculeViewer3D } from '@/components/chemistry/MoleculeViewer3D'
import {
  fetchMoleculeByName,
  getAutocompleteSuggestions,
  fetchSynonyms,
  MOLECULE_CATEGORIES,
  type PubChemMolecule
} from '@/lib/pubchem'
import {
  getAllMolecules,
  getMoleculeInfo,
} from '@/lib/chemistry/molecules/database'
import {
  getAllMaterials,
  getMaterialInfo,
} from '@/lib/chemistry/molecules/hamiltonians/materials'
import {
  getAllDrugs,
  getDrugInfo,
} from '@/lib/chemistry/molecules/hamiltonians/drug-molecules'
import type { MoleculeInfo } from '@/lib/chemistry/molecules/types'

export type SearchSource = 'all' | 'local' | 'pubchem'

interface MoleculeExplorerTabProps {
  onMoleculeSelect?: (molecule: MoleculeInfo | PubChemMolecule) => void
  onRunVQE?: (moleculeId: string) => void
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Pharmaceuticals': <Pill className="w-4 h-4" />,
  'Neurotransmitters': <Brain className="w-4 h-4" />,
  'Vitamins': <Apple className="w-4 h-4" />,
  'Hormones': <Dna className="w-4 h-4" />,
  'Simple Molecules': <Atom className="w-4 h-4" />,
  'Organic Solvents': <Droplets className="w-4 h-4" />,
  'Sugars': <FlaskConical className="w-4 h-4" />,
  'Amino Acids': <Beaker className="w-4 h-4" />
}

export function MoleculeExplorerTab({ onMoleculeSelect, onRunVQE }: MoleculeExplorerTabProps) {
  const [searchSource, setSearchSource] = useState<SearchSource>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMolecule, setSelectedMolecule] = useState<PubChemMolecule | null>(null)
  const [synonyms, setSynonyms] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [categoryMolecules, setCategoryMolecules] = useState<PubChemMolecule[]>([])
  const [categoryLoading, setCategoryLoading] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout>()
  const searchRef = useRef<HTMLDivElement>(null)

  const localMolecules = useMemo(() => getAllMolecules(), [])
  const materials = useMemo(() => getAllMaterials(), [])
  const drugs = useMemo(() => getAllDrugs(), [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    setSearchQuery(value)
    setError(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        if (searchSource !== 'local') {
          const results = await getAutocompleteSuggestions(value)
          setSuggestions(results)
          setShowSuggestions(results.length > 0)
        }
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [searchSource])

  const handleSearch = useCallback(async (query?: string) => {
    const searchTerm = query || searchQuery
    if (!searchTerm.trim()) return

    setIsLoading(true)
    setError(null)
    setShowSuggestions(false)

    try {
      if (searchSource === 'local') {
        const localMatch = [...localMolecules, ...materials, ...drugs].find(
          m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               m.formula.toLowerCase().includes(searchTerm.toLowerCase())
        )
        if (localMatch) {
          onMoleculeSelect?.(localMatch)
        } else {
          setError(`No local molecule found for "${searchTerm}"`)
        }
      } else {
        const molecule = await fetchMoleculeByName(searchTerm)
        if (molecule) {
          setSelectedMolecule(molecule)
          const syns = await fetchSynonyms(molecule.cid)
          setSynonyms(syns)
          onMoleculeSelect?.(molecule as any)
        } else {
          setError(`No molecule found for "${searchTerm}"`)
        }
      }
    } catch (err) {
      setError('Failed to fetch molecule data')
    }

    setIsLoading(false)
  }, [searchQuery, searchSource, localMolecules, materials, drugs, onMoleculeSelect])

  const handleCategoryClick = useCallback(async (category: string) => {
    if (activeCategory === category) {
      setActiveCategory(null)
      setCategoryMolecules([])
      return
    }

    setActiveCategory(category)
    setCategoryLoading(true)
    setCategoryMolecules([])

    const molecules = MOLECULE_CATEGORIES[category as keyof typeof MOLECULE_CATEGORIES] || []
    const results: PubChemMolecule[] = []

    for (const name of molecules.slice(0, 6)) {
      const mol = await fetchMoleculeByName(name)
      if (mol) results.push(mol)
    }

    setCategoryMolecules(results)
    setCategoryLoading(false)
  }, [activeCategory])

  const downloadMolecule = (format: 'sdf' | 'mol' | 'xyz' | 'json') => {
    if (!selectedMolecule) return

    let content = ''
    let filename = `${selectedMolecule.name}.${format}`

    if (format === 'json') {
      content = JSON.stringify(selectedMolecule, null, 2)
    } else if (format === 'xyz') {
      const atoms = selectedMolecule.atomPositions || []
      content = `${atoms.length}\n${selectedMolecule.name}\n`
      atoms.forEach(atom => {
        content += `${atom.element} ${atom.x.toFixed(6)} ${atom.y.toFixed(6)} ${atom.z.toFixed(6)}\n`
      })
    } else {
      content = JSON.stringify(selectedMolecule, null, 2)
    }

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const viewerMolecule = selectedMolecule ? {
    id: String(selectedMolecule.cid || 0),
    name: selectedMolecule.name || 'Unknown',
    formula: selectedMolecule.formula || '',
    numAtoms: selectedMolecule.numAtoms || 0,
    numElectrons: selectedMolecule.numElectrons || 0,
    equilibriumBondLength: 1.0,
    bondLengthRange: [0.5, 2.0] as [number, number],
    qubitsRequired: { sto3g: Math.ceil((selectedMolecule.numElectrons || 0) / 2), '6-31g': 0, 'cc-pvdz': 0 },
    description: selectedMolecule.iupacName || '',
    atomPositions: selectedMolecule.atomPositions || [],
    bonds: selectedMolecule.bonds || []
  } : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
      <div className="lg:col-span-4 space-y-4">
        <Card variant="neumorph" className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold text-white">Unified Search</h3>
          </div>

          <div className="flex gap-1 mb-4">
            {(['all', 'local', 'pubchem'] as const).map(source => (
              <button
                key={source}
                onClick={() => setSearchSource(source)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                  searchSource === source
                    ? 'bg-orange-500 text-white'
                    : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-400 hover:text-white'
                }`}
              >
                {source === 'all' ? 'All' : source === 'local' ? 'Local' : 'PubChem (116M+)'}
              </button>
            ))}
          </div>

          <div ref={searchRef} className="relative mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search molecules..."
                className="w-full pl-10 pr-4 py-2 bg-neumorph-base rounded-lg border border-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 animate-spin" />
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-neumorph-darker rounded-lg border border-white/5 shadow-xl max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchQuery(suggestion)
                      handleSearch(suggestion)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-orange-500/20 hover:text-white transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <Button
            onClick={() => handleSearch()}
            disabled={isLoading || !searchQuery.trim()}
            className="w-full"
            variant="primary"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </Card>

        <Card variant="neumorph" className="p-4">
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-400" />
            Browse by Category
          </h4>

          <div className="grid grid-cols-2 gap-2">
            {Object.keys(MOLECULE_CATEGORIES).map(category => (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
                  activeCategory === category
                    ? 'bg-orange-500/20 border border-orange-500 text-orange-400'
                    : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-400 hover:text-white'
                }`}
              >
                {CATEGORY_ICONS[category]}
                <span className="truncate">{category}</span>
              </button>
            ))}
          </div>

          {categoryLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
            </div>
          )}

          {categoryMolecules.length > 0 && (
            <div className="mt-4 space-y-2">
              {categoryMolecules.map(mol => (
                <button
                  key={mol.cid}
                  onClick={() => {
                    setSelectedMolecule(mol)
                    onMoleculeSelect?.(mol as any)
                  }}
                  className="w-full p-2 bg-neumorph-base rounded-lg text-left hover:bg-orange-500/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{mol.name}</span>
                    <Badge variant="secondary" size="sm">{mol.formula}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {mol.molecularWeight?.toFixed(2)} g/mol
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card variant="neumorph" className="p-4">
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Atom className="w-4 h-4 text-orange-400" />
            Local Database
          </h4>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {localMolecules.slice(0, 5).map(mol => (
              <button
                key={mol.id}
                onClick={() => onMoleculeSelect?.(mol)}
                className="w-full p-2 bg-neumorph-base rounded-lg text-left hover:bg-orange-500/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{mol.formula}</span>
                  <Badge variant="warning" size="sm">{mol.qubitsRequired.sto3g}q</Badge>
                </div>
                <div className="text-xs text-slate-500">{mol.name}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-8 space-y-4">
        {selectedMolecule ? (
          <>
            <Card variant="neumorph" className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedMolecule.name}</h2>
                  <p className="text-slate-400">{selectedMolecule.iupacName}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Copy className="w-4 h-4" />}
                    onClick={() => navigator.clipboard.writeText(selectedMolecule.smiles || '')}
                  >
                    SMILES
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<ExternalLink className="w-4 h-4" />}
                    onClick={() => window.open(`https://pubchem.ncbi.nlm.nih.gov/compound/${selectedMolecule.cid}`, '_blank')}
                  >
                    PubChem
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-neumorph-darker p-3 rounded-lg">
                  <div className="text-xs text-slate-500">Formula</div>
                  <div className="text-lg font-semibold text-white">{selectedMolecule.formula}</div>
                </div>
                <div className="bg-neumorph-darker p-3 rounded-lg">
                  <div className="text-xs text-slate-500">Molecular Weight</div>
                  <div className="text-lg font-semibold text-white">
                    {selectedMolecule.molecularWeight?.toFixed(2)} g/mol
                  </div>
                </div>
                <div className="bg-neumorph-darker p-3 rounded-lg">
                  <div className="text-xs text-slate-500">Atoms</div>
                  <div className="text-lg font-semibold text-white">{selectedMolecule.numAtoms}</div>
                </div>
                <div className="bg-neumorph-darker p-3 rounded-lg">
                  <div className="text-xs text-slate-500">Electrons</div>
                  <div className="text-lg font-semibold text-white">{selectedMolecule.numElectrons}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={() => downloadMolecule('xyz')}
                >
                  XYZ
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={() => downloadMolecule('json')}
                >
                  JSON
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Zap className="w-4 h-4" />}
                  onClick={() => onRunVQE?.(String(selectedMolecule.cid))}
                >
                  Run VQE
                </Button>
              </div>

              {synonyms.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="text-xs text-slate-500 mb-2">Also known as:</div>
                  <div className="flex flex-wrap gap-1">
                    {synonyms.slice(0, 8).map((syn, idx) => (
                      <Badge key={idx} variant="secondary" size="sm">{syn}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {viewerMolecule && (
              <Card variant="neumorph" className="overflow-hidden">
                <div className="h-[400px]">
                  <MoleculeViewer3D molecule={viewerMolecule} />
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card variant="neumorph" className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Explore 116+ Million Molecules
              </h3>
              <p className="text-slate-400 max-w-md">
                Search for any molecule by name, formula, or browse categories.
                Access the world's largest chemistry database with PubChem integration.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
