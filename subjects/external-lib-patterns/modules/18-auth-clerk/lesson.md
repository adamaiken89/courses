# Module 18: Authentication — Clerk

Est. study time: 2h
Language: en

## Learning Objectives
- Set up ClerkProvider with React 19 and configure sign-in/sign-up flow
- Use useUser, useAuth, UserButton, SignIn, SignUp components
- Implement RBAC with Protect component and custom guards
- Manage organizations: create, switch, invite members
- Handle session management and webhooks for backend sync
- Configure middleware for route protection
- Use server-side helpers (clerkClient, auth()) in React 19 Server Components
- TypeScript types for user, session, and organization data

---

## Core Content

### Clerk Architecture

Clerk is auth-as-a-service. Pre-built UI components + backend API + session management.

```
Client App
  ├── ClerkProvider ── (context: user, session, org)
  ├── <SignIn /> ──── UI component (modal or page)
  ├── <UserButton /> ── Profile dropdown
  └── <Protect /> ──── RBAC guard

Backend
  ├── clerkClient ── Admin API
  ├── webhooks ───── User/session lifecycle sync
  └── auth() ─────── Server-side session verification
```

| Component | Purpose |
|-----------|---------|
| ClerkProvider | Wraps app with auth context |
| SignIn / SignUp | Pre-built auth forms |
| UserButton | Profile avatar + dropdown |
| Protect | Render children if user has required role/permission |
| OrganizationSwitcher | Switch active organization |

### Setup with React 19

```typescript
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/nextjs'

function App() {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <SignedOut>
        <SignIn routing="hash" />
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </ClerkProvider>
  )
}
```

Custom appearance:

```typescript
<ClerkProvider
  appearance={{
    baseTheme: darkTheme,
    variables: { colorPrimary: '#6366f1' },
    elements: {
      formButtonPrimary: 'bg-indigo-500 hover:bg-indigo-600',
      card: 'shadow-xl',
    },
  }}
>
```

### User and Session Hooks

```typescript
import { useUser, useAuth } from '@clerk/nextjs'

function Profile() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken, sessionId, orgId, orgRole } = useAuth()

  if (!isLoaded) return <Spinner />
  if (!isSignedIn) return null

  return (
    <div>
      <p>{user.fullName}</p>
      <p>{user.primaryEmailAddress?.emailAddress}</p>
      <p>Role: {orgRole}</p>
      <button onClick={async () => {
        const token = await getToken()
        // Use token for API auth header
      }}>
        Get Token
      </button>
    </div>
  )
}
```

Token management:

```typescript
// Pass session token to backend API
const token = await getToken({ template: 'my-api' })
fetch('/api/data', {
  headers: { Authorization: `Bearer ${token}` },
})
```

### RBAC with Protect

Clerk supports role-based access control via organization roles and permissions.

```typescript
import { Protect } from '@clerk/nextjs'

function AdminPanel() {
  return (
    <Protect
      role="org:admin"
      permission="org:sys:memberships:manage"
      fallback={<p>Access denied</p>}
    >
      <UserManagement />
    </Protect>
  )
}
```

Custom guard using useAuth:

```typescript
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { orgRole } = useAuth()

  if (orgRole !== 'org:admin') {
    return <Navigate to="/unauthorized" />
  }

  return children
}
```

### Organization Management

```typescript
import { useOrganization, useOrganizationList } from '@clerk/nextjs'

function OrgSwitcher() {
  const { organization, membership } = useOrganization()
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: true,
  })

  return (
    <div>
      <p>Current org: {organization?.name}</p>
      {userMemberships?.map((mem) => (
        <button key={mem.organization.id} onClick={() => setActive({ organization: mem.organization.id })}>
          Switch to {mem.organization.name}
        </button>
      ))}
    </div>
  )
}
```

### Server-Side Helpers (React 19 Server Components)

```typescript
import { auth, clerkClient } from '@clerk/nextjs/server'

export default async function ServerProtectedPage() {
  const { userId, orgId, sessionClaims } = await auth()

  if (!userId) {
    return <p>Unauthorized</p>
  }

  const user = await clerkClient.users.getUser(userId)

  return (
    <div>
      <h1>Welcome, {user.firstName}</h1>
      <pre>{JSON.stringify(sessionClaims, null, 2)}</pre>
    </div>
  )
}
```

### Middleware for Route Protection

```typescript
// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware({
  publicRoutes: ['/', '/sign-in', '/sign-up', '/api/webhooks(.*)'],
  ignoredRoutes: ['/api/health'],
})

export const config = {
  matcher: ['/((?!_next|static|favicon.ico).*)'],
}
```

Custom middleware with route-by-route rules:

```typescript
export default clerkMiddleware((auth, req) => {
  const { userId, orgRole } = auth()

  if (!userId && !isPublicRoute(req)) {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  // RBAC per route
  if (req.nextUrl.pathname.startsWith('/admin') && orgRole !== 'org:admin') {
    return redirectToUrl('/unauthorized')
  }
})
```

### Webhooks for Backend Sync

