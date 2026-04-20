import type { Handler } from 'aws-lambda'
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import {
  deserializeIndex,
  search,
  searchTFIDF,
  deserializeTFIDFIndex,
  tokenizeAndClean,
  type BM25SearchResult,
  type TFIDFSearchResult,
} from '../../shared/nlp'

const s3 = new S3Client({})
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME

if (!BUCKET_NAME) {
  console.error('STORAGE_BUCKET_NAME environment variable is not set')
}

interface SearchFilters {
  collections?: string[]
  tags?: string[]
  authors?: string[]
  dateRange?: { start?: string; end?: string }
  hasQuantumContent?: boolean
}

interface SearchPapersInput {
  query: string
  filters?: SearchFilters
  sortBy?: 'relevance' | 'date' | 'citations' | 'title'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

interface SearchHighlight {
  field: string
  text: string
  positions: Array<{ start: number; end: number }>
}

interface SearchResultItem {
  paperId: string
  score: number
  matchedTerms: string[]
  highlights: SearchHighlight[]
}

interface SearchPapersResult {
  success: boolean
  results: SearchResultItem[]
  totalCount: number
  queryTerms: string[]
  processingTimeMs: number
  error?: string
}

async function loadUserIndexes(userId: string): Promise<Map<string, any>> {
  const indexes = new Map<string, any>()

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `research/indexes/${userId}/`,
    })

    const listResponse = await s3.send(listCommand)

    if (!listResponse.Contents) {
      return indexes
    }

    for (const obj of listResponse.Contents) {
      if (!obj.Key || !obj.Key.endsWith('_index.json')) continue

      try {
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: obj.Key,
        })

        const response = await s3.send(getCommand)
        if (!response.Body) {
          console.warn(`Empty response body for index: ${obj.Key}`)
          continue
        }
        const content = await response.Body.transformToString()
        const indexData = JSON.parse(content)

        const paperId = obj.Key.split('/').pop()?.replace('_index.json', '') || ''
        indexes.set(paperId, indexData)
      } catch (err) {
        console.warn(`Failed to load index: ${obj.Key}`, err)
      }
    }
  } catch (err) {
    console.error('Failed to list indexes:', err)
  }

  return indexes
}

function createHighlights(
  text: string,
  matchedTerms: string[],
  field: string
): SearchHighlight[] {
  const highlights: SearchHighlight[] = []
  const lowerText = text.toLowerCase()

  for (const term of matchedTerms) {
    const positions: Array<{ start: number; end: number }> = []
    let pos = 0

    while ((pos = lowerText.indexOf(term.toLowerCase(), pos)) !== -1) {
      const start = Math.max(0, pos - 50)
      const end = Math.min(text.length, pos + term.length + 50)

      positions.push({ start: pos, end: pos + term.length })
      pos += term.length
    }

    if (positions.length > 0) {
      const firstPos = positions[0]
      const start = Math.max(0, firstPos.start - 50)
      const end = Math.min(text.length, firstPos.end + 50)
      let highlightText = text.slice(start, end)

      if (start > 0) highlightText = '...' + highlightText
      if (end < text.length) highlightText = highlightText + '...'

      highlights.push({
        field,
        text: highlightText,
        positions,
      })
    }
  }

  return highlights
}

function combineResults(
  bm25Results: BM25SearchResult[],
  tfidfResults: TFIDFSearchResult[],
  bm25Weight = 0.7,
  tfidfWeight = 0.3
): Map<string, { score: number; matchedTerms: string[] }> {
  const combined = new Map<string, { score: number; matchedTerms: string[] }>()

  const maxBM25 = Math.max(...bm25Results.map(r => r.score), 1)
  for (const result of bm25Results) {
    const paperId = result.id.split('_')[0]
    const normalizedScore = (result.score / maxBM25) * bm25Weight
    const existing = combined.get(paperId)

    if (existing) {
      existing.score += normalizedScore
      result.matchedTerms.forEach(t => {
        if (!existing.matchedTerms.includes(t)) {
          existing.matchedTerms.push(t)
        }
      })
    } else {
      combined.set(paperId, {
        score: normalizedScore,
        matchedTerms: [...result.matchedTerms],
      })
    }
  }

  const maxTFIDF = Math.max(...tfidfResults.map(r => r.score), 1)
  for (const result of tfidfResults) {
    const paperId = result.id.split('_')[0]
    const normalizedScore = (result.score / maxTFIDF) * tfidfWeight
    const existing = combined.get(paperId)

    if (existing) {
      existing.score += normalizedScore
    } else {
      combined.set(paperId, {
        score: normalizedScore,
        matchedTerms: [],
      })
    }
  }

  return combined
}

export const handler: Handler = async (event): Promise<SearchPapersResult> => {
  const startTime = Date.now()
  console.log('Searching papers:', JSON.stringify(event))

  try {
    const input: SearchPapersInput = typeof event === 'string'
      ? JSON.parse(event)
      : event.arguments || event

    const {
      query,
      filters = {},
      sortBy = 'relevance',
      sortOrder = 'desc',
      limit = 20,
      offset = 0,
    } = input

    if (!query || query.trim().length === 0) {
      return {
        success: true,
        results: [],
        totalCount: 0,
        queryTerms: [],
        processingTimeMs: Date.now() - startTime,
      }
    }

    if (!BUCKET_NAME) {
      return {
        success: false,
        results: [],
        totalCount: 0,
        queryTerms: [],
        processingTimeMs: Date.now() - startTime,
        error: 'S3 bucket not configured',
      }
    }

    const userId = event.identity?.sub || event.identity?.username || 'anonymous'

    const indexes = await loadUserIndexes(userId)

    if (indexes.size === 0) {
      return {
        success: true,
        results: [],
        totalCount: 0,
        queryTerms: tokenizeAndClean(query),
        processingTimeMs: Date.now() - startTime,
      }
    }

    const allBM25Results: BM25SearchResult[] = []

    for (const [paperId, indexData] of indexes) {
      try {
        const index = deserializeIndex(indexData)
        const results = search(index, query, 50)

        for (const result of results) {
          allBM25Results.push({
            ...result,
            id: result.id.startsWith(paperId) ? result.id : `${paperId}_${result.id}`,
          })
        }
      } catch (err) {
        console.warn(`Failed to search index for paper ${paperId}:`, err)
      }
    }

    const combinedResults = combineResults(allBM25Results, [], 1.0, 0.0)

    let resultItems: SearchResultItem[] = Array.from(combinedResults.entries())
      .map(([paperId, { score, matchedTerms }]) => ({
        paperId,
        score,
        matchedTerms,
        highlights: [],
      }))

    if (sortBy === 'relevance') {
      resultItems.sort((a, b) =>
        sortOrder === 'desc' ? b.score - a.score : a.score - b.score
      )
    }

    const totalCount = resultItems.length

    resultItems = resultItems.slice(offset, offset + limit)

    const processingTimeMs = Date.now() - startTime
    console.log(`Search completed in ${processingTimeMs}ms, found ${totalCount} results`)

    return {
      success: true,
      results: resultItems,
      totalCount,
      queryTerms: tokenizeAndClean(query),
      processingTimeMs,
    }
  } catch (error) {
    console.error('Error searching papers:', error)
    return {
      success: false,
      results: [],
      totalCount: 0,
      queryTerms: [],
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
