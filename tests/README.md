# Tests

Test suite for autonnel. Runs on Vitest.

## Layout

```
tests/
├── smoke/       # Fast regression guards used during the refactor.
│                # These exercise pure functions (no DB, no network).
│                # Every smoke test MUST stay green across all refactor phases.
├── unit/        # Unit tests for individual modules (Phase 6 target).
└── integration/ # Tests that exercise multiple modules together (Phase 6).
```

## Running

```bash
npm test                  # one-off run
npm run test:watch        # watch mode while developing
npm run test:coverage     # with coverage report
```

Or use the verify script: `bash scripts/verify/check-tests.sh`.

## Writing tests during the refactor

1. **Smoke tests** are refactor-invariant. Test the *contract* (what the
   function returns for input X), not implementation details or strings
   that will change during rename.
2. **Unit tests** attached to an adapter live next to the adapter (e.g.
   `src/lib/adapters/cache/redis.test.ts`) or under
   `tests/unit/adapters/payment/registry.test.ts`.
3. Don't connect to a real Postgres, real PayPal, real Stripe, etc. Mock
   HTTP with `vi.fn()` and stub the Prisma client.

## Conventions

- One top-level `describe` per module under test.
- Co-locate test fixtures beside the test file, never in `src/`.
- Use `vi.mock('module-path', ...)` at the top of the file for module-level
  mocks; prefer dependency injection in production code.
