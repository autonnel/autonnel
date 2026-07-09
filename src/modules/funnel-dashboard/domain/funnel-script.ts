export const SCRIPT_POSITIONS = ['HEAD', 'BODY_START', 'BODY_END'] as const;
export type ScriptPosition = (typeof SCRIPT_POSITIONS)[number];

export function isScriptPosition(v: unknown): v is ScriptPosition {
  return typeof v === 'string' && (SCRIPT_POSITIONS as readonly string[]).includes(v);
}

export class FunnelScript {
  private constructor(
    public id: string,
    readonly funnelId: string,
    public name: string,
    public content: string,
    public position: ScriptPosition,
    public isActive: boolean,
    public order: number,
  ) {}

  static create(input: {
    funnelId: string;
    name: string;
    content: string;
    position: string;
    isActive?: boolean;
    order?: number;
  }): FunnelScript {
    const name = input.name.trim();
    if (!name) throw new Error('Name and content are required');
    if (!input.content.trim()) throw new Error('Name and content are required');
    if (!isScriptPosition(input.position)) {
      throw new Error('Invalid position. Must be HEAD, BODY_START, or BODY_END');
    }
    return new FunnelScript('', input.funnelId, name, input.content, input.position, input.isActive !== false, input.order ?? 0);
  }

  static rehydrate(input: {
    id: string;
    funnelId: string;
    name: string;
    content: string;
    position: ScriptPosition;
    isActive: boolean;
    order: number;
  }): FunnelScript {
    return new FunnelScript(input.id, input.funnelId, input.name, input.content, input.position, input.isActive, input.order);
  }

  applyEdit(patch: { name?: string; content?: string; position?: string; isActive?: boolean; order?: number }): void {
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error('Name is required');
      this.name = name;
    }
    if (patch.content !== undefined) {
      if (!patch.content.trim()) throw new Error('Content is required');
      this.content = patch.content;
    }
    if (patch.position !== undefined) {
      if (!isScriptPosition(patch.position)) {
        throw new Error('Invalid position. Must be HEAD, BODY_START, or BODY_END');
      }
      this.position = patch.position;
    }
    if (patch.isActive !== undefined) this.isActive = patch.isActive;
    if (patch.order !== undefined) this.order = patch.order;
  }
}
