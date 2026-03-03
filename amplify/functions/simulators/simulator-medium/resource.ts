import { defineFunction } from '@aws-amplify/backend'

export const simulatorMedium = defineFunction({
  name: 'simulator-medium',
  entry: './handler.ts',
  timeoutSeconds: 120,
  memoryMB: 2048,
  runtime: 20,
  environment: {
    SIMULATOR_TIER: 'medium',
    MIN_QUBITS: '13',
    MAX_QUBITS: '18',
  },
})
