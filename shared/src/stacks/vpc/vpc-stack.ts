import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityGroupCollection, SubnetCollection } from '../../types';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface VpcStackProps extends StackProps {
    availabilityZones: number;
    allowedRanges: string[];
    removalPolicy: RemovalPolicy;
}

export class VpcStack extends Stack {
    public vpc: ec2.Vpc | undefined;
    public subnets: SubnetCollection | undefined;
    public securityGroups: SecurityGroupCollection | undefined;

    protected readonly cidrRange: string = '192.0.0.0/16'; // TODO: move to vpc config

    constructor(scope: Construct, id: string, props: VpcStackProps) {
        super(scope, id, props);

        if (!props.stackName) {
            throw new Error("Unable to resolve 'stackName'. Please provide a stack name in the config.json file.");
        }
        console.log(`✨ VPC Stack Name: ${props.stackName}`);
    }
}



