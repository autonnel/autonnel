import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateProjectName } from '@/cli/index';
import { runCreate } from '@/cli/create';

describe('validateProjectName', () => {
  it('accepts simple lowercase names', () => {
    expect(validateProjectName('my-funnel').ok).toBe(true);
    expect(validateProjectName('a').ok).toBe(true);
  });

  it('accepts scoped names', () => {
    expect(validateProjectName('@acme/my-funnel').ok).toBe(true);
  });

  it('rejects empty names', () => {
    expect(validateProjectName('').ok).toBe(false);
  });

  it('rejects uppercase, spaces, leading dot', () => {
    expect(validateProjectName('My-Funnel').ok).toBe(false);
    expect(validateProjectName('my funnel').ok).toBe(false);
    expect(validateProjectName('.hidden').ok).toBe(false);
  });

  it('rejects names longer than 214 chars', () => {
    expect(validateProjectName('a'.repeat(215)).ok).toBe(false);
  });
});

// runCreate shallow-clones this repository as a starting point. It is not a
// wizard: it asks nothing and writes no .env. Only the guards that run before
// the clone are unit-tested here; the clone itself needs git and the network,
// which is not something CI should do on every push.
describe('runCreate guards', () => {
  let cwd: string;
  let tmp: string;

  beforeEach(() => {
    cwd = process.cwd();
    tmp = mkdtempSync(join(tmpdir(), 'autonnel-create-'));
    process.chdir(tmp);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
  });

  afterEach(() => {
    process.chdir(cwd);
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('rejects an invalid project name', () => {
    expect(() => runCreate(['My Funnel'])).toThrow('process.exit(1)');
  });

  it('reports why the name was rejected', () => {
    const stderr = vi.mocked(process.stderr.write);
    expect(() => runCreate(['.hidden'])).toThrow('process.exit(1)');
    expect(String(stderr.mock.calls[0][0])).toMatch(/^Error: /);
  });

  it('refuses to overwrite an existing directory', () => {
    mkdirSync(join(tmp, 'taken'));
    expect(() => runCreate(['taken'])).toThrow('process.exit(1)');
    const stderr = vi.mocked(process.stderr.write);
    expect(String(stderr.mock.calls[0][0])).toContain('already exists');
  });

  it('treats the first non-flag argument as the project name', () => {
    mkdirSync(join(tmp, 'from-flag'));
    // --yes is skipped, so the existing "from-flag" directory is what it checks
    expect(() => runCreate(['--yes', 'from-flag'])).toThrow('process.exit(1)');
    const stderr = vi.mocked(process.stderr.write);
    expect(String(stderr.mock.calls[0][0])).toContain('from-flag');
  });
});
