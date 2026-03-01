import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Achievement, DailyGoal, LeaderboardEntry, Streak, XPTransaction } from '@/types/gamification'
import * as gamificationService from '@/services/gamification'

function getCurrentUserId(): string | null {
  const { useAuthStore } = require('./authStore')
  return useAuthStore.getState().user?.id || null
}

interface GamificationState {
  achievements: Achievement[]
  unlockedAchievements: string[]
  dailyGoals: DailyGoal[]
  streak: Streak
  leaderboard: LeaderboardEntry[]
  recentXP: XPTransaction[]
  showXPNotification: boolean
  pendingXP: number
  newAchievement: Achievement | null
  isLoading: boolean
  isSyncing: boolean
}

interface GamificationActions {
  syncAchievements: () => Promise<void>
  syncLeaderboard: (period?: 'daily' | 'weekly' | 'monthly' | 'all_time') => Promise<void>
  syncDailyChallenges: () => Promise<void>
  syncXPHistory: () => Promise<void>

  setAchievements: (achievements: Achievement[]) => void
  unlockAchievement: (achievementId: string) => Promise<void>
  setDailyGoals: (goals: DailyGoal[]) => void
  updateDailyGoal: (goalId: string, progress: number) => void
  completeDailyGoal: (goalId: string) => void
  setStreak: (streak: Streak) => void
  setLeaderboard: (entries: LeaderboardEntry[]) => void
  addXPTransaction: (transaction: XPTransaction) => void
  showXPGain: (amount: number) => void
  hideXPNotification: () => void
  setNewAchievement: (achievement: Achievement | null) => void
  checkAchievements: (stats: AchievementCheckStats) => Promise<Achievement[]>

  awardXP: (amount: number, type: XPTransaction['type'], source: string, description?: string) => Promise<void>
  updateStreak: () => Promise<void>
}

interface AchievementCheckStats {
  lessonsCompleted: number
  quizzesPassed: number
  perfectQuizzes: number
  simulationsRun: number
  circuitsCreated: number
  streakDays: number
  totalXp: number
  level: number
}

const initialStreak: Streak = {
  current: 0,
  longest: 0,
  lastActiveDate: '',
  freezesRemaining: 2,
  history: [],
}

const initialState: GamificationState = {
  achievements: [],
  unlockedAchievements: [],
  dailyGoals: [],
  streak: initialStreak,
  leaderboard: [],
  recentXP: [],
  showXPNotification: false,
  pendingXP: 0,
  newAchievement: null,
  isLoading: false,
  isSyncing: false,
}

