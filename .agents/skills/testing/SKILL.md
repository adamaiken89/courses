---
name: testing
description: Use when writing tests for CourseReader code. Nature-based: unit, page snapshot, component, hook, store. Trigger on "write tests", "add tests", "test this", or when creating new files that need test coverage.
---

# CourseReader Testing Strategy

## Quick Reference

| Nature | File Pattern | Mock Policy | Assertions |
|--------|-------------|-------------|------------|
| Unit | `<Name>.test.ts` | None | `toEqual`/`toBe`, `test.each`, full input coverage |
| Page snapshot | `<Name>.page.test.tsx` | `__setRPC` for API; `mock.module` for leaf layouts only | `toMatchSnapshot()` |
| Component | `<Name>.component.test.tsx` | `__setRPC` for API; Zustand `setState()` for stores | `userEvent` → `toBeInTheDocument()`, optional snapshot |
| Hook | `<Name>.hook.test.ts` | `__setRPC` Proxy for API; Zustand `setState()` for stores | State transitions, `expect.soft()` |
| Store | `<Name>.store.test.ts` | `__setRPC` Proxy for API | State transitions, `expect.soft()` |

## Unit Tests

**Target:** utility functions, pure logic, parsers, algorithm helpers.

**Source files:** `src/bun/*.ts`, `src/mainview/**/*.ts` (pure logic, utils, parsers, constants, algorithms)

**Rules:**
- No mocks. Direct import of functions under test.
- Cover full input space: happy path, empty inputs, edge cases, error cases.
- Use factory helpers for test data (makeCard, makeDeck pattern). Prefer test-local setup functions over shared `beforeEach` (avoids scrolling fatigue).
- One `describe` per exported function.
- Use U.S.E. naming: `describe(unit) → describe(situation) → it(expectation)`.
- One behavior per `it` block — multiple assertions are fine when they verify the same behavior (e.g. checking multiple fields of the same returned object).
- Parametrize with `test.each` for edge case matrix (reduces boilerplate, ensures coverage).
- Test only your own code — don't test native/built-in behaviour (Date.parse, Math.round). Test your logic, not the runtime.
- File name matches source file exactly: `srs.ts` → `srs.test.ts`.

**Template:**

```typescript
import { describe, expect, test } from 'bun:test';
import { fn } from './source';

function makeItem(overrides: Partial<Type> & { name: string }): Type {
  return { field: 'default', ...overrides };
}

describe('fn', () => {
  it('transforms valid input', () => {
    expect(fn(makeItem({ name: 'a' }))).toEqual(expected);
  });

  it.each([
    { input: null, expected: null },
    { input: '', expected: [] },
  ])('handles %o', ({ input, expected }) => {
    expect(fn(input)).toEqual(expected);
  });
});
```

## Page Snapshot Tests

**Target:** page components in `src/mainview/pages/`.

**Source files:** `src/mainview/pages/<Name>.tsx`

> Page components MAY also have companion `<Name>.component.test.tsx` for interaction testing.

**Rules:**
- Mock API via `__setRPC` Proxy pattern — never `mock.module('../api')`.
- Mock layouts as simple divs with `data-testid` attributes via `mock.module` (safe — leaf modules).
- Use `render()` from `@testing-library/react`.
- Wait for async: `await waitFor(() => { expect(...).toBeInTheDocument() })` — never `Bun.sleep(N)` (flaky).
- `toMatchSnapshot()` to capture full layout structure.
- Reset mocks in `beforeEach`.

**Template:**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { setupRPC, mockResponse, clearMocks } from '../test-utils';

