import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle,
  PlayCircle,
  MessageCircle,
  ThumbsUp,
  Share2,
  Bookmark,
  BookmarkCheck,
  Menu,
  X,
  Loader2,
  AlertCircle,
  Code,
  Star,
  Copy,
  Check,
  Twitter,
  Linkedin,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { MDXRenderer } from '@/components/mdx/MDXRenderer'
import { getFullLesson, type LessonMeta } from '@/services/content'
import { useLearningStore } from '@/stores/learningStore'
import AITutorChat from '@/components/ai/AITutorChat'

export default function LessonPage() {
  const { trackId, moduleId, lessonId } = useParams()
  const navigate = useNavigate()
  const [readingProgress, setReadingProgress] = useState(0)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showAITutor, setShowAITutor] = useState(false)
  const [lessonContent, setLessonContent] = useState<string | null>(null)
  const [lessonMeta, setLessonMeta] = useState<LessonMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showShareModal, setShowShareModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [hasRated, setHasRated] = useState(false)
  const [copied, setCopied] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)

  const {
    startLesson,
    markLessonComplete,
    getLessonProgress,
    updateLessonProgress,
    bookmarkLesson
  } = useLearningStore()

  const lessonProgress = lessonId ? getLessonProgress(lessonId) : null
  const isCompleted = lessonProgress?.status === 'completed'
  const isBookmarked = !!lessonProgress?.bookmarkedAt
  const quizScore = lessonProgress?.bestQuizScore
  const hasQuizAttempt = (lessonProgress?.quizAttempts || 0) > 0
  const exerciseScore = lessonProgress?.bestExerciseScore
  const hasExerciseAttempt = (lessonProgress?.exercisesCompleted || 0) > 0

  useEffect(() => {
    if (lessonId) {
      const savedRating = localStorage.getItem(`lesson-rating-${lessonId}`)
      if (savedRating) {
        setUserRating(parseInt(savedRating))
        setHasRated(true)
      }
    }
  }, [lessonId])

  useEffect(() => {
    async function loadLesson() {
      if (!trackId || !moduleId || !lessonId) return

      setIsLoading(true)
      setError(null)

      try {
        const { meta, content } = await getFullLesson(trackId, moduleId, lessonId)

        if (!content) {
          setError('Lesson content not found')
        } else {
          setLessonContent(content)
          setLessonMeta(meta)
          await startLesson(lessonId, trackId, moduleId)
        }
      } catch (err) {
        console.error('Failed to load lesson:', err)
        setError('Failed to load lesson content')
      } finally {
        setIsLoading(false)
      }
    }

    loadLesson()
  }, [trackId, moduleId, lessonId, startLesson])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    const scrollProgress = (element.scrollTop / (element.scrollHeight - element.clientHeight)) * 100
    const newProgress = Math.min(scrollProgress, 100)
    setReadingProgress(newProgress)

    if (lessonId && trackId && moduleId && newProgress > (lessonProgress?.progressPercent || 0)) {
      updateLessonProgress(lessonId, {
        progressPercent: Math.round(newProgress),
        trackId,
        moduleId
      })
    }
  }

  const handleComplete = async () => {
    if (lessonId) {
      await markLessonComplete(lessonId)
    }
  }

  const handleNextLesson = () => {
    navigate(`/learn/${trackId}/${moduleId}/${lessonId}/quiz`)
  }

  const handleBookmark = async () => {
    if (lessonId) {
      await bookmarkLesson(lessonId)
    }
  }

  const handleShare = async () => {
    const shareUrl = window.location.href
    const shareTitle = lessonMeta?.title || 'Check out this lesson'
    const shareText = `I'm learning "${shareTitle}" on QuantumShala! Join me in exploring quantum computing.`

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setShowShareModal(true)
        }
      }
    } else {
      setShowShareModal(true)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleTwitterShare = () => {
    const text = encodeURIComponent(`I'm learning "${lessonMeta?.title}" on @QuantumShala! 🚀`)
    const url = encodeURIComponent(window.location.href)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
    setShowShareModal(false)
  }

  const handleLinkedInShare = () => {
    const url = encodeURIComponent(window.location.href)
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank')
    setShowShareModal(false)
  }

  const handleRatingSubmit = () => {
    if (lessonId && userRating > 0) {
      localStorage.setItem(`lesson-rating-${lessonId}`, userRating.toString())
      setHasRated(true)
      setRatingSubmitted(true)
      setTimeout(() => {
        setShowRatingModal(false)
        setRatingSubmitted(false)
      }, 1500)
    }
  }

  const sidebarContent = (
    <>
      <Card variant="neumorph" className="mb-4">
        <h3 className="font-semibold text-white mb-4">Lesson Progress</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 shadow-neumorph-xs border border-white/[0.02] flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">Reading</p>
              <p className="text-xs text-slate-400">{Math.round(readingProgress)}% complete</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-neumorph-xs border border-white/[0.02] ${
              hasQuizAttempt && quizScore !== undefined && quizScore >= 70
                ? 'bg-green-500/20'
                : 'bg-neumorph-base'
            }`}>
              {hasQuizAttempt && quizScore !== undefined && quizScore >= 70 ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <PlayCircle className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">Quiz</p>
              <p className="text-xs text-slate-400">
                {hasQuizAttempt
                  ? `Best: ${quizScore}%`
                  : 'Not started'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-neumorph-xs border border-white/[0.02] ${
              hasExerciseAttempt && exerciseScore !== undefined && exerciseScore === 100
                ? 'bg-green-500/20'
                : hasExerciseAttempt
                ? 'bg-quantum-500/20'
                : 'bg-neumorph-base'
            }`}>
              {hasExerciseAttempt && exerciseScore !== undefined && exerciseScore === 100 ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : hasExerciseAttempt ? (
                <Code className="w-4 h-4 text-quantum-400" />
              ) : (
                <Code className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">Exercises</p>
              <p className="text-xs text-slate-400">
                {hasExerciseAttempt
                  ? `${lessonProgress?.exercisesCompleted}/${lessonProgress?.exercisesTotal} completed`
                  : 'Not started'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card variant="neumorph" className="mb-4">
        <h3 className="font-semibold text-white mb-4">AI Tutor</h3>
        <p className="text-sm text-slate-400 mb-4">
          Have questions about this lesson? Ask the AI tutor for help.
        </p>
        <Button
          variant="neumorph"
          className="w-full"
          leftIcon={<MessageCircle className="w-4 h-4" />}
          onClick={() => setShowAITutor(true)}
        >
          Ask a Question
        </Button>
      </Card>

      <Card variant="neumorph" className="mb-4">
        <h3 className="font-semibold text-white mb-4">Actions</h3>
        <div className="space-y-2">
          <button
            onClick={handleBookmark}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isBookmarked
                ? 'text-yellow-400 bg-yellow-500/10'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {isBookmarked ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            <span>{isBookmarked ? 'Saved' : 'Save for Later'}</span>
          </button>
          <button
            onClick={handleShare}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Lesson</span>
          </button>
          <button
            onClick={() => setShowRatingModal(true)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              hasRated
                ? 'text-yellow-400 bg-yellow-500/10'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
            <span>{hasRated ? `Rated ${userRating}/5` : 'Rate This Lesson'}</span>
          </button>
        </div>
      </Card>

      {lessonMeta?.learningObjectives && lessonMeta.learningObjectives.length > 0 && (
        <Card variant="neumorph">
          <h3 className="font-semibold text-white mb-4">Learning Objectives</h3>
          <ul className="space-y-2">
            {lessonMeta.learningObjectives.map((objective, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                {objective}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4 gap-2">
          <Link
            to={`/learn/${trackId}/${moduleId}`}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Module</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
              <Clock className="w-4 h-4" />
              <span>{lessonMeta?.estimatedMinutes || 15} min</span>
            </div>
            <Badge variant={isCompleted ? 'success' : 'default'} size="sm">
              {isCompleted ? 'Completed' : 'In Progress'}
            </Badge>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-slate-400"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        <Progress value={readingProgress} size="sm" className="mb-4" />

        <Card variant="neumorph" className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Loading lesson content...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
                <p className="text-red-400 mb-2">{error}</p>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="h-full overflow-y-auto p-4 md:p-6 prose prose-invert prose-sm md:prose-base max-w-none"
              onScroll={handleScroll}
            >
              <MDXRenderer content={lessonContent || ''} />
            </div>
          )}
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10">
          <Button variant="ghost" leftIcon={<ArrowLeft className="w-4 h-4" />} className="w-full sm:w-auto">
            Previous
          </Button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!isCompleted ? (
              <Button onClick={handleComplete} className="flex-1 sm:flex-none">
                Mark as Complete
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/learn/${trackId}/${moduleId}/${lessonId}/exercises`)}
                  leftIcon={<Code className="w-4 h-4" />}
                  className="flex-1 sm:flex-none"
                >
                  Exercises
                </Button>
                <Button
                  onClick={handleNextLesson}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="flex-1 sm:flex-none"
                >
                  Take Quiz
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="hidden lg:block w-80 flex-shrink-0 space-y-4">
        {sidebarContent}
      </div>

      {showSidebar && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setShowSidebar(false)}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-screen w-[300px] bg-neumorph-base/95 backdrop-blur-xl border-l border-white/[0.02] shadow-neumorph-lg z-50 p-4 overflow-y-auto lg:hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Lesson Info</h2>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebarContent}
          </motion.div>
        </>
      )}

      <AnimatePresence>
        {showShareModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowShareModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-neumorph-base border border-white/[0.02] rounded-xl shadow-neumorph-lg z-50 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Share Lesson</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-400 mb-4">
                Share "{lessonMeta?.title}" with others
              </p>

              <div className="flex gap-3 mb-4">
                <button
                  onClick={handleTwitterShare}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 text-[#1DA1F2] rounded-lg transition-colors"
                >
                  <Twitter className="w-5 h-5" />
                  <span>Twitter</span>
                </button>
                <button
                  onClick={handleLinkedInShare}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#0A66C2]/20 hover:bg-[#0A66C2]/30 text-[#0A66C2] rounded-lg transition-colors"
                >
                  <Linkedin className="w-5 h-5" />
                  <span>LinkedIn</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={window.location.href}
                  className="w-full px-4 py-3 pr-12 bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg text-white text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-400 mt-2">Link copied to clipboard!</p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRatingModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowRatingModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-neumorph-base border border-white/[0.02] rounded-xl shadow-neumorph-lg z-50 p-6"
            >
              {ratingSubmitted ? (
                <div className="text-center py-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="w-8 h-8 text-green-400" />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-white mb-2">Thank You!</h3>
                  <p className="text-sm text-slate-400">Your rating has been saved.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Rate This Lesson</h3>
                    <button
                      onClick={() => setShowRatingModal(false)}
                      className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-sm text-slate-400 mb-6 text-center">
                    How would you rate "{lessonMeta?.title}"?
                  </p>

                  <div className="flex justify-center gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setUserRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= (hoverRating || userRating)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <div className="text-center mb-4">
                    {userRating > 0 && (
                      <p className="text-sm text-slate-300">
                        {userRating === 1 && 'Poor'}
                        {userRating === 2 && 'Fair'}
                        {userRating === 3 && 'Good'}
                        {userRating === 4 && 'Very Good'}
                        {userRating === 5 && 'Excellent!'}
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={handleRatingSubmit}
                    disabled={userRating === 0}
                    variant="neumorph-primary"
                    className="w-full"
                  >
                    Submit Rating
                  </Button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AITutorChat
        isOpen={showAITutor}
        onClose={() => setShowAITutor(false)}
        lessonContext={{
          lessonTitle: lessonMeta?.title,
          moduleTitle: moduleId,
          trackTitle: trackId,
          lessonId: lessonId,
        }}
      />
    </div>
  )
}
