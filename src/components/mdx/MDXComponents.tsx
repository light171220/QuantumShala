import React from 'react'
import { Info, Lightbulb, AlertTriangle, BookOpen, Code, HelpCircle } from 'lucide-react'
import { InteractiveCodeBlock } from '../ui/InteractiveCodeBlock'

// Interactive MDX Components
import ProofBuilder from './ProofBuilder'
import DerivationWalkthrough from './DerivationWalkthrough'
import CircuitChallenge from './CircuitChallenge'
import PulseDesigner from './PulseDesigner'
import NoiseExplorer from './NoiseExplorer'
import VirtualQuantumLab from './VirtualQuantumLab'

interface ComponentProps {
  children: React.ReactNode
  term?: string
  title?: string
  language?: string
  runnable?: boolean
}

export const Definition: React.FC<ComponentProps> = ({ term, children }) => (
  <div className="my-4 p-4 bg-blue-500/10 border-l-4 border-blue-500 rounded-r-lg">
    <div className="flex items-start gap-3">
      <BookOpen className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
      <div>
        {term && <span className="font-semibold text-blue-400">{term}: </span>}
        <span className="text-slate-300">{children}</span>
      </div>
    </div>
  </div>
)

export const Formula: React.FC<ComponentProps> = ({ children }) => (
  <div className="my-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg overflow-x-auto">
    <div className="text-center">{children}</div>
  </div>
)

export const Tip: React.FC<ComponentProps> = ({ children }) => (
  <div className="my-4 p-4 bg-green-500/10 border-l-4 border-green-500 rounded-r-lg">
    <div className="flex items-start gap-3">
      <Lightbulb className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
      <div className="text-slate-300">{children}</div>
    </div>
  </div>
)

export const Warning: React.FC<ComponentProps> = ({ children }) => (
  <div className="my-4 p-4 bg-yellow-500/10 border-l-4 border-yellow-500 rounded-r-lg">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
      <div className="text-slate-300">{children}</div>
    </div>
  </div>
)

export const Example: React.FC<ComponentProps> = ({ title, children }) => (
  <div className="my-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
    <div className="flex items-start gap-3">
      <Code className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        {title && <div className="font-semibold text-cyan-400 mb-2">{title}</div>}
        <div className="text-slate-300">{children}</div>
      </div>
    </div>
  </div>
)

export const Note: React.FC<ComponentProps> = ({ children }) => (
  <div className="my-4 p-4 bg-slate-500/10 border-l-4 border-slate-500 rounded-r-lg">
    <div className="flex items-start gap-3">
      <Info className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="text-slate-300">{children}</div>
    </div>
  </div>
)

export const Question: React.FC<ComponentProps> = ({ children }) => (
  <div className="my-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
    <div className="flex items-start gap-3">
      <HelpCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
      <div className="text-slate-300">{children}</div>
    </div>
  </div>
)

export const KeyConcept: React.FC<ComponentProps> = ({ title, children }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg">
    {title && <div className="font-semibold text-purple-400 mb-2">{title}</div>}
    <div className="text-slate-300">{children}</div>
  </div>
)

export const MathBlock: React.FC<ComponentProps> = ({ children }) => (
  <div className="my-4 p-4 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg overflow-x-auto">
    <div className="text-center font-mono">{children}</div>
  </div>
)

export const CodeExample: React.FC<ComponentProps> = ({ title, children, language = 'python', runnable = false }) => {
  if (typeof children === 'string') {
    return (
      <InteractiveCodeBlock
        code={children}
        language={language}
        title={title}
        runnable={runnable}
      />
    )
  }

  if (React.isValidElement(children)) {
    const childProps = children.props as { children?: React.ReactNode }
    if (childProps.children && typeof childProps.children === 'string') {
      return (
        <InteractiveCodeBlock
          code={childProps.children}
          language={language}
          title={title}
          runnable={runnable}
        />
      )
    }
  }

  return (
    <div className="my-4">
      {title && <div className="text-sm text-slate-400 mb-2">{title}</div>}
      <div className="bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg overflow-hidden">{children}</div>
    </div>
  )
}

export const CodeBlock: React.FC<{
  code: string
  language?: string
  title?: string
  runnable?: boolean
  showLineNumbers?: boolean
}> = ({ code, language = 'python', title, runnable = true, showLineNumbers = true }) => (
  <InteractiveCodeBlock
    code={code}
    language={language}
    title={title}
    runnable={runnable}
    showLineNumbers={showLineNumbers}
  />
)

export const mdxComponents = {
  Definition,
  Formula,
  Tip,
  Warning,
  Example,
  Note,
  Question,
  KeyConcept,
  MathBlock,
  CodeExample,
  CodeBlock,
  InteractiveCodeBlock,
  // Interactive MDX Components
  ProofBuilder,
  DerivationWalkthrough,
  CircuitChallenge,
  PulseDesigner,
  NoiseExplorer,
  VirtualQuantumLab,
}

// Re-export interactive components for direct imports
export {
  ProofBuilder,
  DerivationWalkthrough,
  CircuitChallenge,
  PulseDesigner,
  NoiseExplorer,
  VirtualQuantumLab,
}
