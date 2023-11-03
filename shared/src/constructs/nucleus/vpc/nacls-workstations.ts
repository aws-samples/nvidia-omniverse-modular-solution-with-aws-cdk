import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import { NaclResources, NaclResourcesProps } from '../../vpc-base/nacls-base';
import { NaclCollection } from '../../../types';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class NucleusNaclResources extends NaclResources {
    constructor(scope: Construct, id: string, props: NaclResourcesProps) {
        super(scope, id, props);

        const nacls = this.createNacls();
        this.addEntries(nacls);
    }

    protected override createNacls(): NaclCollection {
        const nacls = super.createNacls();

        nacls.loadBalancer = new ec2.NetworkAcl(this, 'LoadBalancerNacl', {
            networkAclName: `${this.stackName}-load-balancer`,
            vpc: this.vpc,
            subnetSelection: this.vpc.selectSubnets({
                subnets: this.subnets.loadBalancer
            })
        });
        Tags.of(nacls.loadBalancer).add('Name', `${this.stackName}-load-balancer`);

        nacls.reverseProxy = new ec2.NetworkAcl(this, 'ReverseProxyNacl', {
            networkAclName: `${this.stackName}-reverse-proxy`,
            vpc: this.vpc,
            subnetSelection: this.vpc.selectSubnets({
                subnets: this.subnets.reverseProxy
            })
        });
        Tags.of(nacls.reverseProxy).add('Name', `${this.stackName}-reverse-proxy`);

        nacls.nucleus = new ec2.NetworkAcl(this, 'NucleusNacl', {
            networkAclName: `${this.stackName}-nucleus`,
            vpc: this.vpc,
            subnetSelection: this.vpc.selectSubnets({
                subnets: this.subnets.nucleus
            })
        });
        Tags.of(nacls.nucleus).add('Name', `${this.stackName}-nucleus`);

        return nacls;
    }

    protected override addEntries(nacls: NaclCollection): void {
        super.addEntries(nacls);

        if (!nacls.loadBalancer || !nacls.reverseProxy || !nacls.nucleus) {
            throw new Error("Failed to get Nucleus NACLs.");
        }

        /**
         * LoadBalancer Subnet NACL
         * Allows 80 & 443 for Load Balancer & NAT Gateway
         */
        nacls.loadBalancer.addEntry('LoadBalancerNaclIngressHttps', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.tcpPort(443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.loadBalancer.addEntry('LoadBalancerNaclIngressHttp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.tcpPort(80),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.loadBalancer.addEntry('LoadBalancerNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.loadBalancer.addEntry('LoadBalancerNaclEgress', {
            direction: ec2.TrafficDirection.EGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.allTraffic(),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        /**
         * Reverse Proxy Subnet NACL
         * Allows 80 & 443 for Load Balancer & NAT Gateway
         */
        nacls.reverseProxy.addEntry('ReverseProxyNaclIngressHttps', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.tcpPort(443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.reverseProxy.addEntry('ReverseProxyNaclIngressHttp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.tcpPort(80),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.reverseProxy.addEntry('ReverseProxyNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.reverseProxy.addEntry('ReverseProxyNaclEgress', {
            direction: ec2.TrafficDirection.EGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.allTraffic(),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        /**
         * Nucleus Server Subnet NACL
         * Allows traffic for Nucleus ports
         */
        nacls.nucleus.addEntry('NucleusNaclIngressHttps', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.tcpPort(443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.nucleus.addEntry('NucleusNaclIngressHttp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.tcpPort(80),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.nucleus.addEntry('NucleusNaclIngressNucleusRange', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 300,
            traffic: ec2.AclTraffic.tcpPortRange(3009, 3400),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.nucleus.addEntry('NucleusNaclIngressNucleusWeb3', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 400,
            traffic: ec2.AclTraffic.tcpPort(8080),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.nucleus.addEntry('NucleusNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.nucleus.addEntry('NucleusNaclEgress', {
            direction: ec2.TrafficDirection.EGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.allTraffic(),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });
    }
}
