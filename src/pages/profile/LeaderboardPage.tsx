import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Medal, Crown, TrendingUp, TrendingDown, Minus, Flame, Zap, Inbox } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/stores/authStore'
import { client } from '@/lib/amplify'

interface LeaderboardUser {
  id: string
  username: string
  displayName: string
  totalXp: number
  currentStreak: number
  level: number
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
    case 2:
      return <Medal className="w-5 h-5 md:w-6 md:h-6 text-slate-300" />
    case 3:
      return <Medal className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
    default:
      return <span className="text-base md:text-lg font-bold text-slate-400">{rank}</span>
  }
}

export default function LeaderboardPage() {
  const { user } = useAuthStore()
  const [timeframe, setTimeframe] = useState('all-time')
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null)

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const { data: profiles } = await client.models.UserProfile.list({
          limit: 100,
        })

        if (profiles) {
          const sorted = profiles
            .map(p => ({
              id: p.userId,
              username: p.username,
              displayName: p.displayName,
              totalXp: p.totalXp || 0,
              currentStreak: p.currentStreak || 0,
              level: p.level || 1,
            }))
            .sort((a, b) => b.totalXp - a.totalXp)

          setLeaderboard(sorted)

          if (user?.id) {
            const userIndex = sorted.findIndex(u => u.id === user.id)
            if (userIndex !== -1) {
              setCurrentUserRank(userIndex + 1)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load leaderboard:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadLeaderboard()
  }, [user?.id])

  const currentUserData = leaderboard.find(u => u.id === user?.id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading leaderboard...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-white flex items-center gap-2 md:gap-3">
            <Trophy className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />
            Leaderboard
          </h1>
          <p className="text-sm text-slate-400">See how you rank against other learners</p>
        </div>
      </div>

      <Tabs value={timeframe} onChange={setTimeframe}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all-time" className="flex-1 sm:flex-none text-xs sm:text-sm">All Time</TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1 sm:flex-none text-xs sm:text-sm">Monthly</TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1 sm:flex-none text-xs sm:text-sm">Weekly</TabsTrigger>
        </TabsList>
      </Tabs>

      {leaderboard.length > 0 ? (
        <>
          {leaderboard.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              {leaderboard.slice(0, 3).map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    variant="neumorph"
                    className={`text-center relative overflow-hidden p-3 md:p-4 ${
                      index === 0
                        ? 'bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30'
                        : index === 1
                        ? 'bg-gradient-to-b from-slate-400/20 to-transparent border-slate-400/30'
                        : 'bg-gradient-to-b from-amber-600/20 to-transparent border-amber-600/30'
                    }`}
                  >
                    <div className="mb-2 md:mb-4">{getRankIcon(index + 1)}</div>
                    <div className="w-10 h-10 md:w-16 md:h-16 mx-auto rounded-full bg-gradient-to-br from-quantum-500 to-neon-purple flex items-center justify-center text-lg md:text-2xl font-bold text-white mb-2 md:mb-3">
                      {entry.displayName?.charAt(0) || '?'}
                    </div>
                    <h3 className="font-semibold text-white text-xs md:text-base truncate">{entry.displayName}</h3>
                    <p className="text-xs text-slate-400 truncate hidden sm:block">@{entry.username}</p>
                    <div className="mt-2 md:mt-4 flex justify-center gap-2 md:gap-4">
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 md:w-4 md:h-4 text-quantum-400" />
                        <span className="text-white font-medium text-xs md:text-sm">
                          {entry.totalXp >= 1000 ? `${(entry.totalXp / 1000).toFixed(1)}k` : entry.totalXp}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flame className="w-3 h-3 md:w-4 md:h-4 text-orange-400" />
                        <span className="text-white font-medium text-xs md:text-sm">{entry.currentStreak}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          <Card variant="neumorph" className="overflow-hidden">
            <div className="divide-y divide-white/10">
              {leaderboard.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`flex items-center gap-2 md:gap-4 p-3 md:p-4 hover:bg-white/5 transition-colors ${
                    entry.id === user?.id ? 'bg-quantum-500/10' : ''
                  }`}
                >
                  <div className="w-8 md:w-10 flex justify-center flex-shrink-0">{getRankIcon(index + 1)}</div>
                  
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-quantum-500 to-neon-purple flex items-center justify-center text-white font-semibold text-sm md:text-base flex-shrink-0">
                    {entry.displayName?.charAt(0) || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white text-sm md:text-base truncate">{entry.displayName}</p>
                      {entry.id === user?.id && <Badge variant="primary" size="sm">You</Badge>}
                    </div>
                    <p className="text-xs md:text-sm text-slate-400 hidden sm:block">@{entry.username}</p>
                  </div>

                  <div className="flex items-center gap-3 md:gap-6">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-quantum-400">
                        <Zap className="w-3 h-3 md:w-4 md:h-4" />
                        <span className="font-medium text-xs md:text-sm">
                          {entry.totalXp >= 1000 ? `${(entry.totalXp / 1000).toFixed(1)}k` : entry.totalXp}
                        </span>
                      </div>
                    </div>

                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-1 text-orange-400">
                        <Flame className="w-3 h-3 md:w-4 md:h-4" />
                        <span className="font-medium text-xs md:text-sm">{entry.currentStreak}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      Lv {entry.level}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          {currentUserRank && currentUserRank > 10 && currentUserData && (
            <Card variant="neumorph" className="bg-quantum-500/10 border-quantum-500/30">
              <div className="flex items-center gap-2 md:gap-4 p-3 md:p-4">
                <div className="w-8 md:w-10 flex justify-center flex-shrink-0">
                  <span className="text-base md:text-lg font-bold text-quantum-400">#{currentUserRank}</span>
                </div>
                
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-quantum-500 to-neon-purple flex items-center justify-center text-white font-semibold text-sm md:text-base flex-shrink-0">
                  {currentUserData.displayName?.charAt(0) || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm md:text-base truncate">{currentUserData.displayName}</p>
                  <p className="text-xs md:text-sm text-slate-400 hidden sm:block">@{currentUserData.username}</p>
                </div>

                <Badge variant="primary" size="sm">You</Badge>

                <div className="flex items-center gap-3 md:gap-6">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-quantum-400">
                      <Zap className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="font-medium text-xs md:text-sm">
                        {currentUserData.totalXp >= 1000 ? `${(currentUserData.totalXp / 1000).toFixed(1)}k` : currentUserData.totalXp}
                      </span>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-1 text-orange-400">
                      <Flame className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="font-medium text-xs md:text-sm">{currentUserData.currentStreak}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card variant="neumorph" className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-neumorph-base shadow-neumorph-sm border border-white/[0.02] flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 mb-2">No users on the leaderboard yet</p>
            <p className="text-sm text-slate-500">Start learning to appear on the leaderboard!</p>
          </div>
        </Card>
      )}
    </div>
  )
}
