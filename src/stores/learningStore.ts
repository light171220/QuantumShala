import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import type { LearningTrack, Module, Lesson, LessonMeta } from '@/types/learning'
import type { UserProgress } from '@/types/user'
import * as learningService from '@/services/learning'
import { awardXP, unlockAchievement, updateStreak } from '@/services/gamification'

function getAuthStoreUserId(): string | null {
  try {
    const { useAuthStore } = require('./authStore')
    return useAuthStore?.getState()?.user?.id || null
  } catch {
    return null
  }
}

function syncUserIdToService(): void {
  const userId = getAuthStoreUserId()
  learningService.setCurrentUserId(userId)
}

interface LearningState {
  tracks: LearningTrack[]
  currentTrack: LearningTrack | null
  currentModule: Module | null
  currentLesson: Lesson | null
  progress: Record<string, UserProgress>
  isLoading: boolean
  isSyncing: boolean
  error: string | null
  lastSyncedAt: string | null
}

interface LearningActions {
  setTracks: (tracks: LearningTrack[]) => void
  setCurrentTrack: (track: LearningTrack | null) => void
  setCurrentModule: (module: Module | null) => void
  setCurrentLesson: (lesson: Lesson | null) => void
  setProgress: (progress: Record<string, UserProgress>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  syncProgress: () => Promise<void>
  startLesson: (lessonId: string, trackId: string, moduleId: string) => Promise<void>
  updateLessonProgress: (lessonId: string, updates: Partial<UserProgress>) => Promise<void>
  markLessonComplete: (lessonId: string) => Promise<void>
  submitQuizResult: (lessonId: string, score: number, passed: boolean) => Promise<void>
  submitExerciseResult: (lessonId: string, score: number, completed: number, total: number) => Promise<void>
  bookmarkLesson: (lessonId: string) => Promise<void>
  saveNotes: (lessonId: string, notes: string) => Promise<void>

  getTrackProgress: (trackId: string) => number
  getModuleProgress: (moduleId: string) => number
  getNextLesson: (currentLessonId: string) => LessonMeta | null
  getPrevLesson: (currentLessonId: string) => LessonMeta | null
  isLessonCompleted: (lessonId: string) => boolean
  getLessonProgress: (lessonId: string) => UserProgress | null
}

const initialState: LearningState = {
  tracks: [],
  currentTrack: null,
  currentModule: null,
  currentLesson: null,
  progress: {},
  isLoading: false,
  isSyncing: false,
  error: null,
  lastSyncedAt: null,
}

export const useLearningStore = create<LearningState & LearningActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      setTracks: (tracks) =>
        set((state) => {
          state.tracks = tracks
        }),

      setCurrentTrack: (track) =>
        set((state) => {
          state.currentTrack = track
        }),

      setCurrentModule: (module) =>
        set((state) => {
          state.currentModule = module
        }),

      setCurrentLesson: (lesson) =>
        set((state) => {
          state.currentLesson = lesson
        }),

