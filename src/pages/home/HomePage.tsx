import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import {
  Atom,
  Brain,
  Shield,
  Sparkles,
  Zap,
  ArrowRight,
  Play,
  Users,
  BookOpen,
  Code,
  Trophy,
  ChevronRight,
  Cpu,
  GraduationCap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LogoIcon } from '@/components/ui/Logo'

function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)',
          left: '-20%',
          top: '-20%',
        }}
        animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)',
          right: '-10%',
          top: '30%',
        }}
        animate={{ x: [0, -30, 0], y: [0, 50, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 70%)',
          left: '30%',
          bottom: '-10%',
        }}
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '100px 100px',
        }}
      />
    </div>
  )
}

function FloatingIcons() {
  const icons = [
    { Icon: Atom, x: '10%', y: '20%', delay: 0, color: '#0ea5e9' },
    { Icon: Brain, x: '85%', y: '15%', delay: 1, color: '#8b5cf6' },
    { Icon: Shield, x: '75%', y: '60%', delay: 2, color: '#ec4899' },
    { Icon: Zap, x: '15%', y: '70%', delay: 0.5, color: '#22c55e' },
    { Icon: Cpu, x: '90%', y: '80%', delay: 1.5, color: '#f59e0b' },
  ]

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {icons.map(({ Icon, x, y, delay, color }, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: x, top: y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.2, scale: 1 }}
          transition={{ delay: delay + 0.5, duration: 0.5 }}
        >
          <motion.div
            animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon size={40 + i * 10} style={{ color }} />
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description, gradient, delay }: { 
  icon: React.ElementType; title: string; description: string; gradient: string; delay: number 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="group relative"
    >
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
        style={{ background: gradient }}
      />
      <div className="relative h-full p-8 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:border-white/[0.15] transition-all duration-300">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6" style={{ background: gradient }}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
        <p className="text-slate-400 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

function PathCard({ title, description, modules, hours, level, gradient, href, delay }: { 
  title: string; description: string; modules: number; hours: number; level: string; gradient: string; href: string; delay: number 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
    >
      <Link to={href}>
        <div className="group relative h-full p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" style={{ background: gradient }} />
          <div className="flex items-start justify-between mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-slate-300">{level}</span>
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-400 mb-4 line-clamp-2">{description}</p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>{modules} modules</span>
            <span>•</span>
            <span>{hours}+ hours</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95])
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, 100])

  return (
    <div className="relative">
      <section ref={heroRef} className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
        <ParticleField />
        <FloatingIcons />
        
        <motion.div className="relative z-10 max-w-6xl mx-auto px-6 py-32 text-center" style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1] mb-8"
          >
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-slate-300">Now with NIST Post-Quantum Standards</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight"
          >
            <span className="text-white">Master the</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              Quantum Future
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            The most comprehensive quantum computing education platform. 
            From fundamentals to cutting-edge research, learn at your own pace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link to="/register">
              <Button size="lg" className="group px-8 py-4 text-lg">
                Start Learning Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/simulator">
              <Button variant="secondary" size="lg" className="px-8 py-4 text-lg">
                <Play className="mr-2 w-5 h-5" />
                Try Simulator
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          >
            {[
              { value: '9', label: 'Learning Tracks' },
              { value: '150+', label: 'Interactive Lessons' },
              { value: '500+', label: 'Practice Problems' },
              { value: '50+', label: 'Quantum Gates' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2"
          >
            <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-1.5 h-3 bg-white/40 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      <section className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Everything you need to learn quantum</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">A complete learning ecosystem designed for the quantum age</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={BookOpen} title="Structured Learning Paths" description="Follow expert-curated tracks from mathematical foundations to advanced quantum algorithms and real-world applications." gradient="linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)" delay={0.1} />
            <FeatureCard icon={Code} title="Interactive Simulator" description="Build and run quantum circuits in your browser. Supports up to 15 qubits with real-time state visualization." gradient="linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)" delay={0.2} />
            <FeatureCard icon={Shield} title="Post-Quantum Cryptography" description="Learn the latest NIST standardized algorithms: ML-KEM, ML-DSA, and SLH-DSA with hands-on labs." gradient="linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)" delay={0.3} />
            <FeatureCard icon={Brain} title="Quantum Machine Learning" description="Explore variational circuits, quantum neural networks, and hybrid classical-quantum algorithms." gradient="linear-gradient(135deg, #10b981 0%, #14b8a6 100%)" delay={0.4} />
            <FeatureCard icon={Trophy} title="Gamified Progress" description="Earn XP, unlock achievements, climb leaderboards, and maintain learning streaks to stay motivated." gradient="linear-gradient(135deg, #f59e0b 0%, #f97316 100%)" delay={0.5} />
            <FeatureCard icon={Users} title="Community & Support" description="Join discussions, share circuits, get help from AI tutors, and connect with fellow quantum enthusiasts." gradient="linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)" delay={0.6} />
          </div>
        </div>
      </section>

      <section className="relative py-32 px-6 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Choose your quantum journey</h2>
              <p className="text-xl text-slate-400">9 specialized tracks for every skill level</p>
            </div>
            <Link to="/learn" className="mt-4 md:mt-0">
              <Button variant="secondary" className="group">
                View all tracks
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <PathCard title="Quantum Computing Fundamentals" description="Build a solid foundation with math, quantum mechanics, and core concepts" modules={6} hours={40} level="Beginner" gradient="linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)" href="/learn/01-quantum-computing-fundamentals" delay={0.1} />
            <PathCard title="Quantum Machine Learning" description="Master variational algorithms and quantum neural networks" modules={8} hours={35} level="Intermediate" gradient="linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)" href="/learn/02-quantum-machine-learning" delay={0.2} />
            <PathCard title="Post-Quantum Cryptography" description="Learn NIST-standardized algorithms for the quantum era" modules={5} hours={25} level="Specialized" gradient="linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)" href="/learn/08-post-quantum-cryptography" delay={0.3} />
            <PathCard title="Quantum Error Correction" description="Master fault-tolerant quantum computing techniques" modules={6} hours={30} level="Advanced" gradient="linear-gradient(135deg, #f59e0b 0%, #f97316 100%)" href="/learn/04-quantum-error-correction" delay={0.4} />
            <PathCard title="Quantum Chemistry" description="Simulate molecules and chemical reactions with VQE" modules={5} hours={28} level="Specialized" gradient="linear-gradient(135deg, #10b981 0%, #14b8a6 100%)" href="/learn/05-quantum-chemistry" delay={0.5} />
            <PathCard title="Quantum Networking" description="Explore quantum communication and the quantum internet" modules={5} hours={22} level="Advanced" gradient="linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)" href="/learn/07-quantum-networking" delay={0.6} />
          </div>
        </div>
      </section>

      <section className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Build quantum circuits<br />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">in your browser</span>
              </h2>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                Our visual circuit builder lets you drag and drop gates, run simulations, and see results instantly. Export to Qiskit, Cirq, or OpenQASM.
              </p>
              <ul className="space-y-4 mb-8">
                {['Up to 15 qubits in browser simulation', '50+ quantum gates including custom unitaries', 'Real-time state vector visualization', 'Bloch sphere representation', 'Export to multiple frameworks'].map((item, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 * i }} className="flex items-center gap-3 text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    {item}
                  </motion.li>
                ))}
              </ul>
              <Link to="/simulator/circuit">
                <Button size="lg" className="group">
                  Launch Circuit Builder
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.02] bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm backdrop-blur-sm">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-sm text-slate-400">Bell State Circuit</span>
                </div>
                <div className="p-6">
                  <svg className="w-full h-48" viewBox="0 0 400 150">
                    <line x1="40" y1="50" x2="360" y2="50" stroke="#334155" strokeWidth="2" />
                    <line x1="40" y1="100" x2="360" y2="100" stroke="#334155" strokeWidth="2" />
                    <text x="20" y="55" fill="#64748b" fontSize="14" fontFamily="monospace">q₀</text>
                    <text x="20" y="105" fill="#64748b" fontSize="14" fontFamily="monospace">q₁</text>
                    <rect x="80" y="30" width="40" height="40" rx="4" fill="#0ea5e9" />
                    <text x="100" y="55" fill="white" fontSize="16" fontWeight="bold" textAnchor="middle">H</text>
                    <circle cx="180" cy="50" r="6" fill="#8b5cf6" />
                    <line x1="180" y1="50" x2="180" y2="100" stroke="#8b5cf6" strokeWidth="2" />
                    <circle cx="180" cy="100" r="12" fill="none" stroke="#8b5cf6" strokeWidth="2" />
                    <line x1="168" y1="100" x2="192" y2="100" stroke="#8b5cf6" strokeWidth="2" />
                    <line x1="180" y1="88" x2="180" y2="112" stroke="#8b5cf6" strokeWidth="2" />
                    <rect x="260" y="30" width="40" height="40" rx="4" fill="#334155" stroke="#64748b" />
                    <path d="M270 55 L280 45 L290 55" stroke="#64748b" fill="none" strokeWidth="2" />
                    <line x1="280" y1="45" x2="280" y2="60" stroke="#64748b" strokeWidth="2" />
                    <rect x="260" y="80" width="40" height="40" rx="4" fill="#334155" stroke="#64748b" />
                    <path d="M270 105 L280 95 L290 105" stroke="#64748b" fill="none" strokeWidth="2" />
                    <line x1="280" y1="95" x2="280" y2="110" stroke="#64748b" strokeWidth="2" />
                  </svg>
                  <div className="mt-4 p-4 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
                    <div className="text-sm text-slate-400 mb-2">Simulation Results (1024 shots)</div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-mono text-cyan-400">|00⟩</span>
                          <span className="text-white">50.2%</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full w-1/2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-mono text-purple-400">|11⟩</span>
                          <span className="text-white">49.8%</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full w-1/2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-3xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative p-12 rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.15),transparent_70%)]" />
            <div className="relative z-10">
              <GraduationCap className="w-16 h-16 mx-auto mb-6 text-cyan-400" />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Start your quantum journey today</h2>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">Join thousands of learners mastering quantum computing. Free forever, no credit card required.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register">
                  <Button size="lg" className="group px-8 py-4 text-lg">
                    Create Free Account
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/learn">
                  <Button variant="secondary" size="lg" className="px-8 py-4 text-lg">Explore Courses</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <LogoIcon size={40} />
              <span className="text-xl font-bold gradient-text">QuantumShala</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">About</a>
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
              <a href="#" className="hover:text-white transition-colors">Community</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
            <div className="text-sm text-slate-500">© 2024 QuantumShala. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
