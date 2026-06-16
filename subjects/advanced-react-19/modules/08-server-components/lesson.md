# Module 8: Server Components: Composition, Client Boundaries, Directives

Est. study time: 2.5h
Language: en

## Learning Objectives
- Distinguish Server Components from Client Components by runtime, bundle impact, and API access
- Apply 'use client' and 'use server' directives to define component boundaries
- Compose Server Components wrapping Client Components with serializable props
- Build and test async Server Components that use server-only APIs directly

---

## Core Content

### Server Components vs Client Components — Mental Model Shift

Before React 19, every component ran in browser. All code shipped to client. All components hydrated. This is **Client Component** model — single environment.

Server Components (RSC) split React into two environments:

| Dimension | Server Component | Client Component |
|-----------|-----------------|-----------------|
| Runs on | Server (render only) | Client (browser) |
| Bundle size | Zero bytes — never ships | Full size shipped |
| State/effects | None — no hooks | useState, useEffect, etc. |
| Data access | Direct: DB, fs, secrets | Via API calls only |
| Async | Native async/await | No — use hooks or libraries |
| Re-renders | Per request only | Per state/prop change |

Mental model: Server Components are **render-time only**. They generate a serialized tree sent to client. Once sent, they die. No state, no interactivity, no hydration. Client Components take over for anything interactive.

> **Think**: You have a page that renders a product list from database and an interactive search bar. Which parts become Server vs Client Components?
>
> *Answer: Product list is Server Component — fetches DB directly, renders HTML-like output, never ships to client. Search bar is Client Component — needs useState for input, onChange handler, interactivity. The layout/container can be Server Component that wraps search bar client component.*

### 'use client' and 'use server' Directives

Directives mark the boundary between environments.

**'use client'** — placed at **top of file** (first line). Every component exported from that file becomes a Client Component. The file and all its dependencies ship to browser. Cannot be used inside Server Components conditionally — once a file has 'use client', all exports are client.

```typescript
// SearchBar.tsx
'use client'

import { useState } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('')
  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onSearch(query)}
    />
  )
}
```

**'use server'** — placed in **function body** (inline) or **top of file** (module-level). Used for Server Actions — functions callable from client but executed on server.

```typescript
// Inline in component:
export function CreatePost() {
  async function createPost(formData: FormData) {
    'use server'
    const title = formData.get('title')
    await db.post.create({ title })  // server-only
    revalidatePath('/posts')
  }
  return <form action={createPost}>...</form>
}
```

```typescript
// Separate file — all exports are Server Actions:
// app/actions.ts
'use server'

import { db } from '@/lib/db'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  await db.post.create({ title })
  revalidatePath('/posts')
}
```

Key distinction: 'use client' marks **components** (return JSX). 'use server' marks **actions** (return data, accept FormData). Two different boundaries.

> **Think**: What happens if you put 'use server' on a file that exports a component? Can that component be rendered client-side?
>
> *Answer: 'use server' on a file makes all exports Server Actions — they become RPC endpoints. Components exported from a 'use server' file cannot be rendered as React components. They are callable functions only. Common mistake: using 'use server' on a component file thinking it makes the component server-only. Use 'use client' for components, 'use server' for actions.*

### Composition Patterns and Client Boundaries

Server Components render first, producing a tree. When React encounters a 'use client' boundary, it stops Server rendering and inserts a placeholder. Client bundle hydrates from that point downward.

Critical pattern: **Server Components wrap Client Components**. Never the reverse.

```typescript
// CORRECT: Server Component wraps Client Component
// Page.tsx — Server Component (no directive)
import { ProductList } from './ProductList' // Server Component
import { AddToCart } from './AddToCart'     // Client Component ('use client')

export default function Page() {
  const products = await db.product.findAll() // server-only
  return (
    <div>
      <ProductList products={products} />
      <AddToCart productId={products[0].id} />
    </div>
  )
}
```

```typescript
// WRONG: Client Component wraps Server Component
// Page.tsx — Client Component ('use client')
import { ProductList } from './ProductList' // Server Component — CANNOT import here

export default function Page() {
  return <ProductList /> // Runtime error: Server Component in Client Component
}
```

Exception: Server Components can be **passed as children** (props) to Client Components:

```typescript
// Correct: Server content passed as children
// layout.tsx — Server Component
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientShell>{children}</ClientShell>
  // children is rendered on server, received as opaque prop by ClientShell
}

// ClientShell.tsx
'use client'
export function ClientShell({ children }: { children: React.ReactNode }) {
  return <div className="shell">{children}</div>
}
```

