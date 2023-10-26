import { App, RemovalPolicy } from 'aws-cdk-lib';
import { SecurityGroupCollection, SubnetCollection, VpcStack } from "omniverse-vpc";
import { NucleusStack } from "omniverse-nucleus";
import { WorkstationStack } from "omniverse-workstation";
import { ApplicationType } from './types';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import config from './config/app.config.json';


const app = new App();
const applicationType: ApplicationType = app.node.tryGetContext('type') || "workstation";

console.info(`👉 Creating Application Type: ${applicationType}`);
console.info(`👉 Using Environment: ${JSON.stringify(config.env, null, 2)}`);

createStacks(applicationType);
app.synth();


function createStacks(projectType: ApplicationType) {
  const vpcStack = createVpcStack();
  switch (projectType) {
    case ApplicationType.WORKSTATION:
      createWorkstationStack(vpcStack.vpc, vpcStack.subnets, vpcStack.securityGroups);
      break;
    case ApplicationType.NUCLEUS:
      createNucleusStack(vpcStack.vpc, vpcStack.subnets, vpcStack.securityGroups);
      createWorkstationStack(vpcStack.vpc, vpcStack.subnets, vpcStack.securityGroups);
      break;
    case ApplicationType.CACHE:
    case ApplicationType.FARM:
      break;
  }
};

function createVpcStack(): VpcStack {
  const vpcStackName = `${config.name}-${config.stacks.vpc.name}`;
  return new VpcStack(app, vpcStackName, {
    stackName: vpcStackName,
    env: config.env,
    availabilityZones: config.availabilityZones,
    removalPolicy: config.removalPolicy as RemovalPolicy,
    ...config.stacks.vpc
  });
};

function createWorkstationStack(vpc: Vpc, subnets: SubnetCollection, securityGroups: SecurityGroupCollection): WorkstationStack {
  const workstationStackName = `${config.name}-${config.stacks.workstation.name}`;
  return new WorkstationStack(app, workstationStackName, {
    stackName: workstationStackName,
    env: config.env,
    vpc: vpc,
    subnets: subnets,
    securityGroups: securityGroups,
    removalPolicy: config.removalPolicy as RemovalPolicy,
    ...config.stacks.workstation
  });
};

function createNucleusStack(vpc: Vpc, subnets: SubnetCollection, securityGroups: SecurityGroupCollection): NucleusStack {
  const nucleusStackName = `${config.name}-${config.stacks.nucleus.name}`;
  return new NucleusStack(app, nucleusStackName, {
    stackName: nucleusStackName,
    env: config.env,
    vpc: vpc,
    subnets: subnets,
    securityGroups: securityGroups,
    removalPolicy: config.removalPolicy as RemovalPolicy,
    autoDelete: config.autoDelete,
    ...config.stacks.nucleus
  });
};