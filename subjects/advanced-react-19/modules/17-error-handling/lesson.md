# Module 17: Error Handling — Boundaries, Recoverable Errors, Logging

Est. study time: 2h
Language: en

## Learning Objectives
- Build error boundaries for render-phase crashes using class component lifecycle methods
- Design recoverable error patterns with retry, reset, and telemetry integration
- Handle Action and Server Action errors with useActionState and client-side fallbacks
- Choose boundary granularity and async error strategies per component type

---

## Core Content

### ErrorBoundary Class Component: componentDidCatch and getDerivedStateFromError

React has no built-in way to catch render errors in functional components (no hook equivalent). Error boundaries use class component lifecycle methods:

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Called during render phase. Returns state update.
    // Must be pure — no side effects.
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Called during commit phase. Side effects allowed.
    // Log to error reporting service here.
    console.error('Error caught:', error, 'Component stack:', info.componentStack)
    this.props.onError?.(error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <div>Something went wrong.</div>
    }
    return this.props.children
  }
}
```

Key distinction:
- `getDerivedStateFromError` — render phase, must be pure. Transitions component to error state.
- `componentDidCatch` — commit phase, side effects OK. Use for logging, telemetry, error reporting.

> **Think**: Why can't `componentDidCatch` alone set error state? Why two methods?
>
> *Answer: `componentDidCatch` runs during commit phase — after React has already committed the broken render. Calling `setState` there triggers a second render pass (synchronous re-render). `getDerivedStateFromError` runs during render phase, so React can show fallback in the same commit. The two-phase design avoids double-render flash.*

### ErrorBoundary + Suspense Composition Patterns

ErrorBoundary and Suspense compose hierarchically but handle different failure modes:

| Component | Handles | Mechanism |
|-----------|---------|-----------|
| ErrorBoundary | Render crash, uncaught exception | Catches thrown error, shows fallback |
| Suspense | Pending Promise | Shows fallback until promise resolves |

Pattern: ErrorBoundary wraps Suspense for resilient async sections:

```typescript
function UserProfile({ userId }: { userId: string }) {
  return (
    <ErrorBoundary fallback={<ProfileErrorUI />}>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserData userId={userId} />
      </Suspense>
    </ErrorBoundary>
  )
}
```

Behavior:
1. Promise thrown (UserData suspends) → Suspense shows skeleton
2. Promise rejects with error → error propagates up to ErrorBoundary → ErrorBoundary shows fallback
3. Promise resolves → UserData renders normally

Nesting order matters. ErrorBoundary outside Suspense catches rejections from the suspending component AND errors in the Suspense boundary itself. ErrorBoundary inside Suspense would get replaced by Suspense fallback on re-suspend.

> **Think**: You have a dashboard with widget grid. Each widget fetches independently. Should each widget have its own (ErrorBoundary + Suspense), or one pair for the whole grid?
>
> *Answer: Each widget. If one widget crashes or suspends, the others keep working. Single boundary for entire grid means one failed widget takes down all widgets. Granularity per widget gives resilience per widget.*

### Recoverable Errors: ErrorBoundary with Retry

Error boundaries can provide recovery via a `retry` mechanism:

```typescript
interface RecoveryBoundaryState {
  hasError: boolean
  error: Error | null
  key: number
}

class RecoveryBoundary extends React.Component<
  ErrorBoundaryProps,
  RecoveryBoundaryState
