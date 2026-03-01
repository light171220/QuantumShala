import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchUserAttributes,
  updateUserAttributes,
  updatePassword,
  fetchAuthSession,
} from 'aws-amplify/auth'
import { client } from '@/lib/amplify'

export interface AuthUser {
  id: string
  email: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  isVerified: boolean
  createdAt: string
  level?: number
  xp?: number
  totalXp?: number
  currentStreak?: number
  longestStreak?: number
  groups?: string[]
}

export interface SignUpData {
  email: string
  password: string
  username: string
  displayName?: string
}

export interface SignInData {
  email: string
  password: string
}

export async function authSignUp(data: SignUpData): Promise<{ isSignUpComplete: boolean; userId?: string; nextStep: string }> {
  const { isSignUpComplete, userId, nextStep } = await signUp({
    username: data.email,
    password: data.password,
    options: {
      userAttributes: {
        email: data.email,
        preferred_username: data.username,
        given_name: data.displayName || data.username,
      },
      autoSignIn: true,
    },
  })

  return {
    isSignUpComplete,
    userId,
    nextStep: nextStep.signUpStep,
  }
}

export async function authConfirmSignUp(email: string, code: string): Promise<boolean> {
  const { isSignUpComplete } = await confirmSignUp({
    username: email,
    confirmationCode: code,
  })
  return isSignUpComplete
}

export async function authResendCode(email: string): Promise<void> {
  await resendSignUpCode({ username: email })
}

export async function authSignIn(data: SignInData): Promise<{ isSignedIn: boolean; nextStep: string }> {
  const { isSignedIn, nextStep } = await signIn({
    username: data.email,
    password: data.password,
  })

  return {
    isSignedIn,
    nextStep: nextStep.signInStep,
  }
}

export async function authSignOut(): Promise<void> {
  await signOut()
}

export async function authGetUserGroups(): Promise<string[]> {
  try {
    const session = await fetchAuthSession()
    const groups = session.tokens?.accessToken?.payload?.['cognito:groups'] as string[] | undefined
    return groups || []
  } catch {
    return []
  }
}

export async function authIsAdmin(): Promise<boolean> {
  const groups = await authGetUserGroups()
  return groups.includes('admin')
}

export async function authGetCurrentUser(): Promise<AuthUser | null> {
  try {
    const user = await getCurrentUser()
    const attributes = await fetchUserAttributes()
    const groups = await authGetUserGroups()

    const { data: profiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: user.userId } },
    })

    const profile = profiles?.[0]

    return {
      id: user.userId,
      email: attributes.email || '',
      username: attributes.preferred_username || user.username,
      displayName: profile?.displayName || attributes.given_name || user.username,
      avatar: profile?.avatar || attributes.picture,
      isVerified: attributes.email_verified === 'true',
      createdAt: profile?.joinedAt || new Date().toISOString(),
      groups,
      level: profile?.level || 1,
      xp: profile?.xp || 0,
      totalXp: profile?.totalXp || 0,
      currentStreak: profile?.currentStreak || 0,
      longestStreak: profile?.longestStreak || 0,
    }
  } catch {
    return null
  }
}

export async function authIsAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser()
    return true
  } catch {
    return false
  }
}

export async function authGetSession() {
  try {
    const session = await fetchAuthSession()
    return session
  } catch {
    return null
  }
}

export async function authForgotPassword(email: string): Promise<void> {
  await resetPassword({ username: email })
}

export async function authConfirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await confirmResetPassword({
    username: email,
    confirmationCode: code,
    newPassword,
  })
}

export async function authUpdatePassword(oldPassword: string, newPassword: string): Promise<void> {
  await updatePassword({ oldPassword, newPassword })
}

export async function authUpdateAttributes(attributes: {
  displayName?: string
  avatar?: string
}): Promise<void> {
  const updates: Record<string, string> = {}
  
  if (attributes.displayName) {
    updates.given_name = attributes.displayName
  }
  if (attributes.avatar) {
    updates.picture = attributes.avatar
  }

  if (Object.keys(updates).length > 0) {
    await updateUserAttributes({
      userAttributes: updates,
    })
  }
}

export async function createUserProfile(userId: string, data: {
  username: string
  displayName: string
  email: string
}): Promise<void> {
  await client.models.UserProfile.create({
    userId,
    username: data.username,
    displayName: data.displayName,
    email: data.email,
    level: 1,
    xp: 0,
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    streakFreezesAvailable: 1,
    lessonsCompleted: 0,
    quizzesPassed: 0,
    circuitsCreated: 0,
    totalTimeMinutes: 0,
    joinedAt: new Date().toISOString(),
    isVerified: false,
    isPremium: false,
  })
}

export async function updateUserProfile(userId: string, data: Partial<{
  displayName: string
  bio: string
  avatar: string
  website: string
  location: string
  organization: string
}>): Promise<void> {
  const { data: profiles } = await client.models.UserProfile.list({
    filter: { userId: { eq: userId } },
  })

  if (profiles && profiles.length > 0) {
    const profile = profiles[0]
    await client.models.UserProfile.update({
      userId: profile.userId,
      ...data,
    })
  }
}

export async function getUserProfile(userId: string) {
  const { data: profiles } = await client.models.UserProfile.list({
    filter: { userId: { eq: userId } },
  })
  return profiles?.[0] || null
}
