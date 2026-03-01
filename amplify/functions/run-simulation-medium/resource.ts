import { defineFunction } from '@aws-amplify/backend'

export const runSimulationMedium = defineFunction({
  name: 'run-simulation-medium',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 1536,
  runtime: 20,
})
