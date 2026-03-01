// @ts-nocheck
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Upload,
  Plus,
  FileText,
  Folder,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { ContentUploader } from '@/components/admin/ContentUploader'
import { ContentTree } from '@/components/admin/ContentTree'
import { ContentEditor } from '@/components/admin/ContentEditor'
import {
  getAllTracks,
  getModulesByTrack,
  getLessonsByModule,
  getLessonById,
  createTrack,
  createModule,
  createLesson,
  updateTrack,
  updateModule,
  updateLesson,
  deleteTrack,
  deleteModule,
  deleteLesson,
  importContent,
  parseContentStructure,
  type ContentTrack,
  type ContentModule,
  type ContentLesson,
} from '@/services/admin'

type ContentType = 'track' | 'module' | 'lesson'

interface ImportStatus {
  isImporting: boolean
  progress: number
  total: number
  currentItem: string
  errors: string[]
  success: boolean
}

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState<'browse' | 'upload'>('browse')
  const [tracks, setTracks] = useState<ContentTrack[]>([])
  const [modules, setModules] = useState<Record<string, ContentModule[]>>({})
  const [lessons, setLessons] = useState<Record<string, ContentLesson[]>>({})
  const [selectedId, setSelectedId] = useState<string>()
  const [selectedType, setSelectedType] = useState<ContentType>()
  const [selectedContent, setSelectedContent] = useState<ContentTrack | ContentModule | ContentLesson | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    isImporting: false,
    progress: 0,
    total: 0,
    currentItem: '',
    errors: [],
    success: false,
  })
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    loadTracks()
  }, [])

  useEffect(() => {
    if (selectedId && selectedType) {
      loadSelectedContent()
    }
  }, [selectedId, selectedType])

  const loadTracks = async () => {
    setIsLoading(true)
    try {
      const tracksData = await getAllTracks()
      setTracks(tracksData.sort((a, b) => a.order - b.order))

      const modulesMap: Record<string, ContentModule[]> = {}
      const lessonsMap: Record<string, ContentLesson[]> = {}

      for (const track of tracksData) {
        const trackModules = await getModulesByTrack(track.id)
        modulesMap[track.id] = trackModules

        for (const module of trackModules) {
          const moduleLessons = await getLessonsByModule(module.id)
          lessonsMap[module.id] = moduleLessons
        }
      }

      setModules(modulesMap)
      setLessons(lessonsMap)
    } catch (error) {
      console.error('Failed to load content:', error)
      showNotification('error', 'Failed to load content')
    } finally {
      setIsLoading(false)
    }
  }

  const loadSelectedContent = async () => {
    if (!selectedId || !selectedType) return

    try {
      switch (selectedType) {
        case 'track': {
          const track = tracks.find(t => t.id === selectedId)
          setSelectedContent(track || null)
          break
        }
        case 'module': {
          for (const trackModules of Object.values(modules)) {
            const module = trackModules.find(m => m.id === selectedId)
            if (module) {
              setSelectedContent(module)
              break
            }
          }
          break
        }
        case 'lesson': {
          const lesson = await getLessonById(selectedId)
          setSelectedContent(lesson)
          break
        }
      }
    } catch (error) {
      console.error('Failed to load content:', error)
    }
  }

  const handleSelect = (id: string, type: ContentType) => {
    setSelectedId(id)
    setSelectedType(type)
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleAddTrack = async () => {
    try {
      const id = await createTrack({
        name: 'New Track',
        slug: `new-track-${Date.now()}`,
        description: '',
        icon: '',
        color: 'cyan',
        difficulty: 'beginner',
        estimatedHours: 0,
        modulesCount: 0,
        lessonsCount: 0,
        isPublished: false,
        order: tracks.length,
      })

      if (id) {
        await loadTracks()
        setSelectedId(id)
        setSelectedType('track')
        showNotification('success', 'Track created')
      }
    } catch (error) {
      showNotification('error', 'Failed to create track')
    }
  }

  const handleAddModule = async (trackId: string) => {
    try {
      const trackModules = modules[trackId] || []
      const id = await createModule({
        trackId,
        name: 'New Module',
        slug: `new-module-${Date.now()}`,
        description: '',
        order: trackModules.length,
        lessonsCount: 0,
        isPublished: false,
      })

      if (id) {
        await loadTracks()
        setSelectedId(id)
        setSelectedType('module')
        showNotification('success', 'Module created')
      }
    } catch (error) {
      showNotification('error', 'Failed to create module')
    }
  }

  const handleAddLesson = async (moduleId: string) => {
    try {
      let trackId = ''
      for (const [tId, mods] of Object.entries(modules)) {
        if (mods.some(m => m.id === moduleId)) {
          trackId = tId
          break
        }
      }

      const moduleLessons = lessons[moduleId] || []
      const id = await createLesson({
        moduleId,
        trackId,
        name: 'New Lesson',
        slug: `new-lesson-${Date.now()}`,
        description: '',
        content: '# New Lesson\n\nStart writing your content here...',
        order: moduleLessons.length,
        estimatedMinutes: 10,
        difficulty: 'beginner',
        hasQuiz: false,
        hasExercise: false,
        isPublished: false,
      })

      if (id) {
        await loadTracks()
        setSelectedId(id)
        setSelectedType('lesson')
        showNotification('success', 'Lesson created')
      }
    } catch (error) {
      showNotification('error', 'Failed to create lesson')
    }
  }

  const handleDelete = async (id: string, type: ContentType) => {
    if (!confirm(`Are you sure you want to delete this ${type}? This cannot be undone.`)) {
      return
    }

    try {
      switch (type) {
        case 'track':
          await deleteTrack(id)
          break
        case 'module':
          await deleteModule(id)
          break
        case 'lesson':
          await deleteLesson(id)
          break
      }

      await loadTracks()
      if (selectedId === id) {
        setSelectedId(undefined)
        setSelectedType(undefined)
        setSelectedContent(null)
      }
      showNotification('success', `${type} deleted`)
    } catch (error) {
      showNotification('error', `Failed to delete ${type}`)
    }
  }

  const handleDuplicate = async (_id: string, _type: ContentType) => {
    showNotification('error', 'Duplicate not implemented yet')
  }

  const handleTogglePublish = async (id: string, type: ContentType, isPublished: boolean) => {
    try {
      switch (type) {
        case 'track':
          await updateTrack(id, { isPublished })
          break
        case 'module':
          await updateModule(id, { isPublished })
          break
        case 'lesson':
          await updateLesson(id, { isPublished })
          break
      }

      await loadTracks()
      showNotification('success', `${type} ${isPublished ? 'published' : 'unpublished'}`)
    } catch (error) {
      showNotification('error', `Failed to update ${type}`)
    }
  }

  const handleSaveContent = async (content: string, metadata: Record<string, unknown>) => {
    if (!selectedId || !selectedType) return

    try {
      switch (selectedType) {
        case 'track':
          await updateTrack(selectedId, metadata)
          break
        case 'module':
          await updateModule(selectedId, metadata)
          break
        case 'lesson':
          await updateLesson(selectedId, { ...metadata, content })
          break
      }

      await loadTracks()
      showNotification('success', 'Content saved')
    } catch (error) {
      showNotification('error', 'Failed to save content')
    }
  }

  const handleUpload = async (files: File[], _structure: unknown[]) => {
    setImportStatus({
      isImporting: true,
      progress: 0,
      total: files.length,
      currentItem: 'Preparing...',
      errors: [],
      success: false,
    })

    try {
      const fileContents: Record<string, string> = {}
      for (const file of files) {
        const text = await file.text()
        const path = file.webkitRelativePath || file.name
        fileContents[path] = text
      }

      const parsed = parseContentStructure(files)

      interface ParsedNode {
        path: string
        files: { name: string; content: string }[]
        children?: ParsedNode[]
      }
      const addContent = (nodes: ParsedNode[]) => {
        for (const node of nodes) {
          for (const file of node.files) {
            const fullPath = `${node.path}/${file.name}`
            file.content = fileContents[fullPath] || ''
          }
          if (node.children) {
            addContent(node.children)
          }
        }
      }
      addContent(parsed as ParsedNode[])

      let imported = 0
      const errors: string[] = []

      for (const item of parsed) {
        setImportStatus(prev => ({
          ...prev,
          currentItem: item.name,
          progress: imported,
        }))

        const result = await importContent(item)
        if (!result.success) {
          errors.push(...result.errors)
        }
        imported++
      }

      setImportStatus({
        isImporting: false,
        progress: imported,
        total: parsed.length,
        currentItem: '',
        errors,
        success: errors.length === 0,
      })

      if (errors.length === 0) {
        showNotification('success', 'Content imported successfully')
        await loadTracks()
        setActiveTab('browse')
      } else {
        showNotification('error', `Import completed with ${errors.length} errors`)
      }
    } catch (error) {
      setImportStatus(prev => ({
        ...prev,
        isImporting: false,
        errors: [`Import failed: ${error}`],
        success: false,
      }))
      showNotification('error', 'Import failed')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06]">
        <Link to="/admin" className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Content Management</h1>
          <p className="text-sm text-slate-400">
            {tracks.length} tracks - {Object.values(modules).flat().length} modules - {Object.values(lessons).flat().length} lessons
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'browse' | 'upload')}>
          <TabsList>
            <TabsTrigger value="browse">
              <Folder className="w-4 h-4 mr-2" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${
              notification.type === 'success'
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'bg-red-500/20 border border-red-500/30 text-red-400'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'browse' ? (
          <>
            <aside className="w-80 border-r border-white/[0.06] p-4 overflow-y-auto">
              <ContentTree
                tracks={tracks}
                modules={modules}
                lessons={lessons}
                selectedId={selectedId}
                selectedType={selectedType}
                onSelect={handleSelect}
                onAddTrack={handleAddTrack}
                onAddModule={handleAddModule}
                onAddLesson={handleAddLesson}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onTogglePublish={handleTogglePublish}
                isLoading={isLoading}
              />
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden">
              {selectedContent && selectedType ? (
                <ContentEditor
                  key={selectedId}
                  type={selectedType}
                  initialContent={selectedType === 'lesson' ? (selectedContent as ContentLesson).content : undefined}
                  initialMetadata={{
                    name: selectedContent.name,
                    slug: selectedContent.slug,
                    description: selectedContent.description || '',
                    estimatedMinutes: selectedType === 'lesson' ? (selectedContent as ContentLesson).estimatedMinutes : undefined,
                    difficulty: selectedType === 'lesson' ? (selectedContent as ContentLesson).difficulty : undefined,
                    hasQuiz: selectedType === 'lesson' ? (selectedContent as ContentLesson).hasQuiz : undefined,
                    hasExercise: selectedType === 'lesson' ? (selectedContent as ContentLesson).hasExercise : undefined,
                    order: selectedContent.order,
                    isPublished: selectedContent.isPublished,
                  }}
                  onSave={handleSaveContent}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div>
                    <FileText className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-white mb-2">No Content Selected</h3>
                    <p className="text-slate-400 mb-6 max-w-md">
                      Select a track, module, or lesson from the sidebar to edit, or create new content.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <Button variant="neumorph" onClick={handleAddTrack}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Track
                      </Button>
                      <Button variant="neumorph-secondary" onClick={() => setActiveTab('upload')}>
                        <Upload className="w-4 h-4 mr-2" />
                        Import Content
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </>
        ) : (
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Import Content</h2>
                <p className="text-slate-400">
                  Upload a folder containing your learning content. The folder structure should follow our format guidelines.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { type: 'track', label: 'Full Track', desc: 'Complete track with modules and lessons' },
                  { type: 'module', label: 'Single Module', desc: 'Add module to existing track' },
                  { type: 'lesson', label: 'Single Lesson', desc: 'Add lesson to existing module' },
                ].map(option => (
                  <Card
                    key={option.type}
                    variant="neumorph"
                    className="p-4 cursor-pointer hover:border-cyan-500/50 transition-colors"
                  >
                    <h3 className="font-medium text-white mb-1">{option.label}</h3>
                    <p className="text-sm text-slate-400">{option.desc}</p>
                  </Card>
                ))}
              </div>

              <ContentUploader
                uploadType="track"
                onUpload={handleUpload}
              />

              {importStatus.isImporting && (
                <Card variant="neumorph" className="mt-6 p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    <div className="flex-1">
                      <div className="font-medium text-white">Importing content...</div>
                      <div className="text-sm text-slate-400">{importStatus.currentItem}</div>
                    </div>
                    <span className="text-sm text-slate-400">
                      {importStatus.progress} / {importStatus.total}
                    </span>
                  </div>
                  <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all"
                      style={{ width: `${(importStatus.progress / importStatus.total) * 100}%` }}
                    />
                  </div>
                </Card>
              )}

              {importStatus.errors.length > 0 && (
                <Card variant="neumorph" className="mt-6 p-6 border-red-500/30">
                  <h4 className="font-medium text-red-400 mb-3">Import Errors</h4>
                  <ul className="space-y-2">
                    {importStatus.errors.map((error, i) => (
                      <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
