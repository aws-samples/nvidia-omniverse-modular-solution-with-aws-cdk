import { Construct } from 'constructs';
import { RemovalPolicy, CfnOutput, Tags } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface JumpboxResourcesProps {
    stackName: string;
    vpc: ec2.Vpc;
    subnets: ec2.ISubnet[];
    securityGroup: ec2.SecurityGroup;
    instanceType: string;
    instanceQuantity: number;
    removalPolicy: RemovalPolicy;
};

export class JumpboxResources extends Construct {
    public readonly instances: ec2.Instance[] = [];

    constructor(scope: Construct, id: string, props: JumpboxResourcesProps) {
        super(scope, id);

        // create EC2 instance role
        const instanceRole = new iam.Role(this, 'InstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: 'EC2 Instance Role',
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
        });

        // standard EBS volume
        const ebsVolume: ec2.BlockDevice = {
            deviceName: '/dev/xvda',
            volume: ec2.BlockDeviceVolume.ebs(8, {
                encrypted: true,
            }),
        };

        // key pair for instance access
        const keyPair = new ec2.CfnKeyPair(this, 'JumpboxKeyPair', {
            keyName: `${props.stackName}-jumpbox-kp`,
        });
        const keyPairId = `/ec2/keypair/${keyPair.attrKeyPairId}`;

        // create jumpbox in each AZ/public subnet
        for (let index = 0; index < props.instanceQuantity; index++) {
            const instance = new ec2.Instance(this, `${props.stackName}-jumpbox-${index + 1}`, {
                instanceName: `${props.stackName}-jumpbox-${index + 1}`,
                instanceType: new ec2.InstanceType(props.instanceType ?? 't4g.small'),
                machineImage: ec2.MachineImage.latestAmazonLinux2023({
                    userData: ec2.UserData.custom(
                        "#!/bin/bash \
                        apt-get update -y \
                        apt-get upgrade -y"
                    ),
                    cpuType: ec2.AmazonLinuxCpuType.ARM_64
                }),
                keyName: keyPair.keyName,
                blockDevices: [ebsVolume],
                vpc: props.vpc,
                role: instanceRole,
                securityGroup: props.securityGroup,
                vpcSubnets: { subnets: props.subnets },
                detailedMonitoring: true,
                requireImdsv2: true,
            });
            instance.applyRemovalPolicy(props.removalPolicy);
            Tags.of(instance).add('InstanceType', 'jumpbox');
            this.instances.push(instance);
        }


        // artifacts bucket
        instanceRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    'logs:CreateLogGroup',
                    'logs:CreateLogStream',
                    'logs:DescribeLogStreams',
                    'logs:PutLogEvents',
                ],
                resources: ['arn:aws:logs:*:*:log-group:/aws/ssm/*'],
            })
        );

        /**
         * Outputs
         */
        new CfnOutput(this, 'JumpboxKeyPairId', {
            value: keyPairId,
        });

        this.instances.forEach((instance, index) => {
            new CfnOutput(this, `${props.stackName}-jumpbox-${index + 1}-ip`, {
                value: instance.instancePublicIp
            });
        });

        /**
          * CDK_NAG (security scan) suppressions
          */
        NagSuppressions.addResourceSuppressions(
            instanceRole,
            [
                {
                    id: 'AwsSolutions-IAM4',
                    reason:
                        'Wildcard Permissions: Unable to know which objects exist ahead of time. Need to use wildcard',
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

        this.instances.forEach((instance) => {
            NagSuppressions.addResourceSuppressions(
                instance,
                [
                    {
                        id: 'AwsSolutions-EC29',
                        reason:
                            'Instance Termination Protection is not desired for this project',
                    },
                ],
                true
            );
        });
    }
}
