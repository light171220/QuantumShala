import { useState } from 'react'
import {
  Library,
  Upload,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Filter,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PaperCard } from '../papers/PaperCard'
import { DropZone } from '../upload/DropZone'
import { useResearchStore } from '@/stores/researchStore'
import type { ResearchPaper } from '@/types/research'

type SortField = 'title' | 'date' | 'rating'
type ViewMode = 'grid' | 'list'

export function LibraryTab() {
  const {
    papers,
    collections,
    isLoading,
    isUploading,
    uploadProgress,
    uploadPaper,
    deletePaper,
    summarizePaper,
    extractQuantumInsights,
    addPaperToCollection,
    setPaperRating,
    setPaperReadStatus,
    selectPaper,
    loadPapers,
  } = useResearchStore()

  const [showUpload, setShowUpload] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const handleUpload = async (file: File, metadata?: { title?: string; tags?: string[] }) => {
    await uploadPaper({
      file,
      title: metadata?.title,
      tags: metadata?.tags,
    })
    setShowUpload(false)
  }

  const sortedPapers = [...papers]
    .filter(p => !filterStatus || p.processingStatus === filterStatus)
    .sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Library className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Paper Library</h2>
            <p className="text-sm text-slate-400">
              {papers.length} paper{papers.length !== 1 ? 's' : ''} in your collection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadPapers()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            onClick={() => setShowUpload(!showUpload)}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload Paper
          </Button>
        </div>
      </div>

      {/* Upload zone */}
      {showUpload && (
        <DropZone
          onUpload={handleUpload}
          uploadProgress={uploadProgress}
          isUploading={isUploading}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View mode */}
        <div className="flex items-center bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Sort by:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="date">Date</option>
            <option value="title">Title</option>
            <option value="rating">Rating</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
          >
            {sortOrder === 'asc' ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Papers */}
      {sortedPapers.length === 0 ? (
        <div className="text-center py-12">
          <Library className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-white font-medium mb-1">No papers yet</h3>
          <p className="text-sm text-slate-400 mb-4">
            Upload your first research paper to get started
          </p>
          <Button
            onClick={() => setShowUpload(true)}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Upload Paper
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              collections={collections}
              onSelect={selectPaper}
              onDelete={deletePaper}
              onSummarize={summarizePaper}
              onExtractInsights={extractQuantumInsights}
              onAddToCollection={addPaperToCollection}
              onRatingChange={setPaperRating}
              onReadStatusChange={setPaperReadStatus}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              collections={collections}
              onSelect={selectPaper}
              onDelete={deletePaper}
              onSummarize={summarizePaper}
              onExtractInsights={extractQuantumInsights}
              onAddToCollection={addPaperToCollection}
              onRatingChange={setPaperRating}
              onReadStatusChange={setPaperReadStatus}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}
