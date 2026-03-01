import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { LogoIcon } from '@/components/ui/Logo'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

type Step = 'email' | 'code' | 'success'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { forgotPassword, confirmForgotPassword } = useAuthStore()
  
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await forgotPassword(email)
      toast.success('Reset code sent to your email')
      setStep('code')
    } catch (error) {
      toast.error('Failed to send reset code')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setIsSubmitting(true)

    try {
      await confirmForgotPassword(email, code, newPassword)
      toast.success('Password reset successfully!')
      setStep('success')
    } catch (error) {
      toast.error('Failed to reset password')
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
          <h1 className="text-2xl font-bold text-white mb-2">
            {step === 'success' ? 'Password Reset!' : 'Reset your password'}
          </h1>
          <p className="text-slate-400">
            {step === 'email' && 'Enter your email to receive a reset code'}
            {step === 'code' && 'Enter the code and your new password'}
            {step === 'success' && 'Your password has been updated'}
          </p>
        </div>

        <div className="bg-neumorph-base border border-white/[0.02] rounded-xl md:rounded-2xl p-6 md:p-8 shadow-neumorph-md md:shadow-neumorph-lg">
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-6">
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

              <Button type="submit" variant="neumorph-primary" className="w-full" isLoading={isSubmitting}>
                Send Reset Code
              </Button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <Input
                label="Reset Code"
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                leftIcon={<Mail className="w-5 h-5" />}
                variant="neumorph"
                required
              />

              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
                helperText="Must be at least 8 characters"
                required
              />

              <Input
                label="Confirm New Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-5 h-5" />}
                variant="neumorph"
                required
              />

              <Button type="submit" variant="neumorph-primary" className="w-full" isLoading={isSubmitting}>
                Reset Password
              </Button>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 shadow-neumorph-sm border border-white/[0.02] flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-400 mb-6">
                You can now sign in with your new password.
              </p>
              <Button onClick={() => navigate('/login')} variant="neumorph-primary" className="w-full">
                Go to Sign In
              </Button>
            </div>
          )}
        </div>

        {step !== 'success' && (
          <div className="mt-8 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}
