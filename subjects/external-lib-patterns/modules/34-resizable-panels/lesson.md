# Module 34: Resizable Panels — react-resizable-panels

Est. study time: 1h
Language: en

## Learning Objectives
- Build resizable layouts with PanelGroup, Panel, PanelResizeHandle
- Implement controlled and uncontrolled panel sizing
- Persist panel layouts to localStorage
- Design collapsible panels and nested panel groups
- Integrate React 19 Suspense boundaries per panel for lazy-loaded content
- Use useTransition for debounced layout persistence

---

## Core Content

### react-resizable-panels Architecture

Three core components:

- `PanelGroup` — container defining direction and layout constraints
- `Panel` — resizable region with min/max size and collapsible behavior
- `PanelResizeHandle` — draggable separator between panels

```typescript
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

function SplitLayout() {
  return (
    <PanelGroup direction="horizontal">
      <Panel defaultSize={30} minSize={20} maxSize={50}>
        Sidebar
      </Panel>
      <PanelResizeHandle />
      <Panel defaultSize={70}>
        Main Content
      </Panel>
    </PanelGroup>
  )
}
```

### Controlled vs Uncontrolled

Uncontrolled — panels manage own sizes via `defaultSize`:

```typescript
<Panel defaultSize={50} minSize={10} />
```

Controlled — parent manages sizes via `size` prop:

```typescript
type Props = {
  sizes: number[]
  onLayout: (sizes: number[]) => void
}

function ControlledLayout({ sizes, onLayout }: Props) {
  return (
    <PanelGroup direction="horizontal" onLayout={onLayout}>
      <Panel size={sizes[0]} minSize={20}>
        Left
      </Panel>
      <PanelResizeHandle />
      <Panel size={sizes[1]} minSize={20}>
        Right
      </Panel>
    </PanelGroup>
  )
}
```

### Min/Max Size Constraints

```typescript
<PanelGroup direction="vertical">
  <Panel defaultSize={60} minSize={30} maxSize={80}>
    Editor
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={40} minSize={50} maxSize={70}>
    Preview
  </Panel>
</PanelGroup>
```

`minSize` / `maxSize` as percentages of PanelGroup. Prevents panels from becoming unusably small or collapsing entirely.

### onLayout Callback for Persistence

`onLayout` fires with `number[]` of panel sizes (percentages). Save to localStorage:

```typescript
function PersistedLayout() {
  const [sizes, setSizes] = useState<number[] | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('panelLayout')
    if (saved) setSizes(JSON.parse(saved))
  }, [])

  function handleLayout(sizes: number[]) {
    localStorage.setItem('panelLayout', JSON.stringify(sizes))
  }

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={handleLayout}
    >
      <Panel defaultSize={25} size={sizes?.[0]} minSize={15}>
        Nav
      </Panel>
      <PanelResizeHandle />
      <Panel defaultSize={50} size={sizes?.[1]} minSize={30}>
        Content
      </Panel>
      <PanelResizeHandle />
      <Panel defaultSize={25} size={sizes?.[2]} minSize={15}>
        Inspector
      </Panel>
    </PanelGroup>
  )
}
```

### Collapsible Panels

Panels can collapse to minimal state (sidebar drawer pattern):

```typescript
function CollapsibleSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <PanelGroup direction="horizontal">
      <Panel
        defaultSize={20}
        minSize={10}
        collapsible={true}
        collapsedSize={0}
        onCollapse={() => setCollapsed(true)}
        onExpand={() => setCollapsed(false)}
      >
        {collapsed ? null : <Sidebar />}
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={50}>
        <MainContent />
      </Panel>
    </PanelGroup>
  )
}
```

### Nested Panel Groups

Nest PanelGroup for complex layouts:

```typescript
function DashboardLayout() {
  return (
    <PanelGroup direction="vertical">
      <Panel defaultSize={60}>
        <PanelGroup direction="horizontal">
          <Panel defaultSize={50} minSize={30}>
            Editor
          </Panel>
          <PanelResizeHandle />
          <Panel defaultSize={50} minSize={30}>
            Preview
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle />
      <Panel defaultSize={40} minSize={20}>
        Console / Output
      </Panel>
    </PanelGroup>
  )
}
```

### Keyboard Accessibility

PanelResizeHandle supports keyboard out of the box:

| Key | Action |
|-----|--------|
| Arrow Left/Up | Decrease panel size |
| Arrow Right/Down | Increase panel size |
| Home | Minimize panel |
| End | Maximize panel |
| Enter | Toggle collapse |

### RTL Support

```typescript
<PanelGroup direction="horizontal" dir="rtl">
  <Panel defaultSize={30}>Right Sidebar</Panel>
  <PanelResizeHandle />
  <Panel defaultSize={70}>Main Content</Panel>
</PanelGroup>
```

### Think: Layout Persistence Debounce

`onLayout` fires during drag (high frequency). Writing to localStorage on every frame blocks the main thread. Use `useTransition` for debounced persistence:

```typescript
import { useTransition, useCallback } from 'react'

function DebouncedPersistLayout() {
  const [isPending, startTransition] = useTransition()

  const handleLayout = useCallback((sizes: number[]) => {
    startTransition(() => {
      localStorage.setItem('panelLayout', JSON.stringify(sizes))
    })
  }, [])

  return (
    <PanelGroup direction="horizontal" onLayout={handleLayout}>
      ...
    </PanelGroup>
  )
}
```

---

### Why This Matters

Resizable panels are essential for tool-like interfaces (IDEs, dashboards, email clients, design tools). Users expect to customize their workspace. Raw implementation requires managing pointer events, collision detection, and min-size enforcement. react-resizable-panels handles all edge cases: rapid resize, panel collapse, keyboard navigation, RTL, nested groups.

