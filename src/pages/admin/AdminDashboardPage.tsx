// @ts-nocheck
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users,
  BookOpen,
  Award,
  Activity,
  TrendingUp,
  Clock,
  Zap,
  FileText,
  ArrowUpRight,
  BarChart3,
  UserPlus,
  Inbox,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { getPlatformStats, getAllUsers, type PlatformStats, type AdminUser } from '@/services/admin'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, usersData] = await Promise.all([
          getPlatformStats(),
          getAllUsers(10),
        ])
        setStats(statsData)
        setRecentUsers(usersData.users.sort((a, b) =>
          new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
        ))
      } catch (error) {
        console.error('Failed to load admin data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const formatTimeAgo = (date: string) => {
    const now = new Date()
    const then = new Date(date)
    const diff = now.getTime() - then.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="text-slate-400">Loading admin data...</div>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.totalUsers || 0,
      change: stats?.newUsersWeek || 0,
      icon: Users,
      color: 'cyan',
    },
    {
      label: 'Active Today',
      value: stats?.activeUsersToday || 0,
      icon: Activity,
      color: 'green',
    },
    {
      label: 'Lessons Completed',
      value: stats?.totalLessonsCompleted || 0,
      icon: BookOpen,
      color: 'purple',
    },
    {
      label: 'Quizzes Passed',
      value: stats?.totalQuizzesPassed || 0,
      icon: Award,
      color: 'amber',
    },
    {
      label: 'Circuits Created',
      value: stats?.totalCircuitsCreated || 0,
      icon: Zap,
      color: 'pink',
    },
    {
      label: 'Total Learning Time',
      value: `${Math.round((stats?.totalTimeMinutes || 0) / 60)}h`,
      icon: Clock,
      color: 'blue',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-slate-400">Monitor platform activity and manage content</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/users"
              className="px-4 py-2 rounded-xl bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-white hover:bg-white/[0.05] transition-colors"
            >
              <Users className="w-4 h-4 inline mr-2" />
              Users
            </Link>
            <Link
              to="/admin/content"
              className="px-4 py-2 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 transition-colors"
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Manage Content
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card variant="neumorph" className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-${stat.color}-500/20`}>
                    <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
                  </div>
                  {stat.change !== undefined && stat.change > 0 && (
                    <span className="flex items-center text-xs font-medium text-green-400">
                      <ArrowUpRight className="w-3 h-3" />
                      +{stat.change}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card variant="neumorph" className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Recent Users</h2>
              <Link to="/admin/users" className="text-sm text-cyan-400 hover:text-cyan-300">
                View all
              </Link>
            </div>

            {recentUsers.length > 0 ? (
              <div className="space-y-3">
                {recentUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-medium">
                      {user.displayName?.charAt(0) || user.username?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">
                        {user.displayName || user.username}
                      </div>
                      <div className="text-sm text-slate-400 truncate">{user.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white">Level {user.level}</div>
                      <div className="text-xs text-slate-500">{formatTimeAgo(user.joinedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Inbox className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-slate-400">No users yet</p>
                <p className="text-sm text-slate-500">Users will appear here when they sign up</p>
              </div>
            )}
          </Card>

          <Card variant="neumorph" className="p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Platform Stats</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                <BarChart3 className="w-8 h-8 text-cyan-400" />
                <div>
                  <div className="text-xl font-bold text-white">{stats?.averageStreak || 0}</div>
                  <div className="text-sm text-slate-400">Avg Streak Days</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                <Users className="w-8 h-8 text-green-400" />
                <div>
                  <div className="text-xl font-bold text-white">{stats?.activeUsersWeek || 0}</div>
                  <div className="text-sm text-slate-400">Active This Week</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                <UserPlus className="w-8 h-8 text-purple-400" />
                <div>
                  <div className="text-xl font-bold text-white">{stats?.newUsersToday || 0}</div>
                  <div className="text-sm text-slate-400">New Today</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                <TrendingUp className="w-8 h-8 text-amber-400" />
                <div>
                  <div className="text-xl font-bold text-white">
                    {stats && stats.totalUsers > 0
                      ? Math.round(stats.totalTimeMinutes / stats.totalUsers)
                      : 0}m
                  </div>
                  <div className="text-sm text-slate-400">Avg Time/User</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
