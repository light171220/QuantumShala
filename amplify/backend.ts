import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { runSimulation } from './functions/run-simulation/resource'
import { runSimulationSmall } from './functions/run-simulation-small/resource'
import { runSimulationMedium } from './functions/run-simulation-medium/resource'
import { runSimulationLarge } from './functions/run-simulation-large/resource'
import { runVqe } from './functions/run-vqe/resource'
import { runVqeLarge } from './functions/run-vqe-large/resource'
import { submitQuiz } from './functions/submit-quiz/resource'
import { awardAchievement } from './functions/award-achievement/resource'
import { generateCertificate } from './functions/generate-certificate/resource'
import { updateStreak } from './functions/update-streak/resource'
import { updateLeaderboard } from './functions/update-leaderboard/resource'
import { ragIndexer } from './functions/rag-indexer/resource'
import { ragQuery } from './functions/rag-query/resource'
import { aiTutor } from './functions/ai-tutor/resource'
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { CfnFunction } from 'aws-cdk-lib/aws-lambda'

const backend = defineBackend({
  auth,
  data,
  storage,
  runSimulation,
  runSimulationSmall,
  runSimulationMedium,
  runSimulationLarge,
  runVqe,
  runVqeLarge,
  submitQuiz,
  awardAchievement,
  generateCertificate,
  updateStreak,
  updateLeaderboard,
  ragIndexer,
  ragQuery,
  aiTutor,
})

const storageBucket = backend.storage.resources.bucket

backend.generateCertificate.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:PutObject', 's3:GetObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
)

const generateCertificateCfn = backend.generateCertificate.resources.lambda.node.defaultChild as CfnFunction
generateCertificateCfn.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName)

backend.ragIndexer.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
    resources: [
      storageBucket.bucketArn,
      `${storageBucket.bucketArn}/content/lessons/*`,
      `${storageBucket.bucketArn}/rag/*`,
    ],
  })
)

backend.ragIndexer.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0'],
  })
)

const ragIndexerCfn = backend.ragIndexer.resources.lambda.node.defaultChild as CfnFunction
ragIndexerCfn.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName)

backend.ragQuery.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject', 's3:ListBucket'],
    resources: [
      storageBucket.bucketArn,
      `${storageBucket.bucketArn}/rag/*`,
    ],
  })
)

backend.ragQuery.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0',
      'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0',
    ],
  })
)

const ragQueryCfn = backend.ragQuery.resources.lambda.node.defaultChild as CfnFunction
ragQueryCfn.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName)

backend.aiTutor.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject', 's3:ListBucket'],
    resources: [
      storageBucket.bucketArn,
      `${storageBucket.bucketArn}/rag/*`,
    ],
  })
)

backend.aiTutor.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0',
      'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0',
    ],
  })
)

const aiTutorCfn = backend.aiTutor.resources.lambda.node.defaultChild as CfnFunction
aiTutorCfn.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName)

export { backend }
