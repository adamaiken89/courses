# Module 12: Routing — TanStack Router

Est. study time: 2h
Language: en

## Learning Objectives
- Define type-safe route trees with TypeScript generics
- Parse and validate search params with zod schemas
- Implement nested layouts with Outlet and route groups
- Add route-level code splitting with lazy()
- Build route guards and middleware with beforeLoad

---

## Core Content

### TanStack Router Architecture

TanStack Router is the first type-safe router for React. Key concepts:
- Route tree defined as TypeScript tree structure (not config object)
- Full type inference — params, search, path, loader data all typed
- File-based routing (optional via `@tanstack/react-router-plugin`)
- First-class search param validation (zod, valibot, or custom)

```typescript
import { Router, Route, RootRoute } from '@tanstack/react-router'
import { z } from 'zod'

const rootRoute = new RootRoute()

const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const productListRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'products',
  component: ProductList,
})

const productDetailRoute = new Route({
  getParentRoute: () => productListRoute,
  path: '$productId',
  component: ProductDetail,
  validateSearch: z.object({
    tab: z.enum(['details', 'reviews', 'specs']).optional().default('details'),
    from: z.string().optional(),
  }),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  productListRoute.addChildren([productDetailRoute]),
])

const router = new Router({ routeTree })
export type AppRouter = typeof router
```

### Type-Safe Route Tree

Every route in TanStack Router generates types:

```typescript
// Type-safe navigation — invalid path is compile error
function Nav() {
  const navigate = useNavigate()

  return (
    <button onClick={() => navigate({ to: '/products/$productId', params: { productId: '123' }, search: { tab: 'reviews' } })}>
      View Product
    </button>
  )
}

// Type-safe link
<Link
  to="/products/$productId"
  params={{ productId: '123' }}
  search={{ tab: 'details', from: '/home' }}
  activeProps={{ className: 'font-bold' }}
>
  Product 123
</Link>
```

Router type must be exported and used across app:

```typescript
// app/router.ts
export const router = new Router({ routeTree })
export type AppRouter = typeof router

// main.tsx
import { RouterProvider } from '@tanstack/react-router'
import { router } from './app/router'

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
```

### Search Params with Zod

Search params are first-class citizens — not just query string strings:

```typescript
const productListRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'products',
  validateSearch: z.object({
    q: z.string().optional().catch(undefined),
    page: z.coerce.number().int().positive().optional().default(1),
    sort: z.enum(['name', 'price', 'date']).optional().default('name'),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
    category: z.array(z.string()).optional().catch([]),
  }),
})
```

`catch()` handles malformed values silently. `default()` sets value when param is absent. `z.coerce.number()` handles string → number conversion from URL.

Using search params in component:

```typescript
function ProductFilters() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <div>
      <input
        value={search.q ?? ''}
        onChange={e => navigate({ search: prev => ({ ...prev, q: e.target.value || undefined }) })}
      />
      <select
        value={search.sort}
        onChange={e => navigate({ search: prev => ({ ...prev, sort: e.target.value as SortOption }) })}
      >
        <option value="name">Name</option>
        <option value="price">Price</option>
      </select>
    </div>
  )
}
```

> **Think**: Zod search validation lives in route definition. What happens when search validation changes and user has invalid URL in browser history?
>
> *Answer: `catch()` returns fallback instead of throwing. Without catch, invalid search causes route error which TanStack Router catches and redirects to error boundary. Design search schemas to be backward-compatible or use migration pattern.*

### Nested Layouts with Outlet

Routes form parent-child tree. Parent renders `<Outlet />` for child content:

```typescript
const rootRoute = new RootRoute({
  component: () => (
    <div>
      <AppHeader />
      <main>
        <Outlet />
      </main>
      <AppFooter />
    </div>
  ),
})

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'dashboard',
  component: () => (
    <div style={{ display: 'flex' }}>
      <DashboardSidebar />
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  ),
})
```

Layout components receive `useMatches()` for breadcrumbs:

```typescript
function Breadcrumbs() {
  const matches = useMatches()
  return (
    <nav>
      {matches.map(m => (
        <Link key={m.routeId} to={m.routeId} params={m.params}>
          {m.routeId}
        </Link>
      ))}
    </nav>
  )
}
```

### Route-Level Code Splitting

Combine with `React.lazy()` or dynamic import:

```typescript
const SettingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: React.lazy(() => import('./pages/settings')),
  pendingComponent: () => <SettingsSkeleton />,
})
```

TanStack Router has built-in pending state support:

```typescript
const heavyRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'analytics',
  component: AnalyticsDashboard,
  pendingComponent: DashboardSkeleton,
  loader: async () => {
    const data = await fetchAnalytics()
    return data
  },
  wrapInSuspense: true, // wraps loader in Suspense boundary
})
```

### Loaders and Data Fetching

Route loaders run before component renders:

```typescript
const productDetailRoute = new Route({
  getParentRoute: () => productListRoute,
  path: '$productId',
  component: ProductDetail,
  loader: async ({ params: { productId } }) => {
    const product = await api.getProduct(productId)
    return { product }
  },
  errorComponent: ProductError,
  pendingComponent: ProductSkeleton,
})

function ProductDetail() {
  const { product } = Route.useLoaderData()
  return <div>{product.name}</div>
}
```

