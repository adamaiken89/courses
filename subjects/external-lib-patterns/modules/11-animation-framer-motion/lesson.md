# Module 11: Animation — Framer Motion

Est. study time: 2h
Language: en

## Learning Objectives
- Build reusable motion wrappers around third-party and DOM components
- Implement layout animations with layoutId shared layout orchestration
- Manage mount/unmount animations with AnimatePresence
- Configure variants for declarative staggered child animations
- Handle reduced-motion preferences and performance optimization

---

## Core Content

### Framer Motion Architecture

Framer Motion is React's dominant animation library. Two renderers:
- `motion.div`, `motion.svg`, etc — built-in motion components replacing HTML/SVG elements
- `motion(Component)` — wraps any third-party component as motion component

```typescript
import { motion } from 'framer-motion'

// Built-in motion component
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
  Hello
</motion.div>

// Wrapping third-party component
const MotionCard = motion(Card)

function AnimatedCard() {
  return (
    <MotionCard
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    />
  )
}
```

### Motion Component Wrapper Pattern

Wrapping third-party components requires forwarding `ref` and inheriting `MotionProps`:

```typescript
import { motion, type MotionProps } from 'framer-motion'

type Props = MotionProps & React.ComponentProps<typeof DataGrid>

const MotionDataGrid = motion(
  React.forwardRef<HTMLDivElement, React.ComponentProps<typeof DataGrid>>(
    (props, ref) => (
      <div ref={ref}>
        <DataGrid {...props} />
      </div>
    )
  )
)
```

App-level wrapper with opinionated defaults:

```typescript
interface AnimatedPanelProps {
  children: React.ReactNode
  delay?: number
  from?: 'left' | 'right' | 'top' | 'bottom'
}

const dirMap = { left: { x: -20 }, right: { x: 20 }, top: { y: -20 }, bottom: { y: 20 } }

function AnimatedPanel({ children, delay = 0, from = 'bottom' }: AnimatedPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, ...dirMap[from] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay }}
    >
      {children}
    </motion.div>
  )
}
```

> **Think**: Wrapping third-party components with `motion()` means animation props become part of component's public API. When does this coupling outweigh convenience?
>
> *Answer: When library migration risk is high (date picker had 3 major API changes in 2 years), prefer internal wrapper that normalizes animation config. When component is stable (Button, Card), direct `motion(Component)` is fine.*

### Variants and Stagger Children

Variants define named animation states. Reusable across multiple components:

```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 20 }
  }
}

function StaggeredList({ items }: { items: Item[] }) {
  return (
    <motion.ul variants={containerVariants} initial="hidden" animate="visible">
      {items.map(item => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.name}
        </motion.li>
      ))}
    </motion.ul>
  )
}
```

Type-safe variants with generics:

```typescript
type VariantState = 'hidden' | 'visible' | 'exiting'

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
  exiting: { opacity: 0, scale: 0.9 }
}
```

### AnimatePresence — Mount/Unmount Animations

`AnimatePresence` detects when children are removed and plays exit animation before unmounting:

```typescript
import { AnimatePresence } from 'framer-motion'

function NotificationStack({ notifications }: { notifications: Notification[] }) {
  return (
    <div>
      <AnimatePresence mode="popLayout">
        {notifications.map(n => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: 100, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 100, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {n.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

`mode` options:
- `sync` — exit and enter simultaneously (default)
- `wait` — wait for exit to finish before entering
- `popLayout` — exit removes its layout space immediately, rest animate to fill gap

> **Think**: `AnimatePresence` requires `key` prop on children. What happens if two children have same key and you swap them?
>
> *Answer: Framer Motion treats same key as same element. It uses `layout` animation to animate position change instead of mount/unmount. For list reorder, use `layout` prop without AnimatePresence for position transitions.*

### layout and layoutId — Shared Layout Animations

`layout` prop animates changes to size/position:

```typescript
<motion.div layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
  {expanded ? <ExpandedContent /> : <CollapsedContent />}
