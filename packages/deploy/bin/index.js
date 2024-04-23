#! /usr/bin/env node
import meow from "meow";
import chalk from "chalk";
import checkbox from "@inquirer/checkbox";
import input from "@inquirer/input";
import select from "@inquirer/select";

import {
  S3Client,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { SSMClient, DeleteParametersCommand } from "@aws-sdk/client-ssm";
import {
  EC2Client,
  DescribeKeyPairsCommand,
  DeleteKeyPairCommand,
} from "@aws-sdk/client-ec2";

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
        isMultiple: false,
      },
      config: {
        type: "string",
      },
      delete: {
        type: "string",
        shortFlag: "x",
        isMultiple: false,
      },
    },
  },
);

/**
 * Prompt user to verify Golden AMI ID
 */
const verifyAmiId = async () => {
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
};

/**
 * Prompt user to verify staged modules
 * @param {string[]} modules
 * @returns
 */
const verifyDeployment = async (modules) => {
  return await select({
    message: chalk.bold(
      chalk.cyan(
        `
      *************************************************************
        Starting the deployment
      *************************************************************
  
        If your environment was not bootstrapped, we will do that for you now.
        We will be deploying the following modules:
        ${modules.join(", ")}
  
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
 * @param {string[]} modules
 */
const runDeployment = async (cdkConfigured, modules) => {
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

  const stacks = modules.join(" ");
  execSync(`cdk deploy -c stacks="${stacks}" --all --verbose`, {
    cwd: getModuleDirectory(),
    stdio: "inherit",
  });
};

/**
 * Iterates the module requirements prompting user with data input fields
 */
const runModuleConfiguration = async (modules) => {
  for (const module of modules) {
    const key = templateInverseLookup[module];
    const template = configurationTemplates[key];
    appConfig.stacks[key] = await template.config();
  }
};

/**
 * Update existing config file
 * @param {string[]} modules
 * @returns
 */
const onUpdate = async (modules) => {
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
    message: `It looks like you have previously deployed modules: ${chalk.yellow(previousModules.join(", "))}. Is that correct?`,
    choices: [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ],
  });

  if (!proceed) {
    process.exit(1);
  }

  // configure newly selected module
  const newModules = modules.filter((module) => {
    return !previousModules.includes(templateInverseLookup[module]);
  });

  // check if user has deployed AMI module before to Fleet
  if (modules.includes("workstation-fleet")) {
    await verifyAmiId();
  }

  await runModuleConfiguration(newModules);

  // add previously deployed to list of modules to deploy
  for (const previous in previousModules) {
    if (
      configurationTemplates[previous] &&
      !modules.includes(configurationTemplates[previous].name)
    ) {
      modules.push(configurationTemplates[previous].name);
    }
  }

  // prompt user with deployment verification
  if (!(await verifyDeployment(modules))) {
    process.exit(1);
  }

  // do the deployment
  await runDeployment(true, modules);
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

  const modules = await checkbox({
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
      await onUpdate(modules);
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
    if (modules.includes(key)) continue;
    appConfig.stacks[key] = await value["default"]();
  }

  appConfig.stacks.vpc = getVpcDefault();

  // check if user has deployed AMI module before to Fleet
  if (modules.includes("workstation-fleet")) {
    await verifyAmiId();
  }

  // always required
  appConfig.stacks.vpc = await configureVpc();

  // run config requirements for each module
  await runModuleConfiguration(modules);

  // write new config file to infra.config.json
  writeConfigFile(appConfig);

  // prompt user with deployment verification
  if (!(await verifyDeployment(modules))) {
    process.exit(1);
  }

  // do the deployment
  await runDeployment(cdkConfigured, modules);
};

/**
 * Delete command logic
 * @returns
 */
const onDelete = async () => {
  console.log(
    chalk.bold(
      chalk.cyan(
        `
      *************************************************************
        Welcome to the 'NVIDIA Omniverse on AWS' Deployment tool! 
      *************************************************************
        
        We'll guide you through the necessary steps to delete Omniverse modules on your AWS account.
        `,
      ),
    ),
  );

  // parse existing infra.config.json
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
      return v[0].includes("vpc") ? "vpc" : configurationTemplates[v[0]].name;
    });

  // prompt user with deletion verification
  const proceed = await select({
    message: `It looks like you have previously deployed modules: ${chalk.yellow(previousModules.join(", "))}. Continue with deleting stacks?`,
    choices: [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ],
  });

  if (!proceed) {
    process.exit(1);
  }

  // destroy stacks and associated resources
  execSync(
    `cdk destroy -c stacks="${previousModules.join(" ")}" --all --verbose`,
    {
      cwd: getModuleDirectory(),
      stdio: "inherit",
    },
  );

  // delete retained resources
  const logsBucketName = "omniverse-aws-nucleus-logs-bucket";
  console.log(
    chalk.bold(
      "Emptying and deleting logs bucket: ",
      chalk.yellow(logsBucketName),
    ),
  );

  try {
    const s3Client = new S3Client();

    // get logs files in bucket
    const listObjectsResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: logsBucketName,
      }),
    );

    // delete logs and empty bucket
    const deleteObjectsResponse = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: logsBucketName,
        Delete: {
          Objects: listObjectsResponse.Contents.map((v) => ({ Key: v.Key })),
        },
      }),
    );

    console.log(
      chalk.green(
        `Deleted Objects: ${JSON.stringify(deleteObjectsResponse.Deleted, null, 2)}\n`,
      ),
    );

    // delete bucket
    const deleteBucketResponse = await s3Client.send(
      new DeleteBucketCommand({
        Bucket: logsBucketName,
      }),
    );

    console.log(
      chalk.green(
        `Bucket Deleted: ${JSON.stringify(deleteBucketResponse, null, 2)}\n`,
      ),
    );
  } catch (error) {
    console.log(
      chalk.bold(chalk.red(`Error: ${JSON.stringify(error, null, 2)}\n`)),
    );
  }

  try {
    // describe key pairs
    const keyNames = ["omni-jumpbox-keypair", "omni-workstation-keypair"];
    const ec2Client = new EC2Client();
    const keyPairsResponse = await ec2Client.send(
      new DescribeKeyPairsCommand({
        KeyNames: keyNames,
      }),
    );

    const keyPairIds = keyPairsResponse.KeyPairs.map((kp) => {
      return `ec2/keypair/${kp.KeyPairId}`;
    });

    console.log(
      chalk.bold(
        `Deleting Key Pairs: ${JSON.stringify(keyPairIds.join(", "), null, 2)}\n`,
      ),
    );

    // delete key pairs
    for (const key of keyNames) {
      const deleteKeyResponse = await ec2Client.send(
        new DeleteKeyPairCommand({
          KeyName: key,
        }),
      );

      console.log(chalk.green(`Key Pair Deleted: ${key}\n`));
    }

    // delete ssm parameters
    const ssmClient = new SSMClient();

    const params = [...keyNames, ...keyPairIds];
    console.log(chalk.bold(`Deleting SSM Parameters: ${params.join(", ")}\n`));

    const deleteParamResponse = await ssmClient.send(
      new DeleteParametersCommand({ Names: params }),
    );

    console.log(
      chalk.green(
        `Parameters Deleted: ${JSON.stringify(deleteParamResponse.DeletedParameters, null, 2)}\n`,
      ),
    );
  } catch (error) {
    console.log(
      chalk.bold(chalk.red(`Error: ${JSON.stringify(error, null, 2)}\n`)),
    );
  }
};

// run tool commands
if ("deploy" in cli.flags) {
  await onDeploy();
} else if ("delete" in cli.flags) {
  await onDelete();
}

// no errors occurred
process.exit(0);
