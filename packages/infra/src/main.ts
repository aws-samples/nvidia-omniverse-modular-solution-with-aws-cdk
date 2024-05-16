// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { App, Aspects, RemovalPolicy, Tags } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { VpcStack } from "./vpc/stacks/vpc-stack";
import { NucleusStack } from "./nucleus/stacks/nucleus-stack";
import config from "./config/infra.config.json";
import { WorkstationFleetStack } from "./workstation-fleet/stacks/workstation-fleet-stack";
import { WorkstationAmiStack } from "./workstation-ami/stacks/workstation-ami-stack";

console.info("NVIDIA Omniverse on AWS");
console.info(`>>> Using Environment: ${JSON.stringify(config.env, null, 2)}`);

/**
 * Types
 */
export type StackLookup = {
  workstationAmi: 'workstation-ami',
  workstationFleet: 'workstation-fleet',
  nucleus: 'nucleus',
};

export class StackConfigurator {
  constructor(context: string | undefined) {
    if (!context) return;

    const stacks: Array<string> = context.split(' ');
    stacks.forEach(stack => {
      switch (stack) {
        case 'workstation-ami':
          this.workstationAmi = true;
          break;
        case 'workstation-fleet':
          this.workstationFleet = true;
          break;
        case 'nucleus':
          this.nucleus = true;
          break;
      }
    });
  }
  private workstationAmi: boolean = false;
  public get WorkstationAmi(): boolean {
    return this.workstationAmi;
  }

  private workstationFleet: boolean = false;
  public get WorkstationFleet(): boolean {
    return this.workstationFleet;
  }

  private nucleus: boolean = false;
  public get Nucleus(): boolean {
    return this.nucleus;
  }
}

const app = new App();
console.info(`> App Path: ${app.node.path}`);

const stackConfigurator = new StackConfigurator(app.node.tryGetContext("stacks"));
console.info(`>>> Deploying Stacks: ${JSON.stringify(stackConfigurator, null, 2)}`);

/**
 * VPC Stack
 */
const { vpc, securityGroups, subnets } = new VpcStack(app, `${config.name}${config.stacks.vpc.name}`, {
  stackName: `${config.name}${config.stacks.vpc.name}`,
  env: config.env,
  configurator: stackConfigurator,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  autoDelete: config.autoDelete,
  internetFacing: config.stacks.nucleus.internetFacing,
  ...config.stacks.vpc,
});

/**
 * Workstation AMI Stack
 * * Construct - Jumpbox
 * * Construct - Workstation
 */
if (stackConfigurator.WorkstationAmi) {
  new WorkstationAmiStack(app, `${config.name}${config.stacks.ami.name}`, {
    stackName: `${config.name}${config.stacks.ami.name}`,
    env: config.env,
    configurator: stackConfigurator,
    vpc: vpc,
    subnets: subnets,
    securityGroups: securityGroups,
    removalPolicy: config.removalPolicy as RemovalPolicy,
    autoDelete: config.autoDelete,
    ...config.stacks.ami,
  });
}

/**
  * Workstation Stack
  * * Construct - Jumpbox
  * * Construct - Workstation
  */
if (stackConfigurator.WorkstationFleet) {
  if (!config.stacks.fleet.workstationAmiId) {
    throw new Error("Workstation AMI ID and Name must be defined in config.json to deploy the Workstation Fleet Stack." +
      "If you have not deployed the Workstation Golden AMI Stack, please first deploy that stack and follow instructions on creating a workstation AMI.");
  }

  new WorkstationFleetStack(app, `${config.name}${config.stacks.fleet.name}`, {
    stackName: `${config.name}${config.stacks.fleet.name}`,
    env: config.env,
    configurator: stackConfigurator,
    vpc: vpc,
    subnets: subnets,
    securityGroups: securityGroups,
    removalPolicy: config.removalPolicy as RemovalPolicy,
    autoDelete: config.autoDelete,
    ...config.stacks.fleet,
  });
}

/**
 * Nucleus Stack
 * * Nested Stack - Workstation
 * * * Construct - Load Balancer
 * * * Construct - Reverse Proxy
 * * * Construct - Nucleus
 */
if (stackConfigurator.Nucleus) {
  new NucleusStack(app, `${config.name}${config.stacks.nucleus.name}`, {
    stackName: `${config.name}${config.stacks.nucleus.name}`,
    env: config.env,
    configurator: stackConfigurator,
    vpc: vpc,
    subnets: subnets,
    securityGroups: securityGroups,
    removalPolicy: config.removalPolicy as RemovalPolicy,
    autoDelete: config.autoDelete,
    ...config.stacks.nucleus
  });
}

Tags.of(app).add("Project", config.name);

if (config.cdkNag) {
  Aspects.of(app).add(new AwsSolutionsChecks());
}

app.synth();