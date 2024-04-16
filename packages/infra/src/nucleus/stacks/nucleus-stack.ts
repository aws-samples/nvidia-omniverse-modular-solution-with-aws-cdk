import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { PythonLayerVersion } from "@aws-cdk/aws-lambda-python-alpha";
import { StorageResources } from "../constructs/storage";
import { NucleusServerResources } from "../constructs/nucleus-server";
import { ReverseProxyResources } from "../constructs/reverse-proxy";
import { LoadBalancerResources } from "../constructs/load-balancer";
import { Route53Resource } from "../constructs/route53";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import path from "path";
import { NagSuppressions } from "cdk-nag";
import { BaseStackProps, SecurityGroupCollection, SubnetCollection } from "../../types";

export interface NucleusStackProps extends BaseStackProps {
  rootDomain: string;
  nucleusSubdomain: string;
  nucleusBuild: string;
  vpc: ec2.Vpc;
  subnets: SubnetCollection;
  securityGroups: SecurityGroupCollection;
  internetFacing: boolean;
  publicCertificateArn?: string;
  removalPolicy: RemovalPolicy;
  autoDelete: boolean;
}


export class NucleusStack extends Stack {
  constructor(scope: Construct, id: string, props: NucleusStackProps) {
    super(scope, id, props);

    if (!props.stackName) {
      throw new Error(
        "Unable to resolve 'stackName'. Please provide a stack name in the config.json file.",
      );
    }
    console.info(`>>> Building Omniverse Nucleus Stack. Stack Name: ${props.stackName}`);

    const { artifactsBucket, logsBucket } = new StorageResources(
      this,
      "StorageResources",
      {
        stackName: props.stackName,
        ...props,
      },
    );

    /**
     * Route 53
     */
    const { hostedZone, certificate } = new Route53Resource(
      this,
      "Route53Resources",
      {
        ...props,
      },
    );

    /**
     * Lambda Layer - AWS Utils
     */
    const utilsLambdaLayer = new PythonLayerVersion(this, "UtilsLayer", {
      entry: path.join(__dirname, "..", "lambda", "common"),
      compatibleRuntimes: [Runtime.PYTHON_3_10],
      layerVersionName: "common_utils_layer",
    });

    /**
     * Nucleus Server
     */
    const nucleusServerResources = new NucleusServerResources(
      this,
      "NucleusServerResources",
      {
        artifactsBucket: artifactsBucket,
        lambdaLayers: [utilsLambdaLayer],
        ...props,
        stackName: props.stackName,
        subnets: props.subnets.nucleus as ec2.ISubnet[],
        securityGroup: props.securityGroups.nucleus as ec2.SecurityGroup,
      },
    );

    /**
     * Reverse Proxy
     */
    const reverseProxyResources = new ReverseProxyResources(
      this,
      "ReverseProxyResources",
      {
        nucleusServer: nucleusServerResources.nucleusServer,
        artifactsBucket: artifactsBucket,
        lambdaLayers: [utilsLambdaLayer],
        ...props,
        stackName: props.stackName,
        subnets: props.subnets.reverseProxy as ec2.ISubnet[],
        securityGroup: props.securityGroups.reverseProxy as ec2.SecurityGroup,
        nucleusServerPrefix: props.nucleusSubdomain,
        rootDomain: props.rootDomain,
      },
    );

    reverseProxyResources.node.addDependency(nucleusServerResources);

    /**
     * Load Balancer
     */
    new LoadBalancerResources(this, "LoadBalancerResources", {
      logsBucket: logsBucket,
      hostedZone: hostedZone,
      certificate: certificate as Certificate,
      autoscalingGroup: reverseProxyResources.autoScalingGroup,
      ...props,
      stackName: props.stackName,
      subnets: props.subnets.loadBalancer as ec2.ISubnet[],
      securityGroup: props.securityGroups.loadBalancer as ec2.SecurityGroup,
      subdomain: props.nucleusSubdomain,
      connections: (!props.internetFacing && props.securityGroups.workstation) ? [props.securityGroups.workstation as ec2.SecurityGroup] : [],
    });

    /**
     * Outputs
     */
    new CfnOutput(this, "FullDomainUrl", {
      value: `https://${props.nucleusSubdomain}.${props.rootDomain}`,
    });

    /**
     * Nag Suppressions
     */
    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Default policies automatically created by CDK itself, restricted to intentional buckets",
        },
      ],
      true,
    );
  }
}
