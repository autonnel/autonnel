import type { AutonnelPlugin } from '@/lib/plugins/types';

const VIRTUAL_ID = 'virtual:autonnel/builder-ext';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// A pack's `builderEntry` module must `export const builderExtension: BuilderExtension`.
// We import that named export (not the namespace) so `builderExtensions` is an array of
// real BuilderExtension objects — same convention the standalone dev config uses.
export function generateBuilderExtModuleSource(plugins: AutonnelPlugin[]): string {
  const withEntry = plugins.filter((p) => p.builderEntry);
  if (withEntry.length === 0) return 'export const builderExtensions = [];\n';

  const imports = withEntry
    .map((p, i) => `import { builderExtension as p${i} } from ${JSON.stringify(p.builderEntry)};`)
    .join('\n');
  const names = withEntry.map((_, i) => `p${i}`).join(', ');
  return `${imports}\nexport const builderExtensions = [${names}].filter(Boolean);\n`;
}

export function builderExtVitePlugin(plugins: AutonnelPlugin[]) {
  return {
    name: 'autonnel:builder-ext',
    resolveId(id: string) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id: string) {
      if (id === RESOLVED_ID) return generateBuilderExtModuleSource(plugins);
      return null;
    },
  };
}
