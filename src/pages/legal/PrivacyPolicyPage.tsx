import { PageSEO } from '@/components/SEO'
import { Shield, Lock, Eye, Database, Globe, Mail } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageSEO.Privacy />
      
      <div className="min-h-screen py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-6">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
            <p className="text-slate-400 text-lg">Last updated: December 2024</p>
          </div>

          <div className="prose prose-invert prose-lg max-w-none">
            <div className="bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm border border-white/[0.02] rounded-2xl p-8 mb-8">
              <p className="text-slate-300 leading-relaxed">
                At QuantumShala, we take your privacy seriously. This Privacy Policy explains how we collect, 
                use, disclose, and safeguard your information when you use our quantum computing education platform.
              </p>
            </div>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-semibold text-white m-0">1. Information We Collect</h2>
              </div>
              
              <h3 className="text-xl font-medium text-white mt-6 mb-3">Personal Information</h3>
              <p className="text-slate-300">When you create an account, we collect:</p>
              <ul className="text-slate-300 space-y-2">
                <li>Email address</li>
                <li>Username and display name</li>
                <li>Profile picture (optional)</li>
                <li>Authentication credentials (securely hashed)</li>
              </ul>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Learning Data</h3>
              <p className="text-slate-300">To provide personalized learning experiences, we collect:</p>
              <ul className="text-slate-300 space-y-2">
                <li>Course progress and completion status</li>
                <li>Quiz scores and attempts</li>
                <li>Time spent on lessons</li>
                <li>Quantum circuits you create and save</li>
                <li>Code snippets in the playground</li>
              </ul>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Technical Data</h3>
              <p className="text-slate-300">We automatically collect:</p>
              <ul className="text-slate-300 space-y-2">
                <li>IP address and approximate location</li>
                <li>Browser type and version</li>
                <li>Device information</li>
                <li>Usage patterns and analytics</li>
              </ul>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-semibold text-white m-0">2. How We Use Your Information</h2>
              </div>
              
              <p className="text-slate-300">We use your information to:</p>
              <ul className="text-slate-300 space-y-2">
                <li>Provide and maintain our educational services</li>
                <li>Track your learning progress and award achievements</li>
                <li>Personalize your learning experience</li>
                <li>Generate leaderboards and community features</li>
                <li>Send important notifications about your account</li>
                <li>Improve our platform and develop new features</li>
                <li>Ensure platform security and prevent abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-semibold text-white m-0">3. Information Sharing</h2>
              </div>
              
              <p className="text-slate-300">We do not sell your personal information. We may share data with:</p>
              
              <h3 className="text-xl font-medium text-white mt-6 mb-3">Service Providers</h3>
              <p className="text-slate-300">
                We use trusted third-party services for hosting (AWS), authentication, analytics, 
                and email delivery. These providers are contractually bound to protect your data.
              </p>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Public Features</h3>
              <p className="text-slate-300">
                If you choose to make your profile, circuits, or achievements public, this information 
                will be visible to other users. Leaderboard rankings are public by default.
              </p>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Legal Requirements</h3>
              <p className="text-slate-300">
                We may disclose information if required by law, court order, or to protect our rights 
                and the safety of our users.
              </p>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-semibold text-white m-0">4. Data Security</h2>
              </div>
              
              <p className="text-slate-300">We implement industry-standard security measures including:</p>
              <ul className="text-slate-300 space-y-2">
                <li>Encryption in transit (TLS 1.3) and at rest (AES-256)</li>
                <li>Secure authentication with AWS Cognito</li>
                <li>Regular security audits and penetration testing</li>
                <li>Access controls and least-privilege principles</li>
                <li>Automated threat detection and monitoring</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">5. Your Rights</h2>
              
              <p className="text-slate-300">You have the right to:</p>
              <ul className="text-slate-300 space-y-2">
                <li><strong className="text-white">Access:</strong> Request a copy of your personal data</li>
                <li><strong className="text-white">Correct:</strong> Update inaccurate information</li>
                <li><strong className="text-white">Delete:</strong> Request deletion of your account and data</li>
                <li><strong className="text-white">Export:</strong> Download your data in a portable format</li>
                <li><strong className="text-white">Opt-out:</strong> Unsubscribe from marketing communications</li>
                <li><strong className="text-white">Restrict:</strong> Limit how we process your data</li>
              </ul>
              
              <p className="text-slate-300 mt-4">
                To exercise these rights, contact us at{' '}
                <a href="mailto:privacy@quantumshala.com" className="text-cyan-400 hover:text-cyan-300">
                  privacy@quantumshala.com
                </a>
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">6. Data Retention</h2>
              
              <p className="text-slate-300">
                We retain your data for as long as your account is active. Upon account deletion:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>Personal information is deleted within 30 days</li>
                <li>Learning progress and achievements are anonymized</li>
                <li>Public circuits may be retained if shared with others</li>
                <li>Backup data is purged within 90 days</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">7. Children's Privacy</h2>
              
              <p className="text-slate-300">
                QuantumShala is intended for users 13 years and older. We do not knowingly collect 
                personal information from children under 13. If you believe a child has provided us 
                with personal information, please contact us immediately.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">8. International Transfers</h2>
              
              <p className="text-slate-300">
                Your data may be processed in countries outside your residence. We ensure appropriate 
                safeguards are in place, including Standard Contractual Clauses for EU data transfers.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">9. Changes to This Policy</h2>
              
              <p className="text-slate-300">
                We may update this Privacy Policy periodically. We will notify you of significant changes 
                via email or platform notification. Continued use after changes constitutes acceptance.
              </p>
            </section>

            <section className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-semibold text-white m-0">Contact Us</h2>
              </div>
              
              <p className="text-slate-300 mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact:
              </p>
              
              <div className="text-slate-300">
                <p><strong className="text-white">QuantumShala Privacy Team</strong></p>
                <p>Email: <a href="mailto:privacy@quantumshala.com" className="text-cyan-400 hover:text-cyan-300">privacy@quantumshala.com</a></p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
