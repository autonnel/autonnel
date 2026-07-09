import { describe, it, expect } from 'vitest';
import { signAwsV4 } from './sigv4';

describe('signAwsV4', () => {
  it('produces an Authorization header with the AWS4-HMAC-SHA256 algorithm + signed headers', async () => {
    const headers = await signAwsV4({
      method: 'POST',
      host: 'email.us-east-1.amazonaws.com',
      region: 'us-east-1',
      service: 'ses',
      path: '/v2/email/outbound-emails',
      body: '{"x":1}',
      accessKeyId: 'AKIA_TEST',
      secretAccessKey: 'secret',
      now: new Date('2026-06-04T00:00:00Z'),
    });
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIA_TEST\/\d{8}\/us-east-1\/ses\/aws4_request/);
    expect(headers.Authorization).toContain('SignedHeaders=');
    expect(headers.Authorization).toContain('Signature=');
    expect(headers['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/);
  });
});
