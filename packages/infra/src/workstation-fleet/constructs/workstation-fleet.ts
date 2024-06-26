// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Stack, RemovalPolicy, CfnOutput, Tags } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as consts from '../../consts';
export interface WorkstationResourcesProps {
  stackName: string;
  vpc: ec2.Vpc;
  subnets: ec2.ISubnet[];
  securityGroup: ec2.SecurityGroup;
  amiId: string;
  instanceType: string;
  instanceQuantity: number;
  removalPolicy: RemovalPolicy;
};

export class WorkstationResources extends Construct {
  public readonly instances: ec2.Instance[] = [];

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
      name: '*',
      owners: [Stack.of(this).account],
      filters: {
        'image-id': [props.amiId]
      }
    });

    // key pair for instance access
    const keyPairParam = ssm.StringParameter.fromStringParameterAttributes(this, 'OmniverseWorkstationKeyPairParam', {
      parameterName: consts.OMNI_WORKSTATION_KP_NAME_PARAM_NAME,
    });

    const keyPair = ec2.KeyPair.fromKeyPairName(this, 'OmniverseWorkstationKeyPair', keyPairParam.stringValue);

    for (let index = 0; index < props.instanceQuantity; index++) {
      const subnet: ec2.ISubnet = props.subnets[index % props.subnets.length];
      const instance = new ec2.Instance(this, `${props.stackName}OmniverseWorkstation${index + 1}`, {
        instanceName: `${props.stackName}OmniverseWorkstation${index + 1}`,
        instanceType: new ec2.InstanceType(props.instanceType || 'g5.4xlarge'),
        machineImage: machineImage,
        keyPair: keyPair,
        blockDevices: [ebsVolume],
        vpc: props.vpc,
        role: instanceRole,
        securityGroup: props.securityGroup,
        vpcSubnets: { subnets: [subnet] },
        detailedMonitoring: true,
        requireImdsv2: true,
      });
      instance.applyRemovalPolicy(props.removalPolicy);
      Tags.of(instance).add('InstanceType', 'workstation');
      this.instances.push(instance);
    }

    /**
     * Outputs
     */
    this.instances.forEach((instance, index) => {
      new CfnOutput(this, `${props.stackName}OmniverseWorkstation${index + 1}Ip`, {
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
