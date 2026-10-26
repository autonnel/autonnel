# Changelog

## 1.7.0

### Upgrading

- **Run `db:push` (or the Docker `schema` service).** New tables `AdCreative`, `AdDailyMetric`, `AdSyncRun` and `PageEngagement`, plus new nullable columns on users, payment intents and ad account connections.
- **Node / Docker installs now run scheduled tasks.** See "Scheduled tasks run on Node" below.
- **`@autonnel/plugin-ads` is retired.** Ad-platform OAuth and ad data are built in; remove the plugin from your plugin list.

### Added

- **Ad spend sync and funnel reconciliation.** Connect Meta, Google Ads or TikTok under Settings → Ads (your own OAuth app, or the hosted relay for Meta and Google Ads). Spend, impressions, link clicks, checkouts and conversions are pulled hourly per ad, attributed to a funnel by the ad's landing-page path, and compared with on-site visitors, checkouts, orders and revenue at `/analytics/ads` and in each funnel's analytics. Ads whose URL matches no funnel or several funnels can be assigned by hand. Bing is not covered.
- **Custom events.** `data-autonnel-event="name"` on any clickable element, or `window.autonnel?.track(name, metadata)`, records an event that shows under its funnel step in Analytics.
- **Interest panel** at `/analytics/interest`: visitors per page grouped by scroll depth and time on page, with deep links to each depth.
- **Ad parameters survive every link.** All outbound links, GET forms and common `data-url`-style attributes on customer pages carry the current URL's query parameters, including cross-origin links and script-driven redirects, so click IDs are not lost between pages.
- **Checkout preselection** with `?variant=<id>[,<id>]` on checkout pages.
- **Page language and currency** settings for checkout pages; prices and coupons follow the page currency.
- **Discourage search engines** toggle under Settings → Domains (`robots.txt`, `X-Robots-Tag` and a robots meta tag).
- **Admin sessions that expire** send the user back to the login page instead of showing a bare error.

- **Payment gateways from plugins.** `paymentProviders` is now a working extension point (`PluginPaymentProvider`: a settings/UI `registration` plus `create(config, runtime)` returning a `PaymentProviderPort`). Plugin gateways appear on `/payment`, in the checkout payment form as a pay button, and can redirect the buyer to a hosted payment page. New routes `GET /api/shop/payment/return/:provider` and `POST /api/shop/payment/webhook/:provider` finish hosted-page payments; the return redirect, the provider notification and the 10-minute reconcile cron share one completion path that publishes `payment.captured` exactly once. Gateways that implement `chargeOffSession` get one-click upsells through a new provider-agnostic `PaymentIntent.vaultRef`. Settings forms gain a `textarea` field type and `secret` flag. See PLUGIN.md.

- **Cloudflare Workers AI models.** Settings → LLM → Cloudflare Workers AI, for text (including the page-builder and analyst agents) and image models. Transport is chosen per model row: the Worker's `AI` binding (no credentials, the deploying account only; the `[ai]` block in `wrangler.toml.template` is commented out because it makes `wrangler dev` require Cloudflare credentials), or the REST API with an account-scoped base URL and an API token, which works on Node and for any Cloudflare account. Image models are text-to-image only; FLUX models that reject `width`/`height` are retried without them. There are no Workers AI video models.

- **Cloudflare Email provider.** Settings → Email Provider → Cloudflare Email sends through the Workers `send_email` binding (`EMAIL`, now declared in `wrangler.toml.template`) or, on Node, through the Cloudflare REST API with an account ID and API token. There are no delivery webhooks, so bounces do not reach the suppression list. On Workers the SMTP option is hidden and rejected by the API, since Workers cannot open SMTP connections.

