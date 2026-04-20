import { defineFunction } from '@aws-amplify/backend'

export const simulatorLarge = defineFunction({
  name: 'simulator-large',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 10240,
  runtime: 20,
  environment: {
    SIMULATOR_TIER: 'large',
    MIN_QUBITS: '19',
    MAX_QUBITS: '24',
    NODE_OPTIONS: '--max-old-space-size=8192',
  },
})
