import { Construct } from 'constructs';
import { SubnetCollection } from '../utils/types';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy, Tags } from 'aws-cdk-lib';

export interface VpcResourceProps {
    stackName: string;
    cidrRange: string;
    availabilityZones: number;
    removalPolicy: RemovalPolicy,
}

export class VpcResources extends Construct {
    public readonly vpc: ec2.Vpc;
    public readonly subnets: SubnetCollection;

    constructor(scope: Construct, id: string, props: VpcResourceProps) {
        super(scope, id);

        /**
        * Subnets
        */
        const publicSubnetGroupName = 'public-subnet';
        const publicSubnetConfig: ec2.SubnetConfiguration = {
            name: publicSubnetGroupName,
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 20,
            mapPublicIpOnLaunch: true
        };

        const workstationSubnetGroupName = 'private-subnet-omniverse-workstations';
        const workstationSubnetConfig: ec2.SubnetConfiguration = {
            name: workstationSubnetGroupName,
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };

        const loadBalancerSubnetGroupName = 'private-subnet-load-balancer';
        const loadBalancerSubnetConfig: ec2.SubnetConfiguration = {
            name: loadBalancerSubnetGroupName,
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };

        const reverseProxySubnetGroupName = 'private-subnet-reverse-proxy';
        const reverseProxySubnetConfig: ec2.SubnetConfiguration = {
            name: reverseProxySubnetGroupName,
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };

        const nucleusSubnetGroupName = 'private-subnet-nucleus-server';
        const nucleusSubnetConfig: ec2.SubnetConfiguration = {
            name: nucleusSubnetGroupName,
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };

        /**
         * VPC
         */
        const cloudWatchLogs = new logs.LogGroup(this, 'CloudWatchVPCLogs', {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: props.removalPolicy,
        });

        // Elastic IP for NatGateway
        const eip = new ec2.CfnEIP(this, 'NATGatewayEIP', {
            domain: 'vpc',
        });
        Tags.of(eip).add('Name', `${props.stackName}-eip`);

        const natGatewayProvider = ec2.NatProvider.gateway({
            eipAllocationIds: [eip.attrAllocationId],
        });


        this.vpc = new ec2.Vpc(this, 'OmniverseVpc', {
            vpcName: `${props.stackName}-vpc`,
            ipAddresses: ec2.IpAddresses.cidr(props.cidrRange),
            natGateways: 1,
            maxAzs: props.availabilityZones,
            subnetConfiguration: [
                publicSubnetConfig,
                workstationSubnetConfig,
                loadBalancerSubnetConfig,
                reverseProxySubnetConfig,
                nucleusSubnetConfig,
            ],
            natGatewayProvider: natGatewayProvider,
            flowLogs: {
                'vpc-logs': {
                    destination: ec2.FlowLogDestination.toCloudWatchLogs(cloudWatchLogs),
                    trafficType: ec2.FlowLogTrafficType.ALL,
                },
            },
            createInternetGateway: true,
        });

        this.subnets = {
            public: this.vpc.selectSubnets({
                subnetGroupName: publicSubnetConfig.name,
            }).subnets,
            workstation: this.vpc.selectSubnets({
                subnetGroupName: workstationSubnetConfig.name,
            }).subnets,
            loadBalancer: this.vpc.selectSubnets({
                subnetGroupName: loadBalancerSubnetConfig.name,
            }).subnets,
            reverseProxy: this.vpc.selectSubnets({
                subnetGroupName: reverseProxySubnetConfig.name,
            }).subnets,
            nucleus: this.vpc.selectSubnets({
                subnetGroupName: nucleusSubnetConfig.name,
            }).subnets,
        };

        const createSubnetName = (subnet: ec2.ISubnet, rootName: string) => {
            return `${props.stackName}-${rootName}-${subnet.availabilityZone[subnet.availabilityZone.length - 1]}`;
        };

        this.subnets.public.forEach((subnet) => {
            Tags.of(subnet).add("Name", createSubnetName(subnet, publicSubnetGroupName));
        });

        this.subnets.workstation.forEach((subnet) => {
            Tags.of(subnet).add("Name", createSubnetName(subnet, workstationSubnetGroupName));
        });

        this.subnets.loadBalancer.forEach((subnet) => {
            Tags.of(subnet).add("Name", createSubnetName(subnet, loadBalancerSubnetGroupName));
        });

        this.subnets.reverseProxy.forEach((subnet) => {
            Tags.of(subnet).add("Name", createSubnetName(subnet, reverseProxySubnetGroupName));
        });

        this.subnets.nucleus.forEach((subnet) => {
            Tags.of(subnet).add("Name", createSubnetName(subnet, nucleusSubnetGroupName));
        });
    }
}
