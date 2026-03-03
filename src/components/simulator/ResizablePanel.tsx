import { useState, useRef, useCallback, useEffect } from 'react'

interface ResizablePanelProps {
  children: React.ReactNode
  direction: 'horizontal' | 'vertical'
  defaultSize: number
  minSize: number
  maxSize: number
  side: 'left' | 'right' | 'top' | 'bottom'
  className?: string
  onResize?: (size: number) => void
}

export function ResizablePanel({
  children,
  direction,
  defaultSize,
  minSize,
  maxSize,
  side,
  className = '',
  onResize,
}: ResizablePanelProps) {
  const [size, setSize] = useState(defaultSize)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef(0)
  const startSizeRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY
    startSizeRef.current = size
  }, [direction, size])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
    const delta = currentPos - startPosRef.current

    let newSize: number
    if (side === 'left' || side === 'top') {
      newSize = startSizeRef.current + delta
    } else {
      newSize = startSizeRef.current - delta
    }

    newSize = Math.max(minSize, Math.min(maxSize, newSize))
    setSize(newSize)
    onResize?.(newSize)
  }, [isResizing, direction, side, minSize, maxSize, onResize])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp, direction])

  const sizeStyle = direction === 'horizontal' ? { width: size } : { height: size }

  const handlePosition = {
    left: 'right-0 top-0 bottom-0 w-1 cursor-col-resize',
    right: 'left-0 top-0 bottom-0 w-1 cursor-col-resize',
    top: 'bottom-0 left-0 right-0 h-1 cursor-row-resize',
    bottom: 'top-0 left-0 right-0 h-1 cursor-row-resize',
  }

  return (
    <div
      ref={panelRef}
      className={`relative flex-shrink-0 ${className}`}
      style={sizeStyle}
    >
      {children}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute ${handlePosition[side]} z-10 hover:bg-quantum-500/50 transition-colors ${
          isResizing ? 'bg-quantum-500' : 'bg-transparent'
        }`}
      />
    </div>
  )
}

export default ResizablePanel
