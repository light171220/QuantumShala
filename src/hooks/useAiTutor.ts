import { useState, useCallback } from 'react'
import { client } from '@/lib/amplify-client'

interface Source {
  lessonId: string
  moduleId: string
  trackId: string
  lessonTitle: string
  section: string
  chunkType: string
  relevanceScore: number
  snippet: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  usedRag?: boolean
  timestamp: Date
}

interface ConversationContext {
  lessonId?: string
  lessonTitle?: string
  trackId?: string
  moduleId?: string
}

interface RagOptions {
  trackIds?: string[]
  difficulty?: ('beginner' | 'intermediate' | 'advanced')[]
  tags?: string[]
  topK?: number
}

interface StructuredResponse {
  explanation?: string
  analogy?: string
  keyPoints?: string[]
  relatedTopics?: string[]
  hint?: string
  conceptToReview?: string
  description?: string
  expectedBehavior?: string
  educationalInsights?: string[]
  optimizationSuggestions?: string[]
  overview?: string
  lineByLineExplanation?: string[]
  conceptsCovered?: string[]
  suggestions?: string[]
}

interface TutorResponse {
  success: boolean
  message: string
  sources?: Source[]
  usedRag: boolean
  actionType: string
  structuredResponse?: StructuredResponse
  error?: string
}

export function useAiTutor() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<Message[]>([])

  const chat = useCallback(async (
    message: string,
    options?: {
      useRag?: boolean
      ragOptions?: RagOptions
      context?: ConversationContext
    }
  ): Promise<{ message: string; sources?: Source[]; usedRag: boolean } | null> => {
    setIsLoading(true)
    setError(null)

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    }

    setConversationHistory(prev => [...prev, userMessage])

    try {
      const historyForApi = conversationHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const result = await client.mutations.aiTutor({
        action: 'chat',
        message,
        conversationHistory: historyForApi,
        useRag: options?.useRag,
        ragOptions: options?.ragOptions,
        context: options?.context,
      }) as { data?: TutorResponse; errors?: Array<{ message: string }> }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message)
      }

      const response = result.data as TutorResponse

      if (!response || !response.success) {
        throw new Error(response?.error || 'Chat failed')
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        sources: response.sources,
        usedRag: response.usedRag,
        timestamp: new Date(),
      }

      setConversationHistory(prev => [...prev, assistantMessage])

      return {
        message: response.message,
        sources: response.sources,
        usedRag: response.usedRag,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)

      const errorAssistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `I'm sorry, I encountered an error: ${errorMessage}`,
        timestamp: new Date(),
      }

      setConversationHistory(prev => [...prev, errorAssistantMessage])

      return null
    } finally {
      setIsLoading(false)
    }
  }, [conversationHistory])

  const explainConcept = useCallback(async (
    concept: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<StructuredResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await client.mutations.aiTutor({
        action: 'explain_concept',
        conceptArgs: { concept, difficulty },
      }) as { data?: TutorResponse; errors?: Array<{ message: string }> }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message)
      }

      const response = result.data as TutorResponse

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to explain concept')
      }

      return response.structuredResponse || { explanation: response.message }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getQuizHint = useCallback(async (
    question: string,
    options?: string[],
    topic?: string
  ): Promise<StructuredResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await client.mutations.aiTutor({
        action: 'quiz_hint',
        quizArgs: { question, options, topic },
      }) as { data?: TutorResponse; errors?: Array<{ message: string }> }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message)
      }

      const response = result.data as TutorResponse

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to get quiz hint')
      }

      return response.structuredResponse || { hint: response.message }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const analyzeCircuit = useCallback(async (
    numQubits: number,
    gates: unknown[]
  ): Promise<StructuredResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await client.mutations.aiTutor({
        action: 'analyze_circuit',
        circuitArgs: { numQubits, gates },
      }) as { data?: TutorResponse; errors?: Array<{ message: string }> }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message)
      }

      const response = result.data as TutorResponse

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to analyze circuit')
      }

      return response.structuredResponse || { description: response.message }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const explainCode = useCallback(async (
    code: string,
    language: 'qiskit' | 'cirq' | 'pennylane' | 'openqasm'
  ): Promise<StructuredResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await client.mutations.aiTutor({
        action: 'explain_code',
        codeArgs: { code, language },
      }) as { data?: TutorResponse; errors?: Array<{ message: string }> }

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message)
      }

      const response = result.data as TutorResponse

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to explain code')
      }

      return response.structuredResponse || { overview: response.message }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearHistory = useCallback(() => {
    setConversationHistory([])
    setError(null)
  }, [])

  return {
    chat,
    explainConcept,
    getQuizHint,
    analyzeCircuit,
    explainCode,
    isLoading,
    error,
    conversationHistory,
    clearHistory,
  }
}
