import { defineFunction } from '@aws-amplify/backend'

export const submitQuiz = defineFunction({
  name: 'submit-quiz',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
})
