import { defineFunction } from '@aws-amplify/backend'

export const runVqeLarge = defineFunction({
  name: 'run-vqe-large',
  entry: './handler.ts',
  timeoutSeconds: 900,
  memoryMB: 10240,
})
