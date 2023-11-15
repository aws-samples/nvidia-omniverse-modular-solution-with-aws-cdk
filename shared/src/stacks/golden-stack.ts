import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityGroupCollection, SubnetCollection } from '../types';
import { JumpboxResources } from '../constructs/workstation/jumpbox';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { GoldenWorkstationResources } from '../constructs/golden/golden-workstation';

export interface GoldenStackProps extends StackProps {
    vpc: ec2.Vpc;
    subnets: SubnetCollection;
    securityGroups: SecurityGroupCollection;
    jumpboxInstanceType: string;
    workstationInstanceType: string;
    removalPolicy: RemovalPolicy;
}

export class GoldenStack extends Stack {
    constructor(scope: Construct, id: string, props: GoldenStackProps) {
        super(scope, id, props);

        if (!props.stackName) {
            throw new Error("Unable to resolve 'stackName'. Please provide a stack name in the config.json file.");
        }
        console.log(`✨ Workstation Stack Name: ${props.stackName}`);

        /**
         * Jumpboxes
         */
        new JumpboxResources(this, 'JumpboxResources', {
            stackName: props.stackName,
            vpc: props.vpc,
            subnets: props.subnets.public,
            securityGroup: props.securityGroups.jumpbox,
            instanceType: props.jumpboxInstanceType,
            instanceQuantity: 1,
            removalPolicy: props.removalPolicy
        });

        /**
         * Omniverse Workstation Base
         */
        new GoldenWorkstationResources(this, 'GoldenWorkstationResources', {
            stackName: props.stackName,
            vpc: props.vpc,
            subnets: props.subnets.workstation,
            securityGroup: props.securityGroups.workstation,
            instanceType: props.workstationInstanceType,
            removalPolicy: props.removalPolicy,
        });
    }
}