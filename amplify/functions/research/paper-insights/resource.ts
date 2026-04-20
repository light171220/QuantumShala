import { defineFunction } from '@aws-amplify/backend'

export const paperInsights = defineFunction({
  name: 'paper-insights',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  runtime: 20,
  environment: {
    LOG_LEVEL: 'INFO',
  },
})
