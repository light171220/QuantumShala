import { useState, useCallback } from 'react'
import { Search, X, Filter, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { SearchFilters } from '@/types/research'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  filters?: SearchFilters
  onFiltersChange?: (filters: SearchFilters) => void
  isSearching?: boolean
  showFilters?: boolean
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  filters = {},
  onFiltersChange,
  isSearching = false,
  showFilters = true,
}: SearchBarProps) {
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }, [onSearch])

  const handleClear = () => {
    onChange('')
  }

  const hasActiveFilters = Object.values(filters).some(v =>
    Array.isArray(v) ? v.length > 0 : v !== undefined
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search papers by title, authors, keywords, or content..."
            className="w-full pl-10 pr-10 py-3 bg-neumorph-darker border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {value && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <Button
          onClick={onSearch}
          disabled={isSearching || !value.trim()}
          className="px-6"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </Button>

        {showFilters && (
          <Button
            variant={hasActiveFilters ? 'primary' : 'secondary'}
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="px-3"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Filter panel */}
      {showFilterPanel && onFiltersChange && (
        <div className="bg-neumorph-darker border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </h4>
            {hasActiveFilters && (
              <button
                onClick={() => onFiltersChange({})}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tags filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Tags</label>
              <input
                type="text"
                value={filters.tags?.join(', ') || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                })}
                placeholder="quantum, vqe..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Authors filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Authors</label>
              <input
                type="text"
                value={filters.authors?.join(', ') || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  authors: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                })}
                placeholder="Smith, Johnson..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Quantum content filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Content Type</label>
              <select
                value={filters.hasQuantumContent === true ? 'quantum' : filters.hasQuantumContent === false ? 'non-quantum' : ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  hasQuantumContent: e.target.value === 'quantum' ? true : e.target.value === 'non-quantum' ? false : undefined,
                })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">All papers</option>
                <option value="quantum">Quantum papers only</option>
                <option value="non-quantum">Non-quantum papers</option>
              </select>
            </div>

            {/* Read status filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Read Status</label>
              <div className="flex gap-2">
                {(['unread', 'reading', 'read'] as const).map((status) => {
                  const isActive = filters.readStatus?.includes(status)
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        const current = filters.readStatus || []
                        const newStatus = isActive
                          ? current.filter(s => s !== status)
                          : [...current, status]
                        onFiltersChange({
                          ...filters,
                          readStatus: newStatus.length > 0 ? newStatus : undefined,
                        })
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg capitalize ${
                        isActive
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {status}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
