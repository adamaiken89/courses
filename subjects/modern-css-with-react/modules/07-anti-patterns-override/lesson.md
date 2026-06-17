# Module 7: Anti-Patterns — Override in React Component Model

Est. study time: 2.5h
Language: en

## Learning Objectives
- Identify specificity wars and cascade anti-patterns in React
- Replace override-driven styling with composition patterns
- Use prop-based styling and `styled(Component)` correctly

---

## Core Content

### The Override Problem

React component model is composable — components wrap other components, props pass down, styles cascade.

CSS cascade + React composition = conflict.

```tsx
// Parent tries to customize child:
function Page() {
  return (
    <div className="page">
      <Button className="page__submit" />  {/* Intent: override Button styles */}
    </div>
  );
}
```

**Problem**: How does `page__submit` override Button's internal styles?

**Three approaches, all problematic:**
1. **High-specificity selector** (`.page .page__submit`) — specificity arms race
2. **`!important`** — breaks all cascade rules, impossible to override further
3. **Deep nesting / `:where()` hacks** — fragile, tooling-dependent

> **Think**: Why does "override the button's padding" seem simple but cascade into problems?
>
> *Answer: Because each override adds specificity or !important. Next dev needs to override your override. Three components deep, you have .parent .child .grandchild .button.submit.with-special-margin. One CSS change cascades through 10+ files.*

### Specificity Wars

CSS specificity determines which rule wins when multiple target the same element.

```css
/* Specificity: 0,1,0,0 (one class) */
.button { padding: 8px; }

/* Specificity: 0,2,0,0 (two classes) */
.parent .button { padding: 12px; }

/* Specificity: 0,3,0,0 */
.grandparent .parent .button { padding: 16px; }

/* Eventually: !important */
.button { padding: 8px !important; }

/* Counter-!important... */
.parent .button { padding: 12px !important; }
```

With CSS Modules or Tailwind, specificity is always equal (one class per rule). With plain CSS/Sass, specificity stacking is inevitable.

**When specificity wars happen in React:**
1. Parent imports a component's CSS module and tries `:global(.button)`
2. Sass nesting creates `.card .header .title` — override needs `.something .card .header .title`
3. Multiple theme layers (base → app → feature → component) each add specificity

> **Think**: A developer adds .page .button to override Button padding. Later, another dev can't override it. Who's at fault?
>
> *Answer: The first dev. Override via specificity is borrowing from the cascade — it doesn't compose. The component should expose a `size` prop or accept `className` that merges correctly.*

### `!important` — Last Resort That Becomes First Resort

`!important` should be extremely rare in component CSS. When it appears:
- It overrides specificity by fiat
- It cannot be overridden except by another `!important` with same/higher specificity
- It breaks the cascade contract

```css
/* Somewhere in component library: */
.button { padding: 8px !important; }

/* Consumer: */
// Can't override — className="p-4" has no effect
// Need: !important in consumer too, or style prop
```

