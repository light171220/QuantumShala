import { tokenize, isStopWord, stem } from '../utils/stopwords'

export interface TextRankConfig {
  windowSize: number
  damping: number
  maxIterations: number
  tolerance: number
  keywordCount: number
}

export interface ScoredKeyword {
  term: string
  score: number
  frequency: number
}

export interface KeywordExtractionResult {
  keywords: ScoredKeyword[]
  keyphrases: ScoredKeyword[]
}

const DEFAULT_CONFIG: TextRankConfig = {
  windowSize: 4,
  damping: 0.85,
  maxIterations: 100,
  tolerance: 1e-6,
  keywordCount: 10,
}

function filterCandidates(tokens: string[]): string[] {
  return tokens.filter(token => {
    if (isStopWord(token)) return false
    if (token.length < 3 || token.length > 30) return false
    if (/^\d+$/.test(token)) return false
    if (/[^a-zA-Z-]/.test(token)) return false
    return true
  })
}

function buildCooccurrenceGraph(
  tokens: string[],
  windowSize: number
): Map<string, Map<string, number>> {
  const graph = new Map<string, Map<string, number>>()

  const uniqueTokens = new Set(tokens)
  for (const token of uniqueTokens) {
    graph.set(token, new Map())
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    for (let j = i + 1; j < Math.min(i + windowSize, tokens.length); j++) {
      const neighbor = tokens[j]
      if (token !== neighbor) {
        const tokenNeighbors = graph.get(token)!
        const neighborNeighbors = graph.get(neighbor)!

        tokenNeighbors.set(neighbor, (tokenNeighbors.get(neighbor) || 0) + 1)
        neighborNeighbors.set(token, (neighborNeighbors.get(token) || 0) + 1)
      }
    }
  }

  return graph
}

function runTextRank(
  graph: Map<string, Map<string, number>>,
  damping: number,
  maxIterations: number,
  tolerance: number
): Map<string, number> {
  const nodes = Array.from(graph.keys())
  const n = nodes.length
  if (n === 0) return new Map()

  const weightedDegree = new Map<string, number>()
  for (const [node, neighbors] of graph) {
    let degree = 0
    for (const weight of neighbors.values()) {
      degree += weight
    }
    weightedDegree.set(node, degree)
  }

  let scores = new Map<string, number>()
  for (const node of nodes) {
    scores.set(node, 1 / n)
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    const newScores = new Map<string, number>()
    let diff = 0

    for (const node of nodes) {
      let sum = 0
      const neighbors = graph.get(node)!

      for (const [neighbor, weight] of neighbors) {
        const neighborDegree = weightedDegree.get(neighbor) || 1
        const neighborScore = scores.get(neighbor) || 0
        sum += (weight / neighborDegree) * neighborScore
      }

      const newScore = (1 - damping) / n + damping * sum
      newScores.set(node, newScore)
      diff += Math.abs(newScore - (scores.get(node) || 0))
    }

    scores = newScores

    if (diff < tolerance) {
      break
    }
  }

  return scores
}

export function extractKeywords(
  text: string,
  config: Partial<TextRankConfig> = {}
): ScoredKeyword[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const allTokens = tokenize(text)
  const stemmedTokens = allTokens.map(stem)
  const candidates = filterCandidates(stemmedTokens)

  if (candidates.length === 0) {
    return []
  }

  const frequency = new Map<string, number>()
  for (const token of candidates) {
    frequency.set(token, (frequency.get(token) || 0) + 1)
  }

  const graph = buildCooccurrenceGraph(candidates, cfg.windowSize)

  const scores = runTextRank(graph, cfg.damping, cfg.maxIterations, cfg.tolerance)

  const keywords: ScoredKeyword[] = []
  for (const [term, score] of scores) {
    keywords.push({
      term,
      score,
      frequency: frequency.get(term) || 0,
    })
  }

  keywords.sort((a, b) => b.score - a.score)

  const stemToOriginal = new Map<string, string>()
  for (let i = 0; i < allTokens.length; i++) {
    const original = allTokens[i]
    const stemmed = stemmedTokens[i]
    if (!stemToOriginal.has(stemmed) && filterCandidates([original]).length > 0) {
      stemToOriginal.set(stemmed, original)
    }
  }

  const result: ScoredKeyword[] = keywords.slice(0, cfg.keywordCount).map(kw => ({
    term: stemToOriginal.get(kw.term) || kw.term,
    score: kw.score,
    frequency: kw.frequency,
  }))

  return result
}

