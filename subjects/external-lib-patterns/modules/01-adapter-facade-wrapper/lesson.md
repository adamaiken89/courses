# Module 1: Adapter, Facade & Wrapper Patterns

Est. study time: 2h
Language: en

## Learning Objectives
- Distinguish adapter, facade, and wrapper patterns by intent
- Apply each pattern to real-world library integration scenarios
- Design abstraction boundaries that survive vendor migration
- Identify over-abstraction and premature abstraction

---

## Core Content

### The Problem: Library Proliferation

Modern frontend apps integrate 10-30 external libraries. Each ships its own API, typing, lifecycle, and upgrade cadence. Without abstraction, library APIs leak into every file that touches them:

```typescript
// Bad: library API spread across app
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { format } from 'date-fns'

function UserTable() {
  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'createdAt', headerName: 'Created', width: 150,
      valueFormatter: (v) => format(new Date(v), 'yyyy-MM-dd') }
  ]
  return <DataGrid rows={users} columns={columns} />
}
```

Problem: upgrade MUI X Data Grid → AG Grid touches every column definition. Change date format lib → every `format` call changes.

Three patterns solve this at different abstraction levels.

### Adapter Pattern

Adapter converts one interface to another. Use when you need to swap one library for another without changing consumer code.

```typescript
interface DateFormatter {
  format(date: Date, pattern: string): string
  parse(str: string, pattern: string): Date
}

class DateFnsAdapter implements DateFormatter {
  format(date: Date, pattern: string): string {
    return format(date, pattern)
  }
  parse(str: string, pattern: string): Date {
    return parse(str, pattern, new Date())
  }
}

class DayjsAdapter implements DateFormatter {
  format(date: Date, pattern: string): string {
    return dayjs(date).format(pattern)
  }
  parse(str: string, pattern: string): Date {
    return dayjs(str, pattern).toDate()
  }
}
```

Consumers depend on `DateFormatter` interface, never on library directly. Swap implementation in one place.

> **Think**: Adapter adds indirection. When does adapter cost outweigh benefit? When is direct dependency acceptable?
>
> *Answer: Adapter pays off when: (1) library migration expected (trial, equivocal choice), (2) testing requires mock, (3) team capsulizes expertise. Direct dependency fine when: library is de-facto standard (React), migration cost near-zero, or API aligns with domain natively.*

React 19 introduces concerns that affect adapter design. React Compiler auto-memoizes components and hooks, which means adapter wrappers that use `useMemo` or `useCallback` internally may conflict with the compiler's memoization boundaries. Adapters should be designed as leaf boundaries where the compiler stops optimizing — wrap the library adapter in a `"use client"` boundary if it uses legacy patterns like `forwardRef`. Ref as prop (React 19 deprecates `forwardRef` — `ref` is now a regular prop) changes how adapter wrappers expose imperative handles. Wrappers that previously used `forwardRef` can now pass `ref` directly as a prop, simplifying the adapter interface. Server Components cannot use hooks or browser APIs, so any adapter that wraps a client-side library (date picker, map, chart) must be declared with `"use client"` and imported dynamically via `next/dynamic` or `lazy()` with a SSR-disabled boundary.

### Facade Pattern

Facade provides simplified interface to complex subsystem. Use when library exposes 50+ APIs but app needs 5.

```typescript
// Library: mapbox-gl exposes 200+ methods, events, options
// Facade: app needs 5 operations
class MapFacade {
  private map: mapboxgl.Map

  constructor(container: HTMLElement, center: [number, number]) {
    this.map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom: 12
    })
  }

  addMarker(lngLat: [number, number], label: string): void {
    const el = document.createElement('div')
    el.textContent = label
    new mapboxgl.Marker(el).setLngLat(lngLat).addTo(this.map)
  }

  flyTo(lngLat: [number, number], zoom?: number): void {
    this.map.flyTo({ center: lngLat, zoom })
  }

  destroy(): void {
    this.map.remove()
  }
}
```

Facade reduces learning surface, centralizes configuration, and hides lifecycle complexity.

> **Think**: Facade hides library features by design. How to expose advanced features without breaking simplicity?
>
> *Answer: Escape hatch pattern. Facade accepts optional `passthrough` prop or `getNativeInstance()` method that returns underlying library object. Consumers opt-in to advanced features with clear "you are now outside abstraction" signal.*

### Wrapper Pattern (Composition)

Wrapper composes library component into app's component, controlling props, defaulting behavior, enforcing constraints.

```typescript
interface AppDataGridProps<T> {
  data: T[]
  columns: AppColumnDef<T>[]
  sortable?: boolean
  onRowClick?: (row: T) => void
  pageSize?: number
  loading?: boolean
}

// Wrapper: single import, constrained API, consistent defaults throughout app
function AppDataGrid<T>({ data, columns, sortable = true,
  onRowClick, pageSize = 25, loading }: AppDataGridProps<T>) {
  return (
    <DataGrid
      rows={data}
      columns={columns}
      sortingMode={sortable ? 'client' : undefined}
      onRowClick={onRowClick}
      pageSizeOptions={[10, 25, 50]}
      initialState={{ pagination: { paginationModel: { pageSize } } }}
      loading={loading}
      disableColumnFilter
      localeText={zhCNGridLocale}
    />
  )
}
```

Wrapper pattern: app-wide defaults, single import, library change means one file changes.

### Choosing the Right Pattern

| Concern | Adapter | Facade | Wrapper |
|---------|---------|--------|---------|
| Interface mismatch | Convert interface | Simplify interface | Compose component |
| Migration risk | High | Medium | Low (one file) |
| Feature exposure | Full (mapped) | Limited | Curated |
| Testing | Easy (mock adapter) | Medium (mock facade) | Medium (mock child) |
| Example use case | Date lib swap | Map library | Data grid component |

