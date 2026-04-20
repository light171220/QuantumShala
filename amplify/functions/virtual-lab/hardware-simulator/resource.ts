import { defineFunction } from '@aws-amplify/backend'

export const hardwareSimulator = defineFunction({
  name: 'hardware-simulator',
  entry: './handler.ts',
  timeoutSeconds: 120,
  memoryMB: 1024,
  runtime: 20,
  environment: {
    LOG_LEVEL: 'INFO',
  },
})
