import { useState } from 'react'
import {
  User,
  Bell,
  Code,
  Moon,
  Sun,
  Monitor,
  Save,
  Trash2,
  Download,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useAuthStore } from '@/stores/authStore'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise((r) => setTimeout(r, 1000))
    setIsSaving(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-display font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Manage your account and preferences</p>
      </div>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="profile" className="text-xs md:text-sm">Profile</TabsTrigger>
            <TabsTrigger value="preferences" className="text-xs md:text-sm">Preferences</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs md:text-sm">Notifications</TabsTrigger>
            <TabsTrigger value="editor" className="text-xs md:text-sm">Editor</TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs md:text-sm">Privacy</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-4 md:mt-6">
          <Card variant="neumorph" className="p-4 md:p-6">
            <CardHeader className="p-0 pb-4 md:pb-6">
              <CardTitle className="text-base md:text-lg">Profile Information</CardTitle>
              <CardDescription className="text-xs md:text-sm">Update your personal details</CardDescription>
            </CardHeader>
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-quantum-500 to-neon-purple flex items-center justify-center text-2xl md:text-3xl font-bold text-white flex-shrink-0">
                  {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="text-center sm:text-left">
                  <Button variant="secondary" size="sm">Change Avatar</Button>
                  <p className="text-xs text-slate-400 mt-2">JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <Input
                  label="Display Name"
                  defaultValue={user?.displayName || ''}
                  placeholder="Your name"
                  variant="neumorph"
                />
                <Input
                  label="Username"
                  defaultValue={user?.username || ''}
                  placeholder="username"
                  variant="neumorph"
                />
                <Input
                  label="Email"
                  type="email"
                  defaultValue={user?.email || ''}
                  placeholder="you@example.com"
                  variant="neumorph"
                />
                <Input
                  label="Location"
                  placeholder="City, Country"
                  variant="neumorph"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-300 mb-1.5">Bio</label>
                <textarea
                  className="w-full px-3 md:px-4 py-2 bg-neumorph-base shadow-neumorph-inset-xs md:shadow-neumorph-inset-sm border border-white/[0.02] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-quantum-500 focus:ring-1 focus:ring-quantum-500 resize-none text-sm"
                  rows={3}
                  placeholder="Tell us about yourself..."
                />
              </div>

              <Button onClick={handleSave} variant="neumorph-primary" isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />} size="sm">
                Save Changes
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4 md:mt-6">
          <Card variant="neumorph" className="p-4 md:p-6">
            <CardHeader className="p-0 pb-4 md:pb-6">
              <CardTitle className="text-base md:text-lg">Learning Preferences</CardTitle>
              <CardDescription className="text-xs md:text-sm">Customize your learning experience</CardDescription>
            </CardHeader>
            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-300 mb-2 md:mb-3">Theme</label>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {[
                    { value: 'light', icon: Sun, label: 'Light' },
                    { value: 'dark', icon: Moon, label: 'Dark' },
                    { value: 'system', icon: Monitor, label: 'System' },
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value as typeof theme)}
                      className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all text-sm ${
                        theme === value
                          ? 'bg-quantum-500 text-white shadow-neumorph-pressed'
                          : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-300 hover:shadow-neumorph-sm'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-300 mb-2 md:mb-3">Default Difficulty</label>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {['Beginner', 'Intermediate', 'Advanced'].map((diff) => (
                    <button
                      key={diff}
                      className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-slate-300 hover:shadow-neumorph-sm transition-all text-sm"
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-300 mb-2 md:mb-3">Language</label>
                <select className="w-full px-3 md:px-4 py-2 bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg text-white text-sm">
                  <option>English</option>
                  <option>हिंदी (Hindi)</option>
                  <option>Español</option>
                  <option>Français</option>
                </select>
              </div>

              <Button onClick={handleSave} variant="neumorph-primary" isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />} size="sm">
                Save Preferences
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 md:mt-6">
          <Card variant="neumorph" className="p-4 md:p-6">
            <CardHeader className="p-0 pb-4 md:pb-6">
              <CardTitle className="text-base md:text-lg">Notification Settings</CardTitle>
              <CardDescription className="text-xs md:text-sm">Choose what notifications you receive</CardDescription>
            </CardHeader>
            <div className="space-y-3 md:space-y-4">
              {[
                { id: 'email', label: 'Email Notifications', description: 'Receive updates via email' },
                { id: 'push', label: 'Push Notifications', description: 'Browser push notifications' },
                { id: 'streak', label: 'Streak Reminders', description: 'Daily reminder to maintain streak' },
                { id: 'weekly', label: 'Weekly Digest', description: 'Summary of your progress' },
                { id: 'achievements', label: 'Achievement Alerts', description: 'When you unlock achievements' },
              ].map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 md:p-4 rounded-lg bg-neumorph-base/50 shadow-neumorph-xs border border-white/[0.02]"
                >
                  <div className="min-w-0 mr-3">
                    <p className="font-medium text-white text-sm md:text-base">{item.label}</p>
                    <p className="text-xs md:text-sm text-slate-400 truncate">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-10 h-5 md:w-11 md:h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-quantum-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:bg-quantum-500"></div>
                  </label>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="editor" className="mt-4 md:mt-6">
          <Card variant="neumorph" className="p-4 md:p-6">
            <CardHeader className="p-0 pb-4 md:pb-6">
              <CardTitle className="text-base md:text-lg">Code Editor Settings</CardTitle>
              <CardDescription className="text-xs md:text-sm">Customize the code playground</CardDescription>
            </CardHeader>
            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-300 mb-2 md:mb-3">Editor Theme</label>
                <select className="w-full px-3 md:px-4 py-2 bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg text-white text-sm">
                  <option>VS Dark</option>
                  <option>Monokai</option>
                  <option>GitHub Dark</option>
                  <option>One Dark Pro</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-medium text-slate-300 mb-1.5">Font Size</label>
                  <input
                    type="number"
                    defaultValue={14}
                    min={10}
                    max={24}
                    className="w-full px-3 md:px-4 py-2 bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-medium text-slate-300 mb-1.5">Tab Size</label>
                  <select className="w-full px-3 md:px-4 py-2 bg-neumorph-base shadow-neumorph-inset-xs border border-white/[0.02] rounded-lg text-white text-sm">
                    <option>2 spaces</option>
                    <option>4 spaces</option>
                    <option>Tab</option>
                  </select>
                </div>
              </div>

              <Button onClick={handleSave} variant="neumorph-primary" isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />} size="sm">
                Save Editor Settings
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-4 md:mt-6">
          <div className="space-y-4 md:space-y-6">
            <Card variant="neumorph" className="p-4 md:p-6">
              <CardHeader className="p-0 pb-4 md:pb-6">
                <CardTitle className="text-base md:text-lg">Privacy Settings</CardTitle>
                <CardDescription className="text-xs md:text-sm">Control your data and visibility</CardDescription>
              </CardHeader>
              <div className="space-y-3 md:space-y-4">
                {[
                  { id: 'profile', label: 'Public Profile', description: 'Anyone can see your profile' },
                  { id: 'progress', label: 'Show Progress', description: 'Display learning progress publicly' },
                  { id: 'leaderboard', label: 'Leaderboard Visibility', description: 'Appear on public leaderboards' },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 md:p-4 rounded-lg bg-neumorph-base/50 shadow-neumorph-xs border border-white/[0.02]"
                  >
                    <div className="min-w-0 mr-3">
                      <p className="font-medium text-white text-sm md:text-base">{item.label}</p>
                      <p className="text-xs md:text-sm text-slate-400 truncate">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-10 h-5 md:w-11 md:h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-quantum-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:bg-quantum-500"></div>
                    </label>
                  </div>
                ))}
              </div>
            </Card>

            <Card variant="neumorph" className="p-4 md:p-6">
              <CardHeader className="p-0 pb-4 md:pb-6">
                <CardTitle className="text-base md:text-lg">Data Management</CardTitle>
                <CardDescription className="text-xs md:text-sm">Export or delete your data</CardDescription>
              </CardHeader>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <Button variant="neumorph" leftIcon={<Download className="w-4 h-4" />} size="sm">
                  Export My Data
                </Button>
                <Button variant="danger" leftIcon={<Trash2 className="w-4 h-4" />} size="sm">
                  Delete Account
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
