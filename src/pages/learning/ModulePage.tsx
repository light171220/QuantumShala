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
  BookOpen,
  Trophy,
  Sparkles,
  Zap,
  Target,
  ChevronRight,
  Star,
  Award,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { getModule, type ModuleSummary } from '@/services/content'
import { useLearningStore } from '@/stores/learningStore'

// Mini Progress Ring
const MiniProgressRing = ({ progress, size = 44, strokeWidth = 3 }: { progress: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#miniProgressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="miniProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-white">{progress}%</span>
      </div>
    </div>
  )
}

// Difficulty indicator component
const DifficultyIndicator = ({ level }: { level: string }) => {
  const levels = {
    beginner: { dots: 1, color: 'bg-green-400', label: 'Beginner' },
    intermediate: { dots: 2, color: 'bg-yellow-400', label: 'Intermediate' },
    advanced: { dots: 3, color: 'bg-red-400', label: 'Advanced' },
  }
  const config = levels[level as keyof typeof levels] || levels.beginner

  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((dot) => (
        <div
          key={dot}
          className={`w-1.5 h-1.5 rounded-full ${dot <= config.dots ? config.color : 'bg-slate-700'}`}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1">{config.label}</span>
    </div>
  )
}

export default function ModulePage() {
  const { trackId, moduleId } = useParams<{ trackId: string; moduleId: string }>()
  const [module, setModule] = useState<ModuleSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredLesson, setHoveredLesson] = useState<string | null>(null)

  const { getLessonProgress } = useLearningStore()

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin" />
            <BookOpen className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-slate-400">Loading module...</p>
        </motion.div>
      </div>
    )
  }

  if (error || !module) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20"
      >
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">{error || 'Module not found'}</h2>
        <Link
          to={`/learn/${trackId}`}
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Track
        </Link>
      </motion.div>
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

  // Find the next lesson to continue
  const nextLessonIndex = module.lessons.findIndex(l => {
    const p = getLessonProgress(l.id)
    return p?.status !== 'completed'
  })

  return (
    <div className="space-y-8">
      {/* Back Navigation */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          to={`/learn/${trackId}`}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Track
        </Link>
      </motion.div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Module Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1"
        >
          <div className="flex items-start gap-4 mb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 flex items-center justify-center"
            >
              <BookOpen className="w-8 h-8 text-cyan-400" />
            </motion.div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">
                {module.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  {module.lessonsCount} lessons
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {totalDuration} min
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:w-72"
        >
          <div className="
            relative overflow-hidden rounded-2xl p-5
            bg-gradient-to-br from-[#0d1117] to-[#161b22]
            shadow-[10px_10px_20px_rgba(0,0,0,0.35),-5px_-5px_12px_rgba(255,255,255,0.02)]
            border border-white/[0.04]
          ">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-3xl" />

            <div className="relative flex items-center gap-4">
              <MiniProgressRing progress={moduleProgress} size={56} strokeWidth={4} />

              <div>
                <p className="text-sm text-slate-400 mb-0.5">Progress</p>
                <p className="text-white font-semibold">
                  {completedLessons} / {module.lessonsCount}
                </p>
              </div>
            </div>

            {moduleProgress === 100 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30"
              >
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-medium text-yellow-400">Module Complete!</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Lessons List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          Lessons
        </h2>

        <div className="space-y-3">
          {module.lessons.map((lesson, index) => {
            const lessonProgress = getLessonProgress(lesson.id)
            const isCompleted = lessonProgress?.status === 'completed'
            const isInProgress = lessonProgress?.status === 'in_progress'
            const hasQuizPassed = lessonProgress?.bestQuizScore !== undefined && lessonProgress.bestQuizScore >= 70
            const isHovered = hoveredLesson === lesson.id
            const isNextLesson = index === nextLessonIndex

            return (
              <motion.div
                key={lesson.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onHoverStart={() => setHoveredLesson(lesson.id)}
                onHoverEnd={() => setHoveredLesson(null)}
              >
                <Link to={`/learn/${trackId}/${moduleId}/${lesson.id}`}>
                  <motion.div
                    whileHover={{ x: 4, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`
                      relative overflow-hidden rounded-xl p-4
                      bg-[#0d1117]
                      shadow-[6px_6px_16px_rgba(0,0,0,0.35),-3px_-3px_10px_rgba(255,255,255,0.02)]
                      border transition-all duration-300
                      ${isCompleted
                        ? 'border-green-500/20 ring-1 ring-green-500/10'
                        : isInProgress
                        ? 'border-cyan-500/20 ring-1 ring-cyan-500/10'
                        : isNextLesson
                        ? 'border-purple-500/20 ring-1 ring-purple-500/10'
                        : 'border-white/[0.04]'
                      }
                      ${isHovered ? 'shadow-[8px_8px_20px_rgba(0,0,0,0.4),-4px_-4px_12px_rgba(255,255,255,0.03)]' : ''}
                    `}
                  >
                    {/* Progress line on left */}
                    <div className={`
                      absolute left-0 top-0 bottom-0 w-1 rounded-l-xl
                      ${isCompleted
                        ? 'bg-gradient-to-b from-green-400 to-emerald-500'
                        : isInProgress
                        ? 'bg-gradient-to-b from-cyan-400 to-blue-500'
                        : isNextLesson
                        ? 'bg-gradient-to-b from-purple-400 to-pink-500'
                        : 'bg-white/[0.03]'
                      }
                    `} />

                    <div className="flex items-center gap-4 pl-3">
                      {/* Status Icon */}
                      <motion.div
                        className={`
                          relative w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                          ${isCompleted
                            ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20'
                            : isInProgress
                            ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20'
                            : isNextLesson
                            ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20'
                            : 'bg-white/[0.03]'
                          }
                        `}
                        animate={isNextLesson && !isCompleted ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-6 h-6 text-green-400" />
                        ) : isInProgress ? (
                          <PlayCircle className="w-6 h-6 text-cyan-400" />
                        ) : isNextLesson ? (
                          <Zap className="w-6 h-6 text-purple-400" />
                        ) : (
                          <Circle className="w-6 h-6 text-slate-500" />
                        )}
                      </motion.div>

                      {/* Lesson Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-500 font-medium">
                            Lesson {index + 1}
                          </span>
                          {isCompleted && (
                            <Badge variant="success" size="sm" className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Done
                            </Badge>
                          )}
                          {isInProgress && !isCompleted && (
                            <Badge variant="warning" size="sm" className="flex items-center gap-1">
                              <PlayCircle className="w-3 h-3" />
                              In Progress
                            </Badge>
                          )}
                          {isNextLesson && !isCompleted && !isInProgress && (
                            <Badge variant="info" size="sm" className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Up Next
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-medium text-white truncate group-hover:text-cyan-400 transition-colors">
                          {lesson.title}
                        </h3>

                        {/* Difficulty indicator */}
                        <div className="mt-1.5">
                          <DifficultyIndicator level={lesson.difficulty} />
                        </div>
                      </div>

                      {/* Right side info */}
                      <div className="flex items-center gap-4">
                        {/* Quiz Status */}
                        {lesson.hasQuiz && (
                          <div className={`
                            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                            ${hasQuizPassed
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-white/[0.03] text-slate-400 border border-white/[0.04]'
                            }
                          `}>
                            {hasQuizPassed ? (
                              <>
                                <Award className="w-3.5 h-3.5" />
                                <span>{lessonProgress?.bestQuizScore}%</span>
                              </>
                            ) : (
                              <>
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>Quiz</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Duration */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{lesson.estimatedMinutes}m</span>
                        </div>

                        {/* Chevron */}
                        <motion.div
                          animate={isHovered ? { x: [0, 4, 0] } : {}}
                          transition={{ duration: 0.5, repeat: isHovered ? Infinity : 0 }}
                        >
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Continue Button */}
      {nextLessonIndex !== -1 && nextLessonIndex < module.lessons.length && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
        >
          <Link to={`/learn/${trackId}/${moduleId}/${module.lessons[nextLessonIndex].id}`}>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="
                px-8 py-4 rounded-2xl
                bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500
                text-white font-semibold text-lg
                shadow-[0_10px_40px_rgba(6,182,212,0.3)]
                flex items-center gap-3
              "
            >
              <PlayCircle className="w-6 h-6" />
              {module.lessons[nextLessonIndex] && getLessonProgress(module.lessons[nextLessonIndex].id)?.status === 'in_progress'
                ? 'Continue Learning'
                : 'Start Next Lesson'
              }
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </Link>
        </motion.div>
      )}
    </div>
  )
}
