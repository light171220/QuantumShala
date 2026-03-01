export interface LearningTrack {
  id: string
  title: string
  description: string
  icon: string
  color: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'specialized'
  estimatedHours: number
  modulesCount: number
  lessonsCount: number
  prerequisites: string[]
  tags: string[]
  order: number
}

export interface Module {
  id: string
  trackId: string
  title: string
  description: string
  order: number
  lessonsCount: number
  estimatedMinutes: number
  lessons: LessonMeta[]
}

export interface LessonMeta {
  id: string
  moduleId: string
  trackId: string
  title: string
  description: string
  order: number
  estimatedMinutes: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  prerequisites: string[]
  learningObjectives: string[]
  tags: string[]
  hasQuiz: boolean
  hasExercises: boolean
  hasInteractiveDemo: boolean
}

import type { Quiz } from './quiz'

export interface Lesson extends LessonMeta {
  content: string
  quiz?: Quiz
  exercises?: Exercise[]
}

export interface ContentBlock {
  type: 'text' | 'code' | 'math' | 'image' | 'video' | 'interactive' | 'tip' | 'warning' | 'definition' | 'example'
  content: string
  language?: string
  caption?: string
  interactive?: InteractiveConfig
}

export interface InteractiveConfig {
  type: 'circuit' | 'bloch' | 'visualization' | 'code-runner'
  config: Record<string, unknown>
}

export interface Exercise {
  id: string
  type: 'circuit-build' | 'code-write' | 'calculation' | 'analysis'
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  xpReward: number
  hints: string[]
  solution: string
  testCases?: TestCase[]
}

export interface TestCase {
  input: string
  expectedOutput: string
  description: string
}
