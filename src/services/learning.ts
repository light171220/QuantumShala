import { client } from '@/lib/amplify'

let _cachedUserId: string | null = null

export function setCurrentUserId(userId: string | null): void {
  _cachedUserId = userId
}

async function updateUserProfileStats(updates: {
  lessonsCompleted?: number
  quizzesPassed?: number
  circuitsCreated?: number
  totalTimeMinutes?: number
}): Promise<void> {
  try {
    if (!_cachedUserId) return
    const userId = _cachedUserId

    const { data: profiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } },
    })

    if (profiles && profiles.length > 0) {
      const profile = profiles[0]
      const updateData: Record<string, unknown> = { userId: profile.userId }

      if (updates.lessonsCompleted) {
        updateData.lessonsCompleted = (profile.lessonsCompleted || 0) + updates.lessonsCompleted
      }
      if (updates.quizzesPassed) {
        updateData.quizzesPassed = (profile.quizzesPassed || 0) + updates.quizzesPassed
      }
      if (updates.circuitsCreated) {
        updateData.circuitsCreated = (profile.circuitsCreated || 0) + updates.circuitsCreated
      }
      if (updates.totalTimeMinutes) {
        updateData.totalTimeMinutes = (profile.totalTimeMinutes || 0) + updates.totalTimeMinutes
      }

      await client.models.UserProfile.update(updateData as Parameters<typeof client.models.UserProfile.update>[0])
    }
  } catch (error) {
    console.error('Error updating user profile stats:', error)
  }
}

export interface LessonProgress {
  lessonId: string
  trackId: string
  moduleId: string
  status: 'not_started' | 'in_progress' | 'completed'
  progressPercent: number
  quizScore?: number
  quizAttempts: number
  bestQuizScore?: number
  timeSpentMinutes: number
  completedAt?: string
  lastAccessedAt?: string
}

export async function getLessonProgress(lessonId: string): Promise<LessonProgress | null> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { lessonId: { eq: lessonId } },
    })
    
    if (progress && progress.length > 0) {
      const p = progress[0]
      return {
        lessonId: p.lessonId,
        trackId: p.trackId,
        moduleId: p.moduleId,
        status: p.status as LessonProgress['status'],
        progressPercent: p.progressPercent || 0,
        quizScore: p.quizScore ?? undefined,
        quizAttempts: p.quizAttempts || 0,
        bestQuizScore: p.bestQuizScore ?? undefined,
        timeSpentMinutes: p.timeSpentMinutes || 0,
        completedAt: p.completedAt ?? undefined,
        lastAccessedAt: p.lastAccessedAt ?? undefined,
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching lesson progress:', error)
    return null
  }
}

export async function getModuleProgress(moduleId: string): Promise<LessonProgress[]> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { moduleId: { eq: moduleId } },
    })
    
    return (progress || []).map(p => ({
      lessonId: p.lessonId,
      trackId: p.trackId,
      moduleId: p.moduleId,
      status: p.status as LessonProgress['status'],
      progressPercent: p.progressPercent || 0,
      quizScore: p.quizScore ?? undefined,
      quizAttempts: p.quizAttempts || 0,
      bestQuizScore: p.bestQuizScore ?? undefined,
      timeSpentMinutes: p.timeSpentMinutes || 0,
      completedAt: p.completedAt ?? undefined,
      lastAccessedAt: p.lastAccessedAt ?? undefined,
    }))
  } catch (error) {
    console.error('Error fetching module progress:', error)
    return []
  }
}

export async function getTrackProgress(trackId: string): Promise<LessonProgress[]> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { trackId: { eq: trackId } },
    })
    
    return (progress || []).map(p => ({
      lessonId: p.lessonId,
      trackId: p.trackId,
      moduleId: p.moduleId,
      status: p.status as LessonProgress['status'],
      progressPercent: p.progressPercent || 0,
      quizScore: p.quizScore ?? undefined,
      quizAttempts: p.quizAttempts || 0,
      bestQuizScore: p.bestQuizScore ?? undefined,
      timeSpentMinutes: p.timeSpentMinutes || 0,
      completedAt: p.completedAt ?? undefined,
      lastAccessedAt: p.lastAccessedAt ?? undefined,
    }))
  } catch (error) {
    console.error('Error fetching track progress:', error)
    return []
  }
}

