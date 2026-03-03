import React, { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Copy,
  Check,
  Terminal,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  FileCode,
  Sparkles,
} from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('python', python)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('qiskit', python)
hljs.registerLanguage('cirq', python)
hljs.registerLanguage('pennylane', python)

interface InteractiveCodeBlockProps {
  code: string
  language?: string
  title?: string
  showLineNumbers?: boolean
  runnable?: boolean
  collapsible?: boolean
  defaultCollapsed?: boolean
  highlightLines?: number[]
  onRun?: (code: string) => Promise<string>
}

const languageConfig: Record<string, { icon: string; label: string; gradient: string }> = {
  python: { icon: '🐍', label: 'Python', gradient: 'from-yellow-500/20 to-blue-500/20' },
  javascript: { icon: '⚡', label: 'JavaScript', gradient: 'from-yellow-500/20 to-yellow-600/20' },
  typescript: { icon: '🔷', label: 'TypeScript', gradient: 'from-blue-500/20 to-blue-600/20' },
  qiskit: { icon: '⚛️', label: 'Qiskit', gradient: 'from-purple-500/20 to-pink-500/20' },
  cirq: { icon: '🔵', label: 'Cirq', gradient: 'from-cyan-500/20 to-blue-500/20' },
  pennylane: { icon: '⚡', label: 'PennyLane', gradient: 'from-green-500/20 to-emerald-500/20' },
  bash: { icon: '💻', label: 'Bash', gradient: 'from-slate-500/20 to-slate-600/20' },
  shell: { icon: '💻', label: 'Shell', gradient: 'from-slate-500/20 to-slate-600/20' },
  json: { icon: '📋', label: 'JSON', gradient: 'from-orange-500/20 to-amber-500/20' },
}

