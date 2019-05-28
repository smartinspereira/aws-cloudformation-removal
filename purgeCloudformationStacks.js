'use strict'

const log = obj => console.log(JSON.stringify(obj, null, 2))

async function purgeCloudformationStacks({ stackName, region, profile }) {
  if (!region) throw new Error('error::region::isNull')
  if (!profile) throw new Error('error::profile::isNull')

  const aws = require('aws-sdk')
  const credentials = new aws.SharedIniFileCredentials({ profile })

  aws.config.region = region
  aws.config.credentials = credentials

  const cloudformationDescribeStacks = async stackName => {
    const cloudformation = new aws.CloudFormation()

    const cloudformationStacks = (await cloudformation.describeStacks(
      { StackName: stackName }
    ).promise()).Stacks

    log({ cloudformationDescribeStacks: { cloudformationStacks } })

    for (let i = 0; i < cloudformationStacks.length; i++) {
      const cloudformationStack = cloudformationStacks[i]
      const stackResources = []

      let nextToken = false
      while (nextToken !== null) {
        const listStackResourcesResponse =
          await cloudformation.listStackResources(
            {
              StackName: cloudformationStack.StackName,
              ...(nextToken ? { NextToken: nextToken } : {})
            }
          ).promise()

        nextToken = listStackResourcesResponse.NextToken || null

        stackResources.push(
          ...listStackResourcesResponse.StackResourceSummaries
        )
      }

      cloudformationStack.StackResources = stackResources
    }

    return cloudformationStacks
  }

  const s3BucketsDeleteObjects = async s3Buckets => {
    const s3 = new aws.S3()

    for (let i = 0; i < s3Buckets.length; i++) {
      const s3Bucket = s3Buckets[i]

      log({ s3BucketsDeleteObjects: { s3Bucket } })

      const objects = (await s3.listObjectsV2(
        { Bucket: s3Bucket.PhysicalResourceId }
      ).promise()).Contents

      log({ s3BucketsDeleteObjects: { objects } })

      if (objects.length) {
        await s3.deleteObjects(
          {
            Bucket: s3Bucket.PhysicalResourceId,
            Delete: {
              Objects: objects.map(({ Key }) => ({ Key })),
              Quiet: true
            }
          }
        ).promise()
      }
    }
  }

  const cognitoDeleteUserPoolDomains = async userPools => {
    const cognito = new aws.CognitoIdentityServiceProvider()

    for (let i = 0; i < userPools.length; i++) {
      const userPool = userPools[i]

      log({ cognitoDeleteUserPoolDomains: { userPool } })

      const userPoolDomain = (await cognito.describeUserPool(
        { UserPoolId: userPool.PhysicalResourceId }
      ).promise()).UserPool.Domain

      log({ cognitoDeleteUserPoolDomains: { userPoolDomain } })

      if (userPoolDomain) {
        await cognito.deleteUserPoolDomain(
          {
            UserPoolId: userPool.PhysicalResourceId,
            Domain: userPoolDomain
          }
        ).promise()
      }
    }
  }

  const cloudformationDeleteStacks = async cloudformationStacks => {
    const cloudformation = new aws.CloudFormation()

    for (let i = 0; i < cloudformationStacks.length; i++) {
      const cloudformationStack = cloudformationStacks[i]

      log({ cloudformationDeleteStacks: { cloudformationStack } })

      await cloudformation.deleteStack(
        { StackName: cloudformationStack.StackName }
      ).promise()
    }
  }

  const cloudformationStacks = await cloudformationDescribeStacks(stackName)

  try {
    await s3BucketsDeleteObjects(
      cloudformationStacks.reduce(
        (s3Buckets, cloudformationStack) => [
          ...s3Buckets,
          ...cloudformationStack.StackResources.filter(
            stackResource => stackResource.ResourceType === 'AWS::S3::Bucket'
          )
        ],
        []
      )
    )
  } catch (error) {
    log({ s3BucketsDeleteObjects: { error } })
  }

  try {
    await cognitoDeleteUserPoolDomains(
      cloudformationStacks.reduce(
        (userPools, cloudformationStack) => [
          ...userPools,
          ...cloudformationStack.StackResources.filter(
            stackResource =>
              stackResource.ResourceType === 'AWS::Cognito::UserPool'
          )
        ],
        []
      )
    )
  } catch (error) {
    log({ cognitoDeleteUserPoolDomains: { error } })
  }

  try {
    await cloudformationDeleteStacks(cloudformationStacks)
  } catch (error) {
    log({ cloudformationDeleteStacks: { error } })
  }
}

module.exports = purgeCloudformationStacks
