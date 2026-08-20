<h1 align="center">Autonnel</h1>

<p align="center">
  <b>The open-source ClickFunnels alternative.</b><br/>
  Self-hosted landing, checkout and upsell pages, generated from a prompt.
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
  <a href="https://www.npmjs.com/package/autonnel"><img alt="npm" src="https://img.shields.io/npm/v/autonnel.svg"></a>
  <a href="https://github.com/autonnel/autonnel/pkgs/container/autonnel"><img alt="Docker image" src="https://img.shields.io/badge/ghcr.io-autonnel-2496ed.svg"></a>
  <a href="https://autonnel.com/docs"><img alt="Docs" src="https://img.shields.io/badge/docs-autonnel.com-111.svg"></a>
</p>

<p align="center">
  <a href="https://autonnel.com">Website</a> ·
  <a href="https://autonnel.com/docs/getting-started/quick-start">Quick start</a> ·
  <a href="https://autonnel.com/docs">Docs</a> ·
  <a href="https://autonnel.com/open-source-clickfunnels-alternative">Why not ClickFunnels</a> ·
  <a href="https://github.com/autonnel/autonnel/discussions">Discussions</a>
</p>

---

Autonnel is a funnel builder you run yourself. It renders the whole money path -
landing page, order form, order bumps, one-click upsells, thank-you page - runs
A/B tests across entire funnels, sends server-side conversion postbacks that
survive iOS tracking loss, and writes every order back to Shopify, WooCommerce or
[Picocart](https://github.com/autonnel/picocart).

Apache-2.0, no commercial-use carve-out, no per-contact fee, no per-funnel fee.
Your orders and customer data live in a Postgres database you control.

### Describe a page, get a page

<p align="center">
  <img src="./docs/media/ai-page-generation.gif" alt="Typing a prompt in the Autonnel editor and watching it compose a landing page from real components" width="680">
</p>

The agent composes real components onto the canvas, generates the imagery, and
leaves every edit as diffable JSON. No black-box HTML blob.

### Wire the funnel, publish it

<p align="center">
  <img src="./docs/media/funnel-builder.gif" alt="Building a multi-step funnel in the Autonnel editor and publishing it" width="680">
</p>

## Why people switch

| | Autonnel | Hosted funnel platforms |
| --- | --- | --- |
| Licence | Apache-2.0, OSI-approved, no agency restriction | Proprietary |
| Price | $0 self-hosted. Managed cloud from $29/mo + 1% GMV | $97-$297/mo, per-contact limits |
| Where orders live | Your Postgres | Their platform |
| If you stop paying | Nothing stops - it is the same code | Funnels go offline |
| Ad attribution | Server-side postbacks, click id carried through checkout | Pixel and integration based |
| Agents | MCP server + Claude skills in the box: an agent can read and write funnels, pages and orders | Not exposed |
| Catalog | Shopify, WooCommerce or Picocart as source of truth | Built into their platform |

Longer, and more honest about where the hosted platforms win:
[Autonnel vs ClickFunnels](https://autonnel.com/vs/clickfunnels) ·
[vs CartFlows](https://autonnel.com/vs/cartflows) ·
[vs systeme.io](https://autonnel.com/vs/systeme-io) ·
[licences compared](https://autonnel.com/open-source-funnel-builders-compared)

## Table of contents

- [Run it (about 2 minutes)](#run-it-about-2-minutes)
- [Run it from source](#run-it-from-source)
- [Configuration](#configuration)
- [Deploy to Cloudflare Workers](#deploy-to-cloudflare-workers)
- [CLI](#cli)
- [Supported providers](#supported-providers)
- [License](#license)

Autonnel is a self-hostable application. Run the Docker image (below) if you just
want the product, or clone the repository if you intend to modify Autonnel itself
and deploy it to Node or Cloudflare Workers.

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

## Run it from source

Use this path when you intend to modify Autonnel itself, or want to deploy to
Cloudflare Workers. Requires Node 22+ and a PostgreSQL database.

```bash
npm create autonnel@latest my-funnel   # clones this repository, drops git history
cd my-funnel
cp .env.example .env                   # set DATABASE_URL and ADMIN_DOMAIN
pnpm install                           # this repository is pnpm-managed
npm run db:push
npm run dev
```

The repository ships `pnpm-lock.yaml` and pins dependency overrides in
`pnpm-workspace.yaml`, so install with pnpm 10+. `npm install` resolves a
different tree and ignores those pins.

For running Autonnel as a product, prefer the Docker path above: it needs no Node
toolchain and no external database.

## Configuration

Autonnel reads two kinds of configuration. Environment holds only operational
settings; everything else lives in the admin UI and is stored in the database.

```bash
DATABASE_URL="postgresql://user:password@host:5432/db"  # required
ADMIN_DOMAIN="admin.example.com"      # hostnames serving the admin UI
AUTH_SESSION_SECRET="..."             # required in production, openssl rand -hex 32
CREDENTIALS_ENCRYPTION_KEY="..."      # required in production, openssl rand -base64 32
CRON_KEY="..."                        # optional, protects the HTTP cron endpoints
LOG_LEVEL=info                        # optional: debug | info | warn | error
DEFAULT_CURRENCY=USD                  # optional storefront fallback
REDIS_URL="redis://..."               # optional, Node only; Workers use KV
```

Payment providers, email transport, ecommerce adapter, S3 storage, LLM keys, ad
platforms, branding and domains are all configured under **Settings** in the
admin UI, per install. Full reference:
[Configuration](https://autonnel.com/docs/getting-started/configuration).

Custom auth and OAuth ad flows are available through plugins
(e.g. `@autonnel/plugin-oauth2`, `@autonnel/plugin-ads`).

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

Run these from inside a source checkout (they use that project's `.env` and
database):

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

## Agents and the MCP server

Autonnel exposes its own surface to agents rather than hiding it. A scoped Bearer
key plus the built-in MCP server lets an agent list funnels, create and edit
pages, and read orders directly; the `SKILL.md` files ship in the box so Claude
picks up the workflows without extra prompting.

- [External API overview](https://autonnel.com/docs/api/overview)
- [MCP server](https://autonnel.com/docs/api/mcp)
- [SKILL.md reference](https://autonnel.com/docs/api/skill-docs)

## Project family

- [autonnel](https://github.com/autonnel/autonnel) - this repository, the funnel builder
- [picocart](https://github.com/autonnel/picocart) - open-source headless commerce backend, Shopify-API compatible
- [plugin-oauth2](https://github.com/autonnel/plugin-oauth2) - OAuth/OIDC login provider
- [plugin-ads](https://github.com/autonnel/plugin-ads) - ad-platform OAuth connectors

## Contributing

Issues and pull requests are welcome. Start with
[CONTRIBUTING.md](./CONTRIBUTING.md), and use
[Discussions](https://github.com/autonnel/autonnel/discussions) for questions and
ideas. If Autonnel is useful to you, a star helps other people find it.

## License

Apache-2.0, see [LICENSE](./LICENSE). No commercial-use restriction and no
separate agency tier: run it for yourself, for clients, or inside a paid service.
