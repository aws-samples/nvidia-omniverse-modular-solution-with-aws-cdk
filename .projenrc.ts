// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { monorepo } from "@aws/pdk";
import { javascript } from "projen";
import { AwsCdkTypeScriptApp } from "projen/lib/awscdk";
import { NodeProject } from "projen/lib/javascript";

const project = new monorepo.MonorepoTsProject({
  devDeps: ["@aws/pdk"],
  name: "nvidia-omniverse-on-aws",
  packageManager: javascript.NodePackageManager.NPM,
  projenrcTs: true,
  license: "MIT-0",
  copyrightOwner: "Amazon.com, Inc. or its affiliates. All Rights Reserved.",
  majorVersion: 1,
});

const params = {
  author: "AWS NVIDIA Omniverse Spatial Technical Advisory Council (STAC)",
  authorAddress: "kccartle@amazon.com",
  repositoryUrl:
    "https://gitlab.aws.dev/stac-nvidia-omniverse-council/nvidia-omniverse-on-aws",
  defaultReleaseBranch: "main",
  parent: project,
  cdkVersion: "2.187.0",
  entrypoint: "dist/index.js",
  entrypointTypes: "dist/index.d.ts",
  eslint: true,
  eslintOptions: {
    dirs: ["src"],
    ignorePatterns: ["*.tsx", "*.ts", "*.mjs"],
    prettier: true,
  },
  jest: false,
  licensed: false,
  tsconfig: {
    compilerOptions: {
      rootDir: "src",
      outDir: "dist",
      declarationDir: "dist",
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      moduleResolution: javascript.TypeScriptModuleResolution.NODE,
    },
    include: ["src"],
    exclude: ["cdk.out", "dist", "node_modules", "tst", "scripts"],
  },
  packageManager: javascript.NodePackageManager.NPM,
};

/**
 * Deployment Tool
 */
const deploy = new NodeProject({
  name: "omniverse-deploy",
  outdir: "packages/deploy",
  packageName: "omniverse-aws",
  description:
    "Command line tool for deploying NVIDIA Omniverse resources on AWS",
  bin: {
    "omniverse-aws": "bin/index.js",
  },
  deps: [
    "meow",
    "inquirer",
    "@inquirer/checkbox",
    "@inquirer/input",
    "@inquirer/select",
    "inquirer-file-tree-selection-prompt",
    "chalk",
    "file-dialog",
    "node-file-dialog",
    "@aws-sdk/client-s3",
    "@aws-sdk/client-ssm",
    "@aws-sdk/client-ec2",
  ],
  ...params,
});
deploy.addFields({ type: "module" });

/**
 * AWS Infrastructure for NVIDIA Omniverse
 */
new AwsCdkTypeScriptApp({
  name: "omniverse-infra",
  outdir: "packages/infra",
  deps: [
    "aws-cdk-lib",
    "constructs",
    "cdk-nag",
    "@aws-cdk/aws-lambda-python-alpha",
  ],
  gitignore: ["/config/*", "*.config.json", "*.tar.gz"],
  ...params,
});

project.synth();
