import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Globe,
  Lock,
  Search,
  MoreHorizontal,
} from 'lucide-react'
import type { SavedCodeSnippet } from '@/services/codeSnippets'

interface FileExplorerProps {
  files: SavedCodeSnippet[]
  currentFileId: string | null
  onFileSelect: (file: SavedCodeSnippet) => void
  onFileDelete: (fileId: string, fileName: string) => void
  onNewFile: () => void
  onLoadExample: (code: string, name: string) => void
  examples: { name: string; code: string }[]
  isLoading?: boolean
  language: string
}

interface FolderSectionProps {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  count?: number
}

function FolderSection({ title, icon, defaultOpen = true, children, count }: FolderSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {icon}
        <span className="flex-1 text-left uppercase tracking-wider">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] text-slate-500">{count}</span>
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pl-2 mt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FileExplorer({
  files,
  currentFileId,
  onFileSelect,
  onFileDelete,
  onNewFile,
  onLoadExample,
  examples,
  isLoading,
  language,
}: FileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredFile, setHoveredFile] = useState<string | null>(null)

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getFileIcon = (lang: string) => {
    const colors: Record<string, string> = {
      qiskit: 'text-blue-400',
      cirq: 'text-yellow-400',
      pennylane: 'text-green-400',
      openqasm: 'text-purple-400',
    }
    return <FileCode className={`w-4 h-4 ${colors[lang] || 'text-slate-400'}`} />
  }

  const templates = [
    { name: 'VQE Circuit', code: `# VQE Ansatz Template\nfrom qiskit import QuantumCircuit\nfrom qiskit.circuit import Parameter\n\ntheta = Parameter('θ')\nqc = QuantumCircuit(2)\nqc.ry(theta, 0)\nqc.ry(theta, 1)\nqc.cx(0, 1)\nprint(qc)` },
    { name: 'QAOA Circuit', code: `# QAOA Template\nfrom qiskit import QuantumCircuit\nfrom qiskit.circuit import Parameter\n\ngamma = Parameter('γ')\nbeta = Parameter('β')\nqc = QuantumCircuit(3)\nqc.h([0, 1, 2])\nqc.rzz(gamma, 0, 1)\nqc.rzz(gamma, 1, 2)\nqc.rx(beta, [0, 1, 2])\nprint(qc)` },
    { name: 'QFT Circuit', code: `# Quantum Fourier Transform\nfrom qiskit import QuantumCircuit\nimport numpy as np\n\nn = 3\nqc = QuantumCircuit(n)\nfor i in range(n):\n    qc.h(i)\n    for j in range(i+1, n):\n        qc.cp(np.pi/2**(j-i), j, i)\nfor i in range(n//2):\n    qc.swap(i, n-i-1)\nprint(qc)` },
  ]

  return (
    <div className="h-full flex flex-col bg-slate-900/50 border-r border-white/5">
      <div className="p-2 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Explorer</span>
          <div className="flex-1" />
          <button
            onClick={onNewFile}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
            title="New File"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-800 border border-white/5 rounded text-white placeholder-slate-500 focus:outline-none focus:border-quantum-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <FolderSection
          title="My Files"
          icon={<Folder className="w-3.5 h-3.5 text-yellow-500" />}
          count={files.length}
        >
          {isLoading ? (
            <div className="text-xs text-slate-500 py-2 px-2">Loading...</div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-xs text-slate-500 py-2 px-2">
              {searchQuery ? 'No matches' : 'No saved files'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onMouseEnter={() => setHoveredFile(file.id)}
                  onMouseLeave={() => setHoveredFile(null)}
                  onClick={() => onFileSelect(file)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group transition-colors ${
                    currentFileId === file.id
                      ? 'bg-quantum-500/20 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  {getFileIcon(file.language)}
                  <span className="flex-1 text-xs truncate">{file.name}</span>
                  {file.isPublic ? (
                    <Globe className="w-3 h-3 text-green-500 opacity-50" />
                  ) : (
                    <Lock className="w-3 h-3 text-slate-500 opacity-50" />
                  )}
                  {hoveredFile === file.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onFileDelete(file.id, file.name)
                      }}
                      className="p-0.5 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </FolderSection>

        <FolderSection
          title="Examples"
          icon={<FolderOpen className="w-3.5 h-3.5 text-blue-400" />}
          count={examples.length}
          defaultOpen={files.length === 0}
        >
          <div className="space-y-0.5">
            {examples.map((example, idx) => (
              <div
                key={idx}
                onClick={() => onLoadExample(example.code, example.name)}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors"
              >
                {getFileIcon(language)}
                <span className="text-xs">{example.name}</span>
              </div>
            ))}
          </div>
        </FolderSection>

        <FolderSection
          title="Templates"
          icon={<FolderOpen className="w-3.5 h-3.5 text-purple-400" />}
          count={templates.length}
          defaultOpen={false}
        >
          <div className="space-y-0.5">
            {templates.map((template, idx) => (
              <div
                key={idx}
                onClick={() => onLoadExample(template.code, template.name)}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors"
              >
                <File className="w-4 h-4 text-purple-400" />
                <span className="text-xs">{template.name}</span>
              </div>
            ))}
          </div>
        </FolderSection>
      </div>
    </div>
  )
}

export default FileExplorer
