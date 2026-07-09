export class BrowserRenderingNotConfiguredError extends Error {
  constructor() {
    super('Cloudflare Browser Rendering is not configured');
    this.name = 'BrowserRenderingNotConfiguredError';
  }
}

export class BrowserRenderingHttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Browser Rendering HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'BrowserRenderingHttpError';
    this.status = status;
    this.body = body;
  }
}

export class CloudflareChallengeError extends Error {
  constructor() {
    super('Source site returned a Cloudflare bot challenge');
    this.name = 'CloudflareChallengeError';
  }
}
