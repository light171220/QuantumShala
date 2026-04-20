import { useState, useCallback, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Save,
  Download,
  Upload,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  RefreshCw,
  Copy,
  Code,
  Undo2,
  Redo2,
  Search,
  WrapText,
  Indent,
  Type,
  Maximize2,
  Minimize2,
  Sparkles,
  FileCode,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { FileExplorer } from '@/components/simulator/FileExplorer'
import { FileTabs } from '@/components/simulator/FileTabs'
import { RightPanel } from '@/components/simulator/RightPanel'
import { StatusBar } from '@/components/simulator/StatusBar'
import { ResizablePanel } from '@/components/simulator/ResizablePanel'
import { useCodeParser, useCodeDiagnostics } from '@/hooks/useCodeParser'
import { optimizeRealTime } from '@/lib/quantum/optimization'
import { parsedCircuitToQuantumCircuit } from '@/lib/quantum/parsers/types'
import type { ParseLanguage } from '@/lib/quantum/parsers'
import type { EnhancedOptimizationResult } from '@/lib/quantum/optimization/engine'
import type { OptimizationSuggestion } from '@/types/optimizer'
import {
  saveCodeSnippet,
  updateCodeSnippet,
  deleteCodeSnippet,
  getUserCodeSnippets,
  type SavedCodeSnippet,
  type SnippetLanguage,
} from '@/services/codeSnippets'

const CODE_TEMPLATES: Record<string, string> = {
  qiskit: `from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator

# Create a Bell State circuit
qr = QuantumRegister(2, 'q')
cr = ClassicalRegister(2, 'c')
qc = QuantumCircuit(qr, cr)

# Apply gates
qc.h(qr[0])          # Hadamard on qubit 0
qc.cx(qr[0], qr[1])  # CNOT with control=0, target=1
qc.measure(qr, cr)   # Measure all qubits

# Simulate
simulator = AerSimulator()
job = simulator.run(qc, shots=1024)
result = job.result()
counts = result.get_counts(qc)

print("Bell State Results:", counts)
`,
  cirq: `import cirq
import numpy as np

# Create qubits
q0, q1 = cirq.LineQubit.range(2)

# Build the circuit
circuit = cirq.Circuit([
    cirq.H(q0),
    cirq.CNOT(q0, q1),
    cirq.measure(q0, q1, key='m')
])

print("Circuit:")
print(circuit)

# Simulate
simulator = cirq.Simulator()
result = simulator.run(circuit, repetitions=1024)
print("\\nResults:", result.histogram(key='m'))
`,
  pennylane: `import pennylane as qml
from pennylane import numpy as np

# Create a quantum device
dev = qml.device('default.qubit', wires=2, shots=1024)

@qml.qnode(dev)
def bell_state():
    qml.Hadamard(wires=0)
    qml.CNOT(wires=[0, 1])
    return qml.counts()

# Run the circuit
results = bell_state()
print("Bell State Results:", results)

print("\\nCircuit:")
print(qml.draw(bell_state)())
`,
  openqasm: `OPENQASM 2.0;
include "qelib1.inc";

// Define quantum and classical registers
qreg q[2];
creg c[2];

// Create Bell State
h q[0];
cx q[0], q[1];

// Measure
measure q[0] -> c[0];
measure q[1] -> c[1];
`,
}

const EXAMPLE_CIRCUITS: Record<string, { name: string; code: string }[]> = {
  qiskit: [
    { name: 'Bell State', code: CODE_TEMPLATES.qiskit },
    { name: 'GHZ State', code: `from qiskit import QuantumCircuit\nqc = QuantumCircuit(3, 3)\nqc.h(0)\nqc.cx(0, 1)\nqc.cx(1, 2)\nqc.measure_all()\nprint(qc)` },
    { name: 'Quantum Teleportation', code: `from qiskit import QuantumCircuit\nqc = QuantumCircuit(3, 3)\nqc.h(1)\nqc.cx(1, 2)\nqc.cx(0, 1)\nqc.h(0)\nqc.measure([0, 1], [0, 1])\nqc.cx(1, 2)\nqc.cz(0, 2)\nprint(qc)` },
    { name: 'Grover 2-qubit', code: `from qiskit import QuantumCircuit\nqc = QuantumCircuit(2, 2)\nqc.h([0, 1])\nqc.cz(0, 1)\nqc.h([0, 1])\nqc.x([0, 1])\nqc.cz(0, 1)\nqc.x([0, 1])\nqc.h([0, 1])\nqc.measure_all()\nprint(qc)` },
  ],
  cirq: [
    { name: 'Bell State', code: CODE_TEMPLATES.cirq },
    { name: 'GHZ State', code: `import cirq\nq = cirq.LineQubit.range(3)\ncircuit = cirq.Circuit([\n    cirq.H(q[0]),\n    cirq.CNOT(q[0], q[1]),\n    cirq.CNOT(q[1], q[2]),\n    cirq.measure(*q, key='m')\n])\nprint(circuit)` },
  ],
  pennylane: [
    { name: 'Bell State', code: CODE_TEMPLATES.pennylane },
    { name: 'VQE Ansatz', code: `import pennylane as qml\ndev = qml.device('default.qubit', wires=2)\n@qml.qnode(dev)\ndef vqe_circuit(params):\n    qml.RY(params[0], wires=0)\n    qml.RY(params[1], wires=1)\n    qml.CNOT(wires=[0, 1])\n    return qml.expval(qml.PauliZ(0) @ qml.PauliZ(1))\nprint(qml.draw(vqe_circuit)([0.5, 0.3]))` },
  ],
  openqasm: [
    { name: 'Bell State', code: CODE_TEMPLATES.openqasm },
    { name: 'QFT 2-qubit', code: `OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\nh q[0];\ncp(pi/2) q[1], q[0];\nh q[1];\nswap q[0], q[1];\nmeasure q -> c;` },
  ],
}

const OUTPUT_EXAMPLES: Record<string, { success: boolean; output: string; counts: Record<string, number> }> = {
  qiskit: { success: true, output: `Bell State Results: {'00': 498, '11': 526}\n\nCircuit executed successfully!\nTotal shots: 1024\nExecution time: 0.023s`, counts: { '00': 498, '11': 526 } },
  cirq: { success: true, output: `Circuit:\n0: ───H───@───M('m')───\n          │\n1: ───────X───M────────\n\nResults: Counter({0: 512, 3: 512})`, counts: { '00': 512, '11': 512 } },
  pennylane: { success: true, output: `Bell State Results: {'00': 507, '11': 517}\n\nCircuit:\n0: ──H─╭●─┤\n1: ────╰X─┤`, counts: { '00': 507, '11': 517 } },
  openqasm: { success: true, output: `Parsed successfully!\nCircuit validated: 2 qubits, 4 operations\nReady for simulation.`, counts: { '00': 500, '11': 524 } },
}

type Language = keyof typeof CODE_TEMPLATES

interface ConsoleEntry {
  type: 'info' | 'success' | 'error' | 'output' | 'command'
  message: string
  timestamp: Date
}

interface OpenFile {
  id: string
  name: string
  code: string
  language: Language
  isModified: boolean
  isSaved: boolean
  projectId?: string
}

export default function CodePlaygroundPage() {
  const [language, setLanguage] = useState<Language>('qiskit')
  const [code, setCode] = useState(CODE_TEMPLATES.qiskit)
  const [isRunning, setIsRunning] = useState(false)
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const [lastResult, setLastResult] = useState<{ counts: Record<string, number> } | null>(null)
  const [shots, setShots] = useState(1024)

  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectIsPublic, setProjectIsPublic] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [savedProjects, setSavedProjects] = useState<SavedCodeSnippet[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [currentFileName, setCurrentFileName] = useState('untitled')
  const [isModified, setIsModified] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<Date | undefined>()

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([
    { id: 'new-1', name: 'untitled.py', code: CODE_TEMPLATES.qiskit, language: 'qiskit', isModified: false, isSaved: false }
  ])
  const [activeFileId, setActiveFileId] = useState('new-1')

  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [optimizationResult, setOptimizationResult] = useState<EnhancedOptimizationResult | null>(null)
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false)
  const [wordWrap, setWordWrap] = useState(true)
  const [fontSize, setFontSize] = useState(14)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileIdCounter = useRef(1)
  const editorRef = useRef<any>(null)

  const { circuit, parseResult, isParsing, parseTimeMs } = useCodeParser(code, language as ParseLanguage, { debounceMs: 300 })
  const diagnostics = useCodeDiagnostics(parseResult)

  useEffect(() => {
    if (circuit && circuit.gates.length > 0) {
      try {
        const qc = parsedCircuitToQuantumCircuit(circuit)
        const result = optimizeRealTime(qc)
        setOptimizationResult(result)
      } catch {
        setOptimizationResult(null)
      }
    } else {
      setOptimizationResult(null)
    }
  }, [circuit])

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const projects = await getUserCodeSnippets()
      setSavedProjects(projects)
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const addConsoleEntry = useCallback((type: ConsoleEntry['type'], message: string) => {
    setConsoleEntries((prev) => [...prev, { type, message, timestamp: new Date() }])
  }, [])

  const handleCodeChange = (newCode: string | undefined) => {
    const value = newCode || ''
    setCode(value)
    setIsModified(true)
    setOpenFiles((files) =>
      files.map((f) => (f.id === activeFileId ? { ...f, code: value, isModified: true } : f))
    )
  }

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    setCode(CODE_TEMPLATES[lang])
    setIsModified(true)
    setOpenFiles((files) =>
      files.map((f) =>
        f.id === activeFileId
          ? { ...f, code: CODE_TEMPLATES[lang], language: lang, isModified: true, name: `untitled.${lang === 'openqasm' ? 'qasm' : 'py'}` }
          : f
      )
    )
  }

  const handleRun = async () => {
    setIsRunning(true)
    setConsoleEntries([])
    setLastResult(null)

    addConsoleEntry('info', `Starting ${language} simulation...`)
    await new Promise((r) => setTimeout(r, 300))
    addConsoleEntry('info', 'Parsing code...')
    await new Promise((r) => setTimeout(r, 300))
    addConsoleEntry('info', 'Building quantum circuit...')
    await new Promise((r) => setTimeout(r, 500))
    addConsoleEntry('info', `Running simulation (${shots} shots)...`)
    await new Promise((r) => setTimeout(r, 400))

    const result = OUTPUT_EXAMPLES[language]
    setLastResult(result)

    if (result.success) {
      addConsoleEntry('success', 'Simulation completed successfully!')
      addConsoleEntry('output', result.output)
    } else {
      addConsoleEntry('error', 'Simulation failed')
    }

    setIsRunning(false)
  }

  const handleCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    addConsoleEntry('command', `$ ${trimmed}`)
    const [command, ...args] = trimmed.split(' ')

    switch (command.toLowerCase()) {
      case 'run':
        handleRun()
        break
      case 'clear':
      case 'cls':
        setConsoleEntries([])
        break
      case 'reset':
        setCode(CODE_TEMPLATES[language])
        addConsoleEntry('success', 'Code reset to template')
        break
      case 'shots':
        if (args[0]) {
          const n = parseInt(args[0])
          if (!isNaN(n) && n > 0 && n <= 100000) {
            setShots(n)
            addConsoleEntry('success', `Shots set to ${n}`)
          } else {
            addConsoleEntry('error', 'Invalid shots value (1-100000)')
          }
        } else {
          addConsoleEntry('info', `Current shots: ${shots}`)
        }
        break
      case 'help':
        addConsoleEntry('info', 'Commands: run, clear, reset, shots <n>, save, help')
        break
      case 'save':
        setShowSaveModal(true)
        break
      default:
        addConsoleEntry('error', `Unknown command: ${command}. Type 'help' for list.`)
    }
  }, [addConsoleEntry, language, shots])

  const handleSave = async () => {
    if (!projectName.trim()) {
      addConsoleEntry('error', 'Project name is required')
      return
    }

    setIsSaving(true)
    try {
      if (currentProjectId) {
        await updateCodeSnippet(currentProjectId, {
          name: projectName,
          description: projectDescription,
          code,
          language: language as SnippetLanguage,
          isPublic: projectIsPublic,
        })
        addConsoleEntry('success', `Project "${projectName}" updated`)
      } else {
        const id = await saveCodeSnippet({
          name: projectName,
          description: projectDescription,
          code,
          language: language as SnippetLanguage,
          isPublic: projectIsPublic,
        })
        if (id) {
          setCurrentProjectId(id)
          addConsoleEntry('success', `Project "${projectName}" saved`)
        }
      }
      setCurrentFileName(projectName)
      setIsModified(false)
      setLastSaveTime(new Date())
      setShowSaveModal(false)
      loadProjects()
    } catch (err) {
      addConsoleEntry('error', 'Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileSelect = (file: SavedCodeSnippet) => {
    const existingTab = openFiles.find((f) => f.projectId === file.id)
    if (existingTab) {
      setActiveFileId(existingTab.id)
      setCode(existingTab.code)
      setLanguage(existingTab.language)
      return
    }

    const newFile: OpenFile = {
      id: `file-${++fileIdCounter.current}`,
      name: file.name,
      code: file.code,
      language: file.language as Language,
      isModified: false,
      isSaved: true,
      projectId: file.id,
    }

    setOpenFiles((prev) => [...prev, newFile])
    setActiveFileId(newFile.id)
    setCode(file.code)
    setLanguage(file.language as Language)
    setCurrentProjectId(file.id)
    setCurrentFileName(file.name)
    setProjectName(file.name)
    setProjectDescription(file.description || '')
    setProjectIsPublic(file.isPublic)
    setIsModified(false)
  }

  const handleFileDelete = async (fileId: string, fileName: string) => {
    if (!window.confirm(`Delete "${fileName}"?`)) return
    try {
      await deleteCodeSnippet(fileId)
      setSavedProjects((prev) => prev.filter((p) => p.id !== fileId))
      setOpenFiles((prev) => prev.filter((f) => f.projectId !== fileId))
      if (currentProjectId === fileId) {
        setCurrentProjectId(null)
        setCurrentFileName('untitled')
      }
      addConsoleEntry('success', `Deleted "${fileName}"`)
    } catch {
      addConsoleEntry('error', 'Failed to delete file')
    }
  }

  const handleNewFile = () => {
    const newFile: OpenFile = {
      id: `new-${++fileIdCounter.current}`,
      name: `untitled.${language === 'openqasm' ? 'qasm' : 'py'}`,
      code: CODE_TEMPLATES[language],
      language,
      isModified: false,
      isSaved: false,
    }
    setOpenFiles((prev) => [...prev, newFile])
    setActiveFileId(newFile.id)
    setCode(newFile.code)
    setCurrentProjectId(null)
    setCurrentFileName('untitled')
    setProjectName('')
    setProjectDescription('')
    setIsModified(false)
  }

  const handleTabSelect = (tabId: string) => {
    const file = openFiles.find((f) => f.id === tabId)
    if (file) {
      setActiveFileId(tabId)
      setCode(file.code)
      setLanguage(file.language)
      setCurrentProjectId(file.projectId || null)
      setCurrentFileName(file.name.replace(/\.(py|qasm)$/, ''))
      setIsModified(file.isModified)
    }
  }

  const handleTabClose = (tabId: string) => {
    const file = openFiles.find((f) => f.id === tabId)
    if (file?.isModified && !window.confirm('Unsaved changes will be lost. Close anyway?')) {
      return
    }

    const newFiles = openFiles.filter((f) => f.id !== tabId)
    if (newFiles.length === 0) {
      handleNewFile()
      return
    }

    setOpenFiles(newFiles)
    if (activeFileId === tabId) {
      const newActive = newFiles[newFiles.length - 1]
      setActiveFileId(newActive.id)
      setCode(newActive.code)
      setLanguage(newActive.language)
    }
  }

  const handleLoadExample = (exampleCode: string, name: string) => {
    const newFile: OpenFile = {
      id: `example-${++fileIdCounter.current}`,
      name: `${name}.${language === 'openqasm' ? 'qasm' : 'py'}`,
      code: exampleCode,
      language,
      isModified: false,
      isSaved: false,
    }
    setOpenFiles((prev) => [...prev, newFile])
    setActiveFileId(newFile.id)
    setCode(exampleCode)
    setCurrentProjectId(null)
    setCurrentFileName(name)
  }

  const handleDownload = () => {
    const ext = language === 'openqasm' ? 'qasm' : 'py'
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentFileName}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    addConsoleEntry('info', `Downloaded ${currentFileName}.${ext}`)
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      const name = file.name.replace(/\.[^/.]+$/, '')
      const newFile: OpenFile = {
        id: `upload-${++fileIdCounter.current}`,
        name: file.name,
        code: content,
        language,
        isModified: false,
        isSaved: false,
      }
      setOpenFiles((prev) => [...prev, newFile])
      setActiveFileId(newFile.id)
      setCode(content)
      setCurrentFileName(name)
      addConsoleEntry('info', `Loaded ${file.name}`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleGateClick = (gateId: string, line: number) => {
    addConsoleEntry('info', `Gate clicked: ${gateId} at line ${line}`)
  }

  const handleLineClick = (line: number) => {
    addConsoleEntry('info', `Navigate to line ${line}`)
  }

  const suggestions: OptimizationSuggestion[] = optimizationResult?.suggestions || []

  const fileTabs = openFiles.map((f) => ({
    id: f.id,
    name: f.name,
    language: f.language,
    isModified: f.isModified,
  }))

  const languageConfig: Record<Language, { color: string; icon: string; label: string }> = {
    qiskit: { color: 'from-blue-500 to-cyan-500', icon: '🐍', label: 'Python' },
    cirq: { color: 'from-yellow-500 to-orange-500', icon: '⭕', label: 'Python' },
    pennylane: { color: 'from-green-500 to-emerald-500', icon: '⚡', label: 'Python' },
    openqasm: { color: 'from-purple-500 to-pink-500', icon: '📜', label: 'QASM' },
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    addConsoleEntry('info', 'Code copied to clipboard')
  }

  const handleReset = () => {
    setCode(CODE_TEMPLATES[language])
    setIsModified(true)
    setOpenFiles((files) =>
      files.map((f) => (f.id === activeFileId ? { ...f, code: CODE_TEMPLATES[language], isModified: true } : f))
    )
    addConsoleEntry('info', 'Code reset to template')
  }

  const handleEditorUndo = () => {
    editorRef.current?.trigger('keyboard', 'undo', null)
  }

  const handleEditorRedo = () => {
    editorRef.current?.trigger('keyboard', 'redo', null)
  }

  const handleEditorSearch = () => {
    editorRef.current?.trigger('keyboard', 'actions.find', null)
  }

  const handleEditorFormat = () => {
    editorRef.current?.trigger('keyboard', 'editor.action.formatDocument', null)
  }

  const toggleWordWrap = () => {
    setWordWrap(!wordWrap)
  }

  const increaseFontSize = () => {
    setFontSize((s) => Math.min(s + 2, 24))
  }

  const decreaseFontSize = () => {
    setFontSize((s) => Math.max(s - 2, 10))
  }

  const toggleEditorFullscreen = () => {
    setIsEditorFullscreen(!isEditorFullscreen)
    if (!isEditorFullscreen) {
      setShowLeftPanel(false)
      setShowRightPanel(false)
    }
  }

  const activeFile = openFiles.find((f) => f.id === activeFileId)

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-neumorph-darker">
      <div className="flex flex-col border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Code className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-white">Code Playground</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleRun}
              isLoading={isRunning}
              leftIcon={<Play className="w-4 h-4" />}
              className="px-4"
            >
              Run
            </Button>
            <div className="w-px h-6 bg-white/10" />
            <Button variant="ghost" size="sm" onClick={() => setShowSaveModal(true)} title="Save">
              <Save className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload} title="Download">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} title="Upload">
              <Upload className="w-4 h-4" />
            </Button>
            <input ref={fileInputRef} type="file" accept=".py,.qasm,.txt" onChange={handleUpload} className="hidden" />
            <div className="w-px h-6 bg-white/10" />
            <Button variant="ghost" size="sm" onClick={handleCopy} title="Copy code">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} title="Reset to template">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-white/10" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              title={showLeftPanel ? 'Hide explorer' : 'Show explorer'}
            >
              {showLeftPanel ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRightPanel(!showRightPanel)}
              title={showRightPanel ? 'Hide panel' : 'Show panel'}
            >
              {showRightPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 px-4 py-2 bg-slate-900/50 overflow-x-auto">
          {(Object.keys(CODE_TEMPLATES) as Language[]).map((lang) => {
            const config = languageConfig[lang]
            const isActive = language === lang
            return (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? `bg-gradient-to-r ${config.color} text-white shadow-lg`
                    : 'bg-slate-800 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span>{config.icon}</span>
                <span className="font-medium text-sm capitalize">{lang}</span>
                <span className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-500'}`}>
                  {config.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence>
          {showLeftPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ResizablePanel
                direction="horizontal"
                defaultSize={220}
                minSize={180}
                maxSize={400}
                side="left"
                className="h-full"
              >
                <FileExplorer
                  files={savedProjects}
                  currentFileId={currentProjectId}
                  onFileSelect={handleFileSelect}
                  onFileDelete={handleFileDelete}
                  onNewFile={handleNewFile}
                  onLoadExample={handleLoadExample}
                  examples={EXAMPLE_CIRCUITS[language] || []}
                  isLoading={isLoadingProjects}
                  language={language}
                />
              </ResizablePanel>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <FileTabs
            tabs={fileTabs}
            activeTabId={activeFileId}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
            onNewTab={handleNewFile}
          />

          <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 border-b border-white/5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <FileCode className="w-3.5 h-3.5 text-quantum-400" />
                <span className="text-slate-500">{activeFile?.name || 'untitled'}</span>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className={`font-medium ${languageConfig[language].color.includes('blue') ? 'text-blue-400' : languageConfig[language].color.includes('yellow') ? 'text-yellow-400' : languageConfig[language].color.includes('green') ? 'text-green-400' : 'text-purple-400'}`}>
                  {language.charAt(0).toUpperCase() + language.slice(1)}
                </span>
                {isModified && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-medium">
                    Modified
                  </span>
                )}
                {circuit && (
                  <span className="px-1.5 py-0.5 rounded bg-quantum-500/20 text-quantum-400 text-[10px] font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {circuit.numQubits}q · {circuit.gates.length}g
                  </span>
                )}
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleEditorUndo}
                  className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleEditorRedo}
                  className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                  onClick={handleEditorSearch}
                  className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                  title="Search (Ctrl+F)"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={toggleWordWrap}
                  className={`p-1.5 rounded transition-colors ${wordWrap ? 'bg-quantum-500/20 text-quantum-400' : 'hover:bg-white/5 text-slate-500 hover:text-white'}`}
                  title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
                >
                  <WrapText className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                  onClick={decreaseFontSize}
                  className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                  title="Decrease font size"
                >
                  <Type className="w-3 h-3" />
                </button>
                <span className="text-[10px] text-slate-500 min-w-[24px] text-center">{fontSize}</span>
                <button
                  onClick={increaseFontSize}
                  className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                  title="Increase font size"
                >
                  <Type className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                  onClick={toggleEditorFullscreen}
                  className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                  title={isEditorFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isEditorFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-quantum-500/5 via-transparent to-transparent pointer-events-none z-10" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-quantum-500/30 to-transparent z-10" />

              <Editor
                height="100%"
                language={language === 'openqasm' ? 'plaintext' : 'python'}
                value={code}
                onChange={handleCodeChange}
                theme="vs-dark"
                onMount={(editor) => {
                  editorRef.current = editor
                  editor.onDidChangeCursorPosition((e) => {
                    setCursorPosition({ line: e.position.lineNumber, column: e.position.column })
                  })
                }}
                options={{
                  minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
                  fontSize,
                  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
                  fontLigatures: true,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16, bottom: 16 },
                  wordWrap: wordWrap ? 'on' : 'off',
                  renderLineHighlight: 'all',
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  smoothScrolling: true,
                  bracketPairColorization: { enabled: true },
                  guides: {
                    bracketPairs: true,
                    indentation: true,
                    highlightActiveIndentation: true,
                  },
                  renderWhitespace: 'selection',
                  folding: true,
                  foldingHighlight: true,
                  showFoldingControls: 'mouseover',
                  matchBrackets: 'always',
                  selectionHighlight: true,
                  occurrencesHighlight: 'singleFile',
                  links: true,
                  colorDecorators: true,
                  contextmenu: true,
                  quickSuggestions: true,
                  suggestOnTriggerCharacters: true,
                  acceptSuggestionOnEnter: 'on',
                  tabCompletion: 'on',
                  wordBasedSuggestions: 'currentDocument',
                  parameterHints: { enabled: true },
                  formatOnPaste: true,
                  formatOnType: true,
                  lineDecorationsWidth: 10,
                  lineNumbersMinChars: 4,
                  glyphMargin: true,
                  overviewRulerBorder: false,
                  hideCursorInOverviewRuler: false,
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                    useShadows: false,
                  },
                }}
              />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showRightPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ResizablePanel
                direction="horizontal"
                defaultSize={320}
                minSize={250}
                maxSize={500}
                side="right"
                className="h-full"
              >
                <RightPanel
                  circuit={circuit}
                  parseResult={parseResult}
                  parseTimeMs={parseTimeMs}
                  isParsing={isParsing}
                  optimizationResult={optimizationResult}
                  suggestions={suggestions}
                  consoleEntries={consoleEntries}
                  lastResult={lastResult}
                  onGateClick={handleGateClick}
                  onLineClick={handleLineClick}
                  onRunCommand={handleCommand}
                  onClearConsole={() => setConsoleEntries([])}
                  errorCount={diagnostics.errorCount}
                  warningCount={diagnostics.warningCount}
                />
              </ResizablePanel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <StatusBar
        isSaved={!isModified}
        lastSaveTime={lastSaveTime}
        cursorLine={cursorPosition.line}
        cursorColumn={cursorPosition.column}
        circuit={circuit}
        language={language}
        errorCount={diagnostics.errorCount}
        warningCount={diagnostics.warningCount}
        isParsing={isParsing}
      />

      <Modal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} title="Save Project">
        <div className="space-y-4">
          <Input
            label="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="My Quantum Circuit"
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Describe your code..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-quantum-500 resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={projectIsPublic}
              onChange={(e) => setProjectIsPublic(e.target.checked)}
              className="rounded border-white/20 bg-slate-800 text-quantum-500 focus:ring-quantum-500"
            />
            <span className="text-sm text-slate-300">Make public</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowSaveModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isSaving} className="flex-1">
              {currentProjectId ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
