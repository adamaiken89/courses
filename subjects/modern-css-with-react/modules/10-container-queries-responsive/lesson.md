# Module 10: Container Queries & Responsive React Components

Est. study time: 2h
Language: en

## Learning Objectives
- Apply container queries for component-level responsiveness
- Distinguish container queries from viewport media queries
- Build responsive React components independent of page layout

---

## Core Content

### Viewport vs Container Queries

Media queries respond to viewport size. Container queries respond to parent element size.

```css
/* Media query — responds to viewport */
@media (max-width: 768px) {
  .card { flex-direction: column; }
}

/* Container query — responds to parent container */
@container (max-width: 400px) {
  .card { flex-direction: column; }
}
```

**Why container queries matter in React**: A `<ProductCard>` might render in a 4-column grid (wide) or a sidebar (narrow). Media queries can't distinguish these contexts — they only know viewport width. Container queries let the component adapt to its actual available space.

> **Think**: A ProductCard appears in a 4-column grid on desktop AND in a slide-out panel. With media queries, how do you style both contexts?
>
> *Answer: You can't with viewport alone. You'd add a modifier class or prop— `<ProductCard variant="compact" />`. Container queries eliminate the prop: the card detects its own container width.*

### Setting Up Containers

```css
/* Parent establishes a containment context */
.card-grid {
  container-type: inline-size;
  container-name: card-container;
}

.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}
```

`container-type: inline-size` creates a containment context based on inline (width) size. `container-name` optional — names the context for `@container` references.

**In React**:

```tsx
function ProductGrid({ products }) {
  return (
    <div className="card-grid"> {/* container established here */}
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar"> {/* different container context */}
      <ProductCard product={featured} />
    </aside>
  );
}
```

### Component Responds to Its Container

```css
/* ProductCard.module.css */
.card {
  container-type: inline-size;
  display: flex;
  flex-direction: row;
  gap: 16px;
}

@container (max-width: 300px) {
  .card { flex-direction: column; }
  .image { width: 100%; }
}

@container (min-width: 301px) and (max-width: 500px) {
  .card { flex-direction: row; gap: 12px; }
  .image { width: 120px; }
}

@container (min-width: 501px) {
  .card { flex-direction: row; gap: 24px; }
  .image { width: 200px; }
}
```

**Key**: Container queries use the container's width, not viewport. Same component renders differently in ProductGrid (wide) vs Sidebar (narrow) without props.

### Container Query Units

Container queries also provide units relative to container size:

- `cqw` — 1% of container width
- `cqh` — 1% of container height
- `cqi` — 1% of container inline size
- `cqb` — 1% of container block size
- `cqmin` — smaller of cqi/cqb
- `cqmax` — larger of cqi/cqb

```css
.card {
  container-type: inline-size;
}
.title {
  font-size: clamp(1rem, 5cqi, 2rem);
}
/* Title scales from 1rem to 2rem based on container width */
```

### Container Queries + Media Queries Combined

```css
/* Outer layout responds to viewport */
@media (max-width: 768px) {
  .grid { grid-template-columns: 1fr; }
}

/* Inner component responds to its container */
.product-card { container-type: inline-size; }

@container (max-width: 350px) {
  .product-card { flex-direction: column; }
}
```

Layers: media queries → page layout. Container queries → component adaptation.

### When Not to Use Container Queries

- Simple responsive: media queries suffice
- Container query performance: containment affects layout — not all elements need it
- If component always renders in one context (e.g., main content only) — media query is simpler

> **Think**: You have a Card component always rendered in a grid that is always 3 columns. Does this need container queries?
>
> *Answer: No. Card always has the same available width. Container query adds complexity without benefit. Use media query to switch grid columns, regular CSS for Card.*

### Browser Support (2026)

Container queries supported in all modern browsers: Chrome 105+, Safari 16+, Firefox 110+. No polyfill needed. Safe for production.

---

### Why This Matters

Container queries are the biggest CSS advancement for component-based architectures since flexbox. They make components truly self-responsive — a `<ProfileCard>` knows how to render based on its actual space, not page context. This eliminates a whole category of "responsive variant" props.

---

### Common Questions

**Q: Can I nest container queries?**
A: Yes. A container inside a container. Each `@container` query responds to its nearest named or anonymous container ancestor.

**Q: Do container queries affect performance?**
A: Minimal. Containment creates a layout boundary — browser recalculates only the container's subtree when its size changes. Performance improvement for large pages.

---

## Examples

### Example: Responsive Dashboard Widget

```tsx
// Widget — adapts to its grid cell size automatically
function Widget({ title, children }) {
  return (
    <div className={styles.widget}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
```

```css
.widget { container-type: inline-size; }
.title { font-size: clamp(14px, 4cqi, 24px); }
.content { 
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@container (max-width: 300px) {
  .content { flex-direction: column; }
}
```

---

## Key Takeaways
- Container queries respond to parent element size, not viewport
- `container-type: inline-size` creates containment context
- Container query units (cqw, cqi, cqmin) size elements to container
- Combine: media queries for page layout, container queries for components
- Eliminates responsive variant props — components adapt automatically

---

## Common Misconception

**"Container queries replace media queries."**

Not replace — complement. Media queries handle page-level layout (grid columns, sidebar visibility). Container queries handle component-level adaptation (card layout, font size). Both needed.

---

## Feynman Explain
(Explain: "A card should look different in a 4-column grid vs a sidebar." Why can't media queries handle this? How do container queries fix it?)

---

## Drill
Take the quiz.
