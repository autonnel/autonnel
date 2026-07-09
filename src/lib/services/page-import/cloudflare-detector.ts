const TITLE_MARKERS = [
  '<title>Just a moment...</title>',
  '<title>Just a moment…</title>',
];

const CLASS_MARKERS = [
  'class="cf-browser-verification"',
  'class="cf-injected-html"',
];

const TEXT_MARKERS = [
  'Checking your browser before accessing',
];

const META_REFRESH_RE = /<meta\s+http-equiv=["']refresh["'][^>]*__cf_chl_tk/i;

const CF_WRAPPER_RE = /id=["']cf-wrapper["']/;
const CF_WRAPPER_MAX_BYTES = 50 * 1024;

export function isCloudflareChallenge(html: string): boolean {
  if (!html) return false;

  for (const m of TITLE_MARKERS) {
    if (html.includes(m)) return true;
  }
  for (const m of CLASS_MARKERS) {
    if (html.includes(m)) return true;
  }
  for (const m of TEXT_MARKERS) {
    if (html.includes(m)) return true;
  }

  if (META_REFRESH_RE.test(html)) return true;

  if (CF_WRAPPER_RE.test(html) && html.length < CF_WRAPPER_MAX_BYTES) return true;

  return false;
}