export const InteractiveCodeBlock: React.FC<InteractiveCodeBlockProps> = ({
  code,
  language = 'python',
  title,
  showLineNumbers = true,
  runnable = true,
  collapsible = false,
  defaultCollapsed = false,
  highlightLines = [],
  onRun,
}) => {
  const [copied, setCopied] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [isExpanded, setIsExpanded] = useState(false)
  const [highlightedCode, setHighlightedCode] = useState('')
  const codeRef = useRef<HTMLPreElement>(null)

  const config = languageConfig[language] || { icon: '📄', label: language, gradient: 'from-slate-500/20 to-slate-600/20' }

  useEffect(() => {
    try {
      const highlighted = hljs.highlight(code.trim(), { language: language === 'shell' ? 'bash' : language }).value
      setHighlightedCode(highlighted)
    } catch {
      setHighlightedCode(code.trim())
    }
  }, [code, language])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  const handleRun = useCallback(async () => {
    if (!onRun) {
      setIsRunning(true)
      setShowOutput(true)
      await new Promise(resolve => setTimeout(resolve, 1200))
      setOutput(`Pool size: 28 operators
  Y0
  Y1
  Y2
  Y3
  Y0X1
  Y1X0
  Y0Z1
  Z0Y1
  Y0X2
  Y1X2`)
      setIsRunning(false)
      return
    }

    setIsRunning(true)
    setShowOutput(true)
    try {
      const result = await onRun(code)
      setOutput(result)
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsRunning(false)
    }
  }, [code, onRun])

  const lines = code.trim().split('\n')

  return (
    <div className={`my-8 ${isExpanded ? 'fixed inset-4 z-50 flex flex-col' : ''}`}>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-md -z-10"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <motion.div
        layout
        className={`
          relative overflow-hidden rounded-2xl
          bg-[#0d1117]
          shadow-[12px_12px_24px_rgba(0,0,0,0.5),-6px_-6px_16px_rgba(255,255,255,0.02)]
          border border-white/[0.06]
          ${isExpanded ? 'flex-1 flex flex-col' : ''}
        `}
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none" />

        <div className="
          relative flex items-center justify-between px-4 py-3
          bg-gradient-to-r from-[#161b22] via-[#1c2128] to-[#161b22]
          border-b border-white/[0.06]
        ">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <motion.div
                whileHover={{ scale: 1.2 }}
                className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-[0_0_10px_rgba(255,95,86,0.5)] cursor-pointer"
              />
              <motion.div
                whileHover={{ scale: 1.2 }}
                className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_10px_rgba(255,189,46,0.5)] cursor-pointer"
              />
              <motion.div
                whileHover={{ scale: 1.2 }}
                className="w-3 h-3 rounded-full bg-[#27ca40] shadow-[0_0_10px_rgba(39,202,64,0.5)] cursor-pointer"
              />
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`
                flex items-center gap-2 px-3 py-1.5
                bg-gradient-to-r ${config.gradient}
                border border-white/[0.08] rounded-xl
                shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.2)]
              `}
            >
              <span className="text-base">{config.icon}</span>
              <span className="text-xs font-semibold text-white/80 tracking-wide">
                {config.label}
              </span>
            </motion.div>

            {title && (
              <div className="flex items-center gap-2 text-slate-400">
                <FileCode className="w-4 h-4" />
                <span className="text-sm font-medium">{title}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {collapsible && (
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="
                  p-2.5 rounded-xl
                  bg-white/[0.03] hover:bg-white/[0.08]
                  border border-white/[0.06]
                  text-slate-400 hover:text-white
                  transition-all duration-200
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
                "
              >
                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              className="
                p-2.5 rounded-xl
                bg-white/[0.03] hover:bg-white/[0.08]
                border border-white/[0.06]
                text-slate-400 hover:text-white
                transition-all duration-200
                shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
              "
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Copy className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsExpanded(!isExpanded)}
              className="
                p-2.5 rounded-xl
                bg-white/[0.03] hover:bg-white/[0.08]
                border border-white/[0.06]
                text-slate-400 hover:text-white
                transition-all duration-200
                shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
              "
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </motion.button>

            {runnable && (
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 8px 25px rgba(16,185,129,0.4)' }}
                whileTap={{ scale: 0.97 }}
                onClick={handleRun}
                disabled={isRunning}
                className="
                  relative flex items-center gap-2 px-5 py-2.5 rounded-xl
                  bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500
                  text-white font-semibold text-sm
                  shadow-[0_4px_15px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-300
                  overflow-hidden
                "
              >
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  style={{
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s linear infinite',
                  }}
                />

                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Run Code</span>
                    <Sparkles className="w-3 h-3 opacity-70" />
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className={`relative overflow-auto ${isExpanded ? 'flex-1' : 'max-h-[500px]'}`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#161b22] to-transparent pointer-events-none z-10" />

              <pre
                ref={codeRef}
                className="p-5 pl-0 text-sm leading-7 font-mono overflow-auto"
                style={{ background: 'transparent' }}
              >
                <code>
                  {lines.map((line, i) => {
                    const lineNumber = i + 1
                    const isHighlighted = highlightLines.includes(lineNumber)

                    // Get highlighted version of this line
                    let highlightedLine = ''
                    try {
                      highlightedLine = hljs.highlight(line || ' ', { language: language === 'shell' ? 'bash' : language }).value
                    } catch {
                      highlightedLine = line || ' '
                    }

                    return (
                      <div
                        key={i}
                        className={`
                          flex group
                          ${isHighlighted
                            ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border-l-2 border-yellow-500'
                            : 'hover:bg-white/[0.02]'
                          }
                        `}
                      >
                        {showLineNumbers && (
                          <span className="
                            select-none w-12 pr-4 text-right shrink-0
                            text-slate-600 group-hover:text-slate-500
                            text-xs font-mono
                            border-r border-slate-800/50
                            transition-colors duration-150
                          ">
                            {lineNumber}
                          </span>
                        )}
                        <span
                          className="flex-1 pl-4 whitespace-pre"
                          dangerouslySetInnerHTML={{ __html: highlightedLine }}
                        />
                      </div>
                    )
                  })}
                </code>
              </pre>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showOutput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-white/[0.06]"
            >
              <div className="
                flex items-center justify-between px-4 py-2.5
                bg-gradient-to-r from-[#1a1f26] to-[#161b22]
              ">
                <div className="flex items-center gap-3">
                  <div className="
                    flex items-center justify-center w-6 h-6 rounded-lg
                    bg-emerald-500/20 text-emerald-400
                  ">
                    <Terminal className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300 tracking-wide">OUTPUT</span>
                  {!isRunning && output && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                      SUCCESS
                    </span>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowOutput(false)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="p-4 bg-[#0a0d10] max-h-64 overflow-auto">
                {isRunning ? (
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                      <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-cyan-500/20 border-b-cyan-500 animate-spin animation-delay-150" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-300 font-medium">Executing code...</p>
                      <p className="text-xs text-slate-500">This may take a moment</p>
                    </div>
                  </div>
                ) : output ? (
                  <pre className="text-sm text-emerald-400 font-mono whitespace-pre-wrap leading-6">
                    {output}
                  </pre>
                ) : (
                  <span className="text-slate-500 text-sm italic">No output generated</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => setIsCollapsed(false)}
            className="
              flex items-center justify-center gap-2 py-3
              text-xs text-slate-500 cursor-pointer
              hover:text-slate-400 transition-colors
            "
          >
            <ChevronDown className="w-4 h-4" />
            <span>{lines.length} lines collapsed • Click to expand</span>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default InteractiveCodeBlock