**Serialization boundary**: Props passed from Server to Client Component must be serializable:
- ✅ Strings, numbers, booleans, null, undefined
- ✅ Plain objects, arrays
- ✅ Date (serialized to ISO string automatically)
- ✅ Map, Set, BigInt (in React 19)
- ❌ Functions — cannot pass callbacks from server to client
- ❌ Class instances with methods
- ❌ Symbols
- ❌ React elements (except as children)

> **Think**: You need to pass a click handler from a Server Component to a Client Component. The handler calls a server action. How do you wire this without passing a function across the boundary?
>
> *Answer: Define server action separately. Pass action reference (string name or import) or use form action. Client component calls the action via `bind` or form — no function crossing boundary. Pattern: action lives in 'use server' file, client component receives action reference as prop, invokes it.*

### Async Server Components

Server Components are **native async**. No useEffect, no useQuery, no loading state boilerplate:

```typescript
// Server Component — direct async/await
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({
    where: { id: params.id },
    include: { reviews: true }
  })

  if (!product) return <NotFound />

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <ReviewList reviews={product.reviews} />
      <AddReviewForm productId={product.id} />
    </div>
  )
}
```

Rules:
- `async` keyword on component function — works only in Server Components
- No hooks allowed — `await` replaces `useEffect`+fetch pattern
- Each `await` suspends the component, streams via Suspense boundary
- Error handling: wrap in `error.tsx` (Next.js) or `<ErrorBoundary>`

```typescript
// With parallel data fetching — faster than client waterfall
export default async function Dashboard() {
  const [revenue, users, orders] = await Promise.all([
    db.revenue.findMany(),
    db.user.findMany(),
    db.order.findMany(),
  ])
  return <DashboardView revenue={revenue} users={users} orders={orders} />
}
```

> **Think**: Your async Server Component fetches three endpoints sequentially: users, then orders, then revenue. Total time: 900ms. How do you reduce to 300ms?
>
> *Answer: Use Promise.all to parallelize. Server Components can await multiple independent promises concurrently. Unlike client-side waterfalls (fetch in useEffect → state set → re-render → next fetch), server can batch all fetches in one render pass.*

### Server Actions

Server Actions are functions callable from client, executed on server. Two patterns:

**Inline** — action defined in component, 'use server' as first statement:
```typescript
export default function CreateUserForm() {
  async function createUser(formData: FormData) {
    'use server'
    const email = formData.get('email')
    const name = formData.get('name')
    await db.user.create({ data: { email, name } })
    revalidatePath('/users')
  }

  return (
    <form action={createUser}>
      <input name="email" type="email" />
      <input name="name" />
      <button type="submit">Create</button>
    </form>
  )
}
```

**Module-level** — separate file, all exports are actions:
```typescript
// app/users/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

export async function createUser(prevState: unknown, formData: FormData) {
  const parsed = schema.parse(Object.fromEntries(formData))
  await db.user.create({ data: parsed })
  revalidatePath('/users')
  return { success: true }
}
```

Used with `useActionState`:
```typescript
'use client'
import { useActionState } from 'react'
import { createUser } from './actions'

export function UserForm() {
  const [state, action, pending] = useActionState(createUser, null)
  return (
    <form action={action}>
      <input name="email" />
      {state?.error && <p>{state.error}</p>}
      <button disabled={pending}>Create</button>
    </form>
  )
}
```

Module-level recommended for: reuse across forms, shared validation, simpler testing.

> **Think**: Inline Server Actions defined inside a Client Component — does this work? What happens to 'use server' directive?
>
> *Answer: Works. 'use server' directive inside function body works regardless of component type. Inline actions in Client Components compile to server-callable RPC endpoints same as module-level. However, they cannot be reused. Prefer module-level for shared mutations.*

### RSC + Streaming

Server Components stream incrementally via Suspense. Each `await` in async component creates a natural streaming boundary:

```typescript
import { Suspense } from 'react'

async function SlowReviews({ productId }: { productId: string }) {
  const reviews = await db.review.findMany({ where: { productId } })
  // This component suspends streaming until reviews fetched
  return <ReviewList reviews={reviews} />
}

async function RelatedProducts({ productId }: { productId: string }) {
  const related = await db.product.findRelated(productId)
  return <RelatedList products={related} />
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Product Detail</h1>
      <Suspense fallback={<LoadingSkeleton />}>
        <SlowReviews productId={params.id} />
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <RelatedProducts productId={params.id} />
      </Suspense>
    </div>
  )
}
```

Key behaviors:
- Each `<Suspense>` boundary streams independently — no blocking
- Client sees HTML immediately, content fills in as promises resolve
- Streaming is default when RSC used with supporting framework (Next.js App Router)
- Does not require configuration — any async component inside Suspense streams

