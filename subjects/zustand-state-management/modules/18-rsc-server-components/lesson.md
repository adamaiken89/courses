# Module 18: Zustand with Server Components — Client Store Boundaries

Est. study time: 2h
Language: en

## Learning Objectives
- Design Zustand store boundaries in RSC architecture: `use client` isolation rules
- Implement server-to-client data hydration via serialized props
- Manage per-request store instances vs singleton stores in RSC context
- Build e-commerce cart flow: RSC fetches product data + Zustand manages client cart

---

## Core Content

### Stores Are Client-Only: The `use client` Rule

React Server Components run exclusively on the server. They cannot use hooks, context, or client-side state. Zustand stores depend on React context and subscription — they are client-only.

```typescript
// ❌ WRONG — Server Component cannot use Zustand
// page.tsx (Server Component by default)
import { useCartStore } from './stores/cart'

export default function Page() {
  const items = useCartStore(state => state.items) // TypeError: Cannot read from store
  return <div>{items.length}</div>
}
```

```typescript
// ✅ CORRECT — Isolate store behind `use client`
// CartToggle.tsx — Client Component boundary
'use client'

import { useCartStore } from './stores/cart'

export function CartToggle() {
  const count = useCartStore(state => state.items.length)
  return <button>Cart ({count})</button>
}
```

Rule: Zustand stores and any component calling `useStore` must be in a file with `'use client'` directive. The store file itself does not need `'use client'` — only components that consume it.

> **Think**: Can a Zustand store definition file import from a Server Component? What happens if the store definition contains `useEffect`?
>
> *Answer: Store definition (no hooks, no JSX) can live outside `'use client'`. But if store definition uses `useEffect` — e.g., `persist` middleware subscribing to `localStorage` — it must be client-only. Keep store definitions pure: `create((set) => ({...}))` without lifecycle. Move side effects to client components.*

### Passing Initial State from Server to Client: Hydration Pattern

Server Components fetch data. Client stores need initial state. The bridge: serialize server data as props, hydrate store on mount.

```typescript
// page.tsx — Server Component
import { ProductList } from './ProductList'
import { getProducts } from './api'

export default async function Page() {
  const products = await getProducts() // server-side fetch
  return <ProductList initialProducts={products} />
}
```

```typescript
// ProductList.tsx — Client Component
'use client'

import { useEffect } from 'react'
import { useProductStore } from './stores/product'

interface Props {
  initialProducts: Product[]
}

export function ProductList({ initialProducts }: Props) {
  const setProducts = useProductStore(state => state.setProducts)

  useEffect(() => {
    setProducts(initialProducts)
  }, [setProducts, initialProducts])

  // or: Zustand v5+ supports
  // useProductStore.setState({ items: initialProducts }) directly

  return <div>...</div>
}
```

**Critical**: Hydrate only once. If `initialProducts` changes on re-render (e.g., parent re-fetches), the `useEffect` fires again — but in RSC, server props are stable per render. The `[]` deps are safe because Server Components pass fresh props per navigation, not per parent re-render.

> **Think**: What happens if the client component re-renders before the store hydration `useEffect` runs? Does the UI show stale state?
>
> *Answer: Yes — first render shows empty store (default initial state). This is intentional. The store returns `[]` items until `useEffect` fires. If this causes layout shift or flash, use `create` with server-provided initial state: `create<Store>((set) => ({ items: initialServerData ?? [], ... }))` and skip the `useEffect`. Pass initial state via store creator closure.*

### Server Data Flows: RSC Fetches → Client Consumes with Zustand

Architecture pattern:

```
Server Component
  ├── fetch data (DB, API, file)
  ├── serialize to plain JSON
  └── pass as props
        └── Client Component ('use client')
              ├── hydrate Zustand store on mount
              └── client interactions (add to cart, filter, sort)
                    └── no server roundtrip needed
```

This splits responsibilities cleanly: server owns initial data, client owns interactive state. No API calls from client for data already fetched on server.

> **Think**: You have a product listing page. Server fetches 100 products. Client needs to filter by category. Should you re-fetch filtered data from server? Why?
>
> *Answer: No. Client-side filter is instant — no network latency, no server load. Server re-fetch only if data changes (new products added), not for presentation transforms. Zustand keeps filtered list derived: `const filtered = useProductStore(state => state.products.filter(p => p.category === selected))`.*

### Per-Request Store vs Singleton Store

