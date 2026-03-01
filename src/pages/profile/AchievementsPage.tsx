import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Lock, Star, Sparkles, Inbox } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { useAuthStore } from '@/stores/authStore'
import { client } from '@/lib/amplify'

const ACHIEVEMENT_DEFINITIONS = [
  { id: 'first-steps', name: 'First Steps', description: 'Complete your first lesson', icon: '🎯', category: 'learning', rarity: 'common', xp: 50 },
  { id: 'quantum-curious', name: 'Quantum Curious', description: 'Complete 10 lessons', icon: '🔬', category: 'learning', rarity: 'common', xp: 100, target: 10 },
  { id: 'knowledge-seeker', name: 'Knowledge Seeker', description: 'Complete 50 lessons', icon: '📚', category: 'learning', rarity: 'uncommon', xp: 250, target: 50 },
  { id: 'scholar', name: 'Scholar', description: 'Complete 100 lessons', icon: '🎓', category: 'learning', rarity: 'rare', xp: 500, target: 100 },
  { id: 'circuit-builder', name: 'Circuit Builder', description: 'Create your first circuit', icon: '⚡', category: 'simulation', rarity: 'common', xp: 50 },
  { id: 'algorithm-ace', name: 'Algorithm Ace', description: 'Run 50 simulations', icon: '🧮', category: 'simulation', rarity: 'rare', xp: 300, target: 50 },
  { id: 'week-warrior', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', category: 'streak', rarity: 'common', xp: 100, target: 7 },
  { id: 'consistency-king', name: 'Consistency King', description: 'Maintain a 30-day streak', icon: '💪', category: 'streak', rarity: 'rare', xp: 500, target: 30 },
  { id: 'unstoppable', name: 'Unstoppable', description: 'Maintain a 100-day streak', icon: '🚀', category: 'streak', rarity: 'legendary', xp: 2000, target: 100 },
  { id: 'quiz-whiz', name: 'Quiz Whiz', description: 'Pass your first quiz', icon: '✅', category: 'learning', rarity: 'common', xp: 50 },
  { id: 'perfect-score', name: 'Perfect Score', description: 'Get 100% on a quiz', icon: '💯', category: 'learning', rarity: 'uncommon', xp: 200 },
  { id: 'quiz-master', name: 'Quiz Master', description: 'Pass 50 quizzes', icon: '🏆', category: 'learning', rarity: 'rare', xp: 400, target: 50 },
]

const RARITY_COLORS = {
  common: 'from-slate-400 to-slate-500',
  uncommon: 'from-green-400 to-green-500',
  rare: 'from-blue-400 to-blue-500',
  epic: 'from-purple-400 to-purple-500',
  legendary: 'from-yellow-400 to-orange-500',
}

const RARITY_BADGES = {
  common: 'default',
  uncommon: 'success',
  rare: 'info',
  epic: 'primary',
  legendary: 'warning',
} as const

interface UserAchievement {
  achievementId: string
  unlockedAt: string
  progress: number
}

export default function AchievementsPage() {
  const { user } = useAuthStore()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([])
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return
      
      try {
        const { data: achievements } = await client.models.Achievement.list({})
        setUserAchievements(achievements || [])

        const { data: profiles } = await client.models.UserProfile.list({
          filter: { userId: { eq: user.id } }
        })
        if (profiles?.[0]) {
          setUserProfile(profiles[0])
        }
      } catch (error) {
        console.error('Failed to load achievements:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [user?.id])

  const achievements = ACHIEVEMENT_DEFINITIONS.map(def => {
    const userAchievement = userAchievements.find(ua => ua.achievementId === def.id)
    let progress = 0

    if (userProfile && def.target) {
      if (def.category === 'learning' && def.id.includes('lesson')) {
        progress = Math.min(100, ((userProfile.lessonsCompleted || 0) / def.target) * 100)
      } else if (def.category === 'streak') {
        progress = Math.min(100, ((userProfile.currentStreak || 0) / def.target) * 100)
      } else if (def.id.includes('quiz')) {
        progress = Math.min(100, ((userProfile.quizzesPassed || 0) / def.target) * 100)
      } else if (def.id.includes('circuit') || def.id.includes('simulation')) {
        progress = Math.min(100, ((userProfile.circuitsCreated || 0) / def.target) * 100)
      }
    }

    return {
      ...def,
      unlocked: !!userAchievement,
      unlockedAt: userAchievement?.unlockedAt,
      progress: userAchievement ? 100 : progress,
    }
  })

  const filteredAchievements = selectedCategory === 'all'
    ? achievements
    : achievements.filter((a) => a.category === selectedCategory)

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalXpEarned = achievements.filter((a) => a.unlocked).reduce((sum, a) => sum + a.xp, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading achievements...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-white flex items-center gap-2 md:gap-3">
            <Trophy className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />
            Achievements
          </h1>
          <p className="text-sm text-slate-400">Collect achievements as you learn</p>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="text-center">
            <div className="text-lg md:text-2xl font-bold text-white">{unlockedCount}/{achievements.length}</div>
            <div className="text-xs md:text-sm text-slate-400">Unlocked</div>
          </div>
          <div className="text-center">
            <div className="text-lg md:text-2xl font-bold text-quantum-400">{totalXpEarned.toLocaleString()}</div>
            <div className="text-xs md:text-sm text-slate-400">XP Earned</div>
          </div>
        </div>
      </div>

      <Progress value={(unlockedCount / achievements.length) * 100} size="lg" showLabel label="Collection Progress" />

      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <Tabs value={selectedCategory} onChange={setSelectedCategory}>
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
            <TabsTrigger value="learning" className="text-xs md:text-sm">Learning</TabsTrigger>
            <TabsTrigger value="simulation" className="text-xs md:text-sm">Simulation</TabsTrigger>
            <TabsTrigger value="streak" className="text-xs md:text-sm">Streak</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredAchievements.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filteredAchievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card
                variant="neumorph"
                className={`relative overflow-hidden p-4 ${
                  achievement.unlocked
                    ? 'border-white/20'
                    : 'opacity-60 grayscale'
                }`}
              >
                {achievement.unlocked && (
                  <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${RARITY_COLORS[achievement.rarity as keyof typeof RARITY_COLORS]} opacity-20 blur-2xl`} />
                )}

                <div className="flex items-start gap-3 md:gap-4">
                  <div
                    className={`w-12 h-12 md:w-16 md:h-16 rounded-xl flex items-center justify-center text-2xl md:text-3xl flex-shrink-0 ${
                      achievement.unlocked
                        ? `bg-gradient-to-br ${RARITY_COLORS[achievement.rarity as keyof typeof RARITY_COLORS]} shadow-neumorph-sm`
                        : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]'
                    }`}
                  >
                    {achievement.unlocked ? (
                      achievement.icon
                    ) : (
                      <Lock className="w-5 h-5 md:w-6 md:h-6 text-slate-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white text-sm md:text-base truncate">
                        {achievement.name}
                      </h3>
                      {achievement.unlocked && (
                        <Sparkles className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-slate-400 mb-2 line-clamp-2">
                      {achievement.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={RARITY_BADGES[achievement.rarity as keyof typeof RARITY_BADGES]}
                        size="sm"
                      >
                        {achievement.rarity}
                      </Badge>
                      <span className="text-xs text-quantum-400">+{achievement.xp} XP</span>
                    </div>
                  </div>
                </div>

                {!achievement.unlocked && achievement.progress > 0 && (
                  <div className="mt-3">
                    <Progress value={achievement.progress} size="sm" />
                    <p className="text-xs text-slate-400 mt-1">{Math.round(achievement.progress)}% complete</p>
                  </div>
                )}

                {achievement.unlocked && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Star className="w-3 h-3 md:w-4 md:h-4 text-white" />
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-neumorph-base shadow-neumorph-sm border border-white/[0.02] flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-400">No achievements in this category</p>
        </div>
      )}
    </div>
  )
}
