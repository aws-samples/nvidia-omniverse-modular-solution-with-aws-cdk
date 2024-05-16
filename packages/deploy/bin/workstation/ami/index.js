// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import select from "@inquirer/select";

import fs from "fs";

import { workstationTypesPrompt } from "../utils.js";

const template = JSON.parse(
  fs.readFileSync(new URL("./template.config.json", import.meta.url)),
);

const requirements = {
  workstationInstanceType: async () => await select(workstationTypesPrompt),
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
