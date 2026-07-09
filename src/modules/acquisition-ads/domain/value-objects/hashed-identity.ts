const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface ContactHandleHashes {
  emailSha256?: string;
  phoneSha256?: string;
}

export class HashedIdentity {
  private constructor(
    readonly email: string | undefined,
    readonly phone: string | undefined,
  ) {}

  static fromContactHandle(h: ContactHandleHashes): HashedIdentity {
    const validate = (v: string | undefined, label: string): string | undefined => {
      if (v === undefined) return undefined;
      if (!SHA256_HEX.test(v)) throw new Error(`${label} is not a SHA-256 hash`);
      return v;
    };
    return new HashedIdentity(validate(h.emailSha256, 'email'), validate(h.phoneSha256, 'phone'));
  }

  isEmpty(): boolean {
    return this.email === undefined && this.phone === undefined;
  }
}
