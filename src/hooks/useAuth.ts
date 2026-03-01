import { useEffect } from 'react'
import { Hub } from 'aws-amplify/utils'
import { useAuthStore } from '@/stores/authStore'
import { authGetCurrentUser } from '@/services/auth'

export function useAuth() {
  const { checkAuth, logout } = useAuthStore()

  useEffect(() => {
    checkAuth()

    const hubListener = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          checkAuth()
          break
        case 'signedOut':
          logout()
          break
        case 'tokenRefresh':
          checkAuth()
          break
        case 'tokenRefresh_failure':
          logout()
          break
      }
    })

    return () => hubListener()
  }, [checkAuth, logout])

  return useAuthStore()
}
