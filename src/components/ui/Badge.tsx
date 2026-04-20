import { cn } from '@/utils/cn'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neumorph' | 'neumorph-primary'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
}: BadgeProps) {
  const variants = {
    default: 'bg-neumorph-base text-slate-300 border-white/[0.02] shadow-neumorph-xs',
    primary: 'bg-quantum-500/20 text-quantum-400 border-quantum-500/30',
    secondary: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    neumorph: 'bg-neumorph-base text-slate-300 border-white/[0.02] shadow-neumorph-xs md:shadow-neumorph-sm',
    'neumorph-primary': 'bg-neumorph-base text-quantum-400 border-white/[0.02] shadow-neumorph-xs md:shadow-neumorph-sm ring-1 ring-quantum-500/20',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  )
}
