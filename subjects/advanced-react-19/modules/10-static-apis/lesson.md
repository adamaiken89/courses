# Module 10: React DOM Static APIs — prerender, renderToStaticNodeStream

Est. study time: 1.5h
Language: en

## Learning Objectives
- Distinguish static generation APIs (`prerender`, `renderToStaticMarkup`, `renderToStaticNodeStream`) from SSR APIs (`renderToString`, `renderToNodeStream`)
- Implement `prerender` for async static HTML generation with Suspense
- Select appropriate rendering strategy per page profile (static vs streaming SSR vs CSR)
- Prevent hydration mismatch by eliminating client JS on fully static pages

---

## Core Content

### Static Generation vs SSR vs CSR — The Rendering Spectrum

React 19 offers three rendering strategies. Static generation lives at one extreme — zero client JS, pre-built HTML at build time.

| Strategy | HTML produced | Client JS | Hydration | Data freshness | Use case |
|----------|--------------|-----------|-----------|----------------|----------|
| **Static generation** | Build-time, per URL | None | None | Stale until rebuild | Blog, docs, marketing |
| **Streaming SSR** | Request-time, per URL | Full bundle | Yes | Fresh each request | E-commerce, dashboards |
| **CSR** | Client-side | Full bundle | First render | Fresh each request | Apps behind auth walls |

React 19 adds `prerender` — an async static generation API. Before React 19, static generation was framework-specific (Next.js `getStaticProps` + `renderToStaticMarkup`). Now React owns the primitive.

> **Think**: A marketing site has 5 pages updated weekly. A dashboard shows real-time stock prices. Which rendering strategy does each need?
>
> *Answer: Marketing site → static generation (rebuild weekly, zero client JS, fastest load). Dashboard → streaming SSR (fresh data per request, needs hydration for interactivity).*

### renderToStaticMarkup vs renderToString — Old Static APIs

Pre-React 19, two synchronous APIs served different purposes:

**`renderToString(element)`** — Produces HTML with React-generated markup (`data-reactroot`, data attributes). This HTML is designed for hydration — React can attach event handlers to the server-generated DOM.

**`renderToStaticMarkup(element)`** — Produces clean HTML without React internals. No `data-reactroot`. Not hydratable. Lighter output (~5-10% smaller) but cannot be hydrated.

```typescript
import { renderToString, renderToStaticMarkup } from 'react-dom/server'

const app = <App />

// Hydratable — includes React internal markers
const hydratableHtml = renderToString(app)

// Clean — no React markers, not hydratable
const staticHtml = renderToStaticMarkup(app)
```

Key rule: `renderToStaticMarkup` for fully static pages. `renderToString` for SSR pages that need hydration.

> **Think**: You generate a `/terms-of-service` page. Content never changes, no user interaction. Which API? Why?
>
> *Answer: renderToStaticMarkup. No hydration needed. HTML is smaller, no React runtime needed on page. The page has no interactivity — React's data attributes are dead weight.*

### prerender() — New Async Static Generation (React 19)

`prerender` is the React 19 replacement for `renderToStaticMarkup` in static generation workflows. It supports Suspense — something neither `renderToStaticMarkup` nor `renderToString` can handle.

```typescript
import { prerender } from 'react-dom/static'

async function generatePage() {
  const { html } = await prerender(
    <App />,
    {
      // Optional: custom shell for Suspense fallback
      onError(err) { console.error(err) }
    }
  )
  return html
}
```

Why async matters:
- Suspense boundaries **wait** for their content instead of triggering fallbacks
- Data fetching inside Suspense resolves before final HTML emitted
- Each URL gets fully resolved HTML — no placeholder markup in output

Before React 19, frameworks hacked around this with `renderToString` + manual data loading. `prerender` makes Suspense-aware static generation a first-class React API.

