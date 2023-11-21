import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import { SecurityGroupCollection, SubnetCollection } from '../../types';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface SecurityGroupResourceProps {
    stackName: string;
    allowedRanges: string[];
    vpc: ec2.Vpc;
    subnets: SubnetCollection;
    cidrRange: string;
}

export class SecurityGroupResourcesBase extends Construct {
    public readonly securityGroups: SecurityGroupCollection | undefined;

    protected readonly stackName: string;
    protected readonly vpc: ec2.Vpc;
    protected readonly subnets: SubnetCollection;
    protected readonly allowedRanges: string[];
    protected readonly cidrRange: string;

    constructor(scope: Construct, id: string, props: SecurityGroupResourceProps) {
        super(scope, id);

        this.stackName = props.stackName;
        this.vpc = props.vpc;
        this.subnets = props.subnets;
        this.allowedRanges = props.allowedRanges;
        this.cidrRange = props.cidrRange;
    };

    protected createSecurityGroups(): SecurityGroupCollection {
        const vpcEndpointName = `${this.stackName}-vpc-endpoint`;
        const vpcEndpointSG = new ec2.SecurityGroup(this, 'VPCEndpointSG', {
            securityGroupName: vpcEndpointName,
            description: 'VPC Endpoint Security Group',
            allowAllOutbound: true,
            vpc: this.vpc,
        });
        Tags.of(vpcEndpointSG).add('Name', vpcEndpointName);

        const natGatewayName = `${this.stackName}-nat-gateway`;
        const natGatewaySG = new ec2.SecurityGroup(this, 'NatGatewaySG', {
            securityGroupName: natGatewayName,
            description: 'NAT Gateway Security Group',
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        Tags.of(natGatewaySG).add('Name', natGatewayName);

        const jumpboxName = `${this.stackName}-jumpbox`;
        const jumpboxSG = new ec2.SecurityGroup(this, 'JumpboxSG', {
            securityGroupName: jumpboxName,
            description: 'Jumpbox Security Group',
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        Tags.of(jumpboxSG).add('Name', jumpboxName);

        const workstationName = `${this.stackName}-workstation`;
        const workstationSG = new ec2.SecurityGroup(this, 'WorkstationSG', {
            securityGroupName: workstationName,
            description: 'Workstation Security Group',
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        Tags.of(workstationSG).add('Name', workstationName);

        return {
            vpcEndpoint: vpcEndpointSG,
            natGatway: natGatewaySG,
            jumpbox: jumpboxSG,
            workstation: workstationSG
        };
    }

    protected addRules(securityGroups: SecurityGroupCollection) {
        // ssm endpoint rules
        securityGroups.vpcEndpoint.addIngressRule(ec2.Peer.ipv4(this.cidrRange), ec2.Port.tcp(443), 'HTTPS Access');

        // workstationSG rules
        this.subnets.public.forEach(subnet => {
            securityGroups.workstation.addIngressRule(ec2.Peer.ipv4(subnet.ipv4CidrBlock), ec2.Port.tcp(8443), 'NICE DCV TCP access');
        });

        this.allowedRanges.forEach(range => {
            // jumpboxSG rules
            securityGroups.jumpbox.addIngressRule(ec2.Peer.ipv4(range), ec2.Port.tcp(22), 'SSH Access');
            securityGroups.workstation.addIngressRule(ec2.Peer.ipv4(range), ec2.Port.tcp(8443), 'NICE DCV TCP access');
        });
    }
}
