import { useCallback, useState, useRef } from 'react'
import { Upload, FileText, X, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { UploadProgress } from '@/types/research'

interface DropZoneProps {
  onUpload: (file: File, metadata?: { title?: string; tags?: string[] }) => Promise<void>
  uploadProgress?: UploadProgress | null
  isUploading?: boolean
  maxSize?: number
}

export function DropZone({
  onUpload,
  uploadProgress,
  isUploading = false,
  maxSize = 50 * 1024 * 1024, // 50MB
}: DropZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return 'Only PDF files are accepted'
    }
    if (file.size > maxSize) {
      return `File is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`
    }
    return null
  }, [maxSize])

  const handleFile = useCallback((file: File) => {
    setError(null)
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setSelectedFile(file)
    setTitle(file.name.replace(/\.pdf$/i, ''))
  }, [validateFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)

    if (isUploading) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [isUploading, handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!isUploading) {
      setIsDragActive(true)
    }
  }, [isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
    // Reset input so the same file can be selected again
    e.target.value = ''
  }, [handleFile])

  const handleClick = useCallback(() => {
    if (!isUploading) {
      inputRef.current?.click()
    }
  }, [isUploading])

  const handleUpload = async () => {
    if (!selectedFile) return

    setError(null)
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)

    try {
      await onUpload(selectedFile, { title: title || undefined, tags: tagList })
      setSelectedFile(null)
      setTitle('')
      setTags('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setTitle('')
    setTags('')
    setError(null)
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isUploading}
      />

      {/* Drop zone */}
      {!selectedFile && (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${isDragActive
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            }
            ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <Upload className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-medium">
                {isDragActive ? 'Drop your PDF here' : 'Drag & drop a PDF here'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                or click to browse files (max {Math.round(maxSize / 1024 / 1024)}MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected file preview */}
      {selectedFile && !isUploading && (
        <div className="bg-neumorph-darker border border-white/10 rounded-xl p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-white font-medium truncate">{selectedFile.name}</p>
                <button
                  onClick={clearSelection}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-400">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Paper Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Enter paper title"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="quantum, vqe, chemistry"
                  />
                </div>
              </div>

              <Button
                onClick={handleUpload}
                className="mt-4 w-full"
                leftIcon={<Upload className="w-4 h-4" />}
              >
                Upload Paper
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && uploadProgress && (
        <div className="bg-neumorph-darker border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <div className="flex-1">
              <p className="text-white text-sm">{uploadProgress.message}</p>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${uploadProgress.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
