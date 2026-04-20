import { useState } from 'react'
import { SEO } from '@/components/SEO'
import { motion } from 'framer-motion'
import {
  Mail,
  MessageSquare,
  MapPin,
  Clock,
  Send,
  CheckCircle,
  Github,
  Twitter,
  Linkedin,
  HelpCircle,
  Bug,
  Lightbulb,
  Building,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const CONTACT_REASONS = [
  { id: 'general', label: 'General Inquiry', icon: HelpCircle },
  { id: 'support', label: 'Technical Support', icon: MessageSquare },
  { id: 'bug', label: 'Bug Report', icon: Bug },
  { id: 'feature', label: 'Feature Request', icon: Lightbulb },
  { id: 'enterprise', label: 'Enterprise / Education', icon: Building },
]

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    reason: 'general',
    subject: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <>
        <SEO
          title="Contact Us"
          description="Get in touch with the QuantumShala team. We're here to help with questions about quantum computing education, technical support, and partnership opportunities."
          url="/contact"
        />
        
        <div className="min-h-screen flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Message Sent!</h1>
            <p className="text-slate-400 mb-8">
              Thank you for reaching out. We typically respond within 24-48 hours.
              Check your email for a confirmation.
            </p>
            <Button onClick={() => setIsSubmitted(false)}>
              Send Another Message
            </Button>
          </motion.div>
        </div>
      </>
    )
  }

  return (
    <>
      <SEO
        title="Contact Us"
        description="Get in touch with the QuantumShala team. We're here to help with questions about quantum computing education, technical support, and partnership opportunities."
        url="/contact"
      />
      
      <div className="min-h-screen py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-6">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Contact Us</h1>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Have a question or feedback? We'd love to hear from you.
                Our team typically responds within 24-48 hours.
              </p>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-1 space-y-8"
            >
              <div className="p-6 rounded-2xl bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm border border-white/[0.02]">
                <h3 className="text-lg font-semibold text-white mb-6">Quick Contact</h3>
                
                <div className="space-y-4">
                  <a
                    href="mailto:hello@quantumshala.com"
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.05] transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Mail className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Email</div>
                      <div className="text-white group-hover:text-cyan-400 transition-colors">
                        hello@quantumshala.com
                      </div>
                    </div>
                  </a>

                  <div className="flex items-center gap-4 p-3 rounded-xl">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <MapPin className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Location</div>
                      <div className="text-white">San Francisco, CA</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 rounded-xl">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Clock className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Response Time</div>
                      <div className="text-white">24-48 hours</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm border border-white/[0.02]">
                <h3 className="text-lg font-semibold text-white mb-4">Follow Us</h3>
                <div className="flex gap-3">
                  <a
                    href="https://github.com/quantumshala"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                  >
                    <Github className="w-5 h-5 text-slate-400" />
                  </a>
                  <a
                    href="https://twitter.com/quantumshala"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                  >
                    <Twitter className="w-5 h-5 text-slate-400" />
                  </a>
                  <a
                    href="https://linkedin.com/company/quantumshala"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                  >
                    <Linkedin className="w-5 h-5 text-slate-400" />
                  </a>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                <h3 className="text-lg font-semibold text-white mb-2">Enterprise & Education</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Looking to bring quantum education to your organization or university?
                </p>
                <a
                  href="mailto:enterprise@quantumshala.com"
                  className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                >
                  enterprise@quantumshala.com →
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-2"
            >
              <form onSubmit={handleSubmit} className="p-8 rounded-2xl bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm border border-white/[0.02]">
                <h3 className="text-xl font-semibold text-white mb-6">Send us a message</h3>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    What can we help you with?
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {CONTACT_REASONS.map((reason) => (
                      <button
                        key={reason.id}
                        type="button"
                        onClick={() => setFormState(s => ({ ...s, reason: reason.id }))}
                        className={`p-3 rounded-xl border transition-all text-center ${
                          formState.reason === reason.id
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                            : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.05]'
                        }`}
                      >
                        <reason.icon className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-xs">{reason.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <Input
                    label="Name"
                    placeholder="Your name"
                    value={formState.name}
                    onChange={(e) => setFormState(s => ({ ...s, name: e.target.value }))}
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={formState.email}
                    onChange={(e) => setFormState(s => ({ ...s, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="mb-4">
                  <Input
                    label="Subject"
                    placeholder="Brief description of your inquiry"
                    value={formState.subject}
                    onChange={(e) => setFormState(s => ({ ...s, subject: e.target.value }))}
                    required
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Message
                  </label>
                  <textarea
                    rows={6}
                    placeholder="Tell us more about your question or feedback..."
                    value={formState.message}
                    onChange={(e) => setFormState(s => ({ ...s, message: e.target.value }))}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  isLoading={isSubmitting}
                  className="w-full md:w-auto"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  )
}
