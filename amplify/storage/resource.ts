import { defineStorage } from '@aws-amplify/backend'

export const storage = defineStorage({
  name: 'quantumshala-storage',
  access: (allow) => ({
    'avatars/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
    'circuits/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
    ],
    'code/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
    ],
    'notes/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
    ],
    'certificates/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
    'public/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
    'content/lessons/*': [
      allow.authenticated.to(['read']),
      allow.groups(['users', 'admin']).to(['read']),
      allow.guest.to(['read']),
    ],
    'content/tracks/*': [
      allow.authenticated.to(['read']),
      allow.groups(['users', 'admin']).to(['read']),
      allow.guest.to(['read']),
    ],
    'content/chemistry/*': [
      allow.authenticated.to(['read']),
      allow.groups(['users', 'admin']).to(['read']),
      allow.guest.to(['read']),
    ],
    'content/qml/*': [
      allow.authenticated.to(['read']),
      allow.groups(['users', 'admin']).to(['read']),
      allow.guest.to(['read']),
    ],
    'content/pqc/*': [
      allow.authenticated.to(['read']),
      allow.groups(['users', 'admin']).to(['read']),
      allow.guest.to(['read']),
    ],
    'simulations/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
    ],
    'exports/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
    ],
    'rag/embeddings/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
    ],
    'papers/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
    ],
    'research/indexes/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
    ],
    'research/fulltext/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['users', 'admin']).to(['read', 'write', 'delete']),
    ],
  }),
})
