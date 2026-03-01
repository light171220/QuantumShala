import { client } from '@/lib/amplify'
import type { XPTransactionType } from '@/types/gamification'

export interface XPTransaction {
  id: string
  amount: number
  type: XPTransactionType
  source: string
  sourceId?: string
  multiplier: number
  description?: string
  timestamp: string
}

export function getXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1))
}

export function getLevelFromXP(totalXP: number): { level: number; currentXP: number; nextLevelXP: number } {
  let level = 1
  let xpAccumulated = 0
  
  while (true) {
    const xpNeeded = getXPForLevel(level)
    if (xpAccumulated + xpNeeded > totalXP) {
      return {
        level,
        currentXP: totalXP - xpAccumulated,
        nextLevelXP: xpNeeded,
      }
    }
    xpAccumulated += xpNeeded
    level++
  }
}

export async function awardXP(
  userId: string,
  amount: number,
  type: XPTransaction['type'],
  source: string,
  sourceId?: string,
  description?: string,
  multiplier: number = 1.0
): Promise<{ newTotal: number; leveledUp: boolean; newLevel?: number }> {
  try {
    const { data: profiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } },
    })
    
    if (!profiles || profiles.length === 0) {
      throw new Error('User profile not found')
    }
    
    const profile = profiles[0]
    const currentXP = profile.totalXp || 0
    const currentLevel = profile.level || 1
    const earnedXP = Math.floor(amount * multiplier)
    const newTotal = currentXP + earnedXP
    
    const { level: newLevel } = getLevelFromXP(newTotal)
    const leveledUp = newLevel > currentLevel
    
    await client.models.XPTransaction.create({
      amount: earnedXP,
      type,
      source,
      sourceId,
      multiplier,
      description,
      balanceBefore: currentXP,
      balanceAfter: newTotal,
      timestamp: new Date().toISOString(),
    })
    
    await client.models.UserProfile.update({
      userId: profile.userId,
      totalXp: newTotal,
      xp: newTotal,
      level: newLevel,
      lastActiveAt: new Date().toISOString(),
    })
    
    if (leveledUp) {
      await createNotification(userId, {
        type: 'level_up',
        title: `Level Up! You're now level ${newLevel}`,
        body: `Congratulations! You earned ${earnedXP} XP and reached level ${newLevel}.`,
      })
    }
    
    return { newTotal, leveledUp, newLevel: leveledUp ? newLevel : undefined }
  } catch (error) {
    console.error('Error awarding XP:', error)
    return { newTotal: 0, leveledUp: false }
  }
}

export async function getXPHistory(limit: number = 20): Promise<XPTransaction[]> {
  try {
    const { data: transactions } = await client.models.XPTransaction.list({
      limit,
    })
    
    return (transactions || []).map(t => ({
      id: t.id,
      amount: t.amount,
      type: t.type as XPTransaction['type'],
      source: t.source,
      sourceId: t.sourceId ?? undefined,
      multiplier: t.multiplier || 1.0,
      description: t.description ?? undefined,
      timestamp: t.timestamp,
    }))
  } catch (error) {
    console.error('Error fetching XP history:', error)
    return []
  }
}

export async function updateStreak(userId: string): Promise<{ currentStreak: number; isNewDay: boolean }> {
  try {
    const { data: profiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } },
    })
    
    if (!profiles || profiles.length === 0) {
      return { currentStreak: 0, isNewDay: false }
    }
    
    const profile = profiles[0]
    const lastActive = profile.lastActiveAt ? new Date(profile.lastActiveAt) : null
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    let currentStreak = profile.currentStreak || 0
    let isNewDay = false
    
    if (lastActive) {
      const lastActiveDate = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate())
      const diffDays = Math.floor((today.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) {
        isNewDay = false
      } else if (diffDays === 1) {
        currentStreak++
        isNewDay = true
      } else {
        currentStreak = 1
        isNewDay = true
      }
    } else {
      currentStreak = 1
      isNewDay = true
    }
    
    const longestStreak = Math.max(profile.longestStreak || 0, currentStreak)
    
    await client.models.UserProfile.update({
      userId: profile.userId,
      currentStreak,
      longestStreak,
      lastActiveAt: now.toISOString(),
    })
    
    if (isNewDay && currentStreak > 1) {
      const bonusXP = Math.min(currentStreak * 5, 50)
      await awardXP(userId, bonusXP, 'streak', 'daily_streak', undefined, `${currentStreak} day streak bonus`)
      
      if ([7, 30, 100, 365].includes(currentStreak)) {
        await unlockAchievement(userId, `streak_${currentStreak}`)
      }
    }
    
    return { currentStreak, isNewDay }
  } catch (error) {
    console.error('Error updating streak:', error)
    return { currentStreak: 0, isNewDay: false }
  }
}

