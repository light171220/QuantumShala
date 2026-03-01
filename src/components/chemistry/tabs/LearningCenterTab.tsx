import { useState, useMemo } from 'react'
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
  Clock,
  Target,
  Zap,
  Award,
  FlaskConical,
  Atom,
  Factory,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'

type LearningSection = 'tutorials' | 'challenges' | 'cases'

interface Tutorial {
  id: string
  title: string
  description: string
  duration: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  progress: number
  completed: boolean
  locked: boolean
  topics: string[]
}

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

const TUTORIALS: Tutorial[] = [
  {
    id: 'intro-vqe',
    title: 'Introduction to VQE',
    description: 'Learn the basics of the Variational Quantum Eigensolver algorithm',
    duration: '15 min',
    difficulty: 'beginner',
    progress: 100,
    completed: true,
    locked: false,
    topics: ['Variational principle', 'Ansatz circuits', 'Classical optimization']
  },
  {
    id: 'hamiltonians',
    title: 'Molecular Hamiltonians',
    description: 'Understanding how molecules are represented in quantum computers',
    duration: '20 min',
    difficulty: 'beginner',
    progress: 60,
    completed: false,
    locked: false,
    topics: ['Second quantization', 'Jordan-Wigner transform', 'Pauli strings']
  },
  {
    id: 'ansatze',
    title: 'Ansatz Design',
    description: 'Explore different ansatz architectures for chemistry',
    duration: '25 min',
    difficulty: 'intermediate',
    progress: 0,
    completed: false,
    locked: false,
    topics: ['HEA', 'UCCSD', 'ADAPT-VQE', 'Hardware efficiency']
  },
  {
    id: 'optimization',
    title: 'Classical Optimizers',
    description: 'Deep dive into optimization strategies for VQE',
    duration: '20 min',
    difficulty: 'intermediate',
    progress: 0,
    completed: false,
    locked: true,
    topics: ['COBYLA', 'SPSA', 'Adam', 'Gradient estimation']
  },
  {
    id: 'error-mitigation',
    title: 'Error Mitigation',
    description: 'Techniques to improve results on noisy hardware',
    duration: '30 min',
    difficulty: 'advanced',
    progress: 0,
    completed: false,
    locked: true,
    topics: ['Zero-noise extrapolation', 'Readout mitigation', 'Noise models']
  },
]

const CHALLENGES: Challenge[] = [
  {
    id: 'h2-ground-state',
    title: 'H2 Ground State',
    description: 'Find the ground state energy of hydrogen molecule within chemical accuracy',
    points: 100,
    difficulty: 'easy',
    completed: true,
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

export function LearningCenterTab() {
  const [activeSection, setActiveSection] = useState<LearningSection>('tutorials')
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null)

  const totalPoints = useMemo(() =>
    CHALLENGES.filter(c => c.completed).reduce((sum, c) => sum + c.points, 0),
    []
  )

  const completedTutorials = useMemo(() =>
    TUTORIALS.filter(t => t.completed).length,
    []
  )

  const sections = [
    { id: 'tutorials', name: 'Tutorials', icon: <BookOpen className="w-4 h-4" />, count: `${completedTutorials}/${TUTORIALS.length}` },
    { id: 'challenges', name: 'Challenges', icon: <Trophy className="w-4 h-4" />, count: `${totalPoints} pts` },
    { id: 'cases', name: 'Case Studies', icon: <Lightbulb className="w-4 h-4" />, count: CASE_STUDIES.length.toString() },
  ]

  const difficultyColors = {
    beginner: 'text-green-400',
    intermediate: 'text-yellow-400',
    advanced: 'text-red-400',
    easy: 'text-green-400',
    medium: 'text-yellow-400',
    hard: 'text-red-400',
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
            <span className="font-semibold text-white">{completedTutorials}</span>
            <span className="text-sm text-slate-400">completed</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as LearningSection)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
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

      <AnimatePresence mode="wait">
        {activeSection === 'tutorials' && (
          <motion.div
            key="tutorials"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {TUTORIALS.map(tutorial => (
              <Card key={tutorial.id} variant="neumorph" className="p-4 relative overflow-hidden">
                {tutorial.locked && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="text-center">
                      <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Complete previous tutorials</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${difficultyColors[tutorial.difficulty]}`}>
                      {tutorial.difficulty}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {tutorial.duration}
                    </div>
                  </div>
                  {tutorial.completed && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </div>

                <h3 className="font-semibold text-white mb-2">{tutorial.title}</h3>
                <p className="text-sm text-slate-400 mb-3">{tutorial.description}</p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {tutorial.topics.map(topic => (
                    <Badge key={topic} variant="secondary" size="sm">{topic}</Badge>
                  ))}
                </div>

                {tutorial.progress > 0 && tutorial.progress < 100 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Progress</span>
                      <span className="text-orange-400">{tutorial.progress}%</span>
                    </div>
                    <Progress value={tutorial.progress} variant="warning" size="sm" />
                  </div>
                )}

                <Button
                  variant={tutorial.completed ? 'secondary' : 'primary'}
                  size="sm"
                  className="w-full"
                  leftIcon={tutorial.completed ? <CheckCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  disabled={tutorial.locked}
                >
                  {tutorial.completed ? 'Review' : tutorial.progress > 0 ? 'Continue' : 'Start'}
                </Button>
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
                ← Back to Case Studies
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
