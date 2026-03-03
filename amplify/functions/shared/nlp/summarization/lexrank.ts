import { tokenizeAndClean, stemTokens, splitIntoSentences } from '../utils/stopwords'

export interface LexRankConfig {
  threshold: number
  damping: number
  maxIterations: number
  tolerance: number
  sentenceCount: number
}

export interface ScoredSentence {
  text: string
  score: number
  position: number
}

export interface LexRankSummary {
  summary: string
  bulletPoints: string[]
  topSentences: ScoredSentence[]
}

const DEFAULT_CONFIG: LexRankConfig = {
  threshold: 0.1,
  damping: 0.85,
  maxIterations: 100,
  tolerance: 1e-6,
  sentenceCount: 5,
}

function preprocessSentence(sentence: string): string[] {
  const tokens = tokenizeAndClean(sentence)
  return stemTokens(tokens)
}

function calculateSentenceTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1)
  }
  return tf
}

function calculateIDF(sentences: string[][]): Map<string, number> {
  const df = new Map<string, number>()
  const N = sentences.length

  for (const tokens of sentences) {
    const unique = new Set(tokens)
    for (const token of unique) {
      df.set(token, (df.get(token) || 0) + 1)
    }
  }

  const idf = new Map<string, number>()
  for (const [term, freq] of df) {
    idf.set(term, Math.log(N / freq))
  }

  return idf
}

function calculateTFIDF(
  tokens: string[],
  idf: Map<string, number>
): Map<string, number> {
  const tf = calculateSentenceTF(tokens)
  const tfidf = new Map<string, number>()

  for (const [term, freq] of tf) {
    const idfValue = idf.get(term) || 0
    tfidf.set(term, freq * idfValue)
  }

  return tfidf
}

function cosineSimilarity(
  v1: Map<string, number>,
  v2: Map<string, number>
): number {
  let dotProduct = 0
  let mag1 = 0
  let mag2 = 0

  const allTerms = new Set([...v1.keys(), ...v2.keys()])

  for (const term of allTerms) {
    const val1 = v1.get(term) || 0
    const val2 = v2.get(term) || 0
    dotProduct += val1 * val2
    mag1 += val1 * val1
    mag2 += val2 * val2
  }

  mag1 = Math.sqrt(mag1)
  mag2 = Math.sqrt(mag2)

  if (mag1 === 0 || mag2 === 0) return 0
  return dotProduct / (mag1 * mag2)
}

function buildSimilarityGraph(
  sentences: string[][],
  idf: Map<string, number>,
  threshold: number
): number[][] {
  const n = sentences.length
  const graph: number[][] = Array(n).fill(null).map(() => Array(n).fill(0))

  const vectors: Map<string, number>[] = sentences.map(s => calculateTFIDF(s, idf))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const similarity = cosineSimilarity(vectors[i], vectors[j])
      if (similarity >= threshold) {
        graph[i][j] = similarity
        graph[j][i] = similarity
      }
    }
  }

  return graph
}

function runPageRank(
  graph: number[][],
  damping: number,
  maxIterations: number,
  tolerance: number
): number[] {
  const n = graph.length
  if (n === 0) return []

  const degree: number[] = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (graph[i][j] > 0) {
        degree[i]++
      }
    }
  }

  let scores: number[] = new Array(n).fill(1 / n)
  let newScores: number[] = new Array(n).fill(0)

  for (let iter = 0; iter < maxIterations; iter++) {
    newScores.fill(0)

    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let j = 0; j < n; j++) {
        if (graph[j][i] > 0 && degree[j] > 0) {
          sum += (graph[j][i] * scores[j]) / degree[j]
        }
      }
      newScores[i] = (1 - damping) / n + damping * sum
    }

    let diff = 0
    for (let i = 0; i < n; i++) {
      diff += Math.abs(newScores[i] - scores[i])
    }

    scores = [...newScores]

    if (diff < tolerance) {
      break
    }
  }

  return scores
}

export function summarize(
  text: string,
  config: Partial<LexRankConfig> = {}
): LexRankSummary {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const rawSentences = splitIntoSentences(text)
  if (rawSentences.length === 0) {
    return {
      summary: '',
      bulletPoints: [],
      topSentences: [],
    }
  }

  const processedSentences = rawSentences.map(preprocessSentence)

  const validIndices: number[] = []
  const validSentences: string[][] = []
  for (let i = 0; i < processedSentences.length; i++) {
    if (processedSentences[i].length > 0) {
      validIndices.push(i)
      validSentences.push(processedSentences[i])
    }
  }

  if (validSentences.length === 0) {
    return {
      summary: '',
      bulletPoints: [],
      topSentences: [],
    }
  }

  const idf = calculateIDF(validSentences)

  const graph = buildSimilarityGraph(validSentences, idf, cfg.threshold)

  const scores = runPageRank(graph, cfg.damping, cfg.maxIterations, cfg.tolerance)

  const scoredSentences: ScoredSentence[] = validIndices.map((origIdx, i) => ({
    text: rawSentences[origIdx],
    score: scores[i],
    position: origIdx,
  }))

  const sortedByScore = [...scoredSentences].sort((a, b) => b.score - a.score)

  const topCount = Math.min(cfg.sentenceCount, sortedByScore.length)
  const topSentences = sortedByScore.slice(0, topCount)

  const sortedByPosition = [...topSentences].sort((a, b) => a.position - b.position)

  const summary = sortedByPosition.map(s => s.text).join(' ')

  const bulletPoints = topSentences.map(s => s.text.trim())

  return {
    summary,
    bulletPoints,
    topSentences: sortedByScore,
  }
}

export function summarizeToLength(
  text: string,
  targetWords: number,
  config: Partial<LexRankConfig> = {}
): LexRankSummary {
  let sentenceCount = 1
  let result = summarize(text, { ...config, sentenceCount })

  while (result.summary.split(/\s+/).length < targetWords && sentenceCount < 20) {
    sentenceCount++
    result = summarize(text, { ...config, sentenceCount })
  }

  if (result.summary.split(/\s+/).length > targetWords * 1.5 && sentenceCount > 1) {
    result = summarize(text, { ...config, sentenceCount: sentenceCount - 1 })
  }

  return result
}

export function summarizeBullets(
  text: string,
  bulletCount: number = 5,
  config: Partial<LexRankConfig> = {}
): string[] {
  const result = summarize(text, { ...config, sentenceCount: bulletCount })
  return result.bulletPoints
}

export function getKeySentences(
  text: string,
  count: number = 3,
  config: Partial<LexRankConfig> = {}
): ScoredSentence[] {
  const result = summarize(text, { ...config, sentenceCount: count })
  return result.topSentences.slice(0, count)
}

export function findCommonKeyPoints(
  text1: string,
  text2: string,
  config: Partial<LexRankConfig> = {}
): string[] {
  const sentences1 = summarize(text1, { ...config, sentenceCount: 10 }).topSentences
  const sentences2 = summarize(text2, { ...config, sentenceCount: 10 }).topSentences

  const common: string[] = []

  for (const s1 of sentences1) {
    const tokens1 = new Set(preprocessSentence(s1.text))

    for (const s2 of sentences2) {
      const tokens2 = preprocessSentence(s2.text)
      const overlap = tokens2.filter(t => tokens1.has(t)).length
      const similarity = overlap / Math.max(tokens1.size, tokens2.length)

      if (similarity > 0.5) {
        common.push(s1.score > s2.score ? s1.text : s2.text)
        break
      }
    }
  }

  return common.slice(0, 5)
}