RSC renders per request. If a Zustand store is a singleton (module-level `create`), all users sharing the server process also share store state. This leaks data between requests.

```typescript
// ❌ WRONG — Singleton store leaks data between users
// stores/cart.ts
import { create } from 'zustand'
export const useCartStore = create<CartStore>(...) // one instance for all users
```

**Correct patterns**:

1. **Client-only store inside `'use client'`**: Singleton is fine here because each browser gets its own JavaScript context. Only the server-side Node process shares singletons — but Zustand stores in `'use client'` components never execute on server.

2. **Server-side rendering / SSG**: If you SSR a page with Zustand (e.g., Next.js Pages Router), create a store per request and serialize initial state to client.

```typescript
// With Next.js App Router — no issue: RSC + client boundary means
// the store exists only in browser memory. Singleton is safe.
```

```typescript
// With Next.js Pages Router (getServerSideProps) — must create per request
// Because store runs on server during SSR
import { createStore } from 'zustand/vanilla'

export function createCartStore(initialItems: Item[]) {
  return createStore<CartStore>((set) => ({
    items: initialItems,
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  }))
}
```

> **Think**: Your app uses Next.js App Router (RSC) exclusively. Is a singleton Zustand store safe? What if you also use middleware that runs on the edge?
>
> *Answer: Safe for App Router. Zustand store never executes on server because the consuming component is `'use client'`. Edge middleware does not import the store — it transforms request/response, not component state. Singleton across browser tabs is the real concern: each tab has its own store instance (browser isolates module execution per tab).*

### Zustand with Next.js App Router: Layout vs Page Store Boundaries

Next.js layouts persist across navigations. Pages unmount and remount. Store lifecycle must match.

| Boundary | Store lifecycle | Use case |
|----------|----------------|----------|
| **Root layout** | Mounts once, persists across all pages | Auth state, theme, global UI |
| **Nested layout** | Persists within route segment | Sidebar filters, tab state |
| **Page** | Mounts/unmounts per navigation | Product detail, search results |
| **Modal / parallel route** | Independent lifecycle | Cart drawer, quick view |

```typescript
// RootLayout shares one store instance across all child pages
// app/layout.tsx
'use client'

import { useAuthStore } from '@/stores/auth'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user)
  return (
    <html>
      <body>
        <header>{user?.name}</header>
        {children}
      </body>
    </html>
  )
}
```

```typescript
// Page component gets fresh store state via props from server
// app/products/page.tsx — Server Component
import { ProductGrid } from './ProductGrid'

export default async function ProductsPage() {
  const products = await fetchProducts()
  return <ProductGrid serverProducts={products} />
}
```

Page stores should initialize from server data. Layout stores persist — they hold session-level state, not page-level.

> **Think**: A cart store lives in the root layout. User navigates from `/products` to `/checkout`. Does the cart state survive? What triggers a reset?
>
> *Answer: Cart survives because root layout does not unmount. Cart reset happens on explicit action (checkout complete, clear cart). Layout-level stores are stable across navigation — this is intentional for cart, auth, notifications.*

### Streaming + Zustand: Client Store Hydration After SSR

React 19 streams SSR content progressively. Parts of the page arrive at different times. Zustand hydration must account for partial rendering.

Problem: A server component streams product data. The client cart store does not know about products until hydration completes.

```typescript
// ProductCard.tsx — streams as part of Suspense boundary
'use client'

import { useCartStore } from '@/stores/cart'
import type { Product } from '@/types'

// Product arrives with stream — not available at initial render
export function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCartStore(state => state.addItem)
  return <button onClick={() => addItem(product)}>Add to Cart</button>
}
```

Key insight: Each product card streams independently. The Zustand store accumulates items as user interacts. No hydration race — store is client-only, browser-ready before first streamed content arrives.

**Watch for**: If store initial state depends on all streamed data (e.g., aggregated count), collect at layout level and pass down. Do not rely on all streamed components hydrating before store interaction.

> **Think**: Your page streams 50 product cards over 3 seconds. User clicks "Add to Cart" on card #3 before cards #4-50 arrive. Does the store accept the item? What about card #3's data — was it available?
>
> *Answer: Yes — card #3 arrived and hydrated before user clicked (it rendered). The store is independent of streaming. User can add items as each card streams. Items from unstreamed cards simply don't exist in the store yet. This is correct behavior: you cannot add what has not rendered.*

