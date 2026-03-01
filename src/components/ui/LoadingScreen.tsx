import { motion } from 'framer-motion'
import { LogoIcon } from './Logo'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-neumorph-base flex items-center justify-center z-50">
      <div className="text-center">
        <motion.div
          className="relative w-24 h-24 mx-auto mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <LogoIcon size={96} />
          </motion.div>
        </motion.div>
        <motion.h2
          className="text-xl font-display font-semibold gradient-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          QuantumShala
        </motion.h2>
        <motion.p
          className="text-slate-400 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Initializing quantum state...
        </motion.p>
        <motion.div
          className="mt-6 flex justify-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-quantum-500"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  )
}
