import input from "@inquirer/input";
// import select from "@inquirer/select";

import fs from "fs";

const template = JSON.parse(
  fs.readFileSync(new URL("./template.config.json", import.meta.url)),
);

const requirements = {
  // accessNucleusFromWorkstations: async () => {
  //   const accessFromWorkstations = await select({
  //     message:
  //       "Will you be accessing Nucleus from Workstations in your AWS Account?",
  //     choices: [
  //       {
  //         name: "Yes",
  //         value: true,
  //       },
  //       {
  //         name: "No, I will be accessing from on-prem workstations",
  //         value: false,
  //       },
  //     ],
  //   });
  // },
  allowedRanges: async () => {
    const ranges = await input({
      message:
        "Please enter the CIDR range of IPs allowed to access your resources. Multiple ranges should be separated by commas (ex.: 10.0.0.0/16, 10.2.0.0/24)",
    });

    return ranges.split(",").map((range) => range.trim());
  },
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
