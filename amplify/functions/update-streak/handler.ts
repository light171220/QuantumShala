import type { Handler } from 'aws-lambda'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime'
import { env } from '$amplify/env/update-streak'
import type { Schema } from '../../data/resource'

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
Amplify.configure(resourceConfig, libraryOptions)

const client = generateClient<Schema>()

interface UpdateStreakRequest {
  userId: string
  activityType: 'lesson' | 'quiz' | 'circuit' | 'login'
}

interface UpdateStreakResponse {
  success: boolean
  currentStreak: number
  longestStreak: number
  streakBroken: boolean
  streakFreezeUsed: boolean
  xpBonus: number
  milestoneReached?: number
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getDaysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export const handler: Handler<UpdateStreakRequest, UpdateStreakResponse> = async (event) => {
  const { userId } = event

  try {
    const { data: userProfiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } },
    })

    if (!userProfiles || userProfiles.length === 0) {
      return {
        success: false,
        currentStreak: 0,
        longestStreak: 0,
        streakBroken: false,
        streakFreezeUsed: false,
        xpBonus: 0,
      }
    }

    const user = userProfiles[0]
    const today = getDateString(new Date())
    const lastActiveStr = user.lastActiveAt
      ? getDateString(new Date(user.lastActiveAt))
      : null

    let currentStreak = user.currentStreak || 0
    let longestStreak = user.longestStreak || 0
    let streakFreezesAvailable = user.streakFreezesAvailable || 0
    let streakBroken = false
    let streakFreezeUsed = false
    let xpBonus = 0

    if (lastActiveStr === today) {
      return {
        success: true,
        currentStreak,
        longestStreak,
        streakBroken: false,
        streakFreezeUsed: false,
        xpBonus: 0,
      }
    }

    if (lastActiveStr) {
      const daysDiff = getDaysDifference(lastActiveStr, today)

      if (daysDiff === 1) {
        currentStreak += 1
      } else if (daysDiff === 2 && streakFreezesAvailable > 0) {
        currentStreak += 1
        streakFreezesAvailable -= 1
        streakFreezeUsed = true

        await client.models.Notification.create({
          type: 'streak_milestone',
          title: '❄️ Streak Freeze Used',
          body: `Your streak freeze saved your ${currentStreak}-day streak! You have ${streakFreezesAvailable} freezes left.`,
          isRead: false,
          createdAt: new Date().toISOString(),
        })
      } else if (daysDiff > 1) {
        if (currentStreak >= 7) {
          await client.models.Notification.create({
            type: 'streak_milestone',
            title: '💔 Streak Lost',
            body: `Your ${currentStreak}-day streak has ended. Start a new one today!`,
            isRead: false,
            createdAt: new Date().toISOString(),
          })
        }
        currentStreak = 1
        streakBroken = true
      }
    } else {
      currentStreak = 1
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak
    }

    const streakMilestones = [7, 14, 30, 60, 100, 365]
    let milestoneReached: number | undefined

    for (const milestone of streakMilestones) {
      if (currentStreak === milestone) {
        milestoneReached = milestone

        const bonusXp =
          milestone === 7
            ? 100
            : milestone === 14
            ? 200
            : milestone === 30
            ? 500
            : milestone === 60
            ? 1000
            : milestone === 100
            ? 2000
            : 5000

        xpBonus = bonusXp

        await client.models.XPTransaction.create({
          amount: bonusXp,
          type: 'streak',
          source: 'streak_milestone',
          sourceId: `streak-${milestone}`,
          multiplier: 1.0,
          description: `${milestone}-day streak milestone!`,
          timestamp: new Date().toISOString(),
        })

        await client.models.Notification.create({
          type: 'streak_milestone',
          title: `🔥 ${milestone}-Day Streak!`,
          body: `Amazing! You've maintained a ${milestone}-day learning streak! +${bonusXp} XP`,
          isRead: false,
          createdAt: new Date().toISOString(),
        })

        if (milestone === 30 || milestone === 100 || milestone === 365) {
          streakFreezesAvailable += 1
        }

        break
      }
    }

    await client.models.UserProfile.update({
      userId: user.userId,
      currentStreak,
      longestStreak,
      streakFreezesAvailable,
      lastActiveAt: new Date().toISOString(),
      xp: (user.xp || 0) + xpBonus,
      totalXp: (user.totalXp || 0) + xpBonus,
    })

    return {
      success: true,
      currentStreak,
      longestStreak,
      streakBroken,
      streakFreezeUsed,
      xpBonus,
      milestoneReached,
    }
  } catch (error) {
    console.error('Error updating streak:', error)
    return {
      success: false,
      currentStreak: 0,
      longestStreak: 0,
      streakBroken: false,
      streakFreezeUsed: false,
      xpBonus: 0,
    }
  }
}
