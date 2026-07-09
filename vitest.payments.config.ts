import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dedicated coverage gate for the P6 Payments module. The shared vitest.config.ts
// scopes coverage.include to the authoring module; reusing it (even via mergeConfig,
// which concatenates arrays) leaves the authoring source at 0% in a payments-only run
// and fails the global thresholds. This standalone config scopes coverage to payments
// domain+application only, so the Task 17 gate measures exactly what it asserts.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    env: {
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
      reporter: ['text', 'json-summary'],
      include: ['src/modules/payments/{domain,application}/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.astro',
        // Pure type-only port contracts (interfaces only); v8 reports them as 0%
        // because there is nothing to execute. Excluding keeps the gate meaningful.
        'src/modules/payments/application/ports/inbound.ts',
        'src/modules/payments/application/ports/outbound.ts',
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
