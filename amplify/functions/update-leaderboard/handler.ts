import type { Handler, ScheduledEvent } from 'aws-lambda'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime'
import { env } from '$amplify/env/update-leaderboard'
import type { Schema } from '../../data/resource'

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
Amplify.configure(resourceConfig, libraryOptions)

const client = generateClient<Schema>()

interface LeaderboardUser {
  userId: string
  xp: number
  lessonsCompleted: number
  quizzesPassed: number
  streakDays: number
}

interface ManualTrigger {
  period?: string
}

function getCurrentPeriods(): { daily: string; weekly: string; monthly: string; allTime: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const weekYear = startOfWeek.getFullYear()
  const weekNum = Math.ceil(
    ((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7
  )

  return {
    daily: `${year}-${month}-${day}`,
    weekly: `${weekYear}-W${String(weekNum).padStart(2, '0')}`,
    monthly: `${year}-${month}`,
    allTime: 'all-time',
  }
}

function isManualTrigger(event: ScheduledEvent | ManualTrigger): event is ManualTrigger {
  return 'period' in event && typeof (event as ManualTrigger).period === 'string'
}

export const handler: Handler<ScheduledEvent | ManualTrigger> = async (event) => {
  try {
    const periods = getCurrentPeriods()
    const periodsToUpdate = isManualTrigger(event) && event.period
      ? [event.period]
      : Object.values(periods)

    const { data: users } = await client.models.UserProfile.list()

    if (!users || users.length === 0) {
      return { success: true, message: 'No users to process' }
    }

    const eligibleUsers = users.filter((u) => {
      const settings = u.privacySettings
        ? JSON.parse(u.privacySettings as string)
        : { showOnLeaderboard: true }
      return settings.showOnLeaderboard !== false && !u.isBanned
    })

    for (const period of periodsToUpdate) {
      const periodStart = getPeriodStartDate(period)

      const userStats: LeaderboardUser[] = []

      for (const user of eligibleUsers) {
        let periodXp = 0

        if (period === 'all-time') {
          periodXp = user.totalXp || 0
        } else {
          const { data: transactions } = await client.models.XPTransaction.list({
            filter: {
              timestamp: { ge: periodStart.toISOString() },
            },
          })

          periodXp =
            transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0
        }

        userStats.push({
          userId: user.userId,
          xp: periodXp,
          lessonsCompleted: user.lessonsCompleted || 0,
          quizzesPassed: user.quizzesPassed || 0,
          streakDays: user.currentStreak || 0,
        })
      }

      userStats.sort((a, b) => b.xp - a.xp)

      const { data: existingEntries } = await client.models.LeaderboardEntry.list({
        filter: { period: { eq: period } },
      })

      const existingMap = new Map(
        existingEntries?.map((e) => [e.userId, e]) || []
      )

      for (let i = 0; i < userStats.length; i++) {
        const user = userStats[i]
        const rank = i + 1
        const existing = existingMap.get(user.userId)
        const previousRank = existing?.rank || null

        if (existing) {
          await client.models.LeaderboardEntry.update({
            userId: user.userId,
            period,
            xp: user.xp,
            rank,
            previousRank: previousRank,
            rankChange: previousRank ? previousRank - rank : 0,
            lessonsCompleted: user.lessonsCompleted,
            quizzesPassed: user.quizzesPassed,
            streakDays: user.streakDays,
            updatedAt: new Date().toISOString(),
          })
        } else {
          await client.models.LeaderboardEntry.create({
            userId: user.userId,
            period,
            xp: user.xp,
            rank,
            previousRank: null,
            rankChange: 0,
            lessonsCompleted: user.lessonsCompleted,
            quizzesPassed: user.quizzesPassed,
            streakDays: user.streakDays,
            updatedAt: new Date().toISOString(),
          })
        }

        if (
          previousRank &&
          previousRank > 3 &&
          rank <= 3 &&
          period === periods.weekly
        ) {
          await client.models.Notification.create({
            type: 'achievement_unlocked',
            title: '🏆 Top 3 on Leaderboard!',
            body: `Congratulations! You've reached #${rank} on the weekly leaderboard!`,
            isRead: false,
            createdAt: new Date().toISOString(),
          })
        }
      }
    }

    return {
      success: true,
      message: `Updated leaderboard for ${periodsToUpdate.length} periods`,
      usersProcessed: eligibleUsers.length,
    }
  } catch (error) {
    console.error('Error updating leaderboard:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function getPeriodStartDate(period: string): Date {
  const now = new Date()

  if (period === 'all-time') {
    return new Date(0)
  }

  if (period.includes('-W')) {
    const [year, week] = period.split('-W')
    const date = new Date(parseInt(year), 0, 1)
    const dayOfWeek = date.getDay()
    const diff = (parseInt(week) - 1) * 7 - dayOfWeek
    date.setDate(date.getDate() + diff)
    return date
  }

  if (period.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(period)
  }

  if (period.match(/^\d{4}-\d{2}$/)) {
    return new Date(`${period}-01`)
  }

  return now
}
