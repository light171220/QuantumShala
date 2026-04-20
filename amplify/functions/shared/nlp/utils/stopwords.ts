export const STOP_WORDS = new Set([
  'a', 'an', 'the',
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'at', 'by', 'for', 'from', 'in', 'into', 'of', 'off', 'on', 'onto',
  'out', 'over', 'to', 'up', 'with', 'about', 'above', 'across', 'after',
  'against', 'along', 'among', 'around', 'before', 'behind', 'below',
  'beneath', 'beside', 'between', 'beyond', 'during', 'except', 'inside',
  'near', 'outside', 'since', 'through', 'toward', 'under', 'until',
  'upon', 'within', 'without',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  'can', 'could',
  'here', 'there', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'not', 'only', 'own', 'same', 'than',
  'too', 'very', 'just', 'also', 'now', 'then', 'once',
  "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "couldn't",
  "shouldn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't",
  "hadn't", "i'm", "you're", "he's", "she's", "it's", "we're", "they're",
  "i've", "you've", "we've", "they've", "i'd", "you'd", "he'd", "she'd",
  "we'd", "they'd", "i'll", "you'll", "he'll", "she'll", "we'll", "they'll",
  'as', 'if', 'because', 'while', 'although', 'though', 'even',
  'any', 'either', 'neither', 'whether', 'however', 'therefore',
  'thus', 'hence', 'furthermore', 'moreover', 'nevertheless',
  'nonetheless', 'otherwise', 'accordingly', 'consequently',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'first', 'second', 'third',
  'paper', 'study', 'research', 'work', 'approach', 'method',
  'results', 'section', 'figure', 'table', 'equation', 'ref',
  'et', 'al', 'fig', 'eq', 'see', 'show', 'shown', 'shows',
  'using', 'used', 'based', 'given', 'consider', 'note',
])

export function isStopWord(word: string): boolean {
  return STOP_WORDS.has(word.toLowerCase())
}

export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter(token => !isStopWord(token))
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1)
}

export function tokenizeAndClean(text: string): string[] {
  return removeStopWords(tokenize(text))
}

export function stem(word: string): string {
  let result = word.toLowerCase()

  const suffixes = [
    'ational', 'tional', 'ization', 'ation', 'alism', 'iveness',
    'fulness', 'ousness', 'aliti', 'iviti', 'biliti', 'ement',
    'ment', 'ent', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize',
    'ing', 'ies', 'ion', 'ess', 'ness', 'ful', 'ant', 'ence',
    'ance', 'able', 'ible', 'ally', 'ly', 'er', 'or', 'ed', 's'
  ]

  for (const suffix of suffixes) {
    if (result.endsWith(suffix) && result.length > suffix.length + 2) {
      result = result.slice(0, -suffix.length)
      break
    }
  }

  return result
}

export function stemTokens(tokens: string[]): string[] {
  return tokens.map(stem)
}

export function splitIntoSentences(text: string): string[] {
  const normalized = text
    .replace(/([.!?])\s*(?=[A-Z])/g, '$1|')
    .replace(/\.\.\./g, '…')
    .replace(/Dr\./gi, 'Dr')
    .replace(/Mr\./gi, 'Mr')
    .replace(/Mrs\./gi, 'Mrs')
    .replace(/Ms\./gi, 'Ms')
    .replace(/Prof\./gi, 'Prof')
    .replace(/et al\./gi, 'et al')
    .replace(/Fig\./gi, 'Fig')
    .replace(/Eq\./gi, 'Eq')
    .replace(/vs\./gi, 'vs')
    .replace(/i\.e\./gi, 'ie')
    .replace(/e\.g\./gi, 'eg')

  return normalized
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 10)
}

export function calculateTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1)
  }
  return tf
}

export function normalizeTermFrequency(tf: Map<string, number>): Map<string, number> {
  const total = Array.from(tf.values()).reduce((a, b) => a + b, 0)
  const normalized = new Map<string, number>()
  for (const [term, freq] of tf) {
    normalized.set(term, freq / total)
  }
  return normalized
}
