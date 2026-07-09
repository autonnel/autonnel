import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the builder-ext virtual module to the zero-plugin baseline so tests that
// transitively import the builder sinks run without the integration Vite plugin.
const builderExtStub = {
  name: 'autonnel:builder-ext-test-stub',
  resolveId(id: string) {
    return id === 'virtual:autonnel/builder-ext' ? '\0virtual:autonnel/builder-ext' : null;
  },
  load(id: string) {
    return id === '\0virtual:autonnel/builder-ext' ? 'export const builderExtensions = [];\n' : null;
  },
};

export default defineConfig({
  plugins: [react(), builderExtStub],
  test: {
    globals: true,
    environment: 'happy-dom',
    env: {
      // Dummy connection string so the lazy PrismaPg adapter can be constructed in unit tests
      // (composition root / base client). No query is issued, so no real DB is ever contacted.
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    },
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.astro/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Task 25 coverage gate targets the P3 authoring core only. Including old
      // src/lib here would poison the global thresholds (no lib tests run in the
      // authoring-scoped coverage command), so the gate measures exactly what it asserts.
      // The P6 Payments gate lives in vitest.payments.config.ts to avoid cross-poisoning
      // this authoring-scoped include with payments source (and vice versa).
      include: ['src/modules/authoring/{domain,application}/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.astro',
        // ports.ts is a pure type-only contract (interfaces); v8 reports it as 0%
        // because there is nothing to execute. Excluding it keeps the gate meaningful.
        'src/modules/authoring/application/ports.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
