import { rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const targets = [
  resolve(root, '.astro'),
  resolve(root, 'node_modules/.vite'),
];

await Promise.all(
  targets.map(async (path) => {
    try {
      await rm(path, { recursive: true, force: true });
      console.log(`[clean-cache] removed ${path}`);
    } catch (err) {
      console.warn(`[clean-cache] skipped ${path}: ${err.message}`);
    }
  })
);
