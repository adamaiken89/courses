# Module 9: Layout Components with Flexbox & Grid

Est. study time: 2h
Language: en

## Learning Objectives
- Build reusable React layout primitives (Stack, Flex, Grid)
- Decide when Flexbox vs CSS Grid per layout pattern
- Implement responsive layout props

---

## Core Content

### Layout Primitives vs Ad-Hoc Layout

Most apps repeat the same layout patterns: vertical stack, horizontal row, grid of items. Layout primitives encapsulate these:

```tsx
// Without primitive — repeated flex classes:
<section className="flex flex-col gap-4">
  <div className="flex items-center gap-2">
    <span>Label</span>
    <input />
  </div>
</section>

// With primitive — intent clear:
<Stack gap="md">
  <Flex gap="sm" align="center">
    <Label>Name</Label>
    <Input />
  </Flex>
</Stack>
```

> **Think**: What's the difference between `className="flex gap-4"` and `<Stack gap="md">`?
>
> *Answer: Same CSS output. The difference is API intent. `<Stack>` communicates "children arranged vertically." `flex gap-4` communicates implementation details. Primitives make layout choices visible in component name.*

### Stack Component

Vertical layout. The most common layout primitive.

```tsx
// Stack.tsx
type StackProps = {
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  as?: 'div' | 'section' | 'main' | 'form';
  children: React.ReactNode;
};

function Stack({ gap = 'md', align = 'stretch', as: Tag = 'div', children }: StackProps) {
  return (
    <Tag className={clsx('stack', `stack--gap-${gap}`, `stack--align-${align}`)}>
      {children}
    </Tag>
  );
}
```

```css
/* Stack.module.css */
.stack { display: flex; flex-direction: column; }
.stack--gap-xs { gap: var(--space-xs); }
.stack--gap-sm { gap: var(--space-sm); }
.stack--gap-md { gap: var(--space-md); }
.stack--gap-lg { gap: var(--space-lg); }
.stack--gap-xl { gap: var(--space-xl); }
.stack--align-start { align-items: flex-start; }
.stack--align-center { align-items: center; }
.stack--align-end { align-items: flex-end; }
.stack--align-stretch { align-items: stretch; }
```

### Flex Component (Horizontal Row)

```tsx
type FlexProps = {
  gap?: Spacing;
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  as?: ElementType;
  children: React.ReactNode;
};

function Flex({ gap = 'sm', align = 'center', justify = 'start', wrap, as: Tag = 'div', children }: FlexProps) {
  return (
    <Tag className={clsx(
      'flex',
      `flex--gap-${gap}`,
      `flex--align-${align}`,
      `flex--justify-${justify}`,
      wrap && 'flex--wrap'
    )}>
      {children}
    </Tag>
  );
}
```

```css
.flex { display: flex; }
.flex--wrap { flex-wrap: wrap; }
.flex--align-start { align-items: flex-start; }
.flex--align-center { align-items: center; }
.flex--justify-between { justify-content: space-between; }
```

