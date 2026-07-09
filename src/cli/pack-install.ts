import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute, normalize, sep } from 'node:path';
import { satisfiesRange } from '@/lib/plugins/semver-range';

export interface ZipEntry {
  name: string;
  data: Buffer;
}

export function sha256(buf: Buffer | Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

// Pure-JS zip reader: walk the End-Of-Central-Directory + central directory and
// inflate each local entry. Only STORE (0) and DEFLATE (8) are supported — the
// methods JSZip/zip produce for the small text packs we ship. No native dep.
function readZipEntries(buf: Buffer): ZipEntry[] {
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error('not a zip archive (no end-of-central-directory record)');

  const total = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(cdOffset) !== 0x02014b50) {
      throw new Error('corrupt zip central directory');
    }
    const method = buf.readUInt16LE(cdOffset + 10);
    const compSize = buf.readUInt32LE(cdOffset + 20);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localOffset = buf.readUInt32LE(cdOffset + 42);
    const name = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (buf.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error('corrupt zip local header');
    }
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    if (name.endsWith('/')) continue; // directory entry
    const data = method === 0 ? Buffer.from(raw) : inflateRawSync(raw);
    entries.push({ name, data });
  }
  return entries;
}

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

// Zip-slip guard: reject any entry that escapes destDir via `..` or an absolute path.
function safeJoin(destDir: string, entryName: string): string {
  const cleaned = entryName.replace(/\\/g, '/');
  if (isAbsolute(cleaned) || /^[a-zA-Z]:[\\/]/.test(cleaned)) {
    throw new Error(`unsafe zip entry (absolute path): ${entryName}`);
  }
  const target = normalize(join(destDir, cleaned));
  const root = normalize(destDir);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`unsafe zip entry (path traversal): ${entryName}`);
  }
  return target;
}

export function unzipToDir(buf: Buffer, destDir: string): string[] {
  const entries = readZipEntries(buf);
  const written: string[] = [];
  for (const entry of entries) {
    const target = safeJoin(destDir, entry.name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.data);
    written.push(target);
  }
  return written;
}

export interface PackValidation {
  ok: boolean;
  errors: string[];
  enginesRange?: string;
  packageName?: string;
}

interface PackageJsonExports {
  '.'?: unknown;
  './builder'?: unknown;
  [k: string]: unknown;
}

interface PackPackageJson {
  name?: string;
  exports?: PackageJsonExports;
  engines?: { autonnel?: string };
  peerDependencies?: { autonnel?: string };
}

function exportResolves(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0;
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(exportResolves);
  }
  return false;
}

// Validate an extracted pack against the AutonnelPlugin contract: package.json must
// declare `.` and `./builder` exports, ship src/index.ts + src/builder.ts, and its
// engines.autonnel (or peerDependencies.autonnel) range must admit installedAutonnelVersion.
export function validateExtractedPack(dir: string, installedAutonnelVersion: string): PackValidation {
  const errors: string[] = [];
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) {
    return { ok: false, errors: ['package.json is missing'] };
  }

  let pkg: PackPackageJson;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackPackageJson;
  } catch {
    return { ok: false, errors: ['package.json is not valid JSON'] };
  }

  const exp = pkg.exports;
  if (!exp || !exportResolves(exp['.'])) {
    errors.push('package.json exports["."] is missing or unresolved');
  }
  if (!exp || !exportResolves(exp['./builder'])) {
    errors.push('package.json exports["./builder"] is missing or unresolved');
  }
  if (!existsSync(join(dir, 'src', 'index.ts'))) {
    errors.push('src/index.ts is missing');
  }
  if (!existsSync(join(dir, 'src', 'builder.ts'))) {
    errors.push('src/builder.ts is missing');
  }

  const range = pkg.engines?.autonnel ?? pkg.peerDependencies?.autonnel;
  if (!range) {
    errors.push('package.json engines.autonnel (or peerDependencies.autonnel) is missing');
  } else if (!satisfiesRange(installedAutonnelVersion, range)) {
    errors.push(`requires autonnel ${range}, you have ${installedAutonnelVersion}`);
  }

  return { ok: errors.length === 0, errors, enginesRange: range, packageName: pkg.name };
}

// Derive a flat directory name from a scoped npm name: '@autonnel/template-atelier' -> 'template-atelier'.
export function packageDirName(scopedName: string): string {
  const slash = scopedName.lastIndexOf('/');
  const tail = slash >= 0 ? scopedName.slice(slash + 1) : scopedName;
  return tail.replace(/^@/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

export interface ConsumerPackageJson {
  dependencies?: Record<string, string>;
  [k: string]: unknown;
}

// Idempotently add a `file:` dependency to a consumer package.json object. Returns
// true if the object changed (so callers can skip a no-op write).
export function addFileDependency(pkg: ConsumerPackageJson, name: string, fileSpec: string): boolean {
  if (!pkg.dependencies) pkg.dependencies = {};
  if (pkg.dependencies[name] === fileSpec) return false;
  pkg.dependencies[name] = fileSpec;
  return true;
}

export interface FactoryImport {
  packageName: string;
  importName: string;
}

// Render the exact astro.config lines a consumer pastes to wire installed packs into
// `autonnel({ plugins: [...] })`. We never auto-edit astro.config (build-time graph).
export function renderIntegrationSnippet(imports: FactoryImport[]): string {
  if (imports.length === 0) return '';
  const importLines = imports.map((i) => `import ${i.importName} from '${i.packageName}';`);
  const pluginCalls = imports.map((i) => `    ${i.importName}(),`);
  return [
    ...importLines,
    '',
    '// add to your autonnel() integration:',
    'integrations: [',
    '  autonnel({',
    '    plugins: [',
    ...pluginCalls,
    '    ],',
    '  }),',
    '],',
  ].join('\n');
}

// Turn a scoped package name into a camelCase default-import identifier:
// '@autonnel/template-atelier' -> 'templateAtelier'.
export function importIdentifier(scopedName: string): string {
  const base = packageDirName(scopedName);
  return base.replace(/[-_.]+([a-zA-Z0-9])/g, (_m, c: string) => c.toUpperCase());
}
