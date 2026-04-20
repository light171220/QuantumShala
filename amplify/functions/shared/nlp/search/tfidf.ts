import { tokenizeAndClean, stemTokens } from '../utils/stopwords'

export interface TFIDFDocument {
  id: string
  vector: number[]
  magnitude: number
  rawTerms: string[]
}

export interface TFIDFIndex {
  documents: Map<string, TFIDFDocument>
  vocabulary: string[]
  vocabularyIndex: Map<string, number>
  idf: number[]
  documentFrequency: number[]
}

export interface TFIDFSearchResult {
  id: string
  score: number
  similarity: number
}

export interface TFIDFSerializedIndex {
  documents: Array<{
    id: string
    vector: number[]
    magnitude: number
    rawTerms: string[]
  }>
  vocabulary: string[]
  idf: number[]
  documentFrequency: number[]
}

function preprocessText(text: string): string[] {
  const tokens = tokenizeAndClean(text)
  return stemTokens(tokens)
}

function calculateTF(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const term of terms) {
    tf.set(term, (tf.get(term) || 0) + 1)
  }
  const docLength = terms.length
  for (const [term, freq] of tf) {
    tf.set(term, freq / docLength)
  }
  return tf
}

export function createTFIDFIndex(): TFIDFIndex {
  return {
    documents: new Map(),
    vocabulary: [],
    vocabularyIndex: new Map(),
    idf: [],
    documentFrequency: [],
  }
}

export function buildTFIDFIndex(
  documents: Array<{ id: string; text: string }>
): TFIDFIndex {
  const index = createTFIDFIndex()
  const docTerms: Map<string, string[]> = new Map()
  const docTF: Map<string, Map<string, number>> = new Map()

  const tempVocab = new Set<string>()
  const tempDF = new Map<string, number>()

  for (const { id, text } of documents) {
    const terms = preprocessText(text)
    docTerms.set(id, terms)
    const tf = calculateTF(terms)
    docTF.set(id, tf)

    const uniqueTerms = new Set(terms)
    for (const term of uniqueTerms) {
      tempVocab.add(term)
      tempDF.set(term, (tempDF.get(term) || 0) + 1)
    }
  }

  index.vocabulary = Array.from(tempVocab).sort()
  for (let i = 0; i < index.vocabulary.length; i++) {
    index.vocabularyIndex.set(index.vocabulary[i], i)
  }

  const N = documents.length
  index.documentFrequency = new Array(index.vocabulary.length).fill(0)
  index.idf = new Array(index.vocabulary.length).fill(0)

  for (let i = 0; i < index.vocabulary.length; i++) {
    const term = index.vocabulary[i]
    const df = tempDF.get(term) || 0
    index.documentFrequency[i] = df
    index.idf[i] = Math.log(N / (df + 1)) + 1
  }

  for (const { id } of documents) {
    const tf = docTF.get(id)!
    const vector = new Array(index.vocabulary.length).fill(0)

    for (const [term, freq] of tf) {
      const idx = index.vocabularyIndex.get(term)
      if (idx !== undefined) {
        vector[idx] = freq * index.idf[idx]
      }
    }

    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))

    index.documents.set(id, {
      id,
      vector,
      magnitude,
      rawTerms: docTerms.get(id)!,
    })
  }

  return index
}

function cosineSimilarity(v1: number[], v2: number[], mag1: number, mag2: number): number {
  if (mag1 === 0 || mag2 === 0) return 0

  let dotProduct = 0
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i]
  }

  return dotProduct / (mag1 * mag2)
}

function createQueryVector(index: TFIDFIndex, query: string): { vector: number[]; magnitude: number } {
  const terms = preprocessText(query)
  const tf = calculateTF(terms)
  const vector = new Array(index.vocabulary.length).fill(0)

  for (const [term, freq] of tf) {
    const idx = index.vocabularyIndex.get(term)
    if (idx !== undefined) {
      vector[idx] = freq * index.idf[idx]
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))

  return { vector, magnitude }
}