- **Plugins can react to paid orders.** New `AutonnelPlugin` members: `onConversion` (fired on payment capture and on each Stripe upsell charge, with the buyer's visited URLs for click-id lookup), `jobHandlers` (plugin jobs on the core Job queue with retry and backoff) and `settingsPanels` (a core-rendered configured-card form at `/settings/plugins/<id>` with a delivery log). See PLUGIN.md.
- **Scheduled tasks run on Node.** The production Node server now runs the same 5-minute tick as the Workers cron trigger (recall emails, fulfillment sync, postback retries, the job queue, ad insights, cleanup), started by the first request. It is on unless `NODE_ENV` is `development` or `test` (the rule that already makes the secrets mandatory); `AUTONNEL_SCHEDULER=off|on` overrides. **Behaviour change for Docker / Node installs:** these tasks never ran there before, so anything already enabled starts acting after the upgrade. With several replicas, share `REDIS_URL` or leave the scheduler on for one replica only.
- **Plugin crons.** `crons: [{ name, intervalMs, run }]` run as isolated, locked, interval-gated sweeps once per 5-minute tick: on Workers only on the `*/5` invocation (so a minute matching several triggers still runs each once), on Node from the in-process scheduler, and on demand via `POST /api/cron/plugins`.
- **Plugins work in the production server.** The build-time plugin registry never reached the server bundle, so plugin hooks, panels, jobs and crons were live only in `astro dev`. The new `pluginsModule` integration option (a module exporting `createPlugins()`) makes the server re-register the same list at startup, on Node and on Workers (both the request and the `scheduled` path).
- **`autonnel/node` build preset** (`defineAutonnelNodeConfig`) for overlay deployments on Node: bundles the core's dependencies so the deployment only needs `sharp` and its own `@prisma/client`.
- **Plugin tables.** A plugin's `schemaExtension` (new models / enums only, each with `tenantId`, no references to core models) is validated at registration and merged into a multi-file schema by the new `autonnel schema:compose` command; `runtime.model(name)` gives the plugin a tenant-scoped delegate of its own models only.
- **Plugin runtime cache and payment config.** `runtime.cache` is a plugin and tenant scoped key-value cache (Workers KV on Cloudflare, Redis or memory on Node); `runtime.paymentConfig(slug)` returns the decrypted config of a payment provider the plugin registered, so crons and jobs can call the gateway outside a payment request. See PLUGIN.md.
- **`autonnel/cloudflare` build preset** for overlay deployments: the workerd build fixes live in one place (`src/integration/cloudflare-base.ts`) instead of being copied into each deployment's Astro config.

### Fixed

- **One-click upsells failed on the upsell page.** The checkout orchestrator also runs on upsell pages and, when the URL carried `?variant=`, opened a new checkout session whose cookie replaced the one that paid the first order, so `/api/shop/upsell` answered 403. Upsell pages no longer sync a cart or open a session.
- **Upsell button reported "Missing order information" for buyers who arrived without `?anid`.** It only read the tracking id from the URL; it now falls back to the server-resolved id and the `anid` cookie, the same chain as the behavior tracker.
- **Deferred work threw "Illegal invocation" on Workers.** `waitUntil` was called detached from the execution context, so any job enqueue that drains in the background (for example the merged commerce push after an upsell) failed until the sweep cron picked it up.
- **Paid checkouts were not suppressed from recall emails.** The suppression upsert left `tenantId` out of its compound key and was rejected on every `payment.captured`.
- **A provider error on a hosted-payment return showed a 500.** The return and upsell-return routes now keep the buyer on the waiting page while retrying, then send them back to checkout; the reconcile cron still settles the payment.
- **Refund rows recorded every refund as Stripe.** The reserved refund transaction now takes its provider from the parent payment intent.
- **Reconcile could starve on abandoned payments.** Pending intents are polled oldest first, and intents left in `PROCESSING` for 24 hours are canceled.
- **AI chat agents used the model row's display name as the model ID.** The page-builder, GrapesJS and analyst agents sent `name` instead of `modelId`, and picked the Anthropic protocol only when the base URL contained `/anthropic`, so an `anthropic-messages` row pointing at `https://api.anthropic.com` was called as an OpenAI endpoint.
- **Settings → LLM "+ Add Image Model" / "+ Add Video Model" opened the drawer as a text model.** The model was then saved under Text Models; the drawer now starts with the type and default provider of the table it was opened from.
- **Email provider edits keep the stored secret.** Saving the form with the password / API key left blank (as the placeholder says) overwrote the stored secret with an empty string.

- **New funnels could not be checked out.** Funnel snapshots are now published on every step edit, and republished on demand when a checkout finds none.
- **Page clone (Import from URL) broke some sites.** Rehosted assets drop their SRI hashes, relative CSS `url()`s are made absolute, and server-rendered pages are cloned from the raw HTML.
- **GrapesJS component reset dropped `#id` style rules.**
- **The storefront bundle loaded the Puck editor runtime**, which also failed on Workers.

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
