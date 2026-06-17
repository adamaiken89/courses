# Module 8: Theming React Components with CSS

Est. study time: 3h
Language: en

## Learning Objectives
- Design CSS custom property architecture for multi-theme React apps
- Implement theme propagation via React Context + CSS custom properties
- Apply `@scope` for isolated component theming
- Build theme system without runtime CSS-in-JS

---

## Core Content

### CSS Custom Properties — The Runtime Theme Engine

CSS custom properties (`var(--name)`) are the foundation of runtime theming in React. Unlike Sass variables (compile-time), custom properties resolve in the browser:

```css
:root {
  --color-primary: #0366d6;
  --color-surface: #ffffff;
  --color-text: #24292f;
}

.button {
  background: var(--color-primary);
  color: white;
}
```

Change the property value at a higher DOM level → all descendants re-resolve instantly. No re-render, no JavaScript:

```css
.theme-dark {
  --color-primary: #58a6ff;
  --color-surface: #0d1117;
  --color-text: #c9d1d9;
}
```

```tsx
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <div className={theme === 'dark' ? 'theme-dark' : ''}>
      <Button /> {/* automatically re-themes */}
    </div>
  );
}
```

> **Think**: How does `var(--color-primary)` resolve when `.theme-dark` sets `--color-primary` to a different value?
>
> *Answer: CSS custom properties cascade like inherited properties. `.theme-dark` sets a new value on that element. All children see the new value because they inherit from the parent. No JavaScript mutation needed — pure CSS cascade.*

### Theme Architecture Layers

A scalable theme system has 4 layers:

**Layer 1: Base definitions** (CSS custom properties on `:root`)

```css
:root {
  --color-primary: #0366d6;
  --color-primary-hover: #0256b3;
  --color-surface: #ffffff;
  --color-surface-secondary: #f6f8fa;
  --color-text: #24292f;
  --color-text-secondary: #57606a;
  --color-border: #d0d7de;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;

  --font-body: 16px;
  --font-heading: 24px;
}
```

**Layer 2: Theme variants**

```css
.theme-dark {
  --color-primary: #58a6ff;
  --color-primary-hover: #79c0ff;
  --color-surface: #0d1117;
  --color-surface-secondary: #161b22;
  --color-text: #c9d1d9;
  --color-text-secondary: #8b949e;
  --color-border: #30363d;
}

.theme-high-contrast {
  --color-primary: #0044cc;
  --color-surface: #ffffff;
  --color-text: #000000;
  /* Increased contrast ratios */
}
```

**Layer 3: Component tokens** (optional — map semantic tokens to concrete values)

```css
:root {
  --button-bg: var(--color-primary);
  --button-text: white;
  --button-border-color: transparent;
  --card-bg: var(--color-surface);
  --card-border-color: var(--color-border);
}
```

**Layer 4: Component implementation**

```css
/* Button.module.css */
.button {
  background: var(--button-bg);
  color: var(--button-text);
  border: 1px solid var(--button-border-color, transparent);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
}
```

This architecture means you can re-theme an entire app by changing one CSS class — no component code changes.

### Theme Propagation via React Context

React Context + CSS custom properties = theming without runtime CSS-in-JS:

```tsx
// ThemeContext.tsx
type Theme = 'light' | 'dark' | 'high-contrast';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({
  theme: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<Theme>('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={`theme-${theme}`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

```tsx
// App.tsx
function App() {
  return (
    <ThemeProvider>
      <Header />
      <Dashboard />
    </ThemeProvider>
  );
}

