import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

export type LearningSection = 'tutorials' | 'guides' | 'challenges' | 'cases' | 'references'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlockedAt?: number
}

export interface ChallengeProgress {
  challengeId: string
  startedAt: number
  completedAt?: number
  stepsCompleted: string[]
  points: number
}

interface PQCLearningState {
  completedTutorials: string[]
  completedGuides: string[]
  completedChallenges: string[]
  challengeProgress: Record<string, ChallengeProgress>
  currentTutorial: string | null
  currentGuide: string | null
  currentChallenge: string | null
  currentSection: number
  totalPoints: number
  achievements: Achievement[]
  activeSection: LearningSection
  visitedContent: string[]
  streakDays: number
  lastVisit: number | null
  usedAlgorithms: string[]
  hasGeneratedKey: boolean
  hasEncapsulated: boolean
  hasSigned: boolean
}

interface PQCLearningActions {
  setActiveSection: (section: LearningSection) => void
  startTutorial: (tutorialId: string) => void
  completeTutorial: (tutorialId: string) => void
  setCurrentSection: (section: number) => void
  startGuide: (guideId: string) => void
  completeGuide: (guideId: string) => void
  startChallenge: (challengeId: string) => void
  completeChallenge: (challengeId: string, points: number) => void
  completeChallengeStep: (challengeId: string, stepId: string) => void
  unlockAchievement: (achievement: Achievement) => void
  markContentVisited: (contentId: string) => void
  updateStreak: () => void
  trackKeyGeneration: (algorithm: string) => void
  trackEncapsulation: () => void
  trackSignature: () => void
  reset: () => void
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-key', title: 'Key Master', description: 'Generate your first key pair', icon: 'key' },
  { id: 'first-encaps', title: 'Encapsulator', description: 'Perform your first encapsulation', icon: 'lock' },
  { id: 'first-sig', title: 'Signer', description: 'Create your first digital signature', icon: 'edit' },
  { id: 'tutorial-complete', title: 'Student', description: 'Complete your first tutorial', icon: 'book' },
  { id: 'five-tutorials', title: 'Scholar', description: 'Complete 5 tutorials', icon: 'graduation-cap' },
  { id: 'challenge-complete', title: 'Challenger', description: 'Complete your first challenge', icon: 'target' },
  { id: 'five-challenges', title: 'Champion', description: 'Complete 5 challenges', icon: 'trophy' },
  { id: 'hundred-points', title: 'Centurion', description: 'Earn 100 points', icon: 'star' },
  { id: 'all-algorithms', title: 'Algorithm Expert', description: 'Use all three algorithm families', icon: 'cpu' },
  { id: 'week-streak', title: 'Dedicated', description: 'Visit for 7 consecutive days', icon: 'flame' }
]

const initialState: PQCLearningState = {
  completedTutorials: [],
  completedGuides: [],
  completedChallenges: [],
  challengeProgress: {},
  currentTutorial: null,
  currentGuide: null,
  currentChallenge: null,
  currentSection: 0,
  totalPoints: 0,
  achievements: [],
  activeSection: 'tutorials',
  visitedContent: [],
  streakDays: 0,
  lastVisit: null,
  usedAlgorithms: [],
  hasGeneratedKey: false,
  hasEncapsulated: false,
  hasSigned: false
}

