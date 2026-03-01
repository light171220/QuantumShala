import { Fragment, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
  variant?: 'default' | 'neumorph'
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  variant = 'default',
}: ModalProps) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
  }

  const variants = {
    default: 'bg-neumorph-base border border-white/[0.02] rounded-xl shadow-neumorph-md',
    neumorph: 'bg-neumorph-base border border-white/[0.02] rounded-xl md:rounded-2xl shadow-neumorph-md md:shadow-neumorph-xl',
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'w-full',
                variants[variant],
                sizes[size]
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10">
                  <div>
                    {title && (
                      <h2 className="text-lg md:text-xl font-semibold text-white">{title}</h2>
                    )}
                    {description && (
                      <p className="mt-1 text-sm text-slate-400">{description}</p>
                    )}
                  </div>
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
              <div className="p-4 md:p-6">{children}</div>
            </motion.div>
          </div>
        </Fragment>
      )}
    </AnimatePresence>
  )
}
