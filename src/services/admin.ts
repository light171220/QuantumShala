import { client } from '@/lib/amplify'

// Note: UserProfile model was renamed to UserGameStats and simplified.
// Identity data (email, username, isVerified) now comes from Cognito.
// This admin service provides user management functions using available data.

export interface AdminUser {
  id: string
  displayName: string
  avatar?: string
  level: number
  totalXp: number
  currentStreak: number
  lastActiveAt?: string
}

export interface UserActivity {
  id: string
  userId: string
  type: 'lesson_start' | 'lesson_complete' | 'quiz_submit' | 'circuit_create' | 'login' | 'signup'
  metadata: Record<string, unknown>
  timestamp: string
}

export async function getAllUsers(limit: number = 100): Promise<{
  users: AdminUser[]
  total: number
}> {
  try {
    const { data: profiles } = await client.models.UserGameStats.list({
      limit,
    })

    const users: AdminUser[] = (profiles || []).map(p => ({
      id: p.userId,
      displayName: p.displayName,
      avatar: p.avatar ?? undefined,
      level: p.level || 1,
      totalXp: p.totalXp || 0,
      currentStreak: p.currentStreak || 0,
      lastActiveAt: p.lastActiveAt ?? undefined,
    }))

    return { users, total: users.length }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { users: [], total: 0 }
  }
}

export async function getUserById(userId: string): Promise<AdminUser | null> {
  try {
    const { data: stats } = await client.models.UserGameStats.list({
      filter: { userId: { eq: userId } },
    })

    if (!stats || stats.length === 0) return null

    const profile = stats[0]
    return {
      id: profile.userId,
      displayName: profile.displayName,
      avatar: profile.avatar ?? undefined,
      level: profile.level || 1,
      totalXp: profile.totalXp || 0,
      currentStreak: profile.currentStreak || 0,
      lastActiveAt: profile.lastActiveAt ?? undefined,
    }
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

export async function getUserActivity(userId: string, limit: number = 50): Promise<UserActivity[]> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { owner: { eq: userId } },
      limit,
    })

    const activities: UserActivity[] = []

    for (const p of progress || []) {
      if (p.startedAt) {
        activities.push({
          id: `${p.lessonId}-start`,
          userId,
          type: 'lesson_start',
          metadata: { lessonId: p.lessonId, trackId: p.trackId, moduleId: p.moduleId },
          timestamp: p.startedAt,
        })
      }
      if (p.completedAt) {
        activities.push({
          id: `${p.lessonId}-complete`,
          userId,
          type: 'lesson_complete',
          metadata: { lessonId: p.lessonId, trackId: p.trackId, moduleId: p.moduleId },
          timestamp: p.completedAt,
        })
      }
      if (p.lastQuizAt) {
        activities.push({
          id: `${p.lessonId}-quiz`,
          userId,
          type: 'quiz_submit',
          metadata: { lessonId: p.lessonId, score: p.quizScore, attempts: p.quizAttempts },
          timestamp: p.lastQuizAt,
        })
      }
    }

    return activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  } catch (error) {
    console.error('Error fetching user activity:', error)
    return []
  }
}

export interface PlatformStats {
  totalUsers: number
  activeUsersToday: number
  activeUsersWeek: number
  averageStreak: number
}

export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    const { data: profiles } = await client.models.UserGameStats.list({ limit: 1000 })

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    let totalUsers = 0
    let activeUsersToday = 0
    let activeUsersWeek = 0
    let totalStreak = 0

    for (const p of profiles || []) {
      totalUsers++
      totalStreak += p.currentStreak || 0

      if (p.lastActiveAt) {
        const lastActive = new Date(p.lastActiveAt)
        if (lastActive >= today) activeUsersToday++
        if (lastActive >= weekAgo) activeUsersWeek++
      }
    }

    return {
      totalUsers,
      activeUsersToday,
      activeUsersWeek,
      averageStreak: totalUsers > 0 ? Math.round(totalStreak / totalUsers) : 0,
    }
  } catch (error) {
    console.error('Error fetching platform stats:', error)
    return {
      totalUsers: 0,
      activeUsersToday: 0,
      activeUsersWeek: 0,
      averageStreak: 0,
    }
  }
}

// Note: Track, Module, Lesson, and Quiz CRUD functions have been removed.
// Content is now loaded directly from S3/CDN via src/services/content.ts
// The following were removed:
// - ContentTrack, ContentModule, ContentLesson, ContentQuiz, QuizQuestion, ImportedContent interfaces
// - createTrack, updateTrack, deleteTrack, getAllTracks
// - createModule, updateModule, deleteModule, getModulesByTrack
// - createLesson, updateLesson, deleteLesson, getLessonsByModule, getLessonById
// - saveQuiz, getQuiz
// - importContent, parseContentStructure
