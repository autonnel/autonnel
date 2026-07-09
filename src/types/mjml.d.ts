declare module 'mjml' {
  export interface MjmlResult {
    html: string;
    errors: { message: string; line?: number; tagName?: string }[];
  }
  export default function mjml2html(input: string, opts?: { validationLevel?: 'soft' | 'strict' | 'skip' }): Promise<MjmlResult>;
}

declare module 'mjml-browser' {
  export interface MjmlResult {
    html: string;
    errors: { message: string; line?: number; tagName?: string }[];
  }
  export default function mjml(input: string, opts?: { validationLevel?: 'soft' | 'strict' | 'skip' }): MjmlResult;
}
