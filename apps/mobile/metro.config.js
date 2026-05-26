// Metro config for the Munch monorepo (Expo + pnpm).
//
// Two monorepo-specific tweaks over Expo's defaults:
//  1. watch the workspace root so edits to @munch/core and @munch/api-client are
//     picked up, and resolve modules from both the app's and the hoisted root
//     node_modules.
//  2. enable package exports so the source-only @munch/* packages resolve through
//     their "exports" map (-> src/index.ts); they ship TypeScript, not a build.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
