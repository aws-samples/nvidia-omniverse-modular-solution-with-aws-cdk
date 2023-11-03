import { Construct } from 'constructs';
import { SubnetCollection } from '../../types';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy, Tags } from 'aws-cdk-lib';

export const SUBNET_ROOT_NAMES = {
    public: 'public-subnet',
    workstation: 'private-subnet-omniverse-workstations',
    loadBalancer: 'private-subnet-load-balancer',
    reverseProxy: 'private-subnet-reverse-proxy',
    nucleus: 'private-subnet-nucleus-server'
};

export interface VpcResourceProps {
    stackName: string;
    cidrRange: string;
    availabilityZones: number;
    removalPolicy: RemovalPolicy,
}

export class VpcResourcesBase extends Construct {
    public vpc: ec2.Vpc | undefined;
    public subnets: SubnetCollection | undefined;

    protected readonly stackName: string;
    protected readonly removalPolicy: RemovalPolicy;
    protected readonly cidrRange: string;
    protected readonly availabilityZones: number;

    constructor(scope: Construct, id: string, props: VpcResourceProps) {
        super(scope, id);

        this.stackName = props.stackName;
        this.removalPolicy = props.removalPolicy;
        this.cidrRange = props.cidrRange;
        this.availabilityZones = props.availabilityZones;
    }

    protected buildVpc(): { vpc: ec2.Vpc, subnets: SubnetCollection; } {
        const subnetConfigs = this.configureSubnets();
        const vpc = this.createVpc(subnetConfigs);
        const subnets = this.setSubnets(vpc);

        this.tagSubnets(subnets.public, SUBNET_ROOT_NAMES.public);
        this.tagSubnets(subnets.workstation, SUBNET_ROOT_NAMES.workstation);

        return {
            vpc: vpc,
            subnets: subnets
        };
    }

    protected configureSubnets(): ec2.SubnetConfiguration[] {
        const publicSubnetConfig: ec2.SubnetConfiguration = {
            name: SUBNET_ROOT_NAMES.public,
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 20,
            mapPublicIpOnLaunch: true
        };

        const workstationSubnetConfig: ec2.SubnetConfiguration = {
            name: SUBNET_ROOT_NAMES.workstation,
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };

        return [
            publicSubnetConfig,
            workstationSubnetConfig
        ];
    }

    protected createSubnetName(subnet: ec2.ISubnet, rootName: string) {
        return `${this.stackName}-${rootName}-${subnet.availabilityZone[subnet.availabilityZone.length - 1]}`;
    };

    protected tagSubnets(subnets: ec2.ISubnet[], tagValue: string) {
        subnets.forEach((subnet: ec2.ISubnet) => {
            Tags.of(subnet).add("Name", this.createSubnetName(subnet, tagValue));
        });
    };

    protected setSubnets(vpc: ec2.Vpc): SubnetCollection {
        return {
            public: vpc.selectSubnets({
                subnetGroupName: SUBNET_ROOT_NAMES.public,
            }).subnets,
            workstation: vpc.selectSubnets({
                subnetGroupName: SUBNET_ROOT_NAMES.workstation,
            }).subnets
        };
    }

    protected createVpc(
        subnetConfigurations: ec2.SubnetConfiguration[],
    ): ec2.Vpc {
        // logs group for vpc flow logs
        const cloudWatchLogs = new logs.LogGroup(this, 'CloudWatchVPCLogs', {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: this.removalPolicy,
        });

        // Elastic IP for NatGateway
        const eip = new ec2.CfnEIP(this, 'NATGatewayEIP', {
            domain: 'vpc',
        });
        Tags.of(eip).add('Name', `${this.stackName}-eip`);

        // nat gateway
        const natGatewayProvider = ec2.NatProvider.gateway({
            eipAllocationIds: [eip.attrAllocationId],
        });

        // vpc
        return new ec2.Vpc(this, 'OmniverseVpc', {
            vpcName: `${this.stackName}-vpc`,
            ipAddresses: ec2.IpAddresses.cidr(this.cidrRange),
            natGateways: 1,
            maxAzs: this.availabilityZones,
            subnetConfiguration: subnetConfigurations,
            natGatewayProvider: natGatewayProvider,
            flowLogs: {
                'vpc-logs': {
                    destination: ec2.FlowLogDestination.toCloudWatchLogs(cloudWatchLogs),
                    trafficType: ec2.FlowLogTrafficType.ALL,
                },
            },
            createInternetGateway: true,
        });
    }
}
