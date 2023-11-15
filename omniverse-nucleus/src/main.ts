import { App, RemovalPolicy } from 'aws-cdk-lib';
import { NucleusStack, WorkstationStack, SubnetCollection, SecurityGroupCollection, NucleusVpcStack } from 'omniverse-shared';
import config from './config/app.config.json';
import { Vpc } from 'aws-cdk-lib/aws-ec2';

console.info('👉 Building Omniverse Nucleus Application');
console.info(`👉 Using Environment: ${JSON.stringify(config.env, null, 2)}`);

const app = new App();

const vpcStackName = `${config.name}-${config.stacks.vpc.name}`;
const { vpc, subnets, securityGroups } = new NucleusVpcStack(app, vpcStackName, {
  stackName: vpcStackName,
  env: config.env,
  availabilityZones: config.availabilityZones,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  ...config.stacks.vpc
});

const nucleusStackName = `${config.name}-${config.stacks.nucleus.name}`;
new NucleusStack(app, nucleusStackName, {
  stackName: nucleusStackName,
  env: config.env,
  vpc: vpc as Vpc,
  subnets: subnets as SubnetCollection,
  securityGroups: securityGroups as SecurityGroupCollection,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  autoDelete: config.autoDelete,
  ...config.stacks.nucleus
});

const workstationStackName = `${config.name}-${config.stacks.workstation.name}`;
new WorkstationStack(app, workstationStackName, {
  stackName: workstationStackName,
  env: config.env,
  vpc: vpc as Vpc,
  subnets: subnets as SubnetCollection,
  securityGroups: securityGroups as SecurityGroupCollection,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  availabilityZones: config.availabilityZones,
  ...config.stacks.workstation
});

app.synth();