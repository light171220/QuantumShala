import { defineFunction } from '@aws-amplify/backend'

export const aiTutor = defineFunction({
  name: 'ai-tutor',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 1024,
  runtime: 20,
})
