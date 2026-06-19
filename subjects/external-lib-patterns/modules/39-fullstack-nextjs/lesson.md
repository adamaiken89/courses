# Module 39: Full-Stack Framework — Next.js App Router

Est. study time: 2.5h
Language: en

## Learning Objectives
- Architect Next.js App Router with layout.tsx, page.tsx, loading.tsx, error.tsx
- Distinguish Server Components vs Client Components and data fetching patterns
- Implement Route Handlers, Middleware, Metadata API, and ISR
- Build Server Actions for mutations with React 19 useActionState
- Apply Streaming SSR with Suspense boundaries
- Manage React 19 patterns: use(), ref as prop in RSC boundaries
---

## Core Content

### App Router File Conventions

```
app/
├── layout.tsx          # Shared layout (wraps all pages)
├── page.tsx            # Home page (/)
├── loading.tsx         # Loading UI (Suspense fallback)
├── error.tsx           # Error boundary
├── global-error.tsx    # Root error boundary
├── not-found.tsx       # 404 page
├── route.tsx           # Route handler (API endpoint; pick one)
├── template.tsx        # Re-mount on navigation (rare)
└── [slug]/
    ├── page.tsx
    └── loading.tsx
```

Each segment can define its own layout, loading, and error. Nested layouts persist across navigations.

### Layout Hierarchy

```typescript
// app/layout.tsx — Root layout
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav>{/* shared nav */}</nav>
        </header>
        <main>{children}</main>
        <footer>{/* shared footer */}</footer>
      </body>
    </html>
  );
}
```

```typescript
// app/courses/layout.tsx — Segment layout
export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="courses-container">
      <aside>{/* sidebar filters */}</aside>
      <article>{children}</article>
    </section>
  );
}
```

### Server Components vs Client Components

All components in App Router are **Server Components by default**.

| Aspect | Server Component | Client Component |
|---|---|---|
| Default | Yes | No (must use "use client") |
| Data fetching | Direct (async, DB) | useEffect or lib |
| Bundle size | Zero JS | Full JS in bundle |
| State/hooks | No | useState, useEffect, etc |
| Event handlers | No | onClick, onSubmit |
| When to use | Static data, layout, SEO | Interactivity, browser APIs |

```typescript
// Server Component: fetches data directly
// app/courses/page.tsx
import { db } from "@/lib/db";

async function getCourses() {
  return db.query("SELECT * FROM courses");
}

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <ul>
      {courses.map((c) => (
        <li key={c.id}>{c.title}</li>
      ))}
    </ul>
  );
}
```

```typescript
// Client Component: interactive filter
"use client";

import { useState } from "react";

export function CourseFilter({ tags }: { tags: string[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (tag: string) => {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div>
      {tags.map((tag) => (
        <button
          key={tag}
          className={selected.includes(tag) ? "active" : ""}
          onClick={() => toggle(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
```

### Data Fetching Patterns

```typescript
// Parallel data fetching
async function Page({ params }: { params: { slug: string } }) {
  const [course, reviews] = await Promise.all([
    getCourse(params.slug),
    getReviews(params.slug),
  ]);

  return (
    <div>
      <CourseDetail course={course} />
      <ReviewList reviews={reviews} />
    </div>
  );
}
```

```typescript
// Sequential data fetching (waterfall)
async function InstructorPage({ params }: { params: { id: string } }) {
  const instructor = await getInstructor(params.id);
  const courses = await getCoursesByInstructor(instructor.id);

  return <InstructorProfile instructor={instructor} courses={courses} />;
}
```

### Route Handlers

```typescript
// app/api/courses/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const tag = searchParams.get("tag");

  const courses = await db.query(
    "SELECT * FROM courses WHERE tag = $1",
    [tag]
  );

  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const course = await db.insert("courses", body);
  return NextResponse.json(course, { status: 201 });
}
```

### Middleware

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("session")?.value;

  if (!token && req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (req.nextUrl.pathname.startsWith("/fr")) {
    const rest = req.nextUrl.pathname.replace("/fr", "");
    return NextResponse.rewrite(new URL(rest, req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/fr/:path*"],
};
```

### Metadata API

```typescript
// app/courses/[slug]/page.tsx
import type { Metadata } from "next";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await getCourse(params.slug);

  return {
    title: `${course.title} | CourseReader`,
    description: course.description,
    openGraph: {
      title: course.title,
      description: course.description,
      type: "article",
    },
  };
}

export default async function CoursePage({ params }: Props) {
  const course = await getCourse(params.slug);
  return <CourseDetail course={course} />;
}
```

### Static Generation and ISR

```typescript
// Static generation (SSG) at build time
export async function generateStaticParams() {
  const courses = await db.query("SELECT slug FROM courses");
  return courses.map((c: { slug: string }) => ({ slug: c.slug }));
}

// ISR: revalidate every 60 seconds
export const revalidate = 60;

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  return <CourseDetail course={course} />;
}
```

### Dynamic Rendering

Next.js detects dynamic APIs (cookies, headers, searchParams) and opts into dynamic rendering:

```typescript
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const results = q ? await searchCourses(q) : [];

  return (
    <div>
      <SearchForm initialQuery={q} />
      {results.map((r) => (
        <SearchResult key={r.id} result={r} />
      ))}
    </div>
  );
}
```

### Streaming SSR with loading.tsx

```typescript
// app/courses/[slug]/loading.tsx
export default function CourseLoading() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-title" />
      <div className="skeleton-body" />
    </div>
  );
}
```

```typescript
// app/courses/[slug]/page.tsx
import { Suspense } from "react";

