import type { PostConfirmationTriggerHandler } from 'aws-lambda'
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime'
import { env } from '$amplify/env/post-confirmation'
import type { Schema } from '../../data/resource'

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
Amplify.configure(resourceConfig, libraryOptions)

const dataClient = generateClient<Schema>()
const cognitoClient = new CognitoIdentityProviderClient()

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const { userName, userPoolId, request } = event
  const { userAttributes } = request

  try {
    await dataClient.models.UserProfile.create({
      userId: userAttributes.sub,
      username: userName,
      displayName: userAttributes.name || userAttributes.preferred_username || userName,
      email: userAttributes.email,
      avatar: userAttributes.picture || null,
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
      isVerified: true,
      isPremium: false,
      isBanned: false,
      preferences: JSON.stringify({
        theme: 'dark',
        language: 'en',
        codeEditorTheme: 'vs-dark',
        simulatorShots: 1024,
      }),
      notificationSettings: JSON.stringify({
        email: true,
        push: true,
        achievements: true,
        streakReminders: true,
        weeklyDigest: true,
      }),
      privacySettings: JSON.stringify({
        showProfile: true,
        showProgress: true,
        showAchievements: true,
        showOnLeaderboard: true,
      }),
    })

    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        GroupName: 'users',
        Username: userName,
        UserPoolId: userPoolId,
      })
    )
  } catch (error) {
    console.error('Error in post-confirmation trigger:', error)
  }

  return event
}
