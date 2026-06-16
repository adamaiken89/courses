# Module 19: Micro-Frontends — Module Federation, Shared State, Boundaries

Est. study time: 2h
Language: en

## Learning Objectives
- Architect micro-frontends using Module Federation with Webpack 5 / Rspack
- Manage shared state, routing, and communication across federated apps
- Apply boundaries: styling isolation, error containment, independent deployments
- Compose Server Components across micro-frontend boundaries

---

## Core Content

### Module Federation — Webpack 5 / Rspack

Module Federation lets separate builds share code at runtime. Each micro-frontend is its own webpack build. One app (shell) exposes a container; remote apps expose modules the container loads.

**Concepts:**

| Term | Meaning |
|------|---------|
| Host | App that loads remotes — usually shell |
| Remote | App that exposes modules for other apps |
| Shared | Dependencies configured as singletons (e.g., React) |
| Container | Runtimes module registry — webpack-generated entry |

Webpack 5 config (host):

```typescript
// webpack.config.js
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    dashboard: 'dashboard@http://cdn.example.com/dashboard/remoteEntry.js',
    checkout: 'checkout@http://cdn.example.com/checkout/remoteEntry.js',
  },
  shared: {
    react: { singleton: true, requiredVersion: '^19.0.0' },
    'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
  },
})
```

Rspack (Rust-based webpack-compatible bundler):

```typescript
// rspack.config.js — identical API
new rspack.container.ModuleFederationPlugin({
  name: 'dashboard',
  exposes: {
    './Dashboard': './src/Dashboard',
  },
  shared: {
    react: { singleton: true },
  },
})
```

> **Think**: Why does React need `singleton: true` in Module Federation? What happens if two remotes load different React versions?
>
> *Answer: React uses internal module-scoped state (fiber tree, event system). Two copies of React create two fiber trees — context, hooks, events break. Singleton forces one copy. Version conflicts require aligning peer deps or using `eager: true` + fallback. If A requires React 19 and B requires React 18, one app breaks.*

### React 19 — Shared Singleton, Version Conflicts

React 19 amplifies singleton pressure: `use()` hook, Server Components, Actions, and compiler-generated code all depend on single React runtime.

**Strategies:**

1. **Align versions across teams** — standardize on one React version. CI enforces via shared config package.

2. **Federation `shared` fallback** — if remote has React 19.1 and host has React 19.0, webpack picks highest satisfying version. Only works with semver-compatible ranges.

3. **Eager loading** — host loads React eagerly, remotes skip bundling React. Reduces duplication but requires deployment coordination.

```typescript
shared: {
  react: {
    singleton: true,
    requiredVersion: '^19.0.0',
    eager: true, // host provides eagerly
  },
}
```

4. **Module Federation wrapper** — wrap federated component in version-check wrapper:

```typescript
function FederatedComponent({ remote, module }: Props) {
  const Component = React.lazy(() =>
    import(remote).then(m => ({ default: m[module] }))
  )
  return (
    <ErrorBoundary fallback={<p>Micro-frontend unavailable</p>}>
      <Suspense fallback={<Spinner />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )
}
```

> **Think**: Your checkout team ships React 19.0. Your dashboard team ships React 19.2. Federation `requiredVersion: '^19.0.0'` picks 19.2. Dashboard tests pass. Checkout tests break. Why?
>
> *Answer: React 19.2 may have behavior changes or removed APIs used by checkout's internal deps. Federation picks highest matching version, not safest. Each team must test against the shared version.*

### Micro-Frontend Routing — Shell Pattern

Shell owns primary router (React Router v7). Sub-apps own internal routes.

**Shell router:**

```typescript
// Shell app — React Router v7
function ShellRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/dashboard/*" element={<DashboardWrapper />} />
          <Route path="/checkout/*" element={<CheckoutWrapper />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

// Wrapper passes context to federated remote
function DashboardWrapper() {
  const basename = '/dashboard'
  return (
    <MicroFrontendApp
      remote="dashboard"
      module="./Dashboard"
      basename={basename}
    />
  )
}
```

**Sub-app router** (dashboard remote):

```typescript
// Dashboard remote — receives basename from shell
function DashboardApp({ basename }: { basename: string }) {
  return (
    <MemoryRouter initialEntries={[basename]}>
      {/* Routes use relative paths */}
      <Routes>
        <Route path="/dashboard" element={<Overview />} />
        <Route path="/dashboard/reports" element={<Reports />} />
      </Routes>
    </MemoryRouter>
  )
}
```

Key: sub-apps use `MemoryRouter` or receive full URL path. Shell owns the address bar. Routing coordination: shell navigates via `history.push`, sub-apps listen via custom event or shared bus.

> **Think**: User navigates to `/dashboard/reports` in shell. Dashboard remote must render Reports page. Who extracts the sub-path? Who handles 404 within dashboard?
>
> *Answer: Shell passes basename `/dashboard`. Dashboard remote uses relative routing. Dashboard remote handles its own 404 for `/dashboard/xyz`. Shell catches 404 only when no remote route matches. Coordination: shell strips prefix, remote renders from basename.*

### Shared State Across Micro-Frontends

**Four approaches ranked by coupling:**

| Approach | Coupling | Latency | Complexity |
|----------|----------|---------|------------|
| Custom events | Low | Sync | Low |
| Shared bus (Zustand) | Medium | Sync | Medium |
| Context bridge | High | Sync | High |
| iframe postMessage | None | Async | Medium |

**1. Custom events** — least coupling:

```typescript
// Shell fires event
window.dispatchEvent(
  new CustomEvent('mf:auth-change', { detail: { user, token } })
)

// Remote listens
useEffect(() => {
  const handler = (e: CustomEvent) => {
    setUser(e.detail.user)
  }
  window.addEventListener('mf:auth-change', handler)
  return () => window.removeEventListener('mf:auth-change', handler)
}, [])
```

**2. Shared store (Zustand)** — create store in shell, import in remotes via shared dependency:

```typescript
// Shell — exposes Zustand storeModuleFederationPlugin({
  exposes: {
    './store': './src/store',
  },
  shared: { zustand: { singleton: true } },
})

// Remote — imports store from shell
import { useBoundStore } from 'shell/store'

function CartBadge() {
  const count = useBoundStore(state => state.cartCount)
  return <Badge>{count}</Badge>
}
```

**3. Context bridge** — React context across remotes:

```typescript
// Shell wraps federated component with context provider object
function Shell() {
  return (
    <ThemeProvider theme={theme}>
      <UserProvider user={user}>
        <FederatedComponent remote="dashboard" module="./App" />
      </UserProvider>
    </ThemeProvider>
  )
}
```

> **Think**: Context bridge works across micro-frontends. Does React context in shell propagate into remote app? What is the constraint?
>
> *Answer: Yes — but only if React is a shared singleton. Two React instances create separate context trees. Singleton React ensures context flows through. Constraint: both apps run in same browser context (not iframes).*

> **Think**: Custom events vs shared Zustand store: when would you pick shared store?
>
> *Answer: Shared store when >3 micro-frontends read/write same state (user, cart, theme). Custom events when state flows one direction (auth change → all apps re-login). Store gives devtools, persistence, selectors. Events give decoupling — sender does not know receivers.*

### Styling Boundaries — CSS Isolation

CSS leaks across micro-frontends. Class name collisions produce visual bugs.

**CSS Modules** — bundler-scoped class names:

```typescript
// dashboard/src/Button.module.css
.button { background: blue; }

// dashboard/src/Button.tsx
import styles from './Button.module.css'
function Button() { return <button className={styles.button} /> }
// Renders: <button class="Button_button_abc123" />
```

**Shadow DOM** — complete isolation:

```typescript
function MicroFrontendRoot() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const shadow = ref.current!.attachShadow({ mode: 'open' })
    const root = createRoot(shadow)
    root.render(<MicroApp />)
    return () => root.unmount()
  }, [])
  return <div ref={ref} />
}
```

Trade-offs:

| Approach | Isolation | Performance | Interop |
|----------|-----------|-------------|---------|
| CSS Modules | Class-scoped only | Zero | Full (DOM in same document) |
| Shadow DOM | Full (DOM, CSS, events) | Mount cost | Events retarget, forms break |
| CSS-in-JS | Per-component | Runtime cost | Full interop |

> **Think**: Shadow DOM isolates CSS completely. What breaks when a micro-frontend renders in shadow DOM?
>
> *Answer: Event retargeting — click events bubble out of shadow DOM with retargeted target (shadow root, not actual element). Form submissions inside shadow DOM are invisible to outer document. Third-party scripts (analytics, error trackers) may not see shadow DOM content. Portal-based modals may escape shadow boundary.*

### Cross-App Communication

