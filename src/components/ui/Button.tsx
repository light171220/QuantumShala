import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'neumorph' | 'neumorph-primary' | 'neumorph-inset'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary:
        'bg-gradient-to-r from-quantum-500 to-quantum-600 hover:from-quantum-400 hover:to-quantum-500 text-white shadow-lg shadow-quantum-500/25 hover:shadow-quantum-400/40',
      secondary:
        'bg-white/10 hover:bg-white/20 text-white border border-white/10',
      ghost: 'hover:bg-white/10 text-white',
      danger:
        'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-lg shadow-red-500/25',
      success:
        'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white shadow-lg shadow-green-500/25',
      neumorph:
        'bg-neumorph-base text-white border border-white/[0.02] shadow-neumorph-xs md:shadow-neumorph-sm hover:shadow-neumorph-sm md:hover:shadow-neumorph-md active:shadow-neumorph-pressed-sm md:active:shadow-neumorph-pressed rounded-lg md:rounded-xl',
      'neumorph-primary':
        'bg-neumorph-base text-quantum-400 border border-white/[0.02] shadow-neumorph-xs md:shadow-neumorph-sm hover:shadow-neumorph-sm md:hover:shadow-neumorph-md active:shadow-neumorph-pressed-sm md:active:shadow-neumorph-pressed hover:text-quantum-300 ring-1 ring-quantum-500/20 rounded-lg md:rounded-xl',
      'neumorph-inset':
        'bg-neumorph-base text-white border border-white/[0.02] shadow-neumorph-inset-xs md:shadow-neumorph-inset-sm hover:shadow-neumorph-inset-sm md:hover:shadow-neumorph-inset-md rounded-lg md:rounded-xl',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-quantum-500/50 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
