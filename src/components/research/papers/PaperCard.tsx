import { useState } from 'react'
import {
  FileText,
  Calendar,
  Users,
  Tag,
  Star,
  BookOpen,
  Trash2,
  MoreVertical,
  Download,
  Sparkles,
  Atom,
  FolderPlus,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { ResearchPaper, PaperCollection } from '@/types/research'
import { getPaperDownloadUrl } from '@/services/research'

interface PaperCardProps {
  paper: ResearchPaper
  collections?: PaperCollection[]
  onSelect?: (paper: ResearchPaper) => void
  onDelete?: (paperId: string) => void
  onSummarize?: (paperId: string) => void
  onExtractInsights?: (paperId: string) => void
  onAddToCollection?: (paperId: string, collectionId: string) => void
  onRatingChange?: (paperId: string, rating: number) => void
  onReadStatusChange?: (paperId: string, status: ResearchPaper['readStatus']) => void
  compact?: boolean
}

const READ_STATUS_COLORS = {
  unread: 'text-slate-400',
  reading: 'text-yellow-400',
  read: 'text-green-400',
}

export function PaperCard({
  paper,
  collections = [],
  onSelect,
  onDelete,
  onSummarize,
  onExtractInsights,
  onAddToCollection,
  onRatingChange,
  onReadStatusChange,
  compact = false,
}: PaperCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showCollections, setShowCollections] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const url = await getPaperDownloadUrl(paper.pdfKey)
      window.open(url, '_blank')
    } catch (error) {
      console.error('Failed to download paper:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  if (compact) {
    return (
      <div
        className="bg-neumorph-darker border border-white/5 rounded-lg p-3 hover:border-blue-500/30 transition-colors cursor-pointer"
        onClick={() => onSelect?.(paper)}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-white truncate">{paper.title}</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {paper.authors?.slice(0, 2).join(', ')}
              {paper.authors?.length > 2 && ` +${paper.authors.length - 2}`}
            </p>
          </div>
          {paper.quantumAlgorithms && paper.quantumAlgorithms.length > 0 && (
            <Atom className="w-4 h-4 text-purple-400" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4 hover:border-blue-500/30 transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h3
              className="text-white font-medium cursor-pointer hover:text-blue-400 transition-colors"
              onClick={() => onSelect?.(paper)}
            >
              {truncateText(paper.title, 100)}
            </h3>

            {paper.authors && paper.authors.length > 0 && (
              <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {paper.authors.slice(0, 3).join(', ')}
                {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
              </p>
            )}

            {paper.abstract && (
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                {paper.abstract}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {paper.processingStatus === 'pending' && (
                <Badge variant="warning" size="sm">Pending</Badge>
              )}
              {paper.processingStatus === 'processing' && (
                <Badge variant="info" size="sm">Processing</Badge>
              )}
              {paper.processingStatus === 'completed' && (
                <Badge variant="success" size="sm">Ready</Badge>
              )}
              {paper.processingStatus === 'failed' && (
                <Badge variant="danger" size="sm">Failed</Badge>
              )}

              {paper.quantumAlgorithms && paper.quantumAlgorithms.length > 0 && (
                <Badge variant="primary" size="sm">
                  <Atom className="w-3 h-3 mr-1" />
                  Quantum
                </Badge>
              )}

              {paper.keywords?.slice(0, 3).map((keyword) => (
                <Badge key={keyword} variant="secondary" size="sm">
                  <Tag className="w-3 h-3 mr-1" />
                  {keyword}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(paper.createdAt)}
              </span>
              {paper.pageCount && (
                <span>{paper.pageCount} pages</span>
              )}
              {paper.wordCount && (
                <span>{Math.round(paper.wordCount / 1000)}k words</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Rating */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRatingChange?.(paper.id, star)}
                className="p-0.5"
              >
                <Star
                  className={`w-4 h-4 ${
                    star <= (paper.rating || 0)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-slate-600'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Read status */}
          <button
            onClick={() => {
              const nextStatus = {
                unread: 'reading',
                reading: 'read',
                read: 'unread',
              } as const
              onReadStatusChange?.(paper.id, nextStatus[paper.readStatus || 'unread'])
            }}
            className={`flex items-center gap-1 text-xs ${READ_STATUS_COLORS[paper.readStatus || 'unread']}`}
          >
            <BookOpen className="w-3 h-3" />
            {paper.readStatus || 'unread'}
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-neumorph-dark border border-white/10 rounded-lg shadow-xl z-10">
                <button
                  onClick={() => {
                    handleDownload()
                    setShowMenu(false)
                  }}
                  disabled={isDownloading}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>

                {paper.processingStatus === 'completed' && (
                  <>
                    <button
                      onClick={() => {
                        onSummarize?.(paper.id)
                        setShowMenu(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Summary
                    </button>

                    <button
                      onClick={() => {
                        onExtractInsights?.(paper.id)
                        setShowMenu(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
                    >
                      <Atom className="w-4 h-4" />
                      Extract Insights
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setShowCollections(true)
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
                >
                  <FolderPlus className="w-4 h-4" />
                  Add to Collection
                </button>

                <hr className="border-white/5 my-1" />

                <button
                  onClick={() => {
                    onDelete?.(paper.id)
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Paper
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collection picker */}
      {showCollections && collections.length > 0 && (
        <div className="mt-3 p-3 bg-white/5 rounded-lg">
          <p className="text-xs text-slate-400 mb-2">Add to collection:</p>
          <div className="flex flex-wrap gap-2">
            {collections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => {
                  onAddToCollection?.(paper.id, collection.id)
                  setShowCollections(false)
                }}
                className="px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-slate-300"
                style={{ borderLeft: `3px solid ${collection.color}` }}
              >
                {collection.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCollections(false)}
            className="mt-2 text-xs text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
