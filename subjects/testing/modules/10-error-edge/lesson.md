# Module 10: Error and Edge Path Testing

Est. study time: 2h
Language: en
Description: Systematic approach to testing failures, edge cases, and input boundaries.

## Learning Objectives
- Apply expect.soft for multi-field assertions without early exit
- Build test.each matrices covering input edge cases
- Write error path tests that prove error handling works
- Distinguish between testing error UI vs error handling logic

---

## Core Content

### 10.1 Why Error Paths Matter

Most tests cover the happy path. Error paths reveal:
- Unhandled promise rejections
- Inconsistent error states (loading stays true after error)
- Missing error messages
- Catch blocks that swallow errors silently

Reader project SKILL.md: "API failures, malformed data, network timeouts. Use deleteMock() from test-utils to remove a mock (triggers 'No mock' rejection), or use mockErrorResponse() to inject a specific Error."

```typescript
// ❌ Common bug — loading stays true on error
load: async () => {
  set({ loading: true })
  try {
    const data = await api.fetch()
    set({ data, loading: false })
  } catch (err) {
    // ❌ Forgot to set loading: false
    set({ error: (err as Error).message })
  }
}

// ✅ Error path test catches this
test('loading is false after error', async () => {
  server.use(http.get('/api/data', () => HttpResponse.error()))
  await store.getState().load()
  await flushMicrotasks()
  const state = store.getState()
  expect(state.loading).toBe(false) // Would fail without the fix
})
```

> **Think**: Why do error path bugs survive code review but get caught by tests?
>
> *Answer: Humans trace the happy path during review. The error path branches are mentally skipped ("that shouldn't happen"). A test forces the error to happen and verifies the state is correct.*

### 10.2 expect.soft — Get All Failures

Normally, vitest stops at the first assertion failure. `expect.soft` marks it as failed but continues to the next assertion.

```typescript
// ❌ Reports only the first failure
expect(state.loading).toBe(false) // Fails here, stops
expect(state.error).toBe('API Error') // Never reached

// ✅ Reports all failures
expect.soft(state.loading).toBe(false)
expect.soft(state.error).toBe('API Error')
expect.soft(state.data).toBeNull()
```

**When to use expect.soft:**
- Multi-field state validation (store state after action)
- Form validation (multiple field errors)
- API response shape validation (all required fields)

**When NOT to use:**
- Single assertion tests (no benefit)
- When you want early exit (security checks, fatal errors)

> **Think**: What's the cost of always using expect.soft?
>
> *Answer: Performance — vitest continues running assertions that will fail. For most tests the cost is negligible. The benefit is getting complete failure context in one test run.*

### 10.3 test.each — Edge Case Matrix

`test.each` runs the same test body with different inputs. Essential for edge case coverage.

```typescript
describe('validateEmail', () => {
  test.each([
    { input: 'user@example.com', expected: true },
    { input: 'user@', expected: false },
    { input: '@example.com', expected: false },
    { input: '', expected: false },
    { input: null, expected: false },
    { input: 'user@.com', expected: false },
    { input: 'user@example.com.', expected: false },
    { input: 'user+tag@example.com', expected: true },
    { input: 'a'.repeat(255) + '@example.com', expected: false },
  ])('validateEmail($input) → $expected', ({ input, expected }) => {
    expect(validateEmail(input)).toBe(expected)
  })
})
```

**Pattern for store state validation:**

```typescript
describe('courseStore.loadCourses', () => {
  test.each([
    { status: 200, body: [{ id: '1' }], expectedError: null, expectedCourses: 1 },
    { status: 500, body: null, expectedError: 'HTTP 500', expectedCourses: 0 },
    { status: 404, body: null, expectedError: 'HTTP 404', expectedCourses: 0 },
    { status: 200, body: null, expectedError: null, expectedCourses: 0 },
    { status: 200, body: [], expectedError: null, expectedCourses: 0 },
  ])(
    'handles HTTP $status with body=$body → error=$expectedError, courses=$expectedCourses',
    async ({ status, body, expectedError, expectedCourses }) => {
      server.use(
        http.get('/api/courses', () =>
          body !== null
            ? HttpResponse.json(body, { status })
            : new HttpResponse(null, { status })
        )
      )

      await store.getState().loadCourses()
      await flushMicrotasks()

      const state = store.getState()
      if (expectedError) {
        expect(state.error).toContain(expectedError)
      } else {
        expect(state.error).toBeNull()
      }
      expect(state.courses).toHaveLength(expectedCourses)
    }
  )
})
```

**Matrix dimensions to cover:**
- Empty / null / undefined input
- Single element / max elements
- Boundary values (0, max, overflow)
- Malformed data (wrong types, missing fields)
- Special characters / unicode

