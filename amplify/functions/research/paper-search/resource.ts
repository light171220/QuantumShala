import { defineFunction } from '@aws-amplify/backend'

export const paperSearch = defineFunction({
  name: 'paper-search',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20,
  environment: {
    LOG_LEVEL: 'INFO',
  },
})
