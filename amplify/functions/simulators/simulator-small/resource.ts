import { defineFunction } from '@aws-amplify/backend'

export const simulatorSmall = defineFunction({
  name: 'simulator-small',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
  runtime: 20,
  environment: {
    SIMULATOR_TIER: 'small',
    MAX_QUBITS: '12',
  },
})
