// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Stack, RemovalPolicy, CfnOutput, Tags } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { readFileSync } from 'fs';
import path from 'path';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as consts from '../../consts';
export interface WorkstationAmiResourcesProps {
    stackName: string;
    vpc: ec2.Vpc;
    subnets: ec2.ISubnet[];
    securityGroup: ec2.SecurityGroup;
    instanceType: string;
    removalPolicy: RemovalPolicy;
};

export class WorkstationAmiResources extends Construct {
    public readonly instance: ec2.Instance;

    constructor(scope: Construct, id: string, props: WorkstationAmiResourcesProps) {
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
        const keyPair = new ec2.KeyPair(this, 'WorkstationKeyPair', {
            keyPairName: consts.OMNI_WORKSTATION_KP_NAME_PARAM_NAME,
        });
        keyPair.applyRemovalPolicy(RemovalPolicy.RETAIN);
        const keyPairId = `/ec2/keypair/${keyPair.keyPairId}`;

        const userData = ec2.UserData.custom(readFileSync(path.join(__dirname, '..', 'scripts', 'workstation-ami-user-data.ps1'), {
            encoding: 'utf8'
        }).toString());

        this.instance = new ec2.Instance(this, `${props.stackName}OmniverseWorkstationBase`, {
            instanceName: `${props.stackName}WorkstationBase`,
            instanceType: new ec2.InstanceType(props.instanceType || 'g5.4xlarge'),
            machineImage: machineImage,
            keyPair: keyPair,
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
         * SSM Parameters
         */
        new ssm.StringParameter(this, 'WorkstationKeyPairParameter', {
            parameterName: consts.OMNI_WORKSTATION_KP_NAME_PARAM_NAME,
            stringValue: keyPair.keyPairName,
            dataType: ssm.ParameterDataType.TEXT
        }).applyRemovalPolicy(RemovalPolicy.RETAIN);

        /**
         * Outputs
         */
        new CfnOutput(this, 'WorkstationKeyPairId', {
            value: keyPairId,
        }).exportName = consts.OMNI_WORKSTATION_KP_ID_PARAM_NAME;

        new CfnOutput(this, 'WorkstationKeyPairName', {
            value: keyPair.keyPairName,
        }).exportName = consts.OMNI_WORKSTATION_KP_NAME_PARAM_NAME;

        new CfnOutput(this, 'WorkstationBaseIp', {
            value: this.instance.instancePrivateIp
        }).exportName = consts.OMNI_WORKSTATION_PRIVATE_IP_PARAM_NAME;

        /**
         * Nag Suppressions
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
