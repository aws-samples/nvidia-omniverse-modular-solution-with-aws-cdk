

import { Tags } from 'aws-cdk-lib';
import { IVpc, Peer, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { SubnetCollection } from '../../../types';

export interface WorkstationSecurityGroupsProps {
    stackName: string;
    vpc: IVpc;
    subnets: SubnetCollection;
    allowedRanges: Array<string>;
}

export class WorkstationSecurityGroups extends Construct {
    public readonly jumpbox: SecurityGroup;
    public readonly workstation: SecurityGroup;

    constructor(scope: Construct, id: string, props: WorkstationSecurityGroupsProps) {
        super(scope, id);

        this.jumpbox = new SecurityGroup(this, 'JumpboxSecurityGroup', {
            securityGroupName: `${props.stackName}JumpboxSecurityGroup`,
            description: 'Jumpbox Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(this.jumpbox).add('Name', `${props.stackName}JumpboxSecurityGroup`);

        this.workstation = new SecurityGroup(this, 'WorkstationSecurityGroup', {
            securityGroupName: `${props.stackName}WorkstationSecurityGroup`,
            description: 'Workstation Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(this.workstation).add('Name', `${props.stackName}WorkstationSecurityGroup`);

        this.addRules(props.subnets, props.allowedRanges);
    }

    private addRules(subnets: SubnetCollection, allowedRanges: Array<string>) {
        // jumpboxSG rules
        allowedRanges.forEach(range => {
            this.jumpbox.addIngressRule(Peer.ipv4(range), Port.tcp(22), 'ssh access');
        });

        // workstationSG rules
        subnets.public.forEach(subnet => {
            this.workstation.addIngressRule(Peer.ipv4(subnet.ipv4CidrBlock), Port.tcp(8443), 'nice dcv tcp access');
        });

        allowedRanges.forEach(range => {
            this.workstation.addIngressRule(Peer.ipv4(range), Port.tcp(8443), 'nice dcv tcp access');
        });
    }
}