export async function getAllProgress(): Promise<LessonProgress[]> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({})
    
    return (progress || []).map(p => ({
      lessonId: p.lessonId,
      trackId: p.trackId,
      moduleId: p.moduleId,
      status: p.status as LessonProgress['status'],
      progressPercent: p.progressPercent || 0,
      quizScore: p.quizScore ?? undefined,
      quizAttempts: p.quizAttempts || 0,
      bestQuizScore: p.bestQuizScore ?? undefined,
      timeSpentMinutes: p.timeSpentMinutes || 0,
      completedAt: p.completedAt ?? undefined,
      lastAccessedAt: p.lastAccessedAt ?? undefined,
    }))
  } catch (error) {
    console.error('Error fetching all progress:', error)
    return []
  }
}

export async function startLesson(
  lessonId: string,
  trackId: string,
  moduleId: string
): Promise<void> {
  try {
    const existing = await getLessonProgress(lessonId)
    
    if (!existing) {
      await client.models.LearningProgress.create({
        lessonId,
        trackId,
        moduleId,
        status: 'in_progress',
        progressPercent: 0,
        quizAttempts: 0,
        timeSpentMinutes: 0,
        sessionsCount: 1,
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      })
    } else {
      const { data: progress } = await client.models.LearningProgress.list({
        filter: { lessonId: { eq: lessonId } },
      })
      
      if (progress && progress.length > 0) {
        await client.models.LearningProgress.update({
          id: progress[0].id,
          lastAccessedAt: new Date().toISOString(),
          sessionsCount: (progress[0].sessionsCount || 0) + 1,
        })
      }
    }
  } catch (error) {
    console.error('Error starting lesson:', error)
  }
}

export async function updateLessonProgress(
  lessonId: string,
  data: {
    progressPercent?: number
    timeSpentMinutes?: number
    status?: 'not_started' | 'in_progress' | 'completed'
  }
): Promise<void> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { lessonId: { eq: lessonId } },
    })
    
    if (progress && progress.length > 0) {
      const updateData: Record<string, unknown> = {
        id: progress[0].id,
        lastAccessedAt: new Date().toISOString(),
      }
      
      if (data.progressPercent !== undefined) {
        updateData.progressPercent = data.progressPercent
      }
      if (data.timeSpentMinutes !== undefined) {
        updateData.timeSpentMinutes = (progress[0].timeSpentMinutes || 0) + data.timeSpentMinutes
      }
      if (data.status !== undefined) {
        updateData.status = data.status
        if (data.status === 'completed') {
          updateData.completedAt = new Date().toISOString()
        }
      }
      
      await client.models.LearningProgress.update(updateData as Parameters<typeof client.models.LearningProgress.update>[0])
    }
  } catch (error) {
    console.error('Error updating lesson progress:', error)
  }
}

export async function completeLesson(lessonId: string): Promise<void> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { lessonId: { eq: lessonId } },
    })

    if (progress && progress.length > 0) {
      
      const wasAlreadyCompleted = progress[0].status === 'completed'

      await client.models.LearningProgress.update({
        id: progress[0].id,
        status: 'completed',
        progressPercent: 100,
        completedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      })

      
      if (!wasAlreadyCompleted) {
        await updateUserProfileStats({ lessonsCompleted: 1 })
      }
    }
  } catch (error) {
    console.error('Error completing lesson:', error)
  }
}

export async function submitQuizResult(
  lessonId: string,
  score: number,
  passed: boolean
): Promise<void> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { lessonId: { eq: lessonId } },
    })

    if (progress && progress.length > 0) {
      const current = progress[0]
      const bestScore = Math.max(current.bestQuizScore || 0, score)
      const hadPreviouslyPassed = (current.bestQuizScore || 0) >= 70

      await client.models.LearningProgress.update({
        id: current.id,
        quizScore: score,
        quizAttempts: (current.quizAttempts || 0) + 1,
        bestQuizScore: bestScore,
        lastQuizAt: new Date().toISOString(),
        status: passed ? 'completed' : current.status,
        completedAt: passed ? new Date().toISOString() : current.completedAt,
      })

      
      if (passed && !hadPreviouslyPassed) {
        await updateUserProfileStats({ quizzesPassed: 1 })
      }
    }
  } catch (error) {
    console.error('Error submitting quiz result:', error)
  }
}