setupRPC();
// mock.module for leaf layouts only (see Anti-pollution Rules)
void mock.module('../layouts/PageLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));

import Page from './Page';

describe('Page', () => {
  beforeEach(clearMocks);

  test('snapshot — loading', () => {
    mockResponse('someMethod', new Promise(() => {}));
    const { container } = render(<Page onBack={() => {}} />);
    expect(container).toMatchSnapshot();
  });

  test('snapshot — loaded', async () => {
    mockResponse('someMethod', { title: 'Loaded' });
    const { container } = render(<Page onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Loaded')).toBeInTheDocument());
    expect(container).toMatchSnapshot();
  });
});
```

## Component Tests

**Target:** complex components and sections — `LessonSection`, `QuizSection`, `StudyTools`, `LessonToolbar`, `SectionsPanel`, `SelectionToolbar`, etc.

**Source files:** `src/mainview/pages/*.tsx`, `src/mainview/sections/*.tsx`, `src/mainview/components/**/*.tsx`

**Rules:**
- Mock API via `__setRPC` Proxy — never `mock.module('../api')`.
- Control Zustand stores via `store.setState()` in `beforeEach`.
- Keep component internals real — do not mock hooks or sub-components unless they are leaf modules imported by no other test.
- Use `userEvent` (not `fireEvent`) for realistic interaction — dispatches hover/focus/blur chains.
- Assert with `toBeInTheDocument()` / `not.toBeInTheDocument()` (from `@testing-library/jest-dom`) — stronger than `toBeTruthy()`/`toBeNull()`.
- Use `screen.getBy*` over destructuring from `render()` (resilient to refactors).
- Include `toHaveBeenCalledTimes(1)` guard to prevent silent extra calls.
- Avoid useless assertions: `toBeDefined()`, `not.toBeNull()`, `toBeTruthy()` on element queries without guarding a specific failure mode. Every assertion must protect against a real bug.
- May include snapshots for structural coverage; separate by `describe` block.

**Template:**

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { setupRPC, mockResponse, clearMocks } from '../test-utils';

setupRPC();
import Cmp from './Cmp';

describe('Cmp', () => {
  beforeEach(clearMocks);

  test('renders initial state', () => {
    render(<Cmp prop="value" />);
    expect(screen.getByText('Label')).toBeInTheDocument();
  });

  test('responds to click', async () => {
    const user = userEvent.setup();
    render(<Cmp />);
    await user.click(screen.getByText('Action'));
    expect(screen.getByText('Result')).toBeInTheDocument();
  });
});
```

## Hook Behavior Tests

**Target:** custom hooks (`useQuizEngine`, `useLesson`, `useSelection`, `useBookmarks`, etc.)

**Source files:** `src/mainview/hooks/use<Name>.ts`

**Rules:**
- Mock API layer via Proxy RPC (`__setRPC`) — never `mock.module('../api')`.
- Control Zustand stores via `store.setState()` in `beforeEach`.
- Test state transitions: trigger action → assert new state.
- Use `expect.soft()` for multi-field assertions (reports all failures, not just first).
- Prefer structured `toEqual` over multiple granular `toBe` calls.
- Test side effects: API called with correct params.
- Can lead to state/function reorganization when behavior is tangled.

**Template:**

```typescript
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'bun:test';
import { setupRPC, mockResponse, clearMocks } from '../test-utils';

setupRPC();
import { useTarget } from './useTarget';

describe('useTarget', () => {
  beforeEach(clearMocks);

  test('initial state', () => {
    const { result } = renderHook(() => useTarget('arg'));
    expect(result.current).toEqual(
      expect.objectContaining({ loading: false, data: null }),
    );
  });

  test('updates on action', async () => {
    mockResponse('someMethod', { result: true });
    const { result } = renderHook(() => useTarget('arg'));
    await act(async () => { await result.current.doSomething(); });
    expect(result.current.data).toBeDefined();
  });
});
```

## Store Behavior Tests

**Target:** Zustand stores (`courseStore`, `viewStore`, `settingsStore`, etc.)

**Source files:** `src/mainview/stores/<Name>.ts`

**Rules:**
- Mock API layer via `__setRPC` Proxy — never `mock.module('../api')`.
- `beforeEach`: reset store state via `useXStore.setState({...defaults})`.
- Test state transitions: trigger action → assert new state.
- Use `expect.soft()` for multi-field assertions (reports all failures, not just first).
- Prefer structured `toEqual` over multiple granular `toBe` calls.
- Test side effects: API called with correct params.
- Can lead to state/function reorganization when behavior is tangled.

**Template:**

```typescript
import { beforeEach, describe, expect, test } from 'bun:test';
import { setupRPC, mockResponse, clearMocks } from '../test-utils';
import { useStore } from './store';

setupRPC();

beforeEach(() => {
  useStore.setState({ field: null, loading: false });
  clearMocks();
});

describe('useStore', () => {
  test('action sets state', async () => {
    mockResponse('someMethod', { result: true });
    useStore.getState().load();
    await new Promise((r) => setTimeout(r, 0));
    expect(useStore.getState().field).toEqual({ result: true });
  });

  test('reset returns to defaults', () => {
    useStore.setState({ field: 'dirty' });
    useStore.getState().reset();
    expect(useStore.getState()).toEqual(
      expect.objectContaining({ field: null, loading: false }),
    );
  });
});
```

## Additional Test Types

### Edge Case / Boundary Tests
Cover: empty strings, null, undefined, zero, negative, max values, single-element arrays.
Use `test.each` to reduce boilerplate for the edge case matrix.

```typescript
test.each([
  { input: '', expected: null },
  { input: null, expected: null },
  { input: 'test', expected: 'test' },
])('parseCourse(%p) → %p', ({ input, expected }) => {
  expect(parseCourse(input, 'test')).toEqual(expected);
});

test('handles maximum nesting depth', () => {
  const deep = { a: { b: { c: { d: 'value' } } } };
  expect(flatten(deep)).toEqual({ 'a.b.c.d': 'value' });
});
```

### Regression Tests
⚠️ DISPOSABLE: delete after bug fix is merged. Not part of ongoing test suite.

Bug found → write failing test → fix bug → test stays as permanent guard.

```typescript
// Regression: crash on null explanation (fixed in commit abc123)
test('does not crash when card explanation is null', () => {
  const card = makeCard({ id: 'a', explanation: null });
  expect(formatCard(card)).toContain('Q?');
});
```

### Error Path Tests
API failures, malformed data, network timeouts. Use `deleteMock()` from
test-utils to remove a mock (triggers "No mock" rejection), or use
`mockErrorResponse()` to inject a specific Error. Use `expect.soft()` to assert
multiple failure properties without early exit.

```typescript
import { deleteMock, mockErrorResponse } from '../test-utils';

test('load sets error on API failure', async () => {
  deleteMock('coursesList');
  useCourseStore.getState().load();
  await waitFor(() => {
    expect(useCourseStore.getState().error).toBeTruthy();
  });
  expect(useCourseStore.getState().loading).toBe(false);
});

test('handles specific error message', async () => {
  mockErrorResponse('coursesList', 'Network timeout');
  useCourseStore.getState().load();
  await waitFor(() => {
    expect(useCourseStore.getState().error?.message).toBe('Network timeout');
  });
});
```

### i18n Snapshot Updates

When tests render translated text (via `t('key')`), adding or changing locale keys requires:

```sh
bun test -u    # update snapshots
```

Without this, snapshot tests fail because rendered text changed. Add this step after modifying locale files.

### Scroll Layout Invariant

If writing or debugging tests for components that depend on scroll behavior (`LessonSection`, `PageContent`), refer to `.agents/skills/scroll-invariant/SKILL.md`. The `PageContent` `flex flex-col` invariant is a common source of silent scroll failures.

## Verification

After writing tests, run:

```sh
bun test               # confirm tests pass
bun run check           # tsc + eslint + prettier
```

Both must pass before commit. If snapshots changed, run `bun test -u` and re-run check.

### Non-deterministic Code
Don't test `Date.now()`, `Math.random()`, or `crypto.randomUUID()` directly — tests will be flaky.
Refactor to inject the non-deterministic value as a parameter.

```typescript
// Bad: depends on wall clock
function isHappyHour() { const now = new Date().getHours(); return now >= 18 && now < 21; }
// Good: inject time
function isHappyHour(now: number) { return now >= 18 && now < 21; }
test('8 PM', () => { expect(isHappyHour(20)).toBe(true); });
```

### Factory Helpers
Reusable test data builders. Co-located in test files or shared test utility.

```typescript
function makeCard(overrides: Partial<SRSCard> & { id: string }): SRSCard {
  return {
    questionId: 'q1',
    moduleId: '01',
    courseId: 'test',
    question: 'Q?',
    answer: 'A',
    explanation: 'E',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: '2024-01-01T00:00:00.000Z',
    lastReviewed: null,
    isStarred: false,
    ...overrides,
  };
}

function makeDeck(cards: SRSCard[]): SRSDeck {
  const map: Record<string, SRSCard> = {};
  for (const c of cards) map[c.id] = c;
  return { cards: map };
}
```

## Mock Patterns Reference

| Pattern | Use When | Pollution Risk | Example |
|---------|----------|----------------|---------|
| `__setRPC` Proxy | API mocking in any test | None — runtime DI | `__setRPC({ request: new Proxy(...) })` |
| `store.setState()` | Reset Zustand state | None — direct state | `useXStore.setState({ ...defaults })` |
| `mock.module(path, factory)` | Leaf components/layouts only | **Permanent** — no cleanup | `mock.module('../layouts/PageLayout', ...)` |
| `mock(() => ...)` | Mock individual functions | None — local scope | `const fn = mock(() => Promise.resolve(null))` |
| Factory helpers | Build test data with defaults | None — pure functions | `makeCard({ id: 'a', isStarred: true })` |

## Anti-pollution Rules

Bun's `mock.module()` is process-global and irrevocable. No cleanup.

**Rules:**
1. **Never `mock.module` shared modules** — cascading failures on import order change
2. **Use `__setRPC` for API mocking** — runtime DI, no module pollution
3. **Use `store.setState()` for store reset** — direct Zustand, never mock store module
4. **`mock.module` safe only for leaf modules** — imported by exactly one test file (layouts, StatCard, MermaidDiagram)
5. **Reset global singletons in `afterEach`** — i18n, console, timers. Not restored by Zustand.

**Safe targets** (single-consumer): `PageLayout/Header/Content`, `StudyTools`, `MermaidDiagram`, `NoteEditor`, `react-markdown`

**Dangerous targets** (shared): `../api`, `../hooks/*`, `../components/ui`, any Zustand store

## act() Wrapping Rule

`render()` and `renderHook()` already call `act()` — do NOT wrap them. Only wrap state mutations outside `waitFor()`.

```typescript
// ✅ waitFor handles async
test('loads data', async () => {
  render(<Component />);
  await waitFor(() => expect(screen.getByText('Loaded')).toBeInTheDocument());
});
```

**Never use `Bun.sleep(N)` or `setTimeout(r, N)`** — bypasses React microtask queue. Use `waitFor()`.

**For non-React store tests**, flush microtasks:
```typescript
await new Promise(r => setTimeout(r, 0));
expect(useStore.getState().field).toEqual(expected);
```

## Dependency Tiers

Mock cost by test target:

| Tier | Mock Cost | Examples |
|------|-----------|----------|
| 1 | Zero | `viewStore`, `lessonUIStore`, `useSelection`, `useLessonSearch`, `useShortcuts` |
| 2 | Mock RPC | `bookmarksStore`, `highlightsStore`, `notesStore`, `syncStore`, `useBookmarks`, `useQuizEngine` |
| 3 | RPC + cross-store | `courseStore` (completionStore), `useLesson` (5+ deps) |

Prefer Tier 1-2. Split Tier 3 code.

## Backend Unit Tests

**Target:** `src/bun/*.ts`

**Rules:**
- Use `await import('./module')` + `mock.module()` for fs mocking.
- Mutable stubs: `mock(() => ...)` + `mockImplementation` in `beforeEach`.
- For fs: use `test-fs-shared.ts` (`createTestFs`, `createFsFromMap`).
- For `globalThis.fetch`: save/restore `beforeEach/afterEach`.
- Error paths: `mockErrorResponse()` or `deleteMock()`.

**Example:**

```typescript
import { beforeEach, describe, expect, mock, test } from 'bun:test';
const mockReadFile = mock(() => Promise.resolve(''));
void mock.module('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mock(() => Promise.resolve(undefined)),
}));
const { parseCourse } = await import('./course-loader');

describe('parseCourse', () => {
  beforeEach(() => { mockReadFile.mockImplementation(() => Promise.resolve('')); });
  test('valid YAML', async () => {
    mockReadFile.mockImplementation(() => Promise.resolve('title: Test'));
    expect((await parseCourse('test-dir')).title).toBe('Test');
  });
});
```

- **Framework:** `bun:test` (zero config, `bun test` to run)
- **DOM:** `happy-dom` via `src/setup.ts`
- **jest-dom matchers:** `toBeInTheDocument()`, `toBeVisible()`, `not.toBeInTheDocument()` via `src/setup.ts`
- **Component rendering:** `@testing-library/react`; interactions: `@testing-library/user-event` (prefer over `fireEvent`)
- **Imports:** `import { describe, expect, test } from 'bun:test'`
- **Queries (priority):** `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByTestId`. Prefer `screen.getBy*` over destructuring.
- **data-testid:** add in source component when no accessible role/text. Stable contract — Tailwind changes don't break.
- **Arbitrary matchers:** `expect.any(Date)`, `expect.stringMatching()`, `expect.arrayContaining()`, `expect.objectContaining()` for non-deterministic/partial fields.
- **Setup:** `src/setup.ts` handles happy-dom globals, electrobun mock, cleanup, jest-dom matchers
- **Types:** No `Record<string, any>` — concrete recursive types. Export shared types for test reuse.
- **Co-location:** test files next to source files
- **Naming:** `<Name>.test.ts` (unit), `.page.test.tsx` (page snapshot), `.component.test.tsx` (component), `.hook.test.ts` (hook), `.store.test.ts` (store), `.regr.test.ts` (regression)
