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

**Files to test:** `src/bun/srs.ts`, `src/bun/course-loader.ts` (parse functions), `src/bun/storage.ts`, `src/mainview/stores/storage-utils.ts`, `src/mainview/hooks/useLesson.ts` (findVisibleHeading), `src/mainview/components/rehype-highlight-text.ts`, `src/mainview/shortcuts.ts`.

**Rules:**
- No mocks. Direct import of functions under test.
- Cover full input space: happy path, empty inputs, edge cases, error cases.
- Use factory helpers for test data (makeCard, makeDeck pattern). Prefer test-local setup functions over shared `beforeEach` (avoids scrolling fatigue).
- One `describe` per exported function.
- Use U.S.E. naming: `describe(unit) → describe(situation) → it(expectation)`.
- One exit point per test case — one assertion per `it` block.
- Parametrize with `test.each` for edge case matrix (reduces boilerplate, ensures coverage).
- Test only your own code — don't test native/built-in behaviour (Date.parse, Math.round). Test your logic, not the runtime.
- File name matches source file exactly: `srs.ts` → `srs.test.ts`.

**Template:**

```typescript
import { describe, expect, test } from 'bun:test';
import { functionUnderTest } from './sourceFile';
import type { SomeType } from './types';

function makeItem(overrides: Partial<SomeType> & { id: string }): SomeType {
  return {
    // defaults
    ...overrides,
  };
}

describe('functionUnderTest', () => {
  describe('given valid input', () => {
    it('returns transformed result', () => {
      const input = makeItem({ id: 'a' });
      expect(functionUnderTest(input)).toEqual(expected);
    });
  });

  describe('given empty input', () => {
    it('returns empty/default', () => {
      expect(functionUnderTest(emptyInput)).toEqual([]);
    });
  });

  describe('given edge case input', () => {
    it.each([
      { input: null, expected: null },
      { input: '', expected: '' },
      { input: 'valid', expected: 'valid' },
    ])('handles %o', ({ input, expected }) => {
      expect(functionUnderTest(input)).toEqual(expected);
    });
  });

  describe('given input', () => {
    it('does not mutate original', () => {
      const input = makeItem({ id: 'a' });
      functionUnderTest(input);
      expect(input).toEqual(makeItem({ id: 'a' }));
    });
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
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { __setRPC } from '../api';

const mockResponses = new Map<string, unknown>();
const mockRPC = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        if (!mockResponses.has(method)) return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(mockResponses.get(method));
      };
    },
  }),
};

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

beforeAll(() => {
  __setRPC(mockRPC);
});

void mock.module('../layouts/PageLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));

void mock.module('../layouts/PageHeader', () => ({
  default: ({ title }: { title?: string }) => (
    <header data-testid="page-header">{title && <h1>{title}</h1>}</header>
  ),
}));

void mock.module('../layouts/PageContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="page-content">{children}</main>
  ),
}));

import PageComponent from './PageComponent';

describe('PageComponent', () => {
  beforeEach(() => {
    mockResponses.clear();
  });

  test('matches snapshot — loading state', () => {
    mockResponse('someMethod', new Promise(() => {}));
    const { container } = render(<PageComponent onBack={() => {}} />);
    expect(container).toMatchSnapshot();
  });

  test('matches snapshot — data loaded', async () => {
    mockResponse('someMethod', { title: 'Loaded' });
    const { container } = render(<PageComponent onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Loaded')).toBeInTheDocument();
    });
    expect(container).toMatchSnapshot();
  });

  test('matches snapshot — empty/error state', async () => {
    mockResponse('someMethod', null);
    const { container } = render(<PageComponent onBack={() => {}} />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="page-content"]')).toBeTruthy();
    });
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
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { __setRPC } from '../api';

const mockResponses = new Map<string, unknown>();
const mockRPC = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        if (!mockResponses.has(method)) return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(mockResponses.get(method));
      };
    },
  }),
};

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

beforeAll(() => {
  __setRPC(mockRPC);
});

import ComponentUnderTest from './ComponentUnderTest';

describe('ComponentUnderTest', () => {
  beforeEach(() => {
    mockResponses.clear();
  });

  test('renders initial state correctly', () => {
    render(<ComponentUnderTest prop="value" />);
    expect(screen.getByText('Expected Label')).toBeInTheDocument();
  });

  test('updates on user click', async () => {
    const user = userEvent.setup();
    render(<ComponentUnderTest prop="value" />);
    await user.click(screen.getByText('Button Label'));
    expect(screen.getByText('Updated Content')).toBeInTheDocument();
    expect(screen.queryByText('Old Content')).not.toBeInTheDocument();
  });

  test('handles empty state', () => {
    render(<ComponentUnderTest items={[]} />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  test('calls callback with correct args', async () => {
    const user = userEvent.setup();
    const onSelect = mock(() => {});
    render(<ComponentUnderTest onSelect={onSelect} />);
    await user.click(screen.getByText('Option A'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('option-a');
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

**Template (render in test):**

```typescript
import { renderHook, act } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { __setRPC } from '../api';

