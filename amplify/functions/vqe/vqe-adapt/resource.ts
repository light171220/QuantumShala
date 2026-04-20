import { defineFunction } from '@aws-amplify/backend'

export const vqeAdapt = defineFunction({
  name: 'vqe-adapt',
  entry: './handler.ts',
  timeoutSeconds: 900,
  memoryMB: 4096,
  runtime: 20,
  environment: {
    VQE_TYPE: 'adapt',
    MAX_QUBITS: '14',
    LOG_LEVEL: 'INFO',
  },
})
