import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Clock,
  ChevronRight,
  Search,
  Atom,
  Brain,
  Shield,
  FlaskConical,
  Coins,
  Network,
  Lock,
  GraduationCap,
  X,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Input } from '@/components/ui/Input'
import { getAllTracks, type TrackSummary } from '@/services/content'
import { useLearningStore } from '@/stores/learningStore'

const TRACK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '01-quantum-computing-fundamentals': Atom,
  '02-quantum-machine-learning': Brain,
  '03-advanced-quantum-ml': Brain,
  '04-quantum-error-correction': Shield,
  '05-quantum-chemistry': FlaskConical,
  '06-quantum-finance': Coins,
  '07-quantum-networking': Network,
  '08-post-quantum-cryptography': Lock,
  '09-nist-pqc-standards': GraduationCap,
}

const TRACK_COLORS: Record<string, string> = {
  '01-quantum-computing-fundamentals': 'from-blue-500 to-cyan-500',
  '02-quantum-machine-learning': 'from-purple-500 to-pink-500',
  '03-advanced-quantum-ml': 'from-violet-500 to-purple-500',
  '04-quantum-error-correction': 'from-green-500 to-emerald-500',
  '05-quantum-chemistry': 'from-teal-500 to-cyan-500',
  '06-quantum-finance': 'from-yellow-500 to-orange-500',
  '07-quantum-networking': 'from-indigo-500 to-blue-500',
  '08-post-quantum-cryptography': 'from-red-500 to-pink-500',
  '09-nist-pqc-standards': 'from-slate-500 to-zinc-500',
}

const difficultyColors = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
  specialized: 'info',
} as const

export default function LearningPathsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [tracks, setTracks] = useState<TrackSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { getLessonProgress, progress } = useLearningStore()

  const getTrackProgress = (track: TrackSummary): number => {
    if (!track.modules || track.lessonsCount === 0) return 0
    const allLessonIds = track.modules.flatMap(m => m.lessons.map(l => l.id))
    const completedCount = allLessonIds.filter(id => {
      const p = getLessonProgress(id)
      return p?.status === 'completed'
    }).length
    return Math.round((completedCount / track.lessonsCount) * 100)
  }

  useEffect(() => {
    async function loadTracks() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getAllTracks()
        setTracks(data)
      } catch (err) {
        console.error('Failed to load tracks:', err)
        setError('Failed to load learning paths')
      } finally {
        setIsLoading(false)
      }
    }
    loadTracks()
  }, [])

  const filteredTracks = tracks.filter((track) => {
    const matchesSearch =
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesDifficulty = !filterDifficulty || track.difficulty === filterDifficulty

    return matchesSearch && matchesDifficulty
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading learning paths...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-300 hover:text-white"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">
          Learning Paths
        </h1>
        <p className="text-sm md:text-base text-slate-400">
          Choose your quantum computing journey from fundamentals to specialized applications
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search tracks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              variant="neumorph"
              className="text-sm md:text-base"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden px-3 py-2 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg text-slate-400 hover:text-white flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {filterDifficulty && (
              <span className="w-2 h-2 rounded-full bg-quantum-500" />
            )}
          </button>
        </div>

        <div className="hidden md:flex gap-2 flex-wrap">
          {['beginner', 'intermediate', 'advanced', 'specialized'].map((diff) => (
            <button
              key={diff}
              onClick={() => setFilterDifficulty(filterDifficulty === diff ? null : diff)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                filterDifficulty === diff
                  ? 'bg-quantum-500 text-white shadow-neumorph-pressed'
                  : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-400 hover:text-white hover:shadow-neumorph-sm'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>

        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden"
          >
            <div className="flex gap-2 flex-wrap p-3 bg-neumorph-base/50 rounded-lg shadow-neumorph-inset-xs border border-white/[0.02]">
              {['beginner', 'intermediate', 'advanced', 'specialized'].map((diff) => (
                <button
                  key={diff}
                  onClick={() => {
                    setFilterDifficulty(filterDifficulty === diff ? null : diff)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    filterDifficulty === diff
                      ? 'bg-quantum-500 text-white shadow-neumorph-pressed-sm'
                      : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-400'
                  }`}
                >
                  {diff}
                </button>
              ))}
              {filterDifficulty && (
                <button
                  onClick={() => setFilterDifficulty(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredTracks.map((track, index) => {
          const Icon = TRACK_ICONS[track.id] || Atom
          const color = TRACK_COLORS[track.id] || 'from-blue-500 to-cyan-500'
          const estimatedHours = Math.round(track.estimatedMinutes / 60)
          const trackProgressPercent = getTrackProgress(track)

          return (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={`/learn/${track.id}`}>
                <Card variant="neumorph-hover" className="h-full group">
                  <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
                    <div
                      className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-quantum-400 transition-colors text-sm md:text-base line-clamp-1">
                        {track.title}
                      </h3>
                      <Badge
                        variant={difficultyColors[track.difficulty as keyof typeof difficultyColors]}
                        size="sm"
                        className="mt-1"
                      >
                        {track.difficulty}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs md:text-sm text-slate-400 mb-3 md:mb-4 line-clamp-2">
                    {track.description || 'Explore this learning track'}
                  </p>

                  <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3 md:mb-4">
                    {track.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 md:py-1 text-xs bg-neumorph-base/80 shadow-neumorph-xs border border-white/[0.02] text-slate-400 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-slate-400 mb-3 md:mb-4">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <span>{track.lessonsCount} lessons</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <span>{estimatedHours}h</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <Progress value={trackProgressPercent} size="sm" variant={trackProgressPercent === 100 ? 'success' : 'default'} className="flex-1" />
                    <span className="text-xs text-slate-400">{trackProgressPercent}%</span>
                  </div>

                  <div className="flex items-center justify-between mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/10">
                    <span className="text-xs md:text-sm text-slate-400">
                      {track.modulesCount} modules
                    </span>
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-quantum-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          )
        })}
      </div>

      {filteredTracks.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-neumorph-base shadow-neumorph-sm border border-white/[0.02] flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No tracks found</h3>
          <p className="text-slate-400 text-sm">
            Try adjusting your search or filters
          </p>
          {(searchQuery || filterDifficulty) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setFilterDifficulty(null)
              }}
              className="mt-4 px-4 py-2 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg text-sm text-slate-300 hover:text-white hover:shadow-neumorph-sm transition-all"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
