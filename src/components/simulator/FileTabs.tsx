import { X, FileCode } from 'lucide-react'

interface FileTab {
  id: string
  name: string
  language: string
  isModified: boolean
}

interface FileTabsProps {
  tabs: FileTab[]
  activeTabId: string | null
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onNewTab: () => void
}

export function FileTabs({ tabs, activeTabId, onTabSelect, onTabClose, onNewTab }: FileTabsProps) {
  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      qiskit: 'text-blue-400',
      cirq: 'text-yellow-400',
      pennylane: 'text-green-400',
      openqasm: 'text-purple-400',
    }
    return colors[lang] || 'text-slate-400'
  }

  return (
    <div className="flex items-center bg-slate-900 border-b border-white/5 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabSelect(tab.id)}
          className={`flex items-center gap-2 px-3 py-2 border-r border-white/5 cursor-pointer group min-w-0 ${
            activeTabId === tab.id
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <FileCode className={`w-4 h-4 flex-shrink-0 ${getLanguageColor(tab.language)}`} />
          <span className="text-sm truncate max-w-[120px]">{tab.name}</span>
          {tab.isModified && (
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTabClose(tab.id)
            }}
            className="p-0.5 rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={onNewTab}
        className="flex items-center justify-center w-8 h-8 text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors flex-shrink-0"
        title="New file"
      >
        <span className="text-lg">+</span>
      </button>
    </div>
  )
}

export default FileTabs