const mockResponses = new Map<string, unknown>();
const mockRPC = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        if (!mockResponses.has(method)) return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(mockResponses.get(method));
      };
    },
  }),
};

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

beforeAll(() => {
  __setRPC(mockRPC);
});

import { useTargetHook } from './useTargetHook';

describe('useTargetHook', () => {
  beforeEach(() => {
    mockResponses.clear();
  });

  test('returns initial state', () => {
    const { result } = renderHook(() => useTargetHook('arg'));
    expect(result.current).toEqual(
      expect.objectContaining({ loading: false, data: null, error: null }),
    );
  });

  test('updates state on action', async () => {
    mockResponse('someMethod', { result: true });
    const { result } = renderHook(() => useTargetHook('arg'));
    await act(async () => {
      await result.current.doSomething();
    });
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
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { __setRPC } from '../api';
import { useTargetStore } from './targetStore';

type RPCProxy = { request: Record<string, (p: unknown) => Promise<unknown>> };
const mockResponses = new Map<string, unknown>();

const mockRPC: RPCProxy = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        const response = mockResponses.get(method);
        if (response === undefined) return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(response);
      };
    },
  }),
};

beforeAll(() => {
  __setRPC(mockRPC);
});

beforeEach(() => {
  useTargetStore.setState({ /* defaults */ });
  mockResponses.clear();
});

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

