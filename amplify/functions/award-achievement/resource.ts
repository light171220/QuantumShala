import { defineFunction } from '@aws-amplify/backend'

export const awardAchievement = defineFunction({
  name: 'award-achievement',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
})