export function extractKeyphrases(
  text: string,
  config: Partial<TextRankConfig> = {}
): ScoredKeyword[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const keywords = extractKeywords(text, { ...cfg, keywordCount: cfg.keywordCount * 2 })
  const keywordSet = new Set(keywords.map(k => k.term.toLowerCase()))

  const sentences = text.split(/[.!?]+/)
  const keyphrases = new Map<string, { score: number; frequency: number }>()

  for (const sentence of sentences) {
    const words = tokenize(sentence)

    let currentPhrase: string[] = []

    for (const word of words) {
      const stemmed = stem(word)
      const isKeyword = keywordSet.has(word.toLowerCase()) || keywordSet.has(stemmed)

      if (isKeyword) {
        currentPhrase.push(word)
      } else {
        if (currentPhrase.length >= 2 && currentPhrase.length <= 5) {
          const phrase = currentPhrase.join(' ').toLowerCase()
          const existing = keyphrases.get(phrase)
          if (existing) {
            existing.frequency++
          } else {
            let phraseScore = 0
            for (const w of currentPhrase) {
              const kw = keywords.find(k => k.term.toLowerCase() === w.toLowerCase())
              if (kw) phraseScore += kw.score
            }
            keyphrases.set(phrase, { score: phraseScore, frequency: 1 })
          }
        }
        currentPhrase = []
      }
    }

    if (currentPhrase.length >= 2 && currentPhrase.length <= 5) {
      const phrase = currentPhrase.join(' ').toLowerCase()
      const existing = keyphrases.get(phrase)
      if (existing) {
        existing.frequency++
      } else {
        let phraseScore = 0
        for (const w of currentPhrase) {
          const kw = keywords.find(k => k.term.toLowerCase() === w.toLowerCase())
          if (kw) phraseScore += kw.score
        }
        keyphrases.set(phrase, { score: phraseScore, frequency: 1 })
      }
    }
  }

  const result: ScoredKeyword[] = []
  for (const [term, data] of keyphrases) {
    result.push({
      term,
      score: data.score,
      frequency: data.frequency,
    })
  }

  result.sort((a, b) => b.score - a.score)
  return result.slice(0, cfg.keywordCount)
}

export function extractAll(
  text: string,
  config: Partial<TextRankConfig> = {}
): KeywordExtractionResult {
  return {
    keywords: extractKeywords(text, config),
    keyphrases: extractKeyphrases(text, config),
  }
}

export function extractDomainKeywords(
  text: string,
  domainTerms: string[],
  config: Partial<TextRankConfig> = {}
): ScoredKeyword[] {
  const keywords = extractKeywords(text, { ...config, keywordCount: config.keywordCount || 20 })

  const domainSet = new Set(domainTerms.map(t => t.toLowerCase()))

  const boosted = keywords.map(kw => {
    const isDomain = domainSet.has(kw.term.toLowerCase())
    return {
      ...kw,
      score: isDomain ? kw.score * 2 : kw.score,
    }
  })

  boosted.sort((a, b) => b.score - a.score)
  return boosted.slice(0, config.keywordCount || 10)
}

export const QUANTUM_DOMAIN_TERMS = [
  'qubit', 'quantum', 'superposition', 'entanglement', 'decoherence',
  'hamiltonian', 'eigenvalue', 'eigenvector', 'unitary', 'hermitian',
  'gate', 'circuit', 'measurement', 'state', 'amplitude', 'phase',
  'pauli', 'hadamard', 'cnot', 'toffoli', 'swap',
  'vqe', 'qaoa', 'qft', 'grover', 'shor', 'algorithm',
  'error', 'noise', 'fidelity', 'coherence', 'relaxation',
  'annealing', 'adiabatic', 'variational', 'ansatz',
  'ion', 'superconducting', 'photonic', 'topological',
  'optimization', 'simulation', 'chemistry', 'machine learning',
]

export function extractQuantumKeywords(
  text: string,
  config: Partial<TextRankConfig> = {}
): ScoredKeyword[] {
  return extractDomainKeywords(text, QUANTUM_DOMAIN_TERMS, config)
}
