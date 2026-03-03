import type { Handler } from 'aws-lambda'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import {
  summarize,
  summarizeBullets,
  getKeySentences,
  extractKeywords,
  extractKeyphrases,
  extractQuantumKeywords,
  type ScoredSentence,
  type ScoredKeyword,
} from '../../shared/nlp'

const s3 = new S3Client({})
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME

if (!BUCKET_NAME) {
  console.error('STORAGE_BUCKET_NAME environment variable is not set')
}

interface SummarizePaperInput {
  paperId: string
  fullTextKey: string
  options?: {
    summaryLength?: 'short' | 'medium' | 'long'
    bulletCount?: number
    keywordCount?: number
    includeQuantumKeywords?: boolean
  }
}

interface SummarizePaperResult {
  success: boolean
  paperId: string
  extractiveSummary: string
  bulletPoints: string[]
  topSentences: ScoredSentence[]
  keywords: ScoredKeyword[]
  keyphrases: ScoredKeyword[]
  quantumKeywords?: ScoredKeyword[]
  processingTimeMs: number
  error?: string
}

function getSentenceCount(length: 'short' | 'medium' | 'long'): number {
  switch (length) {
    case 'short':
      return 3
    case 'medium':
      return 5
    case 'long':
      return 8
    default:
      return 5
  }
}

export const handler: Handler = async (event): Promise<SummarizePaperResult> => {
  const startTime = Date.now()
  console.log('Summarizing paper:', JSON.stringify(event))

  try {
    const input: SummarizePaperInput = typeof event === 'string'
      ? JSON.parse(event)
      : event.arguments || event

    const { paperId, fullTextKey, options = {} } = input

    if (!paperId || !fullTextKey) {
      return {
        success: false,
        paperId: paperId || 'unknown',
        extractiveSummary: '',
        bulletPoints: [],
        topSentences: [],
        keywords: [],
        keyphrases: [],
        processingTimeMs: Date.now() - startTime,
        error: 'Missing required parameters: paperId and fullTextKey',
      }
    }

    if (!BUCKET_NAME) {
      return {
        success: false,
        paperId,
        extractiveSummary: '',
        bulletPoints: [],
        topSentences: [],
        keywords: [],
        keyphrases: [],
        processingTimeMs: Date.now() - startTime,
        error: 'S3 bucket not configured',
      }
    }

    const {
      summaryLength = 'medium',
      bulletCount = 5,
      keywordCount = 10,
      includeQuantumKeywords = true,
    } = options

    console.log(`Downloading full text: ${fullTextKey}`)
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fullTextKey,
    })

    const response = await s3.send(getCommand)
    if (!response.Body) {
      throw new Error('Full text file is empty or could not be retrieved from S3')
    }
    const fullText = await response.Body.transformToString()

    if (fullText.length < 100) {
      return {
        success: false,
        paperId,
        extractiveSummary: '',
        bulletPoints: [],
        topSentences: [],
        keywords: [],
        keyphrases: [],
        processingTimeMs: Date.now() - startTime,
        error: 'Full text is too short for summarization',
      }
    }

    console.log(`Processing text of ${fullText.length} characters`)

    const sentenceCount = getSentenceCount(summaryLength)
    const summaryResult = summarize(fullText, {
      sentenceCount,
      threshold: 0.1,
      damping: 0.85,
    })

    const bulletPoints = summarizeBullets(fullText, bulletCount)

    const topSentences = getKeySentences(fullText, sentenceCount + 2)

    const keywords = extractKeywords(fullText, { keywordCount })

    const keyphrases = extractKeyphrases(fullText, { keywordCount: Math.floor(keywordCount / 2) })

    let quantumKeywords: ScoredKeyword[] | undefined
    if (includeQuantumKeywords) {
      quantumKeywords = extractQuantumKeywords(fullText, { keywordCount })
    }

    const processingTimeMs = Date.now() - startTime
    console.log(`Summarization completed in ${processingTimeMs}ms`)

    return {
      success: true,
      paperId,
      extractiveSummary: summaryResult.summary,
      bulletPoints,
      topSentences: topSentences.slice(0, sentenceCount),
      keywords,
      keyphrases,
      quantumKeywords,
      processingTimeMs,
    }
  } catch (error) {
    console.error('Error summarizing paper:', error)
    return {
      success: false,
      paperId: (event as SummarizePaperInput).paperId || 'unknown',
      extractiveSummary: '',
      bulletPoints: [],
      topSentences: [],
      keywords: [],
      keyphrases: [],
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
