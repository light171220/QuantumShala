/**
 * Research Paper Intelligence Store
 * Zustand store with immer for research hub state management
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import type {
  ResearchPaper,
  PaperCollection,
  SearchResult,
  SearchFilters,
  SearchQuery,
  PaperSummary,
  KeywordExtraction,
  QuantumInsights,
  CitationNetwork,
  ResearchTab,
  PaperUpload,
  UploadProgress,
} from '@/types/research'
import * as researchService from '@/services/research'

interface ResearchState {
  // Data
  papers: ResearchPaper[]
  collections: PaperCollection[]
  searchResults: SearchResult[]
  selectedPaper: ResearchPaper | null
  citationNetwork: CitationNetwork | null

  // Search state
  searchQuery: string
  searchFilters: SearchFilters

  // UI state
  isLoading: boolean
  isSearching: boolean
  isUploading: boolean
  uploadProgress: UploadProgress | null
  activeTab: ResearchTab
  error: string | null
  isInitialized: boolean

  // Paper details cache
  paperSummaries: Map<string, PaperSummary>
  paperInsights: Map<string, QuantumInsights>
}

interface ResearchActions {
  // Initialization
  initialize: () => Promise<void>

  // Paper actions
  loadPapers: () => Promise<void>
  uploadPaper: (upload: PaperUpload) => Promise<ResearchPaper>
  deletePaper: (paperId: string) => Promise<void>
  updatePaper: (paperId: string, updates: Partial<ResearchPaper>) => Promise<void>
  selectPaper: (paper: ResearchPaper | null) => void
  setPaperRating: (paperId: string, rating: number) => Promise<void>
  setPaperReadStatus: (paperId: string, status: ResearchPaper['readStatus']) => Promise<void>

  // Search actions
  searchPapers: (query?: string) => Promise<void>
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

  // UI actions
  setActiveTab: (tab: ResearchTab) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initialState: ResearchState = {
  papers: [],
  collections: [],
  searchResults: [],
  selectedPaper: null,
  citationNetwork: null,
  searchQuery: '',
  searchFilters: {},
  isLoading: false,
  isSearching: false,
  isUploading: false,
  uploadProgress: null,
  activeTab: 'library',
  error: null,
  isInitialized: false,
  paperSummaries: new Map(),
  paperInsights: new Map(),
}

export const useResearchStore = create<ResearchState & ResearchActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      initialize: async () => {
        if (get().isInitialized) return

        set((state) => {
          state.isLoading = true
          state.error = null
        })

        try {
          await Promise.all([
            get().loadPapers(),
            get().loadCollections(),
          ])

          set((state) => {
            state.isInitialized = true
            state.isLoading = false
          })
        } catch (error) {
          set((state) => {
            state.isLoading = false
            state.error = error instanceof Error ? error.message : 'Failed to initialize'
          })
        }
      },

      loadPapers: async () => {
        try {
          const papers = await researchService.listPapers()
          set((state) => {
            state.papers = papers
          })
        } catch (error) {
          console.error('Failed to load papers:', error)
          throw error
        }
      },

      uploadPaper: async (upload) => {
        set((state) => {
          state.isUploading = true
          state.uploadProgress = {
            stage: 'uploading',
            progress: 0,
            message: 'Starting upload...',
          }
          state.error = null
        })

        try {
          const paper = await researchService.uploadPaper(upload, (progress) => {
            set((state) => {
              state.uploadProgress = progress
            })
          })

          set((state) => {
            state.papers.unshift(paper)
            state.isUploading = false
            state.uploadProgress = null
          })

          return paper
        } catch (error) {
          set((state) => {
            state.isUploading = false
            state.uploadProgress = {
              stage: 'error',
              progress: 0,
              message: error instanceof Error ? error.message : 'Upload failed',
            }
            state.error = error instanceof Error ? error.message : 'Upload failed'
          })
          throw error
        }
      },

      deletePaper: async (paperId) => {
        try {
          await researchService.deletePaper(paperId)

          set((state) => {
            state.papers = state.papers.filter((p) => p.id !== paperId)
            if (state.selectedPaper?.id === paperId) {
              state.selectedPaper = null
            }
          })
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to delete paper'
          })
          throw error
        }
      },

      updatePaper: async (paperId, updates) => {
        try {
          const updated = await researchService.updatePaper(paperId, updates)

          set((state) => {
            const index = state.papers.findIndex((p) => p.id === paperId)
            if (index !== -1) {
              state.papers[index] = updated
            }
            if (state.selectedPaper?.id === paperId) {
              state.selectedPaper = updated
            }
          })
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to update paper'
          })
          throw error
        }
      },

      selectPaper: (paper) => {
        set((state) => {
          state.selectedPaper = paper
        })
      },

      setPaperRating: async (paperId, rating) => {
        await get().updatePaper(paperId, { rating })
      },

      setPaperReadStatus: async (paperId, status) => {
        await get().updatePaper(paperId, { readStatus: status })
      },

      searchPapers: async (queryOverride) => {
        const { searchQuery, searchFilters } = get()
        const query = queryOverride ?? searchQuery

        if (!query.trim()) {
          set((state) => {
            state.searchResults = []
          })
          return
        }

        set((state) => {
          state.isSearching = true
          state.error = null
        })

        try {
          const searchParams: SearchQuery = {
            query,
            filters: searchFilters,
            sortBy: 'relevance',
            limit: 50,
          }

          const results = await researchService.searchPapers(searchParams)

          set((state) => {
            state.searchResults = results
            state.isSearching = false
          })
        } catch (error) {
          set((state) => {
            state.isSearching = false
            state.error = error instanceof Error ? error.message : 'Search failed'
          })
        }
      },

      setSearchQuery: (query) => {
        set((state) => {
          state.searchQuery = query
        })
      },

      setSearchFilters: (filters) => {
        set((state) => {
          state.searchFilters = filters
        })
      },

      clearSearch: () => {
        set((state) => {
          state.searchQuery = ''
          state.searchFilters = {}
          state.searchResults = []
        })
      },

      loadCollections: async () => {
        try {
          const collections = await researchService.listCollections()
          set((state) => {
            state.collections = collections
          })
        } catch (error) {
          console.error('Failed to load collections:', error)
          throw error
        }
      },

      createCollection: async (collection) => {
        try {
          const created = await researchService.createCollection(collection)
          set((state) => {
            state.collections.push(created)
          })
          return created
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to create collection'
          })
          throw error
        }
      },

      updateCollection: async (collectionId, updates) => {
        try {
          const updated = await researchService.updateCollection(collectionId, updates)
          set((state) => {
            const index = state.collections.findIndex((c) => c.id === collectionId)
            if (index !== -1) {
              state.collections[index] = updated
            }
          })
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to update collection'
          })
          throw error
        }
      },

      deleteCollection: async (collectionId) => {
        try {
          await researchService.deleteCollection(collectionId)
          set((state) => {
            state.collections = state.collections.filter((c) => c.id !== collectionId)
          })
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to delete collection'
          })
          throw error
        }
      },

      addPaperToCollection: async (paperId, collectionId) => {
        try {
          await researchService.addPaperToCollection(paperId, collectionId)
          // Refresh papers and collections
          await Promise.all([get().loadPapers(), get().loadCollections()])
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to add to collection'
          })
          throw error
        }
      },

      removePaperFromCollection: async (paperId, collectionId) => {
        try {
          await researchService.removePaperFromCollection(paperId, collectionId)
          // Refresh papers and collections
          await Promise.all([get().loadPapers(), get().loadCollections()])
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to remove from collection'
          })
          throw error
        }
      },

      processPaper: async (paperId) => {
        const paper = get().papers.find((p) => p.id === paperId)
        if (!paper) throw new Error('Paper not found')

        try {
          await researchService.processPaper(paperId, paper.pdfKey)
          await get().loadPapers()
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Processing failed'
          })
          throw error
        }
      },

      summarizePaper: async (paperId) => {
        // Check cache first
        const cached = get().paperSummaries.get(paperId)
        if (cached) return cached

        set((state) => {
          state.isLoading = true
        })

        try {
          const summary = await researchService.summarizePaper(paperId)

          set((state) => {
            state.paperSummaries.set(paperId, summary)
            state.isLoading = false
          })

          // Refresh paper to get updated summary
          await get().loadPapers()

          return summary
        } catch (error) {
          set((state) => {
            state.isLoading = false
            state.error = error instanceof Error ? error.message : 'Summarization failed'
          })
          throw error
        }
      },

      extractKeywords: async (paperId) => {
        try {
          return await researchService.extractKeywords(paperId)
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Keyword extraction failed'
          })
          throw error
        }
      },

      extractQuantumInsights: async (paperId) => {
        // Check cache first
        const cached = get().paperInsights.get(paperId)
        if (cached) return cached

        set((state) => {
          state.isLoading = true
        })

        try {
          const insights = await researchService.extractQuantumInsights(paperId)

          set((state) => {
            state.paperInsights.set(paperId, insights)
            state.isLoading = false
          })

          // Refresh paper to get updated insights
          await get().loadPapers()

          return insights
        } catch (error) {
          set((state) => {
            state.isLoading = false
            state.error = error instanceof Error ? error.message : 'Insight extraction failed'
          })
          throw error
        }
      },

      setActiveTab: (tab) => {
        set((state) => {
          state.activeTab = tab
        })
      },

      setError: (error) => {
        set((state) => {
          state.error = error
        })
      },

      reset: () => {
        set(() => ({
          ...initialState,
          paperSummaries: new Map(),
          paperInsights: new Map(),
        }))
      },
    })),
    {
      name: 'research-store',
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        searchFilters: state.searchFilters,
        activeTab: state.activeTab,
      }),
    }
  )
)

// Selectors
export const selectPapersByCollection = (collectionId: string) => (state: ResearchState) =>
  state.papers.filter((p) => p.collectionIds?.includes(collectionId))

export const selectUnreadPapers = (state: ResearchState) =>
  state.papers.filter((p) => p.readStatus === 'unread')

export const selectProcessedPapers = (state: ResearchState) =>
  state.papers.filter((p) => p.processingStatus === 'completed')

export const selectQuantumPapers = (state: ResearchState) =>
  state.papers.filter((p) => p.quantumAlgorithms && p.quantumAlgorithms.length > 0)

export const selectRecentPapers = (limit = 10) => (state: ResearchState) =>
  [...state.papers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