// Header.tsx — toggle button
function Header() {
  const { theme, setTheme } = useTheme();
  return (
    <header>
      <span>App</span>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle theme
      </button>
    </header>
  );
}
```

**Contrast with styled-components ThemeProvider**: Same Context-based API, but without the runtime JS library. CSS custom properties handle the actual value resolution.

> **Think**: When React state changes theme, what actually re-renders vs re-styles?
>
> *Answer: Only the ThemeProvider's div className changes (re-render). Every component using var(--color-*) does NOT re-render — CSS custom properties cascade natively. This is the performance advantage over runtime CSS-in-JS theme injection.*

### `@scope` — Native CSS Scoping for Components

`@scope` (Chrome 118+, Safari 17.4+, Firefox 128+) limits CSS rules to a DOM subtree:

```css
@scope(.card) {
  :scope { border: 1px solid var(--color-border); padding: 16px; }
  .title { font-size: 18px; font-weight: 600; }
  .body { font-size: 14px; color: var(--color-text-secondary); }
}
```

Rules inside `@scope(.card)` only match elements inside `class="card"`. No BEM, no CSS Modules needed for basic scoping.

**In React**:

```tsx
function Card({ title, children }) {
  return (
    <div className="card">
      <h2 className="title">{title}</h2>
      <div className="body">{children}</div>
    </div>
  );
}
```

`.title` inside a `@scope(.card)` won't affect `<h2 class="title">` outside `.card`.

**Comparison**:

| Feature | CSS Modules | @scope |
|---------|-------------|--------|
| Browser support | All | Modern browsers only |
| Scoping mechanism | Build-time class rename | Runtime cascade boundary |
| Dynamic scoping | Not possible | `@scope(.card.highlighted)` |
| Tooling required | Build plugin | None |
| Conflicts with other libs | None | None |
| SSR | Yes | Yes |

`@scope` is not a CSS Modules replacement (different guarantee model — runtime vs build-time) but reduces the need for it in simple components.

### Theme Switching Without Re-Render

CSS custom properties cascade without triggering React re-renders. This is critical for performance:

```tsx
// BAD — causes re-render of entire tree:
function BadThemeToggle({ theme }) {
  return (
    <div style={{ backgroundColor: theme === 'dark' ? '#000' : '#fff' }}>
      {/* Every child re-renders when theme changes */}
      <ExpensiveComponent />
    </div>
  );
}

// GOOD — only className changes, CSS handles rest:
function GoodThemeToggle({ theme }) {
  return (
    <div className={`theme-${theme}`}>
      {/* No re-render cascade — CSS custom properties update natively */}
      <ExpensiveComponent />
    </div>
  );
}
```

With CSS custom properties, `ExpensiveComponent` doesn't re-render. The browser's style engine updates colors without JavaScript involvement.

### Multi-Theme Architecture for Component Libraries

Component libraries should provide theme variables, not enforce a theme engine:

```css
/* Library provides CSS custom properties with defaults */
:root {
  --lib-button-bg: #0366d6;
  --lib-button-text: white;
  --lib-button-radius: 6px;
}

.lib-button {
  background: var(--lib-button-bg);
  color: var(--lib-button-text);
  border-radius: var(--lib-button-radius);
}
```

Consumers customize by overriding at their root:

```css
/* Consumer app */
:root {
  --lib-button-bg: #7c3aed;
  --lib-button-radius: 9999px;
}
```

**No React Context, no ThemeProvider, no runtime library required.** Pure CSS contract.

> **Think**: How does this compare to styled-components ThemeProvider for a shared component library?
>
> *Answer: ThemeProvider requires all consumers to wrap their app in a Context provider from the library. CSS custom properties require nothing — just standard CSS. Zero dependency, zero runtime. This is why CSS variables are the standard for library theming in 2026.*

### Theme Breakpoints and Media Queries

```css
:root {
  --color-primary: #0366d6;
}

.theme-dark {
  --color-primary: #58a6ff;
}

/* OS preference as default (no JS) */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #58a6ff;
  }
}
```

Combine media queries with class-based themes:

```css
/* Respect OS preference unless user explicitly chose */
:root:not(.theme-light):not(.theme-dark) {
  --color-primary: #0366d6;
}

