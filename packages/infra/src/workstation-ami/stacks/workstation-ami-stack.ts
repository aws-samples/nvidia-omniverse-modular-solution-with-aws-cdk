import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { JumpboxResources } from '../constructs/jumpbox-ami';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { BaseStackProps, SecurityGroupCollection, SubnetCollection } from '../../types';
import { WorkstationAmiResources } from '../constructs/workstation-ami';

export interface WorkstationAmiStackProps extends BaseStackProps {
  vpc: ec2.Vpc;
  subnets: SubnetCollection;
  securityGroups: SecurityGroupCollection;
  jumpboxInstanceType: string;
  workstationInstanceType: string;
}

export class WorkstationAmiStack extends Stack {
  constructor(scope: Construct, id: string, props: WorkstationAmiStackProps) {
    super(scope, id, props);

    if (!props.stackName) {
      throw new Error(
        "Unable to resolve 'stackName'. Please provide a stack name in the config.json file.",
      );
    }
    console.info(`>>> Building Omniverse AMI Stack. Stack Name: ${props.stackName}`);

    /**
     * Jumpboxes
     */
    new JumpboxResources(this, 'JumpboxAmiResources', {
      stackName: props.stackName,
      vpc: props.vpc,
      subnets: props.subnets.public as ec2.ISubnet[],
      securityGroup: props.securityGroups.jumpbox as ec2.SecurityGroup,
      instanceType: props.jumpboxInstanceType,
      removalPolicy: props.removalPolicy
    });

    /**
     * Omniverse Workstation
     * Use to build Omniverse Workstation AMI
     */
    new WorkstationAmiResources(this, 'WorkstationAmiResources', {
      stackName: props.stackName,
      vpc: props.vpc,
      subnets: props.subnets.workstation as ec2.ISubnet[],
      securityGroup: props.securityGroups.workstation as ec2.SecurityGroup,
      instanceType: props.workstationInstanceType,
      removalPolicy: props.removalPolicy
    });

  }
}