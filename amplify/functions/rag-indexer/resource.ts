import { defineFunction } from '@aws-amplify/backend'

export const ragIndexer = defineFunction({
  name: 'rag-indexer',
  entry: './handler.ts',
  timeoutSeconds: 900,
  memoryMB: 2048,
  runtime: 20,
})