> **Think**: You have a page with three Suspense boundaries wrapping async components. One takes 5s, another takes 100ms, another 50ms. In what order does content arrive?
>
> *Answer: 50ms boundary renders first, then 100ms, then 5s. Each Suspense boundary streams independently. Fast data shows immediately even if slow data in sibling boundary still pending.*

### Testing RSC

Testing Server Components requires environment that supports server primitives:

```typescript
// Unit test for async Server Component — vitest
import { describe, it, expect, vi } from 'vitest'
import { ProductList } from './ProductList'
import { db } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  db: {
    product: {
      findMany: vi.fn(),
    },
  },
}))

describe('ProductList (Server Component)', () => {
  it('renders products from database', async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([
      { id: '1', name: 'Widget', price: 10 },
      { id: '2', name: 'Gadget', price: 20 },
    ])

    const container = await ProductList({ category: 'tools' })
    // Render to string and assert
    const { container: rendered } = render(await container)
    expect(rendered).toHaveTextContent('Widget')
    expect(rendered).toHaveTextContent('Gadget')
  })

  it('handles empty results', async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([])
    const container = await ProductList({ category: 'tools' })
    const { container: rendered } = render(await container)
    expect(rendered).toHaveTextContent('No products found')
  })
})
```

Integration with Client Components: test composition by rendering Server Component output as string, then hydrating with Client boundary in playground/render tests. Use `@testing-library/react` with `renderToString` from `react-dom/server` for Server Components.

> **Think**: Can you test a Server Component that calls 'use server' action directly? What environment setup is needed?
>
> *Answer: Yes, but requires server environment — Node runtime with DB connection. Unit test the async component logic (data fetching + rendering). Test Server Actions separately as regular async functions. Integration tests using e2e (Playwright) verify full server-to-client flow: action submission → revalidation → re-render.*

---

### Why This Matters

Server Components are the most significant React architecture change since hooks. They eliminate entire categories of problems: over-fetching (no REST API calls for initial data), bundle bloat (zero-KB components), data loading waterfalls (parallel awaits), and client-side state for server data. Compositing with Client Components defines every React app's architecture. Get boundaries wrong — bundle explodes. Get serialization wrong — runtime errors. Get composition wrong — infinite re-renders. This module's patterns apply to every feature you build.

---

### Common Questions

**Q: Can I use Server Components without Next.js?**
A: Yes — React 19's RSC is framework-agnostic. But you need a bundler that implements the RSC protocol (Webpack/Rspack with React server plugin, or upcoming Vite support). Next.js App Router is the only production-ready implementation today. Gatsby, Remix adding support.

**Q: Does every component need 'use client' or 'use server'?**
A: No. Default is Server Component — no directive needed. Only add 'use client' when component needs interactivity (hooks, event handlers, browser APIs). Only add 'use server' for Server Actions (functions). Most files stay directive-free.

**Q: What happens if I import a Client Component into a Server Component that uses hooks?**
A: The hooks run client-side — the Server Component just renders the tree. The Client Component's hooks execute after hydration. Safe. But you cannot import Server Components into Client Components (runtime error).

**Q: Can a Server Action update client-side state directly?**
A: No. Server Actions return data, revalidate server cache, or trigger navigation. Client state updates require explicit handling: `useActionState` returns state, or you manually set state after action completes. Server Actions cannot push state updates to client.

**Q: How do I handle authentication in Server Components?**
A: Read session from server-side cookie/header in the component. Do NOT pass auth state from client. Pattern: `getServerSession()` in async Server Component, render conditionally. Auth logic stays server-side, never ships to client.

---

## Examples

### Example 1: Product Page with Optimized Rendering

**Problem**: E-commerce product page loads slowly due to client-side waterfall: fetch product → render → fetch reviews → render → fetch related → render. Total: 2.5s.

**Solution**: Convert to Server Components with parallel data fetching:

```typescript
// app/products/[id]/page.tsx — Server Component (no directive)
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { ProductDetails } from './ProductDetails'
import { ReviewSection } from './ReviewSection'
import { RelatedProducts } from './RelatedProducts'
import { AddToCartButton } from './AddToCartButton' // Client Component

async function ProductData({ id }: { id: string }) {
  const [product, reviews, related] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    db.review.findMany({ where: { productId: id }, orderBy: { date: 'desc' } }),
    db.product.findRelated(id),
  ])
  if (!product) return <NotFound />
  return <ProductDetails product={product} />
}

export default async function Page({ params }: { params: { id: string } }) {
  return (
    <div>
      <Suspense fallback={<ProductSkeleton />}>
        <ProductData id={params.id} />
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <ReviewSection productId={params.id} />
      </Suspense>
      <Suspense fallback={<RelatedSkeleton />}>
        <RelatedProducts productId={params.id} />
      </Suspense>
      <AddToCartButton productId={params.id} />
    </div>
  )
}
```

