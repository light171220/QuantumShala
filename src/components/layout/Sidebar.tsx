import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  BookOpen,
  Cpu,
  FlaskConical,
  Brain,
  Shield,
  Atom,
  Trophy,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  LayoutDashboard,
  Library,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/stores/authStore'
import { LogoIcon } from '@/components/ui/Logo'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  isMobile: boolean
  onClose: () => void
}

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/learn', icon: BookOpen, label: 'Learn' },
  { path: '/simulator', icon: Cpu, label: 'Simulator' },
  { type: 'divider', label: 'Specialized Hubs' },
  { path: '/hub/qml', icon: Brain, label: 'QML Studio' },
  { path: '/hub/pqc', icon: Shield, label: 'PQC Lab' },
  { path: '/hub/chemistry', icon: FlaskConical, label: 'Chemistry Lab' },
  { path: '/hub/research', icon: Library, label: 'Research Hub' },
  { type: 'divider', label: 'Profile' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/achievements', icon: Atom, label: 'Achievements' },
  { path: '/profile', icon: User, label: 'Profile' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

const adminItems = [
  { type: 'divider', label: 'Admin' },
  { path: '/admin', icon: LayoutDashboard, label: 'Admin Panel' },
]

export default function Sidebar({ isCollapsed, onToggle, isMobile, onClose }: SidebarProps) {
  const location = useLocation()
  const { user, isAdmin } = useAuthStore()

  const allNavItems = isAdmin ? [...navItems, ...adminItems] : navItems

  const sidebarContent = (
    <>
      <div className="p-4 flex items-center justify-between border-b border-white/[0.05]">
        <Link to="/dashboard" className="flex items-center gap-3" onClick={isMobile ? onClose : undefined}>
          <LogoIcon size={40} />
          {(!isCollapsed || isMobile) && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-display font-bold text-lg gradient-text"
            >
              QuantumShala
            </motion.span>
          )}
        </Link>
        {isMobile ? (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {allNavItems.map((item, index) => {
          if (item.type === 'divider') {
            return (
              <div key={index} className="my-4">
                {(!isCollapsed || isMobile) && (
                  <p className={cn(
                    "px-3 text-xs font-medium uppercase tracking-wider",
                    item.label === 'Admin' ? 'text-amber-500' : 'text-slate-500'
                  )}>
                    {item.label}
                  </p>
                )}
                {isCollapsed && !isMobile && <div className="h-px bg-white/10 mx-2" />}
              </div>
            )
          }

          const Icon = item.icon!
          const isActive = location.pathname === item.path || 
            (item.path === '/admin' && location.pathname.startsWith('/admin'))
          const isAdminItem = item.path?.startsWith('/admin')

          return (
            <Link
              key={item.path}
              to={item.path!}
              onClick={isMobile ? onClose : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg md:rounded-xl mb-1 transition-all duration-200 relative',
                isActive
                  ? isAdminItem
                    ? 'bg-neumorph-base text-amber-400 shadow-neumorph-xs border border-amber-500/20'
                    : 'bg-neumorph-base text-quantum-400 shadow-neumorph-xs border border-quantum-500/20'
                  : isAdminItem
                    ? 'text-amber-400/70 hover:text-amber-400 hover:bg-neumorph-light/50'
                    : 'text-slate-400 hover:text-white hover:bg-neumorph-light/50'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 flex-shrink-0', 
                isActive && (isAdminItem ? 'text-amber-400' : 'text-quantum-400')
              )} />
              {(!isCollapsed || isMobile) && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium"
                >
                  {item.label}
                </motion.span>
              )}
              {isActive && (
                <motion.div
                  layoutId={isMobile ? 'activeNavMobile' : 'activeNav'}
                  className={cn(
                    "absolute left-0 w-1 h-8 rounded-r-full",
                    isAdminItem ? 'bg-amber-500' : 'bg-quantum-500'
                  )}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {user && (
        <div className="p-4 border-t border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0",
              isAdmin 
                ? "bg-gradient-to-br from-amber-500 to-orange-600" 
                : "bg-gradient-to-br from-quantum-500 to-neon-purple"
            )}>
              {user.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            {(!isCollapsed || isMobile) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 min-w-0"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">
                    {user.displayName}
                  </p>
                  {isAdmin && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">Level {user.level || 1}</p>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </>
  )

  if (isMobile) {
    return (
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        exit={{ x: -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed left-0 top-0 h-screen w-[280px] bg-neumorph-base/95 backdrop-blur-xl border-r border-white/[0.02] z-50 flex flex-col shadow-neumorph-lg"
      >
        {sidebarContent}
      </motion.aside>
    )
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="fixed left-0 top-0 h-screen bg-neumorph-base/90 backdrop-blur-xl border-r border-white/[0.02] z-40 flex flex-col shadow-neumorph-md"
    >
      {sidebarContent}
    </motion.aside>
  )
}