async function CourseContent({ slug }: { slug: string }) {
  await new Promise((r) => setTimeout(r, 500)); // simulate slow fetch
  const course = await getCourse(slug);
  return <CourseDetail course={course} />;
}

async function ReviewsContent({ slug }: { slug: string }) {
  await new Promise((r) => setTimeout(r, 1000));
  const reviews = await getReviews(slug);
  return <ReviewList reviews={reviews} />;
}

export default async function CoursePage({ params }: { params: { slug: string } }) {
  return (
    <div>
      <Suspense fallback={<div className="skeleton-title" />}>
        <CourseContent slug={params.slug} />
      </Suspense>
      <Suspense fallback={<div className="skeleton-reviews" />}>
        <ReviewsContent slug={params.slug} />
      </Suspense>
    </div>
  );
}
```

### React 19: Server Actions for Mutations

```typescript
// app/courses/[slug]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

const ReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(10),
});

export async function submitReview(slug: string, formData: FormData) {
  const parsed = ReviewSchema.parse({
    rating: Number(formData.get("rating")),
    comment: formData.get("comment"),
  });

  await db.insert("reviews", {
    courseSlug: slug,
    ...parsed,
    createdAt: new Date(),
  });

  revalidatePath(`/courses/${slug}`);
}
```

```typescript
// app/courses/[slug]/ReviewForm.tsx
"use client";

import { useActionState } from "react";
import { submitReview } from "./actions";

