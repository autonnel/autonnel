# Changelog

## Unreleased

### BREAKING CHANGES

- **Funnel redirect URL changed:** `/go/{funnelId}/{slug}` is now `/n/{funnelId}/{slug}`. Any landing-page CTAs hard-coded with the old prefix in custom HTML need to be re-pointed. The funnel validator surfaces broken links in the funnel admin page.
- **DB field renamed:** `FunnelPage.goSlug` → `FunnelPage.stepSlug` (column `go_slug` → `step_slug`). External API responses and request bodies now use `stepSlug`. Run `npm run db:push` after upgrade to apply the column rename.
- **Service exports renamed:** `getFunnelGoUrlForPage` → `getFunnelStepUrlForPage`, `getFunnelGoUrlForPageInFunnel` → `getFunnelStepUrlForPageInFunnel`. Return keys `goUrl` → `stepUrl`, `currentGoSlug` → `currentStepSlug`.
