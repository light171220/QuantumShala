export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category?: AchievementCategory
  xpReward: number
  rarity: AchievementRarity
  requirement: AchievementRequirement
  unlockedAt?: string
  progress?: number
  isSecret?: boolean
}

export type AchievementCategory = 
  | 'learning'
  | 'simulation'
  | 'streak'
  | 'social'
  | 'hub'
  | 'mastery'
  | 'secret'

export type AchievementRarity = 
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'

export interface AchievementRequirement {
  type: AchievementRequirementType
  value: number
  trackId?: string
  gateType?: string
}

export type AchievementRequirementType = 
  | 'lessons_completed'
  | 'quizzes_passed'
  | 'perfect_quizzes'
  | 'track_completed'
  | 'simulations_run'
  | 'circuits_created'
  | 'streak_days'
  | 'total_xp'
  | 'level_reached'
  | 'gate_used'
  | 'hub_projects'
  | 'social_shares'
  | 'comments_posted'
  | 'likes_received'
  | 'custom'

export interface Level {
  level: number
  title: string
  minXp: number
  maxXp: number
  color: string
  perks: string[]
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  displayName: string
  avatar?: string
  level: number
  xp: number
  streak: number
  achievementCount?: number
  lessonsCompleted?: number
  rankChange?: number
  change?: number
}

export type LeaderboardType = 
  | 'all-time'
  | 'weekly'
  | 'monthly'
  | 'track'
  | 'friends'

export interface DailyGoal {
  id: string
  type: DailyGoalType
  title: string
  description: string
  target: number
  current: number
  completed: boolean
  xpReward: number
}

export type DailyGoalType = 
  | 'login'
  | 'lesson'
  | 'lesson_complete'
  | 'quiz'
  | 'quiz_pass'
  | 'circuit'
  | 'simulation_run'
  | 'streak'
  | 'time_spent'
  | 'streak_maintain'

export interface DailyProgress {
  date: string
  goals: DailyGoal[]
  allCompleted: boolean
  bonusXpEarned: number
}

export interface XPTransaction {
  id: string
  userId?: string
  amount: number
  type: XPTransactionType
  source?: string
  sourceId?: string
  description?: string
  timestamp: string
}

export type XPTransactionType = 
  | 'lesson'
  | 'lesson_complete'
  | 'quiz'
  | 'quiz_pass'
  | 'quiz_perfect'
  | 'achievement'
  | 'circuit'
  | 'streak'
  | 'streak_bonus'
  | 'daily_bonus'
  | 'daily_goal'
  | 'daily_all_complete'
  | 'referral'
  | 'admin'
  | 'exercise_complete'
  | 'circuit_shared'
  | 'circuit_liked'

export interface Streak {
  current: number
  longest: number
  lastActiveDate: string
  freezesRemaining: number
  history: StreakDay[]
}

export interface StreakDay {
  date: string
  active: boolean
  xpEarned: number
}
