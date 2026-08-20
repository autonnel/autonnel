# Changelog

## 1.6.0

### Added

- **MCP server at `POST /api/mcp`.** Streamable HTTP, stateless, authenticated with the same API keys as the REST API. 20 tools covering funnels, funnel steps, pages, page templates, the product catalog, orders and reporting; 13 of them share their zod schema and handler with a `/api/v1.1/` endpoint, so the two surfaces cannot drift. Write tools require a key with `writeAccess`.
- **Write endpoints under `/api/v1.1/`** for funnels, funnel pages, pages and media, gated by `writeAccess` through a single `requireWriteAccess` check.
- **Live visitor badges in the funnel activity feed.** Truncated visitor id, a stable colour per visitor and dwell formatting, shared by the server-rendered rows and the SSE rows so both render identically.
- **Docker images are published to Docker Hub** (`autonnel/autonnel`) alongside GHCR, from the same multi-arch build.

### Fixed

- **Conversion postbacks are retried on Cloudflare deployments.** The retry sweep only ran from the `/api/cron/postbacks` HTTP endpoint, so a Workers deployment with no external scheduler never retried a failed postback. The scheduled handler now drives it.
- **Cron sweeps no longer write to KV on every tick.** The interval gate ran *inside* the distributed lock, so each job paid a KV write plus a delete on every 5-minute tick even when the interval then skipped it — a job declaring 30 minutes burned roughly 288 write/delete pairs a day to do nothing. The gate now runs before the lock, with the authoritative re-check kept under it.
- **Cached reads collapse concurrent misses.** On Cloudflare KV a read is served from a ~60s edge cache, so an expired key keeps reading as absent long after the refresh is written, and every request in that window re-ran the loader and rewrote the same value. Read-through caching is now single-flight per key (`cacheGetOrSet`), used by the API-key and RBAC lookups on the per-request auth paths.
- **Database connections no longer exhaust the Hyperdrive pool.** Concurrent Prisma queries are serialized and dashboard fan-out is bounded.
- **Outbound fetches work on workerd again.** IP pinning has no equivalent on Cloudflare Workers — there is no `node:http` and `fetch` cannot be pointed at an address — so pinning is skipped there instead of failing closed. Node keeps DNS validation plus pinning.
- **A rejected outbound URL now says which URL was rejected** instead of surfacing as a generic MCP failure.
- **Revoked API keys no longer appear in the key list.** Revocation is a soft delete; those rows are kept for auth lookups but are no longer listed as live keys.
- **Media upload fails with 412 when storage was never configured**, instead of letting blank S3 credentials reach the PUT and reading as a generic upload fault.

### Documentation

- README restructured around the two install paths: the Docker image for running the product, a source checkout for modifying Autonnel or deploying to Cloudflare Workers.

## 1.5.0

### BREAKING CHANGES

- **`domains.host` is now globally unique.** Two tenants can no longer claim the same host. `npm run db:push` cannot create the constraint while duplicates exist, so de-duplicate the `domains` table before upgrading.
- **Forwarding headers are no longer trusted by default.** Per-IP rate limiting read `x-forwarded-for` / `x-real-ip` unconditionally, so on a directly reachable deployment a client could rotate the header and get a fresh bucket per request. The source IP now comes only from what the new `TRUSTED_PROXY` env allows: `cloudflare` trusts `cf-connecting-ip`, `forwarded` trusts `x-forwarded-for`, `none` attributes nothing. Unset means trust `cf-connecting-ip` on Cloudflare Workers and nothing on other runtimes. **If you run behind your own reverse proxy, set `TRUSTED_PROXY="forwarded"`**, otherwise all traffic collapses into one shared rate-limit bucket.

### Security

Remediation of a 28-finding audit.

