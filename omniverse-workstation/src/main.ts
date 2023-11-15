import { App, RemovalPolicy } from 'aws-cdk-lib';
import { GoldenStack, WorkstationVpcStack, SubnetCollection, SecurityGroupCollection } from 'omniverse-shared';
import config from './config/app.config.json';
import { Vpc } from 'aws-cdk-lib/aws-ec2';

console.info('👉 Building Omniverse Workstation Application');
console.info(`👉 Using Environment: ${JSON.stringify(config.env, null, 2)}`);

const app = new App();

const vpcStackName = `${config.name}-${config.stacks.vpc.name}`;
const { vpc, subnets, securityGroups } = new WorkstationVpcStack(app, vpcStackName, {
  stackName: vpcStackName,
  env: config.env,
  availabilityZones: 1,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  ...config.stacks.vpc
});

const goldenStackName = `${config.name}-${config.stacks.workstation.name}`;
new GoldenStack(app, goldenStackName, {
  stackName: goldenStackName,
  env: config.env,
  vpc: vpc as Vpc,
  subnets: subnets as SubnetCollection,
  securityGroups: securityGroups as SecurityGroupCollection,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  ...config.stacks.workstation
});

app.synth();