const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all workspace packages so metro picks up live changes.
config.watchFolders = [monorepoRoot];

// Resolve workspace packages from their TypeScript source directly —
// avoids needing a pre-compiled dist/ in each package.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Map each @finwiz/* package to its TypeScript entry so metro doesn't
// require a compiled dist/ directory.
const workspacePackages = {
  '@finwiz/allowance-engine': path.resolve(monorepoRoot, 'packages/allowance-engine/src/index.ts'),
  '@finwiz/notification-parser': path.resolve(monorepoRoot, 'packages/notification-parser/src/index.ts'),
  '@finwiz/obsidian-client': path.resolve(monorepoRoot, 'packages/obsidian-client/src/index.ts'),
  '@finwiz/self-transfer-detector': path.resolve(monorepoRoot, 'packages/self-transfer-detector/src/index.ts'),
  '@finwiz/ai-agent': path.resolve(monorepoRoot, 'packages/ai-agent/src/index.ts'),
  '@finwiz/notification-listener-android': path.resolve(monorepoRoot, 'packages/notification-listener-android/src/index.ts'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (workspacePackages[moduleName]) {
    return { filePath: workspacePackages[moduleName], type: 'sourceFile' };
  }
  // Metro's HMR server constructs entry-point paths as relative ./node_modules/...
  // In a Yarn Workspaces monorepo, packages are hoisted to the workspace root, so
  // strip the prefix and let nodeModulesPaths resolve from the correct location.
  if (moduleName.startsWith('./node_modules/')) {
    return context.resolveRequest(context, moduleName.slice('./node_modules/'.length), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
