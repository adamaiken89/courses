# Module 23: Type-Safe APIs — tRPC

Est. study time: 2h
Language: en

## Learning Objectives
- Understand tRPC architecture (server router -> client caller)
- Leverage TypeScript inference end-to-end
- Integrate with React Query via tRPC wrappers
- Implement server context (auth) and middleware (rate limit, logging)
- Format and handle errors on both server and client
- Use tRPC with React 19 Server Components (server caller pattern)
- Build mutations compatible with useActionState
---

## Core Content

### tRPC Architecture

tRPC provides end-to-end type safety without code generation:

```typescript
// server/router.ts
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()

export const appRouter = t.router({
  // Query — data fetching
  getUser: t.procedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const user = await db.user.findUnique({ where: { id: input } })
      return user
    }),

  // Mutation — data modification
  createUser: t.procedure
    .input(z.object({
      name: z.string().min(2),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      return db.user.create({ data: input })
    }),
})

export type AppRouter = typeof appRouter
```

Client consumes with full type inference:

```typescript
// client/api.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../server/router'

export const trpc = createTRPCReact<AppRouter>()
```

### TypeScript Inference End-to-End

No code generation needed. TypeScript infers types from server router:

```typescript
// The return type of getUser is automatically inferred
const { data: user } = trpc.getUser.useQuery('some-uuid')
// user: { id: string, name: string, email: string } | undefined

// Input validation is type-checked at compile time
const mutation = trpc.createUser.useMutation()
mutation.mutate({ name: 'Alice', email: 'alice@example.com' })
// Error: missing 'email' field
// Error: wrong type for 'name'
```

Zod schemas on server define both runtime validation and TypeScript types:

```typescript
const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
})

type UserInput = z.infer<typeof UserSchema>
// { name: string; email: string; role: 'admin' | 'user' }
```

### React Query Integration

tRPC wraps TanStack React Query:

```typescript
// _app.tsx — provider setup
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { trpc } from '../utils/api'
import { useState } from 'react'

export function App({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: '/api/trpc' })],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

Usage with query key management and caching:

```typescript
function UserProfile({ userId }: { userId: string }) {
  const utils = trpc.useUtils()

  const { data: user, isLoading } = trpc.getUser.useQuery(userId, {
    staleTime: 30_000, // Cache for 30s
  })

  const updateUser = trpc.updateUser.useMutation({
    onSuccess: () => {
      // Invalidate cache to refetch
      utils.getUser.invalidate(userId)
      // Or invalidate all queries
      utils.invalidate()
    },
  })

  if (isLoading) return <Spinner />
  return <ProfileView user={user} onUpdate={updateUser.mutate} />
}
```

### Server Context and Middleware

Context injects request-scoped data:

```typescript
// server/context.ts
import type { CreateNextContextOptions } from '@trpc/server/adapters/next'
import { getServerSession } from 'next-auth'

export async function createContext({ req, res }: CreateNextContextOptions) {
  const session = await getServerSession(req, res)

  return {
    session,
    user: session?.user ?? null,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
```

Middleware pattern:

```typescript
import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'

const t = initTRPC.context<Context>().create()

// Auth middleware
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

// Rate limit middleware
const rateLimit = t.middleware(async ({ ctx, next, path }) => {
  const key = `ratelimit:${ctx.user?.id ?? 'anon'}:${path}`
  const count = await redis.incr(key)
  if (count > 100) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS' })
  }
  return next()
})

// Logging middleware
const logger = t.middleware(async ({ path, type, next, input }) => {
  const start = Date.now()
  const result = await next()
  const duration = Date.now() - start
  console.log(`[${type}] ${path} — ${duration}ms`)
  return result
})

// Composed procedures
const protectedProcedure = t.procedure.use(logger).use(isAuthenticated).use(rateLimit)
```

Usage:

```typescript
export const appRouter = t.router({
  getDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      return db.dashboard.findMany({ where: { userId: ctx.user.id } })
    }),
})
```

### Error Formatting

Default error serialization:

```typescript
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Expose validation errors client-side
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})
```

Client-side error handling:

```typescript
const mutation = trpc.createUser.useMutation({
  onError: (error) => {
    if (error.data?.zodError) {
      const fieldErrors = error.data.zodError.fieldErrors
      // { name: ['Name is too short'], email: ['Invalid email'] }
      setErrors(fieldErrors)
    }
    if (error.data?.code === 'UNAUTHORIZED') {
      redirectToLogin()
    }
  },
})
```

### React 19 Server Components + tRPC

Server-side caller pattern for Server Components:

```typescript
// server/caller.ts
import { createCallerFactory } from '@trpc/server'
import { appRouter, AppRouter } from './router'

