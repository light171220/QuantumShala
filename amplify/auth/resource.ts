import { defineAuth } from '@aws-amplify/backend'
import { postConfirmation } from './post-confirmation/resource'

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
      verificationEmailSubject: 'Welcome to QuantumShala! 🔬',
      verificationEmailBody: (createCode) =>
        `Your QuantumShala verification code is: ${createCode()}\n\nThis code expires in 24 hours.`,
    },
  },
  groups: ['users', 'admin'],
  triggers: {
    postConfirmation,
  },
  access: (allow) => [
    allow.resource(postConfirmation).to(['addUserToGroup']),
  ],
  multifactor: {
    mode: 'OPTIONAL',
    totp: true,
  },
  userAttributes: {
    preferredUsername: {
      required: true,
      mutable: true,
    },
    givenName: {
      required: false,
      mutable: true,
    },
    familyName: {
      required: false,
      mutable: true,
    },
    profilePicture: {
      required: false,
      mutable: true,
    },
  },
  accountRecovery: 'EMAIL_ONLY',
})