Clerk sends webhooks for user/session lifecycle events.

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')!
  const svixTimestamp = headerPayload.get('svix-timestamp')!
  const svixSignature = headerPayload.get('svix-signature')!

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  const payload = wh.verify(
    await req.text(),
    { 'svix-id': svixId, 'svix-timestamp': svixTimestamp, 'svix-signature': svixSignature }
  ) as any

  const eventType = payload.type
  if (eventType === 'user.created') {
    await createUserInDatabase(payload.data)
  }
  if (eventType === 'user.deleted') {
    await deleteUserFromDatabase(payload.data.id)
  }

  return Response.json({ received: true })
}
```

### TypeScript Types

```typescript
import type { UserResource, SessionResource, OrganizationResource } from '@clerk/types'

function displayUser(user: UserResource) {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.primaryEmailAddress?.emailAddress,
    image: user.imageUrl,
  }
}

type OrgRole = 'org:admin' | 'org:member' | 'org:guest'

interface SessionClaims {
  sid: string
  org_id?: string
  org_role?: OrgRole
  org_permissions?: string[]
}
```

### Email / Social / Magic Link Auth

```typescript
// Configure in Clerk Dashboard
// Supported: Google, GitHub, Apple, Email (OTP), Magic Link, Phone (SMS)
// No code change — toggle in dashboard

// Programmatic sign-in (custom flow)
const { signIn, setActive } = await clerk.client.signIn.create({
  identifier: 'user@example.com',
  strategy: 'password',
  password: 'my-password',
})
await setActive({ session: signIn.createdSessionId })
```

> **Think**: What happens when Clerk dashboard changes auth strategy (e.g., disable password, enable Google SSO)?
>
> *Answer: No code changes. Clerk UI components automatically adapt to enabled strategies. Disabled password → password field hidden. Enabled Google → Google button shown. Client checks strategies from Clerk API at runtime.*

---

### Why This Matters

Authentication is the highest-stakes integration in any app. Security bugs in auth can leak user data, bypass access controls, or expose admin endpoints. Clerk abstracts: session management, MFA, social auth, RBAC, orgs, webhooks. Using a dedicated auth service reduces attack surface compared to self-built auth.

---

### Common Questions

**Q: Can I use Clerk with my own backend API?**
A: Yes. Use `getToken()` on client → pass `Authorization: Bearer <token>` header → verify on backend with Clerk SDK or JWKs endpoint.

**Q: Clerk seems expensive compared to self-built auth. When is it worth it?**
A: Worth when: social auth (Google, GitHub, Apple) is required, RBAC with orgs is needed, team has no security expertise. Not worth if: only email/password auth for single-user admin tool.

---

## Examples

### Example 1: Full App Auth Shell

```typescript
// app/layout.tsx
import { ClerkProvider, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <SignedOut>
        <div className="flex items-center justify-center h-screen">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <header className="flex justify-between p-4">
          <h1>My App</h1>
          <UserButton />
        </header>
        <main>{children}</main>
      </SignedIn>
    </ClerkProvider>
  )
}
```

### Example 2: Route Guard with Org Role

```typescript
// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware((auth, req) => {
  const { userId, orgRole } = auth()
  const path = req.nextUrl.pathname

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  if (path.startsWith('/admin') && orgRole !== 'org:admin') {
    return Response.redirect(new URL('/unauthorized', req.url))
  }
})
```

---

## Key Takeaways
- ClerkProvider wraps app with auth context. SignedIn/SignedOut for conditional rendering.
- useUser for user data, useAuth for session token and org role.
- Protect component for RBAC with role and permission checks.
- Organization management: useOrganization, useOrganizationList, OrganizationSwitcher.
- Middleware for route-level auth checks. Public vs protected routes.
- Server-side: auth() for session verification, clerkClient for admin API.
- Webhooks sync user/session lifecycle to backend database.
- TypeScript types: UserResource, SessionResource, OrganizationResource from @clerk/types.
- Auth strategy changes are dashboard-controlled — no code changes needed.

## Common Misconception

**"Auth is just login/logout. Use a simple JWT library."**

Auth includes: password hashing, social OAuth flows, session rotation, MFA, rate limiting, account recovery, RBAC, org management, webhook sync, GDPR compliance. Each is a security surface. A dedicated auth service covers all. Self-built auth misses edge cases that lead to breaches.

---

## Feynman Explain
(Explain Clerk to backend engineer: Clerk is like having a security team build your auth system. They handle password storage, session tokens, OAuth flows. You get pre-built login UI (SignIn component), middleware (guard routes on server), and webhooks (sync users to your database). Your app asks "is this user allowed?" — Clerk answers after handling the crypto. Compare to building locks from scratch vs ordering from lock manufacturer.)

---

## Reframe
(Pause. Auth is not a UI problem — it is a security infrastructure problem. Clerk provides components, but the real value is: never storing passwords, automatic session rotation, breached password detection, and audit logs. Evaluate auth providers on security guarantees, not UI polish. For apps handling PII, SOC 2 compliance of auth provider matters more than developer experience.)

---

## Drill
Take the quiz. MCQs test ClerkProvider setup, useUser/useAuth, Protect RBAC, organization management, middleware, server-side auth(), webhooks, and TypeScript types.

Run: `learn.sh quiz external-lib-patterns 18-auth-clerk`
