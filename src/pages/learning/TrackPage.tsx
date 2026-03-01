import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Clock,
  BookOpen,
  CheckCircle,
  PlayCircle,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { getTrack, type TrackSummary } from '@/services/content'
import { useLearningStore } from '@/stores/learningStore'

export default function TrackPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const [track, setTrack] = useState<TrackSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { getLessonProgress, progress } = useLearningStore()

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
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading track...</p>
        </div>
      </div>
    )
  }

  if (error || !track) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-4">{error || 'Track not found'}</h2>
        <Link to="/learn" className="text-quantum-400 hover:underline">
          Back to Learning Paths
        </Link>
      </div>
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

  const getModuleProgress = (moduleId: string, lessons: { id: string }[]) => {
    const completed = lessons.filter(l => {
      const p = getLessonProgress(l.id)
      return p?.status === 'completed'
    }).length
    return lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Learning Paths
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">
              {track.title}
            </h1>
            <p className="text-slate-400 max-w-2xl">{track.description}</p>
          </div>

          <Card variant="neumorph" className="lg:w-80 flex-shrink-0">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-white mb-1">
                {trackProgress}%
              </div>
              <p className="text-slate-400">Complete</p>
            </div>
            <Progress value={trackProgress} size="sm" className="mb-4" />
            <div className="flex justify-between text-sm text-slate-400">
              <span>{completedLessons}/{totalLessons} lessons</span>
              <span>~{estimatedHours} hours</span>
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        {track.modules.map((module, index) => {
          const moduleProgress = getModuleProgress(module.id, module.lessons)
          const isModuleComplete = moduleProgress === 100
          const isModuleStarted = moduleProgress > 0

          return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={`/learn/${trackId}/${module.id}`}>
                <Card variant="neumorph-hover" className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-neumorph-xs border border-white/[0.02] ${
                    isModuleComplete
                      ? 'bg-green-500/20 text-green-400'
                      : isModuleStarted
                      ? 'bg-quantum-500/20 text-quantum-400'
                      : 'bg-neumorph-base text-slate-400'
                  }`}>
                    {isModuleComplete ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <span className="text-lg font-bold">{index + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-white truncate">
                        {module.title}
                      </h3>
                      {isModuleComplete && (
                        <Badge variant="success" size="sm">Complete</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {module.lessonsCount} lessons
                      </span>
                      {isModuleStarted && !isModuleComplete && (
                        <span className="text-quantum-400">{moduleProgress}% complete</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
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
