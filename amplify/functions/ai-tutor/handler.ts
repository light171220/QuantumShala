import type { Handler } from 'aws-lambda'
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const s3Client = new S3Client({})
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' })

const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || ''
const EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0'
const GENERATION_MODEL_ID = 'amazon.nova-lite-v1:0'
const EMBEDDING_DIMENSIONS = 1024

interface Message {
  role: 'user' | 'assistant'
  content: string
}

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

interface TutorRequest {
  action: 'chat' | 'explain_concept' | 'quiz_hint' | 'analyze_circuit' | 'explain_code'
  message?: string
  conversationHistory?: Message[]
  useRag?: boolean
  ragOptions?: {
    trackIds?: string[]
    difficulty?: string[]
    tags?: string[]
    topK?: number
  }
  context?: {
    lessonId?: string
    lessonTitle?: string
    trackId?: string
    moduleId?: string
  }
  conceptArgs?: {
    concept: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
  }
  quizArgs?: {
    question: string
    options?: string[]
    topic?: string
  }
  circuitArgs?: {
    numQubits: number
    gates: unknown[]
  }
  codeArgs?: {
    code: string
    language: 'qiskit' | 'cirq' | 'pennylane' | 'openqasm'
  }
}

interface TutorResponse {
  success: boolean
  message: string
  sources?: Source[]
  usedRag: boolean
  actionType: string
  structuredResponse?: {
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
  error?: string
}

interface ChunkDocument {
  id: string
  lessonId: string
  moduleId: string
  trackId: string
  text: string
  embedding: number[]
  chunkType: string
  metadata: {
    lessonTitle: string
    difficulty: string
    tags: string[]
    section: string
    codeLanguage?: string
  }
}

let cachedChunks: ChunkDocument[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 5 * 60 * 1000

const SYSTEM_PROMPT = `You are QuantumShala AI Tutor, an expert quantum computing educator. Your role is to:

1. Explain quantum computing concepts clearly and accurately
2. Adapt explanations to the user's level (beginner, intermediate, advanced)
3. Use analogies and examples to make complex topics accessible
4. Encourage hands-on experimentation with quantum circuits
5. Guide users through problem-solving step by step
6. Correct misconceptions gently and constructively
7. Suggest related topics and lessons when appropriate

Key topics you can help with:
- Quantum mechanics fundamentals (superposition, entanglement, measurement)
- Quantum gates and circuits (single-qubit, multi-qubit, universal gate sets)
- Quantum algorithms (Grover's, Shor's, VQE, QAOA, QFT)
- Quantum error correction
- Quantum machine learning
- Quantum chemistry and simulation
- Post-quantum cryptography
- Programming with Qiskit, Cirq, and PennyLane

Guidelines:
- Keep responses concise but thorough
- Use LaTeX notation for mathematical expressions when helpful (wrap in $ for inline, $$ for block)
- Include code examples when relevant
- Be encouraging and supportive
- If you don't know something, say so honestly`

const RAG_KEYWORDS = [
  'lesson', 'course', 'module', 'track', 'learn', 'tutorial',
  'what is', 'explain', 'how does', 'definition', 'example',
  'quantum', 'qubit', 'gate', 'circuit', 'algorithm',
  'superposition', 'entanglement', 'measurement',
  'grover', 'shor', 'vqe', 'qaoa', 'qft',
  'error correction', 'decoherence', 'noise',
  'qiskit', 'cirq', 'pennylane', 'openqasm'
]

function shouldUseRag(message: string, explicitUseRag?: boolean): boolean {
  if (explicitUseRag !== undefined) return explicitUseRag

  const lowerMessage = message.toLowerCase()

  const conversationalPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|sure|yes|no|bye|goodbye)/i,
    /^(how are you|what's up|what can you do)/i,
  ]

  for (const pattern of conversationalPatterns) {
    if (pattern.test(lowerMessage)) return false
  }

  const matchCount = RAG_KEYWORDS.filter(keyword =>
    lowerMessage.includes(keyword.toLowerCase())
  ).length

  return matchCount >= 1 || lowerMessage.includes('?')
}

async function getEmbedding(text: string): Promise<number[]> {
  const payload = {
    inputText: text,
    dimensions: EMBEDDING_DIMENSIONS,
    normalize: true,
  }

  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  })

  const response = await bedrockClient.send(command)
  const responseBody = JSON.parse(new TextDecoder().decode(response.body))
  return responseBody.embedding
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function loadAllChunks(): Promise<ChunkDocument[]> {
  if (cachedChunks && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedChunks
  }

  const chunks: ChunkDocument[] = []
  let continuationToken: string | undefined

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'rag/embeddings/vectors/',
      ContinuationToken: continuationToken,
    })

    const listResponse = await s3Client.send(listCommand)

    if (listResponse.Contents) {
      for (const obj of listResponse.Contents) {
        if (!obj.Key?.endsWith('.json')) continue

        try {
          const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: obj.Key,
          })

          const getResponse = await s3Client.send(getCommand)
          const content = await getResponse.Body?.transformToString() || '[]'
          const lessonChunks: ChunkDocument[] = JSON.parse(content)
          chunks.push(...lessonChunks)
        } catch (err) {
          console.error(`Failed to load ${obj.Key}:`, err)
        }
      }
    }

    continuationToken = listResponse.NextContinuationToken
  } while (continuationToken)

  cachedChunks = chunks
  cacheTimestamp = Date.now()

  return chunks
}

