import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { vqeSmall } from './functions/vqe/vqe-small/resource'
import { vqeMedium } from './functions/vqe/vqe-medium/resource'
import { vqeLarge } from './functions/vqe/vqe-large/resource'
import { vqeAdapt } from './functions/vqe/vqe-adapt/resource'
import { simulatorSmall } from './functions/simulators/simulator-small/resource'
import { simulatorMedium } from './functions/simulators/simulator-medium/resource'
import { simulatorLarge } from './functions/simulators/simulator-large/resource'
import { ragIndexer } from './functions/rag-indexer/resource'
import { ragQuery } from './functions/rag-query/resource'
import { aiTutor } from './functions/ai-tutor/resource'
import { qmlEngine } from './functions/qml/qml-engine/resource'
import { paperProcessor } from './functions/research/paper-processor/resource'
import { paperSearch } from './functions/research/paper-search/resource'
import { paperSummarizer } from './functions/research/paper-summarizer/resource'
import { paperInsights } from './functions/research/paper-insights/resource'
import { examProctoring } from './functions/certification/exam-proctoring/resource'
import { certificateGenerator } from './functions/certification/certificate-generator/resource'
import { hardwareSimulator } from './functions/virtual-lab/hardware-simulator/resource'
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { CfnFunction } from 'aws-cdk-lib/aws-lambda'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import { Duration, CfnOutput, Stack } from 'aws-cdk-lib'

const backend = defineBackend({
  auth,
  data,
  storage,
  vqeSmall,
  vqeMedium,
  vqeLarge,
  vqeAdapt,
  simulatorSmall,
  simulatorMedium,
  simulatorLarge,
  ragIndexer,
  ragQuery,
  aiTutor,
  qmlEngine,
  paperProcessor,
  paperSearch,
  paperSummarizer,
  paperInsights,
  examProctoring,
  certificateGenerator,
  hardwareSimulator,
})

const storageBucket = backend.storage.resources.bucket

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

backend.paperProcessor.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
    resources: [
      storageBucket.bucketArn,
      `${storageBucket.bucketArn}/papers/*`,
      `${storageBucket.bucketArn}/research/*`,
    ],
  })
)

const paperProcessorCfn = backend.paperProcessor.resources.lambda.node.defaultChild as CfnFunction
paperProcessorCfn.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName)

backend.paperSearch.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject', 's3:ListBucket'],
    resources: [
      storageBucket.bucketArn,
      `${storageBucket.bucketArn}/research/*`,
    ],
  })
)

const paperSearchCfn = backend.paperSearch.resources.lambda.node.defaultChild as CfnFunction
paperSearchCfn.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName)

backend.paperSummarizer.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject'],
    resources: [
      `${storageBucket.bucketArn}/research/*`,
    ],
  })
)

const paperSummarizerCfn = backend.paperSummarizer.resources.lambda.node.defaultChild as CfnFunction
paperSummarizerCfn.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName)

backend.paperInsights.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject'],
    resources: [
      `${storageBucket.bucketArn}/research/*`,
    ],
  })
)

const paperInsightsCfn = backend.paperInsights.resources.lambda.node.defaultChild as CfnFunction
paperInsightsCfn.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName)

// Certificate Generator permissions
backend.certificateGenerator.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
    resources: [
      storageBucket.bucketArn,
      `${storageBucket.bucketArn}/certificates/*`,
    ],
  })
)

const certificateGeneratorCfn = backend.certificateGenerator.resources.lambda.node.defaultChild as CfnFunction
certificateGeneratorCfn.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName)

const contentDistribution = new cloudfront.Distribution(
  Stack.of(storageBucket),
  'ContentCDN',
  {
    defaultBehavior: {
      origin: origins.S3BucketOrigin.withOriginAccessControl(storageBucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: new cloudfront.CachePolicy(
        Stack.of(storageBucket),
        'ContentCachePolicy',
        {
          cachePolicyName: 'QuantumShalaContentCache',
          defaultTtl: Duration.days(1),
          maxTtl: Duration.days(30),
          minTtl: Duration.hours(1),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
        }
      ),
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      compress: true,
    },
    additionalBehaviors: {
      'content/*': {
        origin: origins.S3BucketOrigin.withOriginAccessControl(storageBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: true,
      },
    },
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    comment: 'QuantumShala Content CDN for learning materials',
  }
)

new CfnOutput(Stack.of(storageBucket), 'ContentCDNUrl', {
  value: `https://${contentDistribution.distributionDomainName}`,
  description: 'CloudFront CDN URL for content delivery',
})

export { backend }
