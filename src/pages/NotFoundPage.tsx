import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, ArrowLeft, Atom } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-48 h-48 mx-auto mb-8"
        >
          <div className="absolute inset-0 rounded-full border-2 border-quantum-500/30 animate-pulse" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-4"
          >
            <div className="absolute top-0 left-1/2 w-3 h-3 -translate-x-1/2 rounded-full bg-quantum-400" />
            <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 rounded-full bg-neon-purple" />
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl font-bold text-white">404</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-3xl font-display font-bold text-white mb-4">
            Quantum State Collapsed!
          </h1>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            The page you're looking for seems to have tunneled to another dimension.
            Let's get you back to observed reality.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
            <Link to="/">
              <Button leftIcon={<Home className="w-4 h-4" />}>
                Return Home
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
