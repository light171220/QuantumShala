// @ts-nocheck
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search,
  Ban,
  Crown,
  Mail,
  Clock,
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  MoreVertical,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  getAllUsers,
  getUserActivity,
  banUser,
  updateUserPremium,
  type AdminUser,
  type UserActivity
} from '@/services/admin'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'joinedAt' | 'lastActiveAt' | 'totalXp' | 'level'>('joinedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'premium' | 'banned' | 'active'>('all')
  const pageSize = 20

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [users, searchQuery, sortBy, sortOrder, filter])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const { users } = await getAllUsers(1000)
      setUsers(users)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...users]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(u =>
        u.username.toLowerCase().includes(query) ||
        u.displayName?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
      )
    }

    switch (filter) {
      case 'premium':
        filtered = filtered.filter(u => u.isPremium)
        break
      case 'banned':
        filtered = filtered.filter(u => u.isBanned)
        break
      case 'active': {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        filtered = filtered.filter(u => u.lastActiveAt && new Date(u.lastActiveAt) >= weekAgo)
        break
      }
    }

    filtered.sort((a, b) => {
      let aVal: string | number = a[sortBy] as string | number
      let bVal: string | number = b[sortBy] as string | number

      if (sortBy === 'joinedAt' || sortBy === 'lastActiveAt') {
        aVal = new Date(aVal || 0).getTime()
        bVal = new Date(bVal || 0).getTime()
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    setFilteredUsers(filtered)
    setPage(1)
  }

  const handleSelectUser = async (user: AdminUser) => {
    setSelectedUser(user)
    setIsLoadingActivity(true)
    try {
      const activity = await getUserActivity(user.id)
      setUserActivity(activity)
    } catch (error) {
      console.error('Failed to load user activity:', error)
    } finally {
      setIsLoadingActivity(false)
    }
  }

  const handleBanUser = async (userId: string, banned: boolean) => {
    if (!confirm(`Are you sure you want to ${banned ? 'ban' : 'unban'} this user?`)) return

    try {
      await banUser(userId, banned)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned: banned } : u))
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, isBanned: banned })
      }
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  const handleTogglePremium = async (userId: string, isPremium: boolean) => {
    try {
      await updateUserPremium(userId, isPremium)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isPremium } : u))
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, isPremium })
      }
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTimeAgo = (date: string) => {
    const now = new Date()
    const then = new Date(date)
    const diff = now.getTime() - then.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 30) return `${days}d ago`
    return formatDate(date)
  }

  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filteredUsers.length / pageSize)

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/admin" className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-1">User Management</h1>
            <p className="text-slate-400">{users.length.toLocaleString()} total users</p>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <Card variant="neumorph" className="p-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(['all', 'active', 'premium', 'banned'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        filter === f
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [by, order] = e.target.value.split('-')
                    setSortBy(by as 'joinedAt' | 'lastActiveAt' | 'totalXp' | 'level')
                    setSortOrder(order as 'asc' | 'desc')
                  }}
                  className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm"
                >
                  <option value="joinedAt-desc">Newest First</option>
                  <option value="joinedAt-asc">Oldest First</option>
                  <option value="lastActiveAt-desc">Recently Active</option>
                  <option value="totalXp-desc">Highest XP</option>
                  <option value="level-desc">Highest Level</option>
                </select>
              </div>
            </Card>

            <Card variant="neumorph" className="overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left p-4 text-sm font-medium text-slate-400">User</th>
                          <th className="text-left p-4 text-sm font-medium text-slate-400">Level</th>
                          <th className="text-left p-4 text-sm font-medium text-slate-400">XP</th>
                          <th className="text-left p-4 text-sm font-medium text-slate-400">Streak</th>
                          <th className="text-left p-4 text-sm font-medium text-slate-400">Joined</th>
                          <th className="text-left p-4 text-sm font-medium text-slate-400">Last Active</th>
                          <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                          <th className="p-4"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedUsers.map(user => (
                          <tr
                            key={user.id}
                            onClick={() => handleSelectUser(user)}
                            className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                              selectedUser?.id === user.id
                                ? 'bg-cyan-500/10'
                                : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-medium">
                                  {user.displayName?.charAt(0) || user.username?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <div className="font-medium text-white">{user.displayName || user.username}</div>
                                  <div className="text-sm text-slate-500">@{user.username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-medium text-white">{user.level}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-300">{user.totalXp.toLocaleString()}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-300">{user.currentStreak}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-400">{formatDate(user.joinedAt)}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-400">
                                {user.lastActiveAt ? formatTimeAgo(user.lastActiveAt) : 'Never'}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {user.isPremium && (
                                  <Badge variant="default" className="bg-amber-500/20 text-amber-400">
                                    Premium
                                  </Badge>
                                )}
                                {user.isBanned && (
                                  <Badge variant="destructive">Banned</Badge>
                                )}
                                {user.isVerified && (
                                  <Badge variant="secondary">Verified</Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <button className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between p-4 border-t border-white/[0.06]">
                    <span className="text-sm text-slate-400">
                      Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="neumorph-ghost"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-white px-3">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="neumorph-ghost"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>

          {selectedUser && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-96 flex-shrink-0"
            >
              <Card variant="neumorph" className="sticky top-6">
                <div className="p-6 border-b border-white/[0.06]">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                      {selectedUser.displayName?.charAt(0) || selectedUser.username?.charAt(0)}
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1">
                    {selectedUser.displayName || selectedUser.username}
                  </h3>
                  <p className="text-slate-400">@{selectedUser.username}</p>
                  {selectedUser.email && (
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" />
                      {selectedUser.email}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    {selectedUser.isPremium && (
                      <Badge variant="default" className="bg-amber-500/20 text-amber-400">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                    {selectedUser.isBanned && (
                      <Badge variant="destructive">Banned</Badge>
                    )}
                  </div>
                </div>

                <div className="p-6 border-b border-white/[0.06]">
                  <h4 className="text-sm font-medium text-slate-400 mb-4">Statistics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-white">{selectedUser.level}</div>
                      <div className="text-sm text-slate-500">Level</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{selectedUser.totalXp.toLocaleString()}</div>
                      <div className="text-sm text-slate-500">Total XP</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{selectedUser.currentStreak}</div>
                      <div className="text-sm text-slate-500">Current Streak</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{selectedUser.lessonsCompleted}</div>
                      <div className="text-sm text-slate-500">Lessons</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-b border-white/[0.06]">
                  <h4 className="text-sm font-medium text-slate-400 mb-4">Recent Activity</h4>
                  {isLoadingActivity ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    </div>
                  ) : userActivity.length > 0 ? (
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {userActivity.slice(0, 10).map(activity => (
                        <div key={activity.id} className="flex items-center gap-3 text-sm">
                          <div className={`p-1.5 rounded ${
                            activity.type === 'lesson_complete' ? 'bg-green-500/20' :
                            activity.type === 'quiz_submit' ? 'bg-amber-500/20' :
                            'bg-cyan-500/20'
                          }`}>
                            {activity.type === 'lesson_complete' && <BookOpen className="w-3 h-3 text-green-400" />}
                            {activity.type === 'quiz_submit' && <Award className="w-3 h-3 text-amber-400" />}
                            {activity.type === 'lesson_start' && <Clock className="w-3 h-3 text-cyan-400" />}
                          </div>
                          <div className="flex-1">
                            <span className="text-slate-300">
                              {activity.type.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatTimeAgo(activity.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No activity yet</p>
                  )}
                </div>

                <div className="p-6 space-y-3">
                  <Button
                    variant="neumorph-secondary"
                    className="w-full justify-start"
                    onClick={() => handleTogglePremium(selectedUser.id, !selectedUser.isPremium)}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {selectedUser.isPremium ? 'Remove Premium' : 'Grant Premium'}
                  </Button>

                  <Button
                    variant={selectedUser.isBanned ? 'neumorph-secondary' : 'neumorph-ghost'}
                    className={`w-full justify-start ${!selectedUser.isBanned && 'text-red-400 hover:bg-red-500/10'}`}
                    onClick={() => handleBanUser(selectedUser.id, !selectedUser.isBanned)}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    {selectedUser.isBanned ? 'Unban User' : 'Ban User'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
