import { tokenizeAndClean, stem, stemTokens } from '../utils/stopwords'

export interface BM25Document {
  id: string
  termFrequencies: Map<string, number>
  length: number
}

export interface BM25Index {
  documents: Map<string, BM25Document>
  vocabulary: Set<string>
  idf: Map<string, number>
  avgDocLength: number
  k1: number
  b: number
}

export interface BM25SearchResult {
  id: string
  score: number
  matchedTerms: string[]
}

export interface BM25SerializedIndex {
  documents: Array<{
    id: string
    termFrequencies: Array<[string, number]>
    length: number
  }>
  vocabulary: string[]
  idf: Array<[string, number]>
  avgDocLength: number
  k1: number
  b: number
}

export function createBM25Index(k1 = 1.5, b = 0.75): BM25Index {
  return {
    documents: new Map(),
    vocabulary: new Set(),
    idf: new Map(),
    avgDocLength: 0,
    k1,
    b,
  }
}

function preprocessText(text: string): string[] {
  const tokens = tokenizeAndClean(text)
  return stemTokens(tokens)
}

export function addDocument(index: BM25Index, docId: string, text: string): void {
  const tokens = preprocessText(text)
  const termFrequencies = new Map<string, number>()

  for (const token of tokens) {
    index.vocabulary.add(token)
    termFrequencies.set(token, (termFrequencies.get(token) || 0) + 1)
  }

  index.documents.set(docId, {
    id: docId,
    termFrequencies,
    length: tokens.length,
  })
}

export function buildIndex(index: BM25Index): void {
  const N = index.documents.size
  if (N === 0) return

  let totalLength = 0
  for (const doc of index.documents.values()) {
    totalLength += doc.length
  }
  index.avgDocLength = totalLength / N

  for (const term of index.vocabulary) {
    let docFreq = 0
    for (const doc of index.documents.values()) {
      if (doc.termFrequencies.has(term)) {
        docFreq++
      }
    }
    const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1)
    index.idf.set(term, idf)
  }
}

function scoreDocument(
  index: BM25Index,
  doc: BM25Document,
  queryTerms: string[]
): { score: number; matchedTerms: string[] } {
  let score = 0
  const matchedTerms: string[] = []
  const { k1, b, avgDocLength } = index

  const safeAvgDocLength = avgDocLength > 0 ? avgDocLength : 1

  for (const term of queryTerms) {
    const idf = index.idf.get(term)
    if (!idf) continue

    const tf = doc.termFrequencies.get(term) || 0
    if (tf === 0) continue

    matchedTerms.push(term)

    const numerator = tf * (k1 + 1)
    const denominator = tf + k1 * (1 - b + b * (doc.length / safeAvgDocLength))
    if (denominator > 0) {
      score += idf * (numerator / denominator)
    }
  }

  return { score, matchedTerms }
}

export function search(
  index: BM25Index,
  query: string,
  limit = 10
): BM25SearchResult[] {
  const queryTerms = preprocessText(query)
  if (queryTerms.length === 0) return []

  const results: BM25SearchResult[] = []

  for (const doc of index.documents.values()) {
    const { score, matchedTerms } = scoreDocument(index, doc, queryTerms)
    if (score > 0) {
      results.push({
        id: doc.id,
        score,
        matchedTerms,
      })
    }
  }

  results.sort((a, b) => b.score - a.score)

  return results.slice(0, limit)
}

export function searchWithBoosts(
  indices: { index: BM25Index; boost: number }[],
  query: string,
  limit = 10
): BM25SearchResult[] {
  const queryTerms = preprocessText(query)
  if (queryTerms.length === 0) return []

  const combinedScores = new Map<string, { score: number; matchedTerms: Set<string> }>()

  for (const { index, boost } of indices) {
    for (const doc of index.documents.values()) {
      const { score, matchedTerms } = scoreDocument(index, doc, queryTerms)
      if (score > 0) {
        const existing = combinedScores.get(doc.id)
        if (existing) {
          existing.score += score * boost
          matchedTerms.forEach(t => existing.matchedTerms.add(t))
        } else {
          combinedScores.set(doc.id, {
            score: score * boost,
            matchedTerms: new Set(matchedTerms),
          })
        }
      }
    }
  }

  const results: BM25SearchResult[] = Array.from(combinedScores.entries()).map(
    ([id, { score, matchedTerms }]) => ({
      id,
      score,
      matchedTerms: Array.from(matchedTerms),
    })
  )

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

export function serializeIndex(index: BM25Index): BM25SerializedIndex {
  const documents: BM25SerializedIndex['documents'] = []

  for (const doc of index.documents.values()) {
    documents.push({
      id: doc.id,
      termFrequencies: Array.from(doc.termFrequencies.entries()),
      length: doc.length,
    })
  }

  return {
    documents,
    vocabulary: Array.from(index.vocabulary),
    idf: Array.from(index.idf.entries()),
    avgDocLength: index.avgDocLength,
    k1: index.k1,
    b: index.b,
  }
}

export function deserializeIndex(data: BM25SerializedIndex): BM25Index {
  const index: BM25Index = {
    documents: new Map(),
    vocabulary: new Set(data.vocabulary),
    idf: new Map(data.idf),
    avgDocLength: data.avgDocLength,
    k1: data.k1,
    b: data.b,
  }

  for (const doc of data.documents) {
    index.documents.set(doc.id, {
      id: doc.id,
      termFrequencies: new Map(doc.termFrequencies),
      length: doc.length,
    })
  }

  return index
}

export function updateDocument(index: BM25Index, docId: string, text: string): void {
  removeDocument(index, docId)
  addDocument(index, docId, text)
  buildIndex(index)
}

export function removeDocument(index: BM25Index, docId: string): void {
  index.documents.delete(docId)
}

export function getIndexStats(index: BM25Index): {
  documentCount: number
  vocabularySize: number
  avgDocLength: number
} {
  return {
    documentCount: index.documents.size,
    vocabularySize: index.vocabulary.size,
    avgDocLength: index.avgDocLength,
  }
}