> {
  state: RecoveryBoundaryState = { hasError: false, error: null, key: 0 }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleRetry = () => {
    // Increment key forces React to unmount + remount children
    // This clears any stale state that caused the crash
    this.setState(prev => ({
      hasError: false,
      error: null,
      key: prev.key + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>Retry</button>
        </div>
      )
    }
    return <div key={this.state.key}>{this.props.children}</div>
  }
}
```

Key insight: React does not recover from a crashed subtree on its own. You must unmount + remount children to clear the crashed state. The `key` prop change is the standard pattern — React sees a new element, destroys old, mounts fresh.

Common recovery strategies:
- **Retry with key increment**: Full remount. Destroys all child state.
- **Retry with backoff**: Count retries, show exponential backoff timer.
- **Retry with partial recovery**: Keep parent state, only remount crashed section using key.

> **Think**: After retry, the component crashes again immediately. What should you do?
>
> *Answer: Track retry count. After 3 attempts, show unrecoverable error UI with "contact support" rather than infinite retry loop. Unmount + remount will not fix a persistent bug — only a transient failure (network blip, race condition).*

### Error Logging with Telemetry

Error boundaries integrate with error reporting services (Sentry, Datadog, Rollbar, Bugsnag):

```typescript
class MonitoredBoundary extends React.Component<{
  children: React.ReactNode
  componentName: string
}> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Send structured error report
    reportError({
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      component: {
        name: this.props.componentName,
        stack: info.componentStack,
      },
      metadata: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      },
      severity: 'error',
    })
  }

  render() {
    if (this.state.hasError) {
      return <GeneralErrorUI />
    }
    return this.props.children
  }
}
```

Best practices for error logging:
- **Include component stack**: `info.componentStack` shows where in the component tree the error occurred — more actionable than JavaScript stack alone.
- **Deduplicate errors**: Group identical error messages + component paths. One component crashing on mount for every user should produce 1 alert, not 10,000.
- **Add breadcrumbs**: Log preceding user actions leading to the crash. Helps reproduce.
- **Ignore expected errors**: Network timeouts, aborted requests. Only alert on unexpected failures.

> **Think**: getDerivedStateFromError is pure — you cannot log there. componentDidCatch can log. What happens if the logging service itself throws?
>
> *Answer: componentDidCatch runs during commit phase and errors there are NOT caught by the same boundary — they propagate to parent boundary. Wrap logging in try-catch to prevent a logging failure from cascading to a parent boundary. Never let telemetry become a crash vector.*

### React 19 Action Errors: useActionState

React 19 Actions shift error handling from try-catch in event handlers to declarative error state:

```typescript
import { useActionState } from 'react'

interface FormState {
  error: string | null
  success: boolean
}

async function submitForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const result = await api.createUser(formData)
    return { error: null, success: true }
  } catch (err) {
    // Return structured error — React does not catch this for you
    return {
      error: err instanceof ApiError
        ? err.message
        : 'Unexpected error. Please try again.',
      success: false,
    }
  }
}

function SignupForm() {
  const [state, formAction, isPending] = useActionState(submitForm, {
    error: null,
    success: false,
  })

  return (
    <form action={formAction}>
      {state.error && <div role="alert">{state.error}</div>}
      {state.success && <div>Account created!</div>}
      <input name="email" type="email" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Submitting...' : 'Sign Up'}
      </button>
    </form>
  )
}
```

Key difference from render errors: Action errors are NOT caught by ErrorBoundary. Actions run in event handlers, not during render. The error is handled via return value, not thrown exception. This means:
- ErrorBoundary does NOT catch Action errors
- You must handle Action errors explicitly via state returned from the action function
- ErrorBoundary only catches errors thrown during render phase

> **Think**: An Action throws an uncaught exception instead of returning an error state. What happens?
>
> *Answer: The uncaught exception propagates to the event handler scope. It is NOT caught by ErrorBoundary (render only). In development, React logs to console. In production, the error is swallowed — the form hangs. Always catch inside the action function and return error state. Never let Actions throw to the caller.*

### Server Action Errors: Throwing from Server, Handling on Client

Server Actions run on the server. Errors thrown inside Server Actions serialize to the client:

```typescript
'use server'

