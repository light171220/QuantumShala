import { defineFunction } from '@aws-amplify/backend'

export const updateLeaderboard = defineFunction({
  name: 'update-leaderboard',
  entry: './handler.ts',
  timeoutSeconds: 120,
  memoryMB: 512,
})