export const useGamificationStore = create<GamificationState & GamificationActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      syncAchievements: async () => {
        set((state) => {
          state.isSyncing = true
        })

        try {
          const unlocked = await gamificationService.getUnlockedAchievements()

          const achievements: Achievement[] = Object.entries(gamificationService.ACHIEVEMENT_DEFINITIONS).map(
            ([id, def]) => {
              const unlockedAch = unlocked.find(a => a.achievementId === id)
              return {
                id,
                name: def.name,
                description: def.description,
                icon: def.icon,
                rarity: def.rarity,
                xpReward: def.xpReward,
                unlockedAt: unlockedAch?.unlockedAt,
                requirement: { type: 'custom' as const, value: 1 },
              }
            }
          )

          set((state) => {
            state.achievements = achievements
            state.unlockedAchievements = unlocked.map(a => a.achievementId)
            state.isSyncing = false
          })
        } catch (error) {
          console.error('Failed to sync achievements:', error)
          set((state) => {
            state.isSyncing = false
          })
        }
      },

      syncLeaderboard: async (period = 'weekly') => {
        set((state) => {
          state.isLoading = true
        })

        try {
          const entries = await gamificationService.getLeaderboard(period)

          set((state) => {
            state.leaderboard = entries.map(e => ({
              rank: e.rank,
              userId: e.userId,
              username: e.username,
              displayName: e.displayName,
              avatar: e.avatar,
              xp: e.xp,
              level: gamificationService.getLevelFromXP(e.xp).level,
              streak: e.streakDays,
              lessonsCompleted: e.lessonsCompleted,
              rankChange: e.rankChange,
            }))
            state.isLoading = false
          })
        } catch (error) {
          console.error('Failed to sync leaderboard:', error)
          set((state) => {
            state.isLoading = false
          })
        }
      },

      syncDailyChallenges: async () => {
        try {
          const challenges = await gamificationService.getTodaysChallenges()

          set((state) => {
            state.dailyGoals = challenges.map(c => ({
              id: c.id,
              type: c.challengeType,
              title: `Complete ${c.challengeType}`,
              description: '',
              target: 1,
              current: c.isCompleted ? 1 : 0,
              xpReward: c.xpEarned || 25,
              completed: c.isCompleted,
            }))
          })
        } catch (error) {
          console.error('Failed to sync daily challenges:', error)
        }
      },

      syncXPHistory: async () => {
        try {
          const transactions = await gamificationService.getXPHistory(20)

          set((state) => {
            state.recentXP = transactions.map(t => ({
              id: t.id,
              amount: t.amount,
              type: t.type,
              description: t.description || t.source,
              timestamp: t.timestamp,
            }))
          })
        } catch (error) {
          console.error('Failed to sync XP history:', error)
        }
      },

      setAchievements: (achievements) =>
        set((state) => {
          state.achievements = achievements
        }),

      unlockAchievement: async (achievementId) => {
        const state = get()
        if (state.unlockedAchievements.includes(achievementId)) {
          return
        }

        const userId = getCurrentUserId()
        if (!userId) return

        try {
          const success = await gamificationService.unlockAchievement(userId, achievementId)

          if (success) {
            set((s) => {
              s.unlockedAchievements.push(achievementId)
              const achievement = s.achievements.find((a) => a.id === achievementId)
              if (achievement) {
                achievement.unlockedAt = new Date().toISOString()
                s.newAchievement = achievement
              }
            })
          }
        } catch (error) {
          console.error('Failed to unlock achievement:', error)
        }
      },

      setDailyGoals: (goals) =>
        set((state) => {
          state.dailyGoals = goals
        }),

      updateDailyGoal: (goalId, progress) =>
        set((state) => {
          const goal = state.dailyGoals.find((g) => g.id === goalId)
          if (goal) {
            goal.current = Math.min(progress, goal.target)
            if (goal.current >= goal.target) {
              goal.completed = true
            }
          }
        }),

      completeDailyGoal: (goalId) =>
        set((state) => {
          const goal = state.dailyGoals.find((g) => g.id === goalId)
          if (goal) {
            goal.completed = true
            goal.current = goal.target
          }
        }),

      setStreak: (streak) =>
        set((state) => {
          state.streak = streak
        }),

      setLeaderboard: (entries) =>
        set((state) => {
          state.leaderboard = entries
        }),

      addXPTransaction: (transaction) =>
        set((state) => {
          state.recentXP.unshift(transaction)
          if (state.recentXP.length > 50) {
            state.recentXP.pop()
          }
        }),

      showXPGain: (amount) =>
        set((state) => {
          state.pendingXP = amount
          state.showXPNotification = true
        }),

      hideXPNotification: () =>
        set((state) => {
          state.showXPNotification = false
          state.pendingXP = 0
        }),

      setNewAchievement: (achievement) =>
        set((state) => {
          state.newAchievement = achievement
        }),

      awardXP: async (amount, type, source, description) => {
        const userId = getCurrentUserId()
        if (!userId) return

        try {
          const result = await gamificationService.awardXP(userId, amount, type, source, undefined, description)

          set((state) => {
            state.pendingXP = amount
            state.showXPNotification = true
          })

          set((state) => {
            state.recentXP.unshift({
              id: Date.now().toString(),
              amount,
              type,
              description: description || source,
              timestamp: new Date().toISOString(),
            })
          })

          if (result.leveledUp && result.newLevel) {
            console.log(`Leveled up to ${result.newLevel}!`)
          }
        } catch (error) {
          console.error('Failed to award XP:', error)
        }
      },

      updateStreak: async () => {
        const userId = getCurrentUserId()
        if (!userId) return

        try {
          const result = await gamificationService.updateStreak(userId)

          set((state) => {
            state.streak.current = result.currentStreak
            state.streak.lastActiveDate = new Date().toISOString().split('T')[0]
            if (result.currentStreak > state.streak.longest) {
              state.streak.longest = result.currentStreak
            }
          })
        } catch (error) {
          console.error('Failed to update streak:', error)
        }
      },

      checkAchievements: async (stats) => {
        const state = get()
        const newlyUnlocked: Achievement[] = []
        const userId = getCurrentUserId()
        if (!userId) return []

        for (const achievement of state.achievements) {
          if (state.unlockedAchievements.includes(achievement.id)) {
            continue
          }

          let shouldUnlock = false
          const req = achievement.requirement

          switch (req.type) {
            case 'lessons_completed':
              shouldUnlock = stats.lessonsCompleted >= req.value
              break
            case 'quizzes_passed':
              shouldUnlock = stats.quizzesPassed >= req.value
              break
            case 'perfect_quizzes':
              shouldUnlock = stats.perfectQuizzes >= req.value
              break
            case 'simulations_run':
              shouldUnlock = stats.simulationsRun >= req.value
              break
            case 'circuits_created':
              shouldUnlock = stats.circuitsCreated >= req.value
              break
            case 'streak_days':
              shouldUnlock = stats.streakDays >= req.value
              break
            case 'total_xp':
              shouldUnlock = stats.totalXp >= req.value
              break
            case 'level_reached':
              shouldUnlock = stats.level >= req.value
              break
          }

          if (shouldUnlock) {
            try {
              const success = await gamificationService.unlockAchievement(userId, achievement.id)
              if (success) {
                newlyUnlocked.push(achievement)
                set((s) => {
                  s.unlockedAchievements.push(achievement.id)
                })
              }
            } catch (error) {
              console.error('Failed to unlock achievement:', error)
            }
          }
        }

        return newlyUnlocked
      },
    })),
    {
      name: 'quantumshala-gamification',
      partialize: (state) => ({
        unlockedAchievements: state.unlockedAchievements,
        streak: state.streak,
        recentXP: state.recentXP.slice(0, 10),
      }),
    }
  )
)
