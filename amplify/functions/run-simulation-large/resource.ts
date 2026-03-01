import { defineFunction } from '@aws-amplify/backend'

export const runSimulationLarge = defineFunction({
  name: 'run-simulation-large',
  entry: './handler.ts',
  timeoutSeconds: 600,
  memoryMB: 3008,
  runtime: 20,
})
