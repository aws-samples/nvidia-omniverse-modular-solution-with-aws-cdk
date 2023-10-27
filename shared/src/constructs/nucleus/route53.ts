import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Vpc } from 'aws-cdk-lib/aws-ec2';

export interface Route53ResourceProps {
    vpc: Vpc,
    rootDomain: string;
    removalPolicy: RemovalPolicy;
}

export class Route53Resource extends Construct {
    public readonly hostedZone: HostedZone;
    public readonly certificate: Certificate;

    constructor(scope: Construct, id: string, props: Route53ResourceProps) {
        super(scope, id);

        this.hostedZone = new HostedZone(this, 'PrivateHostedZone', {
            vpcs: [props.vpc],
            zoneName: props.rootDomain,
        });
        this.hostedZone.applyRemovalPolicy(props.removalPolicy);

        this.certificate = new Certificate(this, 'PublicCertificate', {
            domainName: props.rootDomain,
            subjectAlternativeNames: [`*.${props.rootDomain}`],
            validation: CertificateValidation.fromDns(this.hostedZone),
        });
    }
}