- **Authorization:** API keys are capped by their creator's permissions, every `/api/v1.1/` route enforces its feature grant, draft page preview requires PAGES, and invitation roles come from the invite token instead of the request body.
- **Checkout ownership:** the signed checkout session must own the sale before an upsell charge, a Stripe confirm, or buyer PII on the thank-you page. Knowing an order id was previously enough.
- **SSRF:** outbound fetches pin the connection to the address that passed validation, closing DNS rebinding between check and connect; runtimes that can neither resolve nor pin now refuse the request instead of proceeding.
- **Credential replay:** a stored LLM API key is only ever replayed to the provider, model and base URL it was stored with, so a caller cannot point the connection test at their own endpoint to read a masked key back out.
- **Tenant isolation:** RBAC cache keys and background job execution are tenant-scoped.
- **Input bounds:** the activity beacon and catalog fan-out have explicit caps, and the maintenance unlock is throttled before it reaches bcrypt.
- **Atomicity:** coupon usage increments conditionally, outbox events are claimed by lease.
- **Hygiene:** CSV export neutralizes formula injection, `/api/health` no longer returns exception detail, OAuth state is signed and single-use, and postbacks honour the recorded consent decision.

### Added

- **`CHECKOUT_COOKIE_SECRET`** (optional) signs storefront checkout cookies with a key separate from the admin session key, and falls back to `AUTH_SESSION_SECRET` when unset.
- Checkout API requests are validated at the adapter boundary.
- A versioned codec for the live cached catalog store, so a payload written by an older release is discarded rather than misread.

### Fixed

- **Fulfillment sync no longer polls dead orders forever.** An order the commerce backend never resolves (deleted upstream, or carrying a ref from a previous provider) stayed PAID and was re-polled on every tick, costing one upstream API call each time. The sweep now only considers orders created within the last 30 days.

### Documentation

- README rewritten with demo GIFs.
- `TRUSTED_PROXY` and `CHECKOUT_COOKIE_SECRET` documented in `.env.example`.

## 1.4.0

### BREAKING CHANGES

- **Funnel redirect URL changed:** `/go/{funnelId}/{slug}` is now `/n/{funnelId}/{slug}`. Any landing-page CTAs hard-coded with the old prefix in custom HTML need to be re-pointed. The funnel validator surfaces broken links in the funnel admin page.
- **DB field renamed:** `FunnelPage.goSlug` -> `FunnelPage.stepSlug` (column `go_slug` -> `step_slug`). External API responses and request bodies now use `stepSlug`. Run `npm run db:push` after upgrade to apply the column rename.
- **Service exports renamed:** `getFunnelGoUrlForPage` -> `getFunnelStepUrlForPage`, `getFunnelGoUrlForPageInFunnel` -> `getFunnelStepUrlForPageInFunnel`. Return keys `goUrl` -> `stepUrl`, `currentGoSlug` -> `currentStepSlug`.

### Added

- **`docker-compose.yml`**: one command brings up Postgres, applies the schema and starts Autonnel on port 4321. No Node toolchain, no external database, no S3 bucket, no email provider needed to boot. This is now the recommended way to run Autonnel.

### Fixed

- **The published container image could not start.** `react` and `react-dom` were declared as devDependencies, so the production image (built with `pnpm install --prod`) shipped without them and the server crashed at boot with `Cannot find package 'react'`. Both are now runtime dependencies. Images built before this release are affected.

### Documentation

- README rewritten around running Autonnel as an application, with the Docker path first.
- Removed references to the `autonnel-cli` npm package, which was never published, and to the `autonnel-deploy-example` repository, which does not exist. Scaffolding is `npm create autonnel@latest`, which clones this repository; the docs now describe what it actually does instead of an interactive wizard that does not exist.
- Docker examples now use image tags that exist (`:latest`, `:1.3.0`, `:1.3`, `:1`) instead of `:0.1.0`.
- Documented how to apply schema changes in a Docker deployment, and how to run the CLI (`admin:create`, `password:reset`) inside a container.

### Tests

- `tests/unit/cli/create.test.ts` still tested `detectPackageManager` and `buildCreateCommand`, two functions that were removed when the scaffolder was reduced to a shallow clone. Every release build failed on them, which is why `v1.3.1` and `v1.3` never produced a container image. The suite now covers what `runCreate` actually does.

### CI

- The `latest` tag is now published on tag builds. Previously `latest` was gated on `is_default_branch`, which is false during a tag push, so `latest` never moved past the first image that was pushed.