export function searchTFIDF(
  index: TFIDFIndex,
  query: string,
  limit = 10
): TFIDFSearchResult[] {
  const { vector: queryVector, magnitude: queryMag } = createQueryVector(index, query)

  if (queryMag === 0) return []

  const results: TFIDFSearchResult[] = []

  for (const doc of index.documents.values()) {
    const similarity = cosineSimilarity(queryVector, doc.vector, queryMag, doc.magnitude)

    if (similarity > 0) {
      results.push({
        id: doc.id,
        score: similarity,
        similarity,
      })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

export function findSimilarDocuments(
  index: TFIDFIndex,
  docId: string,
  limit = 5
): TFIDFSearchResult[] {
  const targetDoc = index.documents.get(docId)
  if (!targetDoc) return []

  const results: TFIDFSearchResult[] = []

  for (const doc of index.documents.values()) {
    if (doc.id === docId) continue

    const similarity = cosineSimilarity(
      targetDoc.vector,
      doc.vector,
      targetDoc.magnitude,
      doc.magnitude
    )

    if (similarity > 0) {
      results.push({
        id: doc.id,
        score: similarity,
        similarity,
      })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

export function addDocumentToIndex(
  index: TFIDFIndex,
  id: string,
  text: string
): void {
  const terms = preprocessText(text)
  const tf = calculateTF(terms)

  const newTerms: string[] = []
  for (const term of new Set(terms)) {
    if (!index.vocabularyIndex.has(term)) {
      const idx = index.vocabulary.length
      index.vocabulary.push(term)
      index.vocabularyIndex.set(term, idx)
      newTerms.push(term)
    }
  }

  if (newTerms.length > 0) {
    const newLength = index.vocabulary.length

    for (let i = index.idf.length; i < newLength; i++) {
      index.idf.push(0)
      index.documentFrequency.push(0)
    }

    for (const doc of index.documents.values()) {
      while (doc.vector.length < newLength) {
        doc.vector.push(0)
      }
    }
  }

  const uniqueTerms = new Set(terms)
  const N = index.documents.size + 1

  for (const term of uniqueTerms) {
    const idx = index.vocabularyIndex.get(term)!
    index.documentFrequency[idx]++
  }

  for (let i = 0; i < index.vocabulary.length; i++) {
    const df = index.documentFrequency[i]
    index.idf[i] = Math.log(N / (df + 1)) + 1
  }

  const vector = new Array(index.vocabulary.length).fill(0)

  for (const [term, freq] of tf) {
    const idx = index.vocabularyIndex.get(term)
    if (idx !== undefined) {
      vector[idx] = freq * index.idf[idx]
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))

  for (const doc of index.documents.values()) {
    let newMag = 0
    for (let i = 0; i < doc.vector.length; i++) {
      if (doc.rawTerms.includes(index.vocabulary[i])) {
        const termCount = doc.rawTerms.filter(t => t === index.vocabulary[i]).length
        const termFreq = termCount / doc.rawTerms.length
        doc.vector[i] = termFreq * index.idf[i]
      }
      newMag += doc.vector[i] * doc.vector[i]
    }
    doc.magnitude = Math.sqrt(newMag)
  }

  index.documents.set(id, {
    id,
    vector,
    magnitude,
    rawTerms: terms,
  })
}

export function serializeTFIDFIndex(index: TFIDFIndex): TFIDFSerializedIndex {
  const documents: TFIDFSerializedIndex['documents'] = []

  for (const doc of index.documents.values()) {
    documents.push({
      id: doc.id,
      vector: doc.vector,
      magnitude: doc.magnitude,
      rawTerms: doc.rawTerms,
    })
  }

  return {
    documents,
    vocabulary: index.vocabulary,
    idf: index.idf,
    documentFrequency: index.documentFrequency,
  }
}

export function deserializeTFIDFIndex(data: TFIDFSerializedIndex): TFIDFIndex {
  const vocabularyIndex = new Map<string, number>()
  for (let i = 0; i < data.vocabulary.length; i++) {
    vocabularyIndex.set(data.vocabulary[i], i)
  }

  const documents = new Map<string, TFIDFDocument>()
  for (const doc of data.documents) {
    documents.set(doc.id, {
      id: doc.id,
      vector: doc.vector,
      magnitude: doc.magnitude,
      rawTerms: doc.rawTerms || [],
    })
  }

  return {
    documents,
    vocabulary: data.vocabulary,
    vocabularyIndex,
    idf: data.idf,
    documentFrequency: data.documentFrequency,
  }
}

export function getTopTerms(
  index: TFIDFIndex,
  docId: string,
  limit = 10
): Array<{ term: string; score: number }> {
  const doc = index.documents.get(docId)
  if (!doc) return []

  const terms: Array<{ term: string; score: number }> = []

  for (let i = 0; i < doc.vector.length; i++) {
    if (doc.vector[i] > 0) {
      terms.push({
        term: index.vocabulary[i],
        score: doc.vector[i],
      })
    }
  }

  terms.sort((a, b) => b.score - a.score)
  return terms.slice(0, limit)
}

export function getTFIDFStats(index: TFIDFIndex): {
  documentCount: number
  vocabularySize: number
  avgVectorDensity: number
} {
  let totalNonZero = 0
  let totalElements = 0

  for (const doc of index.documents.values()) {
    for (const v of doc.vector) {
      if (v > 0) totalNonZero++
    }
    totalElements += doc.vector.length
  }

  return {
    documentCount: index.documents.size,
    vocabularySize: index.vocabulary.length,
    avgVectorDensity: totalElements > 0 ? totalNonZero / totalElements : 0,
  }
}
