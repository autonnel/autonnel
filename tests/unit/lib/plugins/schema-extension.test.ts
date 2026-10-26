import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  composePluginSchema,
  parsePluginSchema,
  parseSchema,
  pluginSchemaFileName,
} from '@/lib/plugins/schema-extension';
import { InvalidPluginContractError } from '@/lib/plugins/errors';

const coreSchema = readFileSync(resolve(__dirname, '../../../../prisma/schema.prisma'), 'utf8');

const heartbeat = `
// last run per tenant
model PluginHeartbeat {
  id       String   @id @default(cuid())
  tenantId String
  ranAt    DateTime @default(now())
  status   HeartbeatStatus
  @@index([tenantId, ranAt])
  @@map("plugin_heartbeats")
}

enum HeartbeatStatus {
  OK
  FAILED
}
`;

describe('parseSchema', () => {
  it('reads models, tables and enums from the real core schema without treating generator/datasource as models', () => {
    const parsed = parseSchema(coreSchema);
    const job = parsed.models.find((m) => m.name === 'Job');
    expect(job?.table).toBe('jobs');
    expect(job?.hasTenantId).toBe(true);
    expect(parsed.enums).toContain('JobStatus');
    expect(parsed.otherBlocks).toEqual(expect.arrayContaining(['generator client', 'datasource db']));
    expect(parsed.models.length).toBeGreaterThan(20);
  });

  it('ignores braces and field names inside comments', () => {
    const parsed = parseSchema('// model Fake {\nmodel A {\n  tenantId String // }\n}\n');
    expect(parsed.models.map((m) => m.name)).toEqual(['A']);
  });
});

describe('parsePluginSchema', () => {
  it('accepts tenant-scoped models and enums', () => {
    const parsed = parsePluginSchema('hb', heartbeat);
    expect(parsed.models).toEqual([
      expect.objectContaining({ name: 'PluginHeartbeat', table: 'plugin_heartbeats', hasTenantId: true }),
    ]);
    expect(parsed.enums).toEqual(['HeartbeatStatus']);
  });

  it.each([
    ['a generator block', 'generator client {\n  provider = "prisma-client-js"\n}\n', /model and enum blocks/],
    ['a datasource block', 'datasource db {\n  provider = "postgresql"\n}\n', /model and enum blocks/],
    ['a model without tenantId', 'model X {\n  id String @id\n}\n', /tenantId String/],
    ['a tenantId of the wrong type', 'model X {\n  id String @id\n  tenantId Int\n}\n', /tenantId String/],
    ['an empty fragment', '// nothing\n', /declares no model or enum/],
    ['unbalanced braces', 'model X {\n  tenantId String\n', /not valid Prisma DSL/],
  ])('rejects %s', (_label, dsl, message) => {
    expect(() => parsePluginSchema('hb', dsl)).toThrow(InvalidPluginContractError);
    expect(() => parsePluginSchema('hb', dsl)).toThrow(message);
  });
});

describe('composePluginSchema', () => {
  it('keeps the core schema byte-for-byte and adds one file per plugin', () => {
    const files = composePluginSchema(coreSchema, [{ pluginName: '@autonnel/plugin-heartbeat', schema: heartbeat }]);
    expect(Object.keys(files)).toEqual(['core.prisma', 'plugin-autonnel-plugin-heartbeat.prisma']);
    expect(files['core.prisma']).toBe(coreSchema);
    expect(files['plugin-autonnel-plugin-heartbeat.prisma']).toContain('model PluginHeartbeat');
  });

  it('returns only the core file when no plugin extends the schema', () => {
    expect(Object.keys(composePluginSchema(coreSchema, []))).toEqual(['core.prisma']);
  });

  it('rejects a model that redeclares a core model', () => {
    const dsl = 'model Job {\n  id String @id\n  tenantId String\n}\n';
    expect(() => composePluginSchema(coreSchema, [{ pluginName: 'bad', schema: dsl }])).toThrow(
      /type Job is already declared by core/,
    );
  });

  it('rejects a model mapped onto a core table', () => {
    const dsl = 'model Sneaky {\n  id String @id\n  tenantId String\n  @@map("jobs")\n}\n';
    expect(() => composePluginSchema(coreSchema, [{ pluginName: 'bad', schema: dsl }])).toThrow(
      /table jobs is already used by core/,
    );
  });

  it('rejects a relation to a core model', () => {
    const dsl = 'model Note {\n  id String @id\n  tenantId String\n  job Job @relation(fields: [jobId], references: [id])\n  jobId String\n}\n';
    expect(() => composePluginSchema(coreSchema, [{ pluginName: 'bad', schema: dsl }])).toThrow(
      /references core model Job/,
    );
  });

  it('rejects two plugins declaring the same type or table', () => {
    const other = heartbeat.replace('PluginHeartbeat', 'OtherHeartbeat').replace('enum HeartbeatStatus', 'enum OtherStatus').replace('status   HeartbeatStatus', 'status   OtherStatus');
    expect(() =>
      composePluginSchema(coreSchema, [
        { pluginName: 'a', schema: heartbeat },
        { pluginName: 'b', schema: heartbeat },
      ]),
    ).toThrow(/type PluginHeartbeat is already declared by a/);
    expect(() =>
      composePluginSchema(coreSchema, [
        { pluginName: 'a', schema: heartbeat },
        { pluginName: 'b', schema: other },
      ]),
    ).toThrow(/table plugin_heartbeats is already used by a/);
  });
});

describe('pluginSchemaFileName', () => {
  it('derives a filesystem-safe name from the package name', () => {
    expect(pluginSchemaFileName('@autonnel/plugin-voluum')).toBe('plugin-autonnel-plugin-voluum.prisma');
    expect(pluginSchemaFileName('my plugin')).toBe('plugin-my-plugin.prisma');
  });
});