Persistence pattern (save/restore layout to localStorage) transforms static layout into personalized workspace. Combined with React 19 concurrent features, resize remains smooth even during save.

---

### Common Questions

**Q: Can I programmatically trigger panel resize?**
A: Yes via ref-as-prop. Panel exposes imperative `resize(percentage)` and `collapse()`/`expand()` methods.

**Q: How to prevent panel from collapsing below content height?**
A: Use `minSize` prop as percentage. For content-based minimum, measure content height and convert to percentage via `onLayout` callback.

**Q: Does it work with CSS flexbox layouts?**
A: PanelGroup injects flex behavior internally. Nest inside flex containers — works. PanelGroup itself behaves as flex parent.

---

## Examples

### Example 1: Persisted Layout Hook

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'app-panel-layout'

type Direction = 'horizontal' | 'vertical'

interface UsePersistedLayoutOptions {
  panelCount: number
  defaultSizes: number[]
  direction?: Direction
}

export function usePersistedLayout({
  panelCount,
  defaultSizes,
  direction = 'horizontal',
}: UsePersistedLayoutOptions) {
  const [sizes, setSizes] = useState<number[] | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-${direction}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length === panelCount) {
          setSizes(parsed)
        }
      } catch {}
    }
  }, [panelCount, direction])

  const handleLayout = useCallback((newSizes: number[]) => {
    setSizes(newSizes)
    startTransition(() => {
      localStorage.setItem(
        `${STORAGE_KEY}-${direction}`,
        JSON.stringify(newSizes)
      )
    })
  }, [direction])

  const resetLayout = useCallback(() => {
    localStorage.removeItem(`${STORAGE_KEY}-${direction}`)
    setSizes(null)
  }, [direction])

  return {
    sizes: sizes ?? defaultSizes,
    onLayout: handleLayout,
    resetLayout,
    isPending,
  }
}
```

### Example 2: Dashboard with Nested Panels

```typescript
'use client'

import {
  Panel, PanelGroup, PanelResizeHandle,
} from 'react-resizable-panels'
import { usePersistedLayout } from './usePersistedLayout'

export function Dashboard() {
  const {
    sizes: topSizes,
    onLayout: onTopLayout,
  } = usePersistedLayout({ panelCount: 2, defaultSizes: [60, 40], direction: 'vertical' })

  const {
    sizes: editorSizes,
    onLayout: onEditorLayout,
  } = usePersistedLayout({ panelCount: 2, defaultSizes: [50, 50], direction: 'horizontal' })

  return (
    <PanelGroup direction="vertical" onLayout={onTopLayout}>
      <Panel size={topSizes[0]} minSize={30}>
        <PanelGroup direction="horizontal" onLayout={onEditorLayout}>
          <Panel size={editorSizes[0]} minSize={25}>
            <Editor />
          </Panel>
          <PanelResizeHandle />
          <Panel size={editorSizes[1]} minSize={25}>
            <Preview />
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle />
      <Panel size={topSizes[1]} minSize={15}>
        <Console />
      </Panel>
    </PanelGroup>
  )
}
```

### Example 3: Collapsible Sidebar with Suspense per Panel

```typescript
'use client'

import { Suspense } from 'react'
import {
  Panel, PanelGroup, PanelResizeHandle,
} from 'react-resizable-panels'

function PanelSpinner() {
  return <div style={{ padding: 16 }}>Loading...</div>
}

export function AppLayout() {
  return (
    <PanelGroup direction="horizontal">
      <Panel
        defaultSize={20}
        minSize={5}
        collapsible={true}
        collapsedSize={0}
      >
        <Suspense fallback={<PanelSpinner />}>
          <SlowSidebar />
        </Suspense>
      </Panel>

      <PanelResizeHandle />

      <Panel minSize={40}>
        <Suspense fallback={<PanelSpinner />}>
          <MainContent />
        </Suspense>
      </Panel>

      <PanelResizeHandle />

      <Panel defaultSize={25} minSize={15}>
        <Suspense fallback={<PanelSpinner />}>
          <Inspector />
        </Suspense>
      </Panel>
    </PanelGroup>
  )
}
```

---

## Key Takeaways
- PanelGroup, Panel, PanelResizeHandle form the three-component layout system
- Controlled mode via `size` + `onLayout`; uncontrolled via `defaultSize`
- Min/max percentages prevent unusably small panels
- Collapsible panels with collapsedSize=0 for sidebar drawer pattern
- Nested PanelGroup for complex layouts (vertical + horizontal)
- Persist layout to localStorage via onLayout with useTransition debounce
- Suspense boundaries per panel for lazy-loaded panel content
- Keyboard accessible resize handles (arrows, Home/End, Enter)
- RTL support via dir prop

## Common Misconception

"**Panel sizes must sum to 100% exactly.**"

PanelGroup automatically normalizes sizes. If panels total > 100%, they scale proportionally. If total < 100%, remaining space distributes according to `defaultSize` ratios. Use `onLayout` output (always normalized) for persistence, not input values.

---

## Feynman Explain
(Explain resizable panels to someone who uses split-view in file explorer. PanelGroup = window frame. Panel = each pane. PanelResizeHandle = divider you drag. Collapse = hide pane entirely. Nested = pane split again. Persistence = remembering where you put dividers next time you open app.)

---

## Reframe
(Resizable panels add complexity. For content pages with single column, skip entirely. For tools (IDE, dashboard, email), they are table stakes. Start with simple two-panel layout. Add nested groups and collapse only when users request workspace customization.)

---

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 34-resizable-panels`
