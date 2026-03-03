import { useEffect, useState } from 'react'
import {
  BookOpen,
  Library,
  Search,
  Sparkles,
  FolderOpen,
  ChevronRight,
  Zap,
  DollarSign,
  Cpu,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { LibraryTab, SearchTab, InsightsTab, CollectionsTab } from '@/components/research'
import { useResearchStore } from '@/stores/researchStore'
import type { ResearchTab } from '@/types/research'

const GUIDE_SECTIONS = [
  {
    icon: Library,
    title: 'Paper Library',
    color: 'from-blue-500 to-cyan-500',
    description: 'Upload and manage your research paper collection.',
    features: [
      'Upload PDFs up to 50MB',
      'Automatic text extraction',
      'Rate and track read status',
      'Organize with tags and collections',
    ],
  },
  {
    icon: Search,
    title: 'Smart Search',
    color: 'from-green-500 to-emerald-500',
    description: 'Search papers using BM25 + TF-IDF hybrid algorithm.',
    features: [
      'Full-text search across all papers',
      'Filter by tags, authors, and status',
      'Relevance-ranked results',
      'Keyword highlighting',
    ],
  },
  {
    icon: Sparkles,
    title: 'AI Insights',
    color: 'from-purple-500 to-pink-500',
    description: 'Extract insights using custom NLP algorithms.',
    features: [
      'LexRank extractive summaries',
      'TextRank keyword extraction',
      'Quantum algorithm detection',
      'Hamiltonian pattern recognition',
    ],
  },
  {
    icon: FolderOpen,
    title: 'Collections',
    color: 'from-yellow-500 to-orange-500',
    description: 'Organize papers into custom collections.',
    features: [
      'Create themed collections',
      'Customize colors and icons',
      'Track paper counts',
      'Quick access to related papers',
    ],
  },
]

const QUICK_START_STEPS = [
  { step: 1, text: 'Upload a research paper PDF to your library' },
  { step: 2, text: 'Wait for automatic text extraction and indexing' },
  { step: 3, text: 'Generate summaries and extract keywords' },
  { step: 4, text: 'Search across all papers with smart ranking' },
]

export default function ResearchHubPage() {
  const { activeTab, setActiveTab, initialize, isInitialized, papers, isLoading } = useResearchStore()
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [initialize, isInitialized])

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-white">
              Research Hub
            </h1>
            <p className="text-sm text-slate-400">
              Self-hosted Paper Intelligence System
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">
            <DollarSign className="w-3 h-3 mr-0.5" />
            $0 AI Cost
          </Badge>
          <Badge variant="info" size="sm">
            <Cpu className="w-3 h-3 mr-0.5" />
            Self-Hosted
          </Badge>
          <Badge variant="primary" size="sm">
            <FileText className="w-3 h-3 mr-0.5" />
            {papers.length} Papers
          </Badge>
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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as ResearchTab)}
      >
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="library" className="text-xs md:text-sm">
              <Library className="w-4 h-4 mr-1" />
              Library
            </TabsTrigger>
            <TabsTrigger value="search" className="text-xs md:text-sm">
              <Search className="w-4 h-4 mr-1" />
              Search
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs md:text-sm">
              <Sparkles className="w-4 h-4 mr-1" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="collections" className="text-xs md:text-sm">
              <FolderOpen className="w-4 h-4 mr-1" />
              Collections
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="library" className="mt-4 md:mt-6">
          <LibraryTab />
        </TabsContent>

        <TabsContent value="search" className="mt-4 md:mt-6">
          <SearchTab />
        </TabsContent>

        <TabsContent value="insights" className="mt-4 md:mt-6">
          <InsightsTab />
        </TabsContent>

        <TabsContent value="collections" className="mt-4 md:mt-6">
          <CollectionsTab />
        </TabsContent>
      </Tabs>

      {/* Guide Modal */}
      <Modal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        title="Research Hub Guide"
        description="Self-hosted paper intelligence with $0 AI costs"
        size="full"
        variant="neumorph"
      >
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {/* Zero cost highlight */}
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              $0 AI API Costs
            </h3>
            <p className="text-sm text-slate-300 mb-3">
              All algorithms are custom-built and self-hosted. No external AI APIs means zero ongoing costs.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <span className="text-green-400 font-medium">BM25</span>
                <p className="text-slate-400">Search</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <span className="text-green-400 font-medium">TF-IDF</span>
                <p className="text-slate-400">Ranking</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <span className="text-green-400 font-medium">LexRank</span>
                <p className="text-slate-400">Summaries</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <span className="text-green-400 font-medium">TextRank</span>
                <p className="text-slate-400">Keywords</p>
              </div>
            </div>
          </div>

          {/* Quick start */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              Quick Start
            </h3>
            <div className="space-y-2">
              {QUICK_START_STEPS.map(({ step, text }) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                    {step}
                  </div>
                  <span className="text-sm text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feature sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GUIDE_SECTIONS.map((section) => (
              <div
                key={section.title}
                className="bg-neumorph-darker rounded-xl p-4 border border-white/5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center flex-shrink-0`}
                  >
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

          {/* Algorithms explanation */}
          <div className="bg-neumorph-darker rounded-xl p-4 border border-white/5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              How the Algorithms Work
            </h3>
            <div className="space-y-3 text-sm text-slate-300">
              <div>
                <span className="text-purple-400 font-medium">BM25 Search:</span>
                <span className="ml-1">
                  Probabilistic ranking function that scores documents based on term frequency,
                  document length, and inverse document frequency.
                </span>
              </div>
              <div>
                <span className="text-blue-400 font-medium">LexRank Summarization:</span>
                <span className="ml-1">
                  Graph-based extractive summarization that ranks sentences by their similarity
                  to other sentences using PageRank.
                </span>
              </div>
              <div>
                <span className="text-green-400 font-medium">TextRank Keywords:</span>
                <span className="ml-1">
                  Graph-based keyword extraction using word co-occurrence networks and PageRank
                  to identify important terms.
                </span>
              </div>
              <div>
                <span className="text-orange-400 font-medium">Quantum Pattern Extraction:</span>
                <span className="ml-1">
                  Regex-based pattern matching to identify quantum algorithms, Hamiltonians,
                  gates, and metrics in paper text.
                </span>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