export interface Achievement {
  id: string
  achievementId: string
  name: string
  description: string
  icon: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  xpReward: number
  unlockedAt?: string
  progress?: number
  progressMax?: number
}

export const ACHIEVEMENT_DEFINITIONS: Record<string, Omit<Achievement, 'id' | 'unlockedAt' | 'progress' | 'progressMax'>> = {
  first_lesson: {
    achievementId: 'first_lesson',
    name: 'First Steps',
    description: 'Complete your first lesson',
    icon: '🎯',
    rarity: 'common',
    xpReward: 25,
  },
  first_quiz: {
    achievementId: 'first_quiz',
    name: 'Quiz Master',
    description: 'Pass your first quiz',
    icon: '📝',
    rarity: 'common',
    xpReward: 25,
  },
  first_circuit: {
    achievementId: 'first_circuit',
    name: 'Circuit Beginner',
    description: 'Build your first quantum circuit',
    icon: '⚡',
    rarity: 'common',
    xpReward: 25,
  },
  streak_7: {
    achievementId: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: '🔥',
    rarity: 'uncommon',
    xpReward: 100,
  },
  streak_30: {
    achievementId: 'streak_30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day learning streak',
    icon: '🌟',
    rarity: 'rare',
    xpReward: 500,
  },
  streak_100: {
    achievementId: 'streak_100',
    name: 'Century Club',
    description: 'Maintain a 100-day learning streak',
    icon: '💎',
    rarity: 'epic',
    xpReward: 2000,
  },
  streak_365: {
    achievementId: 'streak_365',
    name: 'Quantum Legend',
    description: 'Maintain a 365-day learning streak',
    icon: '👑',
    rarity: 'legendary',
    xpReward: 10000,
  },
  complete_track: {
    achievementId: 'complete_track',
    name: 'Track Champion',
    description: 'Complete an entire learning track',
    icon: '🏆',
    rarity: 'rare',
    xpReward: 500,
  },
  perfect_quiz: {
    achievementId: 'perfect_quiz',
    name: 'Perfect Score',
    description: 'Get 100% on a quiz',
    icon: '💯',
    rarity: 'uncommon',
    xpReward: 50,
  },
  entangled: {
    achievementId: 'entangled',
    name: 'Entangled',
    description: 'Create a Bell state circuit',
    icon: '🔗',
    rarity: 'common',
    xpReward: 25,
  },
}

export async function unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
  try {
    const { data: existing } = await client.models.Achievement.list({
      filter: { achievementId: { eq: achievementId } },
    })
    
    if (existing && existing.length > 0) {
      return false
    }
    
    const definition = ACHIEVEMENT_DEFINITIONS[achievementId]
    if (!definition) {
      console.error('Unknown achievement:', achievementId)
      return false
    }
    
    await client.models.Achievement.create({
      achievementId,
      unlockedAt: new Date().toISOString(),
      progress: 100,
      progressMax: 100,
      isNotified: false,
    })
    
    await awardXP(userId, definition.xpReward, 'achievement', achievementId, undefined, definition.name)
    
    await createNotification(userId, {
      type: 'achievement_unlocked',
      title: `Achievement Unlocked: ${definition.name}`,
      body: definition.description,
      imageUrl: definition.icon,
    })
    
    return true
  } catch (error) {
    console.error('Error unlocking achievement:', error)
    return false
  }
}

export async function getUnlockedAchievements(): Promise<Achievement[]> {
  try {
    const { data: achievements } = await client.models.Achievement.list({})
    
    return (achievements || []).map(a => {
      const definition = ACHIEVEMENT_DEFINITIONS[a.achievementId] || {
        achievementId: a.achievementId,
        name: 'Unknown Achievement',
        description: '',
        icon: '❓',
        rarity: 'common' as const,
        xpReward: 0,
      }
      
      return {
        id: a.id,
        ...definition,
        unlockedAt: a.unlockedAt,
        progress: a.progress ?? undefined,
        progressMax: a.progressMax ?? undefined,
      }
    })
  } catch (error) {
    console.error('Error fetching achievements:', error)
    return []
  }
}

