import input from "@inquirer/input";
import select from "@inquirer/select";

import fs from "fs";
import { workstationQuantityPrompt, workstationTypesPrompt } from "../utils.js";

const template = JSON.parse(
  fs.readFileSync(new URL("./template.config.json", import.meta.url)),
);

const requirements = {
  workstationAmiId: async () =>
    await input({
      message: "Please provide the Workstation AMI ID",
      validate: (value) => value.startsWith("ami-"),
    }),
  workstationQuantity: async () => {
    const value = await input(workstationQuantityPrompt);

    return parseInt(value, 10);
  },
  workstationInstanceType: async () => await select(workstationTypesPrompt),
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
