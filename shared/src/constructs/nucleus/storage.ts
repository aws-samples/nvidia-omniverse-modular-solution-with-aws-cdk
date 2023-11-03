

import { RemovalPolicy, CfnOutput, Stack, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';

export interface StorageResourcesProps {
    stackName: string;
    removalPolicy: RemovalPolicy,
    autoDelete: boolean;
};

export class StorageResources extends Construct {
    public readonly artifactsBucket: s3.Bucket;
    public readonly logsBucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: StorageResourcesProps) {
        super(scope, id);

        this.logsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
            lifecycleRules: [
                {
                    expiration: Duration.days(7)
                }
            ]
        });

        const sourceBucket = new s3.Bucket(this, 'ArtifactsBucket', {
            bucketName: `${props.stackName}-omniverse-nucleus-artifacts-bucket`,
            autoDeleteObjects: props.autoDelete,
            removalPolicy: props.removalPolicy,
            enforceSSL: true,
            serverAccessLogsPrefix: 'artifacts',
            serverAccessLogsBucket: this.logsBucket
        });

        const artifactsDeployment = new deployment.BucketDeployment(this, "ArtifactsDeployment", {
            sources: [deployment.Source.asset(path.join(__dirname, '..', '..', '..', 'src', 'tools'))],
            destinationBucket: sourceBucket,
            destinationKeyPrefix: "tools",
            extract: true,
            exclude: ["*.DS_Store"]
        });

        this.artifactsBucket = artifactsDeployment.deployedBucket as s3.Bucket;

        /**
         * CFN Outputs
         */
        new CfnOutput(this, "ArtifactsBucketName", {
            value: this.artifactsBucket.bucketName,
        });

        /**
         * CDK Nag
         */
        NagSuppressions.addStackSuppressions(Stack.of(this), [
            {
                id: 'AwsSolutions-IAM4',
                reason: 'CDK BucketDeployment construct auto-generates managed policy',
                appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
            },
            {
                id: 'AwsSolutions-IAM5',
                reason: 'CDK BucketDeployment construct uses IAM policy with wildcards',
                appliesTo: [
                    'Action::s3:GetObject*',
                    'Action::s3:GetBucket*',
                    'Action::s3:List*',
                    'Action::s3:DeleteObject*',
                    'Action::s3:Abort*',
                    'Resource::arn:<AWS::Partition>:s3:::cdk-hnb659fds-assets-070483837758-us-west-2/*',
                    'Resource::<StorageResourcesArtifactsBucket6CCF7943.Arn>/*']
            },
            {
                id: 'AwsSolutions-L1',
                reason: 'CDK BucketDeployment construct uses non-container Lambda runtime'
            }
        ]);
    }
}