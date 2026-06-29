# Module 9: MSW Deep Dive — Advanced Patterns

Est. study time: 2h
Language: en
Description: Advanced MSW patterns: GraphQL mocking, lifecycle hooks, handler organization, error simulation, and request inspection.

## Learning Objectives
- Mock GraphQL endpoints with MSW's graphql handler
- Structure handlers for maintainability at scale
- Use lifecycle hooks for authentication and common setup
- Inspect and assert on requests in tests
- Simulate network errors and latency patterns

---

## Core Content

### 9.1 GraphQL Mocking

MSW has built-in `graphql` handler — matches by operation name.

```typescript
import { graphql, HttpResponse } from 'msw'

export const handlers = [
  graphql.query('GetCourses', () => {
    return HttpResponse.json({
      data: {
        courses: [
          { id: '1', title: 'React Testing', lessons: [] },
        ],
      },
    })
  }),

  graphql.mutation('CreateCourse', async ({ variables }) => {
    return HttpResponse.json({
      data: {
        createCourse: {
          id: 'new-1',
          title: variables.title,
          lessons: [],
        },
      },
    })
  }),
]
```

**Query matching:** MSW matches by operation name (`GetCourses`, `CreateCourse`). No need to match full query string.

**Dynamic responses from variables:**

```typescript
graphql.query('GetCourse', ({ variables }) => {
  return HttpResponse.json({
    data: {
      course: {
        id: variables.id,
        title: `Course ${variables.id}`,
        lessons: [],
      },
    },
  })
})
```

**GraphQL errors:**

```typescript
graphql.query('GetCourses', () => {
  return HttpResponse.json({
    data: null,
    errors: [{ message: 'Authentication required', locations: [], path: ['courses'] }],
  })
})
```

> **Think**: How does MSW match GraphQL operations without parsing the query string?
>
> *Answer: MSW intercepts the HTTP request, parses the JSON body to extract `operationName` (for queries/mutations) and matches against the registered handler. The handler never needs the full query string.*

### 9.2 Handler Organization at Scale

As handler count grows, organization matters.

**Small app (10-20 handlers):** Single file.

```
src/mocks/
├── browser.ts
├── server.ts
├── handlers.ts          ← all handlers
```

**Medium app (20-50 handlers):** Group by domain.

```
src/mocks/
├── browser.ts
├── server.ts
├── handlers.ts           ← aggregates all domain handlers
├── domains/
│   ├── courses.ts
│   ├── auth.ts
│   ├── quiz.ts
│   └── progress.ts
```

```typescript
// handlers.ts
import { courseHandlers } from './domains/courses'
import { authHandlers } from './domains/auth'
import { quizHandlers } from './domains/quiz'
import { progressHandlers } from './domains/progress'

export const handlers = [
  ...courseHandlers,
  ...authHandlers,
  ...quizHandlers,
  ...progressHandlers,
]
```

**Large app (50+ handlers):** Add per-test handler factories.

```typescript
// domains/courses.ts
export const courseHandlers = [
  http.get('/api/courses', () => {
    return HttpResponse.json(courseFixtures.basic)
  }),
  http.get('/api/courses/:id', ({ params }) => {
    return HttpResponse.json(courseFixtures.byId[params.id as string])
  }),
]

// For tests that need specific data:
export function createCourseHandler(overrides: Partial<Course>) {
  return http.get('/api/courses/:id', () => {
    return HttpResponse.json({ ...courseFixtures.default, ...overrides })
  })
}
```

> **Think**: When do domain-specific fixtures become necessary?
>
> *Answer: When the shared handler data is too generic (every test changes it with server.use) or when fixtures grow complex enough to need their own maintainable structure.*

### 9.3 Lifecycle and Authentication

Many endpoints require authentication headers. MSW can validate these.

```typescript
import { http, HttpResponse } from 'msw'

function isAuthenticated(request: Request): boolean {
  return request.headers.get('Authorization')?.startsWith('Bearer ') ?? false
}

export const handlers = [
  http.get('/api/user/profile', ({ request }) => {
    if (!isAuthenticated(request)) {
      return HttpResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = request.headers.get('Authorization')!.slice(7)
    // Decode or look up user from token
    return HttpResponse.json({
      id: '1',
      name: 'Alice',
      email: 'alice@test.com',
    })
  }),
]
```

**Testing authenticated endpoints:**

```typescript
test('returns profile when authenticated', async () => {
  render(<ProfilePage />, {
    wrapper: ({ children }) => (
      <AuthProvider token="mock-token">{children}</AuthProvider>
    ),
  })

  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})

test('redirects to login when unauthenticated', async () => {
  render(<ProfilePage />, {
    wrapper: ({ children }) => (
      <AuthProvider token={null}>{children}</AuthProvider>
    ),
  })

  await waitFor(() => {
    expect(screen.getByText('Please log in')).toBeInTheDocument()
  })
})
```

**Lifecycle hooks for common setup:**

```typescript
// test-setup.ts
import { server } from './mocks/server'

// Set default auth state
beforeAll(() => {
  server.use(
    http.get('/api/user/profile', () => {
      return HttpResponse.json({ id: '1', name: 'Default User' })
    })
  )
})

beforeEach(() => {
  server.resetHandlers() // clears per-test overrides but NOT the beforeAll handler
})
```

> **Think**: What's the issue with setting auth state in beforeAll using server.use?
>
> *Answer: server.use in beforeAll persists for all tests. If one test needs an unauthenticated state, it must override with server.use for that specific handler. resetHandlers in beforeEach does NOT remove beforeAll handlers — they're part of the shared handlers list.*

