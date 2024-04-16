import { Construct } from 'constructs';
import { RemovalPolicy, CfnOutput, Tags } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as consts from '../../consts';

export interface JumpboxResourcesProps {
  stackName: string;
  vpc: ec2.Vpc;
  subnets: ec2.ISubnet[];
  securityGroup: ec2.SecurityGroup;
  instanceType: string;
  removalPolicy: RemovalPolicy;
};

export class JumpboxResources extends Construct {
  public readonly instance: ec2.Instance;

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
    const keyPair = new ec2.KeyPair(this, 'JumpboxKeyPair', {
      keyPairName: consts.OMNI_JUMPBOX_KP_NAME_PARAM_NAME,
    });
    keyPair.applyRemovalPolicy(RemovalPolicy.RETAIN);
    const keyPairId = `/ec2/keypair/${keyPair.keyPairId}`;

    // create jumpbox in each AZ/public subnet
    this.instance = new ec2.Instance(this, `${props.stackName}Jumpbox`, {
      instanceName: `${props.stackName}Jumpbox`,
      instanceType: new ec2.InstanceType(props.instanceType ?? 't4g.small'),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        userData: ec2.UserData.custom(
          "#!/bin/bash \
            apt-get update -y \
            apt-get upgrade -y"
        ),
        cpuType: ec2.AmazonLinuxCpuType.ARM_64
      }),
      keyPair: keyPair,
      blockDevices: [ebsVolume],
      vpc: props.vpc,
      role: instanceRole,
      securityGroup: props.securityGroup,
      vpcSubnets: { subnets: props.subnets },
      detailedMonitoring: true,
      requireImdsv2: true,
    });
    this.instance.applyRemovalPolicy(props.removalPolicy);
    Tags.of(this.instance).add('InstanceType', 'jumpbox');

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
     * SSM Parameters
     */
    new ssm.StringParameter(this, 'JumpboxKeyPairParameter', {
      parameterName: consts.OMNI_JUMPBOX_KP_NAME_PARAM_NAME,
      stringValue: keyPair.keyPairName,
      dataType: ssm.ParameterDataType.TEXT
    }).applyRemovalPolicy(RemovalPolicy.RETAIN);

    /**
     * Outputs
     */
    new CfnOutput(this, 'JumpboxKeyPairIdOutput', {
      value: keyPairId,
    }).exportName = consts.OMNI_JUMPBOX_KP_ID_PARAM_NAME;

    new CfnOutput(this, `JumpboxPublicIpOutput`, {
      value: this.instance.instancePublicIp,
    }).exportName = consts.OMNI_JUMPBOX_PUBLIC_IP_PARAM_NAME;

    /**
      * Nag Suppressions
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
