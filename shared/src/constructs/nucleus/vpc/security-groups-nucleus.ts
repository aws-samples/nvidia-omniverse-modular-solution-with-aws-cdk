import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import { SecurityGroupCollection } from '../../../types';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SecurityGroupResourceProps, SecurityGroupResourcesBase } from '../../vpc-base/security-groups-base';

export class NucleusSecurityGroupResources extends SecurityGroupResourcesBase {
    public readonly securityGroups: SecurityGroupCollection;

    constructor(scope: Construct, id: string, props: SecurityGroupResourceProps) {
        super(scope, id, props);

        this.securityGroups = this.createSecurityGroups();
        this.addRules(this.securityGroups);
    };

    protected override createSecurityGroups(): SecurityGroupCollection {
        const securityGroups = super.createSecurityGroups();

        const loadBalancerName = `${this.stackName}-load-balancer`;
        securityGroups.loadBalancer = new ec2.SecurityGroup(this, 'LoadBalancerSG', {
            securityGroupName: loadBalancerName,
            description: 'Load Balancer Security Group',
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        Tags.of(securityGroups.loadBalancer).add('Name', loadBalancerName);

        const reverseProxyName = `${this.stackName}-reverse-proxy`;
        securityGroups.reverseProxy = new ec2.SecurityGroup(this, 'ReverseProxySG', {
            securityGroupName: reverseProxyName,
            description: 'Reverse Proxy Security Group',
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        Tags.of(securityGroups.reverseProxy).add('Name', reverseProxyName);

        const nucleusName = `${this.stackName}-nucleus`;
        securityGroups.nucleus = new ec2.SecurityGroup(this, 'NucleusSG', {
            securityGroupName: nucleusName,
            description: 'Nucleus Server Security Group',
            vpc: this.vpc,
            allowAllOutbound: true,
        });
        Tags.of(securityGroups.nucleus).add('Name', nucleusName);

        return securityGroups;
    }

    protected override addRules(securityGroups: SecurityGroupCollection) {
        super.addRules(securityGroups);

        if (!securityGroups.loadBalancer || !securityGroups.reverseProxy || !securityGroups.nucleus) {
            throw new Error("Failed to get Nucleus Security Groups.");
        }

        if (!this.subnets.loadBalancer || !this.subnets.reverseProxy) {
            throw new Error("Failed to get Nucleus Subnets.");
        }

        // loadBalancer security group rules
        this.subnets.workstation.forEach(subnet => {
            if (securityGroups.loadBalancer) {
                securityGroups.loadBalancer.addIngressRule(ec2.Peer.ipv4(subnet.ipv4CidrBlock), ec2.Port.tcp(80), 'Workstation access');
                securityGroups.loadBalancer.addIngressRule(ec2.Peer.ipv4(subnet.ipv4CidrBlock), ec2.Port.tcp(443), 'Workstation access');
            }
        });

        securityGroups.loadBalancer.addIngressRule(ec2.Peer.securityGroupId(securityGroups.natGatway.securityGroupId), ec2.Port.tcp(443), 'NAT access');

        // reverseProxy security group rules
        this.subnets.loadBalancer.forEach(subnet => {
            if (securityGroups.reverseProxy) {
                securityGroups.reverseProxy.addIngressRule(ec2.Peer.ipv4(subnet.ipv4CidrBlock), ec2.Port.tcp(443), 'Load Balancer access');
            }
        });

        securityGroups.reverseProxy.addIngressRule(ec2.Peer.securityGroupId(securityGroups.natGatway.securityGroupId), ec2.Port.tcp(443), 'NAT access');

        // nucleus security group rules
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

        this.subnets.reverseProxy.forEach(subnet => {
            nucleusRules.forEach((rule) => {
                if (securityGroups.nucleus) {
                    securityGroups.nucleus.addIngressRule(
                        ec2.Peer.ipv4(subnet.ipv4CidrBlock),
                        ec2.Port.tcp(rule.port),
                        rule.desc
                    );
                }
            });
        });

        securityGroups.nucleus.addIngressRule(ec2.Peer.securityGroupId(securityGroups.natGatway.securityGroupId), ec2.Port.tcp(443), 'NAT access');
    }
}