### Server Actions + Zustand: Mutations That Update Client Store

Server Actions run on the server. Zustand lives on the client. How do server mutations update client state?

```typescript
// actions.ts — Server Action (runs on server)
'use server'

import { revalidatePath } from 'next/cache'

export async function removeFromServerCart(productId: string) {
  const db = await connectDB()
  await db.cart.delete({ productId })
  revalidatePath('/cart')
}
```

```typescript
// CartPage.tsx — Client Component
'use client'

import { useCartStore } from '@/stores/cart'
import { removeFromServerCart } from './actions'

export function CartPage({ initialItems }: { initialItems: Item[] }) {
  const { items, removeItem } = useCartStore()

  const handleRemove = async (id: string) => {
    // Optimistic: update client store immediately
    removeItem(id)

    // Server: persist deletion
    const result = await removeFromServerCart(id)

    if (result.error) {
      // Revert optimistic update on failure
      // Re-fetch from server or restore item
    }
  }

  return <div>...</div>
}
```

**Two concerns**: (1) Client store for instant UI feedback. (2) Server action for persistence. They stay in sync via:
- Optimistic update: update store first, fire server action
- On success: do nothing (already correct)
- On failure: revert store, re-fetch server data via RSC revalidation

> **Think**: What happen if user goes offline after clicking "Remove" — store removes item optimistically, server action fails. User reloads page. Does RSC re-fetch show the item still in server cart?
>
> *Answer: Yes. Server action never reached server. `revalidatePath` never ran. On reload, RSC re-renders from server data — item still present. Client store re-hydrates from server props, showing correct server state. Offline optimistic update is discarded. This is the correct safety net: server is source of truth, client store is UI acceleration layer.*

### Cache Invalidation: Reconciling Server Data with Client Zustand Store

Multiple sources of truth create sync problems. Strategy:

| Source | Role | Refresh trigger |
|--------|------|-----------------|
| Server (RSC) | Source of truth for initial data | Navigation, mutation, interval |
| Zustand store | Client acceleration layer | User interaction, optimistic update |
| Server Action result | Mutation confirmation | After action completes |

Reconciliation rules:
1. Zustand store initializes from server props — never from a separate client fetch
2. After server mutation, revalidate RSC path, then re-hydrate store from new server props
3. Do not maintain duplicate state: server data that never changes (product details) should not go into Zustand at all — render from server props directly
4. Only store mutable client state in Zustand: cart, filters, UI state

```typescript
// Pattern: after RSC revalidation, re-hydrate store
export function SyncStoreWithRSC({ serverCart }: { serverCart: CartItem[] }) {
  const setItems = useCartStore(state => state.setItems)

  // Server props are always the latest server state after revalidation
  useEffect(() => {
    setItems(serverCart)
  }, [serverCart, setItems])

  return null // invisible sync component
}
```

> **Think**: You sync server cart to Zustand every time server props change. A server action removes item X. RSC revalidates. `serverCart` no longer has X. Zustand syncer runs and removes X from local store. Rate this approach.
>
> *Answer: This is correct — server is source of truth. But if user had pending optimistic changes (item Y not yet submitted), sync overwrites them. Solution: track pending operations in a separate store slice. Sync only data that has no pending server operation.*

### Avoiding Hydration Mismatch: Server State + Client Store Alignment

React hydration mismatch occurs when server-rendered HTML differs from client render. With Zustand, this happens when store initial state differs from server props.

```typescript
// store/cart.ts
import { create } from 'zustand'

interface CartState {
  items: string[]
  addItem: (item: string) => void
}

export const useCartStore = create<CartState>((set) => ({
  items: [], // default — likely empty
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
}))
```

```typescript
// page.tsx
export default async function Page() {
  const serverItems = await getCartItems() // maybe ["item1", "item2"]
  return <CartPage initialItems={serverItems} />
}
```

```typescript
// CartPage.tsx
'use client'

import { useCartStore } from '@/stores/cart'

export function CartPage({ initialItems }: { initialItems: string[] }) {
  const items = useCartStore(state => state.items)

  // Problem: server rendered HTML shows initialItems, client hydration
  // renders [] from store — mismatch!

  return <div>{items.length} items</div>
}
```

**Fix**: Initialize store with server data before first render, not in `useEffect`.

