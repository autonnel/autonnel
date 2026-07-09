export class Slug {
  private constructor(readonly value: string) {}

  static of(raw: string): Slug {
    const normalized = raw
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (normalized.length === 0) throw new Error(`Invalid slug: "${raw}"`);
    return new Slug(normalized);
  }

  equals(other: Slug): boolean {
    return this.value === other.value;
  }
}
