import { Construct } from 'constructs';
import { SUBNET_ROOT_NAMES, VpcResourceProps, VpcResourcesBase } from '../../vpc-base/vpc-base';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SubnetCollection } from '../../../types';

export class NucleusVpcResources extends VpcResourcesBase {
    constructor(scope: Construct, id: string, props: VpcResourceProps) {
        super(scope, id, props);

        const { vpc, subnets } = this.buildVpc();
        this.vpc = vpc;
        this.subnets = subnets;
    }

    protected buildVpc(): { vpc: ec2.Vpc, subnets: SubnetCollection; } {
        const subnetConfigs = this.configureSubnets();
        const vpc = this.createVpc(subnetConfigs);
        const subnets = this.setSubnets(vpc);

        this.tagSubnets(subnets.public, SUBNET_ROOT_NAMES.public);
        this.tagSubnets(subnets.workstation, SUBNET_ROOT_NAMES.workstation);

        if (subnets.loadBalancer) {
            this.tagSubnets(subnets.loadBalancer, SUBNET_ROOT_NAMES.loadBalancer);
        }

        if (subnets.reverseProxy) {
            this.tagSubnets(subnets.reverseProxy, SUBNET_ROOT_NAMES.reverseProxy);
        }

        if (subnets.nucleus) {
            this.tagSubnets(subnets.nucleus, SUBNET_ROOT_NAMES.nucleus);
        }

        return {
            vpc: vpc,
            subnets: subnets
        };
    }

    protected override configureSubnets(): ec2.SubnetConfiguration[] {
        let subnetConfigs = super.configureSubnets();

        const loadBalancerSubnetConfig: ec2.SubnetConfiguration = {
            name: SUBNET_ROOT_NAMES.loadBalancer,
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };

        const reverseProxySubnetConfig: ec2.SubnetConfiguration = {
            name: SUBNET_ROOT_NAMES.reverseProxy,
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };

        const nucleusSubnetConfig: ec2.SubnetConfiguration = {
            name: SUBNET_ROOT_NAMES.nucleus,
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };

        subnetConfigs.push(loadBalancerSubnetConfig, reverseProxySubnetConfig, nucleusSubnetConfig);
        return subnetConfigs;
    }

    protected override setSubnets(vpc: ec2.Vpc): SubnetCollection {
        return {
            public: vpc.selectSubnets({
                subnetGroupName: SUBNET_ROOT_NAMES.public,
            }).subnets,
            workstation: vpc.selectSubnets({
                subnetGroupName: SUBNET_ROOT_NAMES.workstation,
            }).subnets,
            loadBalancer: vpc.selectSubnets({
                subnetGroupName: SUBNET_ROOT_NAMES.loadBalancer,
            }).subnets,
            reverseProxy: vpc.selectSubnets({
                subnetGroupName: SUBNET_ROOT_NAMES.reverseProxy,
            }).subnets,
            nucleus: vpc.selectSubnets({
                subnetGroupName: SUBNET_ROOT_NAMES.nucleus,
            }).subnets
        };
    }
}
