// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export const workstationQuantityPrompt = {
  message: "How many workstations do you wish to deploy?",
  default: 1,
};

export const workstationTypesPrompt = {
  message:
    "Select the instance type you wish to use for the graphics workstations. You can check instance type offerings in your chosen region using the AWS CLI.",
  choices: [
    {
      name: "g5.4xlarge (recommended)",
      value: "g5.4xlarge",
    },
    {
      name: "g4dn.4xlarge (recommended)",
      value: "g4dn.4xlarge",
    },
    {
      name: "g5.2xlarge (cost optimization)",
      value: "g5.2xlarge",
    },
    {
      name: "g4dn.2xlarge (cost optimization)",
      value: "g4dn.2xlarge",
    },
  ],
};
