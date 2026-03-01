import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'glass' | 'neumorph' | 'neumorph-hover' | 'neumorph-inset'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-neumorph-base border border-white/[0.02] shadow-neumorph-xs',
      hover:
        'bg-neumorph-base border border-white/[0.02] shadow-neumorph-xs hover:shadow-neumorph-sm hover:-translate-y-0.5 transition-all duration-300 cursor-pointer',
      glass: 'bg-neumorph-base backdrop-blur-xl border border-white/[0.02] shadow-neumorph-sm',
      neumorph:
        'bg-neumorph-base border border-white/[0.02] shadow-neumorph-sm md:shadow-neumorph-md rounded-lg md:rounded-xl',
      'neumorph-hover':
        'bg-neumorph-base border border-white/[0.02] shadow-neumorph-sm md:shadow-neumorph-md hover:shadow-neumorph-md md:hover:shadow-neumorph-lg md:hover:-translate-y-0.5 transition-all duration-300 cursor-pointer rounded-lg md:rounded-xl',
      'neumorph-inset':
        'bg-neumorph-base border border-white/[0.02] shadow-neumorph-inset-xs md:shadow-neumorph-inset-md rounded-lg md:rounded-xl',
    }

    const paddings = {
      none: '',
      sm: 'p-3 md:p-4',
      md: 'p-4 md:p-6',
      lg: 'p-5 md:p-8',
    }

    return (
      <div
        ref={ref}
        className={cn('rounded-lg md:rounded-xl', variants[variant], paddings[padding], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5', className)}
      {...props}
    />
  )
)

CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-xl font-semibold text-white', className)}
      {...props}
    />
  )
)

CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-slate-400', className)}
      {...props}
    />
  )
)

CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  )
)

CardContent.displayName = 'CardContent'

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center pt-4', className)}
      {...props}
    />
  )
)

CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
