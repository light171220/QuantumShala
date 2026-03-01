import { useState, useEffect, useCallback } from 'react'
import {
  Save,
  Eye,
  Edit3,
  Bold,
  Italic,
  Code,
  Link,
  Image,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  CheckSquare,
  Table,
  FileCode,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ContentEditorProps {
  initialContent?: string
  initialMetadata?: LessonMetadata
  onSave: (content: string, metadata: LessonMetadata) => Promise<void>
  type: 'lesson' | 'module' | 'track'
}

interface LessonMetadata {
  name: string
  slug: string
  description: string
  estimatedMinutes?: number
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  hasQuiz?: boolean
  hasExercise?: boolean
  order?: number
  isPublished?: boolean
}

export function ContentEditor({ initialContent = '', initialMetadata, onSave, type }: ContentEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [metadata, setMetadata] = useState<LessonMetadata>(initialMetadata || {
    name: '',
    slug: '',
    description: '',
    estimatedMinutes: 10,
    difficulty: 'beginner',
    hasQuiz: false,
    hasExercise: false,
    order: 0,
    isPublished: false,
  })
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (initialContent) setContent(initialContent)
  }, [initialContent])

  useEffect(() => {
    if (initialMetadata) setMetadata(initialMetadata)
  }, [initialMetadata])

  const insertText = useCallback((before: string, after: string = '', placeholder: string = '') => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end) || placeholder

    const newContent = 
      content.substring(0, start) + 
      before + 
      selectedText + 
      after + 
      content.substring(end)

    setContent(newContent)
    setIsDirty(true)

    setTimeout(() => {
      textarea.focus()
      const newPos = start + before.length + selectedText.length
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }, [content])

  const toolbarButtons = [
    { icon: Bold, action: () => insertText('**', '**', 'bold'), title: 'Bold' },
    { icon: Italic, action: () => insertText('*', '*', 'italic'), title: 'Italic' },
    { icon: Code, action: () => insertText('`', '`', 'code'), title: 'Inline Code' },
    { icon: Link, action: () => insertText('[', '](url)', 'link text'), title: 'Link' },
    { icon: Image, action: () => insertText('![alt](', ')', 'image-url'), title: 'Image' },
    { divider: true },
    { icon: Heading1, action: () => insertText('\n# ', '\n', 'Heading 1'), title: 'Heading 1' },
    { icon: Heading2, action: () => insertText('\n## ', '\n', 'Heading 2'), title: 'Heading 2' },
    { icon: Heading3, action: () => insertText('\n### ', '\n', 'Heading 3'), title: 'Heading 3' },
    { divider: true },
    { icon: List, action: () => insertText('\n- ', '\n'), title: 'Bullet List' },
    { icon: ListOrdered, action: () => insertText('\n1. ', '\n'), title: 'Numbered List' },
    { icon: CheckSquare, action: () => insertText('\n- [ ] ', '\n', 'task'), title: 'Task List' },
    { icon: Quote, action: () => insertText('\n> ', '\n', 'quote'), title: 'Quote' },
    { divider: true },
    { icon: FileCode, action: () => insertText('\n```python\n', '\n```\n', '# code here'), title: 'Code Block' },
    { icon: Table, action: () => insertText('\n| Header | Header |\n|--------|--------|\n| Cell | Cell |\n', ''), title: 'Table' },
    { icon: Minus, action: () => insertText('\n---\n', ''), title: 'Horizontal Rule' },
  ]

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(content, metadata)
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleMetadataChange = (field: keyof LessonMetadata, value: unknown) => {
    setMetadata(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }

  const renderPreview = (md: string) => {
    const html = md
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] px-1.5 py-0.5 rounded text-cyan-400">$1</code>')
      .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold text-white mt-6 mb-3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-white mt-8 mb-4">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-white mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-cyan-400 hover:underline">$1</a>')
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$2</li>')
      .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-cyan-500 pl-4 italic text-slate-400 my-4">$1</blockquote>')
      .replace(/^---$/gm, '<hr class="border-white/10 my-8" />')
      .replace(/\n\n/g, '</p><p class="text-slate-300 my-4">')

    return `<div class="prose prose-invert max-w-none"><p class="text-slate-300 my-4">${html}</p></div>`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/[0.06] space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Name"
            value={metadata.name}
            onChange={(e) => {
              handleMetadataChange('name', e.target.value)
              if (!metadata.slug || metadata.slug === generateSlug(metadata.name)) {
                handleMetadataChange('slug', generateSlug(e.target.value))
              }
            }}
            placeholder={`${type} name`}
          />
          <Input
            label="Slug"
            value={metadata.slug}
            onChange={(e) => handleMetadataChange('slug', e.target.value)}
            placeholder="url-friendly-name"
          />
        </div>

        <Input
          label="Description"
          value={metadata.description}
          onChange={(e) => handleMetadataChange('description', e.target.value)}
          placeholder={`Brief description of the ${type}`}
        />

        {type === 'lesson' && (
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Est. Minutes
              </label>
              <input
                type="number"
                value={metadata.estimatedMinutes || 10}
                onChange={(e) => handleMetadataChange('estimatedMinutes', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Difficulty
              </label>
              <select
                value={metadata.difficulty}
                onChange={(e) => handleMetadataChange('difficulty', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Order
              </label>
              <input
                type="number"
                value={metadata.order || 0}
                onChange={(e) => handleMetadataChange('order', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white"
              />
            </div>

            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metadata.hasQuiz}
                  onChange={(e) => handleMetadataChange('hasQuiz', e.target.checked)}
                  className="rounded border-white/20 bg-white/[0.03]"
                />
                <span className="text-sm text-slate-300">Has Quiz</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metadata.isPublished}
                  onChange={(e) => handleMetadataChange('isPublished', e.target.checked)}
                  className="rounded border-white/20 bg-white/[0.03]"
                />
                <span className="text-sm text-slate-300">Published</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {type === 'lesson' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-1">
              {toolbarButtons.map((btn, i) => 
                btn.divider ? (
                  <div key={i} className="w-px h-6 bg-white/10 mx-1" />
                ) : (
                  <button
                    key={i}
                    onClick={btn.action}
                    title={btn.title}
                    className="p-1.5 rounded hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
                  >
                    {btn.icon && <btn.icon className="w-4 h-4" />}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'edit'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-4 h-4 inline mr-1.5" />
                Edit
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-1.5" />
                Preview
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'edit' ? (
              <textarea
                id="content-editor"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  setIsDirty(true)
                }}
                placeholder="Write your lesson content in Markdown..."
                className="w-full h-full p-4 bg-transparent text-slate-300 resize-none focus:outline-none font-mono text-sm"
                spellCheck={false}
              />
            ) : (
              <div 
                className="h-full overflow-y-auto p-4"
                dangerouslySetInnerHTML={{ __html: renderPreview(content) }}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
        <div className="text-sm text-slate-500">
          {isDirty && (
            <span className="text-amber-400">● Unsaved changes</span>
          )}
        </div>

        <Button onClick={handleSave} isLoading={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          Save {type}
        </Button>
      </div>
    </div>
  )
}
