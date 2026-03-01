import { defineFunction } from '@aws-amplify/backend'

export const runSimulationSmall = defineFunction({
  name: 'run-simulation-small',
  entry: './handler.ts',
  timeoutSeconds: 120,
  memoryMB: 512,
  runtime: 20,
})
