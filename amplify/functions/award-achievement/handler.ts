import type { Handler } from 'aws-lambda'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime'
import { env } from '$amplify/env/award-achievement'
import type { Schema } from '../../data/resource'

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
Amplify.configure(resourceConfig, libraryOptions)

const client = generateClient<Schema>()

interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  xpReward: number
  category: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  requirement: {
    type: string
    value: number
  }
}

const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_lesson',
    name: 'First Steps',
    description: 'Complete your first lesson',
    icon: '🎯',
    xpReward: 50,
    category: 'learning',
    tier: 'bronze',
    requirement: { type: 'lessons_completed', value: 1 },
  },
  {
    id: 'lesson_10',
    name: 'Knowledge Seeker',
    description: 'Complete 10 lessons',
    icon: '📚',
    xpReward: 100,
    category: 'learning',
    tier: 'bronze',
    requirement: { type: 'lessons_completed', value: 10 },
  },
  {
    id: 'lesson_50',
    name: 'Dedicated Learner',
    description: 'Complete 50 lessons',
    icon: '🎓',
    xpReward: 250,
    category: 'learning',
    tier: 'silver',
    requirement: { type: 'lessons_completed', value: 50 },
  },
  {
    id: 'lesson_100',
    name: 'Quantum Scholar',
    description: 'Complete 100 lessons',
    icon: '🏆',
    xpReward: 500,
    category: 'learning',
    tier: 'gold',
    requirement: { type: 'lessons_completed', value: 100 },
  },
  {
    id: 'quiz_master_10',
    name: 'Quiz Novice',
    description: 'Pass 10 quizzes',
    icon: '✅',
    xpReward: 100,
    category: 'quiz',
    tier: 'bronze',
    requirement: { type: 'quizzes_passed', value: 10 },
  },
  {
    id: 'quiz_master_50',
    name: 'Quiz Master',
    description: 'Pass 50 quizzes',
    icon: '🧠',
    xpReward: 300,
    category: 'quiz',
    tier: 'silver',
    requirement: { type: 'quizzes_passed', value: 50 },
  },
  {
    id: 'perfect_quiz_5',
    name: 'Perfectionist',
    description: 'Get perfect scores on 5 quizzes',
    icon: '💯',
    xpReward: 200,
    category: 'quiz',
    tier: 'silver',
    requirement: { type: 'perfect_quizzes', value: 5 },
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    xpReward: 150,
    category: 'streak',
    tier: 'bronze',
    requirement: { type: 'streak', value: 7 },
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    icon: '⚡',
    xpReward: 500,
    category: 'streak',
    tier: 'gold',
    requirement: { type: 'streak', value: 30 },
  },
  {
    id: 'streak_100',
    name: 'Century Club',
    description: 'Maintain a 100-day streak',
    icon: '👑',
    xpReward: 1000,
    category: 'streak',
    tier: 'platinum',
    requirement: { type: 'streak', value: 100 },
  },
  {
    id: 'circuit_creator_5',
    name: 'Circuit Builder',
    description: 'Create 5 quantum circuits',
    icon: '🔧',
    xpReward: 100,
    category: 'simulator',
    tier: 'bronze',
    requirement: { type: 'circuits_created', value: 5 },
  },
  {
    id: 'circuit_creator_25',
    name: 'Circuit Engineer',
    description: 'Create 25 quantum circuits',
    icon: '⚙️',
    xpReward: 250,
    category: 'simulator',
    tier: 'silver',
    requirement: { type: 'circuits_created', value: 25 },
  },
  {
    id: 'first_track',
    name: 'Track Champion',
    description: 'Complete your first learning track',
    icon: '🏅',
    xpReward: 500,
    category: 'learning',
    tier: 'gold',
    requirement: { type: 'tracks_completed', value: 1 },
  },
  {
    id: 'level_10',
    name: 'Rising Star',
    description: 'Reach level 10',
    icon: '⭐',
    xpReward: 200,
    category: 'progression',
    tier: 'silver',
    requirement: { type: 'level', value: 10 },
  },
  {
    id: 'level_25',
    name: 'Quantum Explorer',
    description: 'Reach level 25',
    icon: '🌟',
    xpReward: 500,
    category: 'progression',
    tier: 'gold',
    requirement: { type: 'level', value: 25 },
  },
]

