// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CfnOutput, Stack, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { BaseStackProps, SecurityGroupCollection, SubnetCollection, SubnetConfigurationCollection } from '../../types';
import { NucleusSubnets } from '../constructs/nucleus/nucleus-subnets';
import { WorkstationSubnets } from '../constructs/workstation/workstation-subnets';
import { WorkstationSecurityGroups } from '../constructs/workstation/workstation-security-groups';
import { NucleusSecurityGroups } from '../constructs/nucleus/nucleus-security-groups';

export interface VpcStackProps extends BaseStackProps {
    cidrRange: string;
    allowedRanges: string[];
    internetFacing: boolean;
}

export class VpcStack extends Stack {
    public readonly vpc: ec2.Vpc;
    public readonly securityGroups: SecurityGroupCollection;
    public readonly subnets: SubnetCollection;

    constructor(scope: Construct, id: string, props: VpcStackProps) {
        super(scope, id, props);

        if (!props.stackName) {
            throw new Error(
                "Unable to resolve 'stackName'. Please provide a stack name in the config.json file.",
            );
        }
        console.info(`>>> Building Omniverse VPC Stack. Stack Name: ${props.stackName}`);

        /**
         * Subnets
         */
        const subnetConfigurationCollection: SubnetConfigurationCollection = {
            public: {
                name: 'Public',
                subnetType: ec2.SubnetType.PUBLIC,
                cidrMask: 20,
                mapPublicIpOnLaunch: true
            }
        };

        if (props.configurator.WorkstationAmi || props.configurator.WorkstationFleet) {
            const { workstation: workstationSubnet } = new WorkstationSubnets(this, 'WorkstationSubnets');
            subnetConfigurationCollection.workstation = workstationSubnet;
        }

        if (props.configurator.Nucleus) {
            const { loadBalancer, reverseProxy, nucleus } = new NucleusSubnets(this, 'NucleusSubnets', {
                ...props
            });

            if (loadBalancer) {
                subnetConfigurationCollection.loadBalancer = loadBalancer;
            }
            subnetConfigurationCollection.reverseProxy = reverseProxy;
            subnetConfigurationCollection.nucleus = nucleus;
        }

        /**
         * VPC
         */
        const cloudWatchLogs = new LogGroup(this, 'CloudWatchVpcLogs', {
            retention: RetentionDays.ONE_WEEK,
            removalPolicy: props.removalPolicy,
        });

        // Elastic IP for NatGateway
        const eip1 = new ec2.CfnEIP(this, 'NatGatewayEIP1', {
            domain: 'vpc',
        });
        Tags.of(eip1).add('Name', 'NatGatewayEip1');

        const eip2 = new ec2.CfnEIP(this, 'NatGatewayEIP2', {
            domain: 'vpc',
        });
        Tags.of(eip2).add('Name', 'NatGatewayEip2');

        const natGatewayProvider = ec2.NatProvider.gateway({
            eipAllocationIds: [eip1.attrAllocationId, eip2.attrAllocationId],
        });

        this.vpc = new ec2.Vpc(this, 'Vpc', {
            vpcName: `${props.stackName}Vpc`,
            ipAddresses: ec2.IpAddresses.cidr(props.cidrRange),
            natGateways: 2,
            maxAzs: 2,
            subnetConfiguration: Object.values(subnetConfigurationCollection),
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
                subnetGroupName: subnetConfigurationCollection.public.name,
            }).subnets,
            workstation: subnetConfigurationCollection.workstation ? this.vpc.selectSubnets({
                subnetGroupName: subnetConfigurationCollection.workstation.name,
            }).subnets : undefined,
            reverseProxy: subnetConfigurationCollection.reverseProxy ? this.vpc.selectSubnets({
                subnetGroupName: subnetConfigurationCollection.reverseProxy.name,
            }).subnets : undefined,
            nucleus: subnetConfigurationCollection.nucleus ? this.vpc.selectSubnets({
                subnetGroupName: subnetConfigurationCollection.nucleus.name,
            }).subnets : undefined,
        };

        if (props.internetFacing) {
            this.subnets.loadBalancer = this.subnets.public;
        } else {
            this.subnets.loadBalancer = subnetConfigurationCollection.loadBalancer ? this.vpc.selectSubnets({
                subnetGroupName: subnetConfigurationCollection.loadBalancer.name,
            }).subnets : undefined;
        }

