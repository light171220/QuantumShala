import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Bell,
  Flame,
  Zap,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Menu,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { formatNumber } from '@/utils/format'

interface HeaderProps {
  onMenuClick: () => void
  isMobileMenuOpen: boolean
}

export default function Header({ onMenuClick, isMobileMenuOpen }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)

  return (
    <header className="h-14 md:h-16 bg-neumorph-base/90 backdrop-blur-xl border-b border-white/[0.02] shadow-neumorph-sm flex items-center justify-between px-3 md:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-2 md:gap-4 flex-1">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        <div className="relative max-w-md w-full hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search lessons, circuits, concepts..."
            className="w-full pl-10 pr-4 py-2.5 bg-neumorph-base border border-white/[0.02] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-quantum-500/30 transition-all text-sm shadow-neumorph-inset-xs"
          />
        </div>

        <button
          onClick={() => setShowMobileSearch(!showMobileSearch)}
          className="md:hidden p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 bg-neumorph-base rounded-lg md:rounded-xl border border-white/[0.02] shadow-neumorph-xs md:shadow-neumorph-sm">
          <Flame className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
          <span className="font-semibold text-white text-sm md:text-base">{user?.currentStreak || 0}</span>
          <span className="text-slate-400 text-xs md:text-sm hidden md:inline">day streak</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 bg-neumorph-base rounded-lg md:rounded-xl border border-white/[0.02] shadow-neumorph-xs md:shadow-neumorph-sm">
          <Zap className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />
          <span className="font-semibold text-white text-sm md:text-base">{formatNumber(user?.xp || 0)}</span>
          <span className="text-slate-400 text-xs md:text-sm hidden md:inline">XP</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40 md:hidden" 
                  onClick={() => setShowNotifications(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-80 bg-neumorph-base border border-white/[0.02] rounded-xl md:rounded-2xl shadow-neumorph-md md:shadow-neumorph-lg overflow-hidden z-50 md:w-80"
                >
                  <div className="p-4 border-b border-white/[0.05] flex items-center justify-between">
                    <h3 className="font-semibold text-white">Notifications</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="md:hidden p-1 hover:bg-white/10 rounded"
                    >
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="p-4 text-center text-slate-400">
                      No new notifications
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-quantum-500 to-neon-purple flex items-center justify-center text-white font-semibold text-sm">
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowUserMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-neumorph-base border border-white/[0.02] rounded-xl md:rounded-2xl shadow-neumorph-md md:shadow-neumorph-lg overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-white/[0.05]">
                    <p className="font-semibold text-white truncate">{user?.displayName}</p>
                    <p className="text-sm text-slate-400 truncate">{user?.email}</p>
                    <div className="flex items-center gap-3 mt-3 sm:hidden">
                      <div className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="text-sm text-white">{user?.currentStreak || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-white">{formatNumber(user?.xp || 0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <Link
                      to="/profile"
                      className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        logout()
                        setShowUserMenu(false)
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showMobileSearch && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute left-0 right-0 top-full bg-neumorph-base border-b border-white/[0.02] p-3 md:hidden z-30 shadow-neumorph-md"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                autoFocus
                className="w-full pl-10 pr-10 py-2.5 bg-neumorph-base border border-white/[0.02] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-quantum-500/30 transition-all shadow-neumorph-inset-xs"
              />
              <button
                onClick={() => setShowMobileSearch(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
