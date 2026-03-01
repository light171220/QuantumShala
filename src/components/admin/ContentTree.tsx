import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Edit,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ContentTrack, ContentModule, ContentLesson } from '@/services/admin'

interface ContentTreeProps {
  tracks: ContentTrack[]
  modules: Record<string, ContentModule[]>
  lessons: Record<string, ContentLesson[]>
  selectedId?: string
  selectedType?: 'track' | 'module' | 'lesson'
  onSelect: (id: string, type: 'track' | 'module' | 'lesson') => void
  onAddTrack: () => void
  onAddModule: (trackId: string) => void
  onAddLesson: (moduleId: string) => void
  onDelete: (id: string, type: 'track' | 'module' | 'lesson') => void
  onDuplicate: (id: string, type: 'track' | 'module' | 'lesson') => void
  onTogglePublish: (id: string, type: 'track' | 'module' | 'lesson', isPublished: boolean) => void
  isLoading?: boolean
}

export function ContentTree({
  tracks,
  modules,
  lessons,
  selectedId,
  selectedType,
  onSelect,
  onAddTrack,
  onAddModule,
  onAddLesson,
  onDelete,
  onDuplicate,
  onTogglePublish,
  isLoading,
}: ContentTreeProps) {
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{
    id: string
    type: 'track' | 'module' | 'lesson'
    x: number
    y: number
  } | null>(null)

  const toggleTrack = (trackId: string) => {
    setExpandedTracks(prev => {
      const next = new Set(prev)
      if (next.has(trackId)) {
        next.delete(trackId)
      } else {
        next.add(trackId)
      }
      return next
    })
  }

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
      }
      return next
    })
  }

  const handleContextMenu = (e: React.MouseEvent, id: string, type: 'track' | 'module' | 'lesson') => {
    e.preventDefault()
    setContextMenu({ id, type, x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="mb-4">
        <Button size="sm" onClick={onAddTrack} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Track
        </Button>
      </div>

      <div className="space-y-1">
        {tracks.map(track => {
          const isTrackExpanded = expandedTracks.has(track.id)
          const trackModules = modules[track.id] || []

          return (
            <div key={track.id}>
              <div
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  selectedId === track.id && selectedType === 'track'
                    ? 'bg-cyan-500/20 text-white'
                    : 'hover:bg-white/[0.03] text-slate-300'
                }`}
                onClick={() => onSelect(track.id, 'track')}
                onContextMenu={(e) => handleContextMenu(e, track.id, 'track')}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleTrack(track.id)
                  }}
                  className="p-0.5 hover:bg-white/[0.05] rounded"
                >
                  {isTrackExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {isTrackExpanded ? (
                  <FolderOpen className="w-4 h-4 text-yellow-400" />
                ) : (
                  <Folder className="w-4 h-4 text-yellow-400" />
                )}

                <span className="flex-1 text-sm truncate">{track.name}</span>

                {!track.isPublished && (
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                )}

                <span className="text-xs text-slate-500">{track.modulesCount}</span>
              </div>

              <AnimatePresence>
                {isTrackExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-4 border-l border-white/[0.06] pl-2"
                  >
                    {trackModules.map(module => {
                      const isModuleExpanded = expandedModules.has(module.id)
                      const moduleLessons = lessons[module.id] || []

                      return (
                        <div key={module.id}>
                          <div
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                              selectedId === module.id && selectedType === 'module'
                                ? 'bg-cyan-500/20 text-white'
                                : 'hover:bg-white/[0.03] text-slate-300'
                            }`}
                            onClick={() => onSelect(module.id, 'module')}
                            onContextMenu={(e) => handleContextMenu(e, module.id, 'module')}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleModule(module.id)
                              }}
                              className="p-0.5 hover:bg-white/[0.05] rounded"
                            >
                              {isModuleExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>

                            {isModuleExpanded ? (
                              <FolderOpen className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Folder className="w-4 h-4 text-blue-400" />
                            )}

                            <span className="flex-1 text-sm truncate">{module.name}</span>

                            {!module.isPublished && (
                              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            )}

                            <span className="text-xs text-slate-500">{module.lessonsCount}</span>
                          </div>

                          <AnimatePresence>
                            {isModuleExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="ml-4 border-l border-white/[0.06] pl-2"
                              >
                                {moduleLessons.map(lesson => (
                                  <div
                                    key={lesson.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                      selectedId === lesson.id && selectedType === 'lesson'
                                        ? 'bg-cyan-500/20 text-white'
                                        : 'hover:bg-white/[0.03] text-slate-300'
                                    }`}
                                    onClick={() => onSelect(lesson.id, 'lesson')}
                                    onContextMenu={(e) => handleContextMenu(e, lesson.id, 'lesson')}
                                  >
                                    <div className="w-4" />
                                    <FileText className="w-4 h-4 text-cyan-400" />
                                    <span className="flex-1 text-sm truncate">{lesson.name}</span>

                                    {!lesson.isPublished && (
                                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                                    )}

                                    {lesson.hasQuiz && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                        Q
                                      </span>
                                    )}
                                  </div>
                                ))}

                                <button
                                  onClick={() => onAddLesson(module.id)}
                                  className="flex items-center gap-2 px-2 py-1.5 w-full text-left text-slate-500 hover:text-cyan-400 transition-colors"
                                >
                                  <div className="w-4" />
                                  <Plus className="w-4 h-4" />
                                  <span className="text-sm">Add Lesson</span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}

                    <button
                      onClick={() => onAddModule(track.id)}
                      className="flex items-center gap-2 px-2 py-1.5 w-full text-left text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                      <div className="w-4" />
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">Add Module</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {tracks.length === 0 && (
        <div className="text-center py-8">
          <Folder className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-4">No content yet</p>
          <Button size="sm" onClick={onAddTrack}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Track
          </Button>
        </div>
      )}

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 bg-neumorph-base shadow-neumorph-md border border-white/[0.02] rounded-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                onSelect(contextMenu.id, contextMenu.type)
                setContextMenu(null)
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>

            <button
              onClick={() => {
                onDuplicate(contextMenu.id, contextMenu.type)
                setContextMenu(null)
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] transition-colors"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>

            <button
              onClick={() => {
                onTogglePublish(contextMenu.id, contextMenu.type, true)
                setContextMenu(null)
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] transition-colors"
            >
              <Eye className="w-4 h-4" />
              Publish
            </button>

            <div className="border-t border-white/[0.06] my-1" />

            <button
              onClick={() => {
                onDelete(contextMenu.id, contextMenu.type)
                setContextMenu(null)
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
