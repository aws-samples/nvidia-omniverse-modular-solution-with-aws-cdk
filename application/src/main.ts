import { App, Environment, RemovalPolicy } from 'aws-cdk-lib';
import { VpcStack } from "omniverse-vpc";
import config from './config/app.config.json';


const getEnvironment = (envType: string): Environment => {
  return envType == 'prod' ? config.env.prod : config.env.dev;
};


const app = new App();

const environment = getEnvironment(app.node.tryGetContext("ENV"));
if (environment) {
  console.info(`👉 Using Environment: ${JSON.stringify(environment)}`);
} else {
  throw new Error("Unable to determine deployment environment. Specify '--context ENV=<ENV>' as either 'dev' or 'prod'.");
}

const vpcStackName = `${config.name}-${config.stacks.vpc.name}`;
new VpcStack(app, vpcStackName, {
  stackName: vpcStackName,
  env: environment,
  availabilityZones: config.availabilityZones,
  removalPolicy: config.removalPolicy as RemovalPolicy,
  ...config.stacks.vpc
});

app.synth();