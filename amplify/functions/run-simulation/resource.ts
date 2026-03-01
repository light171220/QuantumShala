import { defineFunction } from '@aws-amplify/backend'

export const runSimulation = defineFunction({
  name: 'run-simulation',
  entry: './handler.ts',
  timeoutSeconds: 600,
  memoryMB: 6144,
  runtime: 20,
})
