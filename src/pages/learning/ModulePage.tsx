import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  Circle,
  PlayCircle,
  HelpCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { getModule, type ModuleSummary } from '@/services/content'
import { useLearningStore } from '@/stores/learningStore'

export default function ModulePage() {
  const { trackId, moduleId } = useParams<{ trackId: string; moduleId: string }>()
  const [module, setModule] = useState<ModuleSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { getLessonProgress, progress } = useLearningStore()

  useEffect(() => {
    async function loadModule() {
      if (!trackId || !moduleId) return
      setIsLoading(true)
      setError(null)
      try {
        const data = await getModule(trackId, moduleId)
        if (!data) {
          setError('Module not found')
        } else {
          setModule(data)
        }
      } catch (err) {
        console.error('Failed to load module:', err)
        setError('Failed to load module')
      } finally {
        setIsLoading(false)
      }
    }
    loadModule()
  }, [trackId, moduleId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading module...</p>
        </div>
      </div>
    )
  }

  if (error || !module) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-4">{error || 'Module not found'}</h2>
        <Link to={`/learn/${trackId}`} className="text-quantum-400 hover:underline">
          Back to Track
        </Link>
      </div>
    )
  }

  const totalDuration = module.lessons.reduce((acc, l) => acc + l.estimatedMinutes, 0)

  const completedLessons = module.lessons.filter(l => {
    const p = getLessonProgress(l.id)
    return p?.status === 'completed'
  }).length

  const moduleProgress = module.lessonsCount > 0
    ? Math.round((completedLessons / module.lessonsCount) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <Link
          to={`/learn/${trackId}`}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Track
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">
              {module.title}
            </h1>
          </div>

          <Card variant="neumorph" className="lg:w-72 flex-shrink-0">
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Progress</span>
                <span className="text-white">{completedLessons}/{module.lessonsCount} lessons</span>
              </div>
              <Progress value={moduleProgress} size="sm" />
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Duration</span>
                <span className="text-white">{totalDuration} min</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        {module.lessons.map((lesson, index) => {
          const lessonProgress = getLessonProgress(lesson.id)
          const isCompleted = lessonProgress?.status === 'completed'
          const isInProgress = lessonProgress?.status === 'in_progress'
          const hasQuizPassed = lessonProgress?.bestQuizScore !== undefined && lessonProgress.bestQuizScore >= 70

          return (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link to={`/learn/${trackId}/${moduleId}/${lesson.id}`}>
                <Card variant="neumorph-hover" className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-neumorph-xs border border-white/[0.02] ${
                    isCompleted
                      ? 'bg-green-500/20 text-green-400'
                      : isInProgress
                      ? 'bg-quantum-500/20 text-quantum-400'
                      : 'bg-neumorph-base text-slate-500'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : isInProgress ? (
                      <PlayCircle className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        Lesson {index + 1}
                      </span>
                      {isCompleted && (
                        <Badge variant="success" size="sm">Completed</Badge>
                      )}
                      {isInProgress && !isCompleted && (
                        <Badge variant="warning" size="sm">In Progress</Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-white truncate">
                      {lesson.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-slate-400">
                    {lesson.hasQuiz && (
                      <div className={`flex items-center gap-1 text-xs ${hasQuizPassed ? 'text-green-400' : ''}`}>
                        {hasQuizPassed ? <CheckCircle className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
                        <span>{hasQuizPassed ? `${lessonProgress?.bestQuizScore}%` : 'Quiz'}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="w-4 h-4" />
                      <span>{lesson.estimatedMinutes}m</span>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
