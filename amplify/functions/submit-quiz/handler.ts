import type { Handler } from 'aws-lambda'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime'
import { env } from '$amplify/env/submit-quiz'
import type { Schema } from '../../data/resource'

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
Amplify.configure(resourceConfig, libraryOptions)

const client = generateClient<Schema>()

interface QuizAnswer {
  questionId: string
  answer: string | string[]
}

interface QuizSubmission {
  userId: string
  lessonId: string
  trackId: string
  moduleId: string
  answers: QuizAnswer[]
  timeSpentSeconds: number
}

interface QuizResult {
  success: boolean
  score: number
  passed: boolean
  correctAnswers: number
  totalQuestions: number
  xpEarned: number
  streakBonus: number
  firstAttemptBonus: number
  perfectScoreBonus: number
  totalXpEarned: number
  feedback: {
    questionId: string
    correct: boolean
    correctAnswer: string | string[]
  }[]
}

export const handler: Handler<QuizSubmission, QuizResult> = async (event) => {
  const { userId, lessonId, trackId, moduleId, answers, timeSpentSeconds } = event

  try {
    const { data: quizzes } = await client.models.Quiz.list({
      filter: { lessonId: { eq: lessonId } },
    })

    if (!quizzes || quizzes.length === 0) {
      throw new Error('Quiz not found')
    }

    const quiz = quizzes[0]
    const questions = JSON.parse(quiz.questions as string)
    const passingScore = quiz.passingScore || 70

    let correctCount = 0
    const feedback: QuizResult['feedback'] = []

    for (const question of questions) {
      const userAnswer = answers.find((a) => a.questionId === question.id)
      const isCorrect = checkAnswer(question, userAnswer?.answer)

      if (isCorrect) correctCount++

      feedback.push({
        questionId: question.id,
        correct: isCorrect,
        correctAnswer: question.correctAnswer,
      })
    }

    const score = Math.round((correctCount / questions.length) * 100)
    const passed = score >= passingScore

    const { data: existingProgress } = await client.models.LearningProgress.list({
      filter: {
        lessonId: { eq: lessonId },
      },
    })

    const isFirstAttempt = !existingProgress || existingProgress.length === 0 || 
      (existingProgress[0]?.quizAttempts || 0) === 0

    const baseXp = passed ? 50 : 10
    let streakBonus = 0
    let firstAttemptBonus = 0
    let perfectScoreBonus = 0

    if (passed) {
      const { data: userProfiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: userId } },
      })

      if (userProfiles && userProfiles.length > 0) {
        const user = userProfiles[0]
        const streak = user.currentStreak || 0
        if (streak >= 7) streakBonus = Math.floor(baseXp * 0.5)
        else if (streak >= 3) streakBonus = Math.floor(baseXp * 0.25)
      }

      if (isFirstAttempt && passed) firstAttemptBonus = 25
      if (score === 100) perfectScoreBonus = 50
    }

    const totalXpEarned = baseXp + streakBonus + firstAttemptBonus + perfectScoreBonus

    if (existingProgress && existingProgress.length > 0) {
      const progress = existingProgress[0]
      await client.models.LearningProgress.update({
        id: progress.id,
        quizScore: score,
        quizAttempts: (progress.quizAttempts || 0) + 1,
        bestQuizScore: Math.max(progress.bestQuizScore || 0, score),
        lastQuizAt: new Date().toISOString(),
        status: passed ? 'completed' : progress.status,
        completedAt: passed ? new Date().toISOString() : progress.completedAt,
        timeSpentMinutes: (progress.timeSpentMinutes || 0) + Math.ceil(timeSpentSeconds / 60),
      })
    } else {
      await client.models.LearningProgress.create({
        lessonId,
        trackId,
        moduleId,
        status: passed ? 'completed' : 'in_progress',
        progressPercent: passed ? 100 : 50,
        quizScore: score,
        quizAttempts: 1,
        bestQuizScore: score,
        lastQuizAt: new Date().toISOString(),
        timeSpentMinutes: Math.ceil(timeSpentSeconds / 60),
        sessionsCount: 1,
        startedAt: new Date().toISOString(),
        completedAt: passed ? new Date().toISOString() : undefined,
        lastAccessedAt: new Date().toISOString(),
      })
    }

    if (totalXpEarned > 0) {
      await client.models.XPTransaction.create({
        amount: totalXpEarned,
        type: 'quiz',
        source: 'quiz_completion',
        sourceId: lessonId,
        multiplier: 1.0,
        description: `Quiz ${passed ? 'passed' : 'completed'}: ${score}%`,
        timestamp: new Date().toISOString(),
      })
    }

    const totalAttempts = (quiz.totalAttempts || 0) + 1
    const currentAvg = quiz.averageScore || 0
    const newAverage = (currentAvg * (totalAttempts - 1) + score) / totalAttempts

    await client.models.Quiz.update({
      id: quiz.id,
      totalAttempts,
      averageScore: newAverage,
      passRate: passed
        ? ((quiz.passRate || 0) * (totalAttempts - 1) + 100) / totalAttempts
        : ((quiz.passRate || 0) * (totalAttempts - 1)) / totalAttempts,
    })

    return {
      success: true,
      score,
      passed,
      correctAnswers: correctCount,
      totalQuestions: questions.length,
      xpEarned: baseXp,
      streakBonus,
      firstAttemptBonus,
      perfectScoreBonus,
      totalXpEarned,
      feedback,
    }
  } catch (error) {
    console.error('Error submitting quiz:', error)
    return {
      success: false,
      score: 0,
      passed: false,
      correctAnswers: 0,
      totalQuestions: 0,
      xpEarned: 0,
      streakBonus: 0,
      firstAttemptBonus: 0,
      perfectScoreBonus: 0,
      totalXpEarned: 0,
      feedback: [],
    }
  }
}

function checkAnswer(
  question: { type: string; correctAnswer: string | string[] },
  userAnswer: string | string[] | undefined
): boolean {
  if (!userAnswer) return false

  if (question.type === 'multiple_select') {
    const correct = Array.isArray(question.correctAnswer)
      ? question.correctAnswer.sort()
      : [question.correctAnswer].sort()
    const user = Array.isArray(userAnswer) ? userAnswer.sort() : [userAnswer].sort()
    return JSON.stringify(correct) === JSON.stringify(user)
  }

  const correctStr = Array.isArray(question.correctAnswer)
    ? question.correctAnswer[0]
    : question.correctAnswer
  const userStr = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer

  return correctStr.toLowerCase().trim() === userStr.toLowerCase().trim()
}