        /**
         * Security Groups
         */
        this.securityGroups = {
            natGateway: new ec2.SecurityGroup(this, 'NatGatewaySecurityGroup', {
                securityGroupName: `${props.stackName}NatGatewaySecurityGroup`,
                description: 'NAT Gateway Security Group',
                vpc: this.vpc,
                allowAllOutbound: true,
            }),
            vpcEndpoint: new ec2.SecurityGroup(this, 'VpcEndpointSecurityGroup', {
                securityGroupName: `${props.stackName}VpcEndpointSecurityGroup`,
                vpc: this.vpc,
                allowAllOutbound: true,
                description: 'VPC Endpoint Security Group',
            })
        };
        Tags.of(this.securityGroups.natGateway).add('Name', `${props.stackName}NatGatewaySecurityGroup`);
        Tags.of(this.securityGroups.vpcEndpoint).add('Name', `${props.stackName}VpcEndpointSecurityGroup`);

        let workstationSecurityGroups: WorkstationSecurityGroups;
        if (props.configurator.WorkstationAmi || props.configurator.WorkstationFleet) {
            workstationSecurityGroups = new WorkstationSecurityGroups(this, 'WorkstationSecurityGroups', {
                stackName: props.stackName,
                vpc: this.vpc,
                subnets: this.subnets,
                allowedRanges: props.allowedRanges
            });
            this.securityGroups.jumpbox = workstationSecurityGroups.jumpbox;
            this.securityGroups.workstation = workstationSecurityGroups.workstation;
        }

        let nucleusSecurityGroups: NucleusSecurityGroups;
        if (props.configurator.Nucleus) {
            nucleusSecurityGroups = new NucleusSecurityGroups(this, 'NucleusSecurityGroups', {
                stackName: props.stackName,
                vpc: this.vpc,
                subnets: this.subnets,
                allowedRanges: [...props.allowedRanges, `${eip1.attrPublicIp}/32`, `${eip2.attrPublicIp}/32`],
                internetFacing: props.internetFacing
            });

            this.securityGroups.loadBalancer = nucleusSecurityGroups.loadBalancer;
            this.securityGroups.reverseProxy = nucleusSecurityGroups.reverseProxy;
            this.securityGroups.nucleus = nucleusSecurityGroups.nucleus;
        }

        // ssm endpoint rules
        this.securityGroups.vpcEndpoint.addIngressRule(ec2.Peer.ipv4(props.cidrRange), ec2.Port.tcp(443), 'https access');

        /**
         * Service Endpoints
         */
        // S3 Gateway Endpoint
        const s3GatewayEndpoint = this.vpc.addGatewayEndpoint('S3GatewayEndpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [
                { subnets: this.subnets.reverseProxy },
                { subnets: this.subnets.nucleus },
                { subnets: this.subnets.workstation }],
        });
        Tags.of(s3GatewayEndpoint).add('Name', `${props.stackName}S3GatewayEndpoint`);

        // SSM Endpoint
        const ssmEndpoint = this.vpc.addInterfaceEndpoint(
            'SsmInterfaceEndpoint',
            {
                service: ec2.InterfaceVpcEndpointAwsService.SSM,
                subnets: { subnets: this.subnets.nucleus },
                securityGroups: [this.securityGroups.vpcEndpoint],
                open: true,
            }
        );
        Tags.of(ssmEndpoint).add('Name', `${props.stackName}SsmInterfaceEndpoint`);

        // SSM Messages Endpoint
        const ssmMessagesEndpoint = this.vpc.addInterfaceEndpoint(
            'SsmMessagesInterfaceEndpoint',
            {
                service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
                subnets: { subnets: this.subnets.nucleus },
                securityGroups: [this.securityGroups.vpcEndpoint],
                open: true,
            }
        );
        Tags.of(ssmMessagesEndpoint).add('Name', `${props.stackName}SsmMessagesInterfaceEndpoint`);

        // EC2 Messages Endpoint
        const ec2MessagesEndpoint = this.vpc.addInterfaceEndpoint(
            'Ec2MessagesInterfaceEndpoint',
            {
                service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
                subnets: { subnets: this.subnets.nucleus },
                securityGroups: [this.securityGroups.vpcEndpoint],
                open: true,
            }
        );
        Tags.of(ec2MessagesEndpoint).add('Name', `${props.stackName}Ec2MessagesInterfaceEndpoint`);

        /**
         * Outputs
         */
        new CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
        });
    }
}
