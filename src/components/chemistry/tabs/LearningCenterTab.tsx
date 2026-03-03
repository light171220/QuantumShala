import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Trophy,
  Lightbulb,
  Play,
  CheckCircle,
  Lock,
  Star,
  ArrowRight,
  ArrowLeft,
  Clock,
  Target,
  Zap,
  Award,
  Atom,
  FileText,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import {
  getChemistryIndex,
  getTutorial,
  getGuide,
  getReference,
  type ChemistryIndex,
  type ContentSummary,
  type TutorialContent,
  type GuideContent,
  type ReferenceContent,
} from '@/services/chemistryContent'

type LearningSection = 'tutorials' | 'guides' | 'references' | 'challenges' | 'cases'

interface Challenge {
  id: string
  title: string
  description: string
  points: number
  difficulty: 'easy' | 'medium' | 'hard'
  completed: boolean
  locked: boolean
  moleculeRequired?: string
  accuracyTarget?: number
}

interface CaseStudy {
  id: string
  title: string
  industry: string
  icon: string
  molecule: string
  qubits: number
  impact: string
  description: string
  learnings: string[]
}

const CHALLENGES: Challenge[] = [
  {
    id: 'h2-ground-state',
    title: 'H2 Ground State',
    description: 'Find the ground state energy of hydrogen molecule within chemical accuracy',
    points: 100,
    difficulty: 'easy',
    completed: false,
    locked: false,
    moleculeRequired: 'h2',
    accuracyTarget: 1.0
  },
  {
    id: 'lih-optimization',
    title: 'LiH Optimization',
    description: 'Optimize LiH energy using UCCSD ansatz in under 50 iterations',
    points: 200,
    difficulty: 'medium',
    completed: false,
    locked: false,
    moleculeRequired: 'lih',
    accuracyTarget: 1.5
  },
  {
    id: 'pes-master',
    title: 'PES Master',
    description: 'Generate a complete potential energy surface for H2',
    points: 300,
    difficulty: 'medium',
    completed: false,
    locked: false,
  },
  {
    id: 'convergence-speedrun',
    title: 'Convergence Speedrun',
    description: 'Achieve chemical accuracy in under 20 iterations on BeH2',
    points: 500,
    difficulty: 'hard',
    completed: false,
    locked: true,
    moleculeRequired: 'beh2',
    accuracyTarget: 1.0
  },
  {
    id: 'noise-resilient',
    title: 'Noise Resilient',
    description: 'Achieve accuracy under 2 kcal/mol with noise enabled',
    points: 750,
    difficulty: 'hard',
    completed: false,
    locked: true,
  },
]

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'drug-discovery',
    title: 'Drug Discovery',
    industry: 'Pharmaceutical',
    icon: '💊',
    molecule: 'Caffeine-Adenosine',
    qubits: 20,
    impact: 'Faster drug screening',
    description: 'Explore how quantum computing accelerates drug-receptor binding predictions and virtual screening.',
    learnings: [
      'Binding affinity calculations',
      'Molecular docking simulations',
      'Quantum advantage for large molecules'
    ]
  },
  {
    id: 'catalyst-design',
    title: 'Catalyst Design',
    industry: 'Chemical Engineering',
    icon: '⚗️',
    molecule: 'FeMoco (Nitrogenase)',
    qubits: 54,
    impact: 'Sustainable fertilizers',
    description: 'Learn how quantum simulations help design better catalysts for nitrogen fixation.',
    learnings: [
      'Transition metal complexes',
      'Reaction mechanisms',
      'Industrial applications'
    ]
  },
  {
    id: 'battery-materials',
    title: 'Battery Materials',
    industry: 'Energy Storage',
    icon: '🔋',
    molecule: 'Li-ion Intercalation',
    qubits: 30,
    impact: 'Better energy storage',
    description: 'Discover how quantum chemistry improves lithium-ion battery materials.',
    learnings: [
      'Electrode materials',
      'Ion transport',
      'Energy density optimization'
    ]
  },
  {
    id: 'solar-cells',
    title: 'Solar Cells',
    industry: 'Renewable Energy',
    icon: '☀️',
    molecule: 'Perovskite Structure',
    qubits: 40,
    impact: 'Cheaper solar energy',
    description: 'See how quantum simulations help design efficient perovskite solar cells.',
    learnings: [
      'Band gap engineering',
      'Charge transfer',
      'Stability optimization'
    ]
  },
]

