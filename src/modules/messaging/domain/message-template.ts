import { ChannelType, TemplateKey } from './value-objects';
import { VariableSchema } from './variable-schema';

const VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;

export interface TemplateVersionInput {
  channel: ChannelType;
  locale: string;
  subject: string;
  html: string;
  text: string;
  schema: VariableSchema;
}

export class TemplateVersion {
  constructor(
    readonly versionId: string,
    readonly channel: ChannelType,
    readonly locale: string,
    private _subject: string,
    private _html: string,
    private _text: string,
    readonly schema: VariableSchema,
    private _published: boolean,
  ) {}

  get subject() { return this._subject; }
  get html() { return this._html; }
  get text() { return this._text; }
  get isPublished() { return this._published; }

  edit(patch: Partial<{ subject: string; html: string; text: string }>): void {
    if (this._published) throw new Error('published version is immutable; create a new draft to edit');
    if (patch.subject !== undefined) this._subject = patch.subject;
    if (patch.html !== undefined) this._html = patch.html;
    if (patch.text !== undefined) this._text = patch.text;
  }

  markPublished(): void { this._published = true; }
}

function referencedVars(...bodies: string[]): Set<string> {
  const out = new Set<string>();
  for (const body of bodies) {
    for (const m of body.matchAll(VAR_RE)) out.add(m[1].split('.')[0]);
  }
  return out;
}

export interface CreateTemplateInput {
  tenantId: string;
  templateKey: TemplateKey;
}

export class MessageTemplate {
  private versions: TemplateVersion[] = [];
  private seq = 0;

  private constructor(
    readonly tenantId: string,
    readonly templateKey: TemplateKey,
    public id?: string,
  ) {}

  static create(input: CreateTemplateInput): MessageTemplate {
    return new MessageTemplate(input.tenantId, input.templateKey);
  }

  static rehydrate(tenantId: string, templateKey: TemplateKey, versions: TemplateVersion[], id?: string): MessageTemplate {
    const t = new MessageTemplate(tenantId, templateKey, id);
    t.versions = versions;
    t.seq = versions.length;
    return t;
  }

  addDraft(input: TemplateVersionInput): TemplateVersion {
    const used = referencedVars(input.subject, input.html, input.text);
    for (const name of used) {
      if (!input.schema.declares(name)) throw new Error(`body references undeclared variable: ${name}`);
    }
    this.seq += 1;
    const v = new TemplateVersion(
      `v${this.seq}`,
      input.channel,
      input.locale,
      input.subject,
      input.html,
      input.text,
      input.schema,
      false,
    );
    this.versions.push(v);
    return v;
  }

  editDraft(versionId: string, patch: Partial<{ subject: string; html: string; text: string }>): void {
    this.findVersionOrThrow(versionId).edit(patch);
  }

  publish(versionId: string): void {
    const v = this.findVersionOrThrow(versionId);
    const used = referencedVars(v.subject, v.html, v.text);
    for (const name of used) {
      if (!v.schema.declares(name)) throw new Error(`cannot publish: body references undeclared variable ${name}`);
    }
    v.markPublished();
  }

  currentPublished(channel: ChannelType, locale: string): TemplateVersion | undefined {
    // latest published version for (channel, locale) wins (publish appends; later supersedes)
    return [...this.versions]
      .reverse()
      .find((x) => x.isPublished && x.channel === channel && x.locale === locale);
  }

  findVersion(versionId: string): TemplateVersion | undefined {
    return this.versions.find((x) => x.versionId === versionId);
  }

  private findVersionOrThrow(versionId: string): TemplateVersion {
    const v = this.findVersion(versionId);
    if (!v) throw new Error(`version not found: ${versionId}`);
    return v;
  }

  allVersions(): ReadonlyArray<TemplateVersion> {
    return this.versions;
  }
}