**1. Window-level custom events** — best for broadcast:

```typescript
// Remote dashboard emits
const event = new CustomEvent('mf:navigate', { detail: { to: '/checkout' } })
window.dispatchEvent(event)

// Shell listens
useEffect(() => {
  const fn = (e: CustomEvent) => navigate(e.detail.to)
  window.addEventListener('mf:navigate', fn)
  return () => window.removeEventListener('mf:navigate', fn)
}, [navigate])
```

**2. Shared event bus** — pub/sub library shared via federation:

```typescript
// Shared event-bus package (singleton)
type Events = { userChanged: { id: string }; cartUpdated: { count: number } }
export const bus = {
  listeners: new Map(),
  on<K extends keyof Events>(k: K, fn: (d: Events[K]) => void) { ... },
  emit<K extends keyof Events>(k: K, d: Events[K]) { ... },
}
```

**3. iframe postMessage** — for third-party / untrusted micro-frontends:

```typescript
// Iframe host
iframeRef.current.contentWindow!.postMessage(
  { type: 'AUTH', payload: { token } },
  'https://trusted-origin.com'
)

// Iframe remote
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://shell.com') return
  if (e.data.type === 'AUTH') setToken(e.data.payload.token)
})
```

> **Think**: postMessage is secure (origin check). What performance cost does iframe-based micro-frontend pay?
>
> *Answer: Full page-load per iframe — HTML, CSS, JS, React root mount. Memory doubles (separate JS heap per iframe). Communication is async (message queue). Lazy-mount iframes and use shared worker for data to reduce per-iframe JS memory.*

### Server Components with Micro-Frontends

React 19 Server Components (RSC) challenge micro-frontend boundaries. RSC runs on server — modules are not on CDN.

**Composition strategies:**

**1. Server-only shell** — RSC at shell level. Remote components are Client Components:

```typescript
// Shell (RSC)
import RemoteDashboard from 'dashboard/Dashboard'
// Remote Dashboard must be Client Component or RSC-compatible build

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RemoteDashboard />
    </Suspense>
  )
}
```

**2. RSC module federation** — experimental. Remote exposes RSC payload stream:

```typescript
// Webpack 5 + RSC plugin
new ModuleFederationPlugin({
  exposes: {
    './rsc/dashboard': 'http://internal/dashboard/rsc',
    // RSC endpoint returns RSC Payload (stream)
  },
})
```

Shell fetches RSC stream from remote server, renders on server, sends HTML to client. Remotes must support RSC transport protocol.

> **Think**: RSC micro-frontend vs client-only micro-frontend: which one makes deployment coordination harder?
>
> *Answer: RSC micro-frontend requires remote servers to be reachable at server-render time. If dashboard remote server is down, shell SSR fails for the entire page. Client-only micro-frontend degrades to error fallback gracefully. RSC micro-frontends need independent server infrastructure and coordinated rollouts for server-side changes.*

### Performance — Lazy Loading, Chunk Splitting, Preloading

**Lazy loading** — load remote only when route matches:

```typescript
// Shell — lazy load remote entry
const DashboardApp = React.lazy(() =>
  import('dashboard/Dashboard').catch(() => ({
    default: () => <ErrorFallback />
  }))
)

function DashboardRoute() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardApp />
    </Suspense>
  )
}
```

**Preloading** — load remote before user navigates:

```typescript
// Preload on hover
<Link
  to="/dashboard"
  onMouseEnter={() => {
    // start preloading remote entry
    const link = document.createElement('link')
    link.rel = 'modulepreload'
    link.href = 'https://cdn.example.com/dashboard/remoteEntry.js'
    document.head.appendChild(link)
  }}
/>
```

**Chunk splitting** — each remote splits its own chunks:

```typescript
// Remote webpack config
output: {
  chunkFilename: '[name].[contenthash].js',
},
// Ensures remote updates do not invalidate shell chunks
```

> **Think**: Shell preloads dashboard remote on hover. User never navigates to dashboard — wasted bandwidth. Acceptable trade-off?
>
> *Answer: Yes — remoteEntry.js is typically 2-6 KB (module registry, not app code). The actual app chunks load only on navigation. Preloading remoteEntry is cheap insurance. App chunks should load on actual route activation, not on preload.*

### Deployment Strategies — Independent vs Coordinated

