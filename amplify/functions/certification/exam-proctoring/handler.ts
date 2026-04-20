import type { Handler } from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'

interface Question {
  id: string
  type: 'multiple_choice' | 'multiple_select' | 'true_false' | 'code' | 'circuit'
  question: string
  options?: string[]
  correctAnswer: string | string[]
  points: number
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string
  explanation?: string
}

interface ExamSession {
  sessionId: string
  examId: string
  userId: string
  startedAt: string
  expiresAt: string
  questions: Question[]
  timeRemainingSeconds: number
  status: 'active' | 'submitted' | 'expired' | 'cancelled'
}

interface Answer {
  questionId: string
  answer: string | string[]
  timeSpentSeconds: number
}

interface ExamResult {
  attemptId: string
  examId: string
  userId: string
  score: number
  maxScore: number
  percentageScore: number
  passed: boolean
  passingScore: number
  startedAt: string
  completedAt: string
  timeSpentSeconds: number
  breakdown: {
    questionId: string
    correct: boolean
    pointsEarned: number
    pointsPossible: number
    topic: string
    difficulty: string
  }[]
  topicScores: Record<string, { earned: number; possible: number; percentage: number }>
  certificationId?: string
}

interface StartExamInput {
  examId: string
  userId: string
  examData: {
    title: string
    duration: number
    passingScore: number
    questions: Question[]
    certificationTier: string
  }
}

interface SubmitExamInput {
  sessionId: string
  userId: string
  answers: Answer[]
  examData: {
    passingScore: number
    certificationTier: string
    trackId: string
  }
}

interface ExamProctorRequest {
  action: 'start_exam' | 'submit_exam' | 'get_session' | 'cancel_session'
  startExamInput?: StartExamInput
  submitExamInput?: SubmitExamInput
  sessionId?: string
  userId?: string
}

interface ExamProctorResponse {
  success: boolean
  session?: ExamSession
  result?: ExamResult
  error?: {
    code: string
    message: string
  }
}

const activeSessions = new Map<string, ExamSession>()

function shuffleArray<T>(array: T[], seed?: number): T[] {
  const shuffled = [...array]
  let currentSeed = seed || Date.now()

  const random = () => {
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff
    return currentSeed / 0x7fffffff
  }

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

function prepareQuestionsForExam(questions: Question[], seed?: number): Question[] {
  const shuffledQuestions = shuffleArray(questions, seed)

  return shuffledQuestions.map(q => {
    const preparedQuestion: Question = {
      ...q,
      correctAnswer: Array.isArray(q.correctAnswer) ? [] : '',
      explanation: undefined,
    }

    if (q.options && q.type === 'multiple_choice') {
      preparedQuestion.options = shuffleArray(q.options, seed)
    }

    return preparedQuestion
  })
}

function startExamSession(input: StartExamInput): ExamSession {
  const { examId, userId, examData } = input

  const sessionId = uuidv4()
  const startedAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + examData.duration * 60 * 1000).toISOString()

  const preparedQuestions = prepareQuestionsForExam(examData.questions, Date.now())

  const session: ExamSession = {
    sessionId,
    examId,
    userId,
    startedAt,
    expiresAt,
    questions: preparedQuestions,
    timeRemainingSeconds: examData.duration * 60,
    status: 'active',
  }

  activeSessions.set(sessionId, session)

  console.log(`[EXAM-PROCTOR] Started exam session ${sessionId} for user ${userId}`)
  console.log(`[EXAM-PROCTOR] Exam: ${examData.title}, Duration: ${examData.duration} minutes`)
  console.log(`[EXAM-PROCTOR] Questions: ${preparedQuestions.length}, Passing score: ${examData.passingScore}%`)

  return session
}

function gradeAnswer(question: Question, answer: Answer): { correct: boolean; points: number } {
  const userAnswer = answer.answer
  const correctAnswer = question.correctAnswer

  if (question.type === 'multiple_select') {
    if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) {
      return { correct: false, points: 0 }
    }

    const sortedUser = [...userAnswer].sort()
    const sortedCorrect = [...correctAnswer].sort()

    const correct = sortedUser.length === sortedCorrect.length &&
      sortedUser.every((val, idx) => val === sortedCorrect[idx])

    return { correct, points: correct ? question.points : 0 }
  }

  if (question.type === 'code' || question.type === 'circuit') {
    const normalizedUser = String(userAnswer).trim().toLowerCase().replace(/\s+/g, ' ')
    const normalizedCorrect = String(correctAnswer).trim().toLowerCase().replace(/\s+/g, ' ')

    const correct = normalizedUser === normalizedCorrect
    return { correct, points: correct ? question.points : 0 }
  }

  const correct = String(userAnswer).toLowerCase() === String(correctAnswer).toLowerCase()
  return { correct, points: correct ? question.points : 0 }
}