```typescript
// ✅ CORRECT — Initialize store synchronously on mount
'use client'

import { useCartStore } from '@/stores/cart'

export function CartPage({ initialItems }: { initialItems: string[] }) {
  // Store initializer hook
  useStoreHydration(initialItems)
  const items = useCartStore(state => state.items)

  return <div>{items.length} items</div>
}
```

```typescript
// hooks/useStoreHydration.ts
'use client'

import { useEffect, useRef } from 'react'
import { useCartStore } from '@/stores/cart'

export function useStoreHydration(initialItems: string[]) {
  const hydrated = useRef(false)

  useEffect(() => {
    if (!hydrated.current) {
      useCartStore.setState({ items: initialItems })
      hydrated.current = true
    }
  }, [initialItems])
}
```

**Server render output**: React renders once on server with store default state. If server render path uses Zustand (Pages Router SSR), create per-request store with correct initial state. In App Router, server render never touches Zustand — the client component receives props and renders with empty store, then re-renders immediately after hydration `useEffect`. This double-render is normal and does not cause visible mismatch because the `useEffect` runs after paint.

> **Think**: Next.js App Router renders a Client Component that uses Zustand. Server sends HTML. Client hydrates. Does React warn about hydration mismatch?
>
> *Answer: No — as long as server-rendered HTML matches client initial render (both use empty store). The `useEffect` hydration runs after hydration completes. React compares server HTML to first client render, not to post-effect state. This is safe by design. Mismatch only occurs if client first render produces different HTML than server — which happens only if store default state is accessed during render with non-empty initial state.*

### Real Example: E-Commerce Page with RSC Product Data + Zustand Cart Store

Complete architecture:

```
app/products/page.tsx (Server)
  ├── fetch products from DB
  ├── fetch user's server cart
  └── render:
        ├── ProductList client component
        │     └── receives serverProducts, serverCart
        └── CartDrawer client component
              └── receives serverCart
```

```typescript
// app/products/page.tsx — Server Component
import { getProducts, getUserCart } from '@/lib/db'
import { ProductList } from './ProductList'
import { CartDrawer } from './CartDrawer'
import { auth } from '@/lib/auth'

export default async function ProductsPage() {
  const session = await auth()
  const [products, cart] = await Promise.all([
    getProducts(),
    getUserCart(session.userId),
  ])

  return (
    <div>
      <ProductList serverProducts={products} serverCart={cart} />
      <CartDrawer serverCart={cart} />
    </div>
  )
}
```

```typescript
// app/products/ProductList.tsx — Client Component
'use client'

import { useCartStore } from '@/stores/cart'
import { useHydrateStore } from '@/hooks/useHydrateStore'
import type { Product, CartItem } from '@/types'

interface Props {
  serverProducts: Product[]
  serverCart: CartItem[]
}

export function ProductList({ serverProducts, serverCart }: Props) {
  useHydrateStore(serverCart)

  const addItem = useCartStore(state => state.addItem)
  const cartItems = useCartStore(state => state.items)

  return (
    <div>
      <h2>Products ({serverProducts.length})</h2>
      {serverProducts.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>${product.price}</p>
          <button
            onClick={() => addItem({
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: 1,
            })}
          >
            {cartItems.some(i => i.productId === product.id)
              ? 'In Cart'
              : 'Add to Cart'}
          </button>
        </div>
      ))}
    </div>
  )
}
```

```typescript
// stores/cart.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types'

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  setItems: (items: CartItem[]) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(i => i.productId === item.productId)
          if (existing) {
            return {
              items: state.items.map(i =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            }
          }
          return { items: [...state.items, item] }
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter(i => i.productId !== productId),
        })),
      clearCart: () => set({ items: [] }),
      setItems: (items) => set({ items }),
    }),
    { name: 'cart-storage' }
  )
)
```

```typescript
// hooks/useHydrateStore.ts
'use client'

import { useEffect, useRef } from 'react'
import { useCartStore } from '@/stores/cart'

export function useHydrateStore(serverCart: CartItem[]) {
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && serverCart.length > 0) {
      useCartStore.setState({ items: serverCart })
      initialized.current = true
    }
  }, [serverCart])
}
```

Flow:
1. Server fetches products + cart
2. Client receives both as props
3. Store hydrates from serverCart on first render (via useEffect)
4. User adds items — store updates instantly, persist middleware saves to localStorage
5. Server Actions run on add/remove — revalidate RSC path, fresh props arrive
6. Hydration sync updates store with latest server state
7. On reload: persist middleware loads from localStorage first, then server props overwrite if different

