import { createContext, useContext, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

interface TabsContextValue {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

interface TabsProps {
  defaultValue?: string
  value?: string
  children: ReactNode
  className?: string
  onChange?: (value: string) => void
}

export function Tabs({ defaultValue, value, children, className, onChange }: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultValue || value || '')
  
  const activeTab = value !== undefined ? value : internalActiveTab

  const handleTabChange = (tab: string) => {
    if (value === undefined) {
      setInternalActiveTab(tab)
    }
    onChange?.(tab)
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'neumorph'
}

export function TabsList({ children, className, variant = 'default' }: TabsListProps) {
  const variants = {
    default: 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg',
    neumorph: 'bg-neumorph-base border border-white/[0.02] shadow-neumorph-inset-xs md:shadow-neumorph-inset-sm rounded-lg md:rounded-xl',
  }

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1 p-1 md:p-1.5',
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
  disabled?: boolean
  variant?: 'default' | 'neumorph'
}

export function TabsTrigger({
  value,
  children,
  className,
  disabled,
  variant = 'default',
}: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabs()
  const isActive = activeTab === value

  const activeStyles = {
    default: 'bg-quantum-500/20 rounded-md',
    neumorph: 'bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm rounded-md md:rounded-lg',
  }

  return (
    <button
      onClick={() => !disabled && setActiveTab(value)}
      disabled={disabled}
      className={cn(
        'relative px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-md transition-all',
        'focus:outline-none focus:ring-2 focus:ring-quantum-500/50',
        isActive
          ? 'text-white'
          : 'text-slate-400 hover:text-white hover:bg-white/5',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className={cn('absolute inset-0', activeStyles[variant])}
          transition={{ type: 'spring', duration: 0.3 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = useTabs()

  if (activeTab !== value) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
