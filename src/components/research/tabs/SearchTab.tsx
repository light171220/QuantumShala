import { useState } from 'react'
import { Search, FileText, Sparkles, Clock, TrendingUp } from 'lucide-react'
import { SearchBar } from '../search/SearchBar'
import { PaperCard } from '../papers/PaperCard'
import { useResearchStore } from '@/stores/researchStore'

export function SearchTab() {
  const {
    searchQuery,
    searchFilters,
    searchResults,
    isSearching,
    collections,
    setSearchQuery,
    setSearchFilters,
    searchPapers,
    clearSearch,
    selectPaper,
    deletePaper,
    summarizePaper,
    extractQuantumInsights,
    addPaperToCollection,
    setPaperRating,
    setPaperReadStatus,
  } = useResearchStore()

  const [recentSearches] = useState<string[]>([
    'VQE optimization',
    'quantum error correction',
    'QAOA performance',
  ])

  const [popularTerms] = useState([
    'variational quantum',
    'ground state energy',
    'ansatz design',
    'qubit mapping',
    'noise mitigation',
  ])

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchPapers()
    }
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
            <Search className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Search Papers</h2>
            <p className="text-sm text-slate-400">
              Search using BM25 + TF-IDF hybrid algorithm
            </p>
          </div>
        </div>

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={handleSearch}
          filters={searchFilters}
          onFiltersChange={setSearchFilters}
          isSearching={isSearching}
        />
      </div>

      {/* Results or suggestions */}
      {searchResults.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-400" />
              Search Results ({searchResults.length})
            </h3>
            <button
              onClick={clearSearch}
              className="text-sm text-slate-400 hover:text-white"
            >
              Clear
            </button>
          </div>

          <div className="space-y-3">
            {searchResults.map((result) => (
              <div key={result.paper.id} className="relative">
                <PaperCard
                  paper={result.paper}
                  collections={collections}
                  onSelect={selectPaper}
                  onDelete={deletePaper}
                  onSummarize={summarizePaper}
                  onExtractInsights={extractQuantumInsights}
                  onAddToCollection={addPaperToCollection}
                  onRatingChange={setPaperRating}
                  onReadStatusChange={setPaperReadStatus}
                />
                {/* Score badge */}
                <div className="absolute top-4 right-16 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                  Score: {result.score.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : searchQuery && !isSearching ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-white font-medium mb-1">No results found</h3>
          <p className="text-sm text-slate-400">
            Try different keywords or adjust your filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent searches */}
          <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
            <h3 className="text-white font-medium flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-400" />
              Recent Searches
            </h3>
            <div className="space-y-2">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchQuery(term)
                    searchPapers(term)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Search className="w-3 h-3 inline mr-2 text-slate-500" />
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Popular terms */}
          <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
            <h3 className="text-white font-medium flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              Popular Search Terms
            </h3>
            <div className="flex flex-wrap gap-2">
              {popularTerms.map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchQuery(term)
                    searchPapers(term)
                  }}
                  className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Search tips */}
          <div className="md:col-span-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
            <h3 className="text-white font-medium flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-green-400" />
              Search Tips
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                Use specific keywords for better results
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                Search by author names to find their papers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                Use quantum-specific terms like "VQE", "QAOA", "ansatz"
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                Filter by read status to find unread papers
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
