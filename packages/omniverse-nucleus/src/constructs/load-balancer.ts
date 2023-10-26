import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { IConnectable, ISubnet, Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';

export interface LoadBalancerResourcesProps {
    vpc: Vpc;
    subnets: ISubnet[];
    securityGroup: SecurityGroup;
    subdomain: string;
    rootDomain: string;
    certificate: Certificate;
    hostedZone: IHostedZone;
    autoscalingGroup: AutoScalingGroup;
    connections: IConnectable[];
    logsBucket: s3.Bucket;
    removalPolicy: RemovalPolicy;
}

export class LoadBalancerResources extends Construct {
    public readonly loadBalancer: elb.ApplicationLoadBalancer;

    constructor(scope: Construct, id: string, props: LoadBalancerResourcesProps) {
        super(scope, id);

        // create new Application Load Balancer
        this.loadBalancer = new elb.ApplicationLoadBalancer(this, 'LoadBalancer', {
            vpc: props.vpc,
            vpcSubnets: { subnets: props.subnets },
            securityGroup: props.securityGroup,
            http2Enabled: true,
            internetFacing: false,
        });

        // removal policy -- change in config
        this.loadBalancer.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.DESTROY);

        // access logs for load balancer
        this.loadBalancer.logAccessLogs(props.logsBucket, 'load-balancer');

        // add ALB as target for Route 53 Hosted Zone
        const lbRecord = new ARecord(this, 'LoadBalancerAliasRecord', {
            zone: props.hostedZone,
            recordName: `${props.subdomain}.${props.rootDomain}`,
            ttl: Duration.seconds(60),
            target: RecordTarget.fromAlias(new LoadBalancerTarget(this.loadBalancer)),
        });
        lbRecord.applyRemovalPolicy(props.removalPolicy);

        /**
         * Target Groups
         */
        const targetGroup = new elb.ApplicationTargetGroup(this, 'TargetGroup', {
            protocol: elb.ApplicationProtocol.HTTP,
            protocolVersion: elb.ApplicationProtocolVersion.HTTP1,
            targetType: elb.TargetType.INSTANCE,
            vpc: props.vpc,
            targets: [props.autoscalingGroup],
            healthCheck: {
                port: '80',
                path: '/healthcheck',
            },
        });

        /**
         * Listeners
         */
        const httpListener = this.loadBalancer.addRedirect({
            sourceProtocol: elb.ApplicationProtocol.HTTP,
            sourcePort: 80,
            targetProtocol: elb.ApplicationProtocol.HTTPS,
            targetPort: 443,
            open: false,
        });

        this.loadBalancer.addListener('TlsListener', {
            protocol: elb.ApplicationProtocol.HTTPS,
            port: 443,
            sslPolicy: elb.SslPolicy.TLS12,
            certificates: [props.certificate],
            defaultTargetGroups: [targetGroup],
            open: false
        });

        // allowed connections
        props.connections.forEach(connectable => {
            httpListener.connections.allowFrom(connectable, Port.tcp(80));
            httpListener.connections.allowFrom(connectable, Port.tcp(443));
        });
    }
}