// Singleton caller factory
const createCaller = createCallerFactory(appRouter)

// Async Server Component usage
async function UserProfilePage({ userId }: { userId: string }) {
  // Server-side call with full type safety
  const caller = createCaller({ session: null, user: null })
  const user = await caller.getUser(userId)
  // Typed response without HTTP round-trip

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

### Mutations with useActionState (React 19)

```typescript
'use client'
import { useActionState } from 'react'
import { trpc } from '../utils/api'

function CreateUserForm() {
  const utils = trpc.useUtils()
  const mutation = trpc.createUser.useMutation()

  const [state, formAction, isPending] = useActionState(
    async (prevState: { error?: string }, formData: FormData) => {
      try {
        await mutation.mutateAsync({
          name: formData.get('name') as string,
          email: formData.get('email') as string,
        })
        await utils.getUsers.invalidate()
        return { error: undefined }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
    { error: undefined }
  )

  return (
    <form action={formAction}>
      <input name="name" required minLength={2} />
      <input name="email" type="email" required />
      <button disabled={isPending} type="submit">
        {isPending ? 'Creating...' : 'Create User'}
      </button>
      {state.error && <p className="text-red-500">{state.error}</p>}
    </form>
  )
}
```

---

### Why This Matters

tRPC eliminates the most common source of bugs in full-stack apps: mismatched API contracts. Shared types between server and client mean refactoring a database field propagates type errors everywhere it's used, catching issues at compile time.

---

### Common Questions

**Q: How does tRPC compare to GraphQL?**

A: tRPC is simpler — no schema definition language, no resolvers, no code generation. Both provide type safety. tRPC is RPC-style; GraphQL is query-language-style. tRPC excels for server-rendered apps; GraphQL suits client-driven data requirements.

**Q: Can tRPC handle file uploads?**

A: Yes. Use form data with tRPC's `httpBatchLink` or handle uploads separately outside tRPC, then pass the URL as procedure input.

---

## Examples

### Example 1: Complete Router with Middleware

```typescript
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.context<Context>().create()

const auth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})

const protectedProcedure = t.procedure.use(auth)

export const appRouter = t.router({
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    return db.project.findMany({ where: { ownerId: ctx.user.id } })
  }),

  createProject: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.project.create({
        data: { ...input, ownerId: ctx.user.id },
      })
    }),

  deleteProject: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      const project = await db.project.findUnique({ where: { id: input } })
      if (!project || project.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      return db.project.delete({ where: { id: input } })
    }),
})
```

### Example 2: React Wrapper Hooks with Query Integration

```typescript
// hooks/useProjects.ts
import { trpc } from '../utils/api'

export function useProjects() {
  const utils = trpc.useUtils()

  const { data: projects, isLoading } = trpc.listProjects.useQuery(undefined, {
    staleTime: 60_000,
  })

  const createProject = trpc.createProject.useMutation({
    onSuccess: () => {
      utils.listProjects.invalidate()
    },
  })

  const deleteProject = trpc.deleteProject.useMutation({
    onSuccess: (deletedId) => {
      utils.listProjects.setData(undefined, (old) =>
        old?.filter(p => p.id !== deletedId)
      )
    },
  })

  return { projects, isLoading, createProject, deleteProject }
}
```

### Example 3: Server-Side Caller in Next.js App Router

```typescript
// app/dashboard/page.tsx
import { createCaller } from '@/server/caller'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const caller = createCaller({
    session: await getServerSession(),
    user: null,
  })

  const [projects, stats] = await Promise.all([
    caller.listProjects(),
    caller.getDashboardStats(),
  ])

  return <DashboardClient projects={projects} stats={stats} />
}
```

---

## Key Takeaways
- tRPC provides end-to-end type safety without code generation
- Zod schemas define both validation and TypeScript types
- Middleware pattern enables auth, rate limiting, and logging
- React 19 Server Components use server caller pattern directly
- useActionState composes with tRPC mutations for progressive enhancement

## Common Misconception

"**tRPC only works with Next.js and React.**"

tRPC is framework-agnostic. Server adapters exist for Express, Fastify, AWS Lambda, Next.js. Client adapters exist for React, Vue, Svelte, and vanilla TypeScript.

## Feynman Explain

tRPC makes your API types flow from database to UI automatically. Define a function on server that takes typed input and returns typed output. Client calls that function as if it were local. TypeScript ensures types match — no manual API docs, no TypeScript duplication, no runtime surprises.

## Reframe

Every type mismatch between frontend and backend is a bug that type checking could have caught. tRPC closes that gap entirely. The cost: you commit to TypeScript on both sides. The benefit: API contract violations become compile errors instead of runtime crashes.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 23-trpc`
