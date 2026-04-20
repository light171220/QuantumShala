import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { LogoIcon } from '@/components/ui/Logo'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

export default function VerifyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { confirmSignUp, resendConfirmationCode, pendingConfirmation, setPendingConfirmation } = useAuthStore()
  
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [isVerified, setIsVerified] = useState(false)

  const email = location.state?.email || pendingConfirmation?.email || ''
  const username = location.state?.username || pendingConfirmation?.username || ''
  const displayName = location.state?.displayName || pendingConfirmation?.displayName || ''

  useEffect(() => {
    if (location.state?.email && !pendingConfirmation) {
      setPendingConfirmation({
        email: location.state.email,
        username: location.state.username || '',
        displayName: location.state.displayName || '',
      })
    }

    if (!email) {
      navigate('/register')
    }
  }, [email, navigate, location.state, pendingConfirmation, setPendingConfirmation])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (code.length !== 6) {
      toast.error('Please enter a 6-digit code')
      return
    }

    setIsSubmitting(true)

    try {
      const success = await confirmSignUp(code)
      if (success) {
        setIsVerified(true)
        toast.success('Email verified successfully!')
      } else {
        toast.error('Invalid verification code')
      }
    } catch (error) {
      toast.error('Verification failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendCode = async () => {
    setIsResending(true)
    try {
      await resendConfirmationCode()
      toast.success('Verification code sent!')
      setCountdown(60)
    } catch (error) {
      toast.error('Failed to resend code')
    } finally {
      setIsResending(false)
    }
  }

  if (isVerified) {
    return (
      <div className="min-h-screen bg-neumorph-base flex items-center justify-center p-4 md:p-6">
        <div className="absolute inset-0 quantum-grid opacity-30" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-md text-center"
        >
          <div className="bg-neumorph-base border border-white/[0.02] rounded-xl md:rounded-2xl p-6 md:p-8 shadow-neumorph-md md:shadow-neumorph-lg">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 shadow-neumorph-sm border border-white/[0.02] flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
            <p className="text-slate-400 mb-6">
              Your account has been verified. You can now sign in.
            </p>
            <Button onClick={() => navigate('/login')} variant="neumorph-primary" className="w-full">
              Sign In
            </Button>
          </div>
        </motion.div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-white mb-2">Verify your email</h1>
          <p className="text-slate-400">
            We sent a verification code to<br />
            <span className="text-white font-medium">{email}</span>
          </p>
        </div>

        <div className="bg-neumorph-base border border-white/[0.02] rounded-xl md:rounded-2xl p-6 md:p-8 shadow-neumorph-md md:shadow-neumorph-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Verification Code
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full pl-10 pr-4 py-3 bg-neumorph-base shadow-neumorph-inset-xs md:shadow-neumorph-inset-sm border border-white/[0.02] rounded-lg text-white text-center text-2xl tracking-[0.5em] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-quantum-500/50 focus:border-quantum-500 transition-all"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
            </div>

            <Button type="submit" variant="neumorph-primary" className="w-full" isLoading={isSubmitting}>
              Verify Email
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm mb-2">Didn't receive the code?</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendCode}
              disabled={isResending || countdown > 0}
            >
              {isResending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </span>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                'Resend Code'
              )}
            </Button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to registration
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
