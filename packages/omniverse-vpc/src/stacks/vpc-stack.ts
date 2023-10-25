import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcResources } from '../constructs/vpc';
import { NaclResources } from '../constructs/nacls';
import { SecurityGroupResources } from '../constructs/security-groups';
import { EndpointResources } from '../constructs/endpoints';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SecurityGroupCollection, SubnetCollection } from '../utils/types';

export interface VpcStackProps extends StackProps {
    availabilityZones: number;
    allowedRanges: string[];
    removalPolicy: RemovalPolicy;
}

export class VpcStack extends Stack {
    public readonly vpc: ec2.Vpc;
    public readonly subnets: SubnetCollection;
    public readonly securityGroups: SecurityGroupCollection;

    constructor(scope: Construct, id: string, props: VpcStackProps) {
        super(scope, id, props);

        if (!props.stackName) {
            throw new Error("Unable to resolve 'stackName'. Please provide a stack name in the config.json file.");
        }
        console.log(`✨ VPC Stack Name: ${props.stackName}`);

        // update cidr range to prevent overlapping ranges
        const cidrRange: string = '192.0.0.0/16'; // TODO: move to vpc config

        // create vpc and subnets
        const { vpc, subnets } = new VpcResources(this, 'VpcResources', {
            stackName: props.stackName,
            cidrRange: cidrRange,
            ...props
        });

        // create security groups for additional resources
        const { securityGroups } = new SecurityGroupResources(this, 'SecurityGroupResources', {
            stackName: props.stackName,
            vpc: vpc,
            subnets: subnets,
            cidrRange: cidrRange,
            ...props
        });

        // create nacls for subnets
        new NaclResources(this, 'NaclResources', {
            stackName: props.stackName,
            vpc: vpc,
            subnets: subnets,
            ...props
        });

        // create vpc endpoints 
        new EndpointResources(this, 'EndpointResources', {
            stackName: props.stackName,
            vpc: vpc,
            subnets: subnets,
            securityGroups: securityGroups,
            ...props
        });

        this.vpc = vpc;
        this.subnets = subnets;
        this.securityGroups = securityGroups;
    }
}