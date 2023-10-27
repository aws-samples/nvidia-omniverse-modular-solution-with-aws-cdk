import { Construct } from 'constructs';
import { SecurityGroupCollection, SubnetCollection } from '../utils/types';
import { Tags } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface EndpointResourcesProps {
    stackName: string;
    vpc: ec2.Vpc;
    subnets: SubnetCollection;
    securityGroups: SecurityGroupCollection;
}

export class EndpointResources extends Construct {
    constructor(scope: Construct, id: string, props: EndpointResourcesProps) {
        super(scope, id);

        // S3 Gateway Endpoint
        const s3Endpoint = new ec2.GatewayVpcEndpoint(this, 'S3GatewayEndpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            vpc: props.vpc,
            subnets: [
                { subnets: props.subnets.reverseProxy },
                { subnets: props.subnets.nucleus },
                { subnets: props.subnets.workstation }],
        });
        Tags.of(s3Endpoint).add('Name', `${props.stackName}-s3-endpoint`);

        // SSM Endpoint
        const ssmEndpoint = new ec2.InterfaceVpcEndpoint(this, 'SSMInterfaceEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.SSM,
            vpc: props.vpc,
            subnets: { subnets: props.subnets.nucleus },
            securityGroups: [props.securityGroups.vpcEndpoint],
            open: true
        });
        Tags.of(ssmEndpoint).add('Name', `${props.stackName}-ssm-endpoint`);

        // SSM Messages Endpoint
        const ssmMessagesEndpoint = new ec2.InterfaceVpcEndpoint(this, 'SSMMessagesInterfaceEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
            vpc: props.vpc,
            subnets: { subnets: props.subnets.nucleus },
            securityGroups: [props.securityGroups.vpcEndpoint],
            open: true
        });
        Tags.of(ssmMessagesEndpoint).add('Name', `${props.stackName}-ssm-messages-endpoint`);

        // EC2 Messages Endpoint
        const ec2Endpoint = new ec2.InterfaceVpcEndpoint(this, 'EC2MessagesInterfaceEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
            vpc: props.vpc,
            subnets: { subnets: props.subnets.nucleus },
            securityGroups: [props.securityGroups.vpcEndpoint],
            open: true
        });
        Tags.of(ec2Endpoint).add('Name', `${props.stackName}-ec2-messages-endpoint`);
    }
}
