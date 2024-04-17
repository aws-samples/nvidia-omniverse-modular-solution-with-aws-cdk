#! /usr/bin/env node
import meow from "meow";
import chalk from "chalk";
import checkbox from "@inquirer/checkbox";
import input from "@inquirer/input";
import select from "@inquirer/select";

import { execSync } from "node:child_process";

import {
  configure as configureNucleus,
  getDefault as getNucleusDefault,
} from "./nucleus/index.js";
import {
  configure as configureWorkstationFleet,
  getDefault as getWorkstationFleetDefault,
} from "./workstation/fleet/index.js";
import {
  configure as configureWorkstationAmi,
  getDefault as getWorkstationAmiDefault,
} from "./workstation/ami/index.js";
import {
  configure as configureVpc,
  getDefault as getVpcDefault,
} from "./vpc/index.js";

import {
  configFileExists,
  getProjectDirectory,
  getWorkstationsAMIReadme,
  writeConfigFile,
} from "./utils.js";
import { exec } from "child_process";

const appConfig = {
  name: "Omni",
  env: {
    account: "",
    region: "us-west-2",
  },
  removalPolicy: "destroy",
  autoDelete: true,
  cdkNag: false,
  stacks: {
    vpc: {},
    ami: {},
    fleet: {},
    nucleus: {},
  },
};

const configurationTemplates = {
  ami: {
    name: "workstation-ami",
    config: configureWorkstationAmi,
    default: getWorkstationAmiDefault,
  },
  fleet: {
    name: "workstation-fleet",
    config: configureWorkstationFleet,
    default: getWorkstationFleetDefault,
  },
  nucleus: {
    name: "nucleus",
    config: configureNucleus,
    default: getNucleusDefault,
  },
};

const cli = meow(
  `This tool helps you deploy your chosen NVIDIA Omniverse projects into your AWS Account.

Usage
    $ npx omniverse-aws deploy # choose which resources you wish to deploy into your AWS Account 
`,
  {
    importMeta: import.meta,
    flags: {
      deploy: {
        type: "string",
        shortFlag: "d",
        isMultiple: true,
      },
      config: {
        type: "string",
      },
    },
  },
);

const verifyDeployment = async (projectsToDeploy) => {
  return await select({
    message: chalk.bold(
      chalk.cyan(
        `
      *************************************************************
        Starting the deployment
      *************************************************************
  
        If your environment was not bootstrapped, we will do that for you now.
        We will be deploying the following projects:
        ${projectsToDeploy.join(", ")}
  
        Proceed?
        `,
      ),
    ),
    choices: [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ],
  });
};

const runDeployment = async (cdkConfigured, projectsToDeploy) => {
  if (!cdkConfigured) {
    execSync("cdk bootstrap", {
      stdio: "inherit",
    });
  }

  execSync("npm i", {
    cwd: getProjectDirectory(),
    stdio: "inherit",
  });

  execSync("npm run build", {
    cwd: getProjectDirectory(),
    stdio: "inherit",
  });

  const stacks = projectsToDeploy.join(" ");
  execSync(`cdk deploy -c stacks="${stacks}" --all --verbose`, {
    cwd: getProjectDirectory(),
    stdio: "inherit",
  });
};

const onDeploy = async () => {
  console.log(
    chalk.bold(
      chalk.cyan(
        `
      *************************************************************
        Welcome to the 'NVIDIA Omniverse on AWS' Deployment tool! 
      *************************************************************
        
        We'll guide you through the necessary steps to deploy Omniverse solutions on your AWS account.
        `,
      ),
    ),
  );

  let projectsToConfig = {
    useExisting: [],
    createNew: [],
  };

  const projectsToDeploy = await checkbox({
    message: `Select ${chalk.yellow("one or more")} projects to deploy:`,
    required: true,
    choices: [
      {
        name: "NVIDIA Omniverse Nucleus Enterprise",
        value: "nucleus",
      },
      {
        name: "NVIDIA Omniverse Workstation AMI",
        value: "workstation-ami",
      },
      {
        name: "NVIDIA Omniverse Workstation Fleet",
        value: "workstation-fleet",
      },
    ],
  });

  if (configFileExists()) {
    const useExisting = await select({
      message: `Use existing config file?`,
      choices: [
        {
          name: "Yes",
          value: true,
        },
        {
          name: "No",
          value: false,
        },
      ],
    });

    if (useExisting) {
      if (!(await verifyDeployment(projectsToDeploy))) {
        process.exit(1);
      }

      await runDeployment(true, projectsToDeploy);
      return 0;
    }
  }

  appConfig.env.account = await input({
    message: "Provide your AWS Account ID",
    validate: (value) => Boolean(value.match(/\d{12}/gm)),
  });

  appConfig.env.region = await input({
    message:
      "Specify the name of the AWS region where you wish to deploy these stacks",
    default: "us-west-2",
  });

  const cdkConfigured = await select({
    message:
      "Do you have AWS CDK (Cloud Development Kit) bootstrapped on your account?",
    choices: [
      {
        name: "Yes",
        value: true,
      },
      {
        name: "No",
        value: false,
      },
    ],
  });

  // set config defaults for all stacks
  for (const [key, value] of Object.entries(configurationTemplates)) {
    appConfig.stacks[key] = await value["default"]();
  }

  appConfig.stacks.vpc = getVpcDefault();

  if (projectsToDeploy.includes("workstation-fleet")) {
    const goldenAMIDeployed = await select({
      message: `You have selected Omniverse Workstation Fleet for deployment. Have you already deployed the Workstation AMI?`,
      choices: [
        {
          name: "Yes",
          value: true,
        },
        {
          name: "No / Not sure",
          value: false,
        },
      ],
    });

    if (!goldenAMIDeployed) {
      console.log(
        chalk.red(`
      Before deploying the Omniverse Workstations, it is necessary to deploy the Omniverse Workstations AMI. 
      Please restart the Deployment Tool and select only the Omniverse Workstation AMI option.
      The process for deploying the Omniverse Workstation AMI can take several minutes. 
      For the additional steps post deployment, please refer to the Workstation AMI README: ${getWorkstationsAMIReadme()}
      `),
      );
      process.exit(1);
    }
  }

  // always required
  appConfig.stacks.vpc = await configureVpc();

  for (const key of projectsToDeploy) {
    const [k, template] = Object.entries(configurationTemplates).find(
      ([_, v]) => key.includes(v.name),
    );
    appConfig.stacks[k] = await template["config"]();
  }

  writeConfigFile(appConfig);

  if (!(await verifyDeployment(projectsToDeploy))) {
    process.exit(1);
  }

  await runDeployment(cdkConfigured, projectsToDeploy);
};

// run deployment steps, including project configuration
if ("deploy" in cli.flags) {
  await onDeploy();
}

// no errors occurred
process.exit(0);