function ContentViewer({
  content,
  onBack,
  type
}: {
  content: TutorialContent | GuideContent | ReferenceContent
  onBack: () => void
  type: 'tutorial' | 'guide' | 'reference'
}) {
  const [currentSection, setCurrentSection] = useState(0)

  const sections = content.sections || []
  const section = sections[currentSection]

  const renderMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <h4 key={i} className="font-bold text-white mt-4 mb-2">{line.slice(2, -2)}</h4>
        }
        if (line.startsWith('```')) {
          return null
        }
        if (line.startsWith('|')) {
          return <div key={i} className="font-mono text-xs text-slate-400 bg-black/20 px-2 py-0.5">{line}</div>
        }
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <ChevronRight className="w-3 h-3 text-orange-400 mt-1 flex-shrink-0" />
              <span className="text-slate-300 text-sm">{line.slice(2)}</span>
            </div>
          )
        }
        if (line.match(/^\d+\./)) {
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <span className="text-orange-400 font-mono text-sm">{line.match(/^\d+/)?.[0]}.</span>
              <span className="text-slate-300 text-sm">{line.replace(/^\d+\.\s*/, '')}</span>
            </div>
          )
        }
        const formatted = line
          .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>')
          .replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1 py-0.5 rounded text-orange-300 text-xs">$1</code>')
        return <p key={i} className="text-slate-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
      })
  }

  return (
    <Card variant="neumorph" className="p-6">
      <button
        onClick={onBack}
        className="text-sm text-slate-400 hover:text-white mb-4 flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {type === 'tutorial' ? 'Tutorials' : type === 'guide' ? 'Guides' : 'References'}
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {'difficulty' in content && (
            <Badge
              variant={content.difficulty === 'beginner' ? 'success' : content.difficulty === 'intermediate' ? 'warning' : 'danger'}
              size="sm"
            >
              {content.difficulty}
            </Badge>
          )}
          {'estimatedMinutes' in content && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {content.estimatedMinutes} min
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{content.title}</h2>
        <p className="text-slate-400">{content.description}</p>
      </div>

      {'learningObjectives' in content && content.learningObjectives && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <h3 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Learning Objectives
          </h3>
          <ul className="space-y-1">
            {content.learningObjectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {sections.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentSection(i)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
              currentSection === i
                ? 'bg-orange-500 text-white'
                : 'bg-neumorph-darker text-slate-400 hover:text-white'
            }`}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </div>

      {section && (
        <div className="bg-neumorph-darker rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">{section.title}</h3>
          <div className="space-y-2">
            {renderMarkdown(section.content)}
          </div>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
          disabled={currentSection === 0}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Previous
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCurrentSection(Math.min(sections.length - 1, currentSection + 1))}
          disabled={currentSection === sections.length - 1}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Next
        </Button>
      </div>
    </Card>
  )
}

export function LearningCenterTab() {
  const [activeSection, setActiveSection] = useState<LearningSection>('tutorials')
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null)
  const [index, setIndex] = useState<ChemistryIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedContent, setSelectedContent] = useState<{
    type: 'tutorial' | 'guide' | 'reference'
    content: TutorialContent | GuideContent | ReferenceContent
  } | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)

  useEffect(() => {
    async function loadIndex() {
      try {
        setLoading(true)
        setError(null)
        const data = await getChemistryIndex()
        if (data) {
          setIndex(data)
        } else {
          setError('Failed to load content index')
        }
      } catch (err) {
        setError('Failed to load content')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadIndex()
  }, [])

  const handleSelectTutorial = async (item: ContentSummary) => {
    setLoadingContent(true)
    const content = await getTutorial(item.id)
    if (content) {
      setSelectedContent({ type: 'tutorial', content })
    }
    setLoadingContent(false)
  }

  const handleSelectGuide = async (item: ContentSummary) => {
    setLoadingContent(true)
    const content = await getGuide(item.id)
    if (content) {
      setSelectedContent({ type: 'guide', content })
    }
    setLoadingContent(false)
  }

  const handleSelectReference = async (item: ContentSummary) => {
    setLoadingContent(true)
    const content = await getReference(item.id)
    if (content) {
      setSelectedContent({ type: 'reference', content })
    }
    setLoadingContent(false)
  }

  const totalPoints = useMemo(() =>
    CHALLENGES.filter(c => c.completed).reduce((sum, c) => sum + c.points, 0),
    []
  )

  const sections = [
    { id: 'tutorials', name: 'Tutorials', icon: <BookOpen className="w-4 h-4" />, count: index?.tutorials?.length || 0 },
    { id: 'guides', name: 'Guides', icon: <FileText className="w-4 h-4" />, count: index?.guides?.length || 0 },
    { id: 'references', name: 'References', icon: <Lightbulb className="w-4 h-4" />, count: index?.reference?.length || 0 },
    { id: 'challenges', name: 'Challenges', icon: <Trophy className="w-4 h-4" />, count: `${totalPoints} pts` },
    { id: 'cases', name: 'Case Studies', icon: <Award className="w-4 h-4" />, count: CASE_STUDIES.length },
  ]

  const difficultyColors = {
    beginner: 'text-green-400 bg-green-500/20',
    intermediate: 'text-yellow-400 bg-yellow-500/20',
    advanced: 'text-red-400 bg-red-500/20',
    easy: 'text-green-400',
    medium: 'text-yellow-400',
    hard: 'text-red-400',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
        <span className="ml-3 text-slate-400">Loading learning content...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-slate-400 mb-4">{error}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (selectedContent) {
    return (
      <ContentViewer
        content={selectedContent.content}
        type={selectedContent.type}
        onBack={() => setSelectedContent(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Learning Center</h2>
          <p className="text-sm text-slate-400">Master quantum chemistry through interactive tutorials and challenges</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-neumorph-darker px-4 py-2 rounded-lg">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="font-semibold text-white">{totalPoints}</span>
            <span className="text-sm text-slate-400">points</span>
          </div>
          <div className="flex items-center gap-2 bg-neumorph-darker px-4 py-2 rounded-lg">
            <Star className="w-5 h-5 text-orange-400" />
            <span className="font-semibold text-white">{index?.tutorials?.length || 0}</span>
            <span className="text-sm text-slate-400">tutorials</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as LearningSection)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
              activeSection === section.id
                ? 'bg-orange-500 text-white'
                : 'bg-neumorph-base shadow-neumorph-sm border border-white/[0.02] text-slate-400 hover:text-white'
            }`}
          >
            {section.icon}
            <span className="font-medium">{section.name}</span>
            <Badge variant="secondary" size="sm">{section.count}</Badge>
          </button>
        ))}
      </div>

      {loadingContent && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          <span className="ml-2 text-slate-400">Loading content...</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeSection === 'tutorials' && !loadingContent && (
          <motion.div
            key="tutorials"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {index?.tutorials?.map(tutorial => (
              <Card key={tutorial.id} variant="neumorph" className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {tutorial.difficulty && (
                      <div className={`px-2 py-1 rounded text-xs font-medium ${difficultyColors[tutorial.difficulty]}`}>
                        {tutorial.difficulty}
                      </div>
                    )}
                    {tutorial.estimatedMinutes && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {tutorial.estimatedMinutes} min
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-white mb-2">{tutorial.title}</h3>
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{tutorial.description}</p>

                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  leftIcon={<Play className="w-4 h-4" />}
                  onClick={() => handleSelectTutorial(tutorial)}
                >
                  Start Tutorial
                </Button>
              </Card>
            ))}
          </motion.div>
        )}

        {activeSection === 'guides' && !loadingContent && (
          <motion.div
            key="guides"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {index?.guides?.map(guide => (
              <Card key={guide.id} variant="neumorph" className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{guide.title}</h3>
                      {guide.difficulty && (
                        <Badge variant={guide.difficulty === 'beginner' ? 'success' : guide.difficulty === 'intermediate' ? 'warning' : 'danger'} size="sm">
                          {guide.difficulty}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mb-3">{guide.description}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSelectGuide(guide)}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Read Guide
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </motion.div>
        )}

        {activeSection === 'references' && !loadingContent && (
          <motion.div
            key="references"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {index?.reference?.map(ref => (
              <Card key={ref.id} variant="neumorph" className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{ref.title}</h3>
                    <p className="text-sm text-slate-400 mb-3">{ref.description}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSelectReference(ref)}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      View Reference
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </motion.div>
        )}

        {activeSection === 'challenges' && (
          <motion.div
            key="challenges"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {CHALLENGES.map(challenge => (
              <Card key={challenge.id} variant="neumorph" className="p-4 relative overflow-hidden">
                {challenge.locked && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="text-center">
                      <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Complete previous challenges</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      challenge.completed ? 'bg-green-500/20' : 'bg-orange-500/20'
                    }`}>
                      {challenge.completed ? (
                        <CheckCircle className="w-6 h-6 text-green-400" />
                      ) : (
                        <Target className="w-6 h-6 text-orange-400" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{challenge.title}</h3>
                        <div className={`px-2 py-0.5 rounded text-xs font-medium ${difficultyColors[challenge.difficulty]}`}>
                          {challenge.difficulty}
                        </div>
                      </div>
                      <p className="text-sm text-slate-400">{challenge.description}</p>
                      {challenge.accuracyTarget && (
                        <p className="text-xs text-slate-500 mt-1">
                          Target: &lt; {challenge.accuracyTarget} kcal/mol
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="font-bold text-white">{challenge.points}</span>
                      </div>
                      <span className="text-xs text-slate-500">points</span>
                    </div>

                    <Button
                      variant={challenge.completed ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={challenge.locked}
                    >
                      {challenge.completed ? 'Completed' : 'Start'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </motion.div>
        )}

        {activeSection === 'cases' && !selectedCaseStudy && (
          <motion.div
            key="cases"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {CASE_STUDIES.map(study => (
              <Card
                key={study.id}
                variant="neumorph"
                className="p-6 cursor-pointer hover:border-orange-500/50 transition-all"
                onClick={() => setSelectedCaseStudy(study)}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{study.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{study.title}</h3>
                      <Badge variant="secondary" size="sm">{study.industry}</Badge>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">{study.description}</p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-slate-500">
                        <Atom className="w-4 h-4" />
                        {study.molecule}
                      </div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <Zap className="w-4 h-4" />
                        {study.qubits} qubits
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>
              </Card>
            ))}
          </motion.div>
        )}

        {activeSection === 'cases' && selectedCaseStudy && (
          <motion.div
            key="case-detail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card variant="neumorph" className="p-6">
              <button
                onClick={() => setSelectedCaseStudy(null)}
                className="text-sm text-slate-400 hover:text-white mb-4 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Case Studies
              </button>

              <div className="flex items-start gap-6 mb-6">
                <div className="text-6xl">{selectedCaseStudy.icon}</div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedCaseStudy.title}</h2>
                  <p className="text-slate-400">{selectedCaseStudy.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-neumorph-darker p-4 rounded-lg">
                  <div className="text-sm text-slate-500 mb-1">Industry</div>
                  <div className="font-semibold text-white">{selectedCaseStudy.industry}</div>
                </div>
                <div className="bg-neumorph-darker p-4 rounded-lg">
                  <div className="text-sm text-slate-500 mb-1">Target Molecule</div>
                  <div className="font-semibold text-white">{selectedCaseStudy.molecule}</div>
                </div>
                <div className="bg-neumorph-darker p-4 rounded-lg">
                  <div className="text-sm text-slate-500 mb-1">Qubits Required</div>
                  <div className="font-semibold text-white">{selectedCaseStudy.qubits}</div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-white mb-3">Key Learnings</h3>
                <div className="space-y-2">
                  {selectedCaseStudy.learnings.map((learning, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-slate-300">{learning}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-400">Real-World Impact</span>
                </div>
                <p className="text-slate-300">{selectedCaseStudy.impact}</p>
              </div>

              <div className="flex gap-3">
                <Button variant="primary" leftIcon={<Play className="w-4 h-4" />}>
                  Explore in VQE Lab
                </Button>
                <Button variant="secondary" leftIcon={<BookOpen className="w-4 h-4" />}>
                  Read Full Study
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
