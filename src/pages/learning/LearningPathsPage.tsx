import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  Sparkles,
  Zap,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
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

const TRACK_COLORS: Record<string, { gradient: string; glow: string; ring: string }> = {
  '01-quantum-computing-fundamentals': {
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    glow: 'shadow-[0_0_30px_rgba(6,182,212,0.3)]',
    ring: 'ring-cyan-500/30',
  },
  '02-quantum-machine-learning': {
    gradient: 'from-purple-500 via-pink-500 to-rose-500',
    glow: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]',
    ring: 'ring-purple-500/30',
  },
  '03-advanced-quantum-ml': {
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'shadow-[0_0_30px_rgba(139,92,246,0.3)]',
    ring: 'ring-violet-500/30',
  },
  '04-quantum-error-correction': {
    gradient: 'from-green-500 via-emerald-500 to-teal-500',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]',
    ring: 'ring-emerald-500/30',
  },
  '05-quantum-chemistry': {
    gradient: 'from-teal-500 via-cyan-500 to-sky-500',
    glow: 'shadow-[0_0_30px_rgba(20,184,166,0.3)]',
    ring: 'ring-teal-500/30',
  },
  '06-quantum-finance': {
    gradient: 'from-yellow-500 via-orange-500 to-red-500',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.3)]',
    ring: 'ring-orange-500/30',
  },
  '07-quantum-networking': {
    gradient: 'from-indigo-500 via-blue-500 to-cyan-500',
    glow: 'shadow-[0_0_30px_rgba(99,102,241,0.3)]',
    ring: 'ring-indigo-500/30',
  },
  '08-post-quantum-cryptography': {
    gradient: 'from-red-500 via-pink-500 to-purple-500',
    glow: 'shadow-[0_0_30px_rgba(239,68,68,0.3)]',
    ring: 'ring-red-500/30',
  },
  '09-nist-pqc-standards': {
    gradient: 'from-slate-400 via-zinc-500 to-slate-600',
    glow: 'shadow-[0_0_30px_rgba(148,163,184,0.3)]',
    ring: 'ring-slate-500/30',
  },
}

const difficultyConfig = {
  beginner: { color: 'success', icon: Sparkles, label: 'Beginner Friendly' },
  intermediate: { color: 'warning', icon: TrendingUp, label: 'Intermediate' },
  advanced: { color: 'danger', icon: Zap, label: 'Advanced' },
  specialized: { color: 'info', icon: Target, label: 'Specialized' },
} as const