Data persists across navigation — re-fetches only when route deactivates/reactivates. Use `preload()` for prefetching:

```typescript
<Link
  to="/products/$productId"
  params={{ productId: id }}
  preload="intent" // hover-dependent preload
>
  {name}
</Link>
```

### Route Guards / Middleware

`beforeLoad` runs before route loads. Return redirect or throw to block:

```typescript
const authRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'admin',
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw router.navigate({ to: '/login', search: { redirect: location.href } })
    }
    if (!context.auth.hasRole('admin')) {
      throw router.navigate({ to: '/403' })
    }
  },
  component: AdminDashboard,
})
```

Context injection via Router:

```typescript
const router = new Router({
  routeTree,
  context: { auth: authService },
})

// Type-safe context
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

> **Think**: beforeLoad runs on every navigation to guarded route. How to skip guard for same-route param changes?
>
> *Answer: beforeLoad runs on route activation only (not param changes within same route). For param-based guards, use useBlocker or useEffect in component. TanStack Router distinguishes route activation vs param update.*

---

### Why This Matters

React Router is the most-used router but lacks type safety — params, search, and loader data are `any`. TanStack Router catches routing errors at compile time: missing params, invalid search values, mismatched loader types. For apps with complex routing (nested layouts, search-heavy pages, auth guards), type safety eliminates an entire class of runtime errors.

---

### Common Questions

**Q: TanStack Router vs React Router — which to choose?**
A: TanStack Router for: type safety, zod search validation, nested layouts, first-class loaders. React Router for: simpler apps, SSR-heavy projects (Remix), smaller bundle. Migration from React Router is incremental — wrap existing routes gradually.

**Q: How to handle modals with routing?**
A: Nested routes under parent overlay. Modal route renders modal component. Use `router.history.push` for modal open, `router.history.go(-1)` for close. Search param for modal state: `?modal=create-product`.

**Q: Does TanStack Router work with Next.js App Router?**
A: No — Next.js App Router replaces TanStack Router. Use TanStack Router with Vite, CRA, or custom SSR. For Next.js, use built-in router.

---

## Examples

### Example 1: Product Catalog with Search, Pagination, and Filters

**Problem**: Products page with URL-driven search/filter/sort/pagination. All state in URL — shareable, bookmarkable.

**Solution**:
```typescript
const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().default(1),
  sort: z.enum(['name', 'price', 'date']).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  minPrice: z.coerce.number().optional().catch(undefined),
  maxPrice: z.coerce.number().optional().catch(undefined),
})

const catalogRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'catalog',
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps: { search } }) => {
    const products = await api.searchProducts(search)
    return { products }
  },
  component: CatalogPage,
})

function CatalogPage() {
  const { products } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()

  function setPage(page: number) {
    navigate({ search: prev => ({ ...prev, page }) })
  }

  return <ProductGrid products={products} page={search.page} onPageChange={setPage} />
}
```

### Example 2: Multi-Step Onboarding Flow

**Problem**: Wizard-style onboarding with 3 steps. Each step is separate route. Back/forward preserves state. Final step submits.

**Solution**:
```typescript
const onboardingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'onboarding',
  component: () => (
    <div>
      <ProgressBar />
      <Outlet />
    </div>
  ),
})

const step1Route = new Route({
  getParentRoute: () => onboardingRoute,
  path: 'profile',
  component: ProfileStep,
})

const step2Route = new Route({
  getParentRoute: () => onboardingRoute,
  path: 'preferences',
  component: PreferencesStep,
})

const step3Route = new Route({
  getParentRoute: () => onboardingRoute,
  path: 'confirm',
  component: ConfirmStep,
  loader: async () => {
    // Validate all previous steps before showing confirm
    return { isComplete: true }
  },
})
```

---

## Key Takeaways
- Route tree is TypeScript tree — full type inference for params, search, loader data
- `validateSearch` with zod catches malformed search params, provides defaults
- Nested routes with `<Outlet />` build layout hierarchies
- `beforeLoad` runs auth guards, redirects, context injection
- `loader` fetches data before render — integrates with Suspense via `wrapInSuspense`
- Code split with `React.lazy(() => import('./page'))` + `pendingComponent`
- Preload routes with `preload="intent"` for instant navigation

## Common Misconception

**"TanStack Router is just React Router with more TypeScript."**

TanStack Router fundamentally changes routing architecture: (1) route tree as code (not config), (2) search params are first-class with validation, (3) loaders integrate with Suspense and error boundaries, (4) full type inference eliminates `any` casts. React Router v7 (formerly Remix) has added some type safety, but does not match TanStack Router's depth.

---

## Feynman Explain
(Explain TanStack Router's type safety to a React Router user: "Every `useParams()` call in React Router returns `Record<string, string | undefined>`. You either cast or risk runtime crash. In TanStack Router, the param types are known at compile time from the route tree definition. Same for search params, loader data, and context.")

---

## Reframe
(Pause. Type-safe routing is compelling. What about projects with simple routing (5 routes, no search params, no auth guards)? Does TanStack Router's route tree API add unnecessary ceremony? Consider: bundle size ~12KB vs React Router ~7KB, learning curve for junior devs, migration cost from existing router.)

---

## Drill
Take the quiz. MCQs test route tree definition, search validation, loaders, nested layouts, and route guards.

Run: `learn.sh quiz external-lib-patterns 12-routing-tanstack-router`
