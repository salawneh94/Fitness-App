const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo support: this app depends on packages/shared via the pnpm workspace,
// which lives outside apps/mobile, so Metro needs to watch the whole workspace
// and be able to resolve pnpm's symlinked node_modules.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

// Packages that only exist to serve a browser code path, but that Metro still pulls into the
// native bundles because it resolves every require() statically — regardless of the runtime
// platform check that actually guards them. Each is unreachable on iOS/Android:
//
//   @revenuecat/purchases-js-hybrid-mappings  RevenueCat's Web SDK (~5.4MB on disk); native uses
//                                             the native module bridge instead.
//   barcode-detector                          expo-camera's web barcode scanner; native scanning
//                                             is done by the platform camera APIs.
//   idb                                       AsyncStorage's IndexedDB backend for web; native
//                                             uses its own native storage.
//   iceberg-js                                Iceberg catalog support in @supabase/storage-js,
//                                             constructed only inside a method this app never
//                                             calls, on any platform.
//
// Substituting an empty module on native keeps the bundles to what actually ships.
// NOTE: @supabase/realtime-js is deliberately NOT in this list — supabase-js constructs a
// RealtimeClient in its own constructor, so it is genuinely reachable even though this app
// never subscribes to a channel.
const WEB_ONLY_MODULES = [
  '@revenuecat/purchases-js-hybrid-mappings',
  'barcode-detector',
  'idb',
  'iceberg-js',
];

const emptyModulePath = path.resolve(projectRoot, 'metro-empty-module.js');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform !== 'web' &&
    WEB_ONLY_MODULES.some((name) => moduleName === name || moduleName.startsWith(`${name}/`))
  ) {
    return { type: 'sourceFile', filePath: emptyModulePath };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