function filterChunks(
  chunks: ChunkDocument[],
  options?: { trackIds?: string[]; difficulty?: string[]; tags?: string[] }
): ChunkDocument[] {
  if (!options) return chunks

  return chunks.filter(chunk => {
    if (options.trackIds && options.trackIds.length > 0) {
      if (!options.trackIds.includes(chunk.trackId)) return false
    }
    if (options.difficulty && options.difficulty.length > 0) {
      if (!options.difficulty.includes(chunk.metadata.difficulty)) return false
    }
    if (options.tags && options.tags.length > 0) {
      const chunkTags = chunk.metadata.tags.map(t => t.toLowerCase())
      const hasTag = options.tags.some(t => chunkTags.includes(t.toLowerCase()))
      if (!hasTag) return false
    }
    return true
  })
}

async function searchRag(
  query: string,
  options?: { trackIds?: string[]; difficulty?: string[]; tags?: string[]; topK?: number }
): Promise<{ chunks: Array<ChunkDocument & { score: number }>; sources: Source[] }> {
  const topK = options?.topK ?? 5

  let chunks = await loadAllChunks()
  chunks = filterChunks(chunks, options)

  if (chunks.length === 0) {
    return { chunks: [], sources: [] }
  }

  const queryEmbedding = await getEmbedding(query)

  const scored = chunks.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }))

  scored.sort((a, b) => b.score - a.score)
  const topChunks = scored.slice(0, topK)

  const sources: Source[] = topChunks.map(chunk => ({
    lessonId: chunk.lessonId,
    moduleId: chunk.moduleId,
    trackId: chunk.trackId,
    lessonTitle: chunk.metadata.lessonTitle,
    section: chunk.metadata.section,
    chunkType: chunk.chunkType,
    relevanceScore: Math.round(chunk.score * 100) / 100,
    snippet: chunk.text.slice(0, 200) + (chunk.text.length > 200 ? '...' : ''),
  }))

  return { chunks: topChunks, sources }
}

async function invokeNova(
  messages: Array<{ role: string; content: Array<{ text: string }> }>,
  systemPrompt?: string,
  maxTokens: number = 1024
): Promise<string> {
  const payload: Record<string, unknown> = {
    messages,
    inferenceConfig: {
      maxTokens,
      temperature: 0.3,
      topP: 0.9,
    },
  }

  if (systemPrompt) {
    payload.system = [{ text: systemPrompt }]
  }

  const command = new InvokeModelCommand({
    modelId: GENERATION_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  })

  const response = await bedrockClient.send(command)
  const responseBody = JSON.parse(new TextDecoder().decode(response.body))

  return responseBody.output?.message?.content?.[0]?.text || 'Unable to generate a response.'
}

async function handleChat(
  request: TutorRequest
): Promise<{ message: string; sources?: Source[]; usedRag: boolean }> {
  const userMessage = request.message || ''
  const useRag = shouldUseRag(userMessage, request.useRag)

  let contextText = ''
  let sources: Source[] = []

  if (useRag) {
    const ragResult = await searchRag(userMessage, request.ragOptions)
    sources = ragResult.sources

    if (ragResult.chunks.length > 0) {
      contextText = ragResult.chunks
        .map((chunk, i) => `[Source ${i + 1}: ${chunk.metadata.lessonTitle} - ${chunk.metadata.section}]\n${chunk.text}`)
        .join('\n\n---\n\n')
    }
  }

  const messages: Array<{ role: string; content: Array<{ text: string }> }> = []

  if (request.conversationHistory) {
    for (const msg of request.conversationHistory.slice(-10)) {
      messages.push({
        role: msg.role,
        content: [{ text: msg.content }],
      })
    }
  }

  let finalUserMessage = userMessage
  if (contextText) {
    finalUserMessage = `Context from QuantumShala lessons:\n${contextText}\n\n---\n\nUser Question: ${userMessage}\n\nPlease answer based on the context above. Reference the source lessons when appropriate. If the context doesn't contain enough information, say so and provide what help you can.`
  }

  if (request.context?.lessonTitle) {
    finalUserMessage = `[Currently studying: ${request.context.lessonTitle}]\n\n${finalUserMessage}`
  }

  messages.push({
    role: 'user',
    content: [{ text: finalUserMessage }],
  })

  const response = await invokeNova(messages, SYSTEM_PROMPT)

  return { message: response, sources: sources.length > 0 ? sources : undefined, usedRag: useRag && sources.length > 0 }
}

