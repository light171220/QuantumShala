import { PageSEO } from '@/components/SEO'
import { Cookie, Settings, BarChart, Shield, Mail } from 'lucide-react'

export default function CookiePolicyPage() {
  return (
    <>
      <PageSEO.Cookies />
      
      <div className="min-h-screen py-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-6">
              <Cookie className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Cookie Policy</h1>
            <p className="text-slate-400 text-lg">Last updated: December 2024</p>
          </div>

          {/* Content */}
          <div className="prose prose-invert prose-lg max-w-none">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 mb-8">
              <p className="text-slate-300 leading-relaxed">
                This Cookie Policy explains how QuantumShala uses cookies and similar tracking technologies 
                when you visit our platform. Understanding this policy helps you make informed decisions 
                about your privacy.
              </p>
            </div>

            {/* Section 1 */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">1. What Are Cookies?</h2>
              
              <p className="text-slate-300">
                Cookies are small text files stored on your device when you visit a website. They help 
                websites remember your preferences, keep you logged in, and understand how you use the site.
              </p>
              
              <p className="text-slate-300 mt-4">
                Similar technologies include:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li><strong className="text-white">Local Storage:</strong> Data stored in your browser for faster access</li>
                <li><strong className="text-white">Session Storage:</strong> Temporary data cleared when you close the tab</li>
                <li><strong className="text-white">Pixels:</strong> Tiny images that track page views and actions</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="w-6 h-6 text-amber-400" />
                <h2 className="text-2xl font-semibold text-white m-0">2. Types of Cookies We Use</h2>
              </div>

              {/* Essential Cookies */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 mb-6">
                <h3 className="text-xl font-medium text-green-400 mb-3">Essential Cookies (Required)</h3>
                <p className="text-slate-300 mb-4">
                  These cookies are necessary for the platform to function. They cannot be disabled.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-white">Cookie</th>
                      <th className="text-left py-2 text-white">Purpose</th>
                      <th className="text-left py-2 text-white">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2 font-mono text-xs">auth_token</td>
                      <td className="py-2">Keeps you logged in</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2 font-mono text-xs">csrf_token</td>
                      <td className="py-2">Security protection</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2 font-mono text-xs">session_id</td>
                      <td className="py-2">Session management</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono text-xs">cookie_consent</td>
                      <td className="py-2">Remembers your cookie preferences</td>
                      <td className="py-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Functional Cookies */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 mb-6">
                <h3 className="text-xl font-medium text-blue-400 mb-3">Functional Cookies (Optional)</h3>
                <p className="text-slate-300 mb-4">
                  These cookies enhance your experience by remembering your preferences.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-white">Cookie</th>
                      <th className="text-left py-2 text-white">Purpose</th>
                      <th className="text-left py-2 text-white">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2 font-mono text-xs">theme</td>
                      <td className="py-2">Dark/light mode preference</td>
                      <td className="py-2">1 year</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2 font-mono text-xs">language</td>
                      <td className="py-2">Language preference</td>
                      <td className="py-2">1 year</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono text-xs">simulator_config</td>
                      <td className="py-2">Circuit builder settings</td>
                      <td className="py-2">30 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Analytics Cookies */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart className="w-5 h-5 text-purple-400" />
                  <h3 className="text-xl font-medium text-purple-400 m-0">Analytics Cookies (Optional)</h3>
                </div>
                <p className="text-slate-300 mb-4">
                  These cookies help us understand how users interact with our platform.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-white">Cookie</th>
                      <th className="text-left py-2 text-white">Purpose</th>
                      <th className="text-left py-2 text-white">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2 font-mono text-xs">_ga</td>
                      <td className="py-2">Google Analytics - distinguishes users</td>
                      <td className="py-2">2 years</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2 font-mono text-xs">_gid</td>
                      <td className="py-2">Google Analytics - session tracking</td>
                      <td className="py-2">24 hours</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono text-xs">amplitude_id</td>
                      <td className="py-2">Product analytics</td>
                      <td className="py-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 3 */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">3. Third-Party Cookies</h2>
              
              <p className="text-slate-300">
                Some features integrate third-party services that may set their own cookies:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li><strong className="text-white">AWS Cognito:</strong> Authentication services</li>
                <li><strong className="text-white">Google:</strong> Analytics and OAuth login</li>
                <li><strong className="text-white">Apple:</strong> Sign in with Apple</li>
                <li><strong className="text-white">Stripe:</strong> Payment processing (premium users)</li>
              </ul>
              
              <p className="text-slate-300 mt-4">
                These third parties have their own privacy policies. We encourage you to review them.
              </p>
            </section>

            {/* Section 4 */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-amber-400" />
                <h2 className="text-2xl font-semibold text-white m-0">4. Managing Cookies</h2>
              </div>
              
              <h3 className="text-xl font-medium text-white mt-6 mb-3">Cookie Banner</h3>
              <p className="text-slate-300">
                When you first visit QuantumShala, you'll see a cookie consent banner. You can:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>Accept all cookies</li>
                <li>Accept only essential cookies</li>
                <li>Customize your preferences</li>
              </ul>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Browser Settings</h3>
              <p className="text-slate-300">
                You can also manage cookies through your browser settings:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">Chrome</a></li>
                <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">Firefox</a></li>
                <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">Safari</a></li>
                <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">Edge</a></li>
              </ul>

              <h3 className="text-xl font-medium text-white mt-6 mb-3">Opt-Out Links</h3>
              <ul className="text-slate-300 space-y-2">
                <li><a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">Google Analytics Opt-out</a></li>
                <li><a href="https://youradchoices.com/" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">Digital Advertising Alliance</a></li>
              </ul>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-6">
                <p className="text-amber-200 text-sm m-0">
                  <strong>Note:</strong> Disabling essential cookies may prevent you from logging in 
                  or using certain features of QuantumShala.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">5. Local Storage Usage</h2>
              
              <p className="text-slate-300">
                In addition to cookies, we use browser local storage to:
              </p>
              <ul className="text-slate-300 space-y-2">
                <li>Cache lesson content for offline reading</li>
                <li>Store your quantum circuits locally</li>
                <li>Save code playground drafts</li>
                <li>Remember UI preferences (sidebar state, etc.)</li>
              </ul>
              
              <p className="text-slate-300 mt-4">
                You can clear local storage through your browser's developer tools or settings.
              </p>
            </section>

            {/* Section 6 */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">6. Do Not Track</h2>
              
              <p className="text-slate-300">
                Some browsers offer a "Do Not Track" (DNT) setting. Currently, there is no industry 
                standard for how websites should respond to DNT signals. QuantumShala does not 
                currently respond to DNT signals, but you can opt out of analytics cookies using 
                our cookie preferences.
              </p>
            </section>

            {/* Section 7 */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-4">7. Updates to This Policy</h2>
              
              <p className="text-slate-300">
                We may update this Cookie Policy as our practices change or as required by law. 
                Changes will be posted on this page with an updated "Last modified" date.
              </p>
            </section>

            {/* Contact */}
            <section className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-amber-400" />
                <h2 className="text-2xl font-semibold text-white m-0">Questions?</h2>
              </div>
              
              <p className="text-slate-300 mb-4">
                If you have questions about our use of cookies, please contact:
              </p>
              
              <div className="text-slate-300">
                <p><strong className="text-white">QuantumShala Privacy Team</strong></p>
                <p>Email: <a href="mailto:privacy@quantumshala.com" className="text-amber-400 hover:text-amber-300">privacy@quantumshala.com</a></p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
