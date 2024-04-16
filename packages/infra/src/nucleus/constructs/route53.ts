import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone, PrivateHostedZone, PublicHostedZone } from 'aws-cdk-lib/aws-route53';
import { Vpc } from 'aws-cdk-lib/aws-ec2';

export interface Route53ResourceProps {
    vpc: Vpc,
    internetFacing: boolean;
    publicCertificateArn?: string;
    rootDomain: string;
    removalPolicy: RemovalPolicy;
}

export class Route53Resource extends Construct {
    public readonly hostedZone: HostedZone;
    public readonly certificate: Certificate | undefined;

    constructor(scope: Construct, id: string, props: Route53ResourceProps) {
        super(scope, id);

        if (props.internetFacing) {
            this.hostedZone = HostedZone.fromLookup(this, 'PublicHostedZone', {
                domainName: props.rootDomain,
                privateZone: false
            }) as PublicHostedZone;

            if (props.publicCertificateArn) {
                this.certificate = Certificate.fromCertificateArn(this, 'PublicCertificate', props.publicCertificateArn) as Certificate;
            }
        } else {
            this.hostedZone = new PrivateHostedZone(this, 'PrivateHostedZone', {
                zoneName: props.rootDomain,
                vpc: props.vpc
            });

            this.certificate = new Certificate(this, 'PublicCertificate', {
                domainName: props.rootDomain,
                subjectAlternativeNames: [`*.${props.rootDomain}`],
                validation: CertificateValidation.fromDns(this.hostedZone)
            });
        }
    }
}