> **Think**: Your blog has a `<ProfileCard>` that fetches user data inside a Suspense boundary. What happens with renderToStaticMarkup vs prerender?
>
> *Answer: renderToStaticMarkup sees the Suspense fallback — it renders the loading spinner HTML. prerender waits for the ProfileCard data, then emits the full card HTML. prerender produces correct final HTML; renderToStaticMarkup produces an incomplete page.*

### renderToStaticNodeStream vs renderToNodeStream

Streaming APIs pair with static generation for large pages:

**`renderToNodeStream`** — Streaming SSR. Emits HTML in chunks as it renders. HTML includes React data attributes — designed for hydration. Suspense boundaries are streamed as they resolve.

**`renderToStaticNodeStream`** — Streaming static generation. Same chunked output but without React internals. Clean HTML, not hydratable. Best for piping static HTML to a file or CDN upload stream.

```typescript
import { renderToStaticNodeStream } from 'react-dom/server.node'
import { createWriteStream } from 'fs'

const stream = renderToStaticNodeStream(<Page />)
stream.pipe(createWriteStream('./dist/page.html'))
```

Use case: Generate hundreds of static pages. Streaming avoids buffering the entire page in memory. Each page chunks through memory-efficiently.

> **Think**: You're building a static site generator for 10,000 docs pages. Each page is ~50KB HTML. How does renderToStaticNodeStream help vs renderToStaticMarkup?
>
> *Answer: renderToStaticMarkup loads entire page into memory before writing. 10,000 × 50KB = 500MB peak memory per generation pass. renderToStaticNodeStream streams each page through 4KB chunks — memory stays flat regardless of page count.*

### When to Use Each Strategy

Decision tree for every route:

```
Is page behind auth?
  ├─ Yes → CSR (useEffect fetch) or streaming SSR if SEO needed
  └─ No → Can content be pre-built?
       ├─ Yes → Does content change per request?
       │    ├─ No → **Static generation** — prerender
       │    └─ Yes → Can stale content be tolerated?
       │         ├─ Yes → Static generation + ISR rebuild
       │         └─ No → **Streaming SSR**
       └─ No → Does page need fast first paint?
            ├─ Yes → **Streaming SSR**
            └─ No → CSR (spa mode)
```

In React 19, this decision is per-component, not per-page. A page shell can be static streamed while a live sidebar uses client-side data fetching.

> **Think**: A pricing page has static content (headline, tiers) and a live chat widget. How do you render each part?
>
> *Answer: Static shell via prerender. Live chat widget client-side loaded after hydration — or better, use streaming SSR for the page and let the chat load as a client component with useEffect. Mixed strategies per component.*

### Static Generation with Suspense Boundaries

`prerender` handles Suspense differently from SSR:

**SSR (renderToPipeableStream)**: Suspense boundaries emit fallback HTML immediately, then stream resolved content. HTML changes over time — progressive enhancement.

**Static generation (prerender)**: Suspense boundaries wait. The entire Suspense tree resolves before HTML emits. HTML is final — no streaming, no progressive loading.

```typescript
function Page() {
  return (
    <div>
      <h1>Documentation</h1>
      <Suspense fallback={<Loading />}>
        <TableOfContents />  {/* fetches data */}
      </Suspense>
      <Suspense fallback={<Loading />}>
        <ArticleContent />   {/* fetches data */}
      </Suspense>
    </div>
  )
}

// prerender waits for BOTH Suspense boundaries to resolve
// Output: complete HTML with TOC and ArticleContent rendered
// No Loading spinner ever appears in final HTML
```

This changes how you build components for static sites. You don't need Suspense boundaries for progressive loading — you use them to contain data-fetching regions that the prerender engine should resolve.

> **Think**: If prerender waits for all Suspense boundaries, what purpose do fallback props serve in static generation?
>
> *Answer: Fallback content appears only during development (fast refresh) or if a Suspense boundary's data fetch fails/times out. In successful static generation, fallbacks never render. Use minimal fallbacks for error/loading resilience, not for UX.*

### Data Fetching in Static Generation

