import { Construct } from 'constructs';
import { Stack, RemovalPolicy, CfnOutput, Tags } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { readFileSync } from 'fs';
import path from 'path';

export interface GoldenWorkstationResourcesProps {
    stackName: string;
    vpc: ec2.Vpc;
    subnets: ec2.ISubnet[];
    securityGroup: ec2.SecurityGroup;
    instanceType: string;
    removalPolicy: RemovalPolicy;
};

export class GoldenWorkstationResources extends Construct {
    public readonly instance: ec2.Instance;

    constructor(scope: Construct, id: string, props: GoldenWorkstationResourcesProps) {
        super(scope, id);

        // create EC2 instance role
        const instanceRole = new iam.Role(this, 'InstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: 'EC2 Instance Role',
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
            inlinePolicies: {
                'dcv-license-policy': new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            resources: [`arn:aws:s3:::dcv-license.${Stack.of(this).region}/*`],
                            actions: ['s3:GetObject'],
                        })
                    ]
                })
            }
        });

        // EBS volume - increase storage space for OV assets
        const ebsVolume: ec2.BlockDevice = {
            deviceName: '/dev/sda1',
            volume: ec2.BlockDeviceVolume.ebs(500, {
                encrypted: true,
            }),
        };

        // lookup windows server 2022 ami as base for ov workstation image
        const machineImage = ec2.MachineImage.lookup({
            name: 'Windows_Server-2022-English-Full-Base-2024.03.13',
            windows: true,
            owners: ['801119661308']
        });

        // key pair for instance access
        const keyPair = new ec2.CfnKeyPair(this, 'WorkstationKeyPair', {
            keyName: `${props.stackName}-golden-kp`,
        });
        const keyPairId = `/ec2/keypair/${keyPair.attrKeyPairId}`;
        keyPair.applyRemovalPolicy(RemovalPolicy.RETAIN);

        const userData = ec2.UserData.custom(readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'scripts', 'golden', 'user-data.ps1'), {
            encoding: 'utf8'
        }).toString());

        this.instance = new ec2.Instance(this, `${props.stackName}-omniverse-workstation-base`, {
            instanceName: `${props.stackName}-workstation-base`,
            instanceType: new ec2.InstanceType(props.instanceType || 'g5.4xlarge'),
            machineImage: machineImage,
            keyName: keyPair.keyName,
            blockDevices: [ebsVolume],
            vpc: props.vpc,
            role: instanceRole,
            securityGroup: props.securityGroup,
            vpcSubnets: { subnets: props.subnets },
            detailedMonitoring: true,
            requireImdsv2: true,
            userData: userData
        });
        this.instance.applyRemovalPolicy(props.removalPolicy);
        Tags.of(this.instance).add('InstanceType', 'workstation');

        /**
         * Outputs
         */
        new CfnOutput(this, 'WorkstationKeyPairId', {
            value: keyPairId,
        }).exportName = 'omniverse-golden-workstation-key-pair-id';

        new CfnOutput(this, 'WorkstationKeyPairName', {
            value: keyPair.keyName,
        }).exportName = 'omniverse-golden-workstation-key-pair-name';

        new CfnOutput(this, 'WorkstationBaseIp', {
            value: this.instance.instancePrivateIp
        }).exportName = 'omniverse-golden-workstation-base-ip';

        /**
         * CDK_NAG (security scan) suppressions
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

        NagSuppressions.addResourceSuppressions(
            this.instance,
            [
                {
                    id: 'AwsSolutions-EC29',
                    reason:
                        'Instance Termination Protection is not desired for this project',
                },
            ],
            true
        );
    }
}
