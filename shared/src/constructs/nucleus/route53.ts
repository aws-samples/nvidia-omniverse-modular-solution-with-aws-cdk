import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Certificate, CertificateValidation, PrivateCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { CertificateAuthority } from 'aws-cdk-lib/aws-acmpca';

export interface Route53ResourceProps {
    publicZoneId?: string,
    privateCaArn?: string,
    vpc: Vpc,
    rootDomain: string;
    removalPolicy: RemovalPolicy;
}

export class Route53Resource extends Construct {
    public readonly hostedZone: HostedZone | undefined;
    public readonly certificate: Certificate | undefined;

    constructor(scope: Construct, id: string, props: Route53ResourceProps) {
        super(scope, id);

        if (props.publicZoneId) {
            this.hostedZone = HostedZone.fromHostedZoneId(this, 'HostedZone', props.publicZoneId) as HostedZone;

            this.certificate = new Certificate(this, 'PublicCertificate', {
                domainName: props.rootDomain,
                subjectAlternativeNames: [`*.${props.rootDomain}`],
                validation: CertificateValidation.fromDns(this.hostedZone)
            });
        }

        if (props.privateCaArn) {
            this.hostedZone = new HostedZone(this, 'PrivateHostedZone', {
                vpcs: [props.vpc],
                zoneName: props.rootDomain,
            });
            this.hostedZone.applyRemovalPolicy(props.removalPolicy);

            this.certificate = new PrivateCertificate(this, 'PrivateCertificate', {
                domainName: props.rootDomain,
                subjectAlternativeNames: [`*.${props.rootDomain}`],
                certificateAuthority: CertificateAuthority.fromCertificateAuthorityArn(this, 'PrivateCALookup', props.privateCaArn),
            });
            this.certificate.applyRemovalPolicy(props.removalPolicy);
        }
    }
}