interface CheckAchievementsRequest {
  userId: string
  trigger: string
  value?: number
}

interface AchievementResult {
  success: boolean
  newAchievements: {
    achievementId: string
    name: string
    description: string
    icon: string
    xpReward: number
    tier: string
  }[]
  totalXpAwarded: number
}

export const handler: Handler<CheckAchievementsRequest, AchievementResult> = async (event) => {
  const { userId } = event

  try {
    const { data: userProfiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } },
    })

    if (!userProfiles || userProfiles.length === 0) {
      return { success: false, newAchievements: [], totalXpAwarded: 0 }
    }

    const user = userProfiles[0]

    const { data: existingAchievements } = await client.models.Achievement.list()
    const unlockedIds = new Set(existingAchievements?.map((a) => a.achievementId) || [])

    const userStats = {
      lessons_completed: user.lessonsCompleted || 0,
      quizzes_passed: user.quizzesPassed || 0,
      perfect_quizzes: 0,
      streak: user.currentStreak || 0,
      circuits_created: user.circuitsCreated || 0,
      tracks_completed: 0,
      level: user.level || 1,
    }

    const { data: trackProgress } = await client.models.TrackProgress.list({
      filter: { status: { eq: 'completed' } },
    })
    userStats.tracks_completed = trackProgress?.length || 0

    const newAchievements: AchievementResult['newAchievements'] = []
    let totalXpAwarded = 0

    for (const achievement of ACHIEVEMENTS) {
      if (unlockedIds.has(achievement.id)) continue

      const statValue = userStats[achievement.requirement.type as keyof typeof userStats] || 0
      if (statValue >= achievement.requirement.value) {
        await client.models.Achievement.create({
          achievementId: achievement.id,
          unlockedAt: new Date().toISOString(),
          progress: achievement.requirement.value,
          progressMax: achievement.requirement.value,
          isNotified: false,
        })

        await client.models.XPTransaction.create({
          amount: achievement.xpReward,
          type: 'achievement',
          source: 'achievement_unlock',
          sourceId: achievement.id,
          multiplier: 1.0,
          description: `Achievement unlocked: ${achievement.name}`,
          timestamp: new Date().toISOString(),
        })

        await client.models.Notification.create({
          type: 'achievement_unlocked',
          title: '🏆 Achievement Unlocked!',
          body: `${achievement.icon} ${achievement.name}: ${achievement.description}`,
          actionUrl: '/achievements',
          actionData: JSON.stringify({ achievementId: achievement.id }),
          isRead: false,
          createdAt: new Date().toISOString(),
        })

        newAchievements.push({
          achievementId: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          xpReward: achievement.xpReward,
          tier: achievement.tier,
        })

        totalXpAwarded += achievement.xpReward
      }
    }

    if (totalXpAwarded > 0) {
      const newTotalXp = (user.totalXp || 0) + totalXpAwarded
      const newXp = (user.xp || 0) + totalXpAwarded
      const newLevel = calculateLevel(newTotalXp)

      await client.models.UserProfile.update({
        userId: user.userId,
        xp: newXp,
        totalXp: newTotalXp,
        level: newLevel,
      })

      if (newLevel > (user.level || 1)) {
        await client.models.Notification.create({
          type: 'level_up',
          title: '🎉 Level Up!',
          body: `Congratulations! You've reached level ${newLevel}!`,
          actionUrl: '/profile',
          isRead: false,
          createdAt: new Date().toISOString(),
        })
      }
    }

    return {
      success: true,
      newAchievements,
      totalXpAwarded,
    }
  } catch (error) {
    console.error('Error checking achievements:', error)
    return { success: false, newAchievements: [], totalXpAwarded: 0 }
  }
}

function calculateLevel(totalXp: number): number {
  const baseXp = 100
  const multiplier = 1.5
  let level = 1
  let xpForNextLevel = baseXp

  while (totalXp >= xpForNextLevel) {
    totalXp -= xpForNextLevel
    level++
    xpForNextLevel = Math.floor(baseXp * Math.pow(multiplier, level - 1))
  }

  return level
}
