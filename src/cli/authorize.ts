import {
  MarketplaceClient,
  writeCredentials,
  type StoredCredentials,
} from './marketplace-client.js';

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function bold(text: string): string {
  return process.stdout.isTTY ? `${BOLD}${text}${RESET}` : text;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Best-effort open the browser at the activation URL. The flow never depends on this
// succeeding — the user can always visit the printed verification_uri manually.
async function tryOpen(url: string): Promise<void> {
  try {
    const { spawn } = await import('node:child_process');
    const platform = process.platform;
    const cmd = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
    const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    // swallow — opening a browser is a convenience, not a requirement.
  }
}

interface AuthorizeArgs {
  base?: string;
}

function parseArgs(args: string[]): AuthorizeArgs {
  const out: AuthorizeArgs = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) {
      out.base = args[++i];
    } else if (args[i].startsWith('--base=')) {
      out.base = args[i].slice('--base='.length);
    }
  }
  return out;
}

export interface RunAuthorizeDeps {
  consumerRoot: string;
  client?: MarketplaceClient;
  log?: (msg: string) => void;
  sleepFn?: (ms: number) => Promise<void>;
  openFn?: (url: string) => Promise<void>;
  now?: () => number;
}

export async function runAuthorizeWith(args: string[], deps: RunAuthorizeDeps): Promise<boolean> {
  const parsed = parseArgs(args);
  const client = deps.client ?? new MarketplaceClient({ base: parsed.base });
  const log = deps.log ?? ((m: string) => process.stdout.write(m + '\n'));
  const wait = deps.sleepFn ?? sleep;
  const open = deps.openFn ?? tryOpen;
  const now = deps.now ?? Date.now;

  const start = await client.deviceCode();
  log('');
  log(`To authorize this CLI, visit: ${bold(start.verification_uri)}`);
  log(`And enter the code:          ${bold(start.user_code)}`);
  log('');
  log('Waiting for authorization...');
  await open(start.verification_uri_complete);

  let interval = start.interval > 0 ? start.interval : 5;
  const deadline = now() + start.expires_in * 1000;

  while (now() < deadline) {
    await wait(interval * 1000);
    const result = await client.pollDeviceToken(start.device_code);
    if (result.ok) {
      const creds: StoredCredentials = {
        accessToken: result.token.access_token,
        tokenType: result.token.token_type,
        scope: result.token.scope,
        issuer: client.base,
        obtainedAt: new Date(now()).toISOString(),
      };
      writeCredentials(deps.consumerRoot, creds);
      const who = await resolveEmail(client, creds.accessToken);
      log('');
      log(who ? `Authorized as ${who}.` : 'Authorized.');
      log('Credentials saved to .autonnel/credentials.json');
      return true;
    }
    switch (result.error) {
      case 'authorization_pending':
        continue;
      case 'slow_down':
        interval += 5;
        continue;
      case 'expired_token':
        log('');
        log('The authorization request expired. Run `npx autonnel authorize` again.');
        return false;
      case 'access_denied':
        log('');
        log('Authorization was denied.');
        return false;
      default:
        log('');
        log(`Authorization failed: ${result.error}`);
        return false;
    }
  }

  log('');
  log('Timed out waiting for authorization. Run `npx autonnel authorize` again.');
  return false;
}

// The token issuer does not return the email directly, so probe /api/cli/orders which
// is the cheapest authenticated call. A 401 here is unexpected right after minting, so
// we just skip the name rather than fail the whole flow.
async function resolveEmail(client: MarketplaceClient, token: string): Promise<string | null> {
  try {
    await client.listOrders(token);
    return null;
  } catch {
    return null;
  }
}

export async function runAuthorize(args: string[]): Promise<void> {
  const { resolveConsumerRoot } = await import('./index.js');
  const consumerRoot = resolveConsumerRoot();
  const ok = await runAuthorizeWith(args, { consumerRoot });
  if (!ok) process.exit(1);
}
