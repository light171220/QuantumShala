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
    // Create UserGameStats for gamification data
    // Identity data (email, username, verified) is stored in Cognito
    // Settings can be stored in localStorage on the client
    await dataClient.models.UserGameStats.create({
      userId: userAttributes.sub,
      displayName: userAttributes.name || userAttributes.preferred_username || userName,
      avatar: userAttributes.picture || null,
      level: 1,
      xp: 0,
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      streakFreezesAvailable: 1,
      lastActiveAt: new Date().toISOString(),
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
