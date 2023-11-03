import { Construct } from 'constructs';
import { NaclResources, NaclResourcesProps } from '../../vpc-base/nacls-base';

export class WorkstationNaclResources extends NaclResources {
    constructor(scope: Construct, id: string, props: NaclResourcesProps) {
        super(scope, id, props);

        const nacls = this.createNacls();
        this.addEntries(nacls);
    }
}
