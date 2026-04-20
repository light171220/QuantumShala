import { useState } from 'react'
import { SEO } from '@/components/SEO'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  HelpCircle,
  ChevronDown,
  Search,
  BookOpen,
  Cpu,
  CreditCard,
  Shield,
  Users,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface FAQ {
  question: string
  answer: string
}

interface FAQCategory {
  id: string
  name: string
  icon: React.ElementType
  faqs: FAQ[]
}

const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    icon: BookOpen,
    faqs: [
      {
        question: 'Do I need any prior knowledge to start learning quantum computing?',
        answer: 'No! Our Quantum Fundamentals track is designed for complete beginners. We recommend basic familiarity with high school mathematics (algebra, basic trigonometry), but we provide refresher modules on mathematical foundations including complex numbers and linear algebra.',
      },
      {
        question: 'How long does it take to complete a learning track?',
        answer: 'Each track varies in length. The Fundamentals track takes approximately 20-30 hours to complete. More advanced tracks like Quantum Machine Learning or Quantum Error Correction may take 40-60 hours. You can learn at your own pace, and your progress is always saved.',
      },
      {
        question: 'What order should I take the courses in?',
        answer: 'We recommend starting with "Quantum Computing Fundamentals" as it provides the foundation for all other tracks. After that, you can branch into specialized tracks based on your interests: QML for machine learning enthusiasts, PQC for security professionals, or Quantum Chemistry for scientists.',
      },
      {
        question: 'Can I skip lessons or tracks if I already know the material?',
        answer: 'Yes! Each module has an optional assessment quiz at the beginning. If you score 80% or higher, you can skip to more advanced content. This helps experienced learners move quickly through familiar material.',
      },
    ],
  },
  {
    id: 'simulator',
    name: 'Quantum Simulator',
    icon: Cpu,
    faqs: [
      {
        question: 'How many qubits can I simulate?',
        answer: 'Our browser-based simulator supports up to 15 qubits, which allows for 32,768 state amplitudes. This is sufficient for learning and experimenting with most quantum algorithms. For larger simulations, we offer cloud-based simulation with up to 30 qubits for premium users.',
      },
      {
        question: 'Are the simulation results accurate?',
        answer: 'Our simulator uses exact state-vector simulation, meaning results are mathematically accurate representations of ideal quantum computation. Real quantum hardware introduces noise and errors not present in our simulator. For learning purposes, this ideal simulation is actually preferable.',
      },
      {
        question: 'Can I export my circuits to run on real quantum hardware?',
        answer: 'Yes! You can export circuits to Qiskit (Python), Cirq (Python), PennyLane, or OpenQASM format. These can be run on IBM Quantum, Google Quantum AI, Amazon Braket, or other quantum cloud providers with minor modifications.',
      },
      {
        question: 'What gates are available in the circuit builder?',
        answer: 'We support 50+ quantum gates including: single-qubit gates (H, X, Y, Z, S, T, rotations), controlled gates (CNOT, CZ, Toffoli), multi-qubit gates (SWAP, iSWAP), and custom unitary gates. New gates are added regularly based on user feedback.',
      },
    ],
  },
  {
    id: 'account',
    name: 'Account & Billing',
    icon: CreditCard,
    faqs: [
      {
        question: 'Is QuantumShala free to use?',
        answer: 'Yes! Core learning content is free forever, including all fundamental tracks, the circuit simulator (up to 15 qubits), and community features. Premium features like certificates, cloud simulation, and advanced tracks are available with a subscription.',
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and Apple Pay. For enterprise and educational institutions, we also offer invoicing and purchase orders.',
      },
      {
        question: 'Can I cancel my subscription anytime?',
        answer: 'Yes, you can cancel anytime from your account settings. You\'ll retain access to premium features until the end of your billing period. We offer a 14-day money-back guarantee for new subscriptions.',
      },
      {
        question: 'Do you offer student or educator discounts?',
        answer: 'Yes! Students with a valid .edu email get 50% off premium subscriptions. Educators and researchers can apply for free premium access for classroom use. Contact us at education@quantumshala.com for details.',
      },
    ],
  },
  {
    id: 'certificates',
    name: 'Certificates & Credentials',
    icon: Shield,
    faqs: [
      {
        question: 'How do I earn a certificate?',
        answer: 'Certificates are earned by completing all modules and passing all quizzes in a learning track with a score of 70% or higher. Each certificate has a unique credential ID and can be verified on our website.',
      },
      {
        question: 'Are QuantumShala certificates recognized by employers?',
        answer: 'Our certificates are recognized by leading quantum computing companies and research institutions. Many of our curriculum advisors work at IBM, Google, Amazon, and top universities. The certificates demonstrate practical knowledge validated through hands-on assessments.',
      },
      {
        question: 'Can I share my certificates on LinkedIn?',
        answer: 'Absolutely! Each certificate includes a shareable link and can be added directly to your LinkedIn profile. We also provide a digital badge that can be displayed on your portfolio or resume.',
      },
      {
        question: 'Do certificates expire?',
        answer: 'Certificates don\'t expire, but they include the issue date. Given how quickly quantum computing evolves, we recommend refreshing certifications every 2-3 years to demonstrate current knowledge.',
      },
    ],
  },
  {
    id: 'community',
    name: 'Community & Support',
    icon: Users,
    faqs: [
      {
        question: 'How can I get help if I\'m stuck on a lesson?',
        answer: 'You have several options: 1) Use the AI Tutor feature for instant explanations, 2) Check the discussion forum for each lesson, 3) Join our Discord community for peer support, or 4) Contact support for technical issues.',
      },
      {
        question: 'Can I contribute to QuantumShala content?',
        answer: 'Yes! We welcome contributions from the community. You can: submit corrections or improvements to existing content, create and share circuit templates, write guest blog posts, or apply to become a course contributor for advanced topics.',
      },
      {
        question: 'Is there a mobile app?',
        answer: 'Our web platform is fully responsive and works great on mobile devices. A native iOS and Android app is in development and expected to launch in 2025, featuring offline lesson access and push notifications for streaks.',
      },
      {
        question: 'How do I report a bug or request a feature?',
        answer: 'Use the feedback button in the bottom-right corner of any page, or email us at feedback@quantumshala.com. Bug reports that help us improve the platform are rewarded with XP bonuses!',
      },
    ],
  },
]

