import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Cpu,
  Brain,
  Shield,
  FlaskConical,
  Flame,
  Zap,
  Target,
  Clock,
  ChevronRight,
  Play,
  Inbox,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Progress, CircularProgress } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { useLearningStore } from '@/stores/learningStore'
import { formatNumber } from '@/utils/format'
import { client } from '@/lib/amplify'

interface TrackProgressData {
  id: string
  trackId: string
  progressPercent: number
  lessonsCompleted: number
  status: string
}

interface LearningProgressData {
  id: string
  lessonId: string
  status: string
  completedAt?: string
}

const hubs = [
  {
    id: 'qml',
    name: 'QML Studio',
    description: 'Build quantum ML models',
    icon: Brain,
    color: 'from-purple-500 to-pink-500',
    path: '/hub/qml',
  },
  {
    id: 'pqc',
    name: 'PQC Lab',
    description: 'Post-quantum cryptography',
    icon: Shield,
    color: 'from-green-500 to-emerald-500',
    path: '/hub/pqc',
  },
  {
    id: 'chemistry',
    name: 'Chemistry Lab',
    description: 'Molecular simulations',
    icon: FlaskConical,
    color: 'from-orange-500 to-yellow-500',
    path: '/hub/chemistry',
  },
]

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { progress: localProgress, syncProgress } = useLearningStore()
  const [trackProgress, setTrackProgress] = useState<TrackProgressData[]>([])
  const [recentActivity, setRecentActivity] = useState<LearningProgressData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)

  useEffect(() => {

    syncProgress()
  }, [syncProgress])

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return

      try {

        const { data: profiles } = await client.models.UserProfile.list({
          filter: { userId: { eq: user.id } }
        })
        if (profiles?.[0]) {
          setUserProfile(profiles[0])
        }


        const { data: progress } = await client.models.TrackProgress.list({})
        setTrackProgress(progress || [])


        const { data: learning } = await client.models.LearningProgress.list({
          limit: 5
        })
        setRecentActivity(learning || [])
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [user?.id])


  const localCompletedLessons = Object.values(localProgress).filter(p => p.status === 'completed').length
  const localQuizzesPassed = Object.values(localProgress).filter(
    p => p.bestQuizScore !== undefined && p.bestQuizScore >= 70
  ).length


  const lessonsCompleted = userProfile?.lessonsCompleted || localCompletedLessons || 0
  const circuitsCreated = userProfile?.circuitsCreated || 0
  const currentStreak = userProfile?.currentStreak || user?.currentStreak || 0
  const totalXp = userProfile?.totalXp || user?.totalXp || 0
  const level = userProfile?.level || user?.level || 1


  const displayActivity = recentActivity.length > 0 ? recentActivity :
    Object.values(localProgress)
      .sort((a, b) => new Date(b.lastAccessedAt || 0).getTime() - new Date(a.lastAccessedAt || 0).getTime())
      .slice(0, 5)
      .map(p => ({
        id: p.lessonId,
        lessonId: p.lessonId,
        status: p.status || 'in_progress',
        completedAt: p.completedAt,
      }))

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Welcome back, {user?.displayName?.split(' ')[0] || 'Learner'}!
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">Continue your quantum journey</p>
        </div>
        <Link to="/learn" className="self-start sm:self-auto">
          <Button rightIcon={<Play className="w-4 h-4" />} className="w-full sm:w-auto">
            Start Learning
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="neumorph" className="bg-gradient-to-br from-orange-500/5 to-red-500/5 h-full">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-slate-400 truncate">Current Streak</p>
                  <p className="text-2xl md:text-3xl font-bold text-white mt-1">{currentStreak}</p>
                  <p className="text-xs md:text-sm text-orange-400 mt-1">days</p>
                </div>
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Flame className="w-5 h-5 md:w-7 md:h-7 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="neumorph" className="bg-gradient-to-br from-yellow-500/5 to-amber-500/5 h-full">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-slate-400 truncate">Total XP</p>
                  <p className="text-2xl md:text-3xl font-bold text-white mt-1">{formatNumber(totalXp)}</p>
                  <p className="text-xs md:text-sm text-yellow-400 mt-1">Level {level}</p>
                </div>
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 md:w-7 md:h-7 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card variant="neumorph" className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 h-full">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-slate-400 truncate">Lessons</p>
                  <p className="text-2xl md:text-3xl font-bold text-white mt-1">{lessonsCompleted}</p>
                  <p className="text-xs md:text-sm text-purple-400 mt-1">completed</p>
                </div>
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 md:w-7 md:h-7 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card variant="neumorph" className="bg-gradient-to-br from-cyan-500/5 to-blue-500/5 h-full">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-slate-400 truncate">Circuits</p>
                  <p className="text-2xl md:text-3xl font-bold text-white mt-1">{circuitsCreated}</p>
                  <p className="text-xs md:text-sm text-cyan-400 mt-1">created</p>
                </div>
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 md:w-7 md:h-7 text-cyan-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card variant="neumorph">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg md:text-xl">Learning Progress</CardTitle>
              <Link to="/learn" className="text-xs md:text-sm text-quantum-400 hover:text-quantum-300 flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {trackProgress.length > 0 ? (
                <div className="space-y-4 md:space-y-6">
                  {trackProgress.map((track, index) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <Link
                        to={`/learn/${track.trackId}`}
                        className="block p-3 md:p-4 rounded-lg md:rounded-xl bg-neumorph-base/50 hover:bg-neumorph-light/50 transition-colors group shadow-neumorph-xs border border-white/[0.02]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 md:gap-3 min-w-0">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-quantum-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-white group-hover:text-quantum-400 transition-colors text-sm md:text-base truncate">
                                {track.trackId}
                              </h3>
                              <p className="text-xs md:text-sm text-slate-400">
                                {track.lessonsCompleted} lessons completed
                              </p>
                            </div>
                          </div>
                          <span className="text-base md:text-lg font-semibold text-white flex-shrink-0 ml-2">
                            {Math.round(track.progressPercent)}%
                          </span>
                        </div>
                        <Progress value={track.progressPercent} size="sm" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="w-12 h-12 text-slate-600 mb-4" />
                  <p className="text-slate-400 mb-2">No progress yet</p>
                  <p className="text-sm text-slate-500 mb-4">Start learning to track your progress</p>
                  <Link to="/learn">
                    <Button size="sm">Browse Courses</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="neumorph">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg md:text-xl">Specialized Hubs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                {hubs.map((hub, index) => (
                  <motion.div
                    key={hub.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <Link
                      to={hub.path}
                      className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0 p-3 md:p-4 rounded-lg md:rounded-xl bg-neumorph-base/50 hover:bg-neumorph-light/50 transition-all group border border-white/[0.02] shadow-neumorph-xs hover:shadow-neumorph-sm"
                    >
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${hub.color} flex items-center justify-center sm:mb-3 group-hover:scale-110 transition-transform flex-shrink-0`}>
                        <hub.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm md:text-base">{hub.name}</h3>
                        <p className="text-xs md:text-sm text-slate-400 truncate">{hub.description}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="neumorph">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Target className="w-5 h-5 text-quantum-400" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/learn" className="block">
                <Button variant="neumorph" className="w-full justify-start">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Browse Courses
                </Button>
              </Link>
              <Link to="/simulator/circuit" className="block">
                <Button variant="neumorph" className="w-full justify-start">
                  <Cpu className="w-4 h-4 mr-2" />
                  Build Circuit
                </Button>
              </Link>
              <Link to="/simulator/code" className="block">
                <Button variant="neumorph" className="w-full justify-start">
                  <Zap className="w-4 h-4 mr-2" />
                  Code Playground
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card variant="neumorph">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Clock className="w-5 h-5 text-quantum-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {displayActivity.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  {displayActivity.map((activity, index) => (
                    <motion.div
                      key={activity.id || activity.lessonId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-white truncate">{activity.lessonId}</p>
                        <p className="text-xs text-slate-400">
                          {activity.status === 'completed' ? 'Completed' : 'In Progress'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">No activity yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