| Strategy | Coordination | Risk | Rollback |
|----------|-------------|------|----------|
| Independent | None per team | Version mismatch, integration bugs | Per-app |
| Coordinated | Release train (weekly) | Stale deploys wait | Coordinated |
| Hybrid | Independent + smoke tests | Edge cases | Per-app |

**Independent:**

```yaml
# dashboard CI
deploy:
  script: npm run build && aws s3 sync dist/ s3://mfe-dashboard/
  # No coordination with shell or checkout
```

**Coordinated** — all remotes deploy same day, same React version, tested together.

**Hybrid** — teams deploy independently, but CI runs integration suite against production shell + staging remotes:

```yaml
# Every remote PR triggers
integration-test:
  script:
    - npm run build
    - npm run test:integration -- --host=production --remotes=staging
```

> **Think**: Independent deploys let teams ship fast. What breaks when shell deploys new feature that expects updated dashboard remote — but dashboard deploys 2 days later?
>
> *Answer: Feature flag. Shell feature behind flag. Dashboard team toggles flag when ready. No flag = users see broken page. Module Federation's `shared` version negotiation can also degrade gracefully — but missing module API contracts are the real failure point.*

### Error Isolation — Crash Containment

Each micro-frontend in its own ErrorBoundary. One remote crashing must not take down shell or other remotes.

```typescript
// Shell — per-remote error boundary
function RemoteErrorBoundary({ children, name }: Props) {
  return (
    <ErrorBoundary
      fallback={
        <div role="alert">
          <h2>{name} unavailable</h2>
          <p>Contact support if this persists.</p>
        </div>
      }
      onError={(error) => {
        console.error(`[${name}]`, error)
        // report to error tracker with remote identifier
        reportError({ remote: name, error: error.message })
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
```

**Additional isolation patterns:**

1. **Module-level ErrorBoundary** — wraps each exposed component, not just shell wrapper
2. **Crash-only design** — crashed micro-frontend remounts on navigation (MemoryRouter reset)
3. **Health check** — shell pings remote health endpoint before loading:

