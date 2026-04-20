import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { LogoIcon } from '@/components/ui/Logo'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await login(email, password)
      if (result.success) {
        toast.success('Welcome back!')
        navigate('/dashboard')
      } else if (result.needsConfirmation) {
        toast.error('Please verify your email first')
        navigate('/verify', { state: { email } })
      } else {
        toast.error('Invalid email or password')
      }
    } catch (error) {
      toast.error('Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-neumorph-base flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 quantum-grid opacity-30" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <LogoIcon size={48} />
            <span className="font-display font-bold text-2xl gradient-text">
              QuantumShala
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-slate-400">Sign in to continue your quantum journey</p>
        </div>

        <div className="bg-neumorph-base border border-white/[0.02] rounded-xl md:rounded-2xl p-6 md:p-8 shadow-neumorph-md md:shadow-neumorph-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-5 h-5" />}
              variant="neumorph"
              required
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-5 h-5" />}
              variant="neumorph"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              }
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-white/20 bg-slate-800 text-quantum-500 focus:ring-quantum-500"
                />
                <span className="text-sm text-slate-400">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-quantum-400 hover:text-quantum-300">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" variant="neumorph-primary" className="w-full" isLoading={isSubmitting}>
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center mt-8 text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-quantum-400 hover:text-quantum-300 font-medium">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
