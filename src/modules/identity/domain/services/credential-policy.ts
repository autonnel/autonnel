export class CredentialPolicy {
  assertStrong(password: string): void {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
  }
}
