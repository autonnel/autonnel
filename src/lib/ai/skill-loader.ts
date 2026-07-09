
import { tool } from 'ai';
import { z } from 'zod';

export interface SkillFrontmatter {
  name: string;
  description: string;
}

export interface Skill {
  name: string;
  description: string;
  body: string;
  agentName: string;
  filePath: string;
}

const SKILL_FILES: Record<string, string> = (() => {
  try {
    return import.meta.glob('/src/skills*.skill.md', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
  } catch {
    return {};
  }
})();

const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/;

// Keeping this in-house avoids a gray-matter dep (which pulled eval+~50KB).
export function parseSkillFile(raw: string, filePath: string): Skill {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    throw new Error(`Skill file ${filePath} is missing YAML frontmatter`);
  }
  const [, frontmatterBlock, body] = match;
  const frontmatter: Record<string, string> = {};
  for (const line of frontmatterBlock.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) frontmatter[key] = value;
  }
  if (!frontmatter.name) {
    throw new Error(`Skill file ${filePath} is missing required "name" frontmatter`);
  }
  if (!frontmatter.description) {
    throw new Error(`Skill file ${filePath} is missing required "description" frontmatter`);
  }
  const agentName = extractAgentName(filePath);
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    body: body.trim(),
    agentName,
    filePath,
  };
}

function extractAgentName(filePath: string): string {
  const m = /\/src\/skills\/([^/]+)\//.exec(filePath);
  return m ? m[1] : '';
}

export function loadSkillCatalog(agentName: string): Skill[] {
  const catalog: Skill[] = [];
  for (const [filePath, raw] of Object.entries(SKILL_FILES)) {
    if (extractAgentName(filePath) !== agentName) continue;
    // Files prefixed with `_` are test-only fixtures: bundled but never advertised.
    const basename = filePath.split('/').pop() ?? '';
    if (basename.startsWith('_')) continue;
    catalog.push(parseSkillFile(raw, filePath));
  }
  catalog.sort((a, b) => a.name.localeCompare(b.name));
  return catalog;
}

export function buildSkillPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';
  const lines = skills.map((s) => `- **${s.name}**: ${s.description}`);
  return [
    '## Available Skills',
    'Call the `load_skill` tool with the skill name to read the full instructions for a skill before acting on it.',
    '',
    ...lines,
  ].join('\n');
}

export function createLoadSkillTool(skills: Skill[]) {
  const byName = new Map(skills.map((s) => [s.name, s]));
  return tool({
    description:
      'Load the full body of a named skill. Call this when you need detailed instructions for a skill listed in the system prompt.',
    inputSchema: z.object({
      name: z.string().describe('The skill name as listed in the system prompt.'),
    }),
    execute: async ({ name }: { name: string }) => {
      const skill = byName.get(name);
      if (!skill) {
        return { error: `Skill "${name}" not found. Available: ${[...byName.keys()].join(', ')}` };
      }
      return { name: skill.name, description: skill.description, body: skill.body };
    },
  });
}
