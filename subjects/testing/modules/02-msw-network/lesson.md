# Module 2: MSW for Network Layer Mocking

Est. study time: 2.5h
Language: en
Description: Replace ad-hoc RPC proxy with MSW. Mock HTTP once, use in dev + test.

## Learning Objectives
- Configure MSW server for vitest with proper lifecycle
- Write request handlers for REST endpoints
- Override handlers per-test for specific scenarios
- Simulate network errors and timeouts
- Share handlers between test and dev environments

---

## Core Content

### 2.1 Why MSW Over Ad-hoc Proxy

The reader project uses `__setRPC` — a custom Proxy over `globalThis.fetch`. This works but has limitations:

| Limitation | MSW Solution |
|---|---|
| Custom code to write and maintain | Standardized handler API |
| Only works in test | Same handlers in browser dev |
| Invisible to dev tools | Requests visible in Network tab with "(MSW)" badge |
| Tightly coupled to RPC abstraction | Works with any HTTP client (fetch, axios, etc.) |

The fundamental insight: MSW intercepts at the HTTP level, not at the application level. Your app code uses standard `fetch()` — no custom abstractions needed.

```typescript
// INSTEAD OF:
beforeAll(() => {
  __setRPC({ request: new Proxy({}, {
    get: (_, method) => (params: unknown) => {
      const handler = mockRegistry[method as string]
      return handler ? Promise.resolve(handler(params)) : Promise.reject(new Error('No mock'))
    }
  }))
})

// DO:
import { setupServer } from 'msw/node'
const server = setupServer(
  http.get('/api/courses', () => HttpResponse.json([{ id: '1', title: 'Test' }])),
  http.post('/api/courses/:id/complete', () => new HttpResponse(null, { status: 204 }))
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

> **Think**: What's the concrete advantage of seeing mocked requests in browser dev tools?
>
> *Answer: Debugging — when a mock returns unexpected data, Network tab shows the request/response just like real API calls. You can inspect timing, headers, response size, and the exact request URL. Ad-hoc proxies are invisible to dev tools.*

### 2.2 MSW Architecture

```
Browser (dev)                    Node (test)
    │                                │
    ▼                                ▼
fetch('/api/courses')          fetch('/api/courses')
    │                                │
    ▼                                ▼
Service Worker                  @mswjs/interceptors
(msw/browser)                   (msw/node)
    │                                │
    ▼                                ▼
Handler Match?                  Handler Match?
├─ Yes → Return Response        ├─ Yes → Return Response
└─ No → Pass-through (dev)      └─ No → Throw (test)
```

Key insight: MSW never modifies your app code. The handler layer sits between app and network, invisible to both. The app makes real `fetch()` calls — MSW just intercepts them.

In browser mode, unhandled requests pass through to the real network (useful for dev). In test mode, unhandled requests throw by default (catches missing mocks).

> **Think**: What happens if no handler matches a request in test mode?
>
> *Answer: MSW throws a `NetworkError` — the request is NOT passed through to the real network. This is intentional: tests must never accidentally hit real APIs. Use `server.use()` to add missing handlers for specific tests.*

### 2.3 Setting Up MSW in vitest

**Step 1: Install**

```bash
npm install msw --save-dev
```

**Step 2: Define shared handlers**

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/courses', () => {
    return HttpResponse.json([
      { id: '1', title: 'Course 1', modules: [] },
      { id: '2', title: 'Course 2', modules: [] },
    ])
  }),

  http.get('/api/courses/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      title: `Course ${params.id}`,
      modules: [{ id: 'm1', title: 'Module 1' }],
    })
  }),

  http.post('/api/courses/:id/complete', () => {
    return new HttpResponse(null, { status: 204 })
  }),
]
```

**Step 3: Create test server**

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

**Step 4: Wire into vitest setup**

```typescript
// src/test-setup.ts — loaded via vitest.config.ts setupFiles
import { server } from './mocks/server'
import { beforeAll, afterEach, afterAll } from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

`onUnhandledRequest: 'error'` ensures tests fail loudly when code calls an unmocked API. This prevents silent fake-success where a test passes because the error path catches the failed request, not because the happy path works.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./src/test-setup.ts'],
    environment: 'jsdom',
  },
})
```

