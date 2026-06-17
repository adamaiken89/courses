# Module 14: Performance & CSS Bundle in React

Est. study time: 2h
Language: en

## Learning Objectives
- Implement critical CSS extraction in SSR
- Code-split CSS per lazy-loaded route
- Eliminate unused CSS with tools
- Apply CSS containment for rendering performance

---

## Core Content

### Critical CSS

CSS blocks rendering. Browser must download and parse CSS before painting. For large apps, this delays first paint.

**Critical CSS**: Inline styles needed for above-the-fold content in `<head>`. Defer the rest.

```html
<!-- Inlined critical CSS (first paint) -->
<style>
  header { display: flex; ... }
  .hero { font-size: 2rem; ... }
</style>
<!-- Deferred non-critical CSS -->
<link rel="preload" href="/styles.css" as="style" onload="this.rel='stylesheet'">
```

**In Next.js**: Built-in. Automatic critical CSS extraction. No manual setup.

**In Vite**: Use `vite-plugin-critical` or manual extraction.

**Manual extraction**: Tools like `critical` (Node.js) analyze a page at a viewport, extract used styles, inline them.

> **Think**: A 200 kB CSS file blocks rendering. Critical CSS inlines 15 kB for first viewport. What's the improvement?
>
> *Answer: First paint happens after 15 kB instead of 200 kB. On 3G (2 Mbps), that's ~60ms vs ~800ms. Remaining CSS loads non-blocking (preload → switch).*

### CSS Code Splitting

Route-based CSS splitting: each lazy-loaded page/component loads its CSS only when needed.

**CSS Modules naturally code-split** — each component's CSS is a separate file. Bundlers (Next.js, Vite) extract component CSS into per-chunk files.

```tsx
// Lazy component — its .module.css loads only when this chunk loads
const Dashboard = lazy(() => import('./Dashboard'));
```

**With Tailwind**: JIT generates one CSS file containing all used utilities. No per-component splitting. Solution: split into separate entry points or use multiple CSS files per route.

**With styled-components**: All styles merge into one `<style>` tag. No code-splitting — all styles load with first JS bundle.

### Unused CSS Elimination

- **Tailwind JIT**: Only generates used classes — effectively zero unused CSS
- **PurgeCSS**: For hand-written CSS, scans files and removes unused selectors

```js
// postcss.config.js — manual PurgeCSS
module.exports = {
  plugins: [
    require('@fullhuman/postcss-purgecss')({
      content: ['./src/**/*.{tsx,ts}'],
      defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
    }),
  ],
};
```

**Gains**: Hand-written CSS can be 50-80% unused. PurgeCSS drops unused selectors — typically reduces 100 kB → 20 kB.

### CSS Containment

`content-visibility: auto` skips rendering of off-screen elements:

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 200px; /* placeholder size before rendering */
}
```

Browser renders only visible cards + a few off-screen. Scrolling triggers progressive rendering.

**In React list**:

```tsx
function ProductList({ products }) {
  return (
    <div className="product-grid">
      {products.map(p => (
        <div key={p.id} className="product-card">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
```

For 500 products, content-visibility reduces initial render cost from 500 cards to ~20 (viewport + buffer).

### Bundle Impact by CSS Approach

| Approach | CSS in JS bundle | CSS file size | Code-split |
|----------|-----------------|---------------|------------|
| Plain CSS | 0 kB | Full authored | Manual |
| CSS Modules | 0 kB | Per component | Automatic |
| Tailwind | 0 kB | 5-15 kB total | Manual per page |
| Runtime CSS-in-JS | Library + CSS strings | N/A | No (global style tag) |
| Vanilla Extract | 0 kB | Per component | Automatic |

> **Think**: An app loads 10 screens. Total authored CSS: 200 kB. With CSS Modules/Vite, what loads on first page?
>
> *Answer: Only the CSS for components rendered on the first page (~20-30 kB). Other screens' CSS loads with their JS chunks. Tailwind would load all 10 pages' utilities (~10-15 kB because purged). Runtime CSS-in-JS loads all CSS strings with the initial JS bundle.*

### Avoiding Layout Shifts (CLS)

- Set explicit dimensions on images: `<img width="400" height="300" />`
- Use `aspect-ratio` CSS property for dynamic content
- Avoid injecting dynamic content above static content without placeholder dimensions

### Animation Performance

- **`transform` and `opacity` only**: GPU composited, no layout/reflow
- **Avoid animating**: `width`, `height`, `top`, `left`, `margin`, `padding`
- **`will-change`**: Use sparingly — only for elements that DO animate

```css
.toast {
  transform: translateX(100%);
  transition: transform 0.3s ease; /* GPU composited */
}
```

---

### Why This Matters

CSS performance is often the last optimization. But CSS is a render-blocking resource — a slow CSS load directly delays every user interaction. In React, CSS bundle strategy is determined by your styling approach choice (Module 1). You can't optimize CSS in isolation from architecture.

---

### Key Takeaways
- Critical CSS inlines first-viewport styles — built into Next.js, manual in Vite
- CSS Modules/Vanilla Extract code-split automatically per component/route
- Tailwind JIT eliminates unused CSS by construction
- content-visibility: auto skips off-screen rendering (big gains for long lists)
- Avoid animating layout-triggering properties — use transform/opacity

---

## Common Misconception

**"CSS performance doesn't matter because CSS is small."**

CSS file size is only part. CSS is render-blocking — every kB delays first paint. On slow networks, large CSS files directly increase Time to First Contentful Paint (FCP). An app with 200 kB CSS loads text in ~800ms on 3G vs ~150ms for a critical-CSS-optimized app.

---

## Drill
Take the quiz.