export async function updateProfile(formData: FormData) {
  const email = formData.get('email')
  
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Invalid email address')
  }

  await db.users.update({ email })
  return { success: true }
}
```

Client side:

```typescript
function ProfileForm() {
  const [state, formAction, isPending] = useActionState(
    async (prev: { error?: string }, formData: FormData) => {
      try {
        return await updateProfile(formData)
      } catch (err) {
        // err.message is the server-thrown Error message
        // This is safe — only the message serializes, not the stack
        return {
          error: err instanceof Error ? err.message : 'Server error',
        }
      }
    },
    {}
  )

  return (
    <form action={formAction}>
      {state?.error && <div role="alert">{state.error}</div>}
      <input name="email" type="email" />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
```

Safety note: Only `error.message` serializes across the server-client boundary. Stack traces, server internals, and database error details do NOT leak. Do not expose internal error details in user-facing messages. Map server errors to user-friendly messages on the client.

> **Think**: A Server Action throws a database connection error. The error message contains the database hostname. Should you display this to the user?
>
> *Answer: No. Server error messages may leak infrastructure details. Always catch server errors and map them to generic user messages on the client. Log full error details server-side for debugging; send sanitized messages to the client.*

### Event Handler Errors vs Render Errors

React handles errors differently depending on where they occur:

| Error location | Caught by ErrorBoundary? | Recovery |
|----------------|--------------------------|----------|
| Render (return from component) | Yes | getDerivedStateFromError → fallback UI |
| Lifecycle (componentDidMount) | Yes | Same as render |
| Event handler (onClick, onSubmit) | No | Must handle with try-catch |
| useEffect callback | No | Must handle inside effect |
| Server Action | No | Must return error state |
| Async function (setTimeout, Promise) | No | Must handle with .catch or try-catch |

Why event handler errors are NOT caught by ErrorBoundary:
- React wraps event handlers in a try-catch internally
- React re-throws in development only (for dev tooling)
- In production, React swallows the error — your app keeps running but the handler fails silently

This is intentional: an error in one button click should not unmount the entire UI subtree. Error boundaries protect render integrity. Event handler errors are scoped to the interaction.

```typescript
// Wrong — render error caught by boundary, event error not caught
function BadExample() {
  return (
    <ErrorBoundary>
      <button onClick={() => { throw new Error('click oops') }}>
        Click me
      </button>
    </ErrorBoundary>
  )
}

// Right — event handler error handled inline
function GoodExample() {
  const handleClick = () => {
    try {
      doSomethingRisky()
    } catch (err) {
      showToast('Action failed')
      logError(err)
    }
  }

  return (
    <ErrorBoundary>
      <button onClick={handleClick}>Click me</button>
    </ErrorBoundary>
  )
}
```

> **Think**: A form's onSubmit handler throws. The ErrorBoundary wrapping the form does not catch it. The submit button becomes unresponsive. How do you handle this?
>
> *Answer: Wrap onSubmit body in try-catch. Set error state for display. Optionally show toast + retry button. Never rely on ErrorBoundary for event handler errors. They cover different error scopes.*

### Boundary Granularity: Per-Section vs Global

Error boundary placement determines blast radius:

```typescript
// Pattern 1: Single global boundary — ONE crash takes down entire app
function App() {
  return (
    <ErrorBoundary fallback={<FullPageError />}>
      <Header />
      <Sidebar />
      <MainContent />
      <Footer />
    </ErrorBoundary>
  )
}

// Pattern 2: Per-section boundaries — crashes are isolated
function App() {
  return (
    <>
      <ErrorBoundary fallback={<HeaderError />}>
        <Header />
      </ErrorBoundary>
      <ErrorBoundary fallback={<SidebarError />}>
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary fallback={<MainError />}>
        <MainContent />
      </ErrorBoundary>
      <Footer />
    </>
  )
}

// Pattern 3: Hybrid — global for catastrophic, per-section for features
function App() {
  return (
    <ErrorBoundary fallback={<FullPageError />}>
      <Header />
      <ErrorBoundary fallback={<SidebarError />}>
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError />}>
        <WidgetGrid />
      </ErrorBoundary>
      <Footer />
    </ErrorBoundary>
  )
}
```

Guidelines:
- **Global boundary**: Always have one at the root. Catches genuinely unexpected crashes. Shows full-page error with reload button.
- **Feature boundaries**: Per route, per widget, per modal. Limits crash blast radius to one feature.
- **No boundary for leaf elements**: A button crashing during render is extremely rare. You do not need a boundary for every `<Button>`. Focus on async data boundaries, feature-level sections, and third-party component wrappers.
- **Third-party component boundary**: Wrap third-party libraries that may throw (charts, rich text editors, maps). You cannot control their error behavior.

> **Think**: A chart library (recharts, visx) throws in its render method because of bad data. Where should you place the boundary?
>
> *Answer: Boundary wrapping the chart component specifically. This way: (1) chart crashes show a chart-specific fallback (placeholder), (2) surrounding page content stays intact, (3) you can add retry for the chart without re-mounting entire page. Global boundary would unmount everything.*

### Async Error Handling in Server Components

Server Components can throw errors during rendering on the server. These propagate differently:

```typescript
// Server Component — throws during server-side rendering
async function UserProfile({ userId }: { userId: string }) {
  const user = await db.users.findById(userId)
  
  if (!user) {
    throw new Error('User not found')  // ✗ throws during render
  }

  return <div>{user.name}</div>
}
```

Server Component errors are caught by the nearest ErrorBoundary on the client (with caveats):

- **Static rendering**: Error during build → build fails. No runtime recovery.
- **Dynamic (SSR)**: Error during server render → React sends error to client ErrorBoundary if hydrated. If SSR fails entirely, client renders fallback.
- **Streaming SSR**: Error in one Server Component segment → React closes that segment and sends error to client ErrorBoundary. Remaining segments continue streaming.

For `use()` in Server Components (promise reading):

```typescript
function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  // use() rejects → error propagates to nearest ErrorBoundary on client
  const comments = use(commentsPromise)
  return <CommentList comments={comments} />
}
```

Rejected promises from `use()` behave identically to thrown errors during render. The parent ErrorBoundary (client-side) catches them.

> **Think**: A Server Component fetches data. The database is down. Does the entire page fail or just the data section?
>
> *Answer: Depends on ErrorBoundary placement. If the data-fetching Server Component has no parent Suspense + ErrorBoundary, the error propagates up until caught or crashes the page. If wrapped in ErrorBoundary (client) + Suspense, only that section shows fallback. Always wrap async Server Component sections with both Suspense (loading) and ErrorBoundary (error).*

### Uncaught Errors and React Crash Recovery

Some errors cannot be caught by ErrorBoundary:

- **Errors in event handlers** (not during render)
- **Errors in asynchronous code** (setTimeout, requestAnimationFrame)
- **Errors in SSR during streaming** (before hydration)
- **JavaScript syntax/runtime errors** (undefined is not a function in external script)
- **Errors in error boundary itself** (cascades to parent boundary)

For truly uncaught errors, use `window.onerror` and `window.addEventListener('unhandledrejection')`:

```typescript
// Global fallback — last resort
window.addEventListener('error', (event) => {
  logErrorToService({
    error: event.error,
    type: 'uncaught',
    url: window.location.href,
  })
  
  // Optional: show overlay in development
  if (process.env.NODE_ENV === 'development') {
    showErrorOverlay(event.error)
  }
})

