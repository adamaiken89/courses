# Module 11: Animations in React with CSS

Est. study time: 2h
Language: en

## Learning Objectives
- Coordinate CSS animations with React lifecycle
- Use CSS transitions for state-driven UI motion
- Apply View Transitions API in React

---

## Core Content

### CSS Transitions in React

CSS transitions animate between property states. In React, state changes toggle class names → transitions fire:

```css
/* Button.module.css */
.button {
  background: var(--color-primary);
  transition: background 0.2s ease;
}
.button:hover {
  background: var(--color-primary-hover);
}
```

```tsx
// Transition triggered by CSS pseudo-class (hover) — no React state needed
function Button() {
  return <button className={styles.button}>Click</button>;
}
```

**State-driven transitions** toggle via className:

```css
.panel {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.2s ease;
}
.panel.open {
  max-height: 500px;  /* Must be known or use auto — see note */
  opacity: 1;
}
```

```tsx
function Accordion() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}>Toggle</button>
      <div className={clsx(styles.panel, open && styles.open)}>
        Content
      </div>
    </div>
  );
}
```

> **Think**: What's the problem with transitioning max-height from 0 to auto?
>
> *Answer: CSS can't transition to auto. You must use a specific max-height value (larger than actual content). Alternative: use grid-template-rows transition (row 0 → 1fr) which works in modern browsers.*

### Keyframe Animations

For multi-step or repeating animations, use `@keyframes`:

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.enter { animation: fadeIn 0.3s ease-out; }
.spinner { animation: spin 1s linear infinite; }
```

```tsx
function Toast({ message, onClose }) {
  return (
    <div className={styles.enter}>
      {message}
      <button onClick={onClose}>×</button>
    </div>
  );
}
```

### React Lifecycle + Animation

Mount → enter animation. Unmount → exit animation (needs coordination).

**Problem**: React removes elements immediately. CSS animation on unmount never plays.

**Solution**: Track "closing" state, delay removal:

```tsx
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (exiting) {
      const timer = setTimeout(() => onRemove(toast.id), 300); // match CSS animation duration
      return () => clearTimeout(timer);
    }
  }, [exiting]);

  return (
    <div className={clsx(styles.toast, exiting && styles.exit)}>
      <span>{toast.message}</span>
      <button onClick={() => setExiting(true)}>×</button>
    </div>
  );
}
```

```css
.toast {
  animation: slideIn 0.3s ease-out;
}
.exit {
  animation: slideOut 0.3s ease-in forwards;
}
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}
```

**Pattern**: `exiting` state → apply exit animation class → after animation duration, actually remove.

> **Think**: What happens if the animation duration is 500ms but setTimeout uses 300ms?
>
> *Answer: Component unmounts before animation finishes — visible cut. Always match setTimeout to the CSS animation duration. Better: use onAnimationEnd event.*

### onAnimationEnd Event

```tsx
function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);

  return (
    <div
      className={clsx(styles.toast, exiting && styles.exit)}
      onAnimationEnd={() => exiting && onRemove(toast.id)}
    >
      ...
    </div>
  );
}
```

No timer needed. Browser fires `onAnimationEnd` when CSS animation completes.

### View Transitions API

View Transitions API (2024+) provides smooth transitions between page/document states:

```tsx
function TabView() {
  const [tab, setTab] = useState('list');

  const switchTab = (newTab: string) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => setTab(newTab));
    } else {
      setTab(newTab); // fallback
    }
  };

  return (
    <div>
      <button onClick={() => switchTab('list')}>List</button>
      <button onClick={() => switchTab('grid')}>Grid</button>
      <div className="view-transition-main">
        {tab === 'list' ? <ListView /> : <GridView />}
      </div>
    </div>
  );
}
```

```css
::view-transition-old(view-transition-main) {
  animation: fadeOut 0.2s ease;
}
::view-transition-new(view-transition-main) {
  animation: fadeIn 0.2s ease;
}
```

React 19+ has built-in support via `<ViewTransition>` component (experimental).

### Performance Considerations

- **`transform` and `opacity` only**: These are composited on GPU. Animating `width`, `height`, `top`, `left` triggers layout reflow.
- **`will-change`**: Hint browser about animating properties. Use sparingly — overuse consumes GPU memory.

```css
.animated-element {
  will-change: transform, opacity;
}
```

- **`content-visibility: auto`**: Skip rendering for off-screen elements. Improves initial render performance.

---

### Why This Matters

CSS animations in React require coordinating two systems: React's component lifecycle and CSS's animation lifecycle. Mount = easy (class applies on render). Unmount = requires exiting state + delayed removal. View Transitions API is the future of page transition in React.

---

### Common Questions

**Q: Should I use Framer Motion instead of CSS animations?**
A: CSS for simple transitions/keyframes. Framer Motion for complex gesture-driven animations (drag, spring physics, layout animations). CSS is zero-dependency, Framer Motion is ~30 kB.

**Q: Can I animate CSS custom properties?**
A: Yes, with `@property` for registered custom properties (tells browser how to interpolate). Otherwise, animate a wrapper property (e.g., opacity), not the variable itself.

---

## Key Takeaways
- CSS transitions for state-driven (class toggle). Keyframes for multi-step/repeating.
- Unmount animations need exiting state + timer or onAnimationEnd
- Transition only `transform` and `opacity` for GPU-composited performance
- View Transitions API for page-level transitions (newer, React 19+)
- CSS animations are zero-dependency, Framer Motion for complex motion

---

## Common Misconception

**"CSS animations are always better than JS animations."**

Not true. CSS animations are better for simple declarative motion. JS animation libraries (Framer Motion, GSAP) handle: spring physics, gesture-driven drag, sequencing, shared layout animations, SVG morphing. Choose by complexity.

---

## Feynman Explain
(Explain: why does a toast need "exiting" state? Why doesn't React handle unmount animations automatically?)

---

## Drill
Take the quiz.