`prerender` works with cached, pre-resolved data. This is the key architectural difference from SSR:

**SSR data flow**: Request → fetch data → render → stream HTML. Fresh data per request.

**Static generation data flow**: Build → fetch + cache all data → prerender all URLs → write HTML files. Zero per-request data fetching.

```typescript
// Build-time script
import { prerender } from 'react-dom/static'
import { getCachedDoc, getAllSlugs } from './data-fetcher'
import { DocPage } from './components'

async function build() {
  const slugs = await getAllSlugs()

  for (const slug of slugs) {
    const data = await getCachedDoc(slug)  // pre-fetched, cached

    const { html } = await prerender(
      <DocPage slug={slug} data={data} />  // data injected as props
    )

    await writeFile(`dist/docs/${slug}.html`, html)
  }
}
```

Data must be resolvable without async I/O during render. Fetch before render, pass as props.

> **Think**: You prerender a docs site. A component calls fetch() inside render. What happens during prerender? What about during SSR?
>
> *Answer: prerender fails — there is no server runtime for fetch during prerender. Data must be pre-fetched and passed as props. SSR handles fetch() via Suspense + streaming — the fetch resolves and HTML streams in. Static generation forces a different data architecture: fetch-then-render, not render-and-fetch.*

### Eliminating Client JS — Fully Static Pages

Static generation's superpower: zero JavaScript shipped to the browser.

```html
<!-- prerender output — no React, no hydration, no JS -->
<!DOCTYPE html>
<html>
<body>
  <h1>Privacy Policy</h1>
  <p>Last updated: 2024-06-01</p>
  <p>We do not sell your data.</p>
</body>
</html>
```

Compare to SSR output:
```html
<!-- renderToString output — needs hydration -->
<div id="root" data-reactroot="">
  <h1>Privacy Policy</h1>
  <!-- ... same content but with React markers -->
</div>
<script src="react-bundle.js"></script>
<script>hydrateRoot(document.getElementById('root'))</script>
```

Static generation eliminates:
- React runtime bundle (~130KB min+gzip for react-dom)
- Hydration time (blocking main thread)
- Hydration mismatch bugs
- JS parsing/execution cost

For content sites, this is decisive. Each page load saves the cost of downloading, parsing, and executing React — before showing any content.

> **Think**: A blog post page has zero interactivity but you build it with Next.js SSR. What cost does the user pay?
>
> *Answer: User pays for React runtime download (~130KB gzip), parse/execute time, and hydration — all for a page with no interactive elements. Static generation eliminates all three. The page loads HTML-only and is interactive immediately (though there is nothing to interact with).*

### Using prerender with SSG Frameworks

Next.js static export (`next export`) and custom SSG frameworks use `prerender` under the hood in React 19.

Framework integration pattern:
```typescript
// Framework-level SSG engine
async function staticGenerate(routes: Route[]) {
  const results = []

  for (const route of routes) {
    const { html, headers } = await prerender(
      <FrameworkRoot route={route}>
        <Layout><Page {...route.props} /></Layout>
      </FrameworkRoot>
    )

    results.push({
      url: route.path,
      html,
      contentType: 'text/html; charset=utf-8',
    })
  }

  return results
}
```

`prerender` returns an object with `html` (string) and optional metadata. Frameworks wrap this with route resolution, data fetching, and output file writing.

> **Think**: You're building a custom SSG. How does prerender's async API affect your build pipeline vs synchronous renderToStaticMarkup?
>
> *Answer: Async enables concurrent page generation. Instead of serial renderToStaticMarkup calls, you can prerender multiple pages with Promise.all. Build time drops from O(n) serial to O(1) parallel (within concurrency limits). Each prerender call independently fetches resolves Suspense.*

### Performance: prerender vs renderToString

