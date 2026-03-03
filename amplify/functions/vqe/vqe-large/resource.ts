import { defineFunction } from '@aws-amplify/backend'

export const vqeLarge = defineFunction({
  name: 'vqe-large',
  entry: './handler.ts',
  timeoutSeconds: 900,
  memoryMB: 10240,
  runtime: 20,
  environment: {
    VQE_TIER: 'large',
    MIN_QUBITS: '15',
    MAX_QUBITS: '20',
    LOG_LEVEL: 'INFO',
    NODE_OPTIONS: '--max-old-space-size=8192',
  },
})
