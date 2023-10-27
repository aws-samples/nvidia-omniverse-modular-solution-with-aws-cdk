import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import { SubnetCollection } from '../utils/types';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface NaclResourcesProps {
    stackName: string;
    allowedRanges: string[];
    vpc: ec2.Vpc;
    subnets: SubnetCollection;
}

export class NaclResources extends Construct {
    constructor(scope: Construct, id: string, props: NaclResourcesProps) {
        super(scope, id);

        /**
        * Network Access Control Lists (NACLs)
        */
        /**
         * Public Subnet NACL
         * Allows SSH traffic for Jumpbox
         * Allows HTTPS and HTTP traffic for Load Balancer access
         */
        const publicNacl = new ec2.NetworkAcl(this, 'PublicNacl', {
            networkAclName: `${props.stackName}-public`,
            vpc: props.vpc,
            subnetSelection: props.vpc.selectSubnets({
                subnets: props.subnets.public
            }),
        });
        Tags.of(publicNacl).add('Name', `${props.stackName}-public`);

        // add allowed ranges from infra.config to ssh to jumpboxes
        props.allowedRanges.forEach((range, index) => {
            publicNacl.addEntry(`PrimaryNaclIngressSshRange${index}`, {
                direction: ec2.TrafficDirection.INGRESS,
                ruleNumber: 50 + index,
                traffic: ec2.AclTraffic.tcpPort(22),
                cidr: ec2.AclCidr.ipv4(range),
                ruleAction: ec2.Action.ALLOW,
            });
        });

        publicNacl.addEntry('PrimaryNaclIngressHttps', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.tcpPort(443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        publicNacl.addEntry('PrimaryNaclIngressHttp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 300,
            traffic: ec2.AclTraffic.tcpPort(80),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        publicNacl.addEntry('PrimaryNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        publicNacl.addEntry('PrimaryNaclEgress', {
            direction: ec2.TrafficDirection.EGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.allTraffic(),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        /**
         * Workstation Subnet NACL
         * Allows 8443 TCP & UDP traffic for NICE DCV Viewer
         */
        const workstationNacl = new ec2.NetworkAcl(this, 'WorkstationNacl', {
            networkAclName: `${props.stackName}-workstation`,
            vpc: props.vpc,
            subnetSelection: props.vpc.selectSubnets({
                subnets: props.subnets.workstation
            })
        });
        Tags.of(workstationNacl).add('Name', `${props.stackName}-workstation`);

        workstationNacl.addEntry('WorkstationNaclIngressNiceTcp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.tcpPort(8443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        workstationNacl.addEntry('WorkstationNaclIngressNiceUdp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.udpPort(8443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        workstationNacl.addEntry('WorkstationNaclIngressJumpboxTunnel', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 300,
            traffic: ec2.AclTraffic.udpPort(8888),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        workstationNacl.addEntry('WorkstationNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        workstationNacl.addEntry('WorkstationNaclEgress', {
            direction: ec2.TrafficDirection.EGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.allTraffic(),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        /**
         * LoadBalancer Subnet NACL
         * Allows 80 & 443 for Load Balancer & NAT Gateway
         */
        const loadBalancerNacl = new ec2.NetworkAcl(this, 'LoadBalancerNacl', {
            networkAclName: `${props.stackName}-load-balancer`,
            vpc: props.vpc,
            subnetSelection: props.vpc.selectSubnets({
                subnets: props.subnets.loadBalancer
            })
        });
        Tags.of(loadBalancerNacl).add('Name', `${props.stackName}-load-balancer`);

        loadBalancerNacl.addEntry('LoadBalancerNaclIngressHttps', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.tcpPort(443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        loadBalancerNacl.addEntry('LoadBalancerNaclIngressHttp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.tcpPort(80),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        loadBalancerNacl.addEntry('LoadBalancerNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        loadBalancerNacl.addEntry('LoadBalancerNaclEgress', {
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
        const reverseProxyNacl = new ec2.NetworkAcl(this, 'ReverseProxyNacl', {
            networkAclName: `${props.stackName}-reverse-proxy`,
            vpc: props.vpc,
            subnetSelection: props.vpc.selectSubnets({
                subnets: props.subnets.reverseProxy
            })
        });
        Tags.of(reverseProxyNacl).add('Name', `${props.stackName}-reverse-proxy`);

        reverseProxyNacl.addEntry('ReverseProxyNaclIngressHttps', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.tcpPort(443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        reverseProxyNacl.addEntry('ReverseProxyNaclIngressHttp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.tcpPort(80),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        reverseProxyNacl.addEntry('ReverseProxyNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        reverseProxyNacl.addEntry('ReverseProxyNaclEgress', {
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
        const nucleusNacl = new ec2.NetworkAcl(this, 'NucleusNacl', {
            networkAclName: `${props.stackName}-nucleus`,
            vpc: props.vpc,
            subnetSelection: props.vpc.selectSubnets({
                subnets: props.subnets.nucleus
            })
        });
        Tags.of(nucleusNacl).add('Name', `${props.stackName}-nucleus`);

        nucleusNacl.addEntry('NucleusNaclIngressHttps', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.tcpPort(443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nucleusNacl.addEntry('NucleusNaclIngressHttp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.tcpPort(80),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nucleusNacl.addEntry('NucleusNaclIngressNucleusRange', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 300,
            traffic: ec2.AclTraffic.tcpPortRange(3009, 3400),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nucleusNacl.addEntry('NucleusNaclIngressNucleusWeb3', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 400,
            traffic: ec2.AclTraffic.tcpPort(8080),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nucleusNacl.addEntry('NucleusNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nucleusNacl.addEntry('NucleusNaclEgress', {
            direction: ec2.TrafficDirection.EGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.allTraffic(),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });
    }
}
