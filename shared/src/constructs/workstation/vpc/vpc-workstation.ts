import { Construct } from 'constructs';
import { VpcResourceProps, VpcResourcesBase } from '../../vpc-base/vpc-base';

export class WorkstationVpcResources extends VpcResourcesBase {
    constructor(scope: Construct, id: string, props: VpcResourceProps) {
        super(scope, id, props);

        const { vpc, subnets } = this.buildVpc();
        this.vpc = vpc;
        this.subnets = subnets;
    }
}
