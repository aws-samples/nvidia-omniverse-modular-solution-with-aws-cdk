import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import { NaclCollection, SubnetCollection } from '../../types';;
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface NaclResourcesProps {
    stackName: string;
    allowedRanges: string[];
    vpc: ec2.Vpc;
    subnets: SubnetCollection;
}

export class NaclResources extends Construct {
    protected readonly stackName: string;
    protected readonly allowedRanges: string[];
    protected readonly vpc: ec2.Vpc;
    protected readonly subnets: SubnetCollection;

    constructor(scope: Construct, id: string, props: NaclResourcesProps) {
        super(scope, id);

        this.stackName = props.stackName;
        this.allowedRanges = props.allowedRanges;
        this.vpc = props.vpc;
        this.subnets = props.subnets;
    }

    protected createNacls(): NaclCollection {
        const publicNacl = new ec2.NetworkAcl(this, 'PublicNacl', {
            networkAclName: `${this.stackName}-public`,
            vpc: this.vpc,
            subnetSelection: this.vpc.selectSubnets({
                subnets: this.subnets.public
            }),
        });
        Tags.of(publicNacl).add('Name', `${this.stackName}-public`);

        const workstationNacl = new ec2.NetworkAcl(this, 'WorkstationNacl', {
            networkAclName: `${this.stackName}-workstation`,
            vpc: this.vpc,
            subnetSelection: this.vpc.selectSubnets({
                subnets: this.subnets.workstation
            })
        });
        Tags.of(workstationNacl).add('Name', `${this.stackName}-workstation`);

        return {
            public: publicNacl,
            workstation: workstationNacl
        };
    };

    protected addEntries(nacls: NaclCollection): void {
        /**
         * Public Subnet NACL
         * Allows SSH traffic for Jumpbox
         * Allows HTTPS and HTTP traffic for Load Balancer access
         */
        // add allowed ranges from infra.config to ssh to jumpboxes

        this.allowedRanges.forEach((range, index) => {
            nacls.public.addEntry(`PrimaryNaclIngressSshRange${index}`, {
                direction: ec2.TrafficDirection.INGRESS,
                ruleNumber: 50 + index,
                traffic: ec2.AclTraffic.tcpPort(22),
                cidr: ec2.AclCidr.ipv4(range),
                ruleAction: ec2.Action.ALLOW,
            });
        });

        nacls.public.addEntry('PrimaryNaclIngressHttps', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.tcpPort(443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.public.addEntry('PrimaryNaclIngressHttp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 300,
            traffic: ec2.AclTraffic.tcpPort(80),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.public.addEntry('PrimaryNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.public.addEntry('PrimaryNaclEgress', {
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
        nacls.workstation.addEntry('WorkstationNaclIngressNiceTcp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.tcpPort(8443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.workstation.addEntry('WorkstationNaclIngressNiceUdp', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 200,
            traffic: ec2.AclTraffic.udpPort(8443),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.workstation.addEntry('WorkstationNaclIngressJumpboxTunnel', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 300,
            traffic: ec2.AclTraffic.udpPort(8888),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.workstation.addEntry('WorkstationNaclIngressALL', {
            direction: ec2.TrafficDirection.INGRESS,
            ruleNumber: 1000,
            traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });

        nacls.workstation.addEntry('WorkstationNaclEgress', {
            direction: ec2.TrafficDirection.EGRESS,
            ruleNumber: 100,
            traffic: ec2.AclTraffic.allTraffic(),
            cidr: ec2.AclCidr.anyIpv4(),
            ruleAction: ec2.Action.ALLOW,
        });
    }
}
