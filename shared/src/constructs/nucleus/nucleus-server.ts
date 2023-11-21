import { Construct } from 'constructs';
import { Stack, Tags, RemovalPolicy } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { CustomResource } from './custom-resource';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as pyLambda from '@aws-cdk/aws-lambda-python-alpha';
import path from 'path';

export interface NucleusResourcesProps {
    stackName: string;
    rootDomain: string;
    nucleusSubdomain: string;
    nucleusBuild: string;
    vpc: ec2.Vpc;
    subnets: ec2.ISubnet[];
    securityGroup: ec2.SecurityGroup;
    artifactsBucket: s3.IBucket;
    lambdaLayers: pyLambda.PythonLayerVersion[];
    removalPolicy: RemovalPolicy;
};

export class NucleusServerResources extends Construct {
    public readonly nucleusServer: ec2.Instance;

    constructor(scope: Construct, id: string, props: NucleusResourcesProps) {
        super(scope, id);

        const region: string = Stack.of(this).region;
        const account: string = Stack.of(this).account;
        const fullDomainName = `${props.nucleusSubdomain}.${props.rootDomain}`;

        // Templated secret
        const ovMainLogin = new secretsmanager.Secret(this, 'OmniverseMainLogin', {
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'omniverse' }),
                excludePunctuation: true,
                generateStringKey: 'password',
            },
        });

        // Templated secret
        const ovServiceLogin = new secretsmanager.Secret(this, 'OmniverseServiceLogin', {
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'omniverse' }),
                excludePunctuation: true,
                generateStringKey: 'password',
            },
        });

        const instanceRole = new iam.Role(this, 'InstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: 'EC2 Instance Role',
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
            inlinePolicies: {
                nucleusInstancePolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            resources: [`${props.artifactsBucket.bucketArn}`, `${props.artifactsBucket.bucketArn}/*`],
                            actions: ['s3:ListBucket', 's3:GetObject'],
                        }),
                        new iam.PolicyStatement({
                            actions: [
                                'logs:CreateLogGroup',
                                'logs:CreateLogStream',
                                'logs:DescribeLogStreams',
                                'logs:PutLogEvents',
                            ],
                            resources: ['arn:aws:logs:*:*:log-group:/aws/ssm/*'],
                        })
                    ]
                })
            }
        });

        const ebsVolume: ec2.BlockDevice = {
            deviceName: '/dev/sda1',
            volume: ec2.BlockDeviceVolume.ebs(512, {
                encrypted: true,
            }),
        };

        // Canonical, Ubuntu, 20.04 LTS, amd64
        const nucleusServerAMI = ec2.MachineImage.fromSsmParameter(
            '/aws/service/canonical/ubuntu/server/focal/stable/current/amd64/hvm/ebs-gp2/ami-id',
            {
                os: ec2.OperatingSystemType.LINUX,
            }
        );

        /**
         * Primary Nucleus Instance
         */
        const primaryInstanceName = `${props.stackName}-nucleus-server-primary`;
        this.nucleusServer = new ec2.Instance(this, primaryInstanceName, {
            instanceName: primaryInstanceName,
            instanceType: new ec2.InstanceType('c5.4xlarge'),
            machineImage: nucleusServerAMI,
            blockDevices: [ebsVolume],
            vpc: props.vpc,
            role: instanceRole,
            securityGroup: props.securityGroup,
            vpcSubnets: { subnets: [props.subnets[0]] },
            detailedMonitoring: true,
            requireImdsv2: true,
        });
        this.nucleusServer.applyRemovalPolicy(props.removalPolicy);
        Tags.of(this.nucleusServer).add('Name', primaryInstanceName);
        Tags.of(this.nucleusServer).add('InstanceType', 'nucleus');
        Tags.of(this.nucleusServer).add('Nucleus', 'primary');

        /**
         * Standby Nucleus Instance
         */
        const standbyInstanceName = `${props.stackName}-nucleus-server-standby`;
        const standbyInstance = new ec2.Instance(this, standbyInstanceName, {
            instanceName: standbyInstanceName,
            instanceType: new ec2.InstanceType('c5.4xlarge'),
            machineImage: nucleusServerAMI,
            blockDevices: [ebsVolume],
            vpc: props.vpc,
            role: instanceRole,
            securityGroup: props.securityGroup,
            vpcSubnets: { subnets: [props.subnets.length > 1 ? props.subnets[1] : props.subnets[0]] },
            detailedMonitoring: true,
            requireImdsv2: true,
        });
        this.nucleusServer.applyRemovalPolicy(props.removalPolicy);
        Tags.of(this.nucleusServer).add('Name', standbyInstanceName);
        Tags.of(this.nucleusServer).add('InstanceType', 'nucleus');
        Tags.of(this.nucleusServer).add('Nucleus', 'standby');

        /**
         * CUSTOM RESOURCE - Nucleus Server Config
         */
        // Custom Resource to manage nucleus server configuration
        const nucleusConfigLambdaPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    actions: ['ssm:GetCommandInvocation'],
                    resources: [`arn:aws:ssm:${region}:${account}:*`],
                }),
                new iam.PolicyStatement({
                    actions: ['ssm:SendCommand'],
                    resources: ['arn:aws:ssm:*:*:document/*', `arn:aws:ec2:${region}:${account}:instance/*`],
                }),
                new iam.PolicyStatement({
                    actions: ['ec2:StopInstances'],
                    resources: [`arn:aws:ec2:${region}:${account}:instance/*`],
                }),
                new iam.PolicyStatement({
                    actions: ['ssm:GetCommandInvocation'],
                    resources: [`arn:aws:ssm:${region}:${account}:*`],
                }),
                new iam.PolicyStatement({
                    actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
                    resources: [ovMainLogin.secretArn, ovServiceLogin.secretArn],
                }),
            ],
        });

        const nucleusServerConfig = new CustomResource(this, 'NucleusServerConfigCustomResource', {
            lambdaName: `${props.stackName}-nucleus-config`,
            lambdaCodePath: path.join(__dirname, '..', '..', '..', 'src', 'lambda', 'custom-resources', 'nucleus-server-config'),
            lambdaPolicyDocument: nucleusConfigLambdaPolicy,
            resourceProps: {
                nounce: 2,
                primaryInstanceId: this.nucleusServer.instanceId,
                standbyInstanceId: standbyInstance.instanceId,
                reverseProxyDomain: fullDomainName,
                nucleusBuild: props.nucleusBuild,
                artifactsBucket: props.artifactsBucket.bucketName,
                ovMainLoginSecretArn: ovMainLogin.secretName,
                ovServiceLoginSecretArn: ovServiceLogin.secretArn,
            },
            lambdaLayers: props.lambdaLayers,
            removalPolicy: props.removalPolicy
        });
        nucleusServerConfig.resource.node.addDependency(this.nucleusServer);

        /**
         * CDK_NAG (security scan) suppressions
         */
        NagSuppressions.addResourceSuppressions(
            ovMainLogin,
            [
                {
                    id: 'AwsSolutions-SMG4',
                    reason:
                        'Auto rotate secrets: Secrets Manager used to hold credentials required for deployment. Will be replaced by SSO strategy in production',
                },
            ],
            true
        );

        NagSuppressions.addResourceSuppressions(
            ovServiceLogin,
            [
                {
                    id: 'AwsSolutions-SMG4',
                    reason:
                        'Auto rotate secrets: Secrets Manager used to hold credentials required for deployment. Will be replaced by SSO strategy in production',
                },
            ],
            true
        );

        NagSuppressions.addResourceSuppressions(
            instanceRole,
            [
                {
                    id: 'AwsSolutions-IAM4',
                    reason:
                        'Nucleus server instances use manged policy AmazonSSMManagedInstanceCore',
                },
            ],
            true
        );

        NagSuppressions.addResourceSuppressions(
            instanceRole,
            [
                {
                    id: 'AwsSolutions-IAM5',
                    reason:
                        'Wildcard Permissions: Unable to know which objects exist ahead of time. Need to use wildcard',
                },
            ],
            true
        );
    }
}