export async function submitExerciseResult(
  lessonId: string,
  score: number,
  completed: number,
  total: number
): Promise<void> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { lessonId: { eq: lessonId } },
    })

    if (progress && progress.length > 0) {
      const current = progress[0]
      const bestScore = Math.max(current.bestExerciseScore || 0, score)

      await client.models.LearningProgress.update({
        id: current.id,
        exerciseScore: score,
        exercisesCompleted: completed,
        exercisesTotal: total,
        bestExerciseScore: bestScore,
        lastExerciseAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('Error submitting exercise result:', error)
  }
}

export interface TrackProgressSummary {
  trackId: string
  status: 'not_started' | 'in_progress' | 'completed'
  progressPercent: number
  modulesCompleted: number
  lessonsCompleted: number
  totalTimeMinutes: number
  startedAt?: string
  completedAt?: string
  certificateId?: string
}

export async function getTrackProgressSummary(trackId: string): Promise<TrackProgressSummary | null> {
  try {
    const { data: progress } = await client.models.TrackProgress.list({
      filter: { trackId: { eq: trackId } },
    })
    
    if (progress && progress.length > 0) {
      const p = progress[0]
      return {
        trackId: p.trackId,
        status: p.status as TrackProgressSummary['status'],
        progressPercent: p.progressPercent || 0,
        modulesCompleted: p.modulesCompleted || 0,
        lessonsCompleted: p.lessonsCompleted || 0,
        totalTimeMinutes: p.totalTimeMinutes || 0,
        startedAt: p.startedAt ?? undefined,
        completedAt: p.completedAt ?? undefined,
        certificateId: p.certificateId ?? undefined,
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching track progress summary:', error)
    return null
  }
}

export async function updateTrackProgress(
  trackId: string,
  data: Partial<TrackProgressSummary>
): Promise<void> {
  try {
    const { data: existing } = await client.models.TrackProgress.list({
      filter: { trackId: { eq: trackId } },
    })
    
    if (existing && existing.length > 0) {
      await client.models.TrackProgress.update({
        trackId: existing[0].trackId,
        ...data,
      } as Parameters<typeof client.models.TrackProgress.update>[0])
    } else {
      await client.models.TrackProgress.create({
        trackId,
        status: 'in_progress',
        progressPercent: 0,
        modulesCompleted: 0,
        lessonsCompleted: 0,
        totalTimeMinutes: 0,
        startedAt: new Date().toISOString(),
        ...data,
      })
    }
  } catch (error) {
    console.error('Error updating track progress:', error)
  }
}

export async function bookmarkLesson(lessonId: string): Promise<void> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { lessonId: { eq: lessonId } },
    })
    
    if (progress && progress.length > 0) {
      await client.models.LearningProgress.update({
        id: progress[0].id,
        bookmarkedAt: progress[0].bookmarkedAt ? null : new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('Error bookmarking lesson:', error)
  }
}

export async function saveNotes(lessonId: string, notes: string): Promise<void> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { lessonId: { eq: lessonId } },
    })
    
    if (progress && progress.length > 0) {
      await client.models.LearningProgress.update({
        id: progress[0].id,
        notes,
      })
    }
  } catch (error) {
    console.error('Error saving notes:', error)
  }
}

export async function getCertificate(trackId: string) {
  try {
    const { data: certs } = await client.models.Certificate.list({
      filter: { trackId: { eq: trackId } },
    })
    return certs?.[0] || null
  } catch (error) {
    console.error('Error fetching certificate:', error)
    return null
  }
}

export async function createCertificate(data: {
  trackId: string
  trackName: string
  recipientName: string
}): Promise<string | null> {
  try {
    const credentialId = `QS-${data.trackId.toUpperCase()}-${Date.now()}`
    
    const { data: cert } = await client.models.Certificate.create({
      trackId: data.trackId,
      trackName: data.trackName,
      recipientName: data.recipientName,
      issuedAt: new Date().toISOString(),
      credentialId,
      verificationUrl: `https://quantumshala.com/verify/${credentialId}`,
    })
    
    return (cert as { id?: string } | null)?.id || null
  } catch (error) {
    console.error('Error creating certificate:', error)
    return null
  }
}
