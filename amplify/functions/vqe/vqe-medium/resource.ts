import { defineFunction } from '@aws-amplify/backend'

export const vqeMedium = defineFunction({
  name: 'vqe-medium',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 2048,
  runtime: 20,
  environment: {
    VQE_TIER: 'medium',
    MIN_QUBITS: '9',
    MAX_QUBITS: '14',
    LOG_LEVEL: 'INFO',
  },
})
