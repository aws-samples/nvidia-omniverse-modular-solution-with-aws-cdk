import { Construct } from 'constructs';
import { Stack, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { CustomResource } from './custom-resource';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as pyLambda from '@aws-cdk/aws-lambda-python-alpha';
import { AutoScalingResources } from './autoscaling';
import path from 'path';

export interface ReverseProxyResourcesProps {
    stackName: string,
    rootDomain: string,
    nucleusServerPrefix: string,
    removalPolicy: RemovalPolicy;
    artifactsBucket: s3.IBucket;
    vpc: ec2.Vpc;
    subnets: ec2.ISubnet[];
    securityGroup: ec2.SecurityGroup;
    lambdaLayers: pyLambda.PythonLayerVersion[];
    nucleusServerRoute: string;
};

export class ReverseProxyResources extends Construct {
    public readonly autoScalingGroup: AutoScalingGroup;

    constructor(scope: Construct, id: string, props: ReverseProxyResourcesProps) {
        super(scope, id);

        const region: string = Stack.of(this).region;
        const account: string = Stack.of(this).account;

        const instanceRole = new iam.Role(this, 'ReverseProxyInstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: 'EC2 Instance Role',
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
            inlinePolicies: {
                reverseProxyInstancePolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            resources: [
                                `${props.artifactsBucket.bucketArn}`,
                                `${props.artifactsBucket.bucketArn}/*`,
                            ],
                            actions: ['s3:ListBucket', 's3:GetObject'],
                        }),
                        new iam.PolicyStatement({
                            actions: [
                                'logs:CreateLogGroup',
                                'logs:CreateLogStream',
                                'logs:DescribeLogStreams',
                                'logs:PutLogEvents',
                            ],
                            resources: [`arn:aws:logs:${region}:${account}:log-group:/aws/ssm/*`],
                        }),
                    ],
                }),
            }
        });

        const ebsVolume: ec2.BlockDevice = {
            deviceName: '/dev/xvda',
            volume: ec2.BlockDeviceVolume.ebs(8, {
                encrypted: true,
            }),
        };

        /**
         * Auto Scaling Resources
         */
        const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
            launchTemplateName: `${props.stackName}-nginx-reverse-proxy`,
            instanceType: new ec2.InstanceType('t3.medium'),
            machineImage: ec2.MachineImage.latestAmazonLinux({
                generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
            }),
            blockDevices: [ebsVolume],
            role: instanceRole,
            securityGroup: props.securityGroup,
            detailedMonitoring: true,
            userData: ec2.UserData.forLinux(),
            requireImdsv2: true
        });
        Tags.of(launchTemplate).add('Name', `${props.stackName}-reverse-proxy`);
        Tags.of(launchTemplate).add('InstanceType', 'reverse-proxy');

        const reverseProxyConfigPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    actions: ['ssm:GetCommandInvocation'],
                    resources: [`arn:aws:ssm:${region}:${account}:*`],
                }),
                new iam.PolicyStatement({
                    actions: ['ssm:SendCommand'],
                    resources: [`arn:aws:ssm:*:*:document/*`, `arn:aws:ec2:${region}:${account}:instance/*`],
                }),
                new iam.PolicyStatement({
                    actions: ['ssm:GetParameters', 'ssm:GetParameter', 'ssm:GetParametersByPath'],
                    resources: [`arn:aws:ssm:${region}:${account}:parameter/*`],
                }),
                new iam.PolicyStatement({
                    actions: ['ec2:DescribeTags', 'ec2:CreateTags', 'ec2:DeleteTags'],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    actions: ['ec2:DescribeInstances', 'ec2:DescribeInstanceStatus'],
                    resources: ['*'],
                }),
            ],
        });

        const autoScalingResources = new AutoScalingResources(
            this,
            'ReverseProxyAutoScalingResources',
            {
                name: `${props.stackName}-rp`,
                removalPolicy: props.removalPolicy,
                artifactsBucket: props.artifactsBucket,
                vpcResources: {
                    vpc: props.vpc,
                    subnets: props.subnets,
                },
                launchTemplate: launchTemplate,
                capacity: {
                    min: 1,
                    max: 1,
                },
                lambdaResources: {
                    entry: path.join(__dirname, '..', '..', '..', 'src', 'lambda', 'lifecycle-hooks', 'reverse-proxy'),
                    layers: props.lambdaLayers,
                    environment: {
                        ARTIFACTS_BUCKET: props.artifactsBucket.bucketName,
                        NUCLEUS_ROOT_DOMAIN: props.rootDomain,
                        NUCLEUS_DOMAIN_PREFIX: props.nucleusServerPrefix,
                        NUCLEUS_SERVER_ADDRESS: props.nucleusServerRoute,
                    },
                    policies: {
                        reverseProxyConfigPolicy: reverseProxyConfigPolicy,
                    },
                },
            }
        );

        autoScalingResources.autoScalingGroup.scaleOnCpuUtilization('ReverseProxyScalingPolicy', {
            targetUtilizationPercent: 75,
        });

        this.autoScalingGroup = autoScalingResources.autoScalingGroup;

        /**
         * Custom Resource - Reverse Proxy Config
         */
        const reverseProxyConfigLambdaPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    actions: ['ssm:SendCommand'],
                    resources: [`arn:aws:ec2:${region}:${account}:instance/*`],
                }),
                new iam.PolicyStatement({
                    actions: ['ssm:SendCommand'],
                    resources: ['arn:aws:ssm:*:*:document/*'],
                }),
                new iam.PolicyStatement({
                    actions: ['ssm:GetCommandInvocation'],
                    resources: [`arn:aws:ssm:${region}:${account}:*`],
                }),
                new iam.PolicyStatement({
                    actions: ['ssm:GetParameters', 'ssm:GetParameter', 'ssm:GetParametersByPath'],
                    resources: [`arn:aws:ssm:${region}:${account}:parameter/*`],
                }),
                new iam.PolicyStatement({
                    actions: ['ec2:DescribeInstances'],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    actions: ['autoscaling:DescribeAutoScalingGroups'],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    actions: ['ec2:DescribeTags', 'ec2:CreateTags'],
                    resources: ['*'],
                }),
            ],
        });

        const reverseProxyConfig = new CustomResource(this, 'ReverseProxyCustomResource', {
            lambdaName: `${props.stackName}-reverse-proxy-config`,
            lambdaCodePath: path.join(__dirname, '..', '..', '..', 'src', 'lambda', 'custom-resources', 'reverse-proxy-config'),
            lambdaPolicyDocument: reverseProxyConfigLambdaPolicy,
            lambdaLayers: props.lambdaLayers,
            removalPolicy: props.removalPolicy,
            resourceProps: {
                nounce: 2,
                ARTIFACTS_BUCKET_NAME: props.artifactsBucket.bucketName,
                FULL_DOMAIN: `${props.nucleusServerPrefix}.${props.rootDomain}`,
                RP_AUTOSCALING_GROUP_NAME: autoScalingResources.autoScalingGroup.autoScalingGroupName,
                NUCLEUS_SERVER_ADDRESS: props.nucleusServerRoute,
            },
        });

        reverseProxyConfig.node.addDependency(this.autoScalingGroup);

        /**
         * CDK Nag Suppressions
         */
        NagSuppressions.addResourceSuppressions(
            instanceRole,
            [
                {
                    id: 'AwsSolutions-IAM5',
                    reason:
                        'Wildcard Permissions: Unable to know which objects exist ahead of time. Need to use wildcard',
                },
                {
                    id: 'AwsSolutions-IAM4',
                    reason:
                        'Suppress AwsSolutions-IAM4 for AWS Managed Policies policy/AmazonSSMManagedInstanceCore',
                },
            ],
            true
        );
    }
}
