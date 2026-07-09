# Autonnel

**[autonnel.com](https://autonnel.com)** · [Docs](https://autonnel.com/docs) · [npm](https://www.npmjs.com/package/autonnel)

Open-source AI-native funnel builder for e-commerce, distributed as an Astro Integration.

Autonnel ships pages, components, prisma schema, and adapters for payments,
email, and e-commerce platforms. Drop the integration into any Astro
project and you get an admin UI plus a customer-facing storefront with
checkout, upsells, page editing, and order management.

## Quick start

Scaffold a new project with the interactive wizard. All three commands run the
exact same wizard (it lives in the standalone
[`autonnel-cli`](https://www.npmjs.com/package/autonnel-cli) package and
downloads the official
[deploy template](https://github.com/autonnel/autonnel-deploy-example) from
GitHub) — pick whichever fits your habit:

```bash
npm create autonnel@latest       # npm-convention entry (recommended)
npx autonnel-cli create          # standalone CLI, explicit form
npx autonnel create              # via this package's bin — delegates to the same wizard
```

The wizard asks for a project name, deployment target (Node / Cloudflare
Workers / Docker), PostgreSQL connection string, and admin hostname, writes
them into `.env`, and optionally installs dependencies. Then:

```bash
cd my-funnel
npm install                      # if you skipped the wizard's install step
cp .env.example .env             # if you skipped the wizard's env step
# edit .env: DATABASE_URL is the only strictly required variable
npm run db:push
npm run dev
```

The scaffolder creates a thin Astro shell with `autonnel` already wired up.
The admin UI is served on `http://localhost:3000`; on first visit you are
redirected to the `/setup` wizard to create the admin account. Provider
credentials (S3, payment, email, ecommerce, LLM, ads) are configured in the
admin UI under **Settings**, not in `.env`.

## Manual integration

If you have an existing Astro project, install autonnel and add the integration.

```bash
npm install autonnel @astrojs/node @prisma/client prisma
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import autonnel from 'autonnel';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [autonnel()],
});
```

The package's `prisma/schema.prisma` must be available to your project's
Prisma client. The recommended pattern is a `prisma.config.ts` that points
`schema` at `node_modules/autonnel/prisma/schema.prisma` directly — the
scaffolder generates this config for you. Run `npm run db:push` to sync
schema state to your database.

## Run with Docker

Official multi-arch images (`linux/amd64`, `linux/arm64`) are published to GHCR on every release:

```bash
docker run -p 4321:4321 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/autonnel" \
  -e ADMIN_DOMAIN="admin.example.com" \
  -e AUTH_SESSION_SECRET="$(openssl rand -hex 32)" \
  -e CREDENTIALS_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  ghcr.io/autonnel/autonnel:latest
```

`AUTH_SESSION_SECRET` and `CREDENTIALS_ENCRYPTION_KEY` are required whenever
`NODE_ENV` is not `development`/`test` — generate each once and keep them
stable across restarts (rotating them invalidates sessions and stored
provider credentials).

Available tags:
- `:latest` — most recent stable release
- `:0.1.0` — pinned exact version (recommended for production)
- `:0.1` — auto-update on patches
- `:0` — auto-update on minor + patches

The container exposes port 4321 and includes a `HEALTHCHECK` that hits `/api/health` (database + cache connectivity).

## Deploy to Cloudflare Workers

The scaffolded project ships the full Workers toolchain: a worker entry with
the cron `scheduled` handler (`src/cf-worker.ts`), `wrangler.toml` generation,
KV cache wiring, and Hyperdrive for Postgres. Static assets are unmetered, so
typical funnels run within Cloudflare's free tier.

One-time setup from the project directory:

```bash
npx wrangler login
npx wrangler kv namespace create CACHE_KV
npx wrangler hyperdrive create autonnel-db --connection-string="postgresql://..."
# .env: set CF_WORKER_NAME, CF_KV_NAMESPACE_ID, CF_HYPERDRIVE_CONFIG_ID
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SESSION_SECRET
npx wrangler secret put CREDENTIALS_ENCRYPTION_KEY
# repeat for ADMIN_DOMAIN and any other production env vars
```

Then:

```bash
npm run deploy:cf    # generates wrangler.toml, builds, and deploys
```

Also available: `npm run dev:cf` (dev server on the Workers runtime) and
`npm run preview:cf` (local preview via `wrangler dev`). `wrangler.toml` is
generated from `wrangler.toml.template`; cron triggers are read from the
installed autonnel package, so they stay in sync when you upgrade.

## Configuration

```ts
import autonnel from 'autonnel';

autonnel({
  paymentProviders: ['paypal', 'stripe'],
  emailProvider: 'resend',
  ecommerceAdapter: 'shopify',
  hooks: {
    onOrderCreated: async (ctx, order) => {
      // ship to your downstream system
    },
  },
});
```

### `AutonnelOptions`

| Option             | Type                            | Description                                              |
|--------------------|---------------------------------|----------------------------------------------------------|
| `paymentProviders` | `('paypal' \| 'stripe')[]`      | Enabled payment providers                                |
| `emailProvider`    | `'smtp' \| 'resend'`            | Outbound email transport                                 |
| `ecommerceAdapter` | `'shopify' \| 'woocommerce'`    | Source of truth for products and orders                  |
| `hooks`            | `Partial<Hooks>`                | Lifecycle hooks (`onOrderCreated`, `onSiteCreated`, ...) |

Advanced extension points such as custom auth are available through plugins
(e.g. `@autonnel/plugin-oauth2`).

## CLI

```
npx autonnel create [project-name]                Scaffold a new project (runs the autonnel-cli wizard)
npx autonnel admin:create <email> <password>      Create (or grant) a full-access admin user
npx autonnel password:reset <email>               Reset a user's password (auto-generated)
npx autonnel authorize                            Authorize this machine against the marketplace
npx autonnel orders                               List purchased plugins and template packs
npx autonnel install <item>                       Download and install a purchased pack
npx autonnel --version / --help
```

`create` delegates to the [`autonnel-cli`](https://www.npmjs.com/package/autonnel-cli)
wizard (also reachable as `npm create autonnel@latest`). Every other command
runs against the project's own `.env`, database, and installed autonnel
version, so invoke it from inside the project directory. The standalone
`npx autonnel-cli <command>` forms are equivalent — they locate the nearest
project install and hand over to it.

## Supported providers

- **Payments**: PayPal, Stripe
- **Email**: SMTP, AWS SES, Resend
- **E-commerce**: Shopify, WooCommerce, Picocart (Autonnel's built-in, self-hostable commerce backend — a drop-in alternative to Shopify/WooCommerce)

## Runtime support

Both Node.js (`@astrojs/node`) and Cloudflare Workers (`@astrojs/cloudflare`)
adapters are supported. The scaffolded template includes config for both.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