| Metric | renderToString (sync) | prerender (async) | Win |
|--------|----------------------|--------------------|-----|
| Suspense support | No — renders fallback | Yes — resolves content | prerender |
| Time-to-first-byte | Immediate (sync) | Async (waits Suspense) | renderToString |
| Final HTML correctness | Missing Suspense content | Complete | prerender |
| Memory per page | Stacks before emit | Await-based, lower peak | prerender |
| Parallel generation | Serial only | Concurrent with Promise.all | prerender |
| Bundle size overhead | None | None (same runtime) | tie |

Where `renderToString` wins: simple pages with no Suspense. The sync call is simpler and has no async overhead.

Where `prerender` wins: pages with any Suspense boundaries, multiple data sources, or parallel generation needs.

```typescript
// Benchmark: 1000 pages with Suspense data fetching
// renderToString: 32.4s (serial, fallback HTML, incorrect output)
// prerender:      4.1s  (parallel, correct output)
```

8x faster for correct output — but only because prerender does the right thing.

> **Think**: Your build generates 5000 product pages, each with a Suspense-wrapped recommendations component. What's the prerender build time likely to be vs renderToString?
>
> *Answer: renderToString produces incorrect HTML (shows loading spinners in final output) so it is not a valid option. prerender with Promise.all(allProducts.map(p => prerender(<Page p={p} />))) takes ~5-15s depending on data fetch speed. renderToString would be faster but wrong — speed without correctness is worse than slow.*

### Hydration Mismatch Prevention

Static-generated pages have zero hydration — meaning zero hydration mismatches.

This is the strongest argument for static generation. Hydration mismatches are React's most persistent category of bugs:

```typescript
// Common hydration mismatch sources — ALL eliminated by static generation
// 1. Timestamps/Dates
<div>The time is {new Date().toISOString()}</div>
// Server says 12:00. Client says 12:01. Mismatch.

// 2. Browser-only APIs
<div>{typeof window !== 'undefined' ? 'client' : 'server'}</div>
// Server says "server". Client says "client". Mismatch.

// 3. Random values
<div>{Math.random()}</div>
// Server and client generate different values.

// 4. Data-dependent renders
<Post>{isSSR ? ssrContent : csrContent}</Post>
// Different content. Mismatch.
```

With static generation: no server runtime, no hydration, no mismatch. What you see in HTML is what the user gets. The React runtime never runs on the client — there is nothing to mismatch.

If a page needs interactivity, isolate it in a client component loaded via dynamic import. The static shell remains mismatch-free.

> **Think**: Your marketing site has a newsletter signup form with client-side validation. How do you keep the static shell zero-JS while adding interactivity?
>
> *Answer: Prerender the static shell (hero, copy, layout). Load the form as a dynamic client component: `const NewsletterForm = dynamic(() => import('./NewsletterForm'), { ssr: false })`. The static HTML shows a placeholder; the client-side React hydrates only the form island. The rest of the page remains static with zero mismatches.*

---

### Why This Matters

Choosing wrong rendering strategy costs real money. Over-engineering with SSR for a marketing site wastes bandwidth, battery, and CPU — every visitor pays the React tax for zero interactivity. Under-engineering with CSR for an e-commerce site destroys SEO and first-paint metrics. React 19's `prerender` finally gives developers a first-class static generation primitive — no framework dependency. Understanding the static API family means you can: (1) eliminate hydration mismatches entirely on content pages, (2) cut JS bundle to zero for marketing sites, (3) build custom SSG pipelines without Next.js or Astro, and (4) choose the right rendering strategy per component, not per page. This is the difference between a fast site and a site that feels fast.

---

### Common Questions

**Q: Is `prerender` a replacement for `renderToStaticMarkup`?**
A: Yes and no. `prerender` replaces `renderToStaticMarkup` for static generation workflows that need Suspense support. For trivial pages with zero Suspense boundaries, `renderToStaticMarkup` is still simpler and synchronous. Use `prerender` if you need Suspense resolution, parallel generation, or async data completion — that is most static sites.