async function handleExplainConcept(args: TutorRequest['conceptArgs']): Promise<TutorResponse['structuredResponse']> {
  if (!args) throw new Error('conceptArgs required')

  const prompt = `Explain the concept "${args.concept}" for a ${args.difficulty} level student.

Please provide your response in the following JSON format:
{
  "explanation": "Clear explanation of the concept",
  "analogy": "A simple real-world analogy",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "relatedTopics": ["Related topic 1", "Related topic 2"]
}

Keep the explanation under 300 words. Use LaTeX notation ($ for inline, $$ for block) for mathematical expressions.`

  const messages = [{ role: 'user', content: [{ text: prompt }] }]
  const response = await invokeNova(messages, SYSTEM_PROMPT)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {
  }

  return {
    explanation: response,
    analogy: '',
    keyPoints: [],
    relatedTopics: [],
  }
}

async function handleQuizHint(args: TutorRequest['quizArgs']): Promise<TutorResponse['structuredResponse']> {
  if (!args) throw new Error('quizArgs required')

  const optionsText = args.options ? `Options: ${args.options.join(', ')}` : ''
  const topicText = args.topic ? `Topic: ${args.topic}` : ''

  const prompt = `Provide a hint for this quiz question without giving away the answer directly:

Question: ${args.question}
${optionsText}
${topicText}

Please provide your response in the following JSON format:
{
  "hint": "A helpful hint that guides understanding without revealing the answer",
  "conceptToReview": "The key concept the student should review"
}

Keep the hint concise (1-2 sentences).`

  const messages = [{ role: 'user', content: [{ text: prompt }] }]
  const response = await invokeNova(messages, SYSTEM_PROMPT, 256)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {
  }

  return {
    hint: response,
    conceptToReview: '',
  }
}

async function handleAnalyzeCircuit(args: TutorRequest['circuitArgs']): Promise<TutorResponse['structuredResponse']> {
  if (!args) throw new Error('circuitArgs required')

  const gatesJson = JSON.stringify(args.gates, null, 2)

  const prompt = `Analyze this quantum circuit:

Number of qubits: ${args.numQubits}
Gates: ${gatesJson}

Please provide your response in the following JSON format:
{
  "description": "What this circuit does",
  "expectedBehavior": "Expected output states and probabilities",
  "educationalInsights": ["Insight 1", "Insight 2"],
  "optimizationSuggestions": ["Suggestion 1", "Suggestion 2"]
}

Keep the analysis clear and educational.`

  const messages = [{ role: 'user', content: [{ text: prompt }] }]
  const response = await invokeNova(messages, SYSTEM_PROMPT)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {
  }

  return {
    description: response,
    expectedBehavior: '',
    educationalInsights: [],
    optimizationSuggestions: [],
  }
}

async function handleExplainCode(args: TutorRequest['codeArgs']): Promise<TutorResponse['structuredResponse']> {
  if (!args) throw new Error('codeArgs required')

  const prompt = `Explain this ${args.language} quantum computing code:

\`\`\`${args.language}
${args.code}
\`\`\`

Please provide your response in the following JSON format:
{
  "overview": "High-level description of what the code does",
  "lineByLineExplanation": ["Line 1 explanation", "Line 2 explanation"],
  "conceptsCovered": ["Concept 1", "Concept 2"],
  "suggestions": ["Improvement suggestion 1", "Suggestion 2"]
}

Keep explanations beginner-friendly when possible.`

  const messages = [{ role: 'user', content: [{ text: prompt }] }]
  const response = await invokeNova(messages, SYSTEM_PROMPT)

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {
  }

  return {
    overview: response,
    lineByLineExplanation: [],
    conceptsCovered: [],
    suggestions: [],
  }
}

export const handler: Handler<TutorRequest, TutorResponse> = async (event) => {
  try {
    const { action } = event

    switch (action) {
      case 'chat': {
        const result = await handleChat(event)
        return {
          success: true,
          message: result.message,
          sources: result.sources,
          usedRag: result.usedRag,
          actionType: 'chat',
        }
      }

      case 'explain_concept': {
        const structured = await handleExplainConcept(event.conceptArgs)
        return {
          success: true,
          message: structured?.explanation || '',
          usedRag: false,
          actionType: 'explain_concept',
          structuredResponse: structured,
        }
      }

      case 'quiz_hint': {
        const structured = await handleQuizHint(event.quizArgs)
        return {
          success: true,
          message: structured?.hint || '',
          usedRag: false,
          actionType: 'quiz_hint',
          structuredResponse: structured,
        }
      }

      case 'analyze_circuit': {
        const structured = await handleAnalyzeCircuit(event.circuitArgs)
        return {
          success: true,
          message: structured?.description || '',
          usedRag: false,
          actionType: 'analyze_circuit',
          structuredResponse: structured,
        }
      }

      case 'explain_code': {
        const structured = await handleExplainCode(event.codeArgs)
        return {
          success: true,
          message: structured?.overview || '',
          usedRag: false,
          actionType: 'explain_code',
          structuredResponse: structured,
        }
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    console.error('AI Tutor error:', error)
    return {
      success: false,
      message: '',
      usedRag: false,
      actionType: event.action,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
