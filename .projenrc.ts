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
  defaultReleaseBranch: "main",
  parent: project,
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
  deps: [
    "aws-cdk-lib",
    "constructs",
    "cdk-nag",
  ],
  packageManager: javascript.NodePackageManager.PNPM
};

const shared = new TypeScriptProject({
  name: "omniverse-shared",
  outdir: "shared",
  gitignore: ["*/stacks/*"],
  ...params
});
shared.addDeps(
  '@aws-cdk/aws-lambda-python-alpha'
);

// Omniverse Workstation CDK App
const workstation = new AwsCdkTypeScriptApp({
  name: "omniverse-workstation",
  outdir: "omniverse-workstation",
  ...params
});
workstation.addDeps(shared.package.packageName);

// Omniverse Nucleus CDK App
const nucleus = new AwsCdkTypeScriptApp({
  name: "omniverse-nucleus",
  outdir: "omniverse-nucleus",
  ...params
});
nucleus.addDeps(shared.package.packageName);

// Omniverse Nucleus Cache CDK App
const cache = new AwsCdkTypeScriptApp({
  name: "omniverse-nucleus-cache",
  outdir: "omniverse-nucleus-cache",
  ...params
});
cache.addDeps(shared.package.packageName);

// Omniverse Nucleus Cache CDK App
const farm = new AwsCdkTypeScriptApp({
  name: "omniverse-farm",
  outdir: "omniverse-farm",
  ...params
});
farm.addDeps(shared.package.packageName);

project.synth();