window.addEventListener('unhandledrejection', (event) => {
  logErrorToService({
    error: event.reason,
    type: 'unhandled_promise_rejection',
    url: window.location.href,
  })
})
```

React 19 SSR improvements: If a component crashes during server rendering, React can recover by falling back to client-side rendering for that section. This is a change from React 18 where a server crash would fail the entire SSR response.

React crash recovery checklist:
1. Global ErrorBoundary at root (render crashes)
2. Feature boundaries per section (section crashes)
3. Error boundary wrapping third-party components (external crashes)
4. try-catch in event handlers (interaction crashes)
5. useActionState error state for actions (data mutation crashes)
6. window.onerror / unhandledrejection listeners (everything else)
7. Retry logic with max attempts (transient crash recovery)
8. Monitoring + alerting on crash rate (observability)

> **Think**: An app has a global ErrorBoundary but still shows a broken UI — the state management store is corrupted even after error recovery. What went wrong?
>
> *Answer: Key-based remount (incrementing key) unmounts the crashed subtree but does NOT reset external state (Redux store, Zustand, URL params). If the error corrupted external state, fresh mount re-reads corrupted state and crashes again. Recovery must also reset any external state that caused the crash — or the bug is persistent.*

---

### Why This Matters

Error handling is the difference between a broken app and a resilient app. Users forgive occasional failures when they see graceful fallbacks + retry. They abandon apps that show white screens or cryptic error messages. ErrorBoundary + retry + logging is the minimum bar for production React. React 19 adds Actions which require a different error model — understanding which errors ErrorBoundary catches (render) and which it does not (actions, events) is critical. Without this, teams ship fragile UIs that crash silently.

---

### Common Questions

**Q: Can I use React hooks inside an ErrorBoundary class component?**
A: No. Error boundaries must be class components because no hook equivalent exists for `componentDidCatch` or `getDerivedStateFromError`. Wrap the boundary in a functional component with hooks for composition: hooks live in the wrapper, lifecycle methods in the class.

**Q: Does ErrorBoundary catch errors in SSR?**
A: Partially. During SSR, `getDerivedStateFromError` runs but there is no commit phase (no DOM), so `componentDidCatch` does not run. In React 19, a server crash can fall back to client rendering. Your error boundary only activates after hydration on the client.

**Q: What is the difference between resetting with key vs setState?**
A: Key replacement destroys and remounts the entire child tree — all component state, effects, refs are reset. setState only updates the boundary's error state. Children keep their internal state, which may still be corrupted. Use key for full reset, setState for showing/hiding fallback UI.

**Q: Should I log errors from getDerivedStateFromError?**
A: No. It must be pure — no side effects, no API calls. Logging belongs in `componentDidCatch`. If you attempt to log in `getDerivedStateFromError`, React may call it multiple times (during retries, concurrent rendering, StrictMode double-invoke) producing duplicate logs.

**Q: How do error boundaries interact with React 19's new concurrent features?**
A: During concurrent rendering, React may call `getDerivedStateFromError` but then discard the render if a higher-priority update interrupts. The error state from a discarded render is never committed. `componentDidCatch` only fires when the error state is committed, so logging is accurate.

---

## Examples

### Example 1: Resilient Data Widget with Retry and Telemetry

**Problem**: Dashboard shows a real-time chart for each metric. Charts are third-party. Network blips cause render crashes. Need graceful degradation + recovery + Sentry logging.

**Solution**:

```typescript
interface MetricWidgetProps {
  metricId: string
  fetchData: (id: string) => Promise<DataPoint[]>
}