> **Think**: persist middleware saves cart to localStorage. Server props arrive after hydration. Which wins — localStorage or server?
>
> *Answer: Server wins, because hydration useEffect runs after persist middleware has already restored from localStorage. The `setItems(serverCart)` overwrites localStorage data. Rationale: server is authoritative. User might have checked out on another device, clearing server cart — localStorage would show stale data. Server props reflect truth.*

---

### Why This Matters

RSC architecture is the default in Next.js App Router and becoming standard in React. Zustand stores that ignore RSC boundaries leak data, cause hydration mismatches, or break entirely. Every Zustand user building modern React apps must understand `use client` boundaries, server-to-client data flow, and store lifecycle per RSC render. Wrong approach: duplicate server fetches in client stores, singleton stores shared across requests, hydration race conditions. Right approach: server fetches data, passes as props, Zustand hydrates once and takes over interactivity.

---

### Common Questions

**Q: Does every Zustand store file need `'use client'`?**
A: No. Only components that import and call `useStore` need `'use client'`. The store definition (`create(...)`) is pure JS — it can live anywhere. But if the store uses browser-only APIs (localStorage in persist middleware), it must be in a module only imported by client components. Next.js will not execute it on server, but the import itself could trigger server errors if it accesses `window`.

**Q: What about Zustand with React Server Components in a non-Next.js framework?**
A: Same rules apply. RSC is a React feature, not Next.js-specific. The `'use client'` boundary, server-to-client prop passing, and hydration patterns are identical. Framework-specific differences: Remix uses loader data instead of async components; Gatsby uses SSR or SSG. The Zustand pattern remains: server data → serialized props → client store hydration.

**Q: Can I use `create` from `zustand/vanilla` on the server?**
A: Yes — vanilla store is just an event emitter with `setState`/`getState`. Useful for server-side preloading or background jobs. But do not import it into a Server Component that renders it to JSX. Use vanilla stores in server utilities, API routes, or middleware. Keep the `useStore` React binding strictly client-side.

**Q: What is the performance cost of the hydration useEffect pattern?**
A: Negligible. One `useEffect` call per page load that sets state. The double-render (empty → hydrated) is invisible to users because both renders produce the same HTML (empty store renders "0 items"). The hydration fills the store for subsequent interactions. For large stores (10k+ items), batch update: `useCartStore.setState({ items: serverCart })` is O(1) — Zustand uses immutable updates, not diffing.

**Q: How do I test Zustand stores that depend on RSC data?**
A: Mock the server data layer. Create store with initial test data. Test the store in isolation (no RSC context needed). For integration tests (e.g., Playwright), seed the server response with fixtures. The store behavior is identical in test — it receives `setItems` from test code just as it would from server props.

---

## Examples

### Example 1: Migrating a Zustand Cart from Client-Only to RSC

**Problem**: Existing Zustand cart store fetches its own data via `useEffect` on the client. After migrating to App Router, the initial cart fetch happens twice — once on server (for the page component) and once in the store's `useEffect`.

Before:
```typescript
const useCartStore = create<CartState>((set) => ({
  items: [],
  fetchCart: async () => {
    const res = await fetch('/api/cart')
    const data = await res.json()
    set({ items: data })
  },
}))

// Cart.tsx — client component fetches its own data
function Cart() {
  const { items, fetchCart } = useCartStore()

  useEffect(() => {
    fetchCart() // duplicate fetch — also fetched by server
  }, [fetchCart])

  return <div>{items.length}</div>
}
```

**Solution**:
1. Remove `fetchCart` from store (server owns data fetching)
2. Server Component fetches cart data
3. Pass `initialCart` as prop to client component
4. Hydrate store from prop

After:
```typescript
// page.tsx — Server Component
export default async function Page() {
  const cart = await getServerCart()
  return <Cart initialCart={cart} />
}

// Cart.tsx — Client Component
'use client'

function Cart({ initialCart }: { initialCart: Item[] }) {
  useHydrateStore(initialCart) // sync, no duplicate fetch
  const items = useCartStore(state => state.items)
  return <div>{items.length}</div>
}
```

**Result**: Single fetch (server). No client waterfall. Store hydrates once. Zero duplicate API calls.

### Example 2: Multi-Tenant Dashboard with Store Boundaries