> **Think**: What's the minimum edge case test for a function that processes an array?
>
> *Answer: Empty array, single element, undefined/null input, and large array (performance check). These four cases cover the common failure modes.*

### 10.4 Error Path Categories

**Network errors:**

```typescript
// Connection failure
server.use(http.get('/api/courses', () => HttpResponse.error()))
expect(state.error).toContain('Failed to fetch')

// Timeout
server.use(http.get('/api/courses', async () => { await delay('infinite') }))
// Code should time out and set error

// Malformed response
server.use(http.get('/api/courses', () =>
  new HttpResponse('not-json', { headers: { 'Content-Type': 'application/json' } })
))
expect(state.error).toContain('JSON')
```

**HTTP errors:**

```typescript
test.each([
  { status: 401, message: /unauthorized/i },
  { status: 403, message: /forbidden/i },
  { status: 404, message: /not found/i },
  { status: 429, message: /rate limit/i },
  { status: 500, message: /server error/i },
  { status: 503, message: /unavailable/i },
])('handles HTTP $status', async ({ status, message }) => {
  server.use(http.get('/api/data', () =>
    new HttpResponse(null, { status })
  ))
  await store.getState().load()
  await flushMicrotasks()
  expect(store.getState().error).toMatch(message)
})
```

**Data errors:**

```typescript
// Missing field
server.use(http.get('/api/courses', () =>
  HttpResponse.json([{ name: 'No ID' }]) // missing 'id'
))
// Should handle gracefully

// Wrong type
server.use(http.get('/api/courses', () =>
  HttpResponse.json({ courses: "not-an-array" })
))
// Should handle gracefully

// Null/empty
server.use(http.get('/api/courses', () =>
  HttpResponse.json(null)
))
expect(state.courses).toEqual([]) // Should default to empty array
```

> **Think**: What's the difference between testing HTTP 500 and network error?
>
> *Answer: HTTP 500 — fetch succeeds (response.ok is false). Network error — fetch throws (rejected promise). They exercise different code paths: one in the .ok check, one in the catch block.*

### 10.5 Error UI Tests

Beyond store state, test that errors render correctly:

```typescript
test('shows error message with retry button', async () => {
  server.use(http.get('/api/courses', () =>
    HttpResponse.json({ error: 'Server Error' }, { status: 500 })
  ))

  render(<CourseList />)
  await waitFor(() => {
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})

test('retry button fetches again', async () => {
  let callCount = 0
  server.use(
    http.get('/api/courses', () => {
      callCount++
      return callCount === 1
        ? HttpResponse.json({ error: 'Error' }, { status: 500 })
        : HttpResponse.json([{ id: '1', title: 'Success' }])
    })
  )

  render(<CourseList />)
  await screen.findByText(/failed to load/i)
  await user.click(screen.getByRole('button', { name: /retry/i }))

  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument()
  })
  expect(callCount).toBe(2)
})
```

### 10.6 Error Recovery Testing

Test that the app recovers from errors and continues working:

```typescript
test('recovers after temporary failure', async () => {
  let callCount = 0
  server.use(
    http.get('/api/courses', () => {
      callCount++
      if (callCount === 1) return HttpResponse.error()
      return HttpResponse.json([{ id: '1', title: 'Recovered' }])
    })
  )

  // First try — fails
  await store.getState().loadCourses()
  await flushMicrotasks()
  expect(store.getState().error).toBeTruthy()

  // Second try — succeeds
  await store.getState().loadCourses()
  await flushMicrotasks()
  expect(store.getState().courses).toHaveLength(1)
  expect(store.getState().error).toBeNull()
})
```

---

## Why This Matters

Error paths are where applications fail in production. Testing them ensures your error handling actually works — users see helpful messages, not blank screens or unhandled promise rejections.

---

## Key Takeaways

- Error path tests catch real bugs humans miss in code review
- expect.soft reports all failures, not just the first
- test.each covers edge case matrix systematically
- Test network errors (rejected fetch), HTTP errors (non-2xx), and data errors (wrong types)
- Test error UI: message visibility, retry button, recovery flow
- Error recovery tests verify the app returns to正常工作 after failures

---

## Common Misconception

**"Error path tests are low priority — the happy path is what users see."**

Users see error paths more than you think: network issues, server errors, rate limits, and malformed data. Error path tests prevent production support incidents by catching unhandled cases before deployment.

---

## Feynman Explain

(Explain the difference between testing an HTTP 500 error (server responded) and a network error (connection failed). What code paths do they exercise? Give a real example of each breaking differently.)

---

## Drill

Run: `learn.sh quiz testing 10`
