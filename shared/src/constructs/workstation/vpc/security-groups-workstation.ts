import { Construct } from 'constructs';
import { SecurityGroupCollection } from '../../../types';
import { SecurityGroupResourceProps, SecurityGroupResourcesBase } from '../../vpc-base/security-groups-base';

export class WorkstationSecurityGroupResources extends SecurityGroupResourcesBase {
    public readonly securityGroups: SecurityGroupCollection;

    constructor(scope: Construct, id: string, props: SecurityGroupResourceProps) {
        super(scope, id, props);

        this.securityGroups = this.createSecurityGroups();
        this.addRules(this.securityGroups);
    };
}
