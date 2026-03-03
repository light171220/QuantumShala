import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  Clock,
  BookOpen,
  CheckCircle,
  PlayCircle,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Trophy,
  Target,
  Zap,
  Lock,
  ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { getTrack, type TrackSummary } from '@/services/content'
import { useLearningStore } from '@/stores/learningStore'

// Animated Progress Ring
const ProgressRing = ({ progress, size = 80, strokeWidth = 6 }: { progress: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-bold text-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          {progress}%
        </motion.span>
      </div>
    </div>
  )
}

export default function TrackPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const [track, setTrack] = useState<TrackSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  const { getLessonProgress } = useLearningStore()

  useEffect(() => {
    async function loadTrack() {
      if (!trackId) return
      setIsLoading(true)
      setError(null)
      try {
        const data = await getTrack(trackId)
        if (!data) {
          setError('Track not found')
        } else {
          setTrack(data)
        }
      } catch (err) {
        console.error('Failed to load track:', err)
        setError('Failed to load track')
      } finally {
        setIsLoading(false)
      }
    }
    loadTrack()
  }, [trackId])

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
            <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-cyan-400 animate-pulse" />
          </div>
          <p className="text-slate-400">Loading track...</p>
        </motion.div>
      </div>
    )
  }

  if (error || !track) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20"
      >
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">{error || 'Track not found'}</h2>
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Learning Paths
        </Link>
      </motion.div>
    )
  }

  const totalLessons = track.lessonsCount
  const estimatedHours = Math.round(track.estimatedMinutes / 60)

  const allLessonIds = track.modules.flatMap(m => m.lessons.map(l => l.id))
  const completedLessons = allLessonIds.filter(id => {
    const p = getLessonProgress(id)
    return p?.status === 'completed'
  }).length
  const trackProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  const getModuleProgress = (lessons: { id: string }[]) => {
    const completed = lessons.filter(l => {
      const p = getLessonProgress(l.id)
      return p?.status === 'completed'
    }).length
    return lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0
  }

  return (
    <div className="space-y-8">
      {/* Back Navigation */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Learning Paths
        </Link>
      </motion.div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Track Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1"
        >
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
            {track.title}
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
            {track.description}
          </p>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1f2e] border border-white/[0.03]">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-slate-300">{totalLessons} Lessons</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1f2e] border border-white/[0.03]">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-slate-300">{estimatedHours} Hours</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1f2e] border border-white/[0.03]">
              <Target className="w-4 h-4 text-pink-400" />
              <span className="text-sm text-slate-300">{track.modulesCount} Modules</span>
            </div>
          </div>
        </motion.div>

        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:w-80"
        >
          <div className="
            relative overflow-hidden rounded-2xl p-6
            bg-gradient-to-br from-[#0d1117] to-[#161b22]
            shadow-[12px_12px_24px_rgba(0,0,0,0.4),-6px_-6px_16px_rgba(255,255,255,0.02)]
            border border-white/[0.04]
          ">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl" />

            <div className="relative flex flex-col items-center">
              <ProgressRing progress={trackProgress} size={100} strokeWidth={8} />

              <div className="mt-4 text-center">
                <p className="text-sm text-slate-400 mb-1">Overall Progress</p>
                <p className="text-white font-medium">
                  {completedLessons} of {totalLessons} lessons completed
                </p>
              </div>

              {trackProgress === 100 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30"
                >
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">Track Completed!</span>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modules List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          Modules
        </h2>

        <div className="space-y-4">
          {track.modules.map((module, index) => {
            const moduleProgress = getModuleProgress(module.lessons)
            const isComplete = moduleProgress === 100
            const isStarted = moduleProgress > 0
            const isExpanded = expandedModule === module.id
            const isLocked = index > 0 && getModuleProgress(track.modules[index - 1].lessons) < 100 && !isStarted

            return (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <div className={`
                  relative overflow-hidden rounded-2xl
                  bg-[#0d1117]
                  shadow-[8px_8px_20px_rgba(0,0,0,0.35),-4px_-4px_12px_rgba(255,255,255,0.02)]
                  border border-white/[0.04]
                  transition-all duration-300
                  ${isComplete ? 'ring-1 ring-green-500/20' : isStarted ? 'ring-1 ring-cyan-500/20' : ''}
                `}>
                  {/* Module Header */}
                  <div
                    className="flex items-center gap-4 p-5 cursor-pointer group"
                    onClick={() => setExpandedModule(isExpanded ? null : module.id)}
                  >
                    {/* Status Icon */}
                    <motion.div
                      className={`
                        relative w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0
                        ${isComplete
                          ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30'
                          : isStarted
                          ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30'
                          : isLocked
                          ? 'bg-slate-800/50 border border-slate-700/50'
                          : 'bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.05]'
                        }
                      `}
                      whileHover={{ scale: 1.05 }}
                    >
                      {isComplete ? (
                        <CheckCircle className="w-7 h-7 text-green-400" />
                      ) : isLocked ? (
                        <Lock className="w-6 h-6 text-slate-500" />
                      ) : isStarted ? (
                        <PlayCircle className="w-7 h-7 text-cyan-400" />
                      ) : (
                        <span className="text-xl font-bold text-slate-400">{index + 1}</span>
                      )}

                      {/* Progress indicator ring */}
                      {isStarted && !isComplete && (
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle
                            cx="50%"
                            cy="50%"
                            r="26"
                            fill="none"
                            stroke="rgba(6,182,212,0.3)"
                            strokeWidth="2"
                            strokeDasharray={`${moduleProgress * 1.63} 163`}
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </motion.div>

                    {/* Module Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-white text-lg truncate group-hover:text-cyan-400 transition-colors">
                          {module.title}
                        </h3>
                        {isComplete && (
                          <Badge variant="success" size="sm" className="flex-shrink-0">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                        {isStarted && !isComplete && (
                          <Badge variant="info" size="sm" className="flex-shrink-0">
                            <Zap className="w-3 h-3 mr-1" />
                            {moduleProgress}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {module.lessonsCount} lessons
                        </span>
                      </div>
                    </div>

                    {/* Expand/Navigate */}
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center"
                      >
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      </motion.div>
                    </div>
                  </div>

                  {/* Expanded Lessons Preview */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-white/[0.04]"
                      >
                        <div className="p-4 space-y-2 bg-[#0a0d10]">
                          {module.lessons.slice(0, 5).map((lesson, lessonIndex) => {
                            const lessonProgress = getLessonProgress(lesson.id)
                            const isLessonComplete = lessonProgress?.status === 'completed'
                            const isLessonInProgress = lessonProgress?.status === 'in_progress'

                            return (
                              <Link
                                key={lesson.id}
                                to={`/learn/${trackId}/${module.id}/${lesson.id}`}
                              >
                                <motion.div
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: lessonIndex * 0.05 }}
                                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group/lesson"
                                >
                                  <div className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center
                                    ${isLessonComplete
                                      ? 'bg-green-500/20 text-green-400'
                                      : isLessonInProgress
                                      ? 'bg-cyan-500/20 text-cyan-400'
                                      : 'bg-white/[0.03] text-slate-500'
                                    }
                                  `}>
                                    {isLessonComplete ? (
                                      <CheckCircle className="w-4 h-4" />
                                    ) : (
                                      <span className="text-xs font-medium">{lessonIndex + 1}</span>
                                    )}
                                  </div>
                                  <span className="flex-1 text-sm text-slate-300 group-hover/lesson:text-white transition-colors truncate">
                                    {lesson.title}
                                  </span>
                                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover/lesson:text-cyan-400 group-hover/lesson:translate-x-1 transition-all" />
                                </motion.div>
                              </Link>
                            )
                          })}

                          {module.lessons.length > 5 && (
                            <Link to={`/learn/${trackId}/${module.id}`}>
                              <div className="text-center py-2 text-sm text-cyan-400 hover:text-cyan-300">
                                View all {module.lessons.length} lessons →
                              </div>
                            </Link>
                          )}
                        </div>

                        {/* View Module Button */}
                        <div className="p-4 border-t border-white/[0.04]">
                          <Link to={`/learn/${trackId}/${module.id}`}>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 text-white font-medium flex items-center justify-center gap-2 hover:border-cyan-500/40 transition-all"
                            >
                              {isComplete ? 'Review Module' : isStarted ? 'Continue Module' : 'Start Module'}
                              <ChevronRight className="w-4 h-4" />
                            </motion.button>
                          </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
