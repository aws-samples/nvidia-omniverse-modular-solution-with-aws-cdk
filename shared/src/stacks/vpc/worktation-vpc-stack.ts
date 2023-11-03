import { Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { WorkstationNaclResources } from '../../constructs/workstation/vpc/nacls-workstations';
import { WorkstationSecurityGroupResources } from '../../constructs/workstation/vpc/security-groups-workstation';
import { WorkstationVpcResources } from '../../constructs/workstation/vpc/vpc-workstation';
import { VpcStack, VpcStackProps } from './vpc-stack';

export class WorkstationVpcStack extends VpcStack {
    constructor(scope: Construct, id: string, props: VpcStackProps) {
        super(scope, id, props);

        const stackName = props.stackName as string;

        // create vpc and subnets
        const { vpc, subnets } = new WorkstationVpcResources(this, 'VpcResources', {
            stackName: stackName,
            cidrRange: this.cidrRange,
            ...props
        });

        if (!vpc || !subnets) {
            throw new Error("Failed to create necessary Workstation VPC resources.");
        }

        // create security groups for additional resources
        const { securityGroups } = new WorkstationSecurityGroupResources(this, 'SecurityGroupResources', {
            stackName: stackName,
            vpc: vpc,
            subnets: subnets,
            cidrRange: this.cidrRange,
            ...props
        });

        // create nacls for subnets
        new WorkstationNaclResources(this, 'NaclResources', {
            stackName: stackName,
            vpc: vpc,
            subnets: subnets,
            ...props
        });

        // S3 Gateway Endpoint
        const s3Endpoint = new ec2.GatewayVpcEndpoint(this, 'S3GatewayEndpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            vpc: vpc,
            subnets: [
                { subnets: subnets.workstation }
            ],
        });
        Tags.of(s3Endpoint).add('Name', `${props.stackName}-s3-endpoint`);

        this.vpc = vpc;
        this.subnets = subnets;
        this.securityGroups = securityGroups;
    }
}
