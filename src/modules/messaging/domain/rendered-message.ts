export interface RenderedMessageInput {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export class RenderedMessage {
  private constructor(
    readonly subject: string,
    readonly html: string,
    readonly text: string,
    readonly headers: Readonly<Record<string, string>>,
  ) {}

  static of(input: RenderedMessageInput): RenderedMessage {
    if (!input.subject.trim()) throw new Error('RenderedMessage requires a non-empty subject');
    if (!input.html.trim() && !input.text.trim()) throw new Error('RenderedMessage requires at least one body (html or text)');
    return new RenderedMessage(input.subject, input.html, input.text, Object.freeze({ ...input.headers }));
  }
}
