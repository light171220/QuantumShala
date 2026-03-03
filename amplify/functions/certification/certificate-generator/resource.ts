import { defineFunction } from '@aws-amplify/backend'

export const certificateGenerator = defineFunction({
  name: 'certificate-generator',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  runtime: 20,
  environment: {
    LOG_LEVEL: 'INFO',
  },
})