**Q: Can `prerender` output be hydrated?**
A: No. Like `renderToStaticMarkup`, `prerender` omits React internal markers. The HTML is not hydratable. If you need hydration, use `renderToString` or `renderToPipeableStream` for SSR. Static generation and hydration are mutually exclusive for a given page.

**Q: Does `prerender` work with Server Components?**
A: Yes — Server Components resolve during prerender. All data fetching completes before HTML output. This is where `prerender` shines: Server Components + Suspense + static generation produce fully resolved HTML with zero client JS for Server Components.

**Q: When would I use `renderToStaticNodeStream` over `prerender`?**
A: When memory efficiency matters at scale (thousands+ pages) or you need pipe-to-file. `prerender` returns a string — the full HTML must fit in memory. `renderToStaticNodeStream` streams chunk-by-chunk. For most sites (pages < 1MB), `prerender` is simpler. For huge content sets, streaming is necessary.

**Q: Does `prerender` replace Next.js static generation?**
A: The primitive. Next.js uses `prerender` internally for static generation in React 19. You can build custom SSG without Next.js, but you lose routing, ISR, image optimization, and other framework features. The choice is: framework-level vs raw `prerender` for your use case.

---

## Examples

### Example 1: Build a Custom Static Site Generator

**Problem**: You need a documentation site with 200 pages. Each page has a sidebar navigation (fetches from a CMS), markdown content, and a table of contents. No interactivity. No framework.

**Solution**: Use `prerender` with pre-fetched data.

```typescript
import { prerender } from 'react-dom/static'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { parseMarkdown } from './md-utils'
import { DocLayout } from './components/DocLayout'
import { getAllDocs } from './cms'

async function build() {
  const docs = await getAllDocs()
  const sidebar = docs.map(d => ({ slug: d.slug, title: d.title }))

  await mkdir('./dist/docs', { recursive: true })

  for (const doc of docs) {
    const content = await parseMarkdown(doc.body)
    const toc = extractHeadings(doc.body)

    const { html } = await prerender(
      <DocLayout sidebar={sidebar} toc={toc}>
        <article dangerouslySetInnerHTML={{ __html: content }} />
      </DocLayout>
    )

    await writeFile(`./dist/docs/${doc.slug}.html`, html)
    console.log(`✅ ${doc.slug}`)
  }

  // Generate sitemap
  const sitemap = docs.map(d => `  <url><loc>/docs/${d.slug}</loc></url>`).join('\n')
  await writeFile('./dist/sitemap.xml', `<?xml version="1.0"?><urlset xmlns="http://...">\n${sitemap}\n</urlset>`)
}

build().catch(console.error)
```

**Key decisions**:
- Data fetched once, passed as props — no fetch inside components
- Sidebar built once, shared across all pages — parallel reuse
- No hydration, no React bundle in output
- Sitemap generated alongside HTML — single pass

**Result**: 200 page static site. Total build time: 12s. Each page loads in <200ms on first visit with zero JS execution on client.

### Example 2: Hybrid Page — Static Shell + Interactive Island

**Problem**: Marketing page needs fast first paint (static) but includes a live product demo that requires React interactivity.

**Solution**: Prerender static shell, dynamically import interactive island.

```typescript
// Page.tsx — used during prerender
import { lazy, Suspense } from 'react'

const ProductDemo = lazy(() => import('./ProductDemo'))

export function MarketingPage() {
  return (
    <div>
      <header>
        <h1>Our Product</h1>
        <p>Amazing features...</p>
      </header>

      <section className="content">
        <h2>How It Works</h2>
        <p>Step-by-step...</p>
      </section>

      <section className="demo-section">
        <Suspense fallback={<DemoSkeleton />}>
          <ProductDemo />  {/* interactive React component */}
        </Suspense>
      </section>

      <footer>
        <p>© 2024 Company</p>
      </footer>
    </div>
  )
}

// Build script
async function build() {
  // Static generation — ProductDemo Suspense boundary waits for
  // its module resolution. Since it's dynamically imported with
  // ssr: false equivalent, prerender sees the fallback.
  const { html } = await prerender(<MarketingPage />)

  // Write static HTML + load client bundle for ProductDemo separately
  await writeFile('./dist/index.html', html)
  // ProductDemo chunk loaded by browser after page mount
}
```

