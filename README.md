# Autonnel

**[autonnel.com](https://autonnel.com)** · [Docs](https://autonnel.com/docs) · [npm](https://www.npmjs.com/package/autonnel)

Open-source, AI-native funnel builder for e-commerce. Build landing, checkout and
upsell pages, run A/B tests on whole funnels, and keep server-side ad attribution
working after iOS. Self-hosted, Apache-2.0, your orders and customer data stay in
your own database.

Autonnel ships two ways: as a **self-hostable application** (Docker image, below)
and as an **Astro integration** (npm package) you can drop into an existing Astro
project.

## Run it (about 2 minutes)

```bash
curl -O https://raw.githubusercontent.com/autonnel/autonnel/master/docker-compose.yml
docker compose up
```

Open <http://localhost:4321> and complete the `/setup` wizard to create the admin
account. That is the whole setup.

The compose file starts Postgres, applies the schema, and runs Autonnel. You do
**not** need Node, an external database, an S3 bucket, an email provider or a
store connected to boot it. Those are configured later in the admin UI under
**Settings**, and only for the features that use them:

| You want | Configure in Settings |
| --- | --- |
| Product and order data | Ecommerce: Shopify, WooCommerce or Picocart |
| Taking payments | Payments: Stripe or PayPal |
| Media uploads | Storage: any S3-compatible bucket (R2, S3, MinIO, ...) |
| Receipts, recall emails | Email: SMTP, Resend or AWS SES |
| AI page generation | LLM: any OpenAI-compatible endpoint |

Before putting it on a public host, set your own secrets in a `.env` file next
to `docker-compose.yml`:

```bash
AUTH_SESSION_SECRET=$(openssl rand -hex 32)
CREDENTIALS_ENCRYPTION_KEY=$(openssl rand -base64 32)
ADMIN_DOMAIN=admin.example.com
```

Both are required whenever `NODE_ENV` is not `development`/`test`, which is the
case inside the published image. The compose file ships insecure development
defaults so that the first run needs zero configuration. Generate each value once
and keep it stable: rotating them invalidates sessions and makes stored provider
credentials unreadable.

### Container image

Multi-arch images (`linux/amd64`, `linux/arm64`) are published to GHCR:

```bash
docker run -p 4321:4321 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/autonnel" \
  -e ADMIN_DOMAIN="admin.example.com" \
  -e AUTH_SESSION_SECRET="$(openssl rand -hex 32)" \
  -e CREDENTIALS_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  ghcr.io/autonnel/autonnel:latest
```

Tags: `:latest` (most recent stable), `:1.3.0` (exact version, recommended for
production), `:1.3` (auto-update on patches), `:1` (auto-update on minor and
patches). The container listens on 4321 and has a `HEALTHCHECK` against
`/api/health` (database plus cache connectivity).

Schema changes ship with the image. After pulling a newer tag, apply them with:

```bash
docker compose up -d           # the one-shot `schema` service re-runs on every up
# or, for a plain `docker run` setup:
docker run --rm ghcr.io/autonnel/autonnel:latest \
  node_modules/.bin/prisma db push --schema=./prisma/schema.prisma \
  --url "postgresql://user:pass@host:5432/autonnel"
```

The image does not ship `prisma.config.ts`, so Prisma reads the datasource from
`--url` rather than from `DATABASE_URL`.

## Use it as an Astro integration

If you already have an Astro project, install the package and register the
integration:

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

The package's `prisma/schema.prisma` must be reachable by your project's Prisma
client. The recommended pattern is a `prisma.config.ts` pointing `schema` at
`node_modules/autonnel/prisma/schema.prisma`. Then `npm run db:push` and start
your dev server. Full walkthrough: [Manual integration](https://autonnel.com/docs/getting-started/manual-integration).

`npm create autonnel@latest my-funnel` is also available. It clones this
repository into `my-funnel` as a starting point, which is useful if you intend to
modify Autonnel itself. For running Autonnel as a product, prefer the Docker path
above; for embedding it in your own app, prefer the integration.

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

## Deploy to Cloudflare Workers

Static assets are unmetered on Workers, so typical funnels run within
Cloudflare's free tier. The repository ships the full Workers toolchain: a worker
entry with the cron `scheduled` handler (`src/cf-worker.ts`), `wrangler.toml`
generation, KV cache wiring and Hyperdrive for Postgres.

```bash
npx wrangler login
npx wrangler kv namespace create CACHE_KV
npx wrangler hyperdrive create autonnel-db --connection-string="postgresql://..."
# .env: set CF_WORKER_NAME, CF_KV_NAMESPACE_ID, CF_HYPERDRIVE_CONFIG_ID
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SESSION_SECRET
npx wrangler secret put CREDENTIALS_ENCRYPTION_KEY
npm run deploy:cf
```

Also available: `npm run dev:cf` (dev server on the Workers runtime) and
`npm run preview:cf` (local preview via `wrangler dev`).

## CLI

Run these from inside a project that has `autonnel` installed (they use that
project's `.env` and database):

```
npx autonnel admin:create <email> <password>      Create (or grant) a full-access admin user
npx autonnel password:reset <email>               Reset a user's password (auto-generated)
npx autonnel authorize                            Authorize this machine against the marketplace
npx autonnel orders                               List purchased plugins and template packs
npx autonnel install <item>                       Download and install a purchased pack
npx autonnel --version / --help
```

In a Docker deployment, run them inside the container:

```bash
docker compose exec app node dist/cli/index.js admin:create you@example.com 'a-strong-password'
```

## Supported providers

- **Payments**: PayPal, Stripe
- **Email**: SMTP, AWS SES, Resend
- **E-commerce**: Shopify, WooCommerce, Picocart (Autonnel's own self-hostable
  commerce backend, a drop-in alternative to Shopify/WooCommerce)

## Runtime support

Node.js (`@astrojs/node`) and Cloudflare Workers (`@astrojs/cloudflare`).

## License

Apache-2.0, see [LICENSE](./LICENSE).
