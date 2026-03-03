import { defineFunction } from '@aws-amplify/backend'

export const paperProcessor = defineFunction({
  name: 'paper-processor',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 2048,
  runtime: 20,
  environment: {
    LOG_LEVEL: 'INFO',
  },
})
