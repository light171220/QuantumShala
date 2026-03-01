import { defineStorage } from '@aws-amplify/backend'

export const storage = defineStorage({
  name: 'quantumshala-storage',
  access: (allow) => ({
    'avatars/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.authenticated.to(['read']),
      allow.guest.to(['read']),
    ],
    'circuits/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
    'code/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
    'notes/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
    'certificates/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
    ],
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
    ],
    'content/lessons/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
      allow.groups(['users', 'admin']).to(['read']),
    ],
    'content/tracks/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
      allow.groups(['users', 'admin']).to(['read']),
    ],
    'simulations/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
    'exports/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
    'rag/embeddings/*': [
      allow.authenticated.to(['read']),
      allow.groups(['admin']).to(['read', 'write', 'delete']),
    ],
  }),
})
