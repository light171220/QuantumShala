import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, FileText, Target, Briefcase, FileCode,
  ChevronRight, Star, Clock, Award, Play, CheckCircle,
  Lock, ArrowLeft, Trophy, Flame
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { usePQCLearningStore, selectProgress, type LearningSection } from '@/stores/pqcLearningStore'
import {
  getPQCIndex, getPQCTutorial, getPQCChallenge,
  type ContentSummary, type ChallengeSummary, type CaseStudySummary,
  type TutorialContent, type ChallengeContent
} from '@/services/pqcContent'

const SECTION_ICONS: Record<LearningSection, typeof BookOpen> = {
  tutorials: BookOpen,
  guides: FileText,
  challenges: Target,
  cases: Briefcase,
  references: FileCode
}

const SECTION_COLORS: Record<LearningSection, string> = {
  tutorials: 'from-blue-500 to-cyan-500',
  guides: 'from-green-500 to-emerald-500',
  challenges: 'from-orange-500 to-amber-500',
  cases: 'from-purple-500 to-violet-500',
  references: 'from-pink-500 to-rose-500'
}

interface SectionButtonProps {
  section: LearningSection
  label: string
  isActive: boolean
  onClick: () => void
}

function SectionButton({ section, label, isActive, onClick }: SectionButtonProps) {
  const Icon = SECTION_ICONS[section]
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        isActive
          ? `bg-gradient-to-r ${SECTION_COLORS[section]} text-white`
          : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

function ProgressHeader() {
  const progress = usePQCLearningStore(selectProgress)

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
        <div className="text-xl font-bold text-blue-400">{progress.tutorialsCompleted}</div>
        <div className="text-xs text-slate-400">Tutorials</div>
      </div>
      <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
        <div className="text-xl font-bold text-green-400">{progress.challengesCompleted}</div>
        <div className="text-xs text-slate-400">Challenges</div>
      </div>
      <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
        <div className="text-xl font-bold text-amber-400">{progress.totalPoints}</div>
        <div className="text-xs text-slate-400">Points</div>
      </div>
      <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
        <div className="text-xl font-bold text-purple-400">{progress.achievementsUnlocked}</div>
        <div className="text-xs text-slate-400">Achievements</div>
      </div>
      <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center col-span-2 md:col-span-1">
        <div className="flex items-center justify-center gap-1">
          <Flame className="w-5 h-5 text-orange-400" />
          <span className="text-xl font-bold text-orange-400">{progress.streakDays}</span>
        </div>
        <div className="text-xs text-slate-400">Day Streak</div>
      </div>
    </div>
  )
}

interface TutorialViewerProps {
  tutorial: TutorialContent
  onBack: () => void
  onComplete: () => void
}

