// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const configFileExists = () => {
  const configFile = path.resolve(
    __dirname,
    `../../infra/src/config/infra.config.json`,
  );

  return fs.existsSync(configFile);
};

export const writeConfigFile = (appConfig) => {
  const configFolder = path.resolve(__dirname, `../../infra/src/config`);

  if (!fs.existsSync(configFolder)) {
    fs.mkdirSync(configFolder);
  }

  fs.writeFileSync(
    `${configFolder}/infra.config.json`,
    JSON.stringify(appConfig, null, 2),
    {
      encoding: "utf-8",
    },
  );
};

export const getProjectDirectory = () => path.resolve(__dirname, `../../infra`);

export const getWorkstationsAMIReadme = () =>
  path.resolve(__dirname, "../../omniverse-workstation-ami/README.md");
