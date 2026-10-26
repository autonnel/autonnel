const VIRTUAL_ID = 'virtual:autonnel/runtime-plugins';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

const PASSTHROUGH = 'export const onRequest = (_context, next) => next();\n';

// The build-time registry never reaches the server bundle (Node server or worker), so the server
// re-runs registerPlugins from the consumer's plugins module when this module is first evaluated.
// Imported as a middleware (request path) and by cf-worker (scheduled path). Without a plugins
// module it must not register anything: a consumer that registers plugins itself (autonnel-saas)
// would have its registry wiped by an empty registration.
export function generateRuntimePluginsModuleSource(registerPluginsPath: string, pluginsModulePath?: string): string {
  if (!pluginsModulePath) return PASSTHROUGH;
  return [
    `import { registerPlugins } from ${JSON.stringify(registerPluginsPath)};`,
    `import * as pluginsModule from ${JSON.stringify(pluginsModulePath)};`,
    `if (typeof pluginsModule.createPlugins !== 'function') {`,
    `  throw new Error('autonnel: the pluginsModule must export createPlugins()');`,
    `}`,
    // Engine ranges were enforced at build time; at runtime the relative package.json lookup would
    // resolve against the bundle location and read the consumer's own package.json.
    `registerPlugins(pluginsModule.createPlugins(), { checkEngines: false });`,
    PASSTHROUGH,
  ].join('\n');
}

export const RUNTIME_PLUGINS_MODULE_ID = VIRTUAL_ID;

export function runtimePluginsVitePlugin(registerPluginsPath: string, pluginsModulePath?: string) {
  return {
    name: 'autonnel:runtime-plugins',
    resolveId(id: string) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id: string) {
      return id === RESOLVED_ID ? generateRuntimePluginsModuleSource(registerPluginsPath, pluginsModulePath) : null;
    },
  };
}
