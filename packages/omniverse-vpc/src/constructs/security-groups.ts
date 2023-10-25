import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import { SecurityGroupCollection, SubnetCollection } from '../utils/types';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface SecurityGroupResourceProps {
    stackName: string;
    allowedRanges: string[];
    vpc: ec2.Vpc;
    subnets: SubnetCollection;
    cidrRange: string;
}

export class SecurityGroupResources extends Construct {
    public readonly securityGroups: SecurityGroupCollection;

    constructor(scope: Construct, id: string, props: SecurityGroupResourceProps) {
        super(scope, id);

        /**
         * Security Groups
         */
        const natGatewayName = `${props.stackName}-nat-gateway`;
        const natGatewaySG = new ec2.SecurityGroup(this, 'NatGatewaySG', {
            securityGroupName: natGatewayName,
            description: 'NAT Gateway Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(natGatewaySG).add('Name', natGatewayName);

        const loadBalancerName = `${props.stackName}-load-balancer`;
        const loadBalancerSG = new ec2.SecurityGroup(this, 'LoadBalancerSG', {
            securityGroupName: loadBalancerName,
            description: 'Load Balancer Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(loadBalancerSG).add('Name', loadBalancerName);

        const jumpboxName = `${props.stackName}-jumpbox`;
        const jumpboxSG = new ec2.SecurityGroup(this, 'JumpboxSG', {
            securityGroupName: jumpboxName,
            description: 'Jumpbox Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(jumpboxSG).add('Name', jumpboxName);

        const workstationName = `${props.stackName}-workstation`;
        const workstationSG = new ec2.SecurityGroup(this, 'WorkstationSG', {
            securityGroupName: workstationName,
            description: 'Workstation Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(workstationSG).add('Name', workstationName);

        const reverseProxyName = `${props.stackName}-reverse-proxy`;
        const reverseProxySG = new ec2.SecurityGroup(this, 'ReverseProxySG', {
            securityGroupName: reverseProxyName,
            description: 'Reverse Proxy Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(reverseProxySG).add('Name', reverseProxyName);

        const nucleusName = `${props.stackName}-nucleus`;
        const nucleusSG = new ec2.SecurityGroup(this, 'NucleusSG', {
            securityGroupName: nucleusName,
            description: 'Nucleus Server Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(nucleusSG).add('Name', `${props.stackName}-nucleus`);

        const vpcEndpointName = `${props.stackName}-vpc-endpoint`;
        const vpcEndpointSG = new ec2.SecurityGroup(this, 'VPCEndpointSG', {
            securityGroupName: vpcEndpointName,
            description: 'VPC Endpoint Security Group',
            allowAllOutbound: true,
            vpc: props.vpc,
        });
        Tags.of(nucleusSG).add('Name', vpcEndpointName);

        // jumpboxSG rules
        jumpboxSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH Access');

        // workstationSG rules
        props.subnets.public.forEach(subnet => {
            workstationSG.addIngressRule(ec2.Peer.ipv4(subnet.ipv4CidrBlock), ec2.Port.tcp(8443), 'NICE DCV TCP access');
        });
        props.allowedRanges.forEach(range => {
            workstationSG.addIngressRule(ec2.Peer.ipv4(range), ec2.Port.tcp(8443), 'NICE DCV TCP access');
        });

        // loadBalancerSG rules
        props.subnets.workstation.forEach(subnet => {
            loadBalancerSG.addIngressRule(ec2.Peer.ipv4(subnet.ipv4CidrBlock), ec2.Port.tcp(80), 'Workstation access');
            loadBalancerSG.addIngressRule(ec2.Peer.ipv4(subnet.ipv4CidrBlock), ec2.Port.tcp(443), 'Workstation access');
        });

        loadBalancerSG.addIngressRule(ec2.Peer.securityGroupId(natGatewaySG.securityGroupId), ec2.Port.tcp(443), 'NAT access');

        // reverseProxySG rules
        props.subnets.loadBalancer.forEach(subnet => {
            reverseProxySG.addIngressRule(ec2.Peer.ipv4(subnet.ipv4CidrBlock), ec2.Port.tcp(443), 'Load Balancer access');
        });
        reverseProxySG.addIngressRule(ec2.Peer.securityGroupId(natGatewaySG.securityGroupId), ec2.Port.tcp(443), 'NAT access');

        // nucleusSG rules
        const nucleusRules = [
            { port: 80, desc: 'Nucleus Web' },
            { port: 8080, desc: 'Nucleus Web3' },
            { port: 3009, desc: 'Nucleus API' },
            { port: 3010, desc: 'Nucleus Metrics' },
            { port: 3019, desc: 'Nucleus API 2' },
            { port: 3020, desc: 'Nucleus Tagging3' },
            { port: 3030, desc: 'Nucleus LFT' },
            { port: 3100, desc: 'Nucleus Auth' },
            { port: 3180, desc: 'Nucleus Login' },
            { port: 3333, desc: 'Nucleus Discovery' },
            { port: 3400, desc: 'Nucleus Search3' },
        ];

        props.subnets.reverseProxy.forEach(subnet => {
            nucleusRules.forEach((rule) => {
                nucleusSG.addIngressRule(
                    ec2.Peer.ipv4(subnet.ipv4CidrBlock),
                    ec2.Port.tcp(rule.port),
                    rule.desc
                );
            });
        });
        nucleusSG.addIngressRule(ec2.Peer.securityGroupId(natGatewaySG.securityGroupId), ec2.Port.tcp(443), 'NAT access');

        // ssm endpoint rules
        vpcEndpointSG.addIngressRule(ec2.Peer.ipv4(props.cidrRange), ec2.Port.tcp(443), 'HTTPS Access');

        /**
         * Outputs
         */
        this.securityGroups = {
            loadBalancer: loadBalancerSG,
            jumpbox: jumpboxSG,
            workstation: workstationSG,
            reverseProxy: reverseProxySG,
            nucleus: nucleusSG,
            vpcEndpoint: vpcEndpointSG,
        };
    };
}
