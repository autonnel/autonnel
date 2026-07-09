import { describe, it, expect } from 'vitest';
import {
  parseSkillFile,
  loadSkillCatalog,
  buildSkillPrompt,
  createLoadSkillTool,
  type Skill,
} from '@/lib/ai/skill-loader';

const SAMPLE = `---\nname: example\ndescription: An example skill used only by tests\n---\n\nThis is the body of the example skill.\n\nIt can have multiple paragraphs.\n`;

describe('parseSkillFile', () => {
  it('extracts name and description from frontmatter', () => {
    const skill = parseSkillFile(SAMPLE, '/src/skills/page-builder/example.skill.md');
    expect(skill.name).toBe('example');
    expect(skill.description).toBe('An example skill used only by tests');
  });

  it('strips frontmatter from the body', () => {
    const skill = parseSkillFile(SAMPLE, '/src/skills/page-builder/example.skill.md');
    expect(skill.body.startsWith('This is the body')).toBe(true);
    expect(skill.body).not.toContain('---');
    expect(skill.body).not.toContain('name:');
  });

  it('infers agentName from the file path', () => {
    const skill = parseSkillFile(SAMPLE, '/src/skills/page-builder/example.skill.md');
    expect(skill.agentName).toBe('page-builder');
  });

  it('throws on missing frontmatter', () => {
    expect(() => parseSkillFile('no frontmatter here', '/src/skills/x/y.skill.md')).toThrow();
  });

  it('throws on missing required name field', () => {
    const raw = `---\ndescription: no name\n---\n\nbody`;
    expect(() => parseSkillFile(raw, '/src/skills/x/y.skill.md')).toThrow(/name/);
  });
});

describe('loadSkillCatalog', () => {
  it('skips files prefixed with `_` so test fixtures are not exposed in production', () => {
    // src/skills/page-builder/_example.skill.md exists as a test-only fixture.
    // It must be bundled (so import.meta.glob picks it up) but never advertised.
    const catalog = loadSkillCatalog('page-builder');
    const example = catalog.find((s) => s.name === 'example');
    expect(example).toBeUndefined();
  });

  it('returns an empty array for an unknown agent', () => {
    const catalog = loadSkillCatalog('does-not-exist');
    expect(catalog).toEqual([]);
  });
});

describe('buildSkillPrompt', () => {
  it('returns an empty string for an empty catalog', () => {
    expect(buildSkillPrompt([])).toBe('');
  });

  it('includes each skill name and description as a bullet', () => {
    const skills: Skill[] = [
      { name: 'a', description: 'First skill', body: 'body a', agentName: 'x', filePath: 'a' },
      { name: 'b', description: 'Second skill', body: 'body b', agentName: 'x', filePath: 'b' },
    ];
    const prompt = buildSkillPrompt(skills);
    expect(prompt).toContain('a');
    expect(prompt).toContain('First skill');
    expect(prompt).toContain('b');
    expect(prompt).toContain('Second skill');
    expect(prompt).toContain('load_skill');
  });
});

describe('createLoadSkillTool', () => {
  it('returns a tool definition with an execute that loads a known skill', async () => {
    const skills: Skill[] = [
      { name: 'foo', description: 'd', body: 'BODY', agentName: 'x', filePath: 'foo' },
    ];
    const t = createLoadSkillTool(skills) as any;
    const result = await t.execute({ name: 'foo' }, {} as any);
    expect(result.name).toBe('foo');
    expect(result.body).toBe('BODY');
  });

  it('returns an error for an unknown skill name', async () => {
    const skills: Skill[] = [
      { name: 'foo', description: 'd', body: 'BODY', agentName: 'x', filePath: 'foo' },
    ];
    const t = createLoadSkillTool(skills) as any;
    const result = await t.execute({ name: 'missing' }, {} as any);
    expect(result.error).toMatch(/not found/i);
  });
});
