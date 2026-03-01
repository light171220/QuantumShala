import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  authSignIn,
  authSignUp,
  authSignOut,
  authConfirmSignUp,
  authResendCode,
  authGetCurrentUser,
  authForgotPassword,
  authConfirmForgotPassword,
  createUserProfile,
  updateUserProfile,
  getUserProfile,
  type AuthUser,
} from '@/services/auth'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  error: string | null

  pendingConfirmation: {
    email: string
    username: string
    displayName: string
  } | null

  login: (email: string, password: string) => Promise<{ success: boolean; needsConfirmation?: boolean }>
  register: (email: string, password: string, username: string, displayName?: string) => Promise<{ success: boolean; needsConfirmation?: boolean }>
  confirmSignUp: (code: string) => Promise<boolean>
  resendConfirmationCode: () => Promise<void>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>
  checkAuth: () => Promise<void>
  updateProfile: (data: { displayName?: string; bio?: string; avatar?: string; website?: string; location?: string }) => Promise<void>
  refreshUser: () => Promise<void>
  clearError: () => void
  setPendingConfirmation: (data: { email: string; username: string; displayName: string }) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      isAdmin: false,
      error: null,
      pendingConfirmation: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const result = await authSignIn({ email, password })

          if (result.isSignedIn) {
            const user = await authGetCurrentUser()
            const isAdmin = user?.groups?.includes('admin') || false
            set({ user, isAuthenticated: true, isAdmin, isLoading: false })
            return { success: true }
          } else if (result.nextStep === 'CONFIRM_SIGN_UP') {
            set({
              isLoading: false,
              pendingConfirmation: { email, username: '', displayName: '' }
            })
            return { success: false, needsConfirmation: true }
          }

          set({ isLoading: false })
          return { success: false }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed'
          set({ error: message, isLoading: false })
          return { success: false }
        }
      },

      register: async (email: string, password: string, username: string, displayName?: string) => {
        set({ isLoading: true, error: null })
        try {
          const result = await authSignUp({
            email,
            password,
            username,
            displayName,
          })

          if (result.isSignUpComplete) {
            const user = await authGetCurrentUser()
            if (user) {
              await createUserProfile(user.id, {
                username,
                displayName: displayName || username,
                email,
              })
            }
            const isAdmin = user?.groups?.includes('admin') || false
            set({ user, isAuthenticated: true, isAdmin, isLoading: false })
            return { success: true }
          } else {
            set({
              isLoading: false,
              pendingConfirmation: { email, username, displayName: displayName || username },
            })
            return { success: true, needsConfirmation: true }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Registration failed'
          set({ error: message, isLoading: false })
          return { success: false }
        }
      },

      confirmSignUp: async (code: string) => {
        const { pendingConfirmation } = get()
        if (!pendingConfirmation) {
          set({ error: 'No pending confirmation' })
          return false
        }

        set({ isLoading: true, error: null })
        try {
          const success = await authConfirmSignUp(pendingConfirmation.email, code)

          if (success) {
            set({
              isLoading: false,
              pendingConfirmation: null,
            })
            return true
          }

          set({ isLoading: false })
          return false
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Confirmation failed'
          set({ error: message, isLoading: false })
          return false
        }
      },

      resendConfirmationCode: async () => {
        const { pendingConfirmation } = get()
        if (!pendingConfirmation) {
          set({ error: 'No pending confirmation' })
          return
        }

        try {
          await authResendCode(pendingConfirmation.email)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to resend code'
          set({ error: message })
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          await authSignOut()
          set({
            user: null,
            isAuthenticated: false,
            isAdmin: false,
            isLoading: false,
            pendingConfirmation: null,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Logout failed'
          set({ error: message, isLoading: false })
        }
      },

      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null })
        try {
          await authForgotPassword(email)
          set({ isLoading: false })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to send reset email'
          set({ error: message, isLoading: false })
          throw error
        }
      },

      confirmForgotPassword: async (email: string, code: string, newPassword: string) => {
        set({ isLoading: true, error: null })
        try {
          await authConfirmForgotPassword(email, code, newPassword)
          set({ isLoading: false })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to reset password'
          set({ error: message, isLoading: false })
          throw error
        }
      },

      checkAuth: async () => {
        set({ isLoading: true })
        try {
          const user = await authGetCurrentUser()
          const isAdmin = user?.groups?.includes('admin') || false
          set({
            user,
            isAuthenticated: !!user,
            isAdmin,
            isLoading: false,
          })
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isAdmin: false,
            isLoading: false,
          })
        }
      },

      updateProfile: async (data) => {
        const { user } = get()
        if (!user) return

        set({ isLoading: true, error: null })
        try {
          await updateUserProfile(user.id, data)

          const updatedProfile = await getUserProfile(user.id)
          if (updatedProfile) {
            set({
              user: {
                ...user,
                displayName: updatedProfile.displayName || user.displayName,
                avatar: updatedProfile.avatar || user.avatar,
              },
              isLoading: false,
            })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update profile'
          set({ error: message, isLoading: false })
        }
      },

      refreshUser: async () => {
        try {
          const user = await authGetCurrentUser()
          if (user) {
            const isAdmin = user.groups?.includes('admin') || false
            set({ user, isAuthenticated: true, isAdmin })
          }
        } catch {
        }
      },

      clearError: () => set({ error: null }),

      setPendingConfirmation: (data) => set({ pendingConfirmation: data }),
    }),
    {
      name: 'quantumshala-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
      }),
    }
  )
)
