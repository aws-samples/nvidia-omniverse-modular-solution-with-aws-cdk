

import { Tags } from 'aws-cdk-lib';
import { IVpc, Peer, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { SubnetCollection } from '../../../types';

export interface NucleusSecurityGroupsProps {
    stackName: string;
    vpc: IVpc;
    subnets: SubnetCollection;
    allowedRanges: Array<string>;
    internetFacing: boolean;

}
export class NucleusSecurityGroups extends Construct {
    public readonly loadBalancer: SecurityGroup;
    public readonly reverseProxy: SecurityGroup;
    public readonly nucleus: SecurityGroup;

    constructor(scope: Construct, id: string, props: NucleusSecurityGroupsProps) {
        super(scope, id);

        this.loadBalancer = new SecurityGroup(this, 'LoadBalancerSecurityGroup', {
            securityGroupName: `${props.stackName}LoadBalancerSecurityGroup`,
            description: 'Load Balancer Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(this.loadBalancer).add('Name', `${props.stackName}LoadBalancerSecurityGroup`);

        this.reverseProxy = new SecurityGroup(this, 'ReverseProxySecurityGroup', {
            securityGroupName: `${props.stackName}ReverseProxySecurityGroup`,
            description: 'Reverse Proxy Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(this.reverseProxy).add('Name', `${props.stackName}ReverseProxySecurityGroup`);

        this.nucleus = new SecurityGroup(this, 'NucleusSecurityGroup', {
            securityGroupName: `${props.stackName}NucleusSecurityGroup`,
            description: 'Nucleus Server Security Group',
            vpc: props.vpc,
            allowAllOutbound: true,
        });
        Tags.of(this.nucleus).add('Name', `${props.stackName}NucleusSecurityGroup`);

        this.addRules(props.subnets, props.allowedRanges, props.internetFacing);
    }

    private addRules(subnets: SubnetCollection, allowedRanges: Array<string>, internetFacing: boolean) {
        // loadBalancerSG rules
        subnets.workstation?.forEach(subnet => {
            this.loadBalancer.addIngressRule(Peer.ipv4(subnet.ipv4CidrBlock), Port.tcp(80), 'virtual workstation access');
            this.loadBalancer.addIngressRule(Peer.ipv4(subnet.ipv4CidrBlock), Port.tcp(443), 'virtual workstation access');
        });

        if (internetFacing) {
            allowedRanges.forEach(range => {
                this.loadBalancer.addIngressRule(Peer.ipv4(range), Port.tcp(80), 'allowed range access');
                this.loadBalancer.addIngressRule(Peer.ipv4(range), Port.tcp(443), 'allowed range access');
            });
        }

        // reverseProxySG rules
        subnets.loadBalancer?.forEach(subnet => {
            this.reverseProxy.addIngressRule(Peer.ipv4(subnet.ipv4CidrBlock), Port.tcp(443), 'load balancer access');
        });

        // nucleusSG rules
        const nucleusRules = [
            { port: 80, desc: 'nucleus web' },
            { port: 8080, desc: 'nucleus web3' },
            { port: 3009, desc: 'nucleus api' },
            { port: 3010, desc: 'nucleus metrics' },
            { port: 3019, desc: 'nucleus api 2' },
            { port: 3020, desc: 'nucleus tagging3' },
            { port: 3030, desc: 'nucleus lft' },
            { port: 3100, desc: 'nucleus auth' },
            { port: 3180, desc: 'nucleus login' },
            { port: 3333, desc: 'nucleus discovery' },
            { port: 3400, desc: 'nucleus search3' },
        ];

        subnets.reverseProxy?.forEach(subnet => {
            nucleusRules.forEach((rule) => {
                this.nucleus.addIngressRule(
                    Peer.ipv4(subnet.ipv4CidrBlock),
                    Port.tcp(rule.port),
                    rule.desc
                );
            });
        });
    }
}