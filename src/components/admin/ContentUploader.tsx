import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Folder,
  FolderOpen,
  FileText,
  File,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  file?: File
  contentType?: 'markdown' | 'json' | 'yaml' | 'image' | 'other'
  size?: number
  status?: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

interface ContentUploaderProps {
  onUpload: (files: File[], structure: FileNode[]) => Promise<void>
  acceptedTypes?: string[]
  uploadType: 'track' | 'module' | 'lesson' | 'any'
}

export function ContentUploader({ onUpload, acceptedTypes, uploadType }: ContentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [structure, setStructure] = useState<FileNode[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const getContentType = (fileName: string): FileNode['contentType'] => {
    if (fileName.endsWith('.md')) return 'markdown'
    if (fileName.endsWith('.json')) return 'json'
    if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) return 'yaml'
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(fileName)) return 'image'
    return 'other'
  }

  const buildStructure = (fileList: File[]): FileNode[] => {
    const root: Record<string, FileNode> = {}

    for (const file of fileList) {
      const pathParts = (file.webkitRelativePath || file.name).split('/')
      let current = root

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i]
        const isFile = i === pathParts.length - 1
        const fullPath = pathParts.slice(0, i + 1).join('/')

        if (!current[part]) {
          current[part] = {
            name: part,
            path: fullPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            file: isFile ? file : undefined,
            contentType: isFile ? getContentType(part) : undefined,
            size: isFile ? file.size : undefined,
            status: 'pending',
          }
        }

        if (!isFile) {
          const children: Record<string, FileNode> = {}
          for (const child of current[part].children || []) {
            children[child.name] = child
          }
          current = children
          current[part] = current[part] || { children: [] }
          const parentNode = Object.values(root).find(n => n.path === pathParts.slice(0, i + 1).join('/'))
          if (parentNode) {
            parentNode.children = Object.values(current)
          }
        }
      }
    }

    const sortNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        .map(node => ({
          ...node,
          children: node.children ? sortNodes(node.children) : undefined,
        }))
    }

    return sortNodes(Object.values(root))
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const items = e.dataTransfer.items
    const fileList: File[] = []

    const readDirectory = async (entry: FileSystemDirectoryEntry): Promise<void> => {
      const reader = entry.createReader()
      const entries = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(resolve)
      })

      for (const entry of entries) {
        if (entry.isFile) {
          const file = await new Promise<File>((resolve) => {
            (entry as FileSystemFileEntry).file(resolve)
          })
          Object.defineProperty(file, 'webkitRelativePath', {
            value: entry.fullPath.slice(1),
            writable: false,
          })
          fileList.push(file)
        } else if (entry.isDirectory) {
          await readDirectory(entry as FileSystemDirectoryEntry)
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry()
      if (entry) {
        if (entry.isDirectory) {
          await readDirectory(entry as FileSystemDirectoryEntry)
        } else {
          const file = items[i].getAsFile()
          if (file) fileList.push(file)
        }
      }
    }

    setFiles(fileList)
    setStructure(buildStructure(fileList))
    const firstLevel = new Set(fileList.map(f => f.webkitRelativePath?.split('/')[0] || f.name))
    setExpandedFolders(firstLevel)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || [])
    setFiles(fileList)
    setStructure(buildStructure(fileList))
    const firstLevel = new Set(fileList.map(f => f.webkitRelativePath?.split('/')[0] || f.name))
    setExpandedFolders(firstLevel)
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleUpload = async () => {
    setIsUploading(true)
    try {
      await onUpload(files, structure)
    } finally {
      setIsUploading(false)
    }
  }

  const clearFiles = () => {
    setFiles([])
    setStructure([])
    setExpandedFolders(new Set())
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path)
    const Icon = node.type === 'folder' 
      ? (isExpanded ? FolderOpen : Folder)
      : node.contentType === 'markdown' ? FileText : File

    const getStatusIcon = () => {
      switch (node.status) {
        case 'uploading':
          return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
        case 'success':
          return <CheckCircle className="w-4 h-4 text-green-400" />
        case 'error':
          return <XCircle className="w-4 h-4 text-red-400" />
        default:
          return null
      }
    }

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors ${
            depth === 0 ? '' : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => node.type === 'folder' && toggleFolder(node.path)}
        >
          {node.type === 'folder' && (
            <ChevronRight
              className={`w-4 h-4 text-slate-500 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          )}
          {node.type === 'file' && <div className="w-4" />}
          
          <Icon className={`w-4 h-4 ${
            node.type === 'folder' 
              ? 'text-yellow-400' 
              : node.contentType === 'markdown'
                ? 'text-cyan-400'
                : node.contentType === 'json'
                  ? 'text-green-400'
                  : 'text-slate-400'
          }`} />
          
          <span className="text-sm text-slate-300 flex-1 truncate">{node.name}</span>
          
          {node.size && (
            <span className="text-xs text-slate-500">{formatSize(node.size)}</span>
          )}
          
          {getStatusIcon()}
        </div>
        
        <AnimatePresence>
          {node.type === 'folder' && isExpanded && node.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {node.children.map(child => renderNode(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const getUploadTypeLabel = () => {
    switch (uploadType) {
      case 'track': return 'full learning track'
      case 'module': return 'module'
      case 'lesson': return 'lesson'
      default: return 'content'
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          isDragging
            ? 'border-cyan-500 bg-cyan-500/10'
            : 'border-white/[0.1] bg-white/[0.02] hover:border-white/[0.2]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept={acceptedTypes?.join(',')}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is a non-standard attribute
          webkitdirectory="true"
          onChange={handleFileSelect}
          className="hidden"
        />

        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-cyan-400' : 'text-slate-500'}`} />
        
        <h3 className="text-lg font-medium text-white mb-2">
          Drop your {getUploadTypeLabel()} folder here
        </h3>
        
        <p className="text-slate-400 mb-4">
          or click to browse files
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => folderInputRef.current?.click()}
          >
            <Folder className="w-4 h-4 mr-2" />
            Select Folder
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <FileText className="w-4 h-4 mr-2" />
            Select Files
          </Button>
        </div>

        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-cyan-500/10 rounded-2xl pointer-events-none">
            <div className="text-xl font-medium text-cyan-400">
              Drop to upload
            </div>
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-amber-200 font-medium mb-1">Expected folder structure:</p>
            <pre className="text-amber-300/70 text-xs font-mono">
{uploadType === 'track' ? `track-name/
├── meta.json        (track metadata)
├── module-1/
│   ├── meta.json    (module metadata)
│   ├── lesson-1/
│   │   ├── meta.json
│   │   ├── content.md
│   │   └── quiz.json (optional)
│   └── lesson-2/
│       └── ...
└── module-2/
    └── ...` 
: uploadType === 'module' ? `module-name/
├── meta.json        (module metadata)
├── lesson-1/
│   ├── meta.json
│   ├── content.md
│   └── quiz.json (optional)
└── lesson-2/
    └── ...`
: `lesson-name/
├── meta.json        (lesson metadata)
├── content.md       (lesson content)
└── quiz.json        (optional)`}
            </pre>
          </div>
        </div>
      </div>

      {structure.length > 0 && (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-yellow-400" />
              <span className="font-medium text-white">
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFiles}>
              Clear
            </Button>
          </div>
          
          <div className="max-h-80 overflow-y-auto p-2">
            {structure.map(node => renderNode(node))}
          </div>
          
          <div className="px-4 py-3 border-t border-white/[0.06] flex justify-end">
            <Button
              onClick={handleUpload}
              isLoading={isUploading}
              disabled={files.length === 0}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Content
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
