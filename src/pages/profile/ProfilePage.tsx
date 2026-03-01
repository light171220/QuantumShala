import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  User,
  Trophy,
  Flame,
  Zap,
  Calendar,
  MapPin,
  Link as LinkIcon,
  Edit,
  Settings,
  BookOpen,
  Cpu,
  Inbox,
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress, CircularProgress } from '@/components/ui/Progress'
import { useAuthStore } from '@/stores/authStore'
import { useLearningStore } from '@/stores/learningStore'
import { client } from '@/lib/amplify'

interface UserAchievement {
  achievementId: string
  unlockedAt: string
}

interface LearningActivity {
  id: string
  lessonId: string
  status: string
  completedAt?: string
}

export default function ProfilePage() {
  const { user } = useAuthStore()
  const { progress: localProgress, syncProgress } = useLearningStore()
  const [userProfile, setUserProfile] = useState<any>(null)
  const [achievements, setAchievements] = useState<UserAchievement[]>([])
  const [recentActivity, setRecentActivity] = useState<LearningActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

        
        const { data: achievementData } = await client.models.Achievement.list({
          limit: 4
        })
        setAchievements(achievementData || [])

        
        const { data: activityData } = await client.models.LearningProgress.list({
          limit: 5
        })
        setRecentActivity(activityData || [])
      } catch (error) {
        console.error('Failed to load profile data:', error)
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
  const localTotalTime = Object.values(localProgress).reduce((acc, p) => acc + (p.timeSpentMinutes || 0), 0)

  
  const lessonsCompleted = userProfile?.lessonsCompleted || localCompletedLessons || 0
  const quizzesPassed = userProfile?.quizzesPassed || localQuizzesPassed || 0
  const circuitsCreated = userProfile?.circuitsCreated || 0
  const totalTimeMinutes = userProfile?.totalTimeMinutes || localTotalTime || 0
  const totalXp = userProfile?.totalXp || 0
  const level = userProfile?.level || 1
  const currentStreak = userProfile?.currentStreak || 0
  const longestStreak = userProfile?.longestStreak || 0

  
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

  
  const xpPerLevel = 500
  const currentLevelXp = totalXp % xpPerLevel
  const xpForNextLevel = xpPerLevel

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Recently'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <Card variant="neumorph">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 md:gap-6">
          <div className="relative">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-quantum-500 to-neon-purple flex items-center justify-center text-3xl md:text-4xl font-bold text-white">
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>

          <div className="flex-1 text-center lg:text-left">
            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-3">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">
                  {user?.displayName || 'Quantum Learner'}
                </h1>
                <p className="text-slate-400">@{user?.username || 'user'}</p>
              </div>
              <Link to="/settings">
                <Button variant="secondary" leftIcon={<Settings className="w-4 h-4" />} size="sm">
                  Edit Profile
                </Button>
              </Link>
            </div>

            {userProfile?.bio && (
              <p className="mt-3 md:mt-4 text-sm md:text-base text-slate-300">
                {userProfile.bio}
              </p>
            )}

            <div className="flex flex-wrap justify-center lg:justify-start gap-3 md:gap-4 mt-3 md:mt-4 text-xs md:text-sm text-slate-400">
              {userProfile?.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {userProfile.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Joined {formatDate(userProfile?.joinedAt)}
              </span>
              {userProfile?.website && (
                <span className="flex items-center gap-1 hidden sm:flex">
                  <LinkIcon className="w-4 h-4" />
                  {userProfile.website}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center p-4 md:p-6 bg-neumorph-base/50 rounded-lg md:rounded-xl shadow-neumorph-xs md:shadow-neumorph-sm border border-white/[0.02]">
            <CircularProgress value={(currentLevelXp / xpForNextLevel) * 100} size={80} />
            <div className="mt-3 text-center">
              <div className="text-xl md:text-2xl font-bold text-white">Level {level}</div>
              <div className="text-xs md:text-sm text-slate-400">
                {currentLevelXp}/{xpForNextLevel} XP
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card variant="neumorph" className="p-4 text-center">
          <Flame className="w-6 h-6 md:w-8 md:h-8 text-orange-400 mx-auto mb-2" />
          <div className="text-xl md:text-2xl font-bold text-white">{currentStreak}</div>
          <div className="text-xs md:text-sm text-slate-400">Day Streak</div>
        </Card>
        <Card variant="neumorph" className="p-4 text-center">
          <Zap className="w-6 h-6 md:w-8 md:h-8 text-yellow-400 mx-auto mb-2" />
          <div className="text-xl md:text-2xl font-bold text-white">{totalXp.toLocaleString()}</div>
          <div className="text-xs md:text-sm text-slate-400">Total XP</div>
        </Card>
        <Card variant="neumorph" className="p-4 text-center">
          <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-purple-400 mx-auto mb-2" />
          <div className="text-xl md:text-2xl font-bold text-white">{lessonsCompleted}</div>
          <div className="text-xs md:text-sm text-slate-400">Lessons</div>
        </Card>
        <Card variant="neumorph" className="p-4 text-center">
          <Cpu className="w-6 h-6 md:w-8 md:h-8 text-cyan-400 mx-auto mb-2" />
          <div className="text-xl md:text-2xl font-bold text-white">{circuitsCreated}</div>
          <div className="text-xs md:text-sm text-slate-400">Circuits</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <Card variant="neumorph">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Statistics</CardTitle>
            </CardHeader>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Quizzes Passed</span>
                  <span className="text-white font-medium">{quizzesPassed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Longest Streak</span>
                  <span className="text-white font-medium">{longestStreak} days</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Time</span>
                  <span className="text-white font-medium">{Math.round(totalTimeMinutes / 60)}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Achievements</span>
                  <span className="text-white font-medium">{achievements.length}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card variant="neumorph">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <div className="p-4">
              {displayActivity.length > 0 ? (
                <div className="space-y-3">
                  {displayActivity.map((activity) => (
                    <div key={activity.id || activity.lessonId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-sm text-white">{activity.lessonId}</p>
                        <p className="text-xs text-slate-400">
                          {activity.status === 'completed' ? 'Completed' : 'In Progress'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Inbox className="w-10 h-10 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">No activity yet</p>
                  <p className="text-xs text-slate-500">Start learning to see your activity here</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4 md:space-y-6">
          <Card variant="neumorph">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Achievements
              </CardTitle>
              <Link to="/achievements" className="text-xs md:text-sm text-quantum-400 hover:text-quantum-300">
                View all
              </Link>
            </CardHeader>
            <div className="p-4">
              {achievements.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {achievements.slice(0, 4).map((achievement) => (
                    <div
                      key={achievement.achievementId}
                      className="p-3 rounded-lg bg-neumorph-base/50 shadow-neumorph-xs border border-white/[0.02] text-center"
                    >
                      <div className="text-2xl mb-1">🏆</div>
                      <p className="text-xs text-white truncate">{achievement.achievementId}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Trophy className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">No achievements yet</p>
                  <p className="text-xs text-slate-500">Complete lessons to earn achievements</p>
                </div>
              )}
            </div>
          </Card>

          <Card variant="neumorph" className="p-4">
            <h3 className="font-semibold text-white mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link to="/leaderboard" className="block p-2 rounded-lg bg-neumorph-base/50 shadow-neumorph-xs border border-white/[0.02] hover:shadow-neumorph-sm transition-all">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  Leaderboard
                </div>
              </Link>
              <Link to="/achievements" className="block p-2 rounded-lg bg-neumorph-base/50 shadow-neumorph-xs border border-white/[0.02] hover:shadow-neumorph-sm transition-all">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Zap className="w-4 h-4 text-quantum-400" />
                  All Achievements
                </div>
              </Link>
              <Link to="/settings" className="block p-2 rounded-lg bg-neumorph-base/50 shadow-neumorph-xs border border-white/[0.02] hover:shadow-neumorph-sm transition-all">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Settings className="w-4 h-4 text-slate-400" />
                  Settings
                </div>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
