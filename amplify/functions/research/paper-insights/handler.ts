import type { Handler } from 'aws-lambda'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import {
  extractQuantumInsights,
  getQuantumSummary,
  extractKeywords,
  extractKeyphrases,
  type QuantumInsights,
  type ScoredKeyword,
} from '../../shared/nlp'

const s3 = new S3Client({})
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME

if (!BUCKET_NAME) {
  console.error('STORAGE_BUCKET_NAME environment variable is not set')
}

interface ExtractInsightsInput {
  paperId: string
  fullTextKey: string
  extractKeywords?: boolean
  extractQuantum?: boolean
  extractCitations?: boolean
}

interface CitationReference {
  context: string
  possibleDoi?: string
  possibleTitle?: string
  possibleAuthors?: string[]
  position: number
}

interface ExtractInsightsResult {
  success: boolean
  paperId: string
  quantumInsights?: QuantumInsights
  quantumSummary?: string
  keywords?: ScoredKeyword[]
  keyphrases?: ScoredKeyword[]
  citations?: CitationReference[]
  processingTimeMs: number
  error?: string
}

function extractCitationReferences(text: string): CitationReference[] {
  const citations: CitationReference[] = []

  const inlineCitationPattern = /\[(\d+(?:,\s*\d+)*|[A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4})\]/g
  const doiPattern = /10\.\d{4,}\/[^\s]+/g
  const arxivPattern = /arXiv:\s*(\d{4}\.\d{4,5})/gi

  let match
  while ((match = inlineCitationPattern.exec(text)) !== null) {
    const start = Math.max(0, match.index - 200)
    const end = Math.min(text.length, match.index + 200)
    const context = text.slice(start, end)

    citations.push({
      context: context.replace(/\s+/g, ' ').trim(),
      position: match.index,
    })
  }

  while ((match = doiPattern.exec(text)) !== null) {
    const start = Math.max(0, match.index - 100)
    const end = Math.min(text.length, match.index + match[0].length + 100)
    const context = text.slice(start, end)

    citations.push({
      context: context.replace(/\s+/g, ' ').trim(),
      possibleDoi: match[0],
      position: match.index,
    })
  }

  while ((match = arxivPattern.exec(text)) !== null) {
    const start = Math.max(0, match.index - 100)
    const end = Math.min(text.length, match.index + match[0].length + 100)
    const context = text.slice(start, end)

    const titleMatch = context.match(/[""]([^""]+)[""]/)

    citations.push({
      context: context.replace(/\s+/g, ' ').trim(),
      possibleTitle: titleMatch ? titleMatch[1] : undefined,
      position: match.index,
    })
  }

  const seen = new Set<number>()
  return citations.filter(c => {
    const rounded = Math.floor(c.position / 100)
    if (seen.has(rounded)) return false
    seen.add(rounded)
    return true
  })
}

function extractAuthorsFromContext(context: string): string[] {
  const authors: string[] = []

  const authorPattern = /([A-Z][a-z]+(?:,\s*[A-Z]\.?)?(?:\s+and\s+[A-Z][a-z]+(?:,\s*[A-Z]\.?)?)*)/g

  let match
  while ((match = authorPattern.exec(context)) !== null) {
    const potential = match[1]
    if (potential.length > 3 && potential.length < 50) {
      const names = potential.split(/\s+and\s+/)
      authors.push(...names.map(n => n.trim()))
    }
  }

  return authors.slice(0, 5)
}

export const handler: Handler = async (event): Promise<ExtractInsightsResult> => {
  const startTime = Date.now()
  console.log('Extracting insights:', JSON.stringify(event))

  try {
    const input: ExtractInsightsInput = typeof event === 'string'
      ? JSON.parse(event)
      : event.arguments || event

    const {
      paperId,
      fullTextKey,
      extractKeywords: doKeywords = true,
      extractQuantum: doQuantum = true,
      extractCitations: doCitations = true,
    } = input

    if (!paperId || !fullTextKey) {
      return {
        success: false,
        paperId: paperId || 'unknown',
        processingTimeMs: Date.now() - startTime,
        error: 'Missing required parameters: paperId and fullTextKey',
      }
    }

    if (!BUCKET_NAME) {
      return {
        success: false,
        paperId,
        processingTimeMs: Date.now() - startTime,
        error: 'S3 bucket not configured',
      }
    }

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
        processingTimeMs: Date.now() - startTime,
        error: 'Full text is too short for analysis',
      }
    }

    console.log(`Analyzing text of ${fullText.length} characters`)

    const result: ExtractInsightsResult = {
      success: true,
      paperId,
      processingTimeMs: 0,
    }

    if (doQuantum) {
      console.log('Extracting quantum insights')
      result.quantumInsights = extractQuantumInsights(fullText)
      result.quantumSummary = getQuantumSummary(result.quantumInsights)
    }

    if (doKeywords) {
      console.log('Extracting keywords')
      result.keywords = extractKeywords(fullText, { keywordCount: 15 })
      result.keyphrases = extractKeyphrases(fullText, { keywordCount: 10 })
    }

    if (doCitations) {
      console.log('Extracting citations')
      const citationRefs = extractCitationReferences(fullText)

      result.citations = citationRefs.map(c => ({
        ...c,
        possibleAuthors: c.possibleAuthors || extractAuthorsFromContext(c.context),
      }))
    }

    result.processingTimeMs = Date.now() - startTime
    console.log(`Insight extraction completed in ${result.processingTimeMs}ms`)

    return result
  } catch (error) {
    console.error('Error extracting insights:', error)
    return {
      success: false,
      paperId: (event as ExtractInsightsInput).paperId || 'unknown',
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
