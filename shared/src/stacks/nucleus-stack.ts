import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';
import { StorageResources } from '../constructs/nucleus/storage';
import { NucleusServerResources } from '../constructs/nucleus/nucleus-server';
import { ReverseProxyResources } from '../constructs/nucleus/reverse-proxy';
import { LoadBalancerResources } from '../constructs/nucleus/load-balancer';
import { Route53Resource } from '../constructs/nucleus/route53';
import { SecurityGroupCollection, SubnetCollection } from '../types';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import path from 'path';

export interface NucleusStackProps extends StackProps {
    rootDomain: string;
    nucleusSubdomain: string;
    nucleusBuild: string;
    vpc: ec2.Vpc;
    subnets: SubnetCollection;
    securityGroups: SecurityGroupCollection;
    removalPolicy: RemovalPolicy;
    autoDelete: boolean;
}

export class NucleusStack extends Stack {
    constructor(scope: Construct, id: string, props: NucleusStackProps) {
        super(scope, id, props);

        if (!props.stackName) {
            throw new Error("Unable to resolve 'stackName'. Please provide a stack name in the config.json file.");
        }
        console.log(`✨ Nucleus Stack Name: ${props.stackName}`);

        const { artifactsBucket, logsBucket } = new StorageResources(this, 'StorageResources', {
            stackName: props.stackName,
            ...props
        });

        /**
         * Route 53
         */
        const { hostedZone, certificate } = new Route53Resource(this, 'Route53Resources', {
            vpc: props.vpc,
            rootDomain: props.rootDomain,
            removalPolicy: props.removalPolicy
        });

        /**
         * Lambda Layer - AWS Utils 
         */
        const utilsLambdaLayer = new PythonLayerVersion(this, 'UtilsLayer', {
            entry: path.join('../packages/omniverse-nucleus/src/lambda/common'),
            compatibleRuntimes: [Runtime.PYTHON_3_9],
            layerVersionName: 'common_utils_layer',
        });

        /**
         * Nucleus Server
         */
        const nucleusServerResources = new NucleusServerResources(this, 'NucleusServerResources', {
            stackName: props.stackName,
            ...props,
            subnets: props.subnets.nucleus,
            securityGroup: props.securityGroups.nucleus,
            artifactsBucket: artifactsBucket,
            lambdaLayers: [utilsLambdaLayer],
        });

        /**
         * Reverse Proxy
         */
        const reverseProxyResources = new ReverseProxyResources(this, 'ReverseProxyResources', {
            stackName: props.stackName,
            rootDomain: props.rootDomain,
            nucleusServerPrefix: props.nucleusSubdomain,
            removalPolicy: props.removalPolicy,
            artifactsBucket: artifactsBucket,
            vpc: props.vpc,
            subnets: props.subnets.reverseProxy,
            securityGroup: props.securityGroups.reverseProxy,
            lambdaLayers: [utilsLambdaLayer],
            nucleusServerInstance: nucleusServerResources.nucleusServer,
        });

        reverseProxyResources.node.addDependency(nucleusServerResources);

        /**
         * Load Balancer 
         */
        new LoadBalancerResources(this, 'LoadBalancerResources', {
            vpc: props.vpc,
            subnets: props.subnets.loadBalancer,
            securityGroup: props.securityGroups.loadBalancer,
            subdomain: props.nucleusSubdomain,
            rootDomain: props.rootDomain,
            certificate: certificate,
            hostedZone: hostedZone,
            autoscalingGroup: reverseProxyResources.autoScalingGroup,
            connections: [props.securityGroups.workstation],
            logsBucket: logsBucket,
            removalPolicy: props.removalPolicy,
        });
    }
}