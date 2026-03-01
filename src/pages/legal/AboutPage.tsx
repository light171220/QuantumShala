import { PageSEO } from '@/components/SEO'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Atom,
  Target,
  Users,
  Globe,
  Heart,
  Sparkles,
  BookOpen,
  Cpu,
  Shield,
  ArrowRight,
  Github,
  Twitter,
  Linkedin,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

const TEAM_MEMBERS = [
  {
    name: 'Dr. Sarah Chen',
    role: 'Founder & CEO',
    bio: 'Former quantum researcher at IBM. PhD in Quantum Computing from MIT.',
    avatar: '👩‍🔬',
  },
  {
    name: 'Alex Rodriguez',
    role: 'Head of Curriculum',
    bio: 'Ex-Google quantum team. 10+ years in quantum algorithm development.',
    avatar: '👨‍💻',
  },
  {
    name: 'Dr. Priya Sharma',
    role: 'Lead Educator',
    bio: 'Former professor at Stanford. Expert in quantum error correction.',
    avatar: '👩‍🏫',
  },
  {
    name: 'Marcus Johnson',
    role: 'Engineering Lead',
    bio: 'Built quantum simulators at AWS Braket. Full-stack expert.',
    avatar: '👨‍🔧',
  },
]

const VALUES = [
  {
    icon: BookOpen,
    title: 'Education First',
    description: 'We believe quantum literacy should be accessible to everyone, not just PhDs.',
  },
  {
    icon: Sparkles,
    title: 'Learn by Doing',
    description: 'Interactive simulations and hands-on labs beat passive learning every time.',
  },
  {
    icon: Users,
    title: 'Community Driven',
    description: 'We build alongside our learners, incorporating feedback into every update.',
  },
  {
    icon: Heart,
    title: 'Free Forever',
    description: 'Core learning content will always be free. Knowledge should have no barriers.',
  },
]

const STATS = [
  { value: '50,000+', label: 'Learners' },
  { value: '150+', label: 'Lessons' },
  { value: '9', label: 'Learning Tracks' },
  { value: '98%', label: 'Satisfaction' },
]

export default function AboutPage() {
  return (
    <>
      <PageSEO.About />
      
      <div className="min-h-screen">
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          </div>
          
          <div className="relative max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-8">
                <Atom className="w-10 h-10 text-white" />
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                Democratizing Quantum Education
              </h1>
              
              <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                QuantumShala is on a mission to prepare humanity for the quantum era. 
                We're building the most comprehensive, accessible, and engaging quantum 
                computing education platform in the world.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="py-16 px-6 border-y border-white/[0.06]">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                    {stat.value}
                  </div>
                  <div className="text-slate-400">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-cyan-400 font-medium">Our Mission</span>
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  Quantum computing will change everything. 
                  <span className="text-cyan-400"> Everyone should understand it.</span>
                </h2>
                
                <p className="text-slate-400 text-lg leading-relaxed mb-6">
                  Quantum computers will revolutionize drug discovery, cryptography, 
                  optimization, and artificial intelligence. Yet quantum education 
                  remains locked behind expensive degrees and obscure textbooks.
                </p>
                
                <p className="text-slate-400 text-lg leading-relaxed">
                  We're changing that. QuantumShala breaks down complex concepts into 
                  digestible lessons, provides hands-on simulation tools, and gamifies 
                  the learning journey. Whether you're a student, developer, or curious 
                  professional, we'll take you from classical to quantum.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="grid grid-cols-2 gap-4"
              >
                {[
                  { icon: Cpu, label: 'Quantum Computing', color: 'cyan' },
                  { icon: Shield, label: 'Post-Quantum Crypto', color: 'purple' },
                  { icon: Sparkles, label: 'Quantum ML', color: 'pink' },
                  { icon: Globe, label: 'Quantum Internet', color: 'green' },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className="p-6 rounded-2xl bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm border border-white/[0.02] text-center"
                  >
                    <item.icon className={`w-8 h-8 mx-auto mb-3 text-${item.color}-400`} />
                    <div className="text-white font-medium">{item.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Our Core Values
              </h2>
              <p className="text-xl text-slate-400">
                The principles that guide everything we build
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {VALUES.map((value, i) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm border border-white/[0.02]"
                >
                  <value.icon className="w-10 h-10 text-cyan-400 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">{value.title}</h3>
                  <p className="text-slate-400">{value.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Meet the Team
              </h2>
              <p className="text-xl text-slate-400">
                Quantum researchers and educators building the future of learning
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {TEAM_MEMBERS.map((member, i) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm border border-white/[0.02] text-center group hover:border-cyan-500/30 transition-colors"
                >
                  <div className="text-5xl mb-4">{member.avatar}</div>
                  <h3 className="text-lg font-semibold text-white mb-1">{member.name}</h3>
                  <div className="text-cyan-400 text-sm mb-3">{member.role}</div>
                  <p className="text-slate-400 text-sm">{member.bio}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-12 rounded-3xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-white/[0.06]"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to start your quantum journey?
              </h2>
              <p className="text-xl text-slate-400 mb-8">
                Join thousands of learners exploring the quantum frontier.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <Link to="/register">
                  <Button size="lg" className="group">
                    Get Started Free
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/learn">
                  <Button variant="secondary" size="lg">
                    Explore Courses
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-center gap-4">
                <a
                  href="https://github.com/quantumshala"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                >
                  <Github className="w-5 h-5 text-slate-400" />
                </a>
                <a
                  href="https://twitter.com/quantumshala"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                >
                  <Twitter className="w-5 h-5 text-slate-400" />
                </a>
                <a
                  href="https://linkedin.com/company/quantumshala"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
                >
                  <Linkedin className="w-5 h-5 text-slate-400" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  )
}