export function ReviewForm({ slug }: { slug: string }) {
  const [state, action, isPending] = useActionState(
    async (_prev: { success: boolean; error?: string }, formData: FormData) => {
      try {
        await submitReview(slug, formData);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    { success: false }
  );

  if (state.success) return <p>Review submitted!</p>;

  return (
    <form action={action}>
      <input type="number" name="rating" min={1} max={5} required />
      <textarea name="comment" required />
      {state.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
```

### React 19: use() for Parallel Data Fetching

```typescript
import { use } from "react";

function CourseDetails({ coursePromise }: { coursePromise: Promise<Course> }) {
  const course = use(coursePromise);
  return <CourseDetail course={course} />;
}

function ReviewSection({ reviewsPromise }: { reviewsPromise: Promise<Review[]> }) {
  const reviews = use(reviewsPromise);
  return <ReviewList reviews={reviews} />;
}

export default function CoursePage({ params }: { params: { slug: string } }) {
  const coursePromise = getCourse(params.slug);
  const reviewsPromise = getReviews(params.slug);

  return (
    <div>
      <Suspense fallback={<div>Loading course...</div>}>
        <CourseDetails coursePromise={coursePromise} />
      </Suspense>
      <Suspense fallback={<div>Loading reviews...</div>}>
        <ReviewSection reviewsPromise={reviewsPromise} />
      </Suspense>
    </div>
  );
}
```

### React 19: Ref as Prop in RSC Boundaries

```typescript
"use client";

import { useRef } from "react";

export function ScrollableSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div ref={ref}>
      {children}
      <button className="inline-button" onClick={scrollToTop}>
        Scroll to top
      </button>
    </div>
  );
}
```

React 19 passes `ref` as regular prop, not special `forwardRef`. Server Components pass props to Client Components that use ref.

### React Compiler in Next.js

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
};
export default nextConfig;
```

React Compiler auto-memoizes Server Actions and Client Component callbacks, reducing re-renders in form-heavy pages.

---

### Why This Matters

Next.js App Router is the de facto full-stack React framework. Server Components eliminate client JS for data fetching. Streaming SSR improves perceived performance. Server Actions simplify mutations without API routes. Understanding layout hierarchy, data patterns, and React 19 integration is essential for production Next.js apps.

---

### Common Questions

**Q: When to use Route Handler vs Server Action?**
A: Route Handler for external API consumption (mobile apps, third-party). Server Action for form mutations within same app (revalidatePath, progressive enhancement).

**Q: Can I use useState in Server Component?**
A: No. Server Components execute on server, no state hooks. Use Client Component for interactivity.

**Q: How does ISR work with dynamic routes?**
A: generateStaticParams pre-builds pages. revalidate tag in page re-fetches data and regenerates HTML on-demand after stale time.

---

## Examples

### Example 1: Full App Router Page with Streaming

```typescript
// app/dashboard/page.tsx
import { Suspense } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { StatsCards } from "./StatsCards";
import { RecentActivity } from "./RecentActivity";
import { DashboardSkeleton } from "./loading";

export default async function DashboardPage() {
  return (
    <div>
      <DashboardHeader />
      <Suspense fallback={<DashboardSkeleton />}>
        <StatsCards />
      </Suspense>
      <Suspense fallback={<div className="skeleton-list" />}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}
```

```typescript
// app/dashboard/StatsCards.tsx (Server Component)
import { db } from "@/lib/db";

export async function StatsCards() {
  const [totalUsers, revenue, activeCourses] = await Promise.all([
    db.query("SELECT COUNT(*) as count FROM users"),
    db.query("SELECT SUM(amount) as total FROM payments"),
    db.query("SELECT COUNT(*) as count FROM courses WHERE active = true"),
  ]);

  return (
    <div className="stats-grid">
      <StatCard label="Users" value={totalUsers[0].count} />
      <StatCard label="Revenue" value={`$${revenue[0].total}`} />
      <StatCard label="Active Courses" value={activeCourses[0].count} />
    </div>
  );
}
```

### Example 2: Server Action Form with Validation

```typescript
// app/newsletter/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

const EmailSchema = z.string().email();

export async function subscribeNewsletter(formData: FormData) {
  const email = formData.get("email");

  const parsed = EmailSchema.safeParse(email);
  if (!parsed.success) {
    return { error: "Invalid email address" };
  }

  await db.insert("newsletter_subscribers", {
    email: parsed.data,
    subscribedAt: new Date(),
  });

  revalidatePath("/newsletter");
  return { success: true };
}
```

```typescript
// app/newsletter/SubscribeForm.tsx
"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "./actions";

export function SubscribeForm() {
  const [state, action, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean }, fd: FormData) => {
      return subscribeNewsletter(fd);
    },
    {}
  );

  return (
    <form action={action} className="subscribe-form">
      <input type="email" name="email" placeholder="you@example.com" required />
      <button type="submit" disabled={isPending}>
        {isPending ? "Subscribing..." : "Subscribe"}
      </button>
      {state?.success && <p className="success">Subscribed!</p>}
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
```

### Example 3: Middleware Auth + i18n

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "fr", "es"];
const defaultLocale = "en";

function getLocale(req: NextRequest): string {
  const acceptLang = req.headers.get("accept-language");
  if (!acceptLang) return defaultLocale;
  const preferred = acceptLang.split(",")[0].split("-")[0];
  return locales.includes(preferred) ? preferred : defaultLocale;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale) {
    const locale = getLocale(req);
    return NextResponse.redirect(
      new URL(`/${locale}${pathname}`, req.url)
    );
  }

  const token = req.cookies.get("session")?.value;
  if (!token && pathname.includes("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next|static|favicon.ico).*)"],
};
```

---

## Key Takeaways
- App Router: layout.tsx wraps page.tsx, loading.tsx = Suspense fallback, error.tsx = error boundary
- Server Components fetch data directly; Client Components handle interactivity
- Route Handlers for external APIs; Server Actions for form mutations
- ISR: generateStaticParams + revalidate for hybrid static/dynamic pages
- Streaming SSR: Suspense boundaries stream independent sections
- React 19: useActionState for form state, use() for parallel data, ref as prop
- React Compiler: experimental flag in next.config.ts auto-memoizes
- Middleware handles auth + i18n before request reaches page

## Common Misconception

"**Server Actions replace all API routes.**"

Server Actions replace form mutations within same Next.js app. They cannot be consumed by external clients (mobile apps, curl). Route Handlers (app/api/route.ts) remain necessary for REST API endpoints consumed outside the Next.js app.

## Feynman Explain

Next.js App Router = filesystem routing + server rendering + streaming + mutations. layout.tsx = persistent shell. page.tsx = route content. loading.tsx = what user sees while waiting. error.tsx = what user sees on failure. Server Components run SQL on server, send HTML (no JS). Client Components send JS bundle for interactivity. Server Actions are functions that run on server when form submits. Streaming sends HTML in chunks as each async fetch resolves.

## Reframe

Next.js App Router merges backend (Express routes, DB queries) with frontend (React components). Server Components = controller + view merged. Server Actions = controller mutation endpoint. Route Handlers = REST API. Middleware = reverse proxy. ISR = CDN cache with background revalidation. Layout hierarchy = component tree as URL tree.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 39-fullstack-nextjs`
