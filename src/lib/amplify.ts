import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'

let _client: ReturnType<typeof generateClient<any>> | null = null

export const client = {
  get models() {
    if (!_client) {
      _client = generateClient<any>()
    }
    return _client.models
  },
  get queries() {
    if (!_client) {
      _client = generateClient<any>()
    }
    return (_client as any).queries
  },
  get mutations() {
    if (!_client) {
      _client = generateClient<any>()
    }
    return (_client as any).mutations
  },
}

export function isAmplifyConfigured(): boolean {
  try {
    const config = Amplify.getConfig()
    return !!(
      config.Auth?.Cognito?.userPoolId &&
      !config.Auth.Cognito.userPoolId.includes('PLACEHOLDER')
    )
  } catch {
    return false
  }
}

export function canMakeAPICalls(): boolean {
  try {
    const config = Amplify.getConfig()
    return !!(
      config.API?.GraphQL?.endpoint &&
      !config.API.GraphQL.endpoint.includes('PLACEHOLDER')
    )
  } catch {
    return false
  }
}

export { Amplify }
