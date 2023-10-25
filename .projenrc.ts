import { javascript } from "projen";
import { monorepo } from "@aws/pdk";
const project = new monorepo.MonorepoTsProject({
  devDeps: ["@aws/pdk"],
  name: "nvidia-omniverse-on-aws",
  packageManager: javascript.NodePackageManager.PNPM,
  projenrcTs: true,
});
project.synth();