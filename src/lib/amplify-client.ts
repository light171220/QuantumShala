import { generateClient } from 'aws-amplify/api'

let _apiClient: ReturnType<typeof generateClient<any>> | null = null

export function getApiClient() {
  if (!_apiClient) {
    _apiClient = generateClient<any>({ authMode: 'userPool' })
  }
  return _apiClient
}

export const client = new Proxy({} as ReturnType<typeof generateClient<any>>, {
  get(_, prop) {
    return getApiClient()[prop as keyof ReturnType<typeof generateClient<any>>]
  }
})
