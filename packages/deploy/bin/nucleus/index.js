// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import input from "@inquirer/input";
import select from "@inquirer/select";

import inquirer from "inquirer";
import inquirerFileTreeSelection from "inquirer-file-tree-selection-prompt";

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

inquirer.registerPrompt("file-tree-selection", inquirerFileTreeSelection);

const stackDir = "../../../infra/src/nucleus/tools/nucleusServer/stack";
let isInternetFacing = false;

const template = JSON.parse(
  fs.readFileSync(new URL("./template.config.json", import.meta.url)),
);

const requirements = {
  rootDomain: async () =>
    await input({
      message: "Enter the DNS domain for Nucleus (ex.: mydomain.com)",
      validate: (value) =>
        Boolean(
          value.match(
            /\b((?=[a-z0-9-]{1,63}\.)(xn--)?[a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,63}\b/gm,
          ),
        ),
    }),
  //   subdomain: async () => await input({ message: 'Enter the name of your Nucleus instance (ex.: nucleus)' }),
  nucleusBuild: async () => {
    const downloadsFolder = process.env.USERPROFILE
      ? `${process.env.USERPROFILE}\\Downloads`
      : `${process.env.HOME}/Downloads`;

    const answer = await inquirer.prompt([
      {
        type: "file-tree-selection",
        name: "file",
        message: "Select the Nucleus build you wish to deploy",
        root: downloadsFolder,
        enableGoUpperDirectory: true,
      },
    ]);

    const filePath = answer["file"];
    const buildPath = filePath.split("/");
    const buildFile = buildPath[buildPath.length - 1];
    const build = buildFile.replace(".tar.gz", "");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const stackFolder = path.resolve(__dirname, `${stackDir}`);

    if (!fs.existsSync(stackFolder)) {
      fs.mkdirSync(stackFolder);
    }

    fs.copyFileSync(
      filePath,
      path.resolve(__dirname, `${stackDir}/${buildFile}`),
    );

    return build;
  },
  internetFacing: async () => {
    isInternetFacing = await select({
      message:
        "Will you be accessing Nucleus from Workstations in your AWS Account?",
      choices: [
        {
          name: "Yes",
          value: false,
        },
        {
          name: "No, I will be accessing from on-prem workstations",
          value: true,
        },
      ],
    });
    return isInternetFacing;
  },
  publicCertificateArn: async () => {
    return isInternetFacing
      ? await input({
          message: "Enter the ARN of the public certificate you wish to use",
        })
      : "";
  },
  deployed: () => true,
};

export const configure = async () => {
  for (const req of Object.keys(requirements)) {
    template[req] = await requirements[req]();
  }

  return template;
};

export const getDefault = async () => {
  return template;
};