```typescript
async function loadRemoteWithHealthCheck(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/health`)
    return res.ok
  } catch {
    return false
  }
}
```

> **Think**: Dashboard remote throws during render. Shell ErrorBoundary catches it. Dashboard had open WebSocket connections, timers, third-party scripts. What leaks?
>
> *Answer: Effect cleanup runs on unmount (if remote unmounts). But if remote crashes mid-render, effects never mounted — so they cannot clean up. WebSocket stays open. Timer keeps firing. Solution: remote should use singleton cleanup registry that shell can invoke on crash.*

---

### Why This Matters

Micro-frontends let large teams ship independently. Module Federation makes this practical by sharing dependencies at runtime instead of duplicating them. React 19 raises the stakes: singleton React is mandatory, RSC composition introduces server-side coupling, and error isolation becomes critical when multiple React roots coexist. Teams that master boundaries — state, style, routing, errors — scale React apps across dozens of teams without monolith collapse.

---

### Common Questions

**Q: Micro-frontend vs monorepo — what is the real difference?**
A: Monorepo is a single build with multiple packages. Micro-frontend is separate builds loaded at runtime. Monorepo gives shared types, single version, simple refactoring. Micro-frontend gives independent deploys, technology isolation, team-scale autonomy. Choose monorepo unless you need independent deploy cadence or polyglot tech stacks.

**Q: Does Module Federation work with Next.js / App Router?**
A: Yes — Next.js has `@module-federation/nextjs-mf` plugin for both Pages and App Router. However, RSC and server actions create additional constraints: federated Server Components must expose RSC payload endpoints, not just client bundles. In practice, most Next.js micro-frontends use client-only federation and keep shell-level RSC.

**Q: How do I share TypeScript types across micro-frontends?**
A: You do not share types at runtime — they are compile-time only. Use monorepo shared types package published as npm dependency consumed by each micro-frontend build. Module Federation does not share types. Use `@module-federation/typescript` plugin for limited auto-export, but the primary mechanism is the shared types package.

**Q: Can I mix React 18 and React 19 micro-frontends in one shell?**
A: Technically yes (each remote can bundle its own React), but not with singleton React. If you need singleton (for context, hooks, event system), all remotes must share one React version. Mixed versions require non-singleton mode — which means separate React roots, no context sharing, and doubled bundle size. Do not recommend.

**Q: Micro-frontend performance: how much overhead does federation add?**
A: remoteEntry.js ~2-6 KB. Network waterfall: shell JS → remote entry → remote app chunk. Total +1-2 round trips vs single-bundle app. Bundle size increases slightly (shared dep negotiation code). Tree-shaking across remotes is impossible because each is a separate build. Acceptable for apps where each remote is >50 KB.

---

## Examples

### Example 1: E-Commerce Shell with Three Micro-Frontends

**Problem**: E-commerce app with 80 engineers across 4 teams (Product, Cart, Checkout, Account). Each team ships weekly. Monolith build takes 45 minutes, integration bugs on every deploy.

**Architecture**:

```
Shell (Product team owns)
├── Product pages — built-in
├── Cart — federated remote (cart.mf.cdn.com)
├── Checkout — federated remote (checkout.mf.cdn.com)
└── Account — federated remote (account.mf.cdn.com)
```

**Key decisions**:
- React 19 singleton, shared via `ModuleFederationPlugin.shared`
- Shell owns routing (`/cart/*`, `/checkout/*`)
- Shared Zustand store for cart count, user auth
- CSS Modules per remote — no style leakage
- Each remote in `ErrorBoundary` with per-team fallback

**Result**:
- Build time: 45 min → 8 min per team
- Deploy frequency: biweekly → daily per team
- Integration bugs: reduced by cross-remote integration test suite
- Bundle: 320 KB shell + ~150 KB each lazy remote

### Example 2: Composing RSC Across Micro-Frontends

**Problem**: Travel booking site. Flight search is server-rendered (API aggregation). Hotel booking is client-heavy (maps, calendar). Both teams micro-frontends.

**Architecture**:

```
Shell (RSC)
├── FlightSearch (RSC remote) — server-rendered, streams RSC payload
├── HotelBooking (client remote) — lazy loaded, client-rendered
└── Shared auth context
```

**Key decisions**:
- Shell uses Next.js App Router
- FlightSearch remote exposes `/rsc/flights` endpoint returning RSC payload
- Shell fetches RSC stream during server render, embeds in page
- HotelBooking loads as client component with Suspense
- Error isolation: FlightSearch failure renders shell skeleton (HTTP streaming handles timeout); HotelBooking failure shows error boundary

**Result**:
- Flight search page: First Contentful Paint 1.2s (fully server-rendered)
- Hotel booking page: 800 KB client bundle (maps, galleries) loads on navigation
- Flight team deploys independently from hotel team

---

## Key Takeaways
- Module Federation lets separate builds share code at runtime via webpack container
- React must be a shared singleton — two React versions create broken context trees
- Shell owns primary router; sub-apps use MemoryRouter or receive basename
- Share state via custom events (low coupling), shared Zustand store (medium), or context bridge (high)
- CSS Modules provide class-scoped isolation; Shadow DOM provides full isolation but breaks event/forms interop
- RSC micro-frontends need server-to-server RPC and degrade differently from client-only MFE
- Each micro-frontend needs its own ErrorBoundary — crash isolation is not optional
- Independent deploys require feature flags or integration contract testing
- Preloading remoteEntry.js is cheap; actual app chunks load on route activation
- Deployment strategies: independent (fast per-team), coordinated (safe), hybrid (balanced)

## Common Misconception

**"Micro-frontends = iframes."**

Micro-frontends are not iframes. iframes isolate completely — separate JS heap, separate React root, async communication. Module Federation micro-frontends run in the same document, share the same React root, and communicate synchronously. The only similarity is "deploy independently." Iframes are a fallback for untrusted third-party code or polyglot stacks. True micro-frontends share the same runtime, same DOM, and same dependency graph — coordinated by the shell.

---

## Feynman Explain
(Explain Module Federation to a developer who knows React but has never worked with micro-frontends. Use the metaphor: "Imagine each team's app is a separate library on a CDN. The shell app is like a library catalog that loads books on demand — except all books share the same dictionary (React).")

*When ready, say explanation aloud or write it down. Then run `learn.sh explain advanced-react-19` — AI probes gaps.*

---

## Reframe
(Pause. Judge: Module Federation adds network waterfall, version negotiation complexity, and integration testing burden. When does micro-frontend overhead outweigh monolith simplicity? Consider team size < 5, stable scope, or tight-coupling domains like real-time collaborative editing. Write your trade-off analysis.)

---

## Drill
Take the quiz. MCQs practice federation config, state sharing, routing, and error isolation.

Run: `learn.sh quiz advanced-react-19 19-micro-frontends`