> **Think**: Why `onUnhandledRequest: 'error'` instead of `'warn'`?
>
> *Answer: `'warn'` logs a warning that scrolls off screen in CI output. `'error'` throws immediately — the test fails at the line making the unmocked request, making it obvious which endpoint is missing a mock.*

### 2.4 Per-Test Handler Override

Shared handlers cover the happy path. Tests override handlers for specific scenarios using `server.use()`.

```typescript
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'

test('shows error on API failure', async () => {
  server.use(
    http.get('/api/courses', () => {
      return HttpResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    })
  )

  render(<CourseList />)
  await waitFor(() => {
    expect(screen.getByText('Failed to load courses')).toBeInTheDocument()
  })
})

test('shows empty state when no courses', async () => {
  server.use(
    http.get('/api/courses', () => {
      return HttpResponse.json([])
    })
  )

  render(<CourseList />)
  await waitFor(() => {
    expect(screen.getByText('No courses yet')).toBeInTheDocument()
  })
})
```

`server.use()` adds handlers to a stack. New handlers take priority over shared defaults. `server.resetHandlers()` in `afterEach` restores only the shared handlers.

> **Think**: What happens if two tests in the same file override the same handler without resetHandlers between them?
>
> *Answer: Each `server.use()` pushes onto the handler stack. Without `resetHandlers()`, the second test inherits the first test's override. If the first test sets a 500 error response, the second test gets 500 too — cascading failure.*

### 2.5 Simulating Network Errors

```typescript
import { delay, http, HttpResponse } from 'msw'

test('handles network failure', async () => {
  server.use(
    http.get('/api/courses', () => {
      return HttpResponse.error() // Simulates network-level failure
    })
  )

  render(<CourseList />)
  await waitFor(() => {
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })
})

test('handles timeout', async () => {
  server.use(
    http.get('/api/courses', async () => {
      await delay('infinite') // Hangs forever
    })
  )

  const { container } = render(<CourseList timeoutMs={2000} />)
  await waitFor(() => {
    expect(screen.getByText('Request timed out')).toBeInTheDocument()
  })
})

test('simulates slow network', async () => {
  server.use(
    http.get('/api/courses', async () => {
      await delay(1000) // Realistic slow response
      return HttpResponse.json([{ id: '1', title: 'Slow loaded' }])
    })
  )

  render(<CourseList />)
  expect(screen.getByText('Loading...')).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.getByText('Slow loaded')).toBeInTheDocument()
  })
})
```

`HttpResponse.error()` creates a `TypeError: Failed to fetch` that is indistinguishable from a real network failure. `delay()` simulates latency or infinite timeout.

> **Think**: What's the difference between `HttpResponse.error()` and `HttpResponse.json(null, { status: 200 })`?
>
> *Answer: `error()` throws a network-level exception (fetch promise rejects). `json(null)` returns a successful HTTP response with a null body — your code parses it, potentially getting `null` where it expected an array. These test completely different code paths: connection failure vs server returning unexpected data.*

### 2.6 Integrating MSW with Zustand Stores

MSW integrates transparently with zustand stores that use `fetch`.

```typescript
// store.ts
export const useCourseStore = create<CourseStore>()((set, get) => ({
  courses: [],
  loading: false,
  error: null,
  loaded: false,

  loadCourses: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/courses')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const courses = await res.json()
      set({ courses, loading: false, loaded: true })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },
}))

// store.test.ts
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'

test('loadCourses handles 500', async () => {
  server.use(
    http.get('/api/courses', () =>
      HttpResponse.json({ error: 'Server Error' }, { status: 500 })
    )
  )

  await useCourseStore.getState().loadCourses()
  await flushMicrotasks()

  const state = useCourseStore.getState()
  expect(state.error).toContain('HTTP 500')
  expect(state.loading).toBe(false)
  expect(state.courses).toEqual([])
})
```

No custom proxy. No `__setRPC`. Standard `fetch()` — MSW intercepts transparently. The store doesn't know it's being tested.

> **Think**: How does MSW intercept `fetch` without modifying global scope?
>
> *Answer: MSW's Node interceptor uses `@mswjs/interceptors` which patches `globalThis.fetch` via a custom fetch polyfill that checks the handler registry before falling through to real network. The polyfill is scoped to the test process. In browser, it registers a real Service Worker — the browser routes requests to the SW before sending them to the network.*