function submitExam(input: SubmitExamInput, originalQuestions: Question[]): ExamResult {
  const { sessionId, userId, answers, examData } = input

  const session = activeSessions.get(sessionId)

  if (!session) {
    throw new Error('Session not found or expired')
  }

  if (session.userId !== userId) {
    throw new Error('User ID does not match session')
  }

  if (session.status !== 'active') {
    throw new Error(`Session is ${session.status}, cannot submit`)
  }

  const now = new Date()
  const expiresAt = new Date(session.expiresAt)

  if (now > expiresAt) {
    session.status = 'expired'
    throw new Error('Exam session has expired')
  }

  const completedAt = now.toISOString()
  const startedAtDate = new Date(session.startedAt)
  const timeSpentSeconds = Math.floor((now.getTime() - startedAtDate.getTime()) / 1000)

  const answerMap = new Map(answers.map(a => [a.questionId, a]))

  let totalScore = 0
  let maxScore = 0
  const breakdown: ExamResult['breakdown'] = []
  const topicScores: Record<string, { earned: number; possible: number; percentage: number }> = {}

  for (const question of originalQuestions) {
    const answer = answerMap.get(question.id)
    const gradeResult = answer
      ? gradeAnswer(question, answer)
      : { correct: false, points: 0 }

    totalScore += gradeResult.points
    maxScore += question.points

    breakdown.push({
      questionId: question.id,
      correct: gradeResult.correct,
      pointsEarned: gradeResult.points,
      pointsPossible: question.points,
      topic: question.topic,
      difficulty: question.difficulty,
    })

    if (!topicScores[question.topic]) {
      topicScores[question.topic] = { earned: 0, possible: 0, percentage: 0 }
    }
    topicScores[question.topic].earned += gradeResult.points
    topicScores[question.topic].possible += question.points
  }

  for (const topic of Object.keys(topicScores)) {
    topicScores[topic].percentage = Math.round(
      (topicScores[topic].earned / topicScores[topic].possible) * 100
    )
  }

  const percentageScore = Math.round((totalScore / maxScore) * 100)
  const passed = percentageScore >= examData.passingScore

  const attemptId = uuidv4()

  const result: ExamResult = {
    attemptId,
    examId: session.examId,
    userId,
    score: totalScore,
    maxScore,
    percentageScore,
    passed,
    passingScore: examData.passingScore,
    startedAt: session.startedAt,
    completedAt,
    timeSpentSeconds,
    breakdown,
    topicScores,
  }

  if (passed) {
    result.certificationId = uuidv4()
  }

  session.status = 'submitted'
  activeSessions.delete(sessionId)

  console.log(`[EXAM-PROCTOR] Exam submitted for session ${sessionId}`)
  console.log(`[EXAM-PROCTOR] Score: ${totalScore}/${maxScore} (${percentageScore}%)`)
  console.log(`[EXAM-PROCTOR] Passed: ${passed}, Time spent: ${timeSpentSeconds}s`)

  return result
}

export const handler: Handler = async (event): Promise<ExamProctorResponse> => {
  console.log('[EXAM-PROCTOR] Received request')

  try {
    let input: ExamProctorRequest

    if (typeof event === 'string') {
      input = JSON.parse(event)
    } else if (event.arguments) {
      input = event.arguments
    } else if (event.body) {
      input = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    } else {
      input = event
    }

    const { action } = input

    console.log(`[EXAM-PROCTOR] Action: ${action}`)

    switch (action) {
      case 'start_exam': {
        if (!input.startExamInput) {
          return {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'startExamInput is required' },
          }
        }

        const session = startExamSession(input.startExamInput)

        return {
          success: true,
          session,
        }
      }

      case 'submit_exam': {
        if (!input.submitExamInput) {
          return {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'submitExamInput is required' },
          }
        }

        const originalQuestions = input.submitExamInput.examData &&
          'questions' in input.submitExamInput.examData
          ? (input.submitExamInput.examData as any).questions
          : []

        const result = submitExam(input.submitExamInput, originalQuestions)

        return {
          success: true,
          result,
        }
      }

      case 'get_session': {
        if (!input.sessionId) {
          return {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'sessionId is required' },
          }
        }

        const session = activeSessions.get(input.sessionId)

        if (!session) {
          return {
            success: false,
            error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
          }
        }

        if (input.userId && session.userId !== input.userId) {
          return {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'User not authorized for this session' },
          }
        }

        const now = new Date()
        const expiresAt = new Date(session.expiresAt)
        session.timeRemainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))

        if (session.timeRemainingSeconds <= 0) {
          session.status = 'expired'
        }

        return {
          success: true,
          session,
        }
      }

      case 'cancel_session': {
        if (!input.sessionId) {
          return {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'sessionId is required' },
          }
        }

        const session = activeSessions.get(input.sessionId)

        if (session) {
          if (input.userId && session.userId !== input.userId) {
            return {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'User not authorized for this session' },
            }
          }

          session.status = 'cancelled'
          activeSessions.delete(input.sessionId)
        }

        return {
          success: true,
        }
      }

      default:
        return {
          success: false,
          error: { code: 'INVALID_ACTION', message: `Unknown action: ${action}` },
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[EXAM-PROCTOR] Error:', message)

    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    }
  }
}
