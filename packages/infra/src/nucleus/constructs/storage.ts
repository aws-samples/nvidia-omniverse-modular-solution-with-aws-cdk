import { RemovalPolicy, CfnOutput, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { OMNI_NUCLEUS_ARTIFACTS_BUCKET_NAME, OMNI_NUCLEUS_LOGS_BUCKET_NAME } from '../../consts';

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

        this.logsBucket = new s3.Bucket(this, 'LogsBucket', {
            bucketName: OMNI_NUCLEUS_LOGS_BUCKET_NAME,
            removalPolicy: RemovalPolicy.RETAIN,
            enforceSSL: true,
            accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
        });

        const sourceBucket = new s3.Bucket(this, 'ArtifactsBucket', {
            bucketName: OMNI_NUCLEUS_ARTIFACTS_BUCKET_NAME,
            autoDeleteObjects: props.autoDelete,
            removalPolicy: props.removalPolicy,
            enforceSSL: true,
            serverAccessLogsPrefix: 'artifacts',
            serverAccessLogsBucket: this.logsBucket
        });

        const artifactsDeployment = new deployment.BucketDeployment(this, "ArtifactsDeployment", {
            sources: [deployment.Source.asset(path.join(__dirname, '..', '..', '..', 'src', 'nucleus', 'tools'))],
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
         * Nag Suppressions
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