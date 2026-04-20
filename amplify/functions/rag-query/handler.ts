import type { Handler } from 'aws-lambda'
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const s3Client = new S3Client({})
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' })

const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || ''
const EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0'
const GENERATION_MODEL_ID = 'amazon.nova-lite-v1:0'
const EMBEDDING_DIMENSIONS = 1024

interface QueryRequest {
  query: string
  trackIds?: string[]
  difficulty?: ('beginner' | 'intermediate' | 'advanced')[]
  tags?: string[]
  topK?: number
  includeContext?: boolean
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

interface QueryResponse {
  success: boolean
  answer: string
  sources: Source[]
  queryEmbeddingTimeMs: number
  searchTimeMs: number
  generationTimeMs: number
  totalTimeMs: number
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

interface MasterIndex {
  version: string
  lastUpdated: string
  totalChunks: number
  totalLessons: number
  entries: Record<string, {
    lessonId: string
    moduleId: string
    trackId: string
    lessonTitle: string
    difficulty: string
    chunkCount: number
    lastIndexed: string
  }>
}

let cachedChunks: ChunkDocument[] | null = null
let cachedMasterIndex: MasterIndex | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 5 * 60 * 1000

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

async function loadMasterIndex(): Promise<MasterIndex> {
  if (cachedMasterIndex && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedMasterIndex
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: 'rag/embeddings/index.json',
  })

  const response = await s3Client.send(command)
  const content = await response.Body?.transformToString() || '{}'
  cachedMasterIndex = JSON.parse(content)
  return cachedMasterIndex!
}

async function loadAllChunks(trackIds?: string[]): Promise<ChunkDocument[]> {
  if (cachedChunks && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    if (!trackIds || trackIds.length === 0) {
      return cachedChunks
    }
    return cachedChunks.filter(c => trackIds.includes(c.trackId))
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

  if (trackIds && trackIds.length > 0) {
    return chunks.filter(c => trackIds.includes(c.trackId))
  }

  return chunks
}

function filterChunks(
  chunks: ChunkDocument[],
  options: {
    trackIds?: string[]
    difficulty?: string[]
    tags?: string[]
  }
): ChunkDocument[] {
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

function searchChunks(
  queryEmbedding: number[],
  chunks: ChunkDocument[],
  topK: number
): Array<ChunkDocument & { score: number }> {
  const scored = chunks.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }))

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, topK)
}

async function generateAnswer(
  query: string,
  context: Array<ChunkDocument & { score: number }>
): Promise<string> {
  const contextText = context
    .map((chunk, i) => {
      const source = `[Source ${i + 1}: ${chunk.metadata.lessonTitle} - ${chunk.metadata.section}]`
      return `${source}\n${chunk.text}`
    })
    .join('\n\n---\n\n')

  const prompt = `You are QuantumShala AI Tutor, an expert quantum computing educator. Answer the user's question using ONLY the provided context. If the context doesn't contain enough information to fully answer the question, say so honestly.

Guidelines:
- Be clear, accurate, and educational
- Use LaTeX notation for mathematical expressions when helpful (wrap in $ for inline or $$ for block)
- Reference the source lessons when appropriate
- If the question cannot be answered from the context, say "I don't have enough information about that in my knowledge base."

Context:
${contextText}

User Question: ${query}

Answer:`

  const payload = {
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 1024,
      temperature: 0.3,
      topP: 0.9,
    },
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

export const handler: Handler<QueryRequest, QueryResponse> = async (event) => {
  const totalStartTime = Date.now()
  const { query, trackIds, difficulty, tags, topK = 5, includeContext = true } = event

  try {
    if (!BUCKET_NAME) {
      throw new Error('STORAGE_BUCKET_NAME environment variable not set')
    }

    if (!query || query.trim().length === 0) {
      throw new Error('Query is required')
    }

    const embeddingStartTime = Date.now()
    const queryEmbedding = await getEmbedding(query)
    const queryEmbeddingTimeMs = Date.now() - embeddingStartTime

    const searchStartTime = Date.now()
    let chunks = await loadAllChunks(trackIds)

    chunks = filterChunks(chunks, { trackIds, difficulty, tags })

    if (chunks.length === 0) {
      return {
        success: true,
        answer: 'No relevant content found in the knowledge base for your query with the specified filters.',
        sources: [],
        queryEmbeddingTimeMs,
        searchTimeMs: Date.now() - searchStartTime,
        generationTimeMs: 0,
        totalTimeMs: Date.now() - totalStartTime,
      }
    }

    const topChunks = searchChunks(queryEmbedding, chunks, topK)
    const searchTimeMs = Date.now() - searchStartTime

    const generationStartTime = Date.now()
    const answer = await generateAnswer(query, topChunks)
    const generationTimeMs = Date.now() - generationStartTime

    const sources: Source[] = topChunks.map(chunk => ({
      lessonId: chunk.lessonId,
      moduleId: chunk.moduleId,
      trackId: chunk.trackId,
      lessonTitle: chunk.metadata.lessonTitle,
      section: chunk.metadata.section,
      chunkType: chunk.chunkType,
      relevanceScore: Math.round(chunk.score * 100) / 100,
      snippet: includeContext ? chunk.text.slice(0, 200) + (chunk.text.length > 200 ? '...' : '') : '',
    }))

    return {
      success: true,
      answer,
      sources,
      queryEmbeddingTimeMs,
      searchTimeMs,
      generationTimeMs,
      totalTimeMs: Date.now() - totalStartTime,
    }
  } catch (error) {
    console.error('Query failed:', error)
    return {
      success: false,
      answer: '',
      sources: [],
      queryEmbeddingTimeMs: 0,
      searchTimeMs: 0,
      generationTimeMs: 0,
      totalTimeMs: Date.now() - totalStartTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