@media (prefers-color-scheme: dark) {
  :root:not(.theme-light):not(.theme-dark) {
    --color-primary: #58a6ff;
  }
}
```

---

### Why This Matters

Theming is where most React CSS approaches fail. Runtime CSS-in-JS couples theme to a JS library. Plain CSS has no scoping. CSS Modules can't switch variables at runtime. Combining CSS custom properties (for runtime values) with CSS Modules/`@scope` (for scoping) gives the best of all approaches: zero-runtime, natively themed, scoped styles.

---

### Common Questions

**Q: Can I animate theme transitions with CSS custom properties?**
A: Yes. `transition: background-color 0.3s, color 0.3s;` on components will animate between theme values since the browser sees actual color changes.

**Q: How many CSS custom properties is too many?**
A: Design token scale. 50-100 tokens for colors, spacing, typography is normal. 500+ suggests over-engineering. Each token should map to a design decision element.

**Q: Can CSS custom properties do dynamic calculations?**
A: Yes, with `calc()`: `padding: calc(var(--space-md) * 1.5);`. Complex logic (if/else) is not possible — use JavaScript for that.

---

## Examples

### Example 1: Complete Theme System

```css
/* tokens.css */
:root {
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-surface: #ffffff;
  --color-surface-hover: #f8fafc;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-danger: #ef4444;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px rgb(0 0 0 / 0.1);
}

.theme-dark {
  --color-primary: #818cf8;
  --color-primary-hover: #6366f1;
  --color-surface: #0f172a;
  --color-surface-hover: #1e293b;
  --color-text: #f1f5f9;
  --color-text-muted: #94a3b8;
  --color-border: #334155;
  --color-danger: #f87171;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px rgb(0 0 0 / 0.4);
}
```

```tsx
// ThemeToggle.tsx
function ThemeToggle() {
  const [dark, setDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.className = dark ? 'theme-dark' : '';
  }, [dark]);

  return (
    <button onClick={() => setDark(d => !d)}>
      {dark ? 'Light' : 'Dark'} mode
    </button>
  );
}
```

### Example 2: Component with Theme-Breakpoint Awareness

```css
/* ProductCard.module.css */
.card {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  transition: background 0.2s, box-shadow 0.2s;
}
.card:hover {
  background: var(--color-surface-hover);
  box-shadow: var(--shadow-md);
}
.title {
  font-size: var(--font-heading);
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}
.price {
  color: var(--color-primary);
  font-weight: 600;
}
```

```tsx
function ProductCard({ product }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{product.name}</h3>
      <p className={styles.price}>${product.price}</p>
    </div>
  );
}
```

Themes work automatically — no prop drilling, no Context reading in ProductCard.

---

## Key Takeaways
- CSS custom properties (`var(--name)`) enable runtime theming without JS libraries
- Theme architecture: base values → theme variants → component tokens → components
- React Context manages theme state; CSS custom properties handle style propagation
- `@scope` provides native CSS scoping — no tooling needed (modern browsers)
- Theme switching via CSS class change does NOT re-render child components
- Component libraries should expose CSS custom properties, not React Context
- Combine: CSS custom properties (runtime values) + CSS Modules/`@scope` (scoping)

---

## Common Misconception

**"CSS custom properties are slow compared to hardcoded values."**

Negligible difference. CSS custom properties are resolved during the browser's style calculation phase. The performance cost is a single property lookup per `var()` — microseconds. Hardware-accelerated compositing (transforms, opacity) is unaffected. The real performance cost comes from unnecessary React re-renders (avoided by CSS custom properties).

---

## Feynman Explain
(Explain CSS custom properties as "theme variables that the browser understands." Why they cascade like font-size. Why changing one variable re-colors hundreds of components without JavaScript.)

---

## Reframe
(Pause. Judge: Is the CSS custom property + Context pattern better than styled-components ThemeProvider? For which apps would the difference matter?)

---

## Drill
Take the quiz. Questions test theme architecture, custom property cascade, and implementation.