function FAQItem({ faq, isOpen, onToggle }: { faq: FAQ; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-start justify-between text-left group"
      >
        <span className="text-white font-medium pr-8 group-hover:text-cyan-400 transition-colors">
          {faq.question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-slate-400 leading-relaxed">{faq.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('getting-started')
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const filteredCategories = FAQ_CATEGORIES.map((category) => ({
    ...category,
    faqs: category.faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((category) => category.faqs.length > 0)

  const activeData = searchQuery
    ? filteredCategories
    : FAQ_CATEGORIES.filter((c) => c.id === activeCategory)

  return (
    <>
      <SEO
        title="FAQ - Frequently Asked Questions"
        description="Find answers to common questions about QuantumShala, quantum computing courses, the circuit simulator, certificates, billing, and more."
        url="/faq"
        keywords={['quantum computing FAQ', 'quantum computing questions', 'quantum computing help']}
      />

      <div className="min-h-screen py-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-6">
                <HelpCircle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Frequently Asked Questions
              </h1>
              <p className="text-xl text-slate-400">
                Find answers to common questions about QuantumShala
              </p>
            </motion.div>
          </div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search FAQ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              />
            </div>
          </motion.div>

          {/* Category Tabs (hidden when searching) */}
          {!searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-2 mb-8"
            >
              {FAQ_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    activeCategory === category.id
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-white/[0.02] text-slate-400 border border-white/[0.06] hover:bg-white/[0.05]'
                  }`}
                >
                  <category.icon className="w-4 h-4" />
                  <span>{category.name}</span>
                </button>
              ))}
            </motion.div>
          )}

          {/* FAQ Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {activeData.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 mb-4">No FAQs match your search.</p>
                <Button variant="secondary" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              </div>
            ) : (
              activeData.map((category) => (
                <div key={category.id} className="mb-8">
                  {searchQuery && (
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <category.icon className="w-5 h-5 text-cyan-400" />
                      {category.name}
                    </h2>
                  )}
                  <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                    {category.faqs.map((faq, i) => (
                      <FAQItem
                        key={`${category.id}-${i}`}
                        faq={faq}
                        isOpen={openItems.has(`${category.id}-${i}`)}
                        onToggle={() => toggleItem(`${category.id}-${i}`)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </motion.div>

          {/* Still Need Help */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border border-white/[0.06] text-center"
          >
            <Mail className="w-10 h-10 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Still have questions?</h2>
            <p className="text-slate-400 mb-6">
              Can't find what you're looking for? We're here to help.
            </p>
            <Link to="/contact">
              <Button>Contact Support</Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </>
  )
}