export async function updateAchievementProgress(
  achievementId: string,
  progress: number,
  progressMax: number
): Promise<void> {
  try {
    const { data: existing } = await client.models.Achievement.list({
      filter: { achievementId: { eq: achievementId } },
    })
    
    if (existing && existing.length > 0) {
      await client.models.Achievement.update({
        id: existing[0].id,
        progress,
        progressMax,
      })
    } else {
      await client.models.Achievement.create({
        achievementId,
        unlockedAt: new Date().toISOString(),
        progress,
        progressMax,
        isNotified: false,
      })
    }
  } catch (error) {
    console.error('Error updating achievement progress:', error)
  }
}

export interface DailyChallenge {
  id: string
  date: string
  challengeType: 'lesson' | 'quiz' | 'circuit' | 'streak'
  challengeConfig: Record<string, unknown>
  isCompleted: boolean
  completedAt?: string
  xpEarned: number
  bonusMultiplier: number
}

export async function getTodaysChallenges(): Promise<DailyChallenge[]> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data: challenges } = await client.models.DailyChallenge.list({
      filter: { date: { eq: today } },
    })
    
    return (challenges || []).map(c => ({
      id: c.id,
      date: c.date,
      challengeType: c.challengeType as DailyChallenge['challengeType'],
      challengeConfig: (c.challengeConfig as Record<string, unknown>) || {},
      isCompleted: c.isCompleted || false,
      completedAt: c.completedAt ?? undefined,
      xpEarned: c.xpEarned || 0,
      bonusMultiplier: c.bonusMultiplier || 1.0,
    }))
  } catch (error) {
    console.error('Error fetching daily challenges:', error)
    return []
  }
}

export async function completeChallenge(challengeId: string, xpEarned: number): Promise<void> {
  try {
    await client.models.DailyChallenge.update({
      id: challengeId,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      xpEarned,
    })
  } catch (error) {
    console.error('Error completing challenge:', error)
  }
}

export interface LeaderboardEntry {
  userId: string
  username: string
  displayName: string
  avatar?: string
  xp: number
  rank: number
  previousRank?: number
  rankChange?: number
  lessonsCompleted: number
  streakDays: number
}

export async function getLeaderboard(
  period: 'daily' | 'weekly' | 'monthly' | 'all_time',
  limit: number = 100
): Promise<LeaderboardEntry[]> {
  try {
    const { data: profiles } = await client.models.UserProfile.list({
      limit,
    })
    
    if (!profiles) return []
    
    const sorted = [...profiles].sort((a, b) => (b.totalXp || 0) - (a.totalXp || 0))
    
    return sorted.map((p, index) => ({
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatar: p.avatar ?? undefined,
      xp: p.totalXp || 0,
      rank: index + 1,
      lessonsCompleted: p.lessonsCompleted || 0,
      streakDays: p.currentStreak || 0,
    }))
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return []
  }
}

export interface Notification {
  id: string
  type: string
  title: string
  body?: string
  imageUrl?: string
  actionUrl?: string
  isRead: boolean
  createdAt: string
}

export async function createNotification(
  userId: string,
  data: {
    type: string
    title: string
    body?: string
    imageUrl?: string
    actionUrl?: string
  }
): Promise<void> {
  try {
    await client.models.Notification.create({
      type: data.type as Parameters<typeof client.models.Notification.create>[0]['type'],
      title: data.title,
      body: data.body,
      imageUrl: data.imageUrl,
      actionUrl: data.actionUrl,
      isRead: false,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}

export async function getNotifications(limit: number = 20): Promise<Notification[]> {
  try {
    const { data: notifications } = await client.models.Notification.list({
      limit,
    })
    
    return (notifications || []).map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body ?? undefined,
      imageUrl: n.imageUrl ?? undefined,
      actionUrl: n.actionUrl ?? undefined,
      isRead: n.isRead || false,
      createdAt: n.createdAt,
    }))
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return []
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await client.models.Notification.update({
      id: notificationId,
      isRead: true,
      readAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error marking notification as read:', error)
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    const { data: notifications } = await client.models.Notification.list({
      filter: { isRead: { eq: false } },
    })
    
    if (notifications) {
      await Promise.all(
        notifications.map(n =>
          client.models.Notification.update({
            id: n.id,
            isRead: true,
            readAt: new Date().toISOString(),
          })
        )
      )
    }
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
  }
}