function MetricWidget(props: MetricWidgetProps) {
  return (
    <ErrorBoundaryWithRetry maxRetries={3} componentName={`MetricWidget-${props.metricId}`}>
      <Suspense fallback={<WidgetSkeleton />}>
        <ChartContent {...props} />
      </Suspense>
    </ErrorBoundaryWithRetry>
  )
}

class ErrorBoundaryWithRetry extends React.Component<{
  children: React.ReactNode
  maxRetries: number
  componentName: string
}> {
  state = { hasError: false, error: null as Error | null, retries: 0, key: 0 }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Send to Sentry
    Sentry.captureException(error, {
      tags: { component: this.props.componentName },
      contexts: { react: { componentStack: info.componentStack } },
    })
  }

  handleRetry = () => {
    const nextRetries = this.state.retries + 1
    if (nextRetries >= this.props.maxRetries) {
      this.setState({
        hasError: true,
        error: new Error('Max retries exceeded'),
      })
      return
    }
    this.setState(prev => ({
      hasError: false,
      error: null,
      retries: nextRetries,
      key: prev.key + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <WidgetError
          message={this.state.error?.message}
          retriesLeft={this.props.maxRetries - this.state.retries}
          onRetry={this.handleRetry}
        />
      )
    }
    return <div key={this.state.key}>{this.props.children}</div>
  }
}
```

**Result**: Widget crashes show a chart-specific error card with retry button. After 3 failed retries, shows "unavailable" placeholder. Other widgets unaffected. Full error context logged to Sentry.

### Example 2: Action Error Handling for a Multi-Step Form

**Problem**: Checkout form with 3 steps. Each step submits via Server Action. Network errors, validation errors, and server errors must display per-step without losing form data.

**Solution**:

```typescript
interface CheckoutState {
  step: number
  error: string | null
  fieldErrors: Record<string, string>
}

