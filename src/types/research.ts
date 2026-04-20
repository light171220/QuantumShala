// Research Paper Intelligence System Types
// All search/summarization algorithms are custom-built, self-hosted ($0 AI API costs)

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ReadStatus = 'unread' | 'reading' | 'read'

export interface ResearchPaper {
  id: string
  owner?: string
  title: string
  authors: string[]
  abstract: string
  doi?: string
  arxivId?: string
  pdfKey: string
  fullTextKey?: string
  pageCount?: number
  wordCount?: number
  keywords: string[]
  summary?: string
  summaryBullets?: string[]
  quantumAlgorithms?: string[]
  hamiltonians?: string[]
  circuitDescriptions?: string[]
  collectionIds: string[]
  tags: string[]
  rating?: number
  readStatus: ReadStatus
  processingStatus: ProcessingStatus
  processingError?: string
  publishedDate?: string
  journal?: string
  venue?: string
  citationCount?: number
  createdAt: string
  updatedAt: string
}

export interface PaperCollection {
  id: string
  owner?: string
  name: string
  description?: string
  color: string
  icon: string
  paperCount: number
  createdAt: string
  updatedAt: string
}

export interface SearchIndex {
  id: string
  owner?: string
  indexType: 'bm25' | 'tfidf' | 'combined'
  documentCount: number
  vocabularySize: number
  indexKey: string
  lastUpdated: string
  createdAt: string
}

export interface PaperCitation {
  id: string
  sourcePaperId: string
  targetDoi?: string
  targetTitle: string
  targetAuthors?: string[]
  citationContext?: string
  citationPosition?: number
  createdAt: string
}

export interface SearchResult {
  paper: ResearchPaper
  score: number
  highlights: SearchHighlight[]
  matchedFields: string[]
}

export interface SearchHighlight {
  field: string
  text: string
  positions: Array<{ start: number; end: number }>
}

export interface SearchQuery {
  query: string
  filters?: SearchFilters
  sortBy?: 'relevance' | 'date' | 'citations' | 'title'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface SearchFilters {
  collections?: string[]
  tags?: string[]
  authors?: string[]
  dateRange?: { start?: string; end?: string }
  readStatus?: ReadStatus[]
  hasQuantumContent?: boolean
}

export interface PaperSummary {
  paperId: string
  extractiveSummary: string
  bulletPoints: string[]
  keyPhrases: string[]
  topSentences: ScoredSentence[]
}

export interface ScoredSentence {
  text: string
  score: number
  position: number
}

export interface KeywordExtraction {
  paperId: string
  keywords: ScoredKeyword[]
  keyphrases: ScoredKeyword[]
  namedEntities?: NamedEntity[]
}

export interface ScoredKeyword {
  term: string
  score: number
  frequency: number
}

export interface NamedEntity {
  text: string
  type: 'algorithm' | 'molecule' | 'author' | 'organization' | 'other'
  position: { start: number; end: number }
}

export interface QuantumInsights {
  paperId: string
  isQuantumRelated: boolean
  algorithms: QuantumAlgorithm[]
  hamiltonians: HamiltonianReference[]
  circuits: CircuitDescription[]
  gates: string[]
  metrics: QuantumMetric[]
}

export interface QuantumAlgorithm {
  name: string
  type: 'variational' | 'gate-based' | 'adiabatic' | 'annealing' | 'error-correction' | 'other'
  context: string
  position: number
}

export interface HamiltonianReference {
  type: string
  description: string
  formula?: string
  context: string
}

export interface CircuitDescription {
  description: string
  numQubits?: number
  gates?: string[]
  depth?: number
  context: string
}

export interface QuantumMetric {
  name: string
  value?: string
  context: string
}

export interface CitationNetwork {
  nodes: CitationNode[]
  edges: CitationEdge[]
  pageRanks: Map<string, number>
  communities: CitationCommunity[]
}

export interface CitationNode {
  id: string
  paperId: string
  title: string
  authors: string[]
  year?: number
  citationCount: number
  pageRank: number
}

export interface CitationEdge {
  source: string
  target: string
  context?: string
}

export interface CitationCommunity {
  id: number
  members: string[]
  label?: string
  centralPaper?: string
}

// BM25 Index Types
export interface BM25Index {
  documents: BM25Document[]
  vocabulary: Map<string, number>
  idf: Map<string, number>
  avgDocLength: number
  k1: number
  b: number
}

export interface BM25Document {
  id: string
  termFrequencies: Map<string, number>
  length: number
}

// TF-IDF Index Types
export interface TFIDFIndex {
  documents: string[]
  vocabulary: string[]
  tfidfMatrix: number[][]
  documentVectors: Map<string, number[]>
}

// LexRank Types
export interface LexRankConfig {
  threshold: number
  damping: number
  maxIterations: number
  tolerance: number
  sentenceCount: number
}

// TextRank Types
export interface TextRankConfig {
  windowSize: number
  damping: number
  maxIterations: number
  tolerance: number
  keywordCount: number
}

// PageRank Types
export interface PageRankConfig {
  damping: number
  maxIterations: number
  tolerance: number
}

// Upload Types
export interface PaperUpload {
  file: File
  title?: string
  authors?: string[]
  doi?: string
  arxivId?: string
  tags?: string[]
  collectionIds?: string[]
}

export interface UploadProgress {
  stage: 'uploading' | 'processing' | 'indexing' | 'complete' | 'error'
  progress: number
  message: string
}

// Store Types
export type ResearchTab = 'library' | 'search' | 'insights' | 'collections'

export interface ResearchState {
  papers: ResearchPaper[]
  collections: PaperCollection[]
  searchResults: SearchResult[]
  selectedPaper: ResearchPaper | null
  searchQuery: string
  searchFilters: SearchFilters
  isLoading: boolean
  isSearching: boolean
  isUploading: boolean
  uploadProgress: UploadProgress | null
  activeTab: ResearchTab
  error: string | null
  citationNetwork: CitationNetwork | null
}

export interface ResearchActions {
  // Paper actions
  loadPapers: () => Promise<void>
  uploadPaper: (upload: PaperUpload) => Promise<ResearchPaper>
  deletePaper: (paperId: string) => Promise<void>
  updatePaper: (paperId: string, updates: Partial<ResearchPaper>) => Promise<void>
  selectPaper: (paper: ResearchPaper | null) => void

  // Search actions
  searchPapers: (query: SearchQuery) => Promise<void>
  setSearchQuery: (query: string) => void
  setSearchFilters: (filters: SearchFilters) => void
  clearSearch: () => void

  // Collection actions
  loadCollections: () => Promise<void>
  createCollection: (collection: Omit<PaperCollection, 'id' | 'owner' | 'paperCount' | 'createdAt' | 'updatedAt'>) => Promise<PaperCollection>
  updateCollection: (collectionId: string, updates: Partial<PaperCollection>) => Promise<void>
  deleteCollection: (collectionId: string) => Promise<void>
  addPaperToCollection: (paperId: string, collectionId: string) => Promise<void>
  removePaperFromCollection: (paperId: string, collectionId: string) => Promise<void>

  // Processing actions
  processPaper: (paperId: string) => Promise<void>
  summarizePaper: (paperId: string) => Promise<PaperSummary>
  extractKeywords: (paperId: string) => Promise<KeywordExtraction>
  extractQuantumInsights: (paperId: string) => Promise<QuantumInsights>

  // Citation actions
  loadCitationNetwork: () => Promise<void>

  // UI actions
  setActiveTab: (tab: ResearchTab) => void
  setError: (error: string | null) => void
  reset: () => void
}