**Problem**: SaaS dashboard. Server fetches tenant-specific data. Each tenant has unique layout, settings, and user list. Layout store (sidebar collapse) persists across tenants. Settings store resets per tenant.

```typescript
// app/[tenant]/layout.tsx — Server Component
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { tenant: string }
}) {
  const tenant = await getTenant(params.tenant)
  return <TenantShell tenantName={tenant.name} config={tenant.config} />
}

// app/[tenant]/TenantShell.tsx — Client Component
'use client'

export function TenantShell({
  tenantName,
  config,
  children,
}: {
  tenantName: string
  config: TenantConfig
}) {
  useLayoutStore.setState({ tenant: tenantName })
  useSettingsStore.setState({ config }) // resets per tenant

  return (
    <div>
      <h1>{tenantName}</h1>
      {children}
    </div>
  )
}
```

**Boundary rules**:
- `useLayoutStore`: subscription in root layout — persists across tenant switches (sidebar state)
- `useSettingsStore`: re-initialized per tenant layout mount — each tenant gets fresh config
- Server data: fetched once per tenant navigation, passed as props
- Result: no cross-tenant data leak, no duplicate fetches, correct lifecycle

### Example 3: Real-Time Collaborative Cart with RSC Base Data

**Problem**: E-commerce app with real-time cart sync (WebSocket) but initial SSR from RSC. Server fetches initial cart. WebSocket keeps it current. Zustand on client merges both.

```typescript
// page.tsx — Server Component
export default async function Page() {
  const initialCart = await getCart()
  return <RealtimeCart initialCart={initialCart} />
}

// RealtimeCart.tsx — Client Component
'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/stores/cart'

function RealtimeCart({ initialCart }: { initialCart: Item[] }) {
  const { items, addItem, removeItem, setItems } = useCartStore()

  // Step 1: Hydrate from server
  useEffect(() => {
    setItems(initialCart)
  }, [initialCart, setItems])

  // Step 2: Subscribe to WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket('wss://cart.example.com/live')
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      // update.type: 'add' | 'remove' | 'sync'
      if (update.type === 'sync') {
        setItems(update.items) // full sync from server
      }
    }
    return () => ws.close()
  }, [setItems])

  return <div>{items.length} items (live)</div>
}
```

**Result**: Initial cart renders immediately from RSC. WebSocket keeps store up-to-date for multi-device sync. No conflict: RSC is the initial snapshot, WebSocket is the live stream. Both converge to same store.

---

## Key Takeaways
- Zustand stores are client-only — `'use client'` boundary protects against RSC errors
- Server data flows via serialized props → client `useEffect` hydration
- Singleton store is safe in App Router (store never runs on server)
- Per-request store only needed in SSR frameworks (Pages Router)
- Layout stores persist across navigations; page stores re-initialize per route
- Streaming SSR works with Zustand — each streamed component can interact independently
- Server Actions + Zustand: optimistic update in store → server mutation → revalidate → re-hydrate
- Server is source of truth; Zustand is UI acceleration layer
- Hydration mismatch avoided by matching first server render to client initial render (empty store)
- Persist middleware + server hydration: server props override localStorage

## Common Misconception

**"Zustand stores in RSC apps should be server-side singletons."**

Zustand store definitions are pure JS that can run anywhere. But the React binding (`useStore`) requires React context, which does not exist on the server in RSC architecture. Developers see "Zustand works on server" (vanilla API) and incorrectly wire stores into Server Components, causing cross-request data leaks or runtime errors. The store definition may be server-safe; the store consumer is not. Keep the boundary clear: store definition in shared module, store consumption behind `'use client'`. When in doubt, put `'use client'` on any file importing from `zustand` (not `zustand/vanilla`).

---

## Feynman Explain
(Explain Zustand + RSC architecture to a junior developer who knows React but not Server Components. Use the restaurant analogy: server = kitchen that prepares your order, client = your table. Why can't the table touch the kitchen prep? How does the waiter (serialized props) bring food (data) from kitchen to table?)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Judge: Are RSC + Zustand worth the complexity for a simple blog? When does the `'use client'` boundary + hydration pattern tax outweigh benefits? Where would Server Actions + React context be simpler than Zustand? Write your evaluation. Consider trade-offs between bundle size, fetch patterns, and team velocity.)

---

## Drill
Take the quiz. MCQs test store boundaries, hydration patterns, server data flow, and RSC architecture.

Run: `learn.sh quiz zustand-state-management 18-rsc-server-components`
