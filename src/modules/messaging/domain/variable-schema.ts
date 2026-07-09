export interface VariableDecl {
  readonly name: string;
  readonly required: boolean;
}

export class VariableSchema {
  private constructor(private readonly decls: ReadonlyArray<VariableDecl>) {}

  static of(decls: VariableDecl[]): VariableSchema {
    const seen = new Set<string>();
    for (const d of decls) {
      if (seen.has(d.name)) throw new Error(`duplicate variable declaration: ${d.name}`);
      seen.add(d.name);
    }
    return new VariableSchema([...decls]);
  }

  names(): string[] {
    return this.decls.map((d) => d.name);
  }

  declares(name: string): boolean {
    return this.decls.some((d) => d.name === name);
  }

  validate(vars: Record<string, unknown>): { missing: string[] } {
    const missing = this.decls
      .filter((d) => d.required && (vars[d.name] === undefined || vars[d.name] === null || vars[d.name] === ''))
      .map((d) => d.name);
    return { missing };
  }

  toJSON(): VariableDecl[] {
    return [...this.decls];
  }
}
