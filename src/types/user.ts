export interface User {
  id: string
  email: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  level: number
  xp: number
  totalXp: number
  currentStreak: number
  longestStreak: number
  lastActiveAt: string
  createdAt: string
  preferences: UserPreferences
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  dailyGoalMinutes: number
  preferredTrack?: string
  notifications: NotificationPreferences
  codeEditor: CodeEditorPreferences
}

export interface NotificationPreferences {
  email: boolean
  push: boolean
  streakReminder: boolean
  weeklyDigest: boolean
  achievements: boolean
}

export interface CodeEditorPreferences {
  theme: string
  fontSize: number
  tabSize: number
  wordWrap: boolean
  minimap: boolean
}

export interface UserStats {
  lessonsCompleted: number
  quizzesPassed: number
  quizzesFailed: number
  averageQuizScore: number
  totalTimeMinutes: number
  circuitsCreated: number
  simulationsRun: number
  achievementsUnlocked: number
}

export interface UserProgress {
  lessonId: string
  trackId: string
  moduleId: string
  status: 'not_started' | 'in_progress' | 'completed'
  progressPercent?: number
  quizScore?: number
  quizAttempts: number
  bestQuizScore?: number
  exerciseScore?: number
  exercisesCompleted?: number
  exercisesTotal?: number
  bestExerciseScore?: number
  timeSpentMinutes: number
  completedAt?: string
  lastAccessedAt?: string
  bookmarkedAt?: string
  notes?: string
}

export interface Session {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: User
}