export const usePQCLearningStore = create<PQCLearningState & PQCLearningActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      setActiveSection: (section) => set((state) => {
        state.activeSection = section
      }),

      startTutorial: (tutorialId) => set((state) => {
        state.currentTutorial = tutorialId
        state.currentSection = 0
        if (!state.visitedContent.includes(tutorialId)) {
          state.visitedContent.push(tutorialId)
        }
      }),

      completeTutorial: (tutorialId) => set((state) => {
        if (!state.completedTutorials.includes(tutorialId)) {
          state.completedTutorials.push(tutorialId)
          state.totalPoints += 20

          if (state.completedTutorials.length === 1) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'tutorial-complete')
            if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
              state.achievements.push({ ...achievement, unlockedAt: Date.now() })
            }
          }

          if (state.completedTutorials.length === 5) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'five-tutorials')
            if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
              state.achievements.push({ ...achievement, unlockedAt: Date.now() })
            }
          }
        }
        state.currentTutorial = null
        state.currentSection = 0
      }),

      setCurrentSection: (section) => set((state) => {
        state.currentSection = section
      }),

      startGuide: (guideId) => set((state) => {
        state.currentGuide = guideId
        if (!state.visitedContent.includes(guideId)) {
          state.visitedContent.push(guideId)
        }
      }),

      completeGuide: (guideId) => set((state) => {
        if (!state.completedGuides.includes(guideId)) {
          state.completedGuides.push(guideId)
          state.totalPoints += 10
        }
        state.currentGuide = null
      }),

      startChallenge: (challengeId) => set((state) => {
        state.currentChallenge = challengeId
        if (!state.challengeProgress[challengeId]) {
          state.challengeProgress[challengeId] = {
            challengeId,
            startedAt: Date.now(),
            stepsCompleted: [],
            points: 0
          }
        }
      }),

      completeChallenge: (challengeId, points) => set((state) => {
        if (!state.completedChallenges.includes(challengeId)) {
          state.completedChallenges.push(challengeId)
          state.totalPoints += points

          if (state.challengeProgress[challengeId]) {
            state.challengeProgress[challengeId].completedAt = Date.now()
            state.challengeProgress[challengeId].points = points
          }

          if (state.completedChallenges.length === 1) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'challenge-complete')
            if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
              state.achievements.push({ ...achievement, unlockedAt: Date.now() })
            }
          }

          if (state.completedChallenges.length === 5) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'five-challenges')
            if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
              state.achievements.push({ ...achievement, unlockedAt: Date.now() })
            }
          }

          if (state.totalPoints >= 100) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'hundred-points')
            if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
              state.achievements.push({ ...achievement, unlockedAt: Date.now() })
            }
          }
        }
        state.currentChallenge = null
      }),

      completeChallengeStep: (challengeId, stepId) => set((state) => {
        if (state.challengeProgress[challengeId]) {
          if (!state.challengeProgress[challengeId].stepsCompleted.includes(stepId)) {
            state.challengeProgress[challengeId].stepsCompleted.push(stepId)
          }
        }
      }),

      unlockAchievement: (achievement) => set((state) => {
        if (!state.achievements.find(a => a.id === achievement.id)) {
          state.achievements.push({ ...achievement, unlockedAt: Date.now() })
        }
      }),

      markContentVisited: (contentId) => set((state) => {
        if (!state.visitedContent.includes(contentId)) {
          state.visitedContent.push(contentId)
        }
      }),

      updateStreak: () => set((state) => {
        const now = Date.now()
        const today = new Date(now).setHours(0, 0, 0, 0)

        if (state.lastVisit) {
          const lastVisitDay = new Date(state.lastVisit).setHours(0, 0, 0, 0)
          const daysDiff = Math.floor((today - lastVisitDay) / (1000 * 60 * 60 * 24))

          if (daysDiff === 1) {
            state.streakDays += 1
          } else if (daysDiff > 1) {
            state.streakDays = 1
          }
        } else {
          state.streakDays = 1
        }

        state.lastVisit = now

        if (state.streakDays >= 7) {
          const achievement = ACHIEVEMENTS.find(a => a.id === 'week-streak')
          if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
            state.achievements.push({ ...achievement, unlockedAt: Date.now() })
          }
        }
      }),

      trackKeyGeneration: (algorithm) => set((state) => {
        if (!state.hasGeneratedKey) {
          state.hasGeneratedKey = true
          const achievement = ACHIEVEMENTS.find(a => a.id === 'first-key')
          if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
            state.achievements.push({ ...achievement, unlockedAt: Date.now() })
          }
        }

        if (!state.usedAlgorithms.includes(algorithm)) {
          state.usedAlgorithms.push(algorithm)

          if (state.usedAlgorithms.length >= 3) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'all-algorithms')
            if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
              state.achievements.push({ ...achievement, unlockedAt: Date.now() })
            }
          }
        }
      }),

      trackEncapsulation: () => set((state) => {
        if (!state.hasEncapsulated) {
          state.hasEncapsulated = true
          const achievement = ACHIEVEMENTS.find(a => a.id === 'first-encaps')
          if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
            state.achievements.push({ ...achievement, unlockedAt: Date.now() })
          }
        }
      }),

      trackSignature: () => set((state) => {
        if (!state.hasSigned) {
          state.hasSigned = true
          const achievement = ACHIEVEMENTS.find(a => a.id === 'first-sig')
          if (achievement && !state.achievements.find(a => a.id === achievement.id)) {
            state.achievements.push({ ...achievement, unlockedAt: Date.now() })
          }
        }
      }),

      reset: () => set(() => initialState)
    })),
    {
      name: 'pqc-learning-storage',
      partialize: (state) => ({
        completedTutorials: state.completedTutorials,
        completedGuides: state.completedGuides,
        completedChallenges: state.completedChallenges,
        challengeProgress: state.challengeProgress,
        totalPoints: state.totalPoints,
        achievements: state.achievements,
        visitedContent: state.visitedContent,
        streakDays: state.streakDays,
        lastVisit: state.lastVisit,
        usedAlgorithms: state.usedAlgorithms,
        hasGeneratedKey: state.hasGeneratedKey,
        hasEncapsulated: state.hasEncapsulated,
        hasSigned: state.hasSigned
      })
    }
  )
)

export const selectProgress = (state: PQCLearningState) => ({
  tutorialsCompleted: state.completedTutorials.length,
  guidesCompleted: state.completedGuides.length,
  challengesCompleted: state.completedChallenges.length,
  totalPoints: state.totalPoints,
  achievementsUnlocked: state.achievements.length,
  streakDays: state.streakDays
})

export const selectChallengeProgress = (state: PQCLearningState, challengeId: string) =>
  state.challengeProgress[challengeId]

export const selectIsTutorialCompleted = (state: PQCLearningState, tutorialId: string) =>
  state.completedTutorials.includes(tutorialId)

export const selectIsChallengeCompleted = (state: PQCLearningState, challengeId: string) =>
  state.completedChallenges.includes(challengeId)

export { ACHIEVEMENTS }