      setProgress: (progress) =>
        set((state) => {
          state.progress = progress
        }),

      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading
        }),

      setError: (error) =>
        set((state) => {
          state.error = error
          state.isLoading = false
        }),

      syncProgress: async () => {
        set((state) => {
          state.isSyncing = true
        })

        try {
          const allProgress = await learningService.getAllProgress()
          const progressMap: Record<string, UserProgress> = {}

          for (const p of allProgress) {
            progressMap[p.lessonId] = {
              lessonId: p.lessonId,
              trackId: p.trackId,
              moduleId: p.moduleId,
              status: p.status,
              quizScore: p.quizScore,
              quizAttempts: p.quizAttempts,
              bestQuizScore: p.bestQuizScore,
              timeSpentMinutes: p.timeSpentMinutes,
              completedAt: p.completedAt,
              lastAccessedAt: p.lastAccessedAt,
            }
          }

          set((state) => {
            state.progress = progressMap
            state.isSyncing = false
            state.lastSyncedAt = new Date().toISOString()
          })
        } catch (error) {
          console.error('Failed to sync progress:', error)
          set((state) => {
            state.isSyncing = false
          })
        }
      },

      startLesson: async (lessonId, trackId, moduleId) => {
        set((state) => {
          if (!state.progress[lessonId]) {
            state.progress[lessonId] = {
              lessonId,
              trackId,
              moduleId,
              status: 'in_progress',
              quizAttempts: 0,
              timeSpentMinutes: 0,
              lastAccessedAt: new Date().toISOString(),
            }
          } else {
            state.progress[lessonId].lastAccessedAt = new Date().toISOString()
          }
        })

        try {
          await learningService.startLesson(lessonId, trackId, moduleId)

          syncUserIdToService()
          const userId = getAuthStoreUserId()
          if (userId) {
            await updateStreak(userId)
          }
        } catch (error) {
          console.error('Failed to start lesson:', error)
        }
      },

      updateLessonProgress: async (lessonId, updates) => {
        set((state) => {
          if (!state.progress[lessonId]) {
            state.progress[lessonId] = {
              lessonId,
              trackId: updates.trackId || '',
              moduleId: updates.moduleId || '',
              status: updates.status || 'in_progress',
              quizAttempts: 0,
              timeSpentMinutes: 0,
              lastAccessedAt: new Date().toISOString(),
            }
          }
          Object.assign(state.progress[lessonId], updates)
          state.progress[lessonId].lastAccessedAt = new Date().toISOString()
        })

        try {
          await learningService.updateLessonProgress(lessonId, {
            progressPercent: updates.progressPercent,
            timeSpentMinutes: updates.timeSpentMinutes,
            status: updates.status,
          })
        } catch (error) {
          console.error('Failed to update lesson progress:', error)
        }
      },

      markLessonComplete: async (lessonId) => {
        const state = get()
        const progress = state.progress[lessonId]

        set((s) => {
          if (!s.progress[lessonId]) {
            s.progress[lessonId] = {
              lessonId,
              trackId: '',
              moduleId: '',
              status: 'completed',
              quizAttempts: 0,
              timeSpentMinutes: 0,
              completedAt: new Date().toISOString(),
              lastAccessedAt: new Date().toISOString(),
            }
          } else {
            s.progress[lessonId].status = 'completed'
            s.progress[lessonId].completedAt = new Date().toISOString()
          }
        })

        try {
          await learningService.completeLesson(lessonId)

          syncUserIdToService()
          const userId = getAuthStoreUserId()
          if (userId) {
            await awardXP(userId, 25, 'lesson', lessonId, undefined, 'Lesson completed')

            const completedCount = Object.values(get().progress).filter(p => p.status === 'completed').length
            if (completedCount === 1) {
              await unlockAchievement(userId, 'first_lesson')
            }
          }
        } catch (error) {
          console.error('Failed to mark lesson complete:', error)
        }
      },

      submitQuizResult: async (lessonId, score, passed) => {
        set((state) => {
          if (!state.progress[lessonId]) {
            state.progress[lessonId] = {
              lessonId,
              trackId: '',
              moduleId: '',
              status: passed ? 'completed' : 'in_progress',
              quizScore: score,
              quizAttempts: 1,
              bestQuizScore: score,
              timeSpentMinutes: 0,
              completedAt: passed ? new Date().toISOString() : undefined,
              lastAccessedAt: new Date().toISOString(),
            }
          } else {
            state.progress[lessonId].quizScore = score
            state.progress[lessonId].quizAttempts = (state.progress[lessonId].quizAttempts || 0) + 1
            if (!state.progress[lessonId].bestQuizScore || score > state.progress[lessonId].bestQuizScore) {
              state.progress[lessonId].bestQuizScore = score
            }
            if (passed) {
              state.progress[lessonId].status = 'completed'
              state.progress[lessonId].completedAt = new Date().toISOString()
            }
          }
        })

        try {
          await learningService.submitQuizResult(lessonId, score, passed)

          syncUserIdToService()
          const userId = getAuthStoreUserId()
          if (userId && passed) {
            await awardXP(userId, 50, 'quiz', lessonId, undefined, 'Quiz passed')

            const quizzesPassed = Object.values(get().progress).filter(
              p => p.status === 'completed' && p.quizScore !== undefined && p.quizScore >= 70
            ).length
            if (quizzesPassed === 1) {
              await unlockAchievement(userId, 'first_quiz')
            }

            if (score === 100) {
              await unlockAchievement(userId, 'perfect_quiz')
            }
          }
        } catch (error) {
          console.error('Failed to submit quiz result:', error)
        }
      },

      submitExerciseResult: async (lessonId, score, completed, total) => {
        set((state) => {
          if (!state.progress[lessonId]) {
            state.progress[lessonId] = {
              lessonId,
              trackId: '',
              moduleId: '',
              status: score === 100 ? 'completed' : 'in_progress',
              exerciseScore: score,
              exercisesCompleted: completed,
              exercisesTotal: total,
              timeSpentMinutes: 0,
              quizAttempts: 0,
              lastAccessedAt: new Date().toISOString(),
            }
          } else {
            state.progress[lessonId].exerciseScore = score
            state.progress[lessonId].exercisesCompleted = completed
            state.progress[lessonId].exercisesTotal = total
            if (!state.progress[lessonId].bestExerciseScore || score > state.progress[lessonId].bestExerciseScore) {
              state.progress[lessonId].bestExerciseScore = score
            }
          }
        })

        try {
          await learningService.submitExerciseResult(lessonId, score, completed, total)

          syncUserIdToService()
          const userId = getAuthStoreUserId()
          if (userId && score === 100) {
            await awardXP(userId, 75, 'exercise_complete', lessonId, undefined, 'All exercises completed')
          } else if (userId && completed > 0) {
            await awardXP(userId, completed * 10, 'exercise_complete', lessonId, undefined, `${completed} exercises completed`)
          }
        } catch (error) {
          console.error('Failed to submit exercise result:', error)
        }
      },

      bookmarkLesson: async (lessonId) => {
        set((state) => {
          if (state.progress[lessonId]) {
            const isBookmarked = !!state.progress[lessonId].bookmarkedAt
            state.progress[lessonId].bookmarkedAt = isBookmarked ? undefined : new Date().toISOString()
          }
        })

        try {
          await learningService.bookmarkLesson(lessonId)
        } catch (error) {
          console.error('Failed to bookmark lesson:', error)
        }
      },

      saveNotes: async (lessonId, notes) => {
        set((state) => {
          if (state.progress[lessonId]) {
            state.progress[lessonId].notes = notes
          }
        })

        try {
          await learningService.saveNotes(lessonId, notes)
        } catch (error) {
          console.error('Failed to save notes:', error)
        }
      },

      getTrackProgress: (trackId) => {
        const state = get()
        const track = state.tracks.find((t) => t.id === trackId)
        if (!track || !track.lessonsCount) return 0

        const completedLessons = Object.values(state.progress).filter(
          (p) => p.trackId === trackId && p.status === 'completed'
        ).length

        return Math.round((completedLessons / track.lessonsCount) * 100)
      },

      getModuleProgress: (moduleId) => {
        const state = get()
        const module = state.currentModule
        if (!module || module.id !== moduleId) return 0

        const completedLessons = Object.values(state.progress).filter(
          (p) => p.moduleId === moduleId && p.status === 'completed'
        ).length

        return Math.round((completedLessons / module.lessonsCount) * 100)
      },

      getNextLesson: (currentLessonId) => {
        const state = get()
        if (!state.currentModule) return null

        const lessons = state.currentModule.lessons
        const currentIndex = lessons.findIndex((l) => l.id === currentLessonId)

        if (currentIndex === -1 || currentIndex >= lessons.length - 1) {
          return null
        }

        return lessons[currentIndex + 1]
      },

      getPrevLesson: (currentLessonId) => {
        const state = get()
        if (!state.currentModule) return null

        const lessons = state.currentModule.lessons
        const currentIndex = lessons.findIndex((l) => l.id === currentLessonId)

        if (currentIndex <= 0) {
          return null
        }

        return lessons[currentIndex - 1]
      },

      isLessonCompleted: (lessonId) => {
        const state = get()
        return state.progress[lessonId]?.status === 'completed'
      },

      getLessonProgress: (lessonId) => {
        const state = get()
        return state.progress[lessonId] || null
      },
    })),
    {
      name: 'quantumshala-learning',
      partialize: (state) => ({
        progress: state.progress,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
)
