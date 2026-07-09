export type ContactChannel = 'email' | 'phone';
export type HashIdentityFn = (normalized: string) => string;

export class ContactHandle {
  private constructor(
    readonly channel: ContactChannel,
    readonly normalized: string,
    readonly hashedIdentity: string,
  ) {}

  static fromEmail(raw: string, hash: HashIdentityFn): ContactHandle {
    const normalized = raw.trim().toLowerCase();
    if (!normalized) throw new Error('ContactHandle email is empty');
    return new ContactHandle('email', normalized, hash(normalized));
  }

  static fromPhone(raw: string, hash: HashIdentityFn): ContactHandle {
    const hasPlus = raw.trim().startsWith('+');
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) throw new Error('ContactHandle phone is empty');
    const normalized = hasPlus ? `+${digits}` : digits;
    return new ContactHandle('phone', normalized, hash(normalized));
  }

  static rehydrate(
    channel: ContactChannel,
    normalized: string,
    hashedIdentity: string,
  ): ContactHandle {
    return new ContactHandle(channel, normalized, hashedIdentity);
  }
}
