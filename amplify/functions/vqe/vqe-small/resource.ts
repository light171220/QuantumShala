import { defineFunction } from '@aws-amplify/backend'

export const vqeSmall = defineFunction({
  name: 'vqe-small',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  runtime: 20,
  environment: {
    VQE_TIER: 'small',
    MAX_QUBITS: '8',
    LOG_LEVEL: 'INFO',
  },
})