> **Think**: Should Flex and Stack be separate components or one component with a `direction` prop?
>
> *Answer: Tradeoff. Separate components are more explicit (`direction` can't be wrong). One component is fewer imports. In practice, most uses are vertical (Stack) or horizontal (Flex) — separate reads clearer.*

### Grid Component

```tsx
type GridProps = {
  columns: number | { base?: number; sm?: number; md?: number; lg?: number };
  gap?: Spacing;
  children: React.ReactNode;
};

function Grid({ columns = 1, gap = 'md', children }: GridProps) {
  return (
    <div className={clsx(
      'grid',
      `grid--gap-${gap}`,
      typeof columns === 'number' && `grid--cols-${columns}`
    )}>
      {children}
    </div>
  );
}
```

```css
.grid { display: grid; }
.grid--cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid--cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid--cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid--cols-4 { grid-template-columns: repeat(4, 1fr); }
.grid--gap-sm { gap: var(--space-sm); }
.grid--gap-md { gap: var(--space-md); }
```

### When Flexbox vs Grid

| Pattern | Use | Example |
|---------|-----|---------|
| 1D row/column alignment | Flexbox | Nav bar, toolbar, form field + label |
| 2D grid of equal cells | Grid | Product grid, photo gallery, card layout |
| Content-first (size by content) | Flexbox | Button groups, badge clusters |
| Layout-first (fill available) | Grid | Page layout (sidebar + main), dashboard panels |
| Wrapping items | Flexbox (wrap) | Tag list, filter chips |
| Complex spanning | Grid | Magazine layout, heterogeneous cards |

**Rule of thumb**: If you need alignment in one direction, use Flexbox. If you need both rows and columns simultaneously, use Grid.

> **Think**: Dashboard layout with sidebar, header, main content, and footer — Flexbox or Grid?
>
> *Answer: Grid. Two-dimensional layout (sidebar spans full height, header spans full width, main fills remaining). Grid's template areas make this explicit. Flexbox would need nested containers.*

### Responsive Layout Props

Responsive layout = different column counts or gaps at breakpoints:

```tsx
type ResponsiveValue<T> = T | { base: T; sm?: T; md?: T; lg?: T };

function Grid({ columns, gap, children }: { columns: ResponsiveValue<number> }) {
  const breakpoints = ['sm', 'md', 'lg'] as const;
  return (
    <div className={clsx(
      'grid',
      typeof columns === 'number' && `grid--cols-${columns}`,
      typeof columns === 'object' && breakpoints.map(bp =>
        columns[bp] && `grid--${bp}--cols-${columns[bp]}`
      )
    )}>
      {children}
    </div>
  );
}
```

```css
/* Base */
.grid--cols-2 { grid-template-columns: repeat(2, 1fr); }
/* Responsive */
@media (min-width: 640px) { .grid--sm--cols-3 { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 768px) { .grid--md--cols-4 { grid-template-columns: repeat(4, 1fr); } }
```

Usage:

```tsx
<Grid columns={{ base: 1, sm: 2, md: 3, lg: 4 }}>
  {products.map(p => <ProductCard key={p.id} product={p} />)}
</Grid>
```

> **Think**: How does Tailwind handle this vs CSS Modules?
>
> *Answer: Tailwind: className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4". Same CSS, different DX. Tailwind puts breakpoint logic in className; CSS Modules put it in CSS file.*

---

### Why This Matters

Layout primitives eliminate repetitive flex/grid patterns and make layout intent explicit. A `<Stack gap="lg">` communicates vertical arrangement. `className="flex flex-col gap-4"` communicates implementation. In large codebases, primitives reduce layout bugs and make responsive changes centralized.

---

### Common Questions

**Q: Should I use a layout primitive library like Radix UI or build my own?**
A: Build if layout needs are simple (Stack, Flex, Grid). Use library if you need advanced features (auto-grid, aspect-ratio containers, masonry).

**Q: Do layout primitives cause performance issues?**
A: No. They render a single DOM element with classes. No state, no effects, no context.

---

## Examples

### Example: Dashboard Layout

```tsx
function Dashboard() {
  return (
    <Grid columns={{ base: 1, lg: 4 }} gap="lg" className="p-6">
      <Sidebar className="lg:col-span-1" /> {/* CSS: grid-column: span 1 on lg */}
      <Stack gap="md" className="lg:col-span-3">
        <Flex justify="between" align="center">
          <h1>Dashboard</h1>
          <Button>Export</Button>
        </Flex>
        <Grid columns={{ base: 1, sm: 2, md: 3 }} gap="md">
          {stats.map(s => <StatCard key={s.label} stat={s} />)}
        </Grid>
        <Chart />
      </Stack>
    </Grid>
  );
}
```

---

## Key Takeaways
- Layout primitives (Stack, Flex, Grid) encapsulate repeated flex/grid patterns
- Flexbox: 1D alignment. Grid: 2D layout. Choose accordingly
- Responsive props with breakpoint objects give explicit control
- Primitives reduce layout bugs and make intent clear

---

## Common Misconception

**"I don't need layout components — I just use flex/grid classes inline."**

Both work. Layout components add: named intent (Stack vs flex-col), prop validation (gap values restricted to tokens), and centralized responsive logic. Tradeoff is abstraction layer to learn.

---

## Feynman Explain
(Explain difference between Flexbox and Grid to a junior dev. When would you use each for a React app?)

---

## Drill
Take the quiz.
