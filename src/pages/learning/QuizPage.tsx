import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  Trophy,
  RotateCcw,
  Lightbulb,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { getLessonQuiz, type Quiz, type QuizQuestion } from '@/services/content'
import { useLearningStore } from '@/stores/learningStore'

export default function QuizPage() {
  const { trackId, moduleId, lessonId } = useParams()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isComplete, setIsComplete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { submitQuizResult, getLessonProgress } = useLearningStore()
  const lessonProgress = lessonId ? getLessonProgress(lessonId) : null

  useEffect(() => {
    async function loadQuiz() {
      if (!trackId || !moduleId || !lessonId) return

      setIsLoading(true)
      setError(null)

      try {
        const quizData = await getLessonQuiz(trackId, moduleId, lessonId)

        if (!quizData) {
          setError('Quiz not found for this lesson')
        } else {
          setQuiz(quizData)
          setAnswers({})
        }
      } catch (err) {
        console.error('Failed to load quiz:', err)
        setError('Failed to load quiz')
      } finally {
        setIsLoading(false)
      }
    }

    loadQuiz()
  }, [trackId, moduleId, lessonId])

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || 'Quiz not available'}</p>
          <Button variant="neumorph" onClick={() => navigate(`/learn/${trackId}/${moduleId}/${lessonId}`)}>
            Back to Lesson
          </Button>
        </div>
      </div>
    )
  }

  const questions = quiz.questions
  const question = questions[currentQuestion]
  const progress = ((currentQuestion + 1) / questions.length) * 100

  const getCorrectAnswer = (q: QuizQuestion): string => {
    if (Array.isArray(q.correctAnswer)) {
      return q.correctAnswer[0]
    }
    return q.correctAnswer
  }

  const isCorrect = selectedAnswer === getCorrectAnswer(question)

  const handleSelectAnswer = (optionId: string) => {
    if (showExplanation) return
    setSelectedAnswer(optionId)
  }

  const handleCheckAnswer = () => {
    setShowExplanation(true)
    setAnswers(prev => ({
      ...prev,
      [question.id]: selectedAnswer || ''
    }))
  }

  const handleNext = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowExplanation(false)
    } else {
      setIsSubmitting(true)

      const correctCount = Object.entries(answers).filter(([qId, answer]) => {
        const q = questions.find(q => q.id === qId)
        if (!q) return false
        return answer === getCorrectAnswer(q)
      }).length + (isCorrect ? 1 : 0)

      const score = Math.round((correctCount / questions.length) * 100)
      const passed = score >= (quiz.passingScore || 70)

      if (lessonId) {
        await submitQuizResult(lessonId, score, passed)
      }

      setIsSubmitting(false)
      setIsComplete(true)
    }
  }

  const handleRetry = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowExplanation(false)
    setAnswers({})
    setIsComplete(false)
  }

  const correctCount = Object.entries(answers).filter(([qId, answer]) => {
    const q = questions.find(q => q.id === qId)
    if (!q) return false
    return answer === getCorrectAnswer(q)
  }).length
  const score = Math.round((correctCount / questions.length) * 100)
  const passed = score >= (quiz.passingScore || 70)

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card variant="neumorph" className="text-center py-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${
                passed ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}
            >
              {passed ? (
                <Trophy className="w-12 h-12 text-green-400" />
              ) : (
                <XCircle className="w-12 h-12 text-red-400" />
              )}
            </motion.div>

            <h2 className="text-2xl font-bold text-white mb-2">
              {passed ? 'Congratulations!' : 'Keep Learning!'}
            </h2>
            <p className="text-slate-400 mb-6">
              {passed
                ? 'You\'ve passed the quiz and earned XP!'
                : `You need ${quiz.passingScore || 70}% to pass. Review and try again.`}
            </p>

            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">{score}%</div>
                <div className="text-sm text-slate-400">Score</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white">{correctCount}/{questions.length}</div>
                <div className="text-sm text-slate-400">Correct</div>
              </div>
              {passed && (
                <div className="text-center">
                  <div className="text-4xl font-bold text-quantum-400">+50</div>
                  <div className="text-sm text-slate-400">XP Earned</div>
                </div>
              )}
            </div>

            {lessonProgress?.bestQuizScore !== undefined && lessonProgress.bestQuizScore > score && (
              <p className="text-sm text-slate-400 mb-4">
                Your best score: {lessonProgress.bestQuizScore}%
              </p>
            )}

            <div className="flex items-center justify-center gap-4">
              <Button variant="neumorph" onClick={handleRetry} leftIcon={<RotateCcw className="w-4 h-4" />}>
                {passed ? 'Try Again' : 'Retry Quiz'}
              </Button>
              <Button variant="neumorph-primary" onClick={() => navigate(`/learn/${trackId}/${moduleId}`)}>
                {passed ? 'Continue Learning' : 'Review Lesson'}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-2">{quiz.title}</h1>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">
            Question {currentQuestion + 1} of {questions.length}
          </span>
          <span className="text-sm text-slate-400">
            {Math.round(progress)}% complete
          </span>
        </div>
        <Progress value={progress} />
      </div>

      <Card variant="neumorph">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 text-xs bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded text-slate-400">
                {question.points} {question.points === 1 ? 'point' : 'points'}
              </span>
              <span className="px-2 py-1 text-xs bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded text-slate-400 capitalize">
                {question.type.replace('-', ' ')}
              </span>
            </div>

            <h2 className="text-xl font-semibold text-white mb-6">
              {question.question}
            </h2>

            <div className="space-y-3 mb-6">
              {question.options.map((option, index) => {
                const isSelected = selectedAnswer === option.id
                const isCorrectAnswer = option.id === getCorrectAnswer(question)
                const showResult = showExplanation

                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectAnswer(option.id)}
                    disabled={showExplanation}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      showResult
                        ? isCorrectAnswer
                          ? 'bg-green-500/20 border-green-500 text-white'
                          : isSelected
                          ? 'bg-red-500/20 border-red-500 text-white'
                          : 'bg-slate-800/50 border-white/10 text-slate-400'
                        : isSelected
                        ? 'bg-quantum-500/20 border-quantum-500 text-white'
                        : 'bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-800 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                          showResult
                            ? isCorrectAnswer
                              ? 'bg-green-500 text-white'
                              : isSelected
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-700 text-slate-400'
                            : isSelected
                            ? 'bg-quantum-500 text-white'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {showResult ? (
                          isCorrectAnswer ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : isSelected ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            String.fromCharCode(65 + index)
                          )
                        ) : (
                          String.fromCharCode(65 + index)
                        )}
                      </div>
                      <span>{option.text}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {showExplanation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg mb-6 ${
                  isCorrect ? 'bg-green-500/10 border border-green-500/30' : 'bg-blue-500/10 border border-blue-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Lightbulb className={`w-5 h-5 mt-0.5 ${isCorrect ? 'text-green-400' : 'text-blue-400'}`} />
                  <div>
                    <p className="font-medium text-white mb-1">
                      {isCorrect ? 'Correct!' : 'Explanation'}
                    </p>
                    <p className="text-sm text-slate-300">{question.explanation}</p>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex items-center justify-end gap-3">
              {!showExplanation ? (
                <Button
                  variant="neumorph-primary"
                  onClick={handleCheckAnswer}
                  disabled={selectedAnswer === null}
                >
                  Check Answer
                </Button>
              ) : (
                <Button
                  variant="neumorph-primary"
                  onClick={handleNext}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : currentQuestion < questions.length - 1 ? (
                    'Next Question'
                  ) : (
                    'See Results'
                  )}
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  )
}
