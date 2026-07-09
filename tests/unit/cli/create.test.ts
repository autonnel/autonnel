import { describe, it, expect } from 'vitest';
import { validateProjectName, detectPackageManager, buildCreateCommand } from '@/cli/index';

describe('validateProjectName', () => {
  it('accepts simple lowercase names', () => {
    expect(validateProjectName('my-funnel').ok).toBe(true);
    expect(validateProjectName('a').ok).toBe(true);
  });

  it('accepts scoped names', () => {
    expect(validateProjectName('@acme/my-funnel').ok).toBe(true);
  });

  it('rejects empty names', () => {
    const r = validateProjectName('');
    expect(r.ok).toBe(false);
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

describe('detectPackageManager', () => {
  it('detects the invoking package manager from npm_config_user_agent', () => {
    expect(detectPackageManager('pnpm/10.11.1 npm/? node/v22.0.0 win32 x64')).toBe('pnpm');
    expect(detectPackageManager('yarn/4.5.0 npm/? node/v22.0.0')).toBe('yarn');
    expect(detectPackageManager('bun/1.2.0')).toBe('bun');
    expect(detectPackageManager('npm/10.9.0 node/v22.0.0')).toBe('npm');
  });

  it('falls back to npm', () => {
    expect(detectPackageManager(undefined)).toBe('npm');
    expect(detectPackageManager('something-else/1.0')).toBe('npm');
  });
});

describe('buildCreateCommand', () => {
  it('delegates through npm create with an args separator', () => {
    expect(buildCreateCommand('npm', ['my-funnel', '--yes'])).toEqual({
      cmd: 'npm',
      args: ['create', 'autonnel@latest', '--', 'my-funnel', '--yes'],
    });
  });

  it('delegates through pnpm/yarn/bun create without a separator', () => {
    expect(buildCreateCommand('pnpm', ['my-funnel'])).toEqual({
      cmd: 'pnpm',
      args: ['create', 'autonnel', 'my-funnel'],
    });
    expect(buildCreateCommand('bun', [])).toEqual({
      cmd: 'bun',
      args: ['create', 'autonnel'],
    });
  });
});