// Circular Progress Component
const CircularProgress = ({ value, size = 60, strokeWidth = 4, color = 'cyan' }: {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background circle */}
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
          stroke={`url(#gradient-${color})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color === 'cyan' ? '#06b6d4' : color === 'green' ? '#10b981' : '#8b5cf6'} />
            <stop offset="100%" stopColor={color === 'cyan' ? '#0ea5e9' : color === 'green' ? '#22c55e' : '#a855f7'} />
          </linearGradient>
        </defs>
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-white">{value}%</span>
      </div>
    </div>
  )
}

export default function LearningPathsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [tracks, setTracks] = useState<TrackSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null)

  const { getLessonProgress } = useLearningStore()

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
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-500 animate-spin animation-delay-150" style={{ animationDirection: 'reverse' }} />
            <Atom className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-slate-400 font-medium">Loading quantum paths...</p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <p className="text-red-400 mb-6 text-lg">{error}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl text-sm text-white font-medium shadow-neumorph-sm hover:shadow-neumorph-md transition-all"
          >
            Try Again
          </motion.button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -top-5 right-20 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />

        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-3 relative">
          Learning Paths
          <motion.span
            className="absolute -top-1 -right-6 text-cyan-400"
            animate={{ rotate: [0, 15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="w-5 h-5" />
          </motion.span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl">
          Master quantum computing through carefully crafted learning journeys
        </p>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <div className="flex gap-3">
          <div className="flex-1 relative group">
            <Input
              placeholder="Search tracks, topics, or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 group-focus-within:text-cyan-400 transition-colors" />}
              variant="neumorph"
              className="text-sm md:text-base pl-10"
            />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-purple-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`
              md:hidden px-4 py-2 rounded-xl flex items-center gap-2 transition-all
              ${showFilters
                ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'bg-[#1a1f2e] shadow-neumorph-sm border border-white/[0.03] text-slate-400 hover:text-white'
              }
            `}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {filterDifficulty && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </motion.button>
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:flex gap-3 flex-wrap">
          {(['beginner', 'intermediate', 'advanced', 'specialized'] as const).map((diff) => {
            const config = difficultyConfig[diff]
            const Icon = config.icon
            const isActive = filterDifficulty === diff

            return (
              <motion.button
                key={diff}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setFilterDifficulty(isActive ? null : diff)}
                className={`
                  px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all flex items-center gap-2
                  ${isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                    : 'bg-[#1a1f2e] shadow-neumorph-sm border border-white/[0.03] text-slate-400 hover:text-white hover:border-white/[0.06]'
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : ''}`} />
                {diff}
              </motion.button>
            )
          })}
        </div>

        {/* Mobile Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="p-4 bg-[#12161f] rounded-2xl border border-white/[0.03] shadow-neumorph-inset-sm">
                <div className="flex flex-wrap gap-2">
                  {(['beginner', 'intermediate', 'advanced', 'specialized'] as const).map((diff) => {
                    const config = difficultyConfig[diff]
                    const Icon = config.icon
                    const isActive = filterDifficulty === diff

                    return (
                      <motion.button
                        key={diff}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setFilterDifficulty(isActive ? null : diff)}
                        className={`
                          px-3 py-2 rounded-lg text-xs font-medium capitalize flex items-center gap-1.5
                          ${isActive
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-[#1a1f2e] text-slate-400 border border-white/[0.03]'
                          }
                        `}
                      >
                        <Icon className="w-3 h-3" />
                        {diff}
                      </motion.button>
                    )
                  })}
                </div>
                {filterDifficulty && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setFilterDifficulty(null)}
                    className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear filter
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Track Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTracks.map((track, index) => {
          const Icon = TRACK_ICONS[track.id] || Atom
          const colors = TRACK_COLORS[track.id] || TRACK_COLORS['01-quantum-computing-fundamentals']
          const estimatedHours = Math.round(track.estimatedMinutes / 60)
          const trackProgress = getTrackProgress(track)
          const diffConfig = difficultyConfig[track.difficulty as keyof typeof difficultyConfig]
          const DiffIcon = diffConfig?.icon || Sparkles
          const isHovered = hoveredTrack === track.id

          return (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 100 }}
              onHoverStart={() => setHoveredTrack(track.id)}
              onHoverEnd={() => setHoveredTrack(null)}
            >
              <Link to={`/learn/${track.id}`}>
                <motion.div
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    relative h-full overflow-hidden rounded-2xl
                    bg-[#0d1117]
                    shadow-[8px_8px_20px_rgba(0,0,0,0.4),-4px_-4px_12px_rgba(255,255,255,0.02)]
                    border border-white/[0.04]
                    transition-all duration-500
                    ${isHovered ? colors.glow : ''}
                  `}
                >
                  {/* Gradient border effect */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${colors.gradient} opacity-0 transition-opacity duration-500 ${isHovered ? 'opacity-10' : ''}`} />

                  {/* Top accent line */}
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r ${colors.gradient} opacity-50`} />

                  <div className="relative p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <motion.div
                        className={`
                          w-14 h-14 rounded-xl bg-gradient-to-br ${colors.gradient}
                          flex items-center justify-center
                          shadow-lg
                        `}
                        animate={isHovered ? { rotate: [0, -5, 5, 0] } : {}}
                        transition={{ duration: 0.5 }}
                      >
                        <Icon className="w-7 h-7 text-white" />
                      </motion.div>

                      <CircularProgress
                        value={trackProgress}
                        size={52}
                        strokeWidth={3}
                        color={trackProgress === 100 ? 'green' : 'cyan'}
                      />
                    </div>

                    {/* Title & Badge */}
                    <div className="mb-3">
                      <h3 className="font-bold text-white text-lg mb-2 line-clamp-1 group-hover:text-cyan-400 transition-colors">
                        {track.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={diffConfig?.color || 'default'}
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <DiffIcon className="w-3 h-3" />
                          {track.difficulty}
                        </Badge>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                      {track.description || 'Explore this comprehensive learning track'}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {track.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-white/[0.03] border border-white/[0.05] text-slate-500 rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-slate-500" />
                        <span>{track.lessonsCount} lessons</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>{estimatedHours}h</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                      <span className="text-sm text-slate-500">
                        {track.modulesCount} modules
                      </span>
                      <motion.div
                        className="flex items-center gap-2 text-sm font-medium text-cyan-400"
                        animate={isHovered ? { x: [0, 4, 0] } : {}}
                        transition={{ duration: 0.5, repeat: isHovered ? Infinity : 0 }}
                      >
                        Start Learning
                        <ChevronRight className="w-4 h-4" />
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredTracks.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-neumorph-md border border-white/[0.03]" />
            <Search className="absolute inset-0 m-auto w-10 h-10 text-slate-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No tracks found</h3>
          <p className="text-slate-400 mb-6">
            Try adjusting your search or filters
          </p>
          {(searchQuery || filterDifficulty) && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSearchQuery('')
                setFilterDifficulty(null)
              }}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-xl text-sm text-white font-medium border border-cyan-500/20 hover:border-cyan-500/40 transition-all"
            >
              Clear all filters
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  )
}
