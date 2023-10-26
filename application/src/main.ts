import { App, RemovalPolicy } from 'aws-cdk-lib';
import { VpcStack } from "omniverse-vpc";
import { NucleusStack } from "omniverse-nucleus";
import { WorkstationStack } from "omniverse-workstation";
import config from './config/app.config.json';

const app = new App();
console.info(`👉 Using Environment: ${JSON.stringify(config.env)}`);

const vpcStackName = `${config.name}-${config.stacks.vpc.name}`;
const { vpc, subnets, securityGroups } = new VpcStack(app, vpcStackName, {
  stackName: vpcStackName,
  env: config.env,
  availabilityZones: config.availabilityZones,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  ...config.stacks.vpc
});

/**
 * Omniverse Nucleus
 */
const nucleusStackName = `${config.name}-${config.stacks.nucleus.name}`;
new NucleusStack(app, nucleusStackName, {
  stackName: nucleusStackName,
  env: config.env,
  vpc: vpc,
  subnets: subnets,
  securityGroups: securityGroups,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  autoDelete: config.autoDelete,
  ...config.stacks.nucleus
});

/**
 * Omniverse Workstations
 */
const workstationStackName = `${config.name}-${config.stacks.workstation.name}`;
new WorkstationStack(app, workstationStackName, {
  stackName: nucleusStackName,
  env: config.env,
  vpc: vpc,
  subnets: subnets,
  securityGroups: securityGroups,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  ...config.stacks.workstation
});

app.synth();