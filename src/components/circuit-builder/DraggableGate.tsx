import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GATE_DEFINITIONS } from '@/lib/quantum/gates'
import type { GateType } from '@/types/simulator'

interface DraggableGateProps {
  gateType: GateType
  isSelected?: boolean
  onClick?: () => void
  showTooltip?: boolean
}

export function DraggableGate({ gateType, isSelected, onClick, showTooltip = true }: DraggableGateProps) {
  const gate = GATE_DEFINITIONS[gateType]

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${gateType}`,
    data: {
      type: 'palette-gate',
      gateType,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div className="relative group">
      <button
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={onClick}
        className={`w-full p-2 rounded-lg text-left transition-all cursor-grab active:cursor-grabbing ${
          isSelected
            ? 'bg-quantum-500/20 border-2 border-quantum-500 shadow-lg shadow-quantum-500/20'
            : 'bg-slate-800/50 border border-white/5 hover:bg-slate-700/50 hover:border-white/10'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-mono font-bold text-sm shadow-lg"
            style={{ backgroundColor: gate.color }}
          >
            {gate.symbol}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-white text-xs truncate">{gate.name}</div>
            <div className="text-[10px] text-slate-400">
              {gate.numQubits}Q
              {gate.parameters.length > 0 && ` · ${gate.parameters.length} param`}
            </div>
          </div>
        </div>
      </button>

      {showTooltip && (
        <div className="absolute left-full top-0 ml-2 w-56 p-3 bg-slate-900 border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-white font-mono font-bold text-sm"
              style={{ backgroundColor: gate.color }}
            >
              {gate.symbol}
            </div>
            <div>
              <div className="font-semibold text-white text-sm">{gate.name}</div>
              <div className="text-xs text-slate-400">{gate.category}</div>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{gate.description}</p>
          {gate.parameters.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="text-xs text-slate-400">
                Parameters: {gate.parameters.map((p) => p.name).join(', ')}
              </div>
            </div>
          )}
          <div className="mt-2 text-[10px] text-slate-500">
            Drag to circuit or click to select
          </div>
        </div>
      )}
    </div>
  )
}

interface DragOverlayGateProps {
  gateType: GateType
}

export function DragOverlayGate({ gateType }: DragOverlayGateProps) {
  const gate = GATE_DEFINITIONS[gateType]

  return (
    <div
      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-mono font-bold shadow-2xl cursor-grabbing"
      style={{ backgroundColor: gate.color }}
    >
      {gate.symbol}
    </div>
  )
}
