

import { Construct } from 'constructs';
import { SubnetConfiguration, SubnetType } from 'aws-cdk-lib/aws-ec2';


export class NucleusSubnets extends Construct {
    public readonly loadBalancer: SubnetConfiguration | undefined;
    public readonly reverseProxy: SubnetConfiguration;
    public readonly nucleus: SubnetConfiguration;

    constructor(scope: Construct, id: string, props: { internetFacing: boolean; }) {
        super(scope, id);

        if (!props.internetFacing) {
            this.loadBalancer = {
                name: 'PrivateSubnetLoadBalancer',
                subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                cidrMask: 20,
            };
        }

        this.reverseProxy = {
            name: 'PrivateSubnetReverseProxy',
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };

        this.nucleus = {
            name: 'PrivateSubnetNucleusServer',
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };
    }
}