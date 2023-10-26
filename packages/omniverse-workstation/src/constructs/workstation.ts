import { Construct } from 'constructs';
import { Stack, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface WorkstationResourcesProps {
    stackName: string;
    vpc: ec2.Vpc,
    subnets: ec2.ISubnet[],
    securityGroup: ec2.SecurityGroup;
    amiName: string;
    amiId: string;
    instanceType: string;
    instanceQuantity: number;
    removalPolicy: RemovalPolicy;
};

export class WorkstationResources extends Construct {

    constructor(scope: Construct, id: string, props: WorkstationResourcesProps) {
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

        // lookup OV AMI based on config parameters 
        const machineImage = ec2.MachineImage.lookup({
            name: props.amiName,
            filters: {
                'image-id': [props.amiId]
            }
        });


        let instances = [];
        for (let index = 0; index < props.instanceQuantity; index++) {
            const subnet: ec2.ISubnet = props.subnets[index % props.subnets.length];
            const instance = new ec2.Instance(this, `${props.stackName}-omniverse-workstation-${index + 1}`, {
                instanceName: `${props.stackName}-omniverse-workstation-${index + 1}`,
                instanceType: new ec2.InstanceType(props.instanceType || 'g5.4xlarge'),
                machineImage: machineImage,
                blockDevices: [ebsVolume],
                vpc: props.vpc,
                role: instanceRole,
                securityGroup: props.securityGroup,
                vpcSubnets: { subnets: [subnet] },
                detailedMonitoring: true,
                requireImdsv2: true,
            });
            instance.applyRemovalPolicy(props.removalPolicy);
            instances.push(instance);
        }

        /**
         * Outputs
         */
        instances.forEach((instance, index) => {
            new CfnOutput(this, `${props.stackName}-omniverse-workstation-${index + 1}-ip`, {
                value: instance.instancePrivateIp
            });
        });

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

        instances.forEach((instance) => {
            NagSuppressions.addResourceSuppressions(
                instance,
                [
                    {
                        id: 'AwsSolutions-EC29',
                        reason:
                            'Instance Termination Protection is not desired for this prototype',
                    },
                ],
                true
            );
        });
    }
}
