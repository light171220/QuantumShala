import { defineFunction } from '@aws-amplify/backend'

export const qmlEngine = defineFunction({
  name: 'qml-engine',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 1024,
})