</motion.div>
```

`layoutId` shares identity across components for seamless transitions:

```typescript
function ImageGrid({ images, selectedId }: { images: Image[]; selectedId: string | null }) {
  return (
    <div>
      <div>{images.map(img => (
        <motion.img key={img.id} layoutId={`image-${img.id}`} src={img.thumb} />
      ))}</div>
      <AnimatePresence>
        {selectedId && (
          <motion.div
            key={selectedId}
            layoutId={`image-${selectedId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <img src={images.find(i => i.id === selectedId)!.full} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

### Gesture Handlers

Declarative gesture props: `whileHover`, `whileTap`, `whileDrag`, `whileFocus`, `whileInView`:

```typescript
<motion.button
  whileHover={{ scale: 1.05, backgroundColor: '#3b82f6' }}
  whileTap={{ scale: 0.95 }}
  whileFocus={{ outline: '2px solid #60a5fa' }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-50px' }}
>
  Animated Button
</motion.button>
```

`useAnimate` hook for imperative animation orchestration:

```typescript
function DragHandle() {
  const [scope, animate] = useAnimate()

  async function handleDragEnd() {
    await animate(scope.current, { scale: 1.2 }, { type: 'spring' })
    await animate(scope.current, { scale: 1 }, { type: 'spring' })
  }

  return <motion.div ref={scope} drag onDragEnd={handleDragEnd} />
}
```

### Transition Configuration

| Type | Use Case | Props |
|------|----------|-------|
| `spring` | Natural feel, UI elements | `stiffness`, `damping`, `mass`, `bounce` |
| `tween` | Simple, predictable | `duration`, `ease`, `delay` |
| `inertia` | Velocity-based (drag deceleration) | `velocity`, `power`, `timeConstant` |
| `keyframes` | Multi-step animation | Array of values, `times`, `ease` |

```typescript
<motion.div
  animate={{ x: [0, 100, 50, 200], rotate: [0, 90, 45, 180] }}
  transition={{ duration: 2, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' }}
/>
```

### Reduced Motion and Performance

Respect `prefers-reduced-motion`:

```typescript
import { useReducedMotion } from 'framer-motion'

function SafeAnimation({ children }: { children: React.ReactNode }) {
  const shouldReduce = useReducedMotion()

  if (shouldReduce) return <>{children}</>

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  )
}
```

Performance tips:
- Prefer `transform` and `opacity` animations — GPU-composited
- Use `will-change: transform` on animated elements
- Avoid animating `width`, `height`, `top`, `left` — triggers layout recalc
- For many elements (100+), disable layout animations with `layoutDependency`
- React 19 concurrent mode: Framer Motion uses `useSyncExternalStore` — compatible

```typescript
const MotionItem = React.memo(({ item }: { item: Item }) => (
  <motion.div
    layout="position"
    layoutDependency={[item.id]}
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
  >
    {item.name}
  </motion.div>
))
```

---

### Why This Matters

Animations communicate state changes, guide attention, and express brand. Bad animations — janky, slow, inaccessible — degrade UX. Framer Motion is the dominant solution, but raw usage scatters animation config across components. Abstraction centralizes timing curves, reduced-motion handling, and performance best practices.

---

### Common Questions

**Q: Framer Motion vs CSS animations/transitions — when to use which?**
A: CSS for simple one-shot animations (hover, fade, spin). Framer Motion for: orchestrated sequences, layout animations, gesture-driven animations, exit animations, shared element transitions. Bundle cost (~12KB gzipped) is worth it when any of these are needed.

**Q: How to handle animations during SSR/SSG?**
A: Framer Motion v11+ supports SSR via `motion.div` with `initial={false}` or server-safe mode. For Next.js App Router, wrap animated components in client boundary. Use `LayoutGroup` for shared layout across client/server boundaries.

**Q: Can I use Framer Motion with React Native?**
A: No — Framer Motion is DOM-only. React Native uses `react-native-reanimated` for similar API. API concepts (shared layouts, gesture animations, spring physics) transfer.

---

## Examples

### Example 1: Animated Accordion with layout

**Problem**: Accordion panels with smooth height transitions. Height is content-dependent — cannot animate with fixed values.

**Solution**:
```typescript
function AccordionPanel({ title, children, expanded }: { title: string; children: React.ReactNode; expanded: boolean }) {
  return (
    <motion.div layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <motion.button layout="position">{title}</motion.button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
```

### Example 2: Shared Element Modal Transition

**Problem**: Click thumbnail → full image opens in modal. Thumbnail should animate seamlessly to modal position.

**Solution**: `layoutId` on image element that exists in both grid and modal:

```typescript
function Gallery() {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {images.map(img => (
          <motion.img
            key={img.id}
            layoutId={`img-${img.id}`}
            src={img.thumb}
            style={{ borderRadius: 8, cursor: 'pointer' }}
            onClick={() => setSelected(img.id)}
            whileHover={{ scale: 1.05 }}
          />
        ))}
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setSelected(null)}
          >
            <motion.img
              layoutId={`img-${selected}`}
              src={images.find(i => i.id === selected)!.full}
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

---

## Key Takeaways
- Wrap third-party components with `motion(Component)` or internal wrapper for app-level animation defaults
- Use `variants` with `staggerChildren` for declarative list / grid animations
- `AnimatePresence` with `mode="popLayout"` for clean mount/unmount transitions
- `layoutId` enables shared element transitions between separate components
- `useReducedMotion()` — always respect prefers-reduced-motion
- Prefer `transform`/`opacity` animations, avoid layout-triggering properties
- `useAnimate` for imperative sequences and orchestration

## Common Misconception

**"Framer Motion only does enter/exit animations."**

Framer Motion handles: layout animations (size/position changes auto-animate), gesture animations (hover, tap, drag, pan, scroll), SVG path drawing, scroll-linked animations (`useScroll` + `useTransform`), and viewport-triggered animations. Enter/exit is a subset.

---

## Feynman Explain
(Explain Framer Motion's `layout` prop to a CSS developer: when an element's position or size changes due to re-render, `layout` tells React to animate the DOM change instead of snapping. It uses FLIP under the hood — First, Last, Invert, Play.)

---

## Reframe
(Pause. Do all 20 app animations need Framer Motion? Consider: (1) Which animations communicate state vs decorative? (2) How does motion abstraction affect bundle size? (3) When the team knows only CSS transitions, is Framer Motion worth the learning curve?)

---

## Drill
Take the quiz. MCQs test motion wrapper patterns, AnimatePresence, layoutId, variants, and performance optimization.

Run: `learn.sh quiz external-lib-patterns 11-animation-framer-motion`
