export interface SealedTokenProps {
  ciphertext: string;
  iv: string;
  tokenVersion: number;
}

export class SealedToken {
  private constructor(private readonly props: SealedTokenProps) {}
  static of(props: SealedTokenProps): SealedToken { return new SealedToken(props); }
  get ciphertext(): string { return this.props.ciphertext; }
  get iv(): string { return this.props.iv; }
  get tokenVersion(): number { return this.props.tokenVersion; }
  toJSON(): SealedTokenProps { return { ...this.props }; }
}
