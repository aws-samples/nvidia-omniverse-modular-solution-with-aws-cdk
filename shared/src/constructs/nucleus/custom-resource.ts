import { Construct } from 'constructs';
import { Duration, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as pyLambda from '@aws-cdk/aws-lambda-python-alpha';
import fs = require('fs');
import crypto = require('crypto');

interface LooseTypeObject {
    [key: string]: any;
}

export type ConstructProps = {
    lambdaName: string;
    lambdaCodePath: string;
    lambdaPolicyDocument: iam.PolicyDocument;
    resourceProps: LooseTypeObject;
    removalPolicy: RemovalPolicy;
    lambdaLayers?: pyLambda.PythonLayerVersion[];
};

export class CustomResource extends Construct {
    public readonly resource: cdk.CustomResource;

    constructor(scope: Construct, id: string, props: ConstructProps) {
        super(scope, id);

        const region: string = Stack.of(this).region;

        const lambdaRole = new iam.Role(this, 'lambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            inlinePolicies: {
                lambdaPolicyDocument: props.lambdaPolicyDocument,
            },
        });

        const lambdaName = `${props.lambdaName}-cr`.slice(0, 64);
        const lambdaLogGroup = `/aws/lambda/${lambdaName}`;

        const logGroup = new logs.LogGroup(this, 'lambdaFnLogGroup', {
            logGroupName: lambdaLogGroup,
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
        });

        const lambdaFn = new pyLambda.PythonFunction(this, 'LambdaFn', {
            functionName: lambdaName,
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: 'handler',
            entry: props.lambdaCodePath,
            role: lambdaRole,
            timeout: Duration.minutes(15),
            layers: props.lambdaLayers || [],
        });
        lambdaFn.node.addDependency(logGroup);

        lambdaFn.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                resources: [logGroup.logGroupArn],
            })
        );

        const provider = new cr.Provider(this, 'CustomResourceProvider', {
            onEventHandler: lambdaFn,
        });

        // force resource to update when code changes
        const fileBuffer = fs.readFileSync(`${props.lambdaCodePath}/index.py`);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');

        props.resourceProps.codeHash = hex;
        props.resourceProps.region = region;

        this.resource = new cdk.CustomResource(this, 'CustomResource', {
            serviceToken: provider.serviceToken,
            properties: props.resourceProps,
        });

        // Nag NagSuppressions
        NagSuppressions.addResourceSuppressions(
            lambdaRole,
            [
                {
                    id: 'AwsSolutions-IAM5',
                    reason:
                        'Wildcard Permissions: Unable to know which objects exist ahead of time. Need to use wildcard',
                },
            ],
            true
        );

        NagSuppressions.addResourceSuppressions(
            provider,
            [
                {
                    id: 'AwsSolutions-IAM4',
                    reason: 'Auto-generated resource with managed policy',
                },
                {
                    id: 'AwsSolutions-IAM5',
                    reason: 'Auto-generated resource with wildcard policy',
                },
                {
                    id: 'AwsSolutions-L1',
                    reason: 'Auto-generated resource not configured to use the latest runtime',
                },
            ],
            true
        );
    }
}
