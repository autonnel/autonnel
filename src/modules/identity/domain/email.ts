const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly normalized: string) {}

  static of(raw: string): Email {
    const n = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(n)) throw new Error(`Invalid email: ${raw}`);
    return new Email(n);
  }

  static isValid(raw: string): boolean {
    return EMAIL_RE.test(raw.trim().toLowerCase());
  }

  equals(other: Email): boolean {
    return this.normalized === other.normalized;
  }
}
