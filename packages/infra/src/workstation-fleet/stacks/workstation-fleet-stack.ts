// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { JumpboxResources } from '../constructs/jumpbox-fleet';
import { WorkstationResources } from '../constructs/workstation-fleet';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { BaseStackProps, SecurityGroupCollection, SubnetCollection } from '../../types';

export interface WorkstationFleetStackProps extends BaseStackProps {
  vpc: ec2.Vpc;
  subnets: SubnetCollection;
  securityGroups: SecurityGroupCollection;
  availabilityZones: number;
  jumpboxInstanceType: string;
  workstationAmiId: string;
  workstationInstanceType: string;
  workstationQuantity: number;
  removalPolicy: RemovalPolicy;
}

export class WorkstationFleetStack extends Stack {
  constructor(scope: Construct, id: string, props: WorkstationFleetStackProps) {
    super(scope, id, props);

    if (!props.stackName) {
      throw new Error(
        "Unable to resolve 'stackName'. Please provide a stack name in the config.json file.",
      );
    }
    console.info(`>>> Building Omniverse Fleet Stack. Stack Name: ${props.stackName}`);

    /**
     * Jumpboxes
     */
    new JumpboxResources(this, 'FleetJumpboxResources', {
      stackName: props.stackName,
      vpc: props.vpc,
      subnets: props.subnets.public,
      securityGroup: props.securityGroups.jumpbox as ec2.SecurityGroup,
      instanceType: props.jumpboxInstanceType,
      instanceQuantity: props.availabilityZones,
      removalPolicy: props.removalPolicy
    });

    /**
     * Omniverse Workstations
     */
    new WorkstationResources(this, 'FleetWorkstationResources', {
      stackName: props.stackName,
      vpc: props.vpc,
      subnets: props.subnets.workstation as ec2.ISubnet[],
      securityGroup: props.securityGroups.workstation as ec2.SecurityGroup,
      amiId: props.workstationAmiId,
      instanceType: props.workstationInstanceType,
      instanceQuantity: props.workstationQuantity,
      removalPolicy: props.removalPolicy
    });

  }
}