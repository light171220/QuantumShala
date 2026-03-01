import { defineFunction } from '@aws-amplify/backend'

export const generateCertificate = defineFunction({
  name: 'generate-certificate',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 1024,
})
