import { Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NucleusSecurityGroupResources } from '../../constructs/nucleus/vpc/security-groups-nucleus';
import { NucleusVpcResources } from '../../constructs/nucleus/vpc/vpc-nucleus';
import { NucleusNaclResources } from '../../constructs/nucleus/vpc/nacls-nucleus';
import { VpcStack, VpcStackProps } from './vpc-stack';


export class NucleusVpcStack extends VpcStack {
    constructor(scope: Construct, id: string, props: VpcStackProps) {
        super(scope, id, props);

        const stackName = props.stackName as string;

        // create vpc and subnets
        const { vpc, subnets } = new NucleusVpcResources(this, 'VpcResources', {
            stackName: stackName,
            cidrRange: this.cidrRange,
            ...props
        });

        if (!vpc || !subnets) {
            throw new Error("Failed to create necessary Workstation VPC resources.");
        }

        // create security groups for additional resources
        const { securityGroups } = new NucleusSecurityGroupResources(this, 'SecurityGroupResources', {
            stackName: stackName,
            vpc: vpc,
            subnets: subnets,
            cidrRange: this.cidrRange,
            ...props
        });

        // create nacls for subnets
        new NucleusNaclResources(this, 'NaclResources', {
            stackName: stackName,
            vpc: vpc,
            subnets: subnets,
            ...props
        });

        /**
         * VPC Endpoints
         */
        // S3 Gateway Endpoint
        const s3Endpoint = new ec2.GatewayVpcEndpoint(this, 'S3GatewayEndpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            vpc: vpc,
            subnets: [
                { subnets: subnets.reverseProxy },
                { subnets: subnets.nucleus },
                { subnets: subnets.workstation }
            ],
        });
        Tags.of(s3Endpoint).add('Name', `${props.stackName}-s3-endpoint`);

        // SSM Endpoint
        const ssmEndpoint = new ec2.InterfaceVpcEndpoint(this, 'SSMInterfaceEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.SSM,
            vpc: vpc,
            subnets: { subnets: subnets.nucleus },
            securityGroups: [securityGroups.vpcEndpoint],
            open: true
        });
        Tags.of(ssmEndpoint).add('Name', `${props.stackName}-ssm-endpoint`);

        // SSM Messages Endpoint
        const ssmMessagesEndpoint = new ec2.InterfaceVpcEndpoint(this, 'SSMMessagesInterfaceEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
            vpc: vpc,
            subnets: { subnets: subnets.nucleus },
            securityGroups: [securityGroups.vpcEndpoint],
            open: true
        });
        Tags.of(ssmMessagesEndpoint).add('Name', `${props.stackName}-ssm-messages-endpoint`);

        // EC2 Messages Endpoint
        const ec2Endpoint = new ec2.InterfaceVpcEndpoint(this, 'EC2MessagesInterfaceEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
            vpc: vpc,
            subnets: { subnets: subnets.nucleus },
            securityGroups: [securityGroups.vpcEndpoint],
            open: true
        });
        Tags.of(ec2Endpoint).add('Name', `${props.stackName}-ec2-messages-endpoint`);

        this.vpc = vpc;
        this.subnets = subnets;
        this.securityGroups = securityGroups;
    }
}
