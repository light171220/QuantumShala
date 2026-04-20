import { defineFunction } from '@aws-amplify/backend'

export const ragQuery = defineFunction({
  name: 'rag-query',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 1024,
  runtime: 20,
})
