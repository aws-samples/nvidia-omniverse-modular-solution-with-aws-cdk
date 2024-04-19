#! /usr/bin/env node
import meow from "meow";
import chalk from "chalk";
import checkbox from "@inquirer/checkbox";
import input from "@inquirer/input";
import select from "@inquirer/select";

import { execSync } from "node:child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

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
  getProjectDirectory as getModuleDirectory,
  getWorkstationsAMIReadme,
  writeConfigFile,
} from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let appConfig = {
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

// invert configurationTemplate names and keys to simplify configuration process
const templateInverseLookup = {};
Object.entries(configurationTemplates).forEach(([k, v]) => {
  templateInverseLookup[v.name] = k;
});

/**
 * Create CLI tool
 */
const cli = meow(
  `This tool helps you deploy your chosen NVIDIA Omniverse modules into your AWS Account.

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

/**
 * Prompt user to verify staged modules
 * @param {string[]} modulesToDeploy
 * @returns
 */
const verifyDeployment = async (modulesToDeploy) => {
  return await select({
    message: chalk.bold(
      chalk.cyan(
        `
      *************************************************************
        Starting the deployment
      *************************************************************
  
        If your environment was not bootstrapped, we will do that for you now.
        We will be deploying the following modules:
        ${modulesToDeploy.join(", ")}
  
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

/**
 * Runs the CDK deployment process
 * @param {boolean} cdkConfigured
 * @param {string[]} modulesToDeploy
 */
const runDeployment = async (cdkConfigured, modulesToDeploy) => {
  if (!cdkConfigured) {
    execSync("cdk bootstrap", {
      stdio: "inherit",
    });
  }

  execSync("npm i", {
    cwd: getModuleDirectory(),
    stdio: "inherit",
  });

  execSync("npm run build", {
    cwd: getModuleDirectory(),
    stdio: "inherit",
  });

  const stacks = modulesToDeploy.join(" ");
  execSync(`cdk deploy -c stacks="${stacks}" --all --verbose`, {
    cwd: getModuleDirectory(),
    stdio: "inherit",
  });
};

/**
 * Iterates the module requirements prompting user with data input fields
 */
const runModuleConfiguration = async (modulesToDeploy) => {
  for (const module of modulesToDeploy) {
    const key = templateInverseLookup[module];
    const template = configurationTemplates[key];
    appConfig.stacks[key] = await template.config();
  }
};

/**
 * Update existing config file
 * @param {string[]} modulesToDeploy
 * @returns
 */
const onUpdate = async (modulesToDeploy) => {
  // load previous config
  appConfig = JSON.parse(
    fs.readFileSync(
      new URL(
        path.resolve(__dirname, `../../infra/src/config/infra.config.json`),
        import.meta.url,
      ),
    ),
  );

  // get list of previously deployed
  const previousModules = Object.entries(appConfig.stacks)
    .filter(([_, v]) => v.deployed)
    .map((v) => {
      return v[0];
    });

  const proceed = await select({
    message: `It looks like you have previously deployed modules: ${chalk.yellow(modulesToDeploy.join(", "))}. Is that correct?`,
    choices: [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ],
  });

  if (!proceed) {
    process.exit(1);
  }

  // configure newly selected module
  const newModules = modulesToDeploy.filter((module) => {
    return !previousModules.includes(templateInverseLookup[module]);
  });

  await runModuleConfiguration(newModules);

  // add previously deployed to list of modules to deploy
  for (const previous in previousModules) {
    if (
      configurationTemplates[previous] &&
      !modulesToDeploy.includes(configurationTemplates[previous].name)
    ) {
      modulesToDeploy.push(configurationTemplates[previous].name);
    }
  }

  // prompt user with deployment verification
  if (!(await verifyDeployment(modulesToDeploy))) {
    process.exit(1);
  }

  // do the deployment
  await runDeployment(true, modulesToDeploy);
};

/**
 * Deploy command logic
 * @returns
 */
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

  const modulesToDeploy = await checkbox({
    message: `Select ${chalk.yellow("one or more")} modules to deploy:`,
    required: true,
    choices: [
      {
        name: "NVIDIA Omniverse Workstation AMI",
        value: "workstation-ami",
      },
      {
        name: "NVIDIA Omniverse Workstation Fleet",
        value: "workstation-fleet",
      },
      {
        name: "NVIDIA Omniverse Enterprise Nucleus",
        value: "nucleus",
      },
    ],
  });

  if (configFileExists()) {
    const updateExisting = await select({
      message: `Update existing config file?`,
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

    if (updateExisting) {
      await onUpdate(modulesToDeploy);
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
    if (modulesToDeploy.includes(key)) continue;
    appConfig.stacks[key] = await value["default"]();
  }

  appConfig.stacks.vpc = getVpcDefault();

  // TODO: turn goldenAMI prompt into a function
  if (modulesToDeploy.includes("workstation-fleet")) {
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

  // run config requirements for each module
  await runModuleConfiguration(modulesToDeploy);

  // write new config file to infra.config.json
  writeConfigFile(appConfig);

  // prompt user with deployment verification
  if (!(await verifyDeployment(modulesToDeploy))) {
    process.exit(1);
  }

  // do the deployment
  await runDeployment(cdkConfigured, modulesToDeploy);
};

// run deployment steps, including module configuration
if ("deploy" in cli.flags) {
  await onDeploy();
}

// no errors occurred
process.exit(0);
