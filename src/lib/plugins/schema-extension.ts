import { InvalidPluginContractError } from './errors';

export interface ParsedModel {
  name: string;
  table: string;
  fieldTypes: string[];
  hasTenantId: boolean;
}

export interface ParsedSchema {
  models: ParsedModel[];
  enums: string[];
  otherBlocks: string[];
}

export interface PluginSchemaFragment {
  pluginName: string;
  schema: string;
}

const BLOCK_HEADER = /^[ \t]*(\w+)[ \t]+(\w+)[ \t]*\{/gm;
const MAP_ATTRIBUTE = /@@map\(\s*"([^"]+)"\s*\)/;

function stripComments(dsl: string): string {
  return dsl.replace(/\/\/[^\n]*/g, '');
}

function blockBody(dsl: string, openBrace: number): string {
  let depth = 0;
  for (let i = openBrace; i < dsl.length; i++) {
    if (dsl[i] === '{') depth++;
    else if (dsl[i] === '}' && --depth === 0) return dsl.slice(openBrace + 1, i);
  }
  throw new Error('unbalanced braces');
}

function parseModel(name: string, body: string): ParsedModel {
  const fieldTypes: string[] = [];
  let hasTenantId = false;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('@@')) continue;
    const [field, type] = line.split(/\s+/);
    if (!type) continue;
    const baseType = type.replace(/[?[\]]/g, '');
    fieldTypes.push(baseType);
    if (field === 'tenantId' && baseType === 'String') hasTenantId = true;
  }
  return { name, table: MAP_ATTRIBUTE.exec(body)?.[1] ?? name, fieldTypes, hasTenantId };
}

export function parseSchema(dsl: string): ParsedSchema {
  const clean = stripComments(dsl);
  const parsed: ParsedSchema = { models: [], enums: [], otherBlocks: [] };
  for (const match of clean.matchAll(BLOCK_HEADER)) {
    const [header, keyword, name] = match;
    const body = blockBody(clean, match.index! + header.length - 1);
    if (keyword === 'model') parsed.models.push(parseModel(name, body));
    else if (keyword === 'enum') parsed.enums.push(name);
    else parsed.otherBlocks.push(`${keyword} ${name}`);
  }
  return parsed;
}

// Checks that need only the fragment itself, so they also run inside the worker at registration.
export function parsePluginSchema(pluginName: string, dsl: string): ParsedSchema {
  let parsed: ParsedSchema;
  try {
    parsed = parseSchema(dsl);
  } catch (error) {
    throw new InvalidPluginContractError(pluginName, `schemaExtension is not valid Prisma DSL: ${(error as Error).message}`);
  }
  if (parsed.otherBlocks.length > 0) {
    throw new InvalidPluginContractError(
      pluginName,
      `schemaExtension may only declare model and enum blocks, found: ${parsed.otherBlocks.join(', ')}`,
    );
  }
  if (parsed.models.length === 0 && parsed.enums.length === 0) {
    throw new InvalidPluginContractError(pluginName, 'schemaExtension declares no model or enum');
  }
  for (const model of parsed.models) {
    // The tenant query extension injects tenantId into every model; a model without it would fail at runtime.
    if (!model.hasTenantId) {
      throw new InvalidPluginContractError(pluginName, `model ${model.name} must have a "tenantId String" field`);
    }
  }
  return parsed;
}

export function pluginSchemaFileName(pluginName: string): string {
  return `plugin-${pluginName.replace(/^@/, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.prisma`;
}

// Returns the multi-file schema folder contents: the core schema untouched plus one file per plugin.
export function composePluginSchema(coreSchema: string, fragments: PluginSchemaFragment[]): Record<string, string> {
  const core = parseSchema(coreSchema);
  const coreModels = new Set(core.models.map((m) => m.name));
  const typeOwner = new Map<string, string>([...coreModels, ...core.enums].map((n) => [n, 'core']));
  const tableOwner = new Map<string, string>(core.models.map((m) => [m.table, 'core']));

  const files: Record<string, string> = { 'core.prisma': coreSchema };
  for (const { pluginName, schema } of fragments) {
    const parsed = parsePluginSchema(pluginName, schema);
    for (const name of [...parsed.models.map((m) => m.name), ...parsed.enums]) {
      const owner = typeOwner.get(name);
      if (owner) throw new InvalidPluginContractError(pluginName, `type ${name} is already declared by ${owner}`);
      typeOwner.set(name, pluginName);
    }
    for (const model of parsed.models) {
      const owner = tableOwner.get(model.table);
      if (owner) throw new InvalidPluginContractError(pluginName, `table ${model.table} is already used by ${owner}`);
      tableOwner.set(model.table, pluginName);
      // A relation to a core model needs a back-relation field on that model, i.e. mutating core.
      const coreRef = model.fieldTypes.find((t) => coreModels.has(t));
      if (coreRef) {
        throw new InvalidPluginContractError(
          pluginName,
          `model ${model.name} references core model ${coreRef}; store its id as a scalar instead`,
        );
      }
    }
    files[pluginSchemaFileName(pluginName)] = `// Generated from the schemaExtension of ${pluginName}. Do not edit.\n\n${schema.trim()}\n`;
  }
  return files;
}
