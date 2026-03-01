import { defineFunction } from '@aws-amplify/backend'

export const updateStreak = defineFunction({
  name: 'update-streak',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
})