**The only valid uses of `!important`:**
- Utility classes that MUST win (Tailwind's `!` prefix)
- User preference overrides (accessibility: forced colors)
- Third-party widget styles where you lack control

In component CSS: never. Use props or composition.

### Composition Over Inheritance

React's component model already has the right pattern: **props over override**.

**Bad** — override by targeting internal elements:
```tsx
// Button.tsx
function Button({ className }) {
  return <button className={`btn ${className}`}>Click</button>;
}

// Page.tsx — overrides via specificity
<Button className="page-submit" />
/* CSS: .page-submit { padding: 20px !important; } */
```

**Good** — explicit prop API:
```tsx
// Button.tsx
function Button({ size = 'md', className }) {
  return <button className={twMerge(btn({ size }), className)}>Click</button>;
}

// Page.tsx — uses prop, not CSS override
<Button size="lg" />
```

**Best** — compound components:
```tsx
// Button exposes styled sub-components
const Button = { Root, Icon, Label };

function Page() {
  return (
    <Button.Root size="lg">
      <Button.Icon name="check" />
      <Button.Label>Submit</Button.Label>
    </Button.Root>
  );
}
```

> **Think**: What's the difference between "override via CSS" and "override via prop" in terms of maintenance?
>
> *Answer: CSS override is invisible in the component API — it lives in a stylesheet file, not in the component signature. Prop override is explicit — the component declares "I accept a size prop" and TypeScript validates it.*

### styled(Component) — The Right Way to Extend

styled-components and Emotion have `styled(ExistingComponent)` which generates a new component with merged styles:

```tsx
const BaseButton = styled.button`
  padding: 8px 16px;
  background: blue;
  color: white;
`;

const LargeButton = styled(BaseButton)`
  padding: 16px 32px;
  font-size: 18px;
`;
```

**How this works**: `styled(BaseButton)` creates a new component that renders `BaseButton` and passes a generated class name to it. `BaseButton` must pass `className` to its DOM element.

```tsx
// BaseButton must forward className:
function BaseButton({ className, children }) {
  return <button className={className}>{children}</button>;
}

const LargeButton = styled(BaseButton)`
  padding: 16px;
`;
```

**This pattern is composition, not override.** The new component doesn't fight specificity — it adds its own class, and the CSS cascade within generated classes is controlled by build tools, not by selector specificity.

### Override Patterns by CSS Approach

| Approach | Override mechanism | Correct pattern |
|----------|-------------------|-----------------|
| Plain CSS | Specificity, `!important` | Avoid. Use composition or BEM modifier |
| CSS Modules | `:global` or `composes` | Avoid. Accept `className` prop, merge with clsx |
| Tailwind | `className` prop with twMerge | Accept className, twMerge with defaults |
| styled-components | `styled(Component)` | Use styled composition or variant props |
| Vanilla Extract | Recipe variant override | Props that select recipe variants |
| Inline styles | Direct assignment | `style` prop merge |

**Universal rule**: A component should never require CSS knowledge to customize. Every visual dimension the consumer might change should be a prop.

### CSS Override vs Prop-Based Design

| Aspect | CSS Override | Prop-based |
|--------|-------------|------------|
| API surface | Implicit (class names) | Explicit (prop types) |
| TypeScript validation | None | Full |
| Discoverability | Check CSS file | Autocomplete on component |
| Specificity | Accumulates | None (prop = value) |
| Testability | Visual regression only | Unit test prop values |
| Maintenance | "Where does this style come from?" | "Change the prop" |

---

### Why This Matters

CSS override in React is the #1 source of style bugs in component systems. It creates invisible coupling between components, accumulates specificity that makes later changes expensive, and produces "where is this style coming from?" debugging sessions. Understanding prop-based composition over CSS override is the difference between a maintainable design system and a css-specificity nightmare.

---

### Common Questions

**Q: How do I change a child component's color from parent without override?**
A: Add a `color` prop to the child. `Button color="danger"` — not `.parent .button { color: red; }`.

**Q: What if I need to override a third-party component that doesn't accept props?**
A: Wrap it. Your wrapper adds the missing prop API:

```tsx
function ThemedDatePicker(props) {
  return (
    <ThirdPartyDatePicker
      className="themed-datepicker"
      {...props}
    />
  );
}
// CSS: .themed-datepicker { ... } — one override, centrally managed
```

**Q: Is it OK to use className prop for occasional overrides?**
A: Yes, with twMerge. The component controls defaults; className provides escape hatch. It's when className becomes the primary customization mechanism that problems arise.

---

## Examples

### Example 1: Refactoring Override to Props

**Before** — parent overrides child via CSS:
```tsx
// Card.tsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}

// Page.tsx
<Card>
  <p className="card-text">...</p>  {/* CSS: .card-text overrides card's p styles */}
</Card>
```

**After** — Card accepts props for visual variants:
```tsx
function Card({ variant = 'default', padding = 'md', children }) {
  return (
    <div className={clsx(
      'card',
      `card--${variant}`,
      `card--pad-${padding}`
    )}>
      {children}
    </div>
  );
}

// Page.tsx
<Card variant="elevated" padding="lg">...</Card>
```

### Example 2: Specificity Meltdown

```scss
// Base component
.button { padding: 8px; }

// Feature override
.feature-page .button { padding: 12px; }

// Dashboard override within feature
.feature-page .dashboard-panel .button { padding: 16px; }

// Now a new section needs its own padding:
.admin-section .feature-page .dashboard-panel .button {
  padding: 20px !important;  // Breaking point reached
}
```

Each override adds specificity. At 4+ levels, the cascade is unmanageable.

**Fix**: Prop-based. Each context passes `size` prop to Button.

---

## Key Takeaways
- CSS override in React creates specificity wars and invisible coupling
- `!important` breaks cascade — never use in component CSS
- Props over CSS overrides — every visual dimension should be a prop
- `styled(Component)` is composition, not override — works correctly
- `twMerge` resolves conflicting utility classes predictably
- Universal rule: consumer should not need CSS to customize a component

---

## Common Misconception

**"I need to override component styles because the component doesn't support my use case."**

Correct response: extend the component's prop API or create a variant. If the component is third-party, wrap it. Override via CSS means the component's styling contract is broken — fix the contract, not the CSS.

---

## Feynman Explain
(Explain to a junior: "Why is overriding CSS in a component library bad? I just want to change the padding.")

---

## Reframe
(Pause. Judge: Are there cases where CSS override is acceptable? Utility-first CSS (Tailwind) is all about composing classes in className — is that "override" too?)

---

## Drill
Take the quiz. Questions identify override anti-patterns and propose prop-based alternatives.