describe('targetStore', () => {
  test('action sets expected state', async () => {
    mockResponse('someMethod', { result: true });
    useTargetStore.getState().someAction();
    await new Promise((r) => setTimeout(r, 10));
    expect.soft(useTargetStore.getState().loading).toBe(false);
    expect.soft(useTargetStore.getState().error).toBeNull();
    expect(useTargetStore.getState().field).toEqual({ result: true });
  });

  test('reset clears state', () => {
    useTargetStore.setState({ field: 'dirty', loading: true });
    useTargetStore.getState().reset();
    expect(useTargetStore.getState()).toEqual(
      expect.objectContaining({ field: null, loading: false }),
    );
  });

  test('skips fetch when already loaded', () => {
    useTargetStore.setState({ loaded: true });
    useTargetStore.getState().load();
    expect(mockResponses.size).toBe(0);
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
API failures, malformed data, network timeouts. Use `expect.soft()` to assert
multiple failure properties without early exit.

```typescript
test('load sets error on API failure', async () => {
  mockResponses.delete('coursesList');
  useCourseStore.getState().load();
  await new Promise((r) => setTimeout(r, 10));
  expect.soft(useCourseStore.getState().error).toBeTruthy();
  expect.soft(useCourseStore.getState().loading).toBe(false);
  expect.soft(useCourseStore.getState().data).toBeNull();
});
```

### Non-deterministic Code
Don't test `Date.now()`, `Math.random()`, or `crypto.randomUUID()` directly — tests will be flaky.
Refactor to inject the non-deterministic value as a parameter.

```typescript
// Don't — flaky:
function isHappyHour() {
  const now = new Date().getHours();
  return now >= 18 && now < 21;
}

// Do — inject the time:
function isHappyHour(now: number) {
  return now >= 18 && now < 21;
}

test('returns true at 8 PM', () => {
  expect(isHappyHour(20)).toBe(true);
});

test('returns false at 10 AM', () => {
  expect(isHappyHour(10)).toBe(false);
});
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

Bun's `mock.module()` is process-global and irrevocable. Once applied, every
subsequent test file in the same process sees the mock. There is no cleanup.

**Rule 1: Never `mock.module` shared modules.**
Modules imported by multiple test files (e.g., `../api`, stores, hooks) must
NOT be mocked via `mock.module`. This causes cascading failures when test
execution order changes.

**Rule 2: Use `__setRPC` for API mocking.**
`api.ts` exports `__setRPC(mock)` which swaps the internal RPC handler at
runtime. Each test file calls `beforeAll(() => __setRPC(...))` independently.
No module-level pollution.

**Rule 3: Use `store.setState()` for store state.**
Zustand stores expose `setState()` — call it directly in `beforeEach` to
reset state. Never mock the store import.

**Rule 4: `mock.module` is safe ONLY for isolated leaf modules.**
Modules that are imported by exactly one test file and have no downstream
test dependencies. Examples: layout stubs (PageLayout, PageHeader,
PageContent), leaf component stubs (StatCard, MermaidDiagram).

**Rule 5: Reset global singletons in `afterEach`.**
If your code modifies global state (i18n, console, timers), restore it in
`afterEach` (not `beforeEach` — the mutation may happen as the last test).
Zustand `setState()` does not restore external singletons.

**Safe mock targets (only used by one test file):**
- `../layouts/PageLayout`, `PageHeader`, `PageContent` (page snapshot tests)
- `../components/StudyTools`, `MermaidDiagram`, `NoteEditor` (section tests)
- `react-markdown` (LessonSection tests only)

**Dangerous mock targets (shared across test files):**
- `../api` → affects ALL stores, hooks, sections, pages
- `../hooks/useFoo` → affects hook tests and component tests
- `../components/ui` → affects any component importing Button
- Any Zustand store module → affects all tests that import that store

## Conventions

- **Framework:** `bun:test` (zero config, `bun test` to run)
- **DOM:** `happy-dom` via `src/setup.ts` (auto-loaded)
- **jest-dom matchers:** `toBeInTheDocument()`, `toBeVisible()`, `not.toBeInTheDocument()` available via `src/setup.ts` `expect.extend()`
- **Component rendering:** `@testing-library/react`
- **User interactions:** `@testing-library/user-event` (prefer over `fireEvent`)
- **Imports:** `import { describe, expect, test } from 'bun:test'`
- **Queries (priority order):** `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByTestId`. Prefer `screen.getBy*` over destructuring from `render()`.
- **Arbitrary matchers:** Use `expect.any(Date)`, `expect.stringMatching(...)`, `expect.arrayContaining(...)`, `expect.objectContaining(...)` to handle non-deterministic or partial fields inside `toEqual`.
- **Setup:** `src/setup.ts` handles happy-dom globals, electrobun mock, cleanup, jest-dom matchers
- **Types:** No `Record<string, any>` — define concrete recursive types. Export shared types from source for test reuse.
- **Co-location:** test files sit next to source files
- **Naming:** depends on test nature — `<Name>.test.ts` (unit), `<Name>.page.test.tsx` (page snapshot), `<Name>.component.test.tsx` (component), `<Name>.hook.test.ts` (hook), `<Name>.store.test.ts` (store), `<Name>.regr.test.ts` (regression)

## Decision Tree

```
New code to test?
├── Pure function / utility / parser / algorithm
│   └── src/bun/*.ts, mainview/**/*.ts (pure logic) → <Name>.test.ts — no mocks, toEqual, test.each
├── Page component (pages/*.tsx)
│   ├── Structural check → <Name>.page.test.tsx — mock API+layouts, toMatchSnapshot
│   └── Interaction → <Name>.component.test.tsx — userEvent, toBeInTheDocument, optional snapshot
├── Section or UI component (sections/*.tsx, components/**/*.tsx)
│   └── <Name>.component.test.tsx — minimal mocks, userEvent, toBeInTheDocument, optional snapshot
├── Custom hook (hooks/use<Name>.ts)
│   └── <Name>.hook.test.ts — mock API, renderHook, act, state transitions
├── Zustand store (stores/<Name>.ts)
│   └── <Name>.store.test.ts — mock API, setState, expect.soft, state transitions
└── Bug fix
    └── <Name>.regr.test.ts — DISPOSABLE, prove fix, prevent recurrence
```
