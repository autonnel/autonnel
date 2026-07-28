# Changelog

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
