import { defineFunction } from '@aws-amplify/backend'

export const runVqe = defineFunction({
  name: 'run-vqe',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 2048,
})
