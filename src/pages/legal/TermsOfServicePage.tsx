import { PageSEO } from '@/components/SEO'
import { FileText, CheckCircle, XCircle, AlertTriangle, Scale, Mail } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <>
      <PageSEO.Terms />
      
      <div className="min-h-screen py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-6">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms of Service</h1>
            <p className="text-slate-400 text-lg">Last updated: December 2024</p>
          </div>

          <div className="prose prose-invert prose-lg max-w-none">
            <div className="bg-neumorph-base shadow-neumorph-xs md:shadow-neumorph-sm border border-white/[0.02] rounded-2xl p-8 mb-8">
              <p className="text-slate-300 leading-relaxed">
                Welcome to QuantumShala! These Terms of Service ("Terms") govern your use of our quantum 
                computing education platform. By accessing or using QuantumShala, you agree to be bound 
                by these Terms.
              </p>
            </div>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              
              <p className="text-slate-300">
                By creating an account or using our services, you confirm that you:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>Are at least 13 years old (or the age of digital consent in your jurisdiction)</li>
                <li>Have the legal capacity to enter into these Terms</li>
                <li>Will comply with all applicable laws and regulations</li>
                <li>Accept our Privacy Policy and Cookie Policy</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">2. Account Registration</h2>
              
              <p className="text-slate-300">When creating an account, you agree to:</p>
              <ul className="text-slate-300 space-y-2">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your login credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Not share your account with others</li>
                <li>Use only one account per person</li>
              </ul>
              
              <p className="text-slate-300 mt-4">
                We reserve the right to suspend or terminate accounts that violate these Terms or engage 
                in fraudulent activity.
              </p>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <h2 className="text-2xl font-semibold text-white m-0">3. Acceptable Use</h2>
              </div>
              
              <p className="text-slate-300">You may use QuantumShala to:</p>
              <ul className="text-slate-300 space-y-2">
                <li>Learn quantum computing concepts and skills</li>
                <li>Build and simulate quantum circuits</li>
                <li>Complete lessons, quizzes, and earn achievements</li>
                <li>Share your circuits and code publicly (if you choose)</li>
                <li>Participate in community discussions</li>
                <li>Export code for personal or educational use</li>
              </ul>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <XCircle className="w-6 h-6 text-red-400" />
                <h2 className="text-2xl font-semibold text-white m-0">4. Prohibited Conduct</h2>
              </div>
              
              <p className="text-slate-300">You may NOT:</p>
              <ul className="text-slate-300 space-y-2">
                <li>Use automated tools to access or scrape content</li>
                <li>Attempt to bypass security measures or access restrictions</li>
                <li>Share, sell, or redistribute course content without permission</li>
                <li>Impersonate others or create fake accounts</li>
                <li>Upload malicious code or exploit vulnerabilities</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Use the platform for commercial purposes without authorization</li>
                <li>Violate intellectual property rights</li>
                <li>Engage in academic dishonesty or cheating</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">5. Intellectual Property</h2>
              
              <h3 className="text-xl font-medium text-white mt-6 mb-3">Our Content</h3>
              <p className="text-slate-300">
                All course materials, lessons, quizzes, images, and platform code are owned by QuantumShala 
                or our licensors. You may not reproduce, distribute, or create derivative works without 
                express permission.
              </p>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Your Content</h3>
              <p className="text-slate-300">
                You retain ownership of circuits, code, and content you create. By sharing content publicly, 
                you grant QuantumShala a non-exclusive license to display, distribute, and promote your work.
              </p>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Open Source</h3>
              <p className="text-slate-300">
                Some features use open-source libraries. Their use is governed by their respective licenses 
                (MIT, Apache 2.0, etc.).
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">6. Subscription & Payments</h2>
              
              <h3 className="text-xl font-medium text-white mt-6 mb-3">Free Tier</h3>
              <p className="text-slate-300">
                Basic access to QuantumShala is free forever. Free users can access fundamental courses, 
                the circuit simulator, and community features.
              </p>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Premium Features</h3>
              <p className="text-slate-300">
                Premium subscriptions provide access to advanced courses, cloud simulation, certificates, 
                and priority support. Pricing and features are displayed before purchase.
              </p>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Refunds</h3>
              <p className="text-slate-300">
                We offer a 14-day money-back guarantee for premium subscriptions. After 14 days, refunds 
                are handled on a case-by-case basis.
              </p>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                <h2 className="text-2xl font-semibold text-white m-0">7. Disclaimers</h2>
              </div>
              
              <p className="text-slate-300">
                QuantumShala is provided "AS IS" without warranties of any kind. We do not guarantee:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>Uninterrupted or error-free service</li>
                <li>Accuracy of simulation results for research purposes</li>
                <li>Compatibility with all devices or browsers</li>
                <li>That courses will meet your specific learning objectives</li>
                <li>Employment or academic outcomes from completing courses</li>
              </ul>
              
              <p className="text-slate-300 mt-4">
                The quantum circuit simulator is for educational purposes. Results should not be used 
                for production quantum computing or critical applications.
              </p>
            </section>

            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <Scale className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-semibold text-white m-0">8. Limitation of Liability</h2>
              </div>
              
              <p className="text-slate-300">
                To the maximum extent permitted by law, QuantumShala and its affiliates shall not be 
                liable for any indirect, incidental, special, consequential, or punitive damages, including:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>Loss of profits, data, or business opportunities</li>
                <li>Service interruptions or data breaches</li>
                <li>Reliance on course content or simulation results</li>
                <li>Third-party actions or content</li>
              </ul>
              
              <p className="text-slate-300 mt-4">
                Our total liability shall not exceed the amount you paid us in the 12 months preceding 
                the claim, or $100, whichever is greater.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">9. Indemnification</h2>
              
              <p className="text-slate-300">
                You agree to indemnify and hold harmless QuantumShala, its officers, employees, and 
                partners from any claims, damages, or expenses arising from:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>Your violation of these Terms</li>
                <li>Your content or conduct on the platform</li>
                <li>Your infringement of third-party rights</li>
                <li>Your violation of applicable laws</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">10. Termination</h2>
              
              <p className="text-slate-300">
                You may terminate your account at any time through account settings. We may suspend or 
                terminate accounts for:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>Violation of these Terms</li>
                <li>Prolonged inactivity (2+ years)</li>
                <li>Legal or regulatory requirements</li>
                <li>Discontinuation of services</li>
              </ul>
              
              <p className="text-slate-300 mt-4">
                Upon termination, your right to use the platform ceases. You may request data export 
                within 30 days of termination.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">11. Governing Law</h2>
              
              <p className="text-slate-300">
                These Terms are governed by the laws of the State of California, USA, without regard 
                to conflict of law principles. Any disputes shall be resolved in the courts of 
                San Francisco County, California.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">12. Changes to Terms</h2>
              
              <p className="text-slate-300">
                We may modify these Terms at any time. Material changes will be communicated via email 
                or platform notification at least 30 days before taking effect. Continued use after 
                changes constitutes acceptance.
              </p>
            </section>

            <section className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-semibold text-white m-0">Contact Us</h2>
              </div>
              
              <p className="text-slate-300 mb-4">
                If you have questions about these Terms, please contact:
              </p>
              
              <div className="text-slate-300">
                <p><strong className="text-white">QuantumShala Legal Team</strong></p>
                <p>Email: <a href="mailto:legal@quantumshala.com" className="text-purple-400 hover:text-purple-300">legal@quantumshala.com</a></p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