**Result**: Product detail streams in. Skeleton shows immediately. First content paints in 200ms. Full page renders in 800ms (down from 2.5s). AddToCart button renders immediately since it has no data dependency.

### Example 2: Form with Server Action and Validation

**Problem**: Contact form needs validation, error handling, server-side submission, and redirect on success.

**Solution**: Server Action with Zod validation, Client Component with useActionState:

```typescript
// app/contact/actions.ts
'use server'

import { z } from 'zod'
import { db } from '@/lib/db'

const schema = z.object({
  name: z.string().min(2, 'Name too short'),
  email: z.string().email('Invalid email'),
  message: z.string().min(10, 'Message too short'),
})

export async function submitContact(prevState: unknown, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  await db.contact.create({ data: parsed.data })
  return { success: true }
}
```

```typescript
// app/contact/ContactForm.tsx
'use client'

import { useActionState } from 'react'
import { submitContact } from './actions'

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, null)

  if (state?.success) return <p>Thanks! We'll respond within 24h.</p>

  return (
    <form action={action}>
      <input name="name" placeholder="Name" />
      {state?.error?.name && <p className="error">{state.error.name}</p>}
      <input name="email" type="email" placeholder="Email" />
      {state?.error?.email && <p className="error">{state.error.email}</p>}
      <textarea name="message" placeholder="Message" />
      {state?.error?.message && <p className="error">{state.error.message}</p>}
      <button disabled={pending}>{pending ? 'Sending...' : 'Submit'}</button>
    </form>
  )
}
```

**Result**: Client-side pending state without manual loading management. Server-side validation prevents bad data. Action runs on server — no API route needed.

### Example 3: Client Composition with Server Children

**Problem**: Dashboard layout needs sidebar navigation (client state, highlighted active link) wrapping server-fetched content.

**Solution**: Client shell receives Server Component children:

```typescript
// app/dashboard/layout.tsx — Server Component
import { Sidebar } from './Sidebar' // Client Component
import { UserProfile } from './UserProfile' // Server Component

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getServerSession()
  return (
    <div className="dashboard">
      <Sidebar user={user}>
        <UserProfile user={user} />
      </Sidebar>
      <main>{children}</main>
    </div>
  )
}
```

```typescript
// app/dashboard/Sidebar.tsx
'use client'

import { useState } from 'react'

interface SidebarProps {
  user: { name: string; avatar: string }
  children: React.ReactNode
}

export function Sidebar({ user, children }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <aside className={collapsed ? 'collapsed' : ''}>
      <button onClick={() => setCollapsed(!collapsed)}>Toggle</button>
      {children}
      <p>Welcome, {user.name}</p>
    </aside>
  )
}
```

**Result**: Sidebar has client interactivity (toggle collapse). Server-fetched UserProfile embedded as children — no serialization issue. Children prop passes through boundary as opaque tree. Server Component data never touches client bundle.

---

## Key Takeaways
- Server Components run zero JS on client — data fetching moves to server
- 'use client' marks file boundary — all exports become Client Components
- 'use server' marks Server Actions — callable from client, execute on server
- Server Components can wrap Client Components, not vice versa
- Props crossing boundary must be serializable — no functions, no class instances
- Async Server Components use native async/await — no hooks for data fetching
- Each Suspense boundary streams independently — parallel loading
- Server Actions with 'useActionState' replace form handlers, API routes, loading states
- Test async Server Components with mocked DB + renderToString
- Default (no directive) is Server Component — only add directives when needed

## Common Misconception

**"Server Components are the same as SSR (server-side rendering)."**

SSR renders components to HTML on server, ships JS bundle, then hydrates to full interactivity. Every component in SSR runs client-side eventually. Server Components never hydrate — they produce zero JS. SSR still sends component code to browser; Server Components send only rendered output. SSR is a delivery mechanism; Server Components are a component model. They complement each other: SSR can deliver Server Component output as HTML stream, but the Server Component itself never becomes client code. The difference is categorical: SSR is "render on server, hydrate on client"; RSC is "render on server, stay on server."

---

## Feynman Explain
(Explain Server Components vs Client Components to a junior developer who knows React basics but has never heard of RSC. Use an analogy like "restaurant kitchen vs dining table." Explain: what each environment does, where data comes from, what "zero bundle size" means practically, and why directives exist.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain advanced-react-19` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Server Components add complexity — two mental models, serialization rules, framework lock-in. When is the added complexity worth it? When is a single-environment SPA still the better choice? Write your evaluation. Consider: team size, deployment target, interactivity density, SEO needs, build time.)

---

## Drill
Take the quiz. MCQs test directives, composition boundaries, serialization, async patterns, and streaming.

Run: `learn.sh quiz advanced-react-19 08-server-components`
