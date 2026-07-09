export const SCRIPT_POSITIONS = ['HEAD', 'BODY_START', 'BODY_END'] as const;
export type ScriptPosition = (typeof SCRIPT_POSITIONS)[number];

export function isScriptPosition(v: unknown): v is ScriptPosition {
  return typeof v === 'string' && (SCRIPT_POSITIONS as readonly string[]).includes(v);
}

export class GlobalScript {
  private constructor(
    public id: string,
    readonly tenantId: string,
    public name: string,
    public content: string,
    public position: ScriptPosition,
    public enabled: boolean,
    public order: number,
  ) {}

  static create(input: {
    tenantId: string;
    name: string;
    content: string;
    position: string;
    enabled?: boolean;
    order?: number;
  }): GlobalScript {
    const name = input.name.trim();
    if (!name) throw new Error('Script name is required');
    if (!input.content.trim()) throw new Error('Script content is required');
    if (!isScriptPosition(input.position)) {
      throw new Error('Invalid position. Must be HEAD, BODY_START, or BODY_END');
    }
    return new GlobalScript('', input.tenantId, name, input.content, input.position, input.enabled !== false, input.order ?? 0);
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    name: string;
    content: string;
    position: ScriptPosition;
    enabled: boolean;
    order: number;
  }): GlobalScript {
    return new GlobalScript(input.id, input.tenantId, input.name, input.content, input.position, input.enabled, input.order);
  }

  applyEdit(patch: { name?: string; content?: string; position?: string; enabled?: boolean; order?: number }): void {
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error('Script name is required');
      this.name = name;
    }
    if (patch.content !== undefined) {
      if (!patch.content.trim()) throw new Error('Script content is required');
      this.content = patch.content;
    }
    if (patch.position !== undefined) {
      if (!isScriptPosition(patch.position)) {
        throw new Error('Invalid position. Must be HEAD, BODY_START, or BODY_END');
      }
      this.position = patch.position;
    }
    if (patch.enabled !== undefined) this.enabled = patch.enabled;
    if (patch.order !== undefined) this.order = patch.order;
  }
}
