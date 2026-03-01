import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Send,
  Loader2,
  Bot,
  User,
  BookOpen,
  AlertCircle,
  ExternalLink,
  Trash2,
  Filter,
  Sparkles,
  Database
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAiTutor } from '@/hooks/useAiTutor'
import { cn } from '@/utils/cn'

interface AITutorChatProps {
  isOpen: boolean
  onClose: () => void
  defaultTrackId?: string
  lessonContext?: {
    lessonTitle?: string
    moduleTitle?: string
    trackTitle?: string
    lessonId?: string
    trackId?: string
    moduleId?: string
  }
}

interface FilterState {
  trackIds: string[]
  difficulty: ('beginner' | 'intermediate' | 'advanced')[]
  forceRag: boolean
}

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Beginner', color: 'text-green-400' },
  { value: 'intermediate', label: 'Intermediate', color: 'text-yellow-400' },
  { value: 'advanced', label: 'Advanced', color: 'text-red-400' },
] as const

export default function AITutorChat({
  isOpen,
  onClose,
  defaultTrackId,
  lessonContext
}: AITutorChatProps) {
  const [input, setInput] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    trackIds: defaultTrackId ? [defaultTrackId] : [],
    difficulty: [],
    forceRag: false,
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { chat, isLoading, error, conversationHistory, clearHistory } = useAiTutor()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversationHistory])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (defaultTrackId) {
      setFilters(prev => ({
        ...prev,
        trackIds: [defaultTrackId],
      }))
    }
  }, [defaultTrackId])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    await chat(userMessage, {
      useRag: filters.forceRag ? true : undefined,
      ragOptions: {
        trackIds: filters.trackIds.length > 0 ? filters.trackIds : undefined,
        difficulty: filters.difficulty.length > 0 ? filters.difficulty : undefined,
        topK: 5,
      },
      context: lessonContext ? {
        lessonId: lessonContext.lessonId,
        lessonTitle: lessonContext.lessonTitle,
        trackId: lessonContext.trackId,
        moduleId: lessonContext.moduleId,
      } : undefined,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleDifficulty = (diff: 'beginner' | 'intermediate' | 'advanced') => {
    setFilters(prev => ({
      ...prev,
      difficulty: prev.difficulty.includes(diff)
        ? prev.difficulty.filter(d => d !== diff)
        : [...prev.difficulty, diff],
    }))
  }

  const getLessonUrl = (trackId: string, moduleId: string, lessonId: string) => {
    return `/learn/${trackId}/${moduleId}/${lessonId}`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-screen w-full max-w-lg bg-neumorph-base backdrop-blur-xl border-l border-white/[0.02] shadow-neumorph-lg z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">AI Tutor</h2>
                  <p className="text-xs text-slate-400">Powered by Amazon Nova + RAG</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearHistory}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showFilters
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "hover:bg-white/10 text-slate-400"
                  )}
                  title="Filters"
                >
                  <Filter className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-white/10 overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">
                        Difficulty Filter (for RAG)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {DIFFICULTY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => toggleDifficulty(opt.value)}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                              filters.difficulty.includes(opt.value)
                                ? "bg-white/20 text-white"
                                : "bg-white/5 text-slate-400 hover:bg-white/10"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-400">Always use knowledge base</span>
                      </div>
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, forceRag: !prev.forceRag }))}
                        className={cn(
                          "w-10 h-5 rounded-full transition-colors relative",
                          filters.forceRag ? "bg-cyan-500" : "bg-slate-600"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform",
                          filters.forceRag ? "translate-x-5" : "translate-x-0.5"
                        )} />
                      </button>
                    </div>

                    {lessonContext?.trackId && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          Context: {lessonContext.trackTitle || lessonContext.trackId}
                        </span>
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, trackIds: [] }))}
                          className="text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          Clear context
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversationHistory.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4">
                    <Bot className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Hi! I'm your Quantum Tutor
                  </h3>
                  <p className="text-sm text-slate-400 max-w-xs mx-auto">
                    Ask me anything about quantum computing. I'll search our lessons when relevant and provide personalized guidance.
                  </p>
                  {lessonContext?.lessonTitle && (
                    <p className="text-xs text-cyan-400 mt-4">
                      Currently helping with: {lessonContext.lessonTitle}
                    </p>
                  )}

                  <div className="mt-6 space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Try asking:</p>
                    {[
                      "What is quantum superposition?",
                      "How does Grover's algorithm work?",
                      "Explain quantum error correction",
                      "Help me understand this circuit",
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(suggestion)}
                        className="block w-full text-left text-sm text-slate-400 hover:text-white px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {conversationHistory.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'flex gap-3',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[85%] space-y-2',
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  )}>
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-2',
                        msg.role === 'user'
                          ? 'bg-cyan-500/20 text-cyan-100'
                          : 'bg-white/10 text-slate-200'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {msg.role === 'assistant' && msg.usedRag && (
                      <div className="flex items-center gap-1 px-1">
                        <Database className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400">Used knowledge base</span>
                      </div>
                    )}

                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 uppercase tracking-wider px-1">
                          Sources
                        </p>
                        <div className="space-y-1">
                          {msg.sources.slice(0, 3).map((source, i) => (
                            <a
                              key={i}
                              href={getLessonUrl(source.trackId, source.moduleId, source.lessonId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                            >
                              <BookOpen className="w-3 h-3 text-slate-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-300 truncate">
                                  {source.lessonTitle}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {source.section} &bull; {Math.round(source.relevanceScore * 100)}% match
                                </p>
                              </div>
                              <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white/10 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                      <span className="text-sm text-slate-400">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-4 py-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about quantum computing..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="!p-3 rounded-xl"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                AI responses are for educational purposes. Verify important information.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
