export interface Quiz {
  id: string
  lessonId: string
  title: string
  description: string
  timeLimit?: number
  passingScore: number
  totalPoints: number
  questions: Question[]
}

export type QuestionType = 
  | 'multiple-choice'
  | 'multiple-select'
  | 'true-false'
  | 'circuit-build'
  | 'code-completion'
  | 'calculation'
  | 'matching'
  | 'ordering'

export interface Question {
  id: string
  type: QuestionType
  points: number
  question: string
  explanation: string
  hint?: string
  options?: QuestionOption[]
  correctAnswer: string | string[] | number
  codeTemplate?: string
  circuitConfig?: CircuitQuestionConfig
  matchingPairs?: MatchingPair[]
  orderingItems?: string[]
  tolerance?: number
}

export interface QuestionOption {
  id: string
  text: string
  isCorrect?: boolean
}

export interface CircuitQuestionConfig {
  numQubits: number
  targetGates: string[]
  expectedOutput: number[]
  initialState?: number[]
}

export interface MatchingPair {
  left: string
  right: string
}

export interface QuizAttempt {
  id: string
  quizId: string
  lessonId: string
  userId: string
  startedAt: string
  completedAt?: string
  answers: QuizAnswer[]
  score: number
  totalPoints: number
  passed: boolean
  timeSpentSeconds: number
}

export interface QuizAnswer {
  questionId: string
  answer: string | string[] | number
  isCorrect: boolean
  pointsEarned: number
  timeSpentSeconds: number
}

export interface QuizResult {
  attempt: QuizAttempt
  xpEarned: number
  newAchievements: string[]
  nextLesson?: string
}