async function submitStep(
  prev: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  try {
    const result = await submitCheckoutStep(prev.step, formData)

    if (!result.success) {
      return {
        ...prev,
        error: null,
        fieldErrors: result.fieldErrors ?? {},
      }
    }

    return { ...prev, step: prev.step + 1, error: null, fieldErrors: {} }
  } catch (err) {
    // Catch network/server errors, but do not advance step
    return {
      ...prev,
      error: err instanceof Error ? err.message : 'Checkout failed. Try again.',
      fieldErrors: {},
    }
  }
}

function CheckoutForm() {
  const [state, formAction, isPending] = useActionState(submitStep, {
    step: 1,
    error: null,
    fieldErrors: {},
  })

  return (
    <form action={formAction}>
      {state.error && (
        <div role="alert" className="error-banner">
          {state.error}
          <button type="submit">Retry</button>
        </div>
      )}

      {state.step === 1 && <ShippingStep fieldErrors={state.fieldErrors} />}
      {state.step === 2 && <PaymentStep fieldErrors={state.fieldErrors} />}
      {state.step === 3 && <ConfirmationStep />}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Processing...' : state.step === 3 ? 'Place Order' : 'Next'}
      </button>
    </form>
  )
}
```

**Result**: Server Action errors show inline error banner with retry. Validation errors highlight specific fields. Step never advances on failure — form data preserved. No ErrorBoundary needed for these errors since they occur in Actions, not render.

---

## Key Takeaways
- ErrorBoundary is class-component only — no hook equivalent exists
- `getDerivedStateFromError` (pure render phase) + `componentDidCatch` (side effects in commit phase)
- Key-based remount is the standard recovery pattern — React cannot recover a crashed subtree otherwise
- ErrorBoundary does NOT catch event handler, Action, or async errors
- Use `useActionState` return value for Action error handling — never let Actions throw
- Server Action errors serialize `error.message` only — map to user-friendly messages on client
- Per-section boundaries limit crash blast radius; global boundary catches unexpected failures
- Rejected promises from `use()` propagate to ErrorBoundary like thrown errors
- Third-party components should always be wrapped in their own ErrorBoundary
- Combine global ErrorBoundary + feature boundaries + try-catch + unhandledrejection listener for full coverage

## Common Misconception

**"ErrorBoundary catches all errors in my React app."**

ErrorBoundary only catches errors thrown during the render phase and lifecycle methods (componentDidMount, componentDidUpdate, componentWillUnmount). It does NOT catch:
- Event handler errors (onClick, onSubmit) — those happen outside render
- Action errors (useActionState) — handled via return state, not thrown exceptions
- Async errors (setTimeout, fetch callbacks, Promise chains) — run outside React's error boundary
- Server Action errors — serialized across network, not thrown on client
- Errors in the ErrorBoundary itself — cascades to parent boundary

This is by design. React separates render integrity (boundary territory) from interaction errors (event handler territory). Teams that assume ErrorBoundary is universal leave gaps in event handler and Action error coverage. Always use the right error handling mechanism per error location.

---

## Feynman Explain
(Explain error boundaries to a junior developer who knows React basics but has never used class components. They understand functional components, hooks, try-catch. Use no class-component jargon. Focus on what problem ErrorBoundary solves, where it works, and where try-catch is still needed.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Error boundaries require class components in 2025. Is this a design debt in React? Server Actions shift error handling to return values — is this better or worse than throw-try-catch? Write your evaluation. Consider: why hooks cannot replace componentDidCatch, whether Actions' error-return model is more explicit, and what a hook-based error boundary API would look like.)

---

## Drill
Take the quiz. MCQs test error boundary placement, recovery patterns, Action error handling, and boundary granularity decisions.

Run: `learn.sh quiz advanced-react-19 17-error-handling`