> **Think**: Your team uses three chart libraries across the app. One team owns Recharts, another uses visx, a third passes raw D3. What pattern(s) do you apply?
>
> *Answer: Facade per library (each team keeps familiar API) + Adapter if you want a unified chart interface. Without abstraction, migrating from Recharts to visx touches every chart file. With facade, migration touches only facade internals.*

### Anti-Patterns

**Thin wrapper**: Wrapper that passes every prop unchanged — adds no value, only indirection. If wrapper does not enforce defaults, constrain props, or transform data, it's noise.

**Leaky abstraction**: Abstraction that exposes library-specific concepts (e.g., "column freezing" in pivot-table abstraction that assumes AG Grid's API). Should freeze be app concept or grid concept? If all grids in app need freeze, abstract. If one grid freezes, keep it in wrapper config.

**God abstraction**: Single wrapper for all libraries. A combined form+grid+chart wrapper becomes untestable, hard to type, and impossible to migrate.

---

### Why This Matters

Without abstraction, library upgrades become app-wide rewrites. Every developer must learn every library's quirks. Patterns in this module let you isolate volatility, centralize expertise, and migrate with confidence. Teams that skip abstraction pay 3-5x migration cost when libraries break, deprecate, or get replaced.

---

### Common Questions

**Q: Should I wrap every library?**
A: No. Wrap libraries that: (1) have realistic replacement candidates, (2) are used across multiple modules, (3) have complex lifecycle or configuration. Skip wrapping utility libs (lodash, immer) or de-facto standards (React itself).

**Q: How to handle library typing in wrappers?**
A: Re-export types under app namespace if consumers need them. Otherwise hide library types inside wrapper. Use `satisfies` or mapped types to constrain library generics without leaking.

**Q: Wrapper offers escape hatch via `getNativeInstance()`. Should I document it?**
A: Yes. Document that escape hatch voids abstraction guarantees. Code reviews flag escape hatch usage. Track usage to know when wrapper needs extension.

**Q: How does React 19 affect adapter/wrapper patterns?**
A: React Compiler auto-memoizes, so adapters using `useMemo`/`useCallback` for library instance caching may conflict — mark adapter as `"use client"` boundary. `forwardRef` is deprecated; ref as prop simplifies wrapper handle exposure. Server Components force `"use client"` on any adapter using browser APIs (DOM, WebSocket, canvas). Concurrent rendering with Suspense means adapter initialization (lazy imports, dynamic library loading) should use `Suspense` boundaries to avoid blocking the UI.

---

## Examples

### Example 1: Wrapping a Date Picker Library

**Problem**: App uses three different date picker components (AntD DatePicker, react-datepicker, custom input). Each has different API, styling, i18n pattern.

**Solution**: Single `AppDatePicker` wrapper:

```typescript
type AppDatePickerProps = {
  value: Date | null
  onChange: (date: Date | null) => void
  label?: string
  minDate?: Date
  maxDate?: Date
  error?: string
}

function AppDatePicker({ value, onChange, label, minDate, maxDate, error }: AppDatePickerProps) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <AntDatePicker
        value={value ? dayjs(value) : null}
        onChange={(d) => onChange(d?.toDate() ?? null)}
        disabledDate={(d) => {
          if (minDate && d.isBefore(dayjs(minDate))) return true
          if (maxDate && d.isAfter(dayjs(maxDate))) return true
          return false
        }}
        status={error ? 'error' : undefined}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}
```

**Result**: 200+ date picker usages consolidate to single component. Library migration (AntD → MUI) changes one file.

### Example 2: Adapter for Notification Service

**Problem**: App uses `react-hot-toast`. Product wants to evaluate `sonner` for bundle size.

**Solution**: Adapter pattern:

```typescript
interface Notifier {
  success(msg: string): void
  error(msg: string): void
  info(msg: string): void
  dismiss(id?: string): void
}

class HotToastAdapter implements Notifier { /* ... */ }
class SonnerAdapter implements Notifier { /* ... */ }

// Consumer
function useNotify(): Notifier {
  return useMemo(() => new HotToastAdapter(), [])
}
```

**Result**: Swap notification library by changing one factory call. A/B test both in staging with feature flag.

---

## Key Takeaways
- Adapter converts interface → interface (vendor swap). Facade simplifies complex subsystem. Wrapper composes component with app defaults.
- Wrap libraries with realistic replacement candidates or complex configuration. Skip wrapping de-facto standards.
- Provide escape hatch (`getNativeInstance()`) with documentation that it voids abstraction guarantees.
- Thin wrappers are noise. God abstractions are untestable. Leaky abstractions defeat purpose.
- Test adapters with mock implementations. Test wrappers by asserting rendered output, not library internals.

## Common Misconception

**"I'll add abstraction when migration happens."**

Abstraction added during migration is too late. You discover the API surface you need to cover only when you are already mid-migration. This leads to adapter that exposes old library's quirks instead of clean interface. Add abstraction before you need it — when library adoption stabilizes and usage patterns are clear.

---

## Feynman Explain
(Explain adapter, facade, and wrapper patterns to a junior developer who knows only "import and use." Use real-world analogy: power plug adapter, TV remote control, gift wrapping.)

---

## Reframe
(Pause. Critics say abstraction layers add complexity for hypothetical futures. When does wrapping every library violate YAGNI? How to determine the right level of abstraction for a 5-person startup vs 100-person enterprise?)

---

## Drill
Take the quiz. MCQs test pattern recognition, trade-off analysis, and anti-pattern identification.

Run: `learn.sh quiz external-lib-patterns 01-adapter-facade-wrapper`