**Key decisions**:
- Static shell: zero JS, instant paint
- Interactive island: loaded lazily, hydrated independently
- Prerender outputs fallback HTML for the demo section (shown instantly)
- When browser loads the React chunk, the demo hydrates

**Result**: Lighthouse 100 on first paint. Interactive demo loads ~2s later without blocking anything.

### Example 3: Migration from renderToString to prerender

**Problem**: Existing blog uses `renderToString` for static pages. Build takes 45s, pages have loading spinners in HTML output due to data-fetching in components.

**Solution**: Replace `renderToString` with `prerender`, move data fetching to build time.

```typescript
// Before (React 18 style)
import { renderToString } from 'react-dom/server'
const html = renderToString(<BlogPage slug={slug} />)
// Problem: BlogPage has Suspense — renders fallback spinner
// HTML contains "<div class='spinner'>Loading...</div>" in final output

// After (React 19 style)
import { prerender } from 'react-dom/static'

// Move data fetch before render
const postData = await fetchPost(slug)
const relatedPosts = await fetchRelated(slug)

const { html } = await prerender(
  <BlogPage post={postData} related={relatedPosts} />
)
// Output: complete HTML with all content, no spinners
```

**Results**: Build time dropped from 45s to 8s (parallel + less output to buffer). HTML size reduced 12% (no React markers). Pages instantly loadable without JS. Spinner bug eliminated.

---

## Key Takeaways
- `prerender` is React 19's async static generation API — Suspense-aware, produces final HTML
- `renderToStaticMarkup` and `renderToString` are synchronous and do not support Suspense — they render fallbacks as actual content
- `renderToStaticNodeStream` streams clean HTML for memory-efficient bulk generation
- Static generation eliminates React runtime, hydration, and hydration mismatch bugs
- Decision tree: auth wall → CSR/SSR; pre-buildable → static; needs fresh data → SSR; per component, not per page
- Data architecture differs: static = fetch-then-render; SSR = render-while-fetch
- `prerender` enables custom SSG pipelines without framework dependency
- Interactive islands via dynamic import + `ssr: false` preserve static shell benefits
- Build time with `prerender` + concurrency can be 8x faster than serial `renderToString` for Suspense-heavy pages
- Hydration mismatch bugs are impossible on static-generated pages because there is no hydration

## Common Misconception

**"Static generation means the page cannot have any interactivity."**

Wrong. Static generation means the initial HTML is pre-built. Interactivity can be added via client-side JavaScript islands (dynamic imports, micro-frontends, web components). The static HTML loads instantly; interactive elements hydrate lazily. Next.js `next export` + `"use client"` components already prove this pattern. The shell is static; the interactive parts are client-loaded. This gives you the best of both: SEO-friendly, instant-loading HTML with rich interactivity where needed. The React runtime is loaded only for components that genuinely need it.

---

## Feynman Explain
(Explain `prerender` vs `renderToString` to a designer who understands HTML and CSS but has never touched server-side rendering. Use an analogy about cooking. Why would you pre-cook a meal vs cook on demand? What goes wrong if you pre-cook something that needs to be fresh? When is pre-cooking better?)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Judge: Is static generation over-engineered for most sites? When does the cost of a build step outweigh the benefit of zero-JS pages? Consider a simple landing page that you could serve as a static HTML file from a CDN with no build step at all. When does `prerender` add value vs just writing HTML by hand or using a simple template engine? Write your evaluation.)

---

## Drill
Take the quiz. MCQs test static API selection, prerender behavior with Suspense, and rendering strategy decisions.

Run: `learn.sh quiz advanced-react-19 10-static-apis`
