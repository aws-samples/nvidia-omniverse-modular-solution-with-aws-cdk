import { javascript } from "projen";
import { monorepo } from "@aws/pdk";
import { AwsCdkTypeScriptApp } from "projen/lib/awscdk";
import { TypeScriptProject } from "projen/lib/typescript";

const project = new monorepo.MonorepoTsProject({
  devDeps: ["@aws/pdk"],
  name: "nvidia-omniverse-on-aws",
  packageManager: javascript.NodePackageManager.PNPM,
  projenrcTs: true,
});

const params = {
  author: "Kellan Cartledge",
  authorAddress: "kccartle@amazon.com",
  repositoryUrl: "https://gitlab.aws.dev/stac-nvidia-omniverse-council/nvidia-omniverse-on-aws",
  parent: project,
  defaultReleaseBranch: "main",
  cdkVersion: "2.102.0",
  entrypoint: "dist/index.js",
  entrypointTypes: "dist/index.d.ts",
  eslint: true,
  eslintOptions: {
    dirs: ["src"],
    ignorePatterns: ["*.tsx", "*.ts", "*.mjs"],
    prettier: true,
  },
  jest: false,
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
    exclude: ["cdk.out", "dist", "node_modules", "tst", "scripts"]
  },
  packageManager: javascript.NodePackageManager.PNPM
};

// VPC Infrastructure
const vpc = new TypeScriptProject({
  name: "omniverse-vpc",
  outdir: "packages/omniverse-vpc",
  deps: [
    "aws-cdk-lib",
    "constructs",
    "cdk-nag",
  ],
  ...params
});

// Omniverse Workstation
const workstation = new TypeScriptProject({
  name: "omniverse-workstation",
  outdir: "packages/omniverse-workstation",
  deps: [
    vpc.package.packageName,
    "aws-cdk-lib",
    "constructs",
    "cdk-nag",
  ],
  ...params
});

// Omniverse Nucleus
const nucleus = new TypeScriptProject({
  name: "omniverse-nucleus",
  outdir: "packages/omniverse-nucleus",
  deps: [
    vpc.package.packageName,
    '@aws-cdk/aws-lambda-python-alpha',
    "aws-cdk-lib",
    "constructs",
    "cdk-nag",
  ],
  gitignore: ["*/stacks/*"],
  ...params
});

// Omniverse Nucleus Cache
const cache = new TypeScriptProject({
  name: "omniverse-nucleus-cache",
  outdir: "packages/omniverse-nucleus-cache",
  deps: [
    vpc.package.packageName,
    "aws-cdk-lib",
    "constructs",
    "cdk-nag",
  ],
  ...params
});

// Omniverse Farm
const farm = new TypeScriptProject({
  name: "omniverse-farm",
  outdir: "packages/omniverse-farm",
  deps: [
    vpc.package.packageName,
    "aws-cdk-lib",
    "constructs",
    "cdk-nag",
  ],
  ...params
});

// CDK Application
new AwsCdkTypeScriptApp({
  name: "application",
  outdir: "application",
  deps: [
    vpc.package.packageName,
    workstation.package.packageName,
    nucleus.package.packageName,
    cache.package.packageName,
    farm.package.packageName,
    "aws-cdk-lib",
    "constructs",
    "cdk-nag",
  ],
  ...params
});

project.synth();