### 2.7 MSW in Development (Browser)

Same handlers work in browser dev mode. Set up conditional loading:

```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
```

```typescript
// src/main.tsx
async function bootstrap() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'warn' })
  }

  const root = createRoot(document.getElementById('root')!)
  root.render(<App />)
}
bootstrap()
```

In dev mode, all API calls are served from the same handlers used in tests. No backend needed. The Network tab shows each request with an "(MSW)" badge.

In test mode, `msw/node` uses `@mswjs/interceptors` instead of Service Worker (no browser context needed).

> **Think**: What's the danger of using `onUnhandledRequest: 'error'` (throw) in browser dev mode?
>
> *Answer: In dev, you might call third-party APIs or endpoints you haven't mocked yet. `'error'` would crash the page. Use `'warn'` in dev to log without blocking. In tests, strict isolation is better — `'error'` catches missing mocks immediately.*

---

## Why This Matters

HTTP mocking is the most common source of test pollution in React apps. MSW gives you a clean, standardized approach that works across test and dev environments. The same handlers serve both purposes, eliminating the maintenance burden of separate mock implementations.

---

## Common Questions

**Q: Does MSW work with axios?**
A: Yes. MSW intercepts at the `fetch`/`http.request` level — it doesn't matter which HTTP client you use. axios, ky, plain fetch, all work.

**Q: How do I test GraphQL with MSW?**
A: MSW has built-in `graphql` handler: `graphql.query('GetCourses', resolver)`. It matches by operation name.

**Q: Can I inspect the request body in the handler?**
A: Yes. `http.post('/api/data', async ({ request }) => { const body = await request.json(); return HttpResponse.json({ received: body }) })`.

**Q: Does MSW slow down tests?**
A: Negligibly. Handler matching is O(n) in the number of handlers. For typical test suites, the overhead is under 1ms per request.

---

## Examples

### Example 1: Conditional response based on request body

```typescript
http.post('/api/auth/login', async ({ request }) => {
  const { email } = await request.json() as { email: string }
  if (email === 'admin@test.com') {
    return HttpResponse.json({ role: 'admin', token: 'mock-token' })
  }
  return HttpResponse.json({ role: 'user', token: 'mock-token' })
})
```

### Example 2: Paginated response

```typescript
http.get('/api/courses', ({ request }) => {
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page') || '1')
  const perPage = Number(url.searchParams.get('per_page') || '10')
  const total = 100
  const items = Array.from({ length: perPage }, (_, i) => ({
    id: String((page - 1) * perPage + i + 1),
    title: `Course ${(page - 1) * perPage + i + 1}`,
  }))
  return HttpResponse.json({ items, total, page, perPage })
})
```

---

## Key Takeaways

- MSW intercepts at HTTP level — transparent to app code using standard fetch/axios
- Same handlers work in dev (browser SW) and test (Node interceptor)
- `server.listen()` in `beforeAll`, `server.resetHandlers()` in `afterEach`, `server.close()` in `afterAll`
- Override handlers per-test with `server.use()` for specific scenarios
- `HttpResponse.error()` simulates network failures; `delay()` simulates latency
- `onUnhandledRequest: 'error'` catches missing mocks in tests
- In dev, use `onUnhandledRequest: 'warn'` to avoid crashing on unmocked endpoints

---

## Common Misconception

**"MSW is just another mocking library — similar to nock or jest.spyOn."**

MSW fundamentally differs: it intercepts at the HTTP level, not the module level. Your app code doesn't know it's mocked. The same handlers work in both dev (Service Worker) and test (Node interceptor). This is architectural — it tests real HTTP flows, not mocked function calls.

---

## Feynman Explain

(Explain MSW architecture in 2 sentences: what it intercepts, how, and why sharing handlers between dev and test is valuable.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain testing 2` — AI will probe your explanation for gaps.*

---

## Reframe

(Pause. Judge: is MSW always better than custom proxy patterns? When would the __setRPC approach be simpler? Write your evaluation.)

---

## Drill

Take the quiz. MCQs test different angles — recall, application, scenario.

Run: `learn.sh quiz testing 2`