function TutorialViewer({ tutorial, onBack, onComplete }: TutorialViewerProps) {
  const { currentSection, setCurrentSection, completeTutorial } = usePQCLearningStore()
  const totalSections = tutorial.sections.length

  const handleNext = () => {
    if (currentSection < totalSections - 1) {
      setCurrentSection(currentSection + 1)
    } else {
      completeTutorial(tutorial.id)
      onComplete()
    }
  }

  const handlePrev = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1)
    }
  }

  const section = tutorial.sections[currentSection]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h3 className="text-white font-semibold">{tutorial.title}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            {tutorial.estimatedMinutes} min
            <Badge variant={
              tutorial.difficulty === 'beginner' ? 'success' :
              tutorial.difficulty === 'intermediate' ? 'warning' : 'danger'
            } size="sm">
              {tutorial.difficulty}
            </Badge>
          </div>
        </div>
      </div>

      <Progress value={((currentSection + 1) / totalSections) * 100} showLabel label={`Section ${currentSection + 1} of ${totalSections}`} />

      <Card variant="neumorph" className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h4 className="text-lg font-semibold text-white mb-3">{section.title}</h4>
            <div className="prose prose-invert prose-sm max-w-none">
              {section.content.split('\n\n').map((para, idx) => (
                <p key={idx} className="text-slate-300 mb-3 whitespace-pre-wrap">{para}</p>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </Card>

      <div className="flex justify-between">
        <Button variant="secondary" size="sm" onClick={handlePrev} disabled={currentSection === 0}>
          Previous
        </Button>
        <Button size="sm" onClick={handleNext}>
          {currentSection === totalSections - 1 ? (
            <>
              Complete
              <CheckCircle className="w-4 h-4 ml-1" />
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

interface ChallengeViewerProps {
  challenge: ChallengeContent
  onBack: () => void
  onComplete: () => void
}

function ChallengeViewer({ challenge, onBack, onComplete }: ChallengeViewerProps) {
  const { challengeProgress, completeChallengeStep, completeChallenge } = usePQCLearningStore()
  const progress = challengeProgress[challenge.id]
  const completedSteps = progress?.stepsCompleted || []

  const handleStepComplete = (stepId: string) => {
    completeChallengeStep(challenge.id, stepId)
    if (completedSteps.length + 1 === challenge.steps.length) {
      completeChallenge(challenge.id, challenge.points)
      onComplete()
    }
  }

  const allComplete = completedSteps.length === challenge.steps.length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h3 className="text-white font-semibold">{challenge.title}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Trophy className="w-3 h-3 text-amber-400" />
            {challenge.points} points
            <Badge variant={
              challenge.difficulty === 'beginner' ? 'success' :
              challenge.difficulty === 'intermediate' ? 'warning' : 'danger'
            } size="sm">
              {challenge.difficulty}
            </Badge>
          </div>
        </div>
      </div>

      <Progress value={(completedSteps.length / challenge.steps.length) * 100} />

      <div className="space-y-3">
        {challenge.steps.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id)
          const isLocked = idx > 0 && !completedSteps.includes(challenge.steps[idx - 1].id)

          return (
            <Card
              key={step.id}
              variant="neumorph"
              className={`p-3 ${isCompleted ? 'border-green-500/30' : isLocked ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? 'bg-green-500' : isLocked ? 'bg-slate-700' : 'bg-slate-600'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : isLocked ? (
                    <Lock className="w-3 h-3 text-slate-400" />
                  ) : (
                    <span className="text-xs text-white">{idx + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white text-sm">{step.title}</div>
                  <div className="text-xs text-slate-400">{step.description}</div>
                </div>
                {!isCompleted && !isLocked && (
                  <Button size="sm" variant="secondary" onClick={() => handleStepComplete(step.id)}>
                    <Play className="w-3 h-3 mr-1" />
                    Do
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {challenge.hints.length > 0 && (
        <Card variant="neumorph" className="p-3">
          <div className="text-xs font-medium text-slate-400 mb-2">Hints</div>
          <ul className="space-y-1">
            {challenge.hints.map((hint, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                <Star className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                {hint}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {allComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-lg bg-green-500/20 border border-green-500/30 text-center"
        >
          <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <div className="text-white font-semibold">Challenge Complete!</div>
          <div className="text-sm text-green-400">+{challenge.points} points earned</div>
        </motion.div>
      )}
    </div>
  )
}

export function LearningCenterTab() {
  const { activeSection, setActiveSection, startTutorial, startChallenge, updateStreak, completedTutorials, completedChallenges } = usePQCLearningStore()
  const [tutorials, setTutorials] = useState<ContentSummary[]>([])
  const [guides, setGuides] = useState<ContentSummary[]>([])
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([])
  const [caseStudies, setCaseStudies] = useState<CaseStudySummary[]>([])
  const [standards, setStandards] = useState<ContentSummary[]>([])
  const [currentTutorial, setCurrentTutorial] = useState<TutorialContent | null>(null)
  const [currentChallenge, setCurrentChallenge] = useState<ChallengeContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    updateStreak()
    loadContent()
  }, [])

  const loadContent = async () => {
    setIsLoading(true)
    const index = await getPQCIndex()
    setTutorials(index.tutorials)
    setGuides(index.guides)
    setChallenges(index.challenges)
    setCaseStudies(index.caseStudies)
    setStandards(index.standards)
    setIsLoading(false)
  }

  const handleStartTutorial = async (tutorialId: string) => {
    const tutorial = await getPQCTutorial(tutorialId)
    if (tutorial) {
      startTutorial(tutorialId)
      setCurrentTutorial(tutorial)
    }
  }

  const handleStartChallenge = async (challengeId: string) => {
    const challenge = await getPQCChallenge(challengeId)
    if (challenge) {
      startChallenge(challengeId)
      setCurrentChallenge(challenge)
    }
  }

  const handleBackFromTutorial = () => {
    setCurrentTutorial(null)
  }

  const handleBackFromChallenge = () => {
    setCurrentChallenge(null)
  }

  if (currentTutorial) {
    return (
      <TutorialViewer
        tutorial={currentTutorial}
        onBack={handleBackFromTutorial}
        onComplete={handleBackFromTutorial}
      />
    )
  }

  if (currentChallenge) {
    return (
      <ChallengeViewer
        challenge={currentChallenge}
        onBack={handleBackFromChallenge}
        onComplete={handleBackFromChallenge}
      />
    )
  }

  return (
    <div className="space-y-4">
      <ProgressHeader />

      <div className="flex flex-wrap gap-2 mb-4">
        <SectionButton section="tutorials" label="Tutorials" isActive={activeSection === 'tutorials'} onClick={() => setActiveSection('tutorials')} />
        <SectionButton section="guides" label="Guides" isActive={activeSection === 'guides'} onClick={() => setActiveSection('guides')} />
        <SectionButton section="challenges" label="Challenges" isActive={activeSection === 'challenges'} onClick={() => setActiveSection('challenges')} />
        <SectionButton section="cases" label="Case Studies" isActive={activeSection === 'cases'} onClick={() => setActiveSection('cases')} />
        <SectionButton section="references" label="Standards" isActive={activeSection === 'references'} onClick={() => setActiveSection('references')} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeSection === 'tutorials' && (
            <motion.div
              key="tutorials"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-3"
            >
              {tutorials.map((tutorial) => {
                const isCompleted = completedTutorials.includes(tutorial.id)
                return (
                  <Card key={tutorial.id} variant="neumorph" className={`p-4 ${isCompleted ? 'border-green-500/30' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white">{tutorial.title}</h4>
                          {isCompleted && <CheckCircle className="w-4 h-4 text-green-400" />}
                        </div>
                        <p className="text-sm text-slate-400 mb-2">{tutorial.description}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {tutorial.estimatedMinutes} min
                          </span>
                          <Badge variant={
                            tutorial.difficulty === 'beginner' ? 'success' :
                            tutorial.difficulty === 'intermediate' ? 'warning' : 'danger'
                          } size="sm">
                            {tutorial.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleStartTutorial(tutorial.id)}>
                        {isCompleted ? 'Review' : 'Start'}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </motion.div>
          )}

          {activeSection === 'guides' && (
            <motion.div
              key="guides"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-3"
            >
              {guides.map((guide) => (
                <Card key={guide.id} variant="neumorph" className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{guide.title}</h4>
                      <p className="text-sm text-slate-400">{guide.description}</p>
                    </div>
                    <Button size="sm" variant="secondary">
                      Read
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </Card>
              ))}
            </motion.div>
          )}

          {activeSection === 'challenges' && (
            <motion.div
              key="challenges"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-3"
            >
              {challenges.map((challenge) => {
                const isCompleted = completedChallenges.includes(challenge.id)
                return (
                  <Card key={challenge.id} variant="neumorph" className={`p-4 ${isCompleted ? 'border-green-500/30' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white">{challenge.title}</h4>
                          {isCompleted && <CheckCircle className="w-4 h-4 text-green-400" />}
                        </div>
                        <p className="text-sm text-slate-400 mb-2">{challenge.description}</p>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-amber-400">
                            <Trophy className="w-3 h-3" />
                            {challenge.points} pts
                          </span>
                          <Badge variant={
                            challenge.difficulty === 'beginner' ? 'success' :
                            challenge.difficulty === 'intermediate' ? 'warning' : 'danger'
                          } size="sm">
                            {challenge.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleStartChallenge(challenge.id)}>
                        {isCompleted ? 'Retry' : 'Start'}
                        <Target className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </motion.div>
          )}

          {activeSection === 'cases' && (
            <motion.div
              key="cases"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-3"
            >
              {caseStudies.map((caseStudy) => (
                <Card key={caseStudy.id} variant="neumorph" className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{caseStudy.title}</h4>
                        <Badge variant="info" size="sm">{caseStudy.organization}</Badge>
                      </div>
                      <p className="text-sm text-slate-400 mb-2">{caseStudy.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {caseStudy.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded bg-slate-700 text-xs text-slate-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary">
                      Read
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </Card>
              ))}
            </motion.div>
          )}

          {activeSection === 'references' && (
            <motion.div
              key="references"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-3"
            >
              {standards.map((standard) => (
                <Card key={standard.id} variant="neumorph" className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{standard.title}</h4>
                      <p className="text-sm text-slate-400">{standard.description}</p>
                    </div>
                    <Button size="sm" variant="secondary">
                      View
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </Card>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
