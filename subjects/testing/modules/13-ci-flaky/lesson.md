# Module 13: CI Integration and Flaky Test Management

Est. study time: 1.5h
Language: en
Description: Integrate tests into CI pipeline, parallelize execution, detect and fix flaky tests.

## Learning Objectives
- Configure vitest for CI with parallel sharding
- Implement flaky test detection and quarantine
- Use test retries and fail-fast correctly
- Write CI-friendly test assertions

---

## Core Content

### 13.1 vitest CI Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,

    // CI-specific settings
    ...(process.env.CI
      ? {
          reporters: ['default', 'junit'],
          outputFile: './test-results/junit.xml',
          minWorkers: 2,
          maxWorkers: 4,
          bail: 5, // Stop after 5 failures (save CI time)
          testTimeout: 30_000, // More generous timeout in CI
        }
      : {
          reporters: ['default'],
          coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**'],
          },
        }),
  },
})
```

**CI-specific settings:**
- Longer timeout (CI machines are slower)
- Fail-fast after N failures (don't waste CI time on already-failing suite)
- JUnit output for CI dashboard integration
- Reduced parallelism (don't overload CI workers)

> **Think**: Why increase timeout in CI but not in local?
>
> *Answer: CI machines typically have fewer CPU cores, shared resources, and run slower than developer machines. Same test can take 3x longer in CI. Generous timeout prevents false-positive failures without hiding real bugs.*

### 13.2 Parallel Test Execution

vitest runs tests in parallel by default. Control parallel execution:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Pool configuration
    pool: 'forks', // 'forks' (default) or 'threads' or 'vmThreads'
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },

    // File-level parallelism
    fileParallelism: true,
    maxConcurrency: 10, // max tests running at once
  },
})
```

**Sequence of execution:**
1. vitest discovers all test files
2. Distributes files across workers (1 file per worker by default)
3. Within a file, tests run sequentially (but can be parallel with `test.concurrent`)
4. Files run in parallel across workers

**Opting out of parallelism (when necessary):**

```typescript
// vitest.config.ts — for specific files
export default defineConfig({
  test: {
    testSequencer: (tests) => tests.sort((a, b) => a.localeCompare(b)),
  },
})
```

```typescript
// Or per-file — disable parallelism for side-effect-heavy tests
// @vitest-environment node
// @vitest-noparallel
```

> **Think**: When would you need to disable parallel test execution?
>
> *Answer: Tests that modify global state (localStorage, environment variables, timers) without proper cleanup may interfere when run in parallel. Always prefer proper cleanup (afterEach) over disabling parallelism.*

### 13.3 Test Retries and Flaky Detection

vitest supports automatic retries for flaky tests.

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    retry: process.env.CI ? 2 : 0, // Retry failed tests twice in CI
  },
})
```

**Per-test retry configuration:**

```typescript
// Retry individual flaky tests
test.flaky('handles race condition', async () => {
  // This test may fail intermittently
  // vitest will retry up to configured retry count
})
```

**Flaky test detection strategy:**
1. Run tests 5+ times in CI
2. If a test fails intermittently, tag it as `test.flaky`
3. Create a tracking issue for each flaky test
4. Fix root cause within the same sprint
5. Remove `.flaky` tag once root cause is fixed

**Common flaky causes:**
- Unmocked API calls (test passes locally, fails in CI when network is slower/faster)
- Race conditions (async updates outside waitFor)
- Hardcoded timeouts (`Bun.sleep(100)`)
- Test pollution (leaking `mock.module`, store state, localStorage)
- Timers (using real timers when fake timers are expected)

> **Think**: What's the danger of having too many retries (retry: 5)?
>
> *Answer: Retries mask flaky tests without fixing them. A test that consistently fails 3/5 times passes in CI due to retries, but the root cause (unfixed) causes intermittent production issues. Limit retries to 1-2 max.*

### 13.4 CI Pipeline Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    # Shard tests across 4 parallel jobs
    strategy:
      matrix:
        shard: [1, 2, 3, 4]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - run: npx vitest run --shard=${{ matrix.shard }}/${{ strategy.jobs.total }}
        env:
          CI: true

      # Upload test results
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ matrix.shard }}
          path: test-results/

  # Aggregate test results
  test-report:
    needs: [test]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
      - name: Generate report
        run: npx junit-merge --dir test-results --out test-results/merged.xml
```

**CI run time estimation:**
- 100 test files, each averaging 2s: 200s total
- Without sharding: ~3.5 min
- With 4 shards: ~1 min
- With 8 shards: ~30s

> **Think**: What's the optimal shard count for your CI?
>
> *Answer: Enough to match queue wait time. If each shard costs 1 min but CI queue wait is 5 min, additional shards give diminishing returns. Rule: 2-4 shards for small suites (100 files), 6-8 for large suites (500+ files).*

### 13.5 Test Selectivity in CI

Run only relevant tests based on changes.

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Only run tests related to changed files
    changed: process.env.CHANGED_ONLY ? true : undefined,
  }
})
```

```bash
# In CI PR checks — run only changed files' tests
vitest run --changed HEAD~1

# For full CI (main branch) — run all tests
vitest run
```

**Test file naming for targeted runs:**

```bash
# Run only component tests
vitest run '*.component.test.tsx'

# Run only store tests
vitest run '*.store.test.ts'

# Run specific module tests
vitest run 'modules/01-mock-zustand/**'
```

### 13.6 CI-Focused Assertion Patterns

```typescript
// ❌ Flaky — relies on exact timing
await Bun.sleep(500)
expect(screen.getByText('Data')).toBeInTheDocument()

// ✅ CI-safe — polls with generous timeout
await waitFor(() => {
  expect(screen.getByText('Data')).toBeInTheDocument()
}, { timeout: 10_000 })

// ❌ Flaky — assumes test environment state
expect(localStorage.getItem('token')).toBe('abc')

// ✅ CI-safe — explicit setup before assertion
localStorage.setItem('token', 'abc')
expect(localStorage.getItem('token')).toBe('abc')
```

---

## Why This Matters

A test suite is only useful if it runs reliably in CI. Flaky tests destroy trust — developers start ignoring CI failures. Proper CI configuration, retry strategy, and flaky detection maintain confidence in the test suite.

---

## Common Questions

**Q: Should I use test retries in local development?**
A: No. Retries mask flakiness. Use retries only in CI where resource constraints cause intermittent failures.

**Q: How do I find flaky tests?**
A: Run `vitest --retry=3 --reporter=flaky` to see which tests fail intermittently. Track them in a spreadsheet or issue tracker.

**Q: Should I run all tests on every PR?**
A: For small-medium projects, yes. For large projects (10k+ tests), use changed-only mode for PRs and full suite on main branch.

---

## Key Takeaways

- Increase test timeout in CI (30s vs 10s local)
- Use parallel sharding (2-8 shards based on suite size)
- Limit test retries to 1-2 max in CI
- Tag flaky tests explicitly, fix root cause in same sprint
- Use `waitFor` with generous timeout for CI-safe assertions
- Run changed-only tests on PRs, full suite on main

---

## Common Misconception

**"CI should have the same timeout as local development."**

CI machines share CPUs with other jobs, run on slower hardware, and have higher I/O latency. A test that takes 1s locally may take 3-5s in CI. Using local timeouts in CI causes false-positive failures.

---

## Feynman Explain

(Explain why a test passes locally 100/100 times but fails in CI 5/100 times. Walk through the root causes and how to fix each one.)

---

## Drill

Run: `learn.sh quiz testing 13`
