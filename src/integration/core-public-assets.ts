import { cpSync, existsSync, readdirSync, statSync, createReadStream } from "node:fs";
import { extname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Astro only serves the consumer's own publicDir, so the core's static files (storefront.css, template
// thumbnails, payment badges) are copied into every deployment. The deployment's own file wins.
export function copyCorePublicAssets(corePublicDir: string, clientDir: URL | string): string[] {
  if (!existsSync(corePublicDir)) return [];
  const target = typeof clientDir === "string" ? clientDir : fileURLToPath(clientDir);
  const copied: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const from = join(dir, name);
      if (statSync(from).isDirectory()) {
        walk(from);
        continue;
      }
      const rel = relative(corePublicDir, from);
      const to = join(target, rel);
      if (existsSync(to)) continue;
      cpSync(from, to);
      copied.push(rel.split(sep).join("/"));
    }
  };
  walk(corePublicDir);
  return copied;
}

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

export function resolveCorePublicFile(corePublicDir: string, consumerPublicDir: string, urlPath: string): string | null {
  const pathname = decodeURIComponent(urlPath.split("?")[0] ?? "");
  const rel = normalize(pathname).replace(/^([/\\])+/, "");
  if (!rel || rel.startsWith("..")) return null;
  if (existsSync(join(consumerPublicDir, rel))) return null;
  const file = join(corePublicDir, rel);
  if (!file.startsWith(corePublicDir + sep) || !existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

export function corePublicAssetsVitePlugin(corePublicDir: string, consumerPublicDir: string) {
  return {
    name: "autonnel:core-public-assets",
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const file = req.url ? resolveCorePublicFile(corePublicDir, consumerPublicDir, req.url) : null;
        if (!file) return next();
        res.setHeader("Content-Type", CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}
