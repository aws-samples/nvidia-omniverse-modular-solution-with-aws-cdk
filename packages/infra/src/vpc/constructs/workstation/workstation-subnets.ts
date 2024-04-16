

import { Construct } from 'constructs';
import { SubnetConfiguration, SubnetType } from 'aws-cdk-lib/aws-ec2';

export interface WorkstationSubnetProps { };

export class WorkstationSubnets extends Construct {
    public readonly workstation: SubnetConfiguration;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        this.workstation = {
            name: 'PrivateSubnetWorkstations',
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 20,
        };
    }
}