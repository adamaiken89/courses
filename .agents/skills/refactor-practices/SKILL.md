---
name: refactor-practices
description: Codified patterns from CourseReader refactor. Component decomposition, prop elimination, store optimization, React 19 idioms. Trigger when user says "refactor", "clean up", "extract component", "optimize store", "remove prop drilling", or "apply refactor patterns".
---

# Refactor & Development Practices

Patterns derived from CourseReader refactor. Apply when cleaning up or building new components.

## 1. Component size threshold

> If >120 lines AND >1 visual grouping → split. Each sub-component does one thing.

- Leaf components: <100 lines, single concern
- Composite components: <250 lines, compose sub-components
- Exception: long JSX lists of simple items (keep inline, extract item sub-component)

**Example**: LessonToolbar 379→141 lines. 10 sub-comps created (FontSizeControl, ThemeControl, etc.). Each 22–57 lines.

## 2. Prop pass-through elimination

> If a component receives props it does NOT consume → eliminate them. Either:
> (a) Subscribe to store directly in the consuming child
> (b) Restructure to avoid the unnecessary intermediate

**When to use store vs props**:
- Props: page→section boundaries, clear ownership
- Store: prop passes through >1 intermediate without consumption

**Example**: StudyTools received `content`, `sections`, `contentRef`, `scrollToSection` — passed them to NotesHighlightsTab untouched. Fix: tabs subscribe to `lessonViewStore` directly. 4 props eliminated.

**Checklist**:
1. Does current component use prop at all? If not → remove.
2. Is child the only consumer? If yes → child reads from store.
3. Is store dependency appropriate? (cross-cutting concern, not render-specific)

## 3. Store alias → delete

> If a store file only re-exports another store's slice → delete it. Import from source.

**Example**: `selectionStore` was a separate file re-exporting selectors from `lessonStore`. All imports redirected to `lessonStore` directly. File deleted.

**Check for**:
- `export const useXStore = ...` that wraps another store's selectors
- Re-export files with no internal state
- Barrel files that add no value

## 4. Zustand useShallow for multi-selector

> When selecting multiple fields from one store, use `useShallow` instead of individual selector calls.

**Bad**:
```ts
const a = useStore((s) => s.a);
const b = useStore((s) => s.b);
const c = useStore((s) => s.c);
```

**Good**:
```ts
const { a, b, c } = useStore(useShallow((s) => ({ a: s.a, b: s.b, c: s.c })));
```

Single re-render instead of 3. Also eliminates need for `useMemo` wrapper.

**Example**: `useSelection.ts` 13 individual selectors → 1 `useShallow` call. Removed `useMemo` wrapper.

## 5. React 19 useOptimistic for optimistic UI

> Use `useOptimistic` instead of manual optimistic state + useEffect sync.

**Bad**: local state updated optimistically, useEffect syncs from props on change.

**Good**:
```ts
const [optimisticValue, toggleOptimistic] = useOptimistic(
  initialValue,
  (_state, newValue: boolean) => newValue,
);
```

The hook auto-reverts on next render if `initialValue` hasn't changed — no manual sync.

**Example**: `useLesson.ts` completion toggle simplified. Removed useEffect that synced `initialCompleted → optimistic`.

## 6. DOM measurement → custom hook

> Extract `getBoundingClientRect` + viewport clamping logic into reusable hook.

**Extract**: positioning arithmetic (viewport-relative calc, clamp to bounds) → hook.

**Keep in component**: render logic, event handler wiring.

**Example**: `SelectionToolbar.tsx` positioning logic (viewport clamping, boundary detection) extracted to `useFloatingPosition.ts`. Component 104→82 lines. Hook reusable elsewhere.

## 7. Directory structure for split components

When splitting a mega-component:
- **Leaf sub-components**: same directory as consumer (e.g. `components/lesson/`)
- **Page sections**: `components/settings/` for SettingsPage sections
- **Utilities**: co-located or `components/` as appropriate
- **Hooks**: `hooks/` if reusable across components, co-located if single-use

**Example**:
```
components/lesson/
  LessonToolbar.tsx          # consumer (141 lines, composes)
  FontSizeControl.tsx        # sub-component
  ThemeControl.tsx           # sub-component
  ...
components/settings/
  ApiKeySection.tsx          # extracted section
  ThemeSection.tsx           # extracted section
  ...
components/
  SearchOverlay.tsx          # after split (218 lines, composes)
  CourseFilterChips.tsx      # extracted sub-component
  SearchResultItem.tsx       # extracted sub-component
  searchHighlight.tsx        # extracted utility
```

## 8. Test alignment

When refactoring:
- Sub-component tests: test the sub-component directly (store setup + render)
- Parent tests: verify composition, not sub-component internals
- Store connectivity changes: update test's store setup in `beforeEach`

**Pattern** from this refactor: tabs stopped receiving props → tests updated to set `viewStore`/`lessonViewStore` state in `beforeEach`.

## Reference files (examples of each pattern)

| Pattern | File | Key lines |
|---------|------|-----------|
| Component split | `components/lesson/LessonToolbar.tsx` | composes 10 sub-comps |
| Prop elimination | `components/StudyTools.tsx` | subscribes to viewStore |
| Store alias deleted | `stores/selectionStore.ts` | deleted |
| useShallow | `hooks/useSelection.ts` | `useShallow((s) => ({...}))` |
| useOptimistic | `hooks/useLesson.ts` | `useOptimistic(initialCompleted, ...)` |
| Floating position hook | `hooks/useFloatingPosition.ts` | viewport clamping |
| Settings sections | `components/settings/*.tsx` | 8 section files |