### 9.4 Request Inspection and Assertions

Assert on what requests were made during a test.

```typescript
import { http, HttpResponse } from 'msw'

test('sends correct payload on save', async () => {
  let capturedBody: unknown

  server.use(
    http.put('/api/courses/:id', async ({ request, params }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ success: true })
    })
  )

  await user.click(screen.getByRole('button', { name: /save/i }))

  expect(capturedBody).toEqual({ title: 'Updated Course', status: 'published' })
})
```

**Counting requests:**

```typescript
test('only fetches once when multiple components mount', async () => {
  let callCount = 0

  server.use(
    http.get('/api/courses', () => {
      callCount++
      return HttpResponse.json([])
    })
  )

  render(
    <>
      <CourseList />
      <CourseSidebar />
    </>
  )

  await waitFor(() => {
    expect(callCount).toBe(1) // deduplicated by store
  })
})
```

**Request timing assertions:**

```typescript
test('debounces search input', async () => {
  let lastCallTime = 0
  const callTimes: number[] = []

  server.use(
    http.get('/api/search', () => {
      const now = Date.now()
      callTimes.push(now - lastCallTime)
      lastCallTime = now
      return HttpResponse.json([])
    })
  )

  const user = userEvent.setup()
  render(<SearchBox />)
  const input = screen.getByRole('searchbox')

  await user.type(input, 'rea')
  // Without debounce: 3 rapid calls
  // With debounce: 1 call after delay

  await waitFor(() => {
    expect(callTimes.length).toBe(1)
  })
})
```

> **Think**: What pattern does request counting catch that a normal behavior test might miss?
>
> *Answer: Multiple API calls for the same data (no deduplication), missing debounce/throttle, race conditions where two requests interleave incorrectly.*

### 9.5 Error Simulation Patterns

```typescript
// Network error (connection dropped)
http.get('/api/data', () => HttpResponse.error())

// Custom error type
http.get('/api/data', () => {
  const error = new TypeError('Failed to fetch')
  return HttpResponse.error() // equivalent
})

// Specific HTTP errors
http.get('/api/data', () =>
  HttpResponse.json({ error: 'Not found' }, { status: 404 })
)
http.get('/api/data', () =>
  HttpResponse.json({ error: 'Server error' }, { status: 500 })
)
http.get('/api/data', () =>
  new HttpResponse(null, { status: 429, headers: { 'Retry-After': '30' } })
)

// Timeout / never resolves
http.get('/api/data', async () => {
  await delay('infinite')
})

// Slow response
http.get('/api/data', async () => {
  await delay(3000) // Simulate 3s latency
  return HttpResponse.json({ data: 'slow response' })
})

// Malformed response (invalid JSON)
http.get('/api/data', () =>
  new HttpResponse('not-json-at-all', { headers: { 'Content-Type': 'application/json' } })
)
```

**Error simulation factory for reuse:**

```typescript
// test-utils/msw-helpers.ts
export function withNetworkError() {
  return http.get('/api/courses', () => HttpResponse.error())
}

export function withTimeout(ms = 5000) {
  return http.get('/api/courses', async () => {
    await delay(ms)
    return HttpResponse.json([])
  })
}

export function withServerError() {
  return http.get('/api/courses', () =>
    HttpResponse.json({ error: 'Server Error' }, { status: 500 })
  )
}
```

### 9.6 Testing with MSW and React Query

MSW pairs naturally with React Query — Mock API, test all query states.

```typescript
function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: () => fetch('/api/courses').then(r => r.json()),
  })
}

test('shows loading state', () => {
  server.use(
    http.get('/api/courses', async () => {
      await delay('infinite')
    })
  )

  render(<CourseList />)
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})

test('shows error state', async () => {
  server.use(
    http.get('/api/courses', () => HttpResponse.error())
  )

  render(<CourseList />)
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument()
  })
})

test('shows data state', async () => {
  render(<CourseList />) // uses default handlers
  await waitFor(() => {
    expect(screen.getByText('Course 1')).toBeInTheDocument()
  })
})
```

---

## Why This Matters

MSW scales from simple REST mocking to complex GraphQL APIs, authenticated endpoints, and custom error scenarios. Advanced patterns let you test edge cases (network errors, timeouts, race conditions) that are hard to reproduce with real backends.

---

## Common Questions

**Q: Can MSW handle file uploads?**
A: Yes. Intercept the multipart/form-data request, parse formData() from the request.

**Q: How do I reset MSW between tests without losing shared handlers?**
A: server.resetHandlers() restores only the handlers passed to setupServer. Use server.restoreHandlers() to remove all runtime-added handlers.

**Q: Can I use MSW with Playwright for E2E?**
A: Yes, MSW has Playwright integration. Use msw/browser to start the worker in the Playwright browser context.

---

## Key Takeaways

- GraphQL mocking matches by operation name — no query string needed
- Organize handlers by domain at scale (one file per domain)
- Validate authentication in handlers; test both authenticated and unauthenticated paths
- Capture and assert on requests for call count, payload, and timing
- MSW + React Query tests all query states: loading, error, data

---

## Common Misconception

**"MSW can't handle complex GraphQL operations."**

MSW's graphql handler supports queries, mutations, and subscriptions. Use variables for dynamic responses and errors array for error simulation. The handler receives the full operation context.

---

## Feynman Explain

(Explain how you'd set up MSW for a React app using GraphQL. Walk through handler organization for 30+ endpoints, authentication middleware, and a test that verifies the correct mutation payload was sent.)

---

## Drill

Run: `learn.sh quiz testing 9`
