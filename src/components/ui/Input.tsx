import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  variant?: 'default' | 'neumorph'
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, id, variant = 'default', ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-')

    const variants = {
      default: cn(
        'bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg',
        error
          ? 'focus:ring-2 focus:ring-red-500/30'
          : 'focus:ring-2 focus:ring-quantum-500/30'
      ),
      neumorph: cn(
        'bg-neumorph-base border border-white/[0.02] rounded-lg md:rounded-xl',
        'shadow-neumorph-inset-xs md:shadow-neumorph-inset-sm',
        error
          ? 'focus:ring-2 focus:ring-red-500/30'
          : 'focus:ring-2 focus:ring-quantum-500/30'
      ),
    }

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full px-4 py-2.5 text-white placeholder-slate-400',
              'focus:outline-none transition-all',
              variants[variant],
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-slate-400">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
