import { useState, useRef } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import { Play, RotateCcw, Copy, Check, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/utils/cn'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language?: 'python' | 'qiskit' | 'cirq' | 'pennylane' | 'javascript' | 'typescript'
  height?: string | number
  readOnly?: boolean
  showLineNumbers?: boolean
  onRun?: () => void
  onReset?: () => void
  isRunning?: boolean
  output?: string
  error?: string
  className?: string
  showToolbar?: boolean
  placeholder?: string
}

export default function CodeEditor({
  value,
  onChange,
  language = 'python',
  height = '300px',
  readOnly = false,
  showLineNumbers = true,
  onRun,
  onReset,
  isRunning = false,
  output,
  error,
  className,
  showToolbar = true,
  placeholder = '# Write your code here...',
}: CodeEditorProps) {
  const [copied, setCopied] = useState(false)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getMonacoLanguage = (lang: string) => {
    switch (lang) {
      case 'qiskit':
      case 'cirq':
      case 'pennylane':
      case 'python':
        return 'python'
      case 'javascript':
        return 'javascript'
      case 'typescript':
        return 'typescript'
      default:
        return 'python'
    }
  }

  return (
    <div className={cn('rounded-lg md:rounded-xl border border-white/[0.02] overflow-hidden bg-neumorph-base shadow-neumorph-sm md:shadow-neumorph-md', className)}>
      {showToolbar && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05] bg-neumorph-dark/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {language === 'python' || language === 'qiskit' || language === 'cirq' || language === 'pennylane'
                ? 'main.py'
                : language === 'javascript'
                ? 'main.js'
                : 'main.ts'}
            </span>
            {readOnly && (
              <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
                Read Only
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
            {onReset && (
              <button
                onClick={onReset}
                className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                title="Reset code"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        <Editor
          height="100%"
          language={getMonacoLanguage(language)}
          value={value || placeholder}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineNumbers: showLineNumbers ? 'on' : 'off',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            wordWrap: 'on',
            readOnly,
            renderLineHighlight: readOnly ? 'none' : 'line',
            cursorStyle: readOnly ? 'line-thin' : 'line',
            tabSize: 4,
            insertSpaces: true,
            bracketPairColorization: { enabled: true },
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      {onRun && (
        <div className="p-3 border-t border-white/[0.05] bg-neumorph-dark/30">
          <Button
            onClick={onRun}
            disabled={isRunning || !value.trim()}
            className="w-full"
            leftIcon={isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          >
            {isRunning ? 'Running...' : 'Run Code'}
          </Button>
        </div>
      )}

      {(output || error) && (
        <div className="border-t border-white/[0.05]">
          <div className="px-3 py-2 bg-neumorph-dark/50 border-b border-white/[0.05]">
            <span className="text-xs text-slate-400">Output</span>
          </div>
          <div className="p-3 max-h-40 overflow-auto">
            {error ? (
              <pre className="font-mono text-xs text-red-400 whitespace-pre-wrap">{error}</pre>
            ) : (
              <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap">{output}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
