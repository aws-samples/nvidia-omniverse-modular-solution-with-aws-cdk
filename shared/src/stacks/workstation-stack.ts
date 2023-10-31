import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityGroupCollection, SubnetCollection } from '../types';
import { JumpboxResources } from '../constructs/workstation/jumpbox';
import { WorkstationResources } from '../constructs/workstation/workstation';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface WorkstationStackProps extends StackProps {
    vpc: ec2.Vpc;
    subnets: SubnetCollection;
    securityGroups: SecurityGroupCollection;
    jumpboxInstanceType: string;
    workstationAmiName: string;
    workstationAmiId: string;
    workstationInstanceType: string;
    workstationQuantity: number;
    removalPolicy: RemovalPolicy;
}


export class WorkstationStack extends Stack {
    constructor(scope: Construct, id: string, props: WorkstationStackProps) {
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
            removalPolicy: props.removalPolicy
        });

        /**
         * Omniverse Workstations
         */
        new WorkstationResources(this, 'WorkstationResources', {
            stackName: props.stackName,
            vpc: props.vpc,
            subnets: props.subnets.workstation,
            securityGroup: props.securityGroups.workstation,
            amiName: props.workstationAmiName,
            amiId: props.workstationAmiId,
            instanceType: props.workstationInstanceType,
            instanceQuantity: props.workstationQuantity,
            removalPolicy: props.removalPolicy
        });

    }
}