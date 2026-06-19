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

## Quiz: 01-adapter-facade-wrapper


### Which pattern converts one library's interface to another without changing consumer code?

- [ ] A: Facade

- [✓] B: Adapter

- [ ] C: Wrapper

- [ ] D: Decorator


**Answer:** B

Adapter converts interface A to interface B so consumers depend on target interface. Facade simplifies complex subsystem. Wrapper composes component with app defaults. Decorator extends behavior.


### Your team uses three different chart libraries. You need a unified API for bar/line/pie charts. Which pattern?

- [✓] A: Adapter per library — each implements a common IChart interface

- [ ] B: Single Facade over all three libraries

- [ ] C: Wrapper per chart type

- [ ] D: No abstraction — let each team choose their own API


**Answer:** A

Adapter converts each library's API to common IChart interface. Facade would hide too much. Wrapper per chart type duplicates effort. No abstraction makes migration impossible.


### Which is a sign of a 'thin wrapper' anti-pattern?

- [ ] A: Wrapper adds default props and constrains options

- [✓] B: Wrapper passes every prop through without transformation

- [ ] C: Wrapper provides an escape hatch to native library instance

- [ ] D: Wrapper is used in exactly one component


**Answer:** B

Thin wrapper passes all props unchanged — adds indirection without value. Defaults, constraints, and escape hatches are useful additions. Usage count does not determine thickness.


### When should you skip wrapping a library?

- [ ] A: Library is used in 20+ components

- [✓] B: Library is a de-facto standard like React itself

- [ ] C: Library has complex lifecycle management

- [ ] D: Team expects to evaluate alternatives next quarter


**Answer:** B

De-facto standards with near-zero migration probability (React, TypeScript) do not need wrapping. Libraries with broad usage, complex lifecycle, or potential replacement candidates should be wrapped.


### A Facade pattern exposes getNativeInstance() for advanced use. How to manage this?

- [ ] A: Remove escape hatch — defeats abstraction

- [✓] B: Document that escape hatch voids abstraction guarantees and track usage in code review

- [ ] C: Make getNativeInstance() return a proxied version that logs usage

- [ ] D: Only expose getNativeInstance() in development builds


**Answer:** B

Documenting and tracking escape hatch usage is pragmatic. Removing it hurts power users. Proxying/logging adds complexity. Dev-only breaks production edge cases.


### Which scenario makes abstraction pay off most?

- [ ] A: Library is universally used by all teams for diverse needs

- [ ] B: Library is used in one file by one developer

- [✓] C: Library has high migration likelihood and is used across modules

- [ ] D: Library is extremely simple (< 5 API methods)


**Answer:** C

Abstraction pays off when library has realistic replacement candidates AND broad usage. Single-file usage: refactor when migration happens. Simple libs: direct dependency fine.


### A wrapper exposes library-specific prop names (e.g., 'freezeColumns' for AG Grid). What anti-pattern is this?

- [ ] A: Thin wrapper

- [✓] B: Leaky abstraction

- [ ] C: God abstraction

- [ ] D: Golden wrapper


**Answer:** B

Leaky abstraction exposes library-specific concepts to consumers. FreezeColumns is AG Grid concept. Clean abstraction would expose 'columns: { frozen: boolean }' or similar app-level concept.


### Why is adding abstraction during migration problematic?

- [ ] A: Migration is when you most need abstraction

- [✓] B: You discover needed API surface only mid-migration, leading to adapter that mimics old API

- [ ] C: Abstraction during migration is always correct

- [ ] D: Libraries do not support abstraction during migration


**Answer:** B

Adding abstraction during migration is reactive — you build interface based on old library's quirks instead of clean domain interface. Create abstraction when library usage stabilizes.


### What distinguishes Facade from Adapter?

- [ ] A: Facade converts interface, Adapter simplifies subsystem

- [✓] B: Facade simplifies complex subsystem, Adapter converts one interface to another

- [ ] C: Both are identical — interchangeable terms

- [ ] D: Facade wraps component, Adapter wraps API


**Answer:** B

Facade provides simplified view of complex subsystem (reducing surface area). Adapter converts one interface to another (preserving intent, changing shape). Both are structural patterns with different intents.


### Your team's single chart wrapper handles Recharts, visx, and D3. It has 2000 LOC and 15 configuration props. What anti-pattern?

- [ ] A: Thin wrapper — still not abstracting enough

- [✓] B: God abstraction — handles too many libraries in one component

- [ ] C: Leaky abstraction — exposes library internals

- [ ] D: This is correct — single wrapper for all charts


**Answer:** B

God abstraction tries to cover every library's capabilities in one component. Better: adapter per library (each implements IChart interface). Simpler, testable, independently migratable.


---

# Module 2: Data Grids — TanStack Table & AG Grid

Est. study time: 2.5h
Language: en

## Learning Objectives
- Architect grid wrapper that supports vendor swap between TanStack Table and AG Grid
- Design column definition schema independent of library API
- Implement virtual scrolling, inline editing, and row selection with clean abstraction
- Manage grid state (sort, filter, pagination) outside library internals

---

## Core Content

### Grid Landscape

Two dominant patterns:

**Headless (TanStack Table)**: Provides logic hooks, no rendering. Full control over markup, styling, bundle size. Requires building UI layer.

**Turnkey (AG Grid)**: Provides rendered grid with 200+ built-in features. Heavier bundle. Configuration-driven. Less control.

Third category: **Design-system grids** (MUI X Data Grid, AntD Table) — opinionated, tied to design system.

### Column Definition Abstraction

Library coupling begins with column definitions. Each library has its own shape:

```typescript
// AG Grid column
const agCol: ColDef = {
  field: 'price',
  headerName: 'Price',
  width: 120,
  valueFormatter: (p) => formatCurrency(p.value),
  cellRenderer: PriceCellRenderer,
  editable: true,
  cellEditor: 'agNumberCellEditor'
}

// TanStack column
const tsCol: ColumnDef<Row> = {
  accessorKey: 'price',
  header: 'Price',
  cell: (info) => formatCurrency(info.getValue()),
  enableEditing: true
}
```

Solution: app-level column definition mapped to library-specific format:

```typescript
interface AppColumnDef<T> {
  field: keyof T & string
  header: string
  width?: number
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  editable?: boolean
  render?: (value: T[keyof T], row: T) => ReactNode
  aggregate?: 'sum' | 'avg' | 'count'
  pinned?: 'left' | 'right'
}

function toAGridCols<T>(cols: AppColumnDef<T>[]): ColDef[] {
  return cols.map(c => ({
    field: c.field,
    headerName: c.header,
    width: c.width,
    cellRenderer: c.render ? (p: any) => c.render!(p.value, p.data) : undefined
  }))
}

function toTanStackCols<T>(cols: AppColumnDef<T>[]): ColumnDef<T>[] {
  return cols.map(c => ({
    accessorKey: c.field,
    header: c.header,
    cell: c.render ? (info) => c.render!(info.getValue(), info.row.original) : undefined
  }))
}
```

Grid wrapper uses `AppColumnDef`. Switching grid library: change mapping functions, not every column definition.

> **Think**: Some column features exist in AG Grid but not TanStack (e.g., pivot, sparkline). How to handle in abstraction?
>
> *Answer: Option A: Abstract only intersection of features across all supported libraries. Option B: Allow library-specific extensions via `AppColumnDef.extra` typed as `Record<string, unknown>`. Option A is safer; Option B tolerates leaky abstraction.*

### State Management: External Versus Internal

Grids manage internal state: sort model, filter model, pagination, column order, selection.

Anti-pattern: letting grid library own all state. When you need to read sort order for URL sync, export to CSV, or share between grids, internal state forces querying library internals.

Pattern: external state managed by app, fed into grid as controlled props:

```typescript
function useGridState<T>() {
  const [sort, setSort] = useState<SortState>({ field: 'name', dir: 'asc' })
  const [filters, setFilters] = useState<FilterState[]>([])
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 })
  const [selection, setSelection] = useState<Set<string>>(new Set())

  const onSortChange = useCallback((sort: SortState) => setSort(sort), [])
  const toggleRow = useCallback((id: string) => {
    setSelection(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  return { sort, filters, pagination, selection, onSortChange, toggleRow }
}
```

Grid wrapper accepts these as controlled props. State lives in app, not library. URL serialization, undo, multi-grid sync become trivial.

> **Think**: Controlled state requires grid to re-render on every state change. Does this hurt performance with 10k rows?
>
> *Answer: No — if wrapper passes state directly to grid library's internal state mechanism (not causing React re-render loop). AG Grid's `onSortChanged` → `setSort` triggers wrapper re-render → passes new `sortModel` prop → AG Grid applies internally without DOM churn. TanStack Table uses functional updates. Measure not assume.*

### Virtual Scoping

Grids render only visible rows. AG Grid does this internally. TanStack Table requires separate virtualizer.

For headless grids, pair TanStack Table with TanStack Virtual:

```typescript
function VirtualizedTable<T>({ columns, data }: Props<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40
  })

  const rows = virtualizer.getVirtualItems()
  return (
    <div ref={scrollRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        <div style={{ transform: `translateY(${rows[0]?.start ?? 0}px)` }}>
          {rows.map(virtualRow => (
            <div key={virtualRow.key}>
              {/* render row cells */}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

Abstraction: hide virtualizer complexity inside grid wrapper. Consumer passes data, wrapper handles virtualization strategy.

> **Think**: AG Grid virtualizes internally — `rowBuffer` and `suppressRowVirtualisation` control behavior. Wrapper should expose these at app level or keep abstract?
>
> *Answer: Expose minimal set (rowBuffer, maybe) as props. Full AG Grid virtualization config defeats abstraction. If consumer needs deep control, that's escape hatch territory.*

### React 19 Integration Patterns

React 19 introduces several features that improve grid performance and ergonomics. Ref as prop (forwardRef deprecated) simplifies exposing grid API handles. AG Grid's `gridRef` and TanStack Table's `table` instance can be accessed via `ref` prop directly without `forwardRef` wrappers:

```typescript
function GridWrapper<T>({ ref, columns, data }: GridProps<T> & { ref?: React.Ref<GridAPI> }) {
  const gridRef = useRef<AGGridReact>(null)
  useImperativeHandle(ref, () => ({
    exportToCSV: () => gridRef.current?.api.exportDataAsCsv(),
    getSelectedRows: () => gridRef.current?.api.getSelectedRows(),
    refresh: () => gridRef.current?.api.refreshCells()
  }))
  return <AGGridReact ref={gridRef} columnDefs={columns} rowData={data} />
}
```

`useTransition` marks non-urgent grid interactions (filter, search, sort) as low-priority updates, preventing jank during keystroke-heavy operations:

```typescript
function useGridSearch<T>(data: T[]) {
  const [isPending, startTransition] = useTransition()
  const [filtered, setFiltered] = useState(data)

  const onSearch = useCallback((query: string) => {
    startTransition(() => {
      setFiltered(data.filter(row => fuzzyMatch(row, query)))
    })
  }, [data])

  return { filtered, isPending, onSearch }
}
```

For data-loading grids, wrap the grid container in a `Suspense` boundary so async row data does not block the rest of the page. Use `SuspenseList` (via `use` hook) to coordinate loading sequences across multiple grid sections:

```typescript
function DataGridPage() {
  const gridData = use(fetchGridData()) // React 19 use() hook
  return <GridWrapper columns={columns} data={gridData} />
}

// Parent:
<Suspense fallback={<GridSkeleton />}>
  <DataGridPage />
</Suspense>
```

### Inline Editing

Editing pattern differs across libraries:

| Concern | AG Grid | TanStack Table |
|---------|---------|---------------|
| Edit trigger | Click, double-click, F2 | Custom handler |
| Cell editor | Built-in editors (text, number, select, date) | Custom UI (render full cell) |
| Validation | `cellEditorParams` + `cellClassRules` | Validate in custom editor component |
| Bulk save | `onCellValueChanged` event | Custom submission |

Abstract to uniform editing model:

```typescript
interface GridEditConfig<T> {
  mode: 'cell' | 'row' | 'none'
  onCellEdit?: (rowId: string, field: keyof T, value: unknown, oldValue: unknown) => void
  onRowEdit?: (rowId: string, changes: Partial<T>) => void
  validate?: (field: keyof T, value: unknown) => string | null
}
```

Wrapper maps to library editing API internally.

---

### Why This Matters

Data grid is the most expensive component to replace in most apps. Grids touch every feature — CRUD, export, analytics, reporting. A clean grid abstraction saves 6-12 months of migration work. The pattern of external state + column abstraction pays off regardless of which grid library you choose.

---

### Common Questions

**Q: Should I abstract grid selection to Set or array?**
A: Set for selection by ID (O(1) lookup). Array for ordered selection or drag-to-select range. Map for selected rows with metadata (hover, editing).

**Q: AG Grid enterprise is expensive. How to make wrapper license-agnostic?**
A: Adapter pattern. Interface `IEnterpriseGridFeature` with methods like `getPivotData()`, `getAggregatedData()`. Implement with AG Grid enterprise. If budget changes, implement with TanStack Table + manual pivot. Consumers depend on interface, not enterprise API.

---

## Examples

### Example 1: Export-Import Grid Wrapper with React 19

**Problem**: Export twice: once via wrapper with AG Grid, once via TanStack Table for headless rendering in PDF export.

**Solution**: Column abstraction shared. Grid wrapper swaps internal implementation per context. React 19 ref as prop exposes imperative APIs without `forwardRef`:

```typescript
function InteractiveGrid<T>({ ref, ...props }: GridProps<T> & { ref?: React.Ref<GridExports> }) {
  const agRef = useRef<AGridImperative>(null)
  useImperativeHandle(ref, () => ({
    exportCSV: () => agRef.current?.exportDataAsCsv(),
    getSelection: () => agRef.current?.getSelectedRows()
  }))
  return <AGridWrapper ref={agRef} {...props} />
}

function StaticGrid<T>(props: GridProps<T>) {
  return <TanStackWrapper {...props} />
}

function ReportView<T>({ data }: { data: T[] }) {
  const gridRef = useRef<GridExports>(null)
  const [isPending, startTransition] = useTransition()
  const handleExport = () => startTransition(() => gridRef.current?.exportCSV())

  return (
    <>
      <InteractiveGrid ref={gridRef} data={data} columns={columns} />
      <Suspense fallback={<TableSkeleton />}>
        <StaticGrid data={data} columns={columns} />
      </Suspense>
    </>
  )
}
```

Both consume same `AppColumnDef[]` and `GridState`.

### Example 2: URL-Synced Grid State

```typescript
function useURLSyncedGridState() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  const state = useGridState()
  
  useEffect(() => {
    const params: Record<string, string> = {}
    if (state.sort) params.sort = `${state.sort.field}-${state.sort.dir}`
    if (state.pagination) params.page = String(state.pagination.page)
    setSearchParams(params, { replace: true })
  }, [state.sort, state.pagination])

  return state
}
```

Grid state survives navigation, supports deep linking, and can be serialized to storage.

---

## Key Takeaways
- Abstract column definitions as `AppColumnDef<T>` — map to library-specific format via mapper functions
- Externalize grid state (sort, filter, pagination, selection) — do not let library own it
- Virtual scrolling must be abstracted inside wrapper for headless grids
- Inline editing abstraction: edit config object maps to library editing API
- Provide escape hatch for library-specific features via optional passthrough

## Common Misconception

**"AG Grid's community version is enough for most apps."**

AG Grid community lacks: pivot, tree data, range selection, Excel export, integrated charts, and copy/paste with headers. Before adopting AG Grid enterprise, confirm your app needs these. If not, TanStack Table + virtualizer may be lighter and equally capable. Abstraction lets you start with TanStack and upgrade to AG Grid enterprise only when features are required.

---

## Feynman Explain
(Explain to a product manager: why replacing a data grid library costs 3 months and how column abstraction reduces it to 1 week. No technical jargon.)

---

## Reframe
(Pause. Grid abstraction adds significant initial overhead. For what team size, app complexity, or timeline does skipping grid abstraction make sense? When should you use MUI X Data Grid's built-in API directly?)

---

## Drill
Take the quiz. MCQs test column abstraction, state management, virtualization, and vendor migration strategy.

Run: `learn.sh quiz external-lib-patterns 02-data-grid`

## Quiz: 02-data-grid


### What is the primary benefit of abstracting column definitions into AppColumnDef?

- [ ] A: Columns render faster

- [✓] B: Switching grid libraries changes only the mapper functions

- [ ] C: TypeScript can infer row type from column definitions

- [ ] D: Column definitions become serializable


**Answer:** B

AppColumnDef provides library-agnostic column schema. Mapper functions convert to library-specific format. Migration changes mappers, not every column usage.


### A grid library owns its internal sort state. Why externalize it?

- [ ] A: Library internal state is always buggy

- [✓] B: External state enables URL sync, undo, and multi-grid coordination

- [ ] C: External state renders faster

- [ ] D: Library state cannot be serialized to JSON


**Answer:** B

External state enables URL deep linking, undo/redo, sharing sort/filter between grids, and cross-tab synchronization. Library internal state is isolated.


### Which approach handles library-specific grid features (e.g., AG Grid pivot) in an abstraction?

- [ ] A: Ban all library-specific features

- [✓] B: Abstract only the intersection of features across supported libraries

- [ ] C: Expose every library feature as optional props

- [ ] D: Only support features present in all libraries


**Answer:** B

Abstract the intersection. For library-specific features, provide optional escape hatch (e.g., `extra` prop typed as `Record<string, unknown>`). This prevents feature lock-in while allowing full library use.


### TanStack Table is headless — it provides hooks, not UI. What additional library does a headless grid need?

- [ ] A: React Router

- [✓] B: TanStack Virtual (or similar virtualizer)

- [ ] C: Redux

- [ ] D: Tailwind CSS


**Answer:** B

Headless table provides logic (sort, filter, pagination) but no rendering. Virtualizer handles windowed rendering so only visible rows are in DOM. Required for performance with large datasets.


### AG Grid community license lacks pivot and Excel export. How to design wrapper for future enterprise upgrade?

- [ ] A: Use AG Grid enterprise from the start

- [✓] B: Design IEnterpriseFeature interface, implement with community stubs, swap for enterprise implementation later

- [ ] C: Avoid AG Grid — only use TanStack Table

- [ ] D: Fork AG Grid community and add features


**Answer:** B

IEnterpriseFeature adapter pattern. Community stub throws 'not implemented' or returns unsupported. Enterprise implementation delegates to AG Grid enterprise. Conditional import via dynamic import or build flag.


### When is controlled grid state problematic for performance?

- [ ] A: Always — controlled state is always slower

- [✓] B: When wrapper re-renders all rows on every sort change instead of delegating to grid's virtual DOM

- [ ] C: When using TanStack Table (headless)

- [ ] D: When state is serialized to URL


**Answer:** B

Controlled state is fine if wrapper passes state to grid library's optimized internal mechanisms. Problematic if wrapper triggers full React re-render of visible rows on every state mutation. Use React.memo and library-specific batch updates.


### Wrapper exposes 'pivot' prop even though only AG Grid enterprise supports it. What is this?

- [ ] A: Good design — forward-thinking

- [✓] B: Leaky abstraction — app-level concerns coupled to library feature

- [ ] C: Protection — consumers should know all options

- [ ] D: Feature parity — all grids should have pivot


**Answer:** B

Pivot is a library-specific concept, not an app-level grid concern. Exposing it in wrapper API couples abstraction to AG Grid enterprise. Better: abstract feature behind generic concept like 'aggregate' or 'cross-tab'.


### How to handle inline editing validation across different grid libraries?

- [ ] A: Each library handles its own validation — no abstraction needed

- [✓] B: Define GridEditConfig with validate function — wrapper maps to library validation API

- [ ] C: Validation must be done outside grid, after save

- [ ] D: Only allow editing in AG Grid (turnkey solution)


**Answer:** B

GridEditConfig provides uniform validation model. Mapper converts to library-specific validation mechanism (AG Grid cellClassRules, TanStack custom editor with validation). Consumer writes validation once.


### How does virtual scrolling in AG Grid differ from TanStack Table?

- [✓] A: AG Grid virtualizes internally; TanStack Table requires external virtualizer

- [ ] B: TanStack Table virtualizes internally; AG Grid requires external virtualizer

- [ ] C: Both virtualize identically

- [ ] D: Neither virtualizes — you must use react-window


**Answer:** A

AG Grid handles virtual scrolling internally — you get it for free. TanStack Table is headless — you pair it with TanStack Virtual or react-window. Wrapper should hide this difference.


### Your grid wrapper exposes 'aggregation' concept. AG Grid has built-in aggregation. TanStack Table requires manual reduce. How to implement?

- [ ] A: Implement aggregation manually for all libraries

- [✓] B: Use AG Grid aggregation when available, manual reduce for TanStack — both behind same aggregation interface

- [ ] C: Skip aggregation in wrapper — consumers implement separately per library

- [ ] D: Only support aggregation with AG Grid


**Answer:** B

Abstract concept ('aggregation') maps to library-specific implementation. AG Grid uses built-in aggregate functions. TanStack uses reduce over row model. Both implement the same interface. Consumer gets aggregation without knowing which strategy runs.


---

# Module 3: Form Libraries — Formio & React Hook Form

Est. study time: 2.5h
Language: en

## Learning Objectives
- Distinguish headless form state (RHF) from schema-driven forms (Formio, JSON Forms)
- Design form abstraction that supports dynamic schema generation and static typed forms
- Implement validation abstraction (Zod, Yup, Joi) decoupled from form library
- Architect wizard/multi-step forms with shared state across steps

---

## Core Content

### Two Form Paradigms

**Headless form state**: React Hook Form, Formik — library manages form state (values, errors, touched). Consumer renders fields manually. Full control over UI.

**Schema-driven forms**: Formio, JSON Forms, React JSON Schema Form — render entire form from JSON schema. Minimal control over UI. Fast for simple forms.

| Concern | React Hook Form | Formio |
|---------|----------------|--------|
| Rendering | Manual (consumer) | Auto (from schema) |
| Bundle impact | 10KB | ~200KB (includes renderer) |
| Custom fields | Any React component | Plugin via components |
| Dynamic forms | Conditional logic in code | Conditional logic in schema |
| Versioning | Not applicable | Schema versioned in DB |
| Accessibility | Consumer responsibility | Built-in |

Wrapper pattern: abstract form interface so consumer does not know which paradigm runs:

```typescript
interface FormContext<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  setValue: (field: keyof T, value: unknown) => void
  setError: (field: keyof T, message: string) => void
  submit: () => Promise<T>
  reset: (values?: T) => void
  isValid: boolean
  isSubmitting: boolean
}
```

RHF implementation wraps `useForm` + `Controller`. Formio implementation parses schema into same interface.

> **Think**: Formio schema can be stored in DB and rendered without code changes. RHF cannot. Should abstraction expose schema capability or keep it abstract?
>
> *Answer: Expose schema as optional. FormContext abstraction = form API. Schema rendering = separate concern. If app needs DB-driven forms, the form component accepts schema prop. If app builds forms in code, it does not.*

### Validation Abstraction

Validation logic should not couple to form library:

```typescript
// Domain validation — pure functions, no form library dependency
function validateUser(data: unknown): ValidationResult<UserData> {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    age: z.number().min(18).max(120)
  })
  const result = schema.safeParse(data)
  return result.success
    ? { valid: true, data: result.data }
    : { valid: false, errors: flattenZodErrors(result.error) }
}

// Adapter: converts domain validation to form library errors
function zodToRHF<T>(schema: ZodSchema<T>) {
  return (data: T) => {
    const result = schema.safeParse(data)
    if (result.success) return {}
    return flattenZodErrors(result.error)
  }
}
```

RHF resolver adapter: `resolver: zodResolver(schema)` — one import changes with form library.

> **Think**: Formio has built-in validation engine. Should you bypass it and use Zod? When?
>
> *Answer: Use built-in validation for simple rules (required, minLength, pattern). Use Zod for complex validation (cross-field, async, business rules). Formio supports custom validation via `custom` property that calls external validator.*

### Multi-Step (Wizard) Forms

Wizard forms share state across steps. State ownership depends on paradigm:

**RHF**: Single `useForm` instance persists across wizard steps. Each step renders subset of fields. `trigger()` validates per step.

**Formio**: Each step = separate form submission. State must pass via parent component or store.

Abstraction:

```typescript
interface WizardState<T> {
  currentStep: number
  totalSteps: number
  data: Partial<T>
  errors: Partial<Record<keyof T, string>>
  goNext: () => Promise<boolean>
  goBack: () => void
  setStepData: (step: number, data: Partial<T>) => void
  submit: () => Promise<T>
}

function useAppWizard<T>(steps: WizardStep<T>[]): WizardState<T> {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<Partial<T>>({})

  const goNext = useCallback(async () => {
    const valid = await steps[step].validate(data)
    if (!valid) return false
    if (step < steps.length - 1) { setStep(s => s + 1); return true }
    return false
  }, [step, data])

  const submit = useCallback(async () => {
    return steps[step].onSubmit(data)
  }, [step, data])

  return { currentStep: step, totalSteps: steps.length, data, goNext, goBack, submit }
}
```

Underlying form library implementation is hidden inside step configs.

> **Think**: Wizard with server-side validation per step requires submitting partial data. How to design step validation that works offline and online?
>
> *Answer: Two-tier validation. Client-side: Zod schema per step (synchronous, always runs). Server-side: POST step data, return field-level errors. Merge server errors into form errors. Wizard proceeds only after client AND server validation pass.*

### Dynamic Forms (Schema-Driven)

Server returns form schema, client renders without code change. Formio excels here.

Wrapper pattern for schema-driven forms:

```typescript
interface SchemaFormProps<T> {
  schema: FormSchema  // JSON Schema / Formio schema
  data?: Partial<T>
  onSubmit: (data: T) => void
  onError?: (errors: ValidationError[]) => void
  components?: Record<string, CustomComponent<T>>
  loading?: boolean
}
```

`FormSchema` type abstracts library-specific schema format:

```typescript
interface FormSchema {
  title?: string
  type: 'object'
  properties: Record<string, FieldSchema>
  required?: string[]
  layout?: LayoutDirective[]  // rows, columns, tabs
  conditions?: ConditionalRule[]
}
```

Mapper converts app schema to Formio/RJSF format. If Formio is replaced, only mapper changes.

> **Think**: Schema-driven forms trade UI control for development speed. When does the trade-off reverse?
>
> *Answer: Trade-off reverses when: (1) designers require pixel-perfect form layouts, (2) forms have complex conditional logic cross-field, (3) form UX needs custom animations or transitions. Schema-driven forms assume procedural layout; custom UI assumes declarative layout.*

### React 19 Actions Integration

React 19 introduces form Actions, which fundamentally change how form state is managed. `useActionState` (formerly `useFormState`) replaces manual `isSubmitting`/`error` state management with a reducer-like pattern:

```typescript
function UserForm() {
  const [state, formAction, isPending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await api.createUser(formData)
      return result.success
        ? { status: 'success', message: 'User created' }
        : { status: 'error', errors: result.fieldErrors }
    },
    { status: 'idle', errors: {} }
  )

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      {state.errors.email && <ErrorText>{state.errors.email}</ErrorText>}
      <button disabled={isPending} type="submit">
        {isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
```

React Hook Form adapts to Actions via `handleSubmit` wrapping the action function. The `useActionState` hook handles pending state, validation errors, and success/failure feedback — state that RHF manages manually:

```typescript
function RHFWithAction() {
  const { register, handleSubmit, formState: { errors } } = useForm<UserData>()
  const [state, formAction, isPending] = useActionState(submitUser, null)

  const onSubmit = (data: UserData) => {
    const formData = new FormData()
    Object.entries(data).forEach(([k, v]) => formData.append(k, v))
    formAction(formData)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email', { required: true })} />
      {errors.email && <span>{errors.email.message}</span>}
      {state?.status === 'error' && <Alert>{state.message}</Alert>}
      <button disabled={isPending} type="submit">
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

For Server Components, form validation can run on the server via `"use server"` actions, eliminating the need for client-side Zod resolvers:

```typescript
// server action
"use server"
async function validateUserSchema(prev: unknown, data: FormData) {
  const schema = z.object({ email: z.string().email(), name: z.string().min(2) })
  const parsed = schema.safeParse(Object.fromEntries(data))
  return parsed.success ? { status: 'success' } : { status: 'error', errors: parsed.error.flatten().fieldErrors }
}
```

`useOptimistic` provides instant feedback for form submissions by assuming success and rolling back on error. This pairs with Actions to create optimistic form UIs without additional state management:

```typescript
function OptimisticForm() {
  const [state, formAction, isPending] = useActionState(submitData, null)
  const [optimisticData, addOptimistic] = useOptimistic(
    currentData,
    (state, newData: FormData) => ({ ...state, ...Object.fromEntries(newData) })
  )

  return (
    <form action={formAction}>
      <p>Name: {optimisticData.name}</p>
      <input name="name" />
      <button type="submit" disabled={isPending}>Save</button>
      {state?.status === 'error' && <ErrorText>Failed: {state.message}</ErrorText>}
    </form>
  )
}
```

Compared to traditional RHF approach, React 19 Actions reduce boilerplate for form submission state, integrate natively with HTML forms (progressive enhancement), and move validation to the server when using Server Components.

---

### Why This Matters

Forms are the highest-churn UI in most apps. Every feature adds form fields. Every design iteration tweaks layout. Form library choice affects how fast you iterate, how much code you write, and how hard migration hurts. Abstraction lets you start with RHF (lightweight, flexible) and adopt Formio where dynamic schemas help, without rewriting all forms.

---

### Common Questions

**Q: Should all forms use the same form library?**
A: No. Use RHF for hand-crafted forms (complex layout, custom inputs). Use Formio for admin panels, survey tools, and user-configurable forms. Abstraction lets you mix both.

**Q: How to handle file uploads?**
A: Abstract behind `FileUploader` interface. RHF: `Controller` with custom dropzone. Formio: built-in file component with storage provider config. Wrapper: `accept`, `maxSize`, `multiple` props map to both.

---

## Examples

### Example 1: Multi-Vendor Checkout Form

**Problem**: Checkout form must support Stripe Elements (RHF integration) and a legacy Formio-generated form for custom fields.

**Solution**: Both implement `FormContext<CheckoutData>`. Checkout page uses context interface, not library directly:

```typescript
function CheckoutPage() {
  const paymentForm = useStripeRHF()
  const customForm = useFormio('checkout-extras')

  const handleSubmit = async () => {
    const paymentValid = await paymentForm.trigger()
    const customValid = await customForm.trigger()
    if (!paymentValid || !customValid) return
    await api.submitCheckout({
      ...paymentForm.getValues(),
      ...customForm.getValues()
    })
  }

  return (
    <div>
      <RHFWrapper context={paymentForm}>
        <StripeCardElement />
      </RHFWrapper>
      <FormioWrapper context={customForm} />
    </div>
  )
}
```

### Example 2: Admin Form Builder

**Problem**: Admin builds forms via drag-drop UI, saved as JSON schema, rendered on customer-facing site.

**Solution**: Formio for builder and renderer. Abstraction layer captures schema format. If Formio is replaced, builder and renderer both implement the same `FormSchema` interface.

---

## Key Takeaways
- Headless (RHF) vs schema-driven (Formio): different paradigms, same form context interface possible
- Validate with Zod/Yup — adapt to form library via resolver/adapter pattern
- Wizard forms: single state shared across steps, library-hidden inside step configs
- Dynamic forms: abstract schema type so library-specific format lives inside wrapper
- Mix paradigms: RHF for complex UIs, Formio for admin/survey forms, both behind same FormContext

## Common Misconception

**"React Hook Form works best with uncontrolled inputs."**

RHF uses uncontrolled inputs internally for performance, but `Controller` wrapper makes controlled components (MUI TextField, AntD Input) work correctly. The controlled/uncontrolled distinction matters for library wiring, not for form abstraction. Consumers should not know whether a field is controlled or uncontrolled.

---

## Feynman Explain
(Explain the difference between "building forms with code" and "building forms with a schema" to a product manager. Use recipe analogy: cooking from recipe vs assembling from IKEA instructions.)

---

## Reframe
(Pause. Schema-driven forms reduce developer effort but increase designer frustration. When does Formio's schema renderer create more work than hand-building forms? Consider: pixel-perfect designs, complex animations, accessibility customization.)

---

## Drill
Take the quiz. MCQs test paradigm selection, validation abstraction, wizard state patterns, and schema-driven vs code-driven form trade-offs.

Run: `learn.sh quiz external-lib-patterns 03-form-libraries`

## Quiz: 03-form-libraries


### Which form paradigm gives the most control over field layout and styling?

- [ ] A: Schema-driven (Formio, JSON Forms)

- [✓] B: Headless (React Hook Form, Formik)

- [ ] C: Template-driven (Angular Forms)

- [ ] D: Both A and B give equal control


**Answer:** B

Headless form libraries manage state only. Consumer renders every field, controls layout, styling, and behavior. Schema-driven libraries auto-render from JSON schema, limiting layout control.


### When should you choose Formio over React Hook Form?

- [ ] A: Always — Formio is more powerful

- [✓] B: When forms are schema-driven, stored in DB, or configured by non-developers

- [ ] C: When bundle size must be minimal

- [ ] D: When you need custom field validation


**Answer:** B

Formio excels at dynamic forms rendered from persisted schemas — admin panels, surveys, user-configurable forms. RHF excels at lightweight, custom-layout forms.


### How should validation logic be structured to remain form-library-agnostic?

- [ ] A: Use built-in validation of chosen form library

- [✓] B: Define validation as pure functions with typed input/output, adapt to form library via resolver

- [ ] C: Duplicate validation in both form library and backend

- [ ] D: Skip client validation — server only


**Answer:** B

Pure validation functions (Zod schema, custom validator) have no form library dependency. Adapter converts result to library-specific format (RHF resolver, Formio custom validation). Swap adapter when library changes.


### A wizard form uses RHF internally. How does state persist across wizard steps?

- [ ] A: Each step has independent state — merge on final submit

- [✓] B: Single useForm instance shared across all steps — each step renders subset of fields

- [ ] C: Store state in URL search params

- [ ] D: Wizard state is managed by a separate library (e.g., Zustand)


**Answer:** B

Single useForm instance holds all fields. Each step calls register() for its subset of fields. trigger() validates current step. Final submit calls handleSubmit() with all fields.


### What is the primary cost of schema-driven forms?

- [ ] A: More code to write

- [✓] B: Limited layout control and larger bundle size

- [ ] C: Cannot validate inputs

- [ ] D: Does not support accessibility


**Answer:** B

Schema-driven forms trade layout flexibility for automation. Formio bundle is ~200KB. Custom layouts require renderer customization or component overrides. Accessibility depends on renderer quality.


### Validation needs cross-field rules (e.g., endDate > startDate). Which approach works for both RHF and Formio?

- [ ] A: Only RHF supports cross-field validation

- [✓] B: Define cross-field rule in Zod/yup schema — both RHF resolver and Formio custom validation can call it

- [ ] C: Cross-field validation is server-only

- [ ] D: Formio cannot validate cross-field


**Answer:** B

Pure validation function (Zod refine, yup.test) works in both. RHF calls via resolver. Formio calls via onSubmit custom validation handler. Write once, adapt twice.


### Form interface FormContext<T> abstracts form state. What is its main benefit?

- [ ] A: Reduces bundle size

- [✓] B: Lets consumers switch form library without changing form interaction code

- [ ] C: Improves TypeScript inference

- [ ] D: Auto-generates form validation


**Answer:** B

FormContext<T> standardizes form operations (setValue, submit, errors, isValid). Components depend on context interface, not library-specific hooks. Change library: provide new FormContext implementation.


### A multi-step form needs server validation per step. How to design?

- [ ] A: Submit all steps at once — server validates everything

- [✓] B: Two-tier validation: client-side Zod per step + server validation on step POST, merge errors back

- [ ] C: Skip client-side validation — server validates each step

- [ ] D: Validate only on final submit — no per-step validation


**Answer:** B

Client-side validation provides instant feedback. Server validation per step catches business rule violations. Merged errors let user fix per-step issues before proceeding. Both validations must pass for step to advance.


### Which pattern lets you mix headless and schema-driven forms in same app?

- [✓] A: Wrap both behind same FormContext interface

- [ ] B: Use only one form library per app

- [ ] C: Use iframes to isolate form paradigms

- [ ] D: Convert all forms to schema-driven


**Answer:** A

FormContext abstraction hides implementation. RHF and Formio both implement FormContext. Consumer components use FormContext regardless of which library runs which form.


### A designer wants fine control over form field placement across multiple columns. Which form paradigm fits best?

- [ ] A: Schema-driven — columns defined in JSON layout

- [✓] B: Headless — consumer renders fields in CSS Grid with full layout control

- [ ] C: Neither — forms cannot support multi-column layouts

- [ ] D: Both equally support any layout


**Answer:** B

Headless forms give consumer full layout control (CSS Grid, Flexbox, custom breakpoints). Schema-driven forms have opinionated layout engines that make pixel-perfect multi-column layouts difficult without customization.


---

# Module 4: Drag & Drop — dnd-kit

Est. study time: 2h
Language: en

## Learning Objectives
- Design DnD abstraction compatible with dnd-kit, react-beautiful-dnd, and Pragmatic DnD
- Implement sortable lists, multi-container DnD, and drag overlays with clean separation
- Manage DnD state (order, placement) external to library
- Architect accessible DnD with keyboard navigation and screen reader support

---

## Core Content

### DnD Library Landscape

| Library | Bundle | API Style | Key Feature |
|---------|--------|-----------|-------------|
| dnd-kit | ~15KB | Hooks + Providers | Modular, accessible, tree DnD |
| @hello-pangea/dnd | ~12KB | Component | Fork of react-beautiful-dnd, simpler API |
| Pragmatic DnD (Atlassian) | ~20KB | Hooks + Inspector | First-class table DnD, cross-frame |
| react-beautiful-dnd | ~11KB | Component | Deprecated — no longer maintained |

dnd-kit is current best choice: active maintenance, flexible API, accessibility built-in.

### Core dnd-kit Architecture

dnd-kit uses three primitives:

- `DndContext`: Provider that manages drag state
- `useDraggable`: Makes element draggable
- `useDroppable`: Makes element droppable
- `useSortable`: Combines draggable + droppable for sortable lists (most common)

```typescript
// Direct usage (before abstraction)
function SortableList() {
  const [items, setItems] = useState(['A', 'B', 'C'])
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(items => arrayMove(items, items.indexOf(active.id), items.indexOf(over.id)))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map(id => <SortableItem key={id} id={id} />)}
      </SortableContext>
      <DragOverlay />
    </DndContext>
  )
}
```

### Wrapper Abstraction

app-level DnD abstraction:

```typescript
type DnDItem = { id: string; [key: string]: unknown }

interface DnDState {
  items: DnDItem[]
  activeId: string | null
  overId: string | null
}

interface DnDActions {
  onDragStart: (id: string) => void
  onDragEnd: (result: { source: { index: number; container: string }; destination: { index: number; container: string } | null }) => void
  onDragCancel: () => void
}
```

Wrapper maps dnd-kit events to app-level DnDState:

```typescript
function useAppDnD(items: DnDItem[], onReorder: (items: DnDItem[]) => void) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    onReorder(arrayMove(items, oldIndex, newIndex))
  }, [items, onReorder])

  return { activeId, handleDragStart, handleDragEnd }
}
```

Consumer: `const { activeId, handleDragStart, handleDragEnd } = useAppDnD(items, setItems)`. Library detail hidden.

> **Think**: `useAppDnD` returns dnd-kit's `DragStartEvent` and `DragEndEvent` types. Is this a leaky abstraction?
>
> *Answer: Yes — but pragmatically necessary. Wrapping every event property would create mirror interface that adds no value. Better: expose minimal normalized event shape (`{ id, overId, activatorEvent }`) inside wrapper.*

### Multi-Container DnD (Kanban)

Kanban boards have multiple containers. dnd-kit handles via multiple `SortableContext`s + collision detection:

```typescript
interface KanbanState {
  containers: Record<string, DnDItem[]>
  containerOrder: string[]
}

function KanbanBoard() {
  const [state, setState] = useState<KanbanState>({ containers: { backlog: [], progress: [], done: [] }, containerOrder: ['backlog', 'progress', 'done'] })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const overContainer = over.data.current?.container ?? state.containerOrder[0]
    // Move item between or within containers
    setState(/* reorder logic */)
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {state.containerOrder.map(id => (
        <SortableContext key={id} items={state.containers[id]} strategy={verticalListSortingStrategy}>
          {state.containers[id].map(item => <SortableItem key={item.id} id={item.id} />)}
        </SortableContext>
      ))}
    </DndContext>
  )
}
```

Abstraction: `useKanbanDnD(containers, onContainerMove, onItemMove, onContainerReorder)`.

### Accessibility

dnd-kit has built-in keyboard sensor. Screen reader announcements via `DndContext.announcements`.

Abstraction should not regress accessibility:

```typescript
<DndContext
  sensors={sensors}
  announcements={{
    onDragStart: (id) => `Started dragging item ${id}`,
    onDragOver: (id) => `Item ${id} was dragged over a droppable area`,
    onDragEnd: (id, over) => over
      ? `Item ${id} was dropped in position ${over.id}`
      : `Item ${id} was dropped. No destination`,
    onDragCancel: (id) => `Dragging was cancelled. Item ${id} returned to starting position`
  }}
  screenReaderInstructions={{
    draggable: 'Press space to start dragging. Use arrow keys to move. Press escape to cancel.'
  }}
>
```

Wrapper defaults sensible announcements. Consumers override if needed.

> **Think**: Screen reader support for DnD is often afterthought. Does DnD abstraction help or hurt accessibility by default?
>
> *Answer: Helps — if wrapper defaults to accessible configuration (keyboard sensor enabled, announcements set). Hurts — if wrapper strips dnd-kit's accessible defaults for simplicity. Always include accessibility in wrapper API.*

### Drag Overlay and Custom Feedback

Drag overlay shows item while dragging. dnd-kit's `DragOverlay` renders on top of everything via portal.

```typescript
function AppDragOverlay({ activeId, renderItem }: { activeId: string | null; renderItem: (id: string) => ReactNode }) {
  if (!activeId) return null
  return createPortal(
    <DragOverlay dropAnimation={dropAnimationConfig}>
      {renderItem(activeId)}
    </DragOverlay>,
    document.body
  )
}
```

Abstraction: wrapper includes `DragOverlay` with default drop animation. Consumer passes `renderItem`.

### React 19 Integration

React 19's ref as prop (forwardRef deprecated) simplifies accessing DnD sensor refs and imperative handles. Drag handlers previously wrapped in `useCallback` can benefit from React Compiler's auto-memoization — callbacks are memoized automatically, reducing unnecessary re-renders in drag-heavy UIs:

```typescript
function SortableList({ items }: { items: Item[] }) {
  const [ordered, setOrdered] = useState(items)

  // React Compiler auto-memoizes — no useCallback needed
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ordered.findIndex(i => i.id === active.id)
    const newIndex = ordered.findIndex(i => i.id === over.id)
    setOrdered(arrayMove(ordered, oldIndex, newIndex))
  }

  return (
    <div ref={ref}>
      <DndContext onDragEnd={handleDragEnd}>
        ...
      </DndContext>
    </div>
  )
}
```

`useTransition` wraps drag-end state updates as low-priority, keeping drag interactions responsive during expensive re-renders:

```typescript
function KanbanBoard() {
  const [isPending, startTransition] = useTransition()

  function handleDragEnd(event: DragEndEvent) {
    startTransition(() => {
      // Reorder items — deferred until drag animation completes
      setItems(computeNewOrder(event, items))
    })
  }

  return (
    <div style={{ opacity: isPending ? 0.8 : 1 }}>
      <DndContext onDragEnd={handleDragEnd}>...</DndContext>
    </div>
  )
}
```

For sortable lists backed by async data (e.g., fetched from API), wrap the list in a `Suspense` boundary so loading state does not cascade into drag operations:

```typescript
function AsyncSortablePage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SortableList items={use(fetchItems())} />
    </Suspense>
  )
}
```

---

### Why This Matters

DnD libraries change faster than most UI libraries. react-beautiful-dnd (most popular) is deprecated. dnd-kit has breaking API changes between majors. Pragmatic DnD is new and evolving. Good DnD abstraction lets you migrate between libraries in days, not weeks.

---

### Common Questions

**Q: dnd-kit vs @hello-pangea/dnd — which to wrap?**
A: dnd-kit is more flexible (tree DnD, multiple containers, custom collision detection). @hello-pangea/dnd is simpler (one pattern: sortable list). Wrap dnd-kit — if you need simpler API, build convenience layer on top.

**Q: How to handle DnD within a virtualized list?**
A: dnd-kit + TanStack Virtual: measure item sizes, use `MeasuringStrategy.Always` for dynamic heights. dnd-kit's `LayoutMeasuring` strategy must match virtualizer's measurement.

---

## Examples

### Example 1: Settings Panel with Reorderable Rows

**Problem**: App settings list of rules. User reorders by drag. Must save order to backend.

**Solution**:
```typescript
function RuleList() {
  const [rules, setRules] = useState<Rule[]>([])
  const { activeId, handleDragStart, handleDragEnd } = useAppDnD(rules, setRules)

  useEffect(() => {
    if (reorderMutation.isSuccess) { /* optimistic update done */ }
  }, [reorderMutation.isSuccess])

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} sensors={sensors}>
      <SortableContext items={rules} strategy={verticalListSortingStrategy}>
        {rules.map(rule => <SortableRule key={rule.id} rule={rule} />)}
      </SortableContext>
      <AppDragOverlay activeId={activeId} renderItem={id => <RulePreview rule={rules.find(r => r.id === id)} />} />
    </DndContext>
  )
}
```

### Example 2: Kanban Board with Persistence

**Problem**: Task board. Drag tasks between columns. Reorder columns. Persist to backend.

**Solution**: `useKanbanDnD` manages kanban state. Save on debounce: `useEffect(() => { const t = setTimeout(() => api.saveBoard(state), 1000); return () => clearTimeout(t) }, [state])`.

---

## Key Takeaways
- dnd-kit is current best choice — modular, accessible, active maintenance
- Abstract DnD state (activeId, overId, items) outside library internals
- Multi-container DnD (kanban): separate SortableContext per container, manage item movement in DragEnd handler
- Accessibility: enable keyboard sensor, set announcements, provide screen reader instructions
- Drag Overlay: portal-based, wrapper defaults drop animation, consumer provides renderItem

## Common Misconception

**"DnD is only about reordering lists."**

DnD covers: sortable lists, kanban boards, resizable panels, draggable elements between containers, file drop zones, tree reordering, and cross-window DnD. dnd-kit's modular sensor system and collision detection handle all these. Your abstraction should not assume list-only use cases.

---

## Feynman Explain
(Explain dnd-kit's sensor system and collision detection to a colleague who only knows react-beautiful-dnd. How is modularity better than single-component API?)

---

## Reframe
(Pause. DnD adds complexity — drag overlays, sensor configuration, collision detection. When should a sortable list use simple up/down buttons instead of drag? Consider: mobile support, accessibility compliance, development timeline.)

---

## Drill
Take the quiz. MCQs test library selection, wrapper design, multi-container DnD, and accessibility.

Run: `learn.sh quiz external-lib-patterns 04-drag-and-drop`

## Quiz: 04-drag-and-drop


### Which DnD library is currently recommended for new projects?

- [ ] A: react-beautiful-dnd

- [✓] B: dnd-kit

- [ ] C: jQuery UI Sortable

- [ ] D: HTML Drag and Drop API


**Answer:** B

dnd-kit is actively maintained, modular, accessible, and supports complex DnD (tree, kanban). react-beautiful-dnd is deprecated. jQuery UI is legacy. HTML Drag and Drop API has inconsistent browser support and poor accessibility.


### What is the primary purpose of dnd-kit's DragOverlay?

- [ ] A: Highlights valid drop targets

- [✓] B: Renders a portal-based preview of dragged item on top of all content

- [ ] C: Provides keyboard navigation for drag operations

- [ ] D: Animates items after drop


**Answer:** B

DragOverlay renders a copy of the dragged item via portal, tracking cursor position. This lets the original item remain in place (or show placeholder) while dragged copy floats above everything.


### How does dnd-kit implement keyboard-accessible DnD?

- [✓] A: KeyboardSensor — maps arrow keys to drag movement

- [ ] B: Keyboard DnD is not supported

- [ ] C: Uses native HTML5 drag and drop keyboard support

- [ ] D: Separate ARIA buttons for move up/down


**Answer:** A

dnd-kit's KeyboardSensor lets users activate drag with Space/Enter, move with arrow keys, cancel with Escape. UseSensors composes PointerSensor + KeyboardSensor.


### In a kanban board with multiple SortableContexts, how does dnd-kit determine which container receives a dropped item?

- [✓] A: Uses collision detection algorithms (closestCenter, closestCorners, pointerWithin)

- [ ] B: Each container is a separate DndContext

- [ ] C: Developer must manually check coordinates

- [ ] D: Multiple SortableContexts are not supported


**Answer:** A

Collision detection (closestCenter, closestCorners, pointerWithin) identifies target container based on pointer position relative to droppable areas. Multiple SortableContexts share one DndContext for cross-container moves.


### How to announce DnD state changes to screen readers in dnd-kit?

- [ ] A: Cannot — dnd-kit does not support screen readers

- [✓] B: Via DndContext.announcements prop — maps dragStart/dragOver/dragEnd/dragCancel to messages

- [ ] C: Screen readers automatically detect drag operations

- [ ] D: Use aria-live region manually controlled


**Answer:** B

DndContext.announcements is a map of lifecycle events to screen reader messages. Customize per app context (e.g., 'Moved column 3 to position 5').


### DnD wrapper exposes onDragEnd handler with dnd-kit's DragEndEvent type. What abstraction concern?

- [ ] A: Good — exposes full library capability

- [✓] B: Leaky abstraction — consumer depends on library types

- [ ] C: DragEndEvent is standard — no abstraction issue

- [ ] D: Should use any type to avoid coupling


**Answer:** B

Exposing library-specific event types couples consumer to dnd-kit. Better: normalize to app-level shape like `{ activeId, overId, sourceIndex, destIndex }`. Library change then only affects wrapper internals.


### How to handle drag within a virtualized list (TanStack Virtual)?

- [ ] A: Virtualized lists cannot support DnD

- [✓] B: Align dnd-kit's MeasuringStrategy with virtualizer's measurement. Use Always strategy for dynamic heights

- [ ] C: Disable virtualization during drag

- [ ] D: Use react-beautiful-dnd instead — it handles virtualization natively


**Answer:** B

dnd-kit measures item layout. Virtualizer also measures. Conflicting measurements cause jumpy drag. Use `MeasuringStrategy.Always` in dnd-kit and ensure both use same item size calculations.


### What is the relationship between DndContext and SortableContext in dnd-kit?

- [ ] A: SortableContext replaces DndContext

- [✓] B: DndContext provides drag infrastructure; SortableContext configures sortable behavior for a group of items

- [ ] C: They are mutually exclusive

- [ ] D: SortableContext provides collision detection; DndContext provides sensors


**Answer:** B

One DndContext wraps entire drag region. Multiple SortableContexts inside define sortable groups (lists/columns). DndContext handles sensors, collision detection, lifecycle. SortableContext handles item ordering strategy.


### When would you choose up/down buttons over drag-and-drop for reordering?

- [ ] A: When mobile support is required

- [ ] B: When accessibility compliance requires keyboard-only operation

- [✓] C: For simple lists where DnD's overhead (drag overlay, sensor config, collision detection) is not justified

- [ ] D: Never — drag-and-drop is always better UX


**Answer:** C

For simple reordering (short lists, admin CRUD), up/down buttons are simpler to implement and fully accessible. DnD's overhead is justified for: visual canvas, kanban, resizable panels, or user expectation of drag.


### A wrapper includes DndContext with keyboard sensor but no announcements. What issue?

- [ ] A: No issue — keyboard sensor alone provides accessibility

- [✓] B: Keyboard sensor without announcements means screen reader users get no feedback on drag state changes

- [ ] C: Announcements are only for pointer drag

- [ ] D: Keyboard sensor requires announcements to function


**Answer:** B

Keyboard sensor enables keyboard operation. Announcements provide feedback ('dragging item X', 'dropped at position Y'). Without announcements, screen reader users do not know what happened during drag.


---

# Module 5: Rich Text Editors — TipTap & Lexical

Est. study time: 2.5h
Language: en

## Learning Objectives
- Architect editor wrapper supporting multiple rich text engines
- Design extension system (custom nodes, marks, plugins) library-agnostic
- Implement controlled vs uncontrolled editing with external state management
- Handle collaborative editing, mentions/autocomplete, and custom UI overlays

---

## Core Content

### Editor Engine Comparison

| Feature | TipTap (ProseMirror) | Lexical (Meta) | Slate | Quill 2 |
|---------|---------------------|----------------|-------|---------|
| Architecture | ProseMirror wrapper | Custom editor | React-first | Iframe-based |
| State model | Immutable (steps) | Immutable (updates) | Immutable | Mutable DOM |
| Extension model | Node/Mark/Plugin | Nodes/Plugins | Render elements | Formats/modules |
| Custom node complexity | High | Medium | High | Low |
| Bundle | ~60KB | ~40KB | ~80KB | ~50KB |
| Collaboration | Y.js (separate) | Built-in (>=0.12) | Y.js | OT (separate) |
| Learning curve | Steep (PM concept) | Moderate | Steep | Low |

**TipTap**: Best for complex editing (collaborative, custom document structure). Heavier learning curve.

**Lexical**: Best for modern apps needing custom text editing without ProseMirror complexity. Active development.

### Controlled vs Uncontrolled

Editors store internal document state. Controlled mode: app owns state, editor is display component. Uncontrolled: editor owns state, app reads value on demand.

```typescript
type EditorMode = 'controlled' | 'uncontrolled'

interface AppEditorProps {
  mode?: EditorMode
  value?: EditorDocument  // required in controlled mode
  onChange?: (doc: EditorDocument) => void  // required in controlled
  defaultValue?: EditorDocument  // used in uncontrolled
  extensions?: AppExtension[]
  readOnly?: boolean
  placeholder?: string
}
```

**Controlled**: App stores `EditorDocument` in state. Editor calls `onChange` on every mutation. Enables undo/redo outside editor, saves drafts, syncs to URL or store.

**Uncontrolled**: Editor manages state. App reads via ref or `onBlur`. Simpler for forms where editor value is submitted on save.

Abstraction: convert internal editor document to normalized format:

```typescript
type EditorDocument = {
  type: 'doc'
  content: EditorNode[]
}

type EditorNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: EditorNode[]
  text?: string
  marks?: EditorMark[]
}

type EditorMark = {
  type: string
  attrs?: Record<string, unknown>
}
```

TipTap ↔ Lexical mappers convert between this format and library-specific document models.

> **Think**: Converting between editor formats loses information (fine-grained formatting, custom node data). When is normalized document model worth the lossy conversion?
>
> *Answer: Worth it when: (1) app stores documents in DB and may change editor, (2) app renders editor content outside editor (preview, export). Not worth it when: editing is internal-only and migration is unlikely.*

### Extension System

TipTap extensions are ProseMirror plugins. Lexical extensions are nodes + plugins. Abstraction:

```typescript
interface AppExtension {
  name: string
  type: 'node' | 'mark' | 'plugin'
  schema?: NodeSpec | MarkSpec
  commands?: Record<string, (...args: unknown[]) => CommandFn>
  shortcuts?: Record<string, string>
}

// TipTap adapter
function toTipTapExtension(ext: AppExtension): Extension {
  return Extension.create({
    name: ext.name,
    addCommands: () => ext.commands ?? {},
    addKeyboardShortcuts: () => ext.shortcuts ?? {}
  })
}

// Lexical adapter
function toLexicalNode(ext: AppExtension): LexicalNode {
  // Map AppExtension to Lexical node/plugin
}
```

Built-in extensions bundled in wrapper: bold, italic, underline, heading, bulletList, orderedList, link, image, code, blockquote.

> **Think**: Custom extensions contain business logic (e.g., @mention suggests users, #tag links to issues). Where does extension logic live — inside wrapper or outside?
>
> *Answer: Extension definition lives outside wrapper (app concern). Wrapper provides `registerExtension` interface. Extension adapter (toTipTap/toLexical) lives inside wrapper. This separates "what the extension does" from "how the editor registers it."*

### Mentions & Autocomplete

Both libraries handle mentions differently:

| Concern | TipTap | Lexical |
|---------|--------|---------|
| Trigger | `@` character | `@` character (customizable) |
| Suggestions | Separate UI component | Inline menu plugin |
| Mentions store | Suggestion plugin | `MentionNode` + custom logic |
| Async filter | By suggestion plugin | Manual |

Abstraction: `MentionProvider` interface:

```typescript
interface MentionProvider {
  search(query: string, context?: MentionContext): Promise<MentionItem[]>
  format(mention: MentionItem): MentionNodeData
}

interface MentionItem {
  id: string
  label: string
  description?: string
  avatar?: string
  type: 'user' | 'issue' | 'tag'
}

interface MentionNodeData {
  id: string
  label: string
  type: string
}
```

Wrapper wires MentionProvider to editor-specific mention mechanism. Consumer implements provider once.

### Collaborative Editing

**TipTap**: Uses Y.js (CRDT) via `@tiptap/y` and `y-websocket`/`y-partykit`.

**Lexical**: Built-in collaboration in v0.12+ via `@lexical/yjs`.

Abstraction:

```typescript
interface CollaborationConfig {
  provider: 'y-websocket' | 'y-partykit' | 'liveblocks' | 'custom'
  endpoint: string
  room: string
  user: { name: string; color: string }
  onAwarenessChange?: (users: AwarenessUser[]) => void
}
```

Wrapper initializes Y.js document, connects provider, binds to editor instance. Consumer configures endpoint and room. If app switches editor, collab config shape stays the same.

> **Think**: Collaborative editing changes editor architecture from "single user edits document" to "multiple users edit document concurrently." How does abstraction help in collab migration?
>
> *Answer: CRDT logic (Y.js document, awareness, undo/redo) is shared between TipTap and Lexical. Wrapper abstracting collab setup means the collab service, awareness UI, and user presence logic remain unchanged when editor changes.*

### React 19 Integration

React 19 deprecates `forwardRef` — `ref` is now a regular prop. Rich text editors commonly expose imperative APIs (focus, getHTML, insertContent, getJSON). Previously wrapped in `forwardRef`, these now use `ref` directly:

```typescript
function TipTapEditor({ ref, content, extensions }: EditorProps & { ref?: React.Ref<EditorAPI> }) {
  const editorRef = useRef<Editor>(null)

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.commands.focus(),
    getContent: () => editorRef.current?.getJSON(),
    insertContent: (html: string) => editorRef.current?.chain().insertContent(html).run()
  }))

  return <EditorContent ref={editorRef} editor={editorRef.current} />
}
```

Rich text editors are inherently client-only — they depend on DOM APIs, selection APIs, and browser events. In Server Components, the editor wrapper must declare `"use client"` and be imported via dynamic import with `ssr: false`:

```typescript
// page.tsx (Server Component)
import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('./EditorWrapper'), { ssr: false })

export default function Page() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <Editor />
    </Suspense>
  )
}
```

For collaborative editing, `useOptimistic` provides instant local feedback while remote changes propagate. When a user edits collaboratively, their changes appear immediately in the local document model while the Y.js sync happens in the background:

```typescript
function CollaborativeEditor({ room, user }: CollabProps) {
  const [doc, setDoc] = useState<EditorDocument>(initialDoc)
  const [optimisticDoc, addOptimisticEdit] = useOptimistic(
    doc,
    (current, edit: EditorEdit) => applyEditLocal(current, edit)
  )

  function handleLocalEdit(edit: EditorEdit) {
    addOptimisticEdit(edit)
    yDoc.transact(() => applyYjsEdit(yDoc, edit))
  }

  return <EditorView doc={optimisticDoc} onEdit={handleLocalEdit} />
}
```

Concurrent rendering (React 19) improves large document performance by splitting rendering into interruptible chunks. Editors with thousands of nodes benefit from `useTransition` for expensive operations (search-and-replace, syntax highlighting, document transformations) — these run as low-priority updates without blocking user input:

```typescript
function useSearchReplace(editor: Editor | null) {
  const [isPending, startTransition] = useTransition()

  const replaceAll = useCallback((find: string, replace: string) => {
    startTransition(() => {
      editor?.chain().search(find).replace(replace).run()
    })
  }, [editor])

  return { replaceAll, isReplacing: isPending }
}
```

---

### Why This Matters

Rich text editors are the most integrated third-party component in most apps. Mentions, embeds, collaboration, custom blocks, slash commands — each ties deeply into app logic. Editor migration (TipTap → Lexical) is a 3-6 month project without abstraction. With clean editor abstraction and extension mapping, it becomes 2-4 weeks.

---

### Common Questions

**Q: Should I normalize editor output to HTML or JSON?**
A: JSON (structured data). HTML loses semantic information (what is a "mention" vs plain linked text?). HTML is for rendering; JSON is for storage. Convert JSON to HTML in preview/export, not vice versa.

**Q: How to handle image uploads in editor?**
A: Abstract behind `UploadHandler` interface. TipTap: `Image.configure({ upload: handler })`. Lexical: `ImageNode` with custom upload plugin. Same interface, different wiring.

---

## Examples

### Example 1: Rich Comment Box with @Mentions

**Problem**: Comment editor needs bold, italic, @mention users, #link issues, slash commands.

**Solution**: `AppEditor` wrapper with `MentionProvider` for users and issues. Extensions: bold, italic, mention, issue-link, slash-command. Output: JSON stored in DB, rendered via `AppEditorPreview` (converts JSON to HTML).

### Example 2: Document Editor with Collaboration

**Problem**: Collaborative document editor used by 500 concurrent users. Needs conflict resolution, presence awareness, offline support.

**Solution**: TipTap (mature Y.js integration) + y-partykit for WebSocket. Wrapper configures `CollaborationConfig`. When app needs offline, add y-indexeddb persistence provider — no editor code changes.

---

## Key Takeaways
- TipTap (complex, collaborative) vs Lexical (modern, lighter). Abstraction supports both.
- Controlled mode: app owns document state. Uncontrolled: editor owns state. Abstraction supports both.
- Normalized document model (JSON) prevents editor lock-in. Mapping is lossy — trade precision for portability.
- Extension abstraction: app writes extension schema/commands once, wrapper maps to editor-specific format.
- MentionProvider interface isolates autocomplete logic from editor library.
- Collaborative editing setup (Y.js, provider, awareness) is shared between editors — abstract it.

## Common Misconception

**"Rich text editors output HTML, so store HTML."**

HTML is a rendering format, not a data format. HTML cannot distinguish between "bold text" and "heading level 3 bold" — both are `<strong>` inside different container elements. JSON preserves semantic structure. Store JSON, render HTML. This also prevents XSS attacks that HTML storage enables.

---

## Feynman Explain
(Explain ProseMirror's "immutable state" model to a React developer familiar with useState. How is editor state different from React state? Why does every keystroke produce a new state snapshot?)

---

## Reframe
(Pause. Rich text editors add enormous complexity. For many apps, a Markdown textarea or Notion-style block editor (using Slate/Lexical) suffices. When should you avoid rich text entirely? Consider: mobile editing experience, accessibility for complex editing, storage format decisions.)

---

## Drill
Take the quiz. MCQs test editor selection, controlled vs uncontrolled, extension abstraction, mentions, and collaboration.

Run: `learn.sh quiz external-lib-patterns 05-rich-text-editors`

## Quiz: 05-rich-text-editors


### Which editor engine is best suited for complex collaborative document editing?

- [ ] A: Lexical — built-in collaboration

- [✓] B: TipTap (ProseMirror) — mature Y.js integration and complex node support

- [ ] C: Quill 2 — simplest API

- [ ] D: ContentEditable directly — no library overhead


**Answer:** B

TipTap's ProseMirror foundation has most mature Y.js collaboration, custom node support (tables, embeds, code blocks), and battle-tested in production editors (Notion-style apps). Lexical collab is newer.


### Why should editor content be stored as JSON, not HTML?

- [ ] A: JSON is smaller than HTML

- [✓] B: HTML loses semantic structure (e.g., cannot distinguish bold-in-heading from bold-in-paragraph)

- [ ] C: JSON renders faster

- [ ] D: HTML cannot represent mentions or custom nodes


**Answer:** B

HTML is a rendering format — it loses structural semantics. JSON preserves node types, marks, attributes. HTML storage also risks XSS. Store JSON, render to HTML for display.


### In controlled editor mode, who owns the document state?

- [ ] A: Editor — app reads value via ref on demand

- [✓] B: App — editor calls onChange on every mutation, app feeds value prop back

- [ ] C: Both — state is synced via two-way binding

- [ ] D: Neither — state lives in URL


**Answer:** B

Controlled mode: app stores document state (e.g., useState). Editor is passive — receives value prop, fires onChange. App filters, debounces, or saves onChange as needed.


### How should custom mentions (e.g., @user) be abstracted across editors?

- [ ] A: Implement per-editor — too different to abstract

- [✓] B: MentionProvider interface — wrapper wires to editor-specific mechanism

- [ ] C: Skip abstraction — mentions are UI-only

- [ ] D: Use HTML data attributes — universal across editors


**Answer:** B

MentionProvider defines search/format contract. TipTap adapter uses Suggestion plugin. Lexical adapter uses MentionNode + custom logic. Consumer implements MentionProvider once.


### What does TipTap's extension model add over Lexical extensions?

- [✓] A: TipTap extensions can modify ProseMirror schema, input rules, paste rules, and keymaps — full ProseMirror power

- [ ] B: TipTap extensions are simpler than Lexical

- [ ] C: TipTap does not have extensions — only nodes

- [ ] D: Lexical extensions are more powerful


**Answer:** A

TipTap extensions are ProseMirror plugins with schema, input rules, paste rules, keymaps, commands, shortcuts, and lifecycle hooks. Lexical nodes/plugins are simpler but less extensible for complex document behavior.


### A normalized EditorDocument model is lossy — some editor-specific features do not map. When is this acceptable?

- [ ] A: Never — lossy conversion corrupts data

- [✓] B: When app stores documents in DB and may migrate editors later

- [ ] C: Always — lossless conversion is impossible

- [ ] D: Only for preview rendering, not for storage


**Answer:** B

Lossy normalization is acceptable for storage portability. Features unique to current editor (custom node types, plugin data) can be stored in an 'extra' field on the normalized schema. Trade precision for migration flexibility.


### Which editor supports collaborative editing via Y.js?

- [ ] A: TipTap only

- [✓] B: Both TipTap and Lexical (Lexical >=0.12)

- [ ] C: Lexical only

- [ ] D: Neither — Y.js is a separate framework


**Answer:** B

TipTap uses @tiptap/y for Y.js integration. Lexical v0.12+ has @lexical/yjs for Y.js. Collaboration config (provider, room, awareness) can be abstracted across both.


### Where should custom extension logic (e.g., @mention querying users) live?

- [ ] A: Inside editor wrapper — editor concern

- [✓] B: Outside wrapper in app code — extension definition is app concern, wrapper provides registration interface

- [ ] C: In the backend — frontend should only display results

- [ ] D: Custom extensions cannot be abstracted


**Answer:** B

Extension definition (what it does) is app logic. Wrapper provides registerExtension(type, adapter) interface. Adapter (how editor registers it) is wrapper concern. Clear separation.


### Should image upload logic live inside editor wrapper?

- [ ] A: Yes — editor handles upload

- [✓] B: No — UploadHandler interface injected into wrapper; upload implementation is app concern

- [ ] C: Images should not be uploaded from editor

- [ ] D: Upload URL is enough — no handler needed


**Answer:** B

UploadHandler interface isolates upload destination, auth, and progress tracking from editor logic. App implements handler (S3, Cloudinary, local server). Wrapper calls handler during image insertion.


### When should you skip rich text and use a plain textarea or Markdown editor?

- [ ] A: When app needs mentions or slash commands

- [ ] B: When app users only need simple input (name, description) with no formatting requirements

- [ ] C: When supporting mobile devices

- [✓] D: Both B and C — rich text complexity unjustified for simple text input or mobile editing


**Answer:** D

Rich text editors are complex and hard to use on mobile. If app only needs simple text input or targets mobile users, Markdown or plain textarea is better. Rich text justified for: document creation, formatted content, collaborative writing.


---

# Module 6: Charts & Data Visualization

Est. study time: 2.5h
Language: en

## Learning Objectives
- Design chart abstraction layer supporting declarative (Recharts), composable (visx), and imperative (D3) libraries
- Implement data transformation pipeline decoupled from rendering library
- Customize chart rendering via theme system independent of library
- Handle responsive charts, animations, and interactions uniformly

---

## Core Content

### Chart Library Spectrum

Three levels of abstraction:

**Declarative (Recharts, Chart.js)**: `<BarChart data={data}><Bar dataKey="value" /></BarChart>`. Easy to use, limited customization. Good for standard charts.

**Composable (visx, @nivo)**: `<XYChart><Axis /><GlyphSeries /></XYChart>`. More control, medium complexity. Good for custom chart compositions.

**Imperative (D3)**: `d3.select('svg').selectAll('rect').data(data).enter().append('rect')`. Full control, maximum effort. Good for novel visualizations.

Abstraction goal: app declares "what" (chart type, data, mapping) — library handles "how."

### Chart Abstraction: Unified Config

```typescript
type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'composed'

interface ChartConfig<T> {
  type: ChartType
  data: T[]
  mapping: {
    x: keyof T
    y: keyof T | Array<{ key: keyof T; name: string; color?: string }>
    color?: keyof T
    size?: keyof T
  }
  layout?: 'vertical' | 'horizontal'
  axes?: {
    x?: { label?: string; type?: 'linear' | 'time' | 'category' }
    y?: { label?: string; type?: 'linear' | 'time' }
  }
  interaction?: {
    tooltip?: boolean
    zoom?: boolean
    pan?: boolean
    brush?: boolean
    click?: (point: T) => void
  }
  theme?: ChartTheme
  size?: { width: number | '100%'; height: number }
  animation?: { duration: number; easing: string }
}
```

Wrapper renders library-specific component from config:

```typescript
function AppChart<T>(config: ChartConfig<T>) {
  switch (config.type) {
    case 'bar': return <RechartsBarChart {...config} />
    case 'line': return <VisxLineChart {...config} />
    case 'composed': return <D3ComposedChart {...config} />
  }
}
```

Or (better): always use one library but abstract config so library swap changes one file.

> **Think**: Should wrapper expose one unified config for all chart types or per-type config?
>
> *Answer: Unified config for common cases (80%). Per-type config extension via `ChartConfig.extra` for specific features (error bars, annotations, reference lines). Union type: `BarConfig | LineConfig | PieConfig` with discriminated 'type'.*

### Data Transformation Pipeline

Raw API data rarely matches chart library input. Transformation pipeline:

```typescript
function createChartPipeline<T, R>(...steps: TransformStep<T, R>[]): (data: T[]) => R[] {
  return (data: T[]) => steps.reduce((acc, step) => step(acc), data as unknown as R[])
}

// Example: sales data → chart data
const salesPipeline = createChartPipeline(
  filterOutliers({ field: 'revenue', zScore: 3 }),
  aggregateBy({ field: 'date', interval: 'month', aggregate: 'sum', target: 'revenue' }),
  sortBy({ field: 'date', direction: 'asc' }),
  addRollingAverage({ window: 3, target: 'revenue' })
)

const chartData = salesPipeline(rawSalesData)
```

Pipeline lives outside wrapper. Wrapper accepts ready-to-render data. Pipeline tests independently.

> **Think**: Where should data transformation live — in chart wrapper, in data layer, or in component?
>
> *Answer: Separate pipeline function injected into wrapper via `transform?: (raw: T[]) => R[]`. Or: component calls `useQuery` → `pipeline` → passes result to chart wrapper. Transform logic is neither chart concern nor UI concern — it's data preparation.*

### Theme System

Chart themes span: colors, fonts, grid styles, axis styles, legend position, tooltip style.

Abstraction: `ChartTheme` interface implemented by library-specific theme mappers:

```typescript
interface ChartTheme {
  colors: string[]
  font: { family: string; size: number }
  grid: { stroke: string; strokeDash: string }
  axis: { label: { fill: string; size: number }; tick: { fill: string; size: number } }
  tooltip: { background: string; border: string; shadow: boolean }
  legend: { position: 'top' | 'bottom' | 'left' | 'right'; align: 'start' | 'center' | 'end' }
}

const appTheme: ChartTheme = {
  colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444'],
  font: { family: 'Inter, sans-serif', size: 12 },
  grid: { stroke: '#e5e7eb', strokeDash: '4 4' },
  axis: { label: { fill: '#6b7280', size: 12 }, tick: { fill: '#9ca3af', size: 11 } },
  tooltip: { background: '#1f2937', border: '#374151', shadow: true },
  legend: { position: 'bottom', align: 'center' }
}

// Mapper
function toRechartsTheme(theme: ChartTheme): Record<string, unknown> {
  return { /* Recharts theme structure */ }
}
```

> **Think**: Multi-library chart theme mapping creates maintenance burden. When is one chart library better than abstraction?
>
> *Answer: One library is better when: (1) all charts are standard types (bar, line, pie), (2) customization needs are modest, (3) team is small. Use abstraction when: multiple chart types span libraries, design system requires consistent theming across custom visualizations, or migration foreseen.*

### Responsive Charts

Chart containers must resize. Libraries handle resize differently:

- Recharts: `ResponsiveContainer` wrapper
- visx: `ParentSize` render prop
- D3: manual ResizeObserver

Abstraction: `ResponsiveChart` wrapper handles all three:

```typescript
function ResponsiveChart({ children }: { children: (size: { width: number; height: number }) => ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
    {size.width > 0 && children(size)}
  </div>
}
```

> **Think**: ResizeObserver fires frequently during resize. How to avoid excessive re-renders?
>
> *Answer: Debounce ResizeObserver callback (300ms). Or: skip re-render if width/height change is below threshold (e.g., 10px). Chart internal resize handling (Recharts ResponsiveContainer) often already optimizes this.*

### React 19: Concurrent Rendering & Chart Performance

React 19 concurrent rendering changes chart optimization strategy. Wrap heavy SVG/Canvas re-renders in `useTransition` to keep UI responsive during filter/brush interactions. Lazy-load chart libraries via `React.lazy` + Suspense — Recharts tree-shakes to ~30KB but deferring import to interaction saves initial bundle cost. React Compiler auto-memoizes D3 interop callbacks previously requiring `useMemo`. Concurrent rendering prevents chart stutter during data pipeline transformations.

```typescript
function ChartDashboard() {
  const [isPending, startTransition] = useTransition()
  const [filters, setFilters] = useState<FilterState>(defaultFilters)

  const handleBrush = useCallback((range: [number, number]) => {
    startTransition(() => {
      setFilters(prev => ({ ...prev, dateRange: range }))
    })
  }, [])

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ChartPanel filters={filters} isPending={isPending} />
    </Suspense>
  )
}
```

---

### Why This Matters

Chart libraries change frequently — licensing, bundle size, feature gaps. D3 (the foundation) does not change, but declarative wrappers do. Clean data pipeline + chart config abstraction means library swap rewrites one file, not every chart in the app.

---

### Common Questions

**Q: D3 is powerful but verbose. When should I use raw D3 instead of wrappers?**
A: Raw D3 for: novel visualizations (sunburst, chord, force-directed graphs), custom animations, SVG rendering beyond standard chart types. Use wrappers for: standard business charts (bar, line, pie, area, scatter).

**Q: How to handle chart export (PNG/SVG)?**
A: Abstract `ChartExport` interface: `toImage(): Promise<Blob>`, `toSVG(): string`. Recharts: html2canvas. visx: SVG serializer. D3: `new XMLSerializer().serializeToString(svgNode)`.

**Q: How does React 19 affect chart library selection?**
A: React 19 concurrent rendering makes heavy chart libs viable. useTransition keeps UI responsive during data transformations. React Compiler reduces manual memoization of D3 callbacks. Suspense enables code-split chart imports. Chart abstraction still matters — library swap cost unchanged, runtime performance improves.

**Q: Can React Compiler optimize D3 + React interop?**
A: React Compiler memoizes React components and hooks only. D3 imperative DOM manipulation (d3.select, .append) bypasses React virtual DOM. Use refs for D3-owned DOM nodes. Compiler helps React-side memoization (event handlers, data callbacks). D3-side remains manual.

---

## Examples

### Example 1: Dashboard with Multiple Chart Types

**Problem**: Dashboard renders bar, line, pie, and composed charts from same data source. Design system requires consistent colors, fonts, and interaction.

**Solution**: Single `AppChart` wrapper consuming `ChartConfig`. Theme applied uniformly. Data pipeline per widget creates chart-ready data from API.

### Example 2: Migrating from Recharts to visx

**Problem**: App outgrows Recharts customization. Needs custom glyphs, annotations, and animation control. visx provides lower-level access.

**Solution**: `AppChart` wrapper switches internal rendering from Recharts to visx. `ChartConfig` unchanged. Theme mapper added for visx. Data pipeline unchanged. Migration = one file change + visual regression testing.

---

## Key Takeaways
- Chart libraries span declarative (Recharts), composable (visx), imperative (D3). Abstract config covers common chart types.
- Data transformation pipeline: separate from wrapper. Wrapper accepts ready-to-render data.
- Theme system: `ChartTheme` interface, mapped to library-specific theme structure. Uniform look across libraries.
- Responsive chart: single ResizeObserver wrapper, all chart libraries use same responsive container.
- Export: abstract behind `ChartExport` interface per library.

## Common Misconception

**"D3 makes all other chart libraries obsolete."**

D3 is a visualization toolkit, not a chart library. Building standard bar/line/pie charts with D3 requires 5x more code than Recharts or visx. D3 excels at novel visualizations. For business dashboards, declarative libraries are faster and more maintainable. D3 stays valuable for custom rendering within visx or as foundation when apps outgrow declarative libs.

---

## Feynman Explain
(Explain the difference between declarative (Recharts), composable (visx), and imperative (D3) chart libraries to a junior developer. Use analogy: ordering from menu (declarative), building from ingredients (composable), cooking from raw ingredients (imperative).)

---

## Reframe
(Pause. Chart abstraction adds configuration complexity. For a dashboard with 5 chart types, does abstraction pay off? When is ChartConfig over-engineering compared to direct Recharts usage?)

---

## Drill
Take the quiz. MCQs test library selection, data pipeline, theming, responsive patterns, and migration strategy.

Run: `learn.sh quiz external-lib-patterns 06-charts-visualization`

## Quiz: 06-charts-visualization


### Which chart library category gives full control over SVG rendering?

- [ ] A: Declarative (Recharts)

- [ ] B: Composable (visx)

- [✓] C: Imperative (D3)

- [ ] D: All three give equal control


**Answer:** C

D3 gives full imperative control over every SVG element. Recharts abstracts SVG. visx sits between — composable but still built on D3 primitives.


### Where should data transformation (filtering, aggregation, sorting) live?

- [ ] A: Inside chart wrapper

- [✓] B: Separate pipeline function — chart wrapper accepts ready-to-render data

- [ ] C: In the API backend

- [ ] D: Inside each chart component


**Answer:** B

Separate data pipeline keeps transformation testable and reusable across charts. Wrapper remains a pure renderer. Pipeline can be shared between chart and non-chart views (table, export).


### What is the purpose of ChartTheme abstraction?

- [ ] A: Makes charts render faster

- [✓] B: Provides consistent colors, fonts, and grid styles across chart libraries

- [ ] C: Bundle size optimization

- [ ] D: Enables server-side chart rendering


**Answer:** B

ChartTheme defines uniform visual properties mapped to library-specific theme structures. Swap library, map same theme to new structure — charts look identical.


### When would you use raw D3 instead of Recharts?

- [ ] A: Always — D3 is better

- [ ] B: For standard bar/line/pie charts

- [✓] C: For novel visualizations (force-directed graph, chord diagram, custom cartography)

- [ ] D: When you need responsive charts


**Answer:** C

D3 for novel visualizations that declarative libraries cannot express. Recharts/visx for standard business charts. D3 for custom; declarative for standard.


### How to handle responsive chart resizing across libraries?

- [ ] A: Use each library's built-in responsive component (Recharts ResponsiveContainer, visx ParentSize)

- [✓] B: Single ResizeObserver wrapper that provides width/height to any chart library

- [ ] C: Fixed-size charts — avoid responsiveness

- [ ] D: CSS media queries


**Answer:** B

Single ResizeObserver wrapper normalizes responsive behavior. All chart libraries receive same width/height. Avoids library-specific responsive quirks and provides uniform API.


### Migrating from Recharts to visx. What changes are needed outside chart wrapper?

- [ ] A: Every chart usage changes

- [✓] B: Only wrapper internals change — ChartConfig API stays

- [ ] C: Data pipeline must be rewritten

- [ ] D: Theme must be completely redesigned


**Answer:** B

With ChartConfig abstraction, library swap changes wrapper internals (config-to-JSX mapping). ChartConfig interface, data pipeline, and theme definitions remain unchanged.


### ChartConfig.extra allows per-library features. What concern?

- [✓] A: Too flexible — every chart becomes unique, losing abstraction benefit

- [ ] B: Perfect — escape hatch for library-specific features

- [ ] C: Extra props should go in separate file

- [ ] D: No concern — extra is harmless


**Answer:** A

If every chart uses extra for different features, wrapper adds no value. Better: promote commonly-used extra features to first-class ChartConfig props. Extra is escape hatch, not primary API.


### Which chart export approach is abstraction-friendly?

- [ ] A: Use library-specific export methods directly in components

- [✓] B: ChartExport interface: toImage(), toSVG() implemented per library

- [ ] C: Screenshot the entire page

- [ ] D: Export CSV instead of image


**Answer:** B

ChartExport interface wraps library-specific export. Recharts uses html2canvas. visx uses SVG serialization. D3 uses XMLSerializer. Consumer calls export.toImage() regardless of library.


### Dashboard uses 5 chart types, all standard (bar, line, pie, area, scatter). Which library choice is most practical?

- [ ] A: Raw D3 for all — full control

- [✓] B: Recharts or visx — standard chart types well-covered, less code than D3

- [ ] C: Custom canvas rendering

- [ ] D: No library — CSS-only charts


**Answer:** B

Standard chart types are well-covered by declarative/composable libraries. Recharts or visx produce correct charts with 80% less code than D3. Only switch to D3 for non-standard visualizations.


### Animation config is part of ChartConfig. How to keep it library-agnostic?

- [ ] A: Each library has unique animation API — cannot abstract

- [✓] B: Abstract as { duration: number, easing: string, type: 'fade' | 'scale' | 'slide' } — wrapper maps to library animation

- [ ] C: Skip animation entirely

- [ ] D: Animation is a render-time concern — not part of config


**Answer:** B

Common animation properties (duration, easing, type) abstract across libraries. Mapper converts to Recharts animationDuration/easing, visx animationTiming, D3 transition duration/ease. Library-specific animation details stay in wrapper.


---

# Module 7: Map Libraries — MapLibre GL JS & Leaflet

Est. study time: 2h
Language: en

## Learning Objectives
- Design map abstraction supporting vector tile (MapLibre) and raster tile (Leaflet) engines
- Implement layer system (markers, polygons, heatmaps) decoupled from map library
- Manage map lifecycle (initialization, resize, cleanup) with React integration
- Handle large GeoJSON datasets with clustering and viewport filtering

---

## Core Content

### Map Library Comparison

| Feature | MapLibre GL JS | Leaflet | Google Maps |
|---------|---------------|---------|-------------|
| Rendering | WebGL (hardware-accelerated) | SVG/CSS | Canvas/WebGL |
| Tile format | Vector tiles (style-spec) | Raster tiles | Hybrid |
| Performance (10k+ points) | Excellent (WebGL) | Poor (SVG DOM) | Good |
| Custom styling | Full GL style spec | Limited via CSS | Limited via API |
| Bundle | ~150KB (unminified) | ~40KB | Dynamic load |
| License | BSD-3 (open source) | BSD-2 (open source) | Proprietary |
| Offline tiles | Yes | Yes | Limited |
| 3D / Terrain | Yes (native) | Plugin (Leaflet.Terrain) | Yes |

**MapLibre**: Modern, performant, vector tiles. Preferred for data-heavy maps, custom styles, 3D terrain.

**Leaflet**: Lightweight, simpler, raster tiles. Preferred for simple marker maps, legacy projects, minimal bundle.

### Map Lifecycle

Maps have imperative lifecycle: create, update style, add/remove layers, resize, destroy.

React integration pattern:

```typescript
function useMapLifecycle(containerRef: RefObject<HTMLDivElement>, config: MapConfig) {
  const mapRef = useRef<MapInstance | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const map = createMapInstance(config, containerRef.current!)
    map.on('load', () => setReady(true))
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [config.style, config.center, config.zoom])

  return { mapRef, ready }
}
```

Abstraction: `createMapInstance` returns either MapLibre or Leaflet instance behind `MapInstance` interface:

```typescript
interface MapInstance {
  setCenter(center: [number, number]): void
  setZoom(zoom: number): void
  setStyle(style: string | object): void
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  addLayer(layer: MapLayerConfig): void
  removeLayer(id: string): void
  getBounds(): BBox
  fitBounds(bounds: BBox, padding?: number): void
  resize(): void
  remove(): void
}
```

> **Think**: MapLibre and Leaflet APIs differ significantly. MapInstance interface forces lowest common denominator. How to access library-specific features?
>
> *Answer: `MapInstance.getNative()` returns underlying library instance. Document as escape hatch. Use sparingly — each escape hatch usage is a migration liability.*

### Layer System

Maps display data as layers. Layer abstraction:

```typescript
type MapLayerConfig = 
  | { type: 'marker'; id: string; position: [number, number]; popup?: string; icon?: MarkerIcon }
  | { type: 'geojson'; id: string; data: GeoJSON.FeatureCollection; style: GeoJSONStyle }
  | { type: 'heatmap'; id: string; data: GeoJSON.FeatureCollection; radius: number; blur: number }
  | { type: 'polygon'; id: string; coordinates: [number, number][]; fill: string; stroke: string }
  | { type: 'cluster'; id: string; data: GeoJSON.FeatureCollection; clusterRadius: number }

interface MapLayerManager {
  addLayer(config: MapLayerConfig): void
  updateLayer(id: string, config: Partial<MapLayerConfig>): void
  removeLayer(id: string): void
  clearLayers(): void
  getLayer(id: string): MapLayerConfig | null
}
```

MapLibre impl: GeoJSON source + layer with `type: 'circle' | 'fill' | 'heatmap'`.
Leaflet impl: `L.marker()`, `L.geoJSON()`, `L.heatLayer()` (plugin).

> **Think**: Heatmap requires MapLibre native or Leaflet plugin. Should abstraction include plugin installation concern?
>
> *Answer: Include plugin init in map factory. `createMapInstance(config)` checks config.plugins and loads Leaflet heatmap plugin or MapLibre heatmap layer. Consumer declares `heatmap: true` in config.*

### Large Datasets & Clustering

10k+ points choke Leaflet (SVG DOM). MapLibre handles via WebGL.

Clustering abstraction:

```typescript
interface ClusterStrategy {
  type: 'supercluster' | 'leaflet-markercluster' | 'maplibre-cluster'
  radius: number
  maxZoom: number
  minPoints?: number
  onClusterClick?: (cluster: ClusterData) => void
}

// MapLibre: built-in clustering via GeoJSON source cluster props
// Leaflet: MarkerCluster plugin
// Abstract: same config, different implementations
```

Viewport filtering (only load points in viewport) for large datasets:

```typescript
function useViewportFilter(map: MapInstance, data: Feature[], onFiltered: (visible: Feature[]) => void) {
  useEffect(() => {
    const handler = () => {
      const bounds = map.getBounds()
      const visible = data.filter(f => isWithinBounds(f, bounds))
      onFiltered(visible)
    }
    map.on('moveend', handler)
    handler() // initial
    return () => map.off('moveend', handler)
  }, [map, data])
}
```

> **Think**: Viewport filtering and clustering serve same goal (performance). When to use which?
>
> *Answer: Clustering: aggregate nearby points into cluster markers. Good for 1k-100k points. Viewport filtering: only load/render points in current viewport. Good for 100k+ points with server-side data. Combine: cluster within viewport for 10k+ visible points.*

### Map Interaction

Common interactions: click, hover, popup, drag, zoom, draw.

Abstraction:

```typescript
interface MapInteractionConfig {
  onClick?: (feature: GeoJSON.Feature, lngLat: [number, number]) => void
  onHover?: (feature: GeoJSON.Feature | null, lngLat: [number, number]) => void
  onBoundsChange?: (bounds: BBox, zoom: number) => void
  popup?: { enabled: boolean; template: (feature: GeoJSON.Feature) => string }
  draw?: { enabled: boolean; onDraw: (geometry: GeoJSON.Geometry) => void }
}
```

MapLibre: `map.on('click', 'layer-id', handler)`. Leaflet: `marker.on('click', handler)`. Wrapper normalizes.

### React 19: Imperative Map API & Concurrent Rendering

Map libraries expose imperative APIs (map.flyTo, map.setCenter, map.setStyle). React 19 ref as prop eliminates `forwardRef` boilerplate — pass map instance ref directly:

```typescript
function MapView({ mapRef, config }: { mapRef: RefObject<MapInstance | null>; config: MapConfig }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useMapLifecycle(containerRef, config)  // assigns map to mapRef.current

  return <div ref={containerRef} style={{ width: '100%', height: 600 }} />
}
```

Map libs are DOM-dependent — mark with `"use client"` boundary. Lazy-load map tiles via Suspense for initial render speed. Wrap map animation state updates (zoom, center, pitch) in `useTransition` to avoid jank. React Compiler handles interop callbacks passed to map.on — reduces manual `useCallback`.

---

### Why This Matters

Map libraries are among the hardest to migrate. MapLibre and Leaflet have completely different APIs, rendering engines, and tile ecosystems. Map abstraction saves months of migration work. It also enables progressive enhancement: start with Leaflet (lightweight), upgrade to MapLibre (performance, 3D) when needed.

---

### Common Questions

**Q: Should I use MapLibre or Leaflet for a simple store locator with 100 markers?**
A: Leaflet. 100 markers is well within Leaflet's performance. MapLibre's WebGL overhead is unnecessary. Abstraction lets you start with Leaflet and upgrade to MapLibre if you add 10k+ points or 3D terrain.

**Q: How to handle different tile providers (OpenStreetMap, Mapbox, Stadia)?**
A: Abstract tile provider in MapConfig.style. MapLibre uses GL style JSON. Leaflet uses tile URL template. Both expose in config. Provider change = config change, not code change.

**Q: How does React 19 change map library integration?**
A: Ref as prop simplifies imperative map API access — no forwardRef needed. "use client" boundary required for all map libs (DOM-dependent). Suspense boundaries can defer map tile loading until viewport enters. useTransition keeps map animation state updates smooth. React Compiler memoizes event handlers passed to map.on — reduces boilerplate.

**Q: Should map libs be lazy-loaded?**
A: Yes. Dynamic import + Suspense boundary. MapLibre (~150KB) and Leaflet (~40KB) are significant bundles. Defer load until map viewport is visible. `const MapLibreMap = lazy(() => import('./MapLibreMap'))`. Wrap in Suspense with skeleton placeholder.

---

## Examples

### Example 1: Property Map with Clustering

**Problem**: 15k property listings on map. Click marker shows property popup. Zoom in: clusters expand.

**Solution**: MapLibre (WebGL handles 15k points). Cluster config: radius=50, maxZoom=14. Popup template from listing data. Click handler zooms to cluster or opens property popup.

### Example 2: Migration from Leaflet to MapLibre

**Problem**: App outgrows Leaflet. 50k data points crash SVG rendering. 3D terrain needed.

**Solution**: MapLibre backend with same MapInstance interface. Layer configs convert. Cluster config identical. Data pipeline unchanged. MapLibre terrain enabled via MapConfig.terrain = { source: 'terrain-source', exaggeration: 1.5 }. Migration = one file.

---

## Key Takeaways
- MapLibre (WebGL, vector tiles, 3D) vs Leaflet (SVG/CSS, raster tiles, lightweight)
- Map lifecycle: imperative create/update/destroy — wrap in React useEffect with cleanup
- Layer abstraction: union type for marker, geojson, heatmap, polygon, cluster
- MapInstance interface as lowest-common-denominator; getNative() escape hatch
- Clustering: MapLibre built-in vs Leaflet plugin — same config, different implementation
- Viewport filtering for 100k+ datasets; clustering for 1k-100k

## Common Misconception

**"Leaflet is always lighter than MapLibre."**

Leaflet bundle is smaller (~40KB vs ~150KB). But Leaflet renders markers as DOM elements — 10k markers create 10k DOM nodes, consuming memory and causing scroll jank. MapLibre renders via WebGL — 100k points at same memory cost. For large datasets, MapLibre is lighter in practice despite larger bundle.

---

## Feynman Explain
(Explain the difference between vector tiles (MapLibre) and raster tiles (Leaflet) to a non-technical stakeholder. Use photo vs painting analogy.)

---

## Reframe
(Pause. Maps are expensive to build and maintain. When does a map visualization add more complexity than value? Should some map use cases be satisfied by static map images with clickable regions?)

---

## Drill
Take the quiz. MCQs test library selection, lifecycle management, layer abstraction, clustering, and performance optimization.

Run: `learn.sh quiz external-lib-patterns 07-map-libraries`

## Quiz: 07-map-libraries


### Which map library renders markers as WebGL (not DOM elements)?

- [ ] A: Leaflet

- [✓] B: MapLibre GL JS

- [ ] C: Google Maps

- [ ] D: OpenLayers


**Answer:** B

MapLibre uses WebGL for all rendering — markers, lines, polygons are drawn on GPU. Leaflet creates DOM elements per marker (performance limit with thousands of markers).


### What is the primary performance limitation of Leaflet with 10k+ markers?

- [ ] A: Network tile downloads

- [✓] B: 10k+ DOM elements cause scroll jank and memory pressure

- [ ] C: Leaflet cannot load more than 5k markers

- [ ] D: Tile rendering becomes slow


**Answer:** B

Leaflet creates DOM elements (div or img) for each marker. 10k DOM nodes causes slow rendering, scrolling jank, and high memory usage. MapLibre's WebGL rendering avoids DOM overhead.


### In map lifecycle React hook, when should map.remove() be called?

- [ ] A: On every re-render

- [✓] B: In useEffect cleanup — before component unmount

- [ ] C: map.remove() is not needed — garbage collection handles it

- [ ] D: On window resize


**Answer:** B

Map instances hold WebGL contexts, tile cache, and event listeners. Without cleanup in useEffect return, multiple map instances accumulate on re-renders, causing memory leaks.


### MapInstance.getNative() exposes underlying library instance. When is this acceptable?

- [ ] A: Never — defeats abstraction

- [✓] B: For library-specific features not covered by MapInstance interface, with clear documentation that it is migration liability

- [ ] C: Always — full library access is expected

- [ ] D: Only in development builds


**Answer:** B

getNative() is escape hatch for features not in MapInstance interface (e.g., MapLibre 3D terrain, Leaflet heatmap plugin config). Document usage and limit to unavoidable cases.


### You need 100 markers with popups on a map page. Which library choice is appropriate?

- [ ] A: MapLibre — performance headroom

- [ ] B: Leaflet — lightweight, DOM handles 100 markers fine

- [ ] C: No library — static map image

- [✓] D: Both A and B work; Leaflet is simpler for this scale


**Answer:** D

100 markers is well within Leaflet's capability. Leaflet is lighter bundle and simpler API. MapLibre's WebGL is unnecessary. Abstraction lets you start with Leaflet, upgrade to MapLibre if data grows.


### How does MapLibre handle heatmap rendering differently from Leaflet?

- [ ] A: Both render heatmaps identically

- [✓] B: MapLibre has native heatmap layer type (WebGL); Leaflet requires a third-party plugin

- [ ] C: MapLibre cannot render heatmaps

- [ ] D: Leaflet has built-in heatmap; MapLibre requires plugin


**Answer:** B

MapLibre supports heatmap as built-in layer type via WebGL fragment shaders. Leaflet heatmap requires external plugin (Leaflet.heat). Abstraction should include plugin registration in map factory.


### 50k GPS points must display on map with clustering. Best approach?

- [ ] A: Leaflet with MarkerCluster plugin

- [✓] B: MapLibre with built-in GeoJSON clustering

- [ ] C: Static PNG map

- [ ] D: Load all points as individual markers


**Answer:** B

MapLibre's WebGL + built-in clustering handles 50k points efficiently. Leaflet MarkerCluster would create many DOM cluster elements, causing performance issues. MapLibre clustering is native and GPU-accelerated.


### What is viewport filtering used for?

- [✓] A: Filtering data points that are outside current map view, reducing render load

- [ ] B: Applying CSS filters to map tiles

- [ ] C: Client-side search within map bounds

- [ ] D: Restricting user pan range


**Answer:** A

Viewport filtering only renders data within current map bounds. Essential for 100k+ datasets where even WebGL struggles. Paired with viewport-based API queries for server-side filtering.


### How should tile provider switching (OpenStreetMap → Mapbox) be handled?

- [✓] A: Change in MapConfig.style — MapLibre uses GL JSON, Leaflet uses tile URL template

- [ ] B: Each tile provider requires separate map implementation

- [ ] C: Cannot switch tile providers after initialization

- [ ] D: Tile provider is not a map concern


**Answer:** A

MapConfig.style abstracts tile source. MapLibre accepts GL style URL/JSON. Leaflet accepts tile URL template. Provider change = config change. Wrapper passes config to respective library's style mechanism.


### A map wrapper uses only the intersection of MapLibre and Leaflet features. What limitation?

- [✓] A: Cannot use MapLibre 3D terrain, heatmap, or custom GL layers through wrapper

- [ ] B: Maps will not render

- [ ] C: Bundle size doubles

- [ ] D: No limitation — intersection covers all use cases


**Answer:** A

Lowest-common-denominator abstraction misses MapLibre's advanced features (3D terrain, custom GL layers, satellite imagery). Wrapper must provide getNative() or optional advanced config for library-specific features.


---

# Module 8: Virtual Scrolling — TanStack Virtual

Est. study time: 2h
Language: en

## Learning Objectives
- Design virtualizer abstraction supporting fixed, variable, and dynamic item sizes
- Integrate virtualizer with data fetching patterns (infinite scroll, cursor pagination)
- Implement sticky headers, RTL, and grid/table virtual scrolling
- Handle measurement, overscan, and scroll restoration with clean abstraction

---

## Core Content

### Problem: DOM Overload

Rendering 10k+ items as DOM nodes causes: long initial render (10k divs), scroll jank (reflow on every frame), high memory usage (10k DOM nodes ~5-20MB).

Virtual scrolling renders only visible items (typically 10-30 DOM nodes). Container has scrollbar sized to total content height. Visible items positioned absolutely.

### TanStack Virtual Architecture

```typescript
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 50,  // estimated item height in px
  overscan: 5  // extra items above/below viewport
})
```

Returns: `getVirtualItems()` — `VirtualItem[]` with `{ key, index, start, size, end }`.

Rendering:

```typescript
function VirtualList<T>({ items, renderItem, estimateSize }: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize
  })

  return (
    <div ref={scrollRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        <div style={{ transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)` }}>
          {virtualizer.getVirtualItems().map(item => (
            <div key={item.key} data-index={item.index} ref={virtualizer.measureElement}>
              {renderItem(items[item.index], item.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Wrapper Abstraction

Consumer should not touch virtualizer API:

```typescript
interface VirtualListProps<T> {
  data: T[]
  renderItem: (item: T, index: number) => ReactNode
  itemSize?: number | ((index: number) => number)  // fixed or variable
  overscan?: number
  gap?: number
  scrollRef?: RefObject<HTMLDivElement>  // external scroll container
  onScroll?: (state: ScrollState) => void
  endReached?: () => void  // infinite scroll trigger
  endReachedThreshold?: number  // px from bottom
  stickyIndices?: number[]  // indices of sticky items
  rtl?: boolean
}

interface ScrollState {
  scrollTop: number
  scrollLeft: number
  isScrolling: boolean
  visibleRange: [number, number]  // start, end index
  totalSize: number
}
```

Wrapper implements all virtualizer configuration. Consumer provides data + render function.

> **Think**: Wrapper hides TanStack Virtual entirely. Consumer cannot access virtualizer instance for measurements. Good or bad?
>
> *Answer: Good for 80% use cases. Provide optional `onVirtualizerReady?: (virtualizer: Virtualizer) => void` callback for advanced use (scrollToIndex, getTotalSize custom logic).*

### Dynamic Item Sizes

Fixed sizes are simple. Variable sizes need measurement after render.

TanStack Virtual: `measureElement` ref callback + `measure()` after content load:

```typescript
function DynamicSizeList<T>({ data, renderItem }: VirtualListProps<T>) {
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 100,  // initial estimate
    measureElement: (el) => el.getBoundingClientRect().height  // measure after render
  })

  // Re-measure after data loads (images, async content)
  useEffect(() => {
    virtualizer.measure()
  }, [data])
}
```

Abstraction: `itemSize` prop accepts `'auto'` (measure after render), number (fixed), or `(index) => number` (known variable).

> **Think**: Measuring after render causes layout shift. How to minimize?
>
> *Answer: Provide accurate estimateSize (average item height). Measure only once (cache measured sizes). Re-measure only when item content changes detectably (key change).*

### Infinite Scroll

Infinite scroll = virtual scroll + data fetching on reaching end:

```typescript
function useInfiniteVirtualScroll<T>(fetchMore: () => Promise<T[]>, options: { pageSize: number; threshold?: number }) {
  const [items, setItems] = useState<T[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  const endReached = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    const newItems = await fetchMore()
    setItems(prev => [...prev, ...newItems])
    setHasMore(newItems.length === options.pageSize)
    setLoading(false)
  }, [loading, hasMore, fetchMore, options.pageSize])

  return { items, hasMore, loading, endReached }
}
```

Combined: `VirtualList` with `endReached` trigger. Data loading decoupled from virtual scroll concerns.

> **Think**: Infinite scroll and virtual scroll together create edge cases: scroll position jumps when new items prepended (chat), items removed from middle (real-time list). How to handle?
>
> *Answer: For prepended items: calculate offset adjustment = sum of new item heights, apply to scroll position via scrollRef. For removed items: virtualizer handles automatically — it re-indexes on count change. Cache scroll position before data mutation.*

### Table Virtualization

TanStack Virtual works with tables too:

```typescript
function VirtualTable<T>({ columns, data }: TableProps<T>) {
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 40
  })

  return (
    <div ref={tableRef} style={{ height: 600, overflow: 'auto' }}>
      <table>
        <thead style={{ position: 'sticky', top: 0 }}>{/* header */}</thead>
        <tbody style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map(item => (
            <tr key={item.key} style={{ transform: `translateY(${item.start}px)`, position: 'absolute', width: '100%' }}>
              {/* cells */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Scroll Restoration

When navigating back, restore scroll position:

```typescript
function useScrollRestoration(key: string, scrollRef: RefObject<HTMLDivElement>, itemCount: number) {
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current) return
    const saved = sessionStorage.getItem(`scroll-${key}`)
    if (saved && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(saved, 10)
    }
    restored.current = true
  }, [key])

  useEffect(() => {
    return () => {
      if (scrollRef.current) {
        sessionStorage.setItem(`scroll-${key}`, String(scrollRef.current.scrollTop))
      }
    }
  }, [key, scrollRef])

  // Alternative: scroll to specific item index
  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    virtualizerRef.current?.scrollToIndex(index, { align })
  }, [])
}

### React 19: Virtual Scrolling & Concurrent Rendering

React 19 ref as prop simplifies virtualizer instance access — pass virtualizerRef directly instead of `forwardRef`. Use `useTransition` for scroll-to-index navigation to keep UI responsive during programmatic scroll:

```typescript
function useScrollToIndex(virtualizer: Virtualizer) {
  const [isPending, startTransition] = useTransition()

  const scrollTo = useCallback((index: number) => {
    startTransition(() => {
      virtualizer.scrollToIndex(index, { align: 'start' })
    })
  }, [virtualizer])

  return { scrollTo, isPending }
}
```

React Compiler auto-memoizes row renderers — no manual `useMemo` for row components. Suspense boundaries enable lazy-loaded row content: combine `IntersectionObserver` with `React.lazy` for above-fold prioritization. Concurrent rendering improves scroll performance with large lists by splitting work across frames.

---

### Why This Matters

Virtual scrolling is the difference between "app works with 100 items" and "app works with 100k items." Every app with lists should use virtual scrolling from the start — adding it later requires rewriting list rendering. Clean abstraction means lists are virtual-by-default.

---

### Common Questions

**Q: When should I NOT use virtual scrolling?**
A: When list has <100 items and rendering all is fine. When items have highly variable heights and measuring is unreliable (rich text previews). When list is inside scrollable parent that cannot be controlled.

**Q: How to handle animated item enter/exit?**
A: Use `animatePresence` (Framer Motion) with virtual scrolling requires care. Solution: overlay animations on top of virtualized container using absolute positioning and portal. Virtualizer items should not animate layout.

**Q: How does React 19 improve virtual scrolling performance?**
A: useTransition keeps scroll-to-index responsive during heavy renders. React Compiler auto-memoizes row renderers — no manual React.memo needed. Suspense boundaries for lazy row content reduce initial render cost. Concurrent rendering splits large list work across animation frames, reducing jank.

**Q: Should virtualizer instance use ref as prop in React 19?**
A: Yes. React 19 ref as prop eliminates forwardRef wrapper. Pass virtualizerRef directly to VirtualList. `function VirtualList({ virtualizerRef, ...props })`. Virtualizer instance accessible on `virtualizerRef.current` after mount.

---

## Examples

### Example 1: Chat Message List

**Problem**: Chat app with 50k messages. New messages prepended on scroll-to-top (older messages loaded). Must maintain scroll position.

**Solution**: VirtualList with `onScrollToTop` callback. On prepend: `scrollRef.current.scrollTop += newMessagesHeight`. Virtualizer re-measures. Scroll position stable.

### Example 2: Analytics Data Table

**Problem**: Table with 100k rows, 20 columns, inline editing, row selection.

**Solution**: TanStack Table + TanStack Virtual. VirtualList wrapper renders rows. Table header sticky. Row selection data external. Edit state per row managed by grid wrapper.

---

## Key Takeaways
- Virtual scrolling renders only visible items — essential for 1k+ items
- TanStack Virtual: `useVirtualizer` with count, scroll element, estimate size
- Wrapper hides virtualizer API — consumer provides data + render function
- Dynamic sizes: measure after render via `measureElement`, provide good estimate
- Infinite scroll: `endReached` callback, data fetching separate from virtual scroll
- Scroll restoration: save position before unmount, restore on mount

## Common Misconception

**"Virtual scrolling works automatically with any list."**

Virtual scrolling requires: fixed container height, scrollable element you control, consistent item size (or measurement). Lists inside flex/grid layouts, height: auto containers, or items with collapsible sections need configuration. Not all lists can be virtualized — test early.

---

## Feynman Explain
(Explain virtual scrolling to a junior developer. Use analogy: movie theater marquee — only the visible poster is lit; others are just names on a roll behind it.)

---

## Reframe
(Pause. Virtual scrolling adds complexity: measurement, overscan, scroll restoration. For an app with 500 items max, does virtual scrolling pay off? When is pagination simpler and better UX?)

---

## Drill
Take the quiz. MCQs test virtualizer concepts, dynamic sizing, infinite scroll integration, scroll restoration, and table virtualization.

Run: `learn.sh quiz external-lib-patterns 08-virtual-scrolling`

## Quiz: 08-virtual-scrolling


### How many DOM nodes does a virtual scroll list typically render regardless of total items?

- [ ] A: All items — virtual scrolling does not reduce DOM nodes

- [✓] B: Only visible items + overscan buffer (typically 10-30 nodes)

- [ ] C: Exactly 100 nodes

- [ ] D: 10% of total items


**Answer:** B

Virtual scroll renders only visible viewport items plus overscan (items just above/below). With 100k items, typically 10-30 DOM nodes. Significantly reduces render time and memory.


### What is the overscan property in TanStack Virtual?

- [ ] A: Number of items to skip before rendering starts

- [✓] B: Extra items rendered above and below viewport to reduce blank areas during fast scroll

- [ ] C: Maximum number of items to render

- [ ] D: Percentage of container height to reserve


**Answer:** B

Overscan renders extra items beyond viewport so fast scrolling does not show blank space while new items load. Higher overscan = smoother scroll but more DOM nodes.


### How does TanStack Virtual handle variable item heights?

- [ ] A: All items must be same height

- [✓] B: estimateSize provides initial estimate; measureElement callback measures actual height after render

- [ ] C: Variable heights are not supported

- [ ] D: Developer must pre-calculate all heights before rendering


**Answer:** B

estimateSize gives initial guess. measureElement reads actual DOM height after render. Cached per index. Re-measure on content change.


### When combining infinite scroll with virtual scrolling, where does the endReached callback trigger?

- [ ] A: When user scrolls to last item

- [✓] B: When virtual scroll's last item enters viewport minus threshold distance

- [ ] C: When all items are loaded

- [ ] D: On component mount


**Answer:** B

endReached fires when scroll position is within threshold px of total content bottom. Virtual scroll's total size includes loaded items; endReached detects when user approaches loaded boundary.


### Chat prepends messages when scrolling up. How to prevent scroll position jump?

- [ ] A: Cannot — virtual scroll cannot handle prepended items

- [✓] B: After prepend, increase scrollTop by total height of new items

- [ ] C: Reload entire list

- [ ] D: Disable virtual scrolling for chat


**Answer:** B

Prepending shifts all items down. Adjust scrollTop by sum of new item heights (from estimate or measure). Virtualizer re-indexes. User stays at same logical position.


### What must be true for virtual scrolling to work?

- [✓] A: Container must have a fixed or computed height (not auto)

- [ ] B: Container must be the document body

- [ ] C: Items must be <table> elements

- [ ] D: Browser must support WebGL


**Answer:** A

Virtual scrolling needs scrollable container with defined height. Height: auto means container grows with content — cannot virtualize. Set explicit height or use flex-basis + overflow.


### VirtualList wrapper hides TanStack Virtual API. How to allow scrollToIndex?

- [ ] A: Expose scrollToIndex as prop that changes trigger scroll

- [✓] B: Provide onVirtualizerReady callback that gives consumer access to virtualizer

- [ ] C: Cannot — virtualizer is internal

- [ ] D: Consumer must use native scroll method on container ref


**Answer:** B

onVirtualizerReady callback provides controlled access to virtualizer for advanced operations (scrollToIndex, getTotalSize). Used in conjunction with imperative handle (useImperativeHandle).


### How to restore scroll position when navigating back to a list?

- [ ] A: Virtualizer remembers its position

- [✓] B: Save scrollTop to sessionStorage on unmount, restore on mount

- [ ] C: Use browser History API scroll restoration

- [ ] D: Scroll position cannot be restored


**Answer:** B

Save scrollRef.current.scrollTop to sessionStorage/navigation state before unmount. On mount, read saved value and set scrollRef.current.scrollTop = saved. browser History API scrollRestoration = 'manual' to prevent conflict.


### When should you skip virtual scrolling?

- [ ] A: Never — always use virtual scroll

- [✓] B: When list has <100 items and rendering all is performant

- [ ] C: When data comes from GraphQL

- [ ] D: When using TypeScript


**Answer:** B

Virtual scroll overhead (measurement, re-renders, scroll synchronization) is unnecessary for small lists. For <100 items, rendering all is simpler and performant.


### Virtual scroll with animated item enter/exit (Framer Motion) is tricky because?

- [ ] A: Motion library does not support virtual scroll

- [✓] B: Animated enter/exit changes item height dynamically, causing layout shift and measurement issues

- [ ] C: Virtual scroll and animations cannot coexist

- [ ] D: Framer Motion breaks TanStack Virtual


**Answer:** B

Animation that changes item height (collapse, expand, fade-out with height change) breaks virtualizer's measurement. Solution: overlay animations on top of virtualized container using absolute positioning, outside virtualized items.


---

# Module 9: Date/Time Libraries

Est. study time: 1.5h
Language: en

## Learning Objectives
- Design date library adapter supporting date-fns, Day.js, and Temporal
- Handle timezone conversion, formatting, and calendar operations uniformly
- Integrate date libraries with UI date picker components via adapter pattern
- Implement range calculations, duration math, and locale-sensitive formatting

---

## Core Content

### Date Library Landscape

| Library | Bundle | Mutability | Tree-shakable | Locale | Timezone |
|---------|--------|------------|---------------|--------|----------|
| date-fns | ~1KB per fn (tree-shaken) | Immutable | Yes | Separate import | `date-fns-tz` |
| Day.js | ~2KB | Mutable | No (whole lib) | Plugin | Plugin |
| Luxon | ~15KB | Immutable | Partial | Built-in | Built-in |
| Temporal | Built-in (ES2025) | Immutable | N/A | Intl | Built-in |

Temporal (TC39 proposal, stage 4, shipping in browsers 2025+) is the future. date-fns is current best choice for tree-shaking.

### Adapter Pattern for Date Operations

```typescript
interface DateAdapter {
  format(date: Date, pattern: string, locale?: string): string
  parse(str: string, pattern: string): Date | null
  add(date: Date, duration: DurationInput): Date
  sub(date: Date, duration: DurationInput): Date
  diff(dateLeft: Date, dateRight: Date, unit: TimeUnit): number
  startOf(date: Date, unit: TimeUnit): Date
  endOf(date: Date, unit: TimeUnit): Date
  isBefore(date: Date, compare: Date): boolean
  isAfter(date: Date, compare: Date): boolean
  isWithinRange(date: Date, start: Date, end: Date): boolean
  // Calendar
  getDaysInMonth(date: Date): number
  getDayOfWeek(date: Date): number  // 0=Sunday
  getWeekNumber(date: Date): number
  // Timezone
  toTimezone(date: Date, tz: string): DateAdapterDate
  getTimezoneOffset(date: Date, tz: string): number
  // Locale
  monthName(date: Date, locale?: string, format?: 'long' | 'short'): string
  dayName(date: Date, locale?: string, format?: 'long' | 'short'): string
}

type TimeUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond'
type DurationInput = Partial<Record<TimeUnit, number>>
```

Three implementations:

```typescript
class DateFnsAdapter implements DateAdapter {
  format(date: Date, pattern: string, locale?: string): string {
    return format(date, pattern, locale ? { locale: locales[locale] } : undefined)
  }
  add(date: Date, duration: DurationInput): Date {
    return add(date, duration)
  }
  diff(dateLeft: Date, dateRight: Date, unit: TimeUnit): number {
    return differenceInDays(dateLeft, dateRight)  // per unit
  }
  // ... 20+ methods wrapping date-fns functions
}

class DayjsAdapter implements DateAdapter {
  // Day.js is mutable — clone before mutation
  format(date: Date, pattern: string): string {
    return dayjs(date).format(pattern)
  }
  add(date: Date, duration: DurationInput): Date {
    return dayjs(date).add(duration.days ?? 0, 'day').toDate()
  }
  // ...
}

class TemporalAdapter implements DateAdapter {
  // Temporal — native, immutable, tz-aware
  format(date: Date, pattern: string, locale?: string): string {
    const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime())
    const zoned = instant.toZonedDateTimeISO('UTC')
    return zoned.toLocaleString(locale ?? 'en', { /* pattern */ })
  }
  // ...
}
```

> **Think**: Temporal has richer API than date-fns (timezone handling, calendars, duration math). Adapter hides these differences. Should Temporal-specific features leak into adapter?
>
> *Answer: Adapter for common operations. Temporal-specific features (PlainDate, ZonedDateTime, Calendar) accessible via `getNative()` escape hatch. When app consistently needs Temporal's full power, use Temporal directly in that module.*

### Timezone Handling

Timezone is the hardest date concern. Libraries differ:

```typescript
interface TimezoneAdapter {
  formatInTimezone(date: Date, tz: string, pattern: string): string
  convertBetweenTimezones(date: Date, fromTz: string, toTz: string): Date
  getTimezonesForCountry(countryCode: string): string[]
  isDST(date: Date, tz: string): boolean
  getUTCOffset(date: Date, tz: string): string  // "+05:30"
}
```

date-fns: `date-fns-tz` package with `formatInTimeZone`, `utcToZonedTime`, `zonedTimeToUtc`.

Day.js: `utc` plugin + `timezone` plugin.

Temporal: native `ZonedDateTime` with built-in timezone handling.

Abstraction ensures TZ operations are one import away, not scattered.

> **Think**: date-fns-tz converts Date to/from timezone using Intl. Temporal handles timezone natively. Testing TZ logic requires mocking timezone. How to test?
>
> *Answer: Inject TimezoneAdapter as dependency. Test with fake timers + specific timezone. For date-fns: mock `Intl.supportedValuesOf('timeZone')`. For Temporal: use `Temporal.TimeZone.from('UTC')` in tests.*

### Duration & Interval Math

```typescript
interface DurationAdapter {
  addDuration(date: Date, duration: DurationInput): Date
  subtractDuration(date: Date, duration: DurationInput): Date
  formatDuration(ms: number, locale?: string): string  // "2 hours, 30 minutes"
  getHumanizedDuration(start: Date, end: Date, locale?: string): string  // "3 months ago"
  isDurationOverlapping(d1: DurationInput, d2: DurationInput): boolean
}
```

date-fns: `add`, `sub`, `formatDuration`, `formatDistanceToNow`. Day.js: `duration()` plugin. Temporal: `Temporal.Duration`.

### Locale

Date formatting must respect user locale:

```typescript
interface LocaleDateAdapter {
  formatDate(date: Date, locale: string): string    // Jun 18, 2026 vs 18 juin 2026
  formatTime(date: Date, locale: string): string    // 3:45 PM vs 15:45
  formatRelative(date: Date, locale: string): string  // "yesterday" vs "hier"
  formatRange(start: Date, end: Date, locale: string): string  // "Jun 18–20"
}
```

date-fns: locale modules. Day.js: locale plugin. Temporal: `Intl.DateTimeFormat`.

### Date Picker Integration

Date pickers often accept library-specific date objects. Adapter normalizes:

```typescript
interface DatePickerAdapter<T> {
  toPickerValue(date: Date | null): T  // convert Date → picker type
  fromPickerValue(value: T): Date | null  // convert picker type → Date
  formatPlaceholder(locale: string): string
}

// For MUI X DatePicker (accepts Day.js or date-fns)
class MuiDatePickerAdapter extends DatePickerAdapter<Dayjs> {
  toPickerValue(date: Date | null): Dayjs {
    return date ? dayjs(date) : null
  }
  fromPickerValue(value: Dayjs): Date | null {
    return value?.toDate() ?? null
  }
}

### React 19: Date Formatting & Concurrent Rendering

React Compiler optimizes expensive date formatting calls. `formatToParts` generates arrays — compiler memoizes these automatically, replacing manual `useMemo` wrapping.

Server Components handle server-side date formatting with consistent timezone logic. Format dates on server, send pre-formatted strings to client — eliminates client TZ mismatch bugs. Use `useTransition` for calendar view switching (month/year navigation) to keep UI responsive. Ref as prop for date picker imperative API (open/close calendar panel, focus date input):

```typescript
function DatePicker({ datePickerRef }: { datePickerRef: RefObject<DatePickerAPI | null> }) {
  return <input ref={datePickerRef} type="date" />
  // datePickerRef.current.openCalendar()
  // datePickerRef.current.focus()
}
```

---

### Why This Matters

Date/time is the most underestimated migration cost in apps. date-fns → Temporal migration affects every file with `format()`, `add()`, `differenceInDays()`, or `parse()`. Adapter reduces migration to one file change. Timezone bugs are the hardest to find and fix — centralized TZ handling reduces surface area.

---

### Common Questions

**Q: Should I use Temporal today or wait for browser support?**
A: Use date-fns now (tree-shakable, stable, TypeScript-friendly). Add Temporal adapter alongside. When Temporal ships broadly, swap adapter implementation. Do not polyfill Temporal — bundle impact is large.

**Q: How to handle user timezone selection?**
A: Store user preference as IANA timezone string (e.g., "America/New_York"). `TimezoneAdapter.formatInTimezone(date, userTz, pattern)`. Never use UTC offset strings — they do not account for DST changes.

**Q: How does React 19 affect date formatting strategy?**
A: React Compiler auto-memoizes date formatting calls — no manual useMemo for formatToParts. Server Components can pre-format dates server-side, eliminating client TZ logic. useTransition keeps calendar navigation responsive. Ref as prop simplifies date picker imperative API access.

**Q: Should date formatting live in Server Components?**
A: Yes for display-only dates. Format dates server-side with consistent timezone, send pre-formatted strings. Avoids client TZ bugs and reduces bundle (no date lib on client). Client-side date formatting still needed for interactive date pickers and relative time ("2 min ago").

---

## Examples

### Example 1: Scheduled Post Editor

**Problem**: User schedules content publish with timezone selector. Preview shows time in user's timezone and reader's timezone.

**Solution**: `TimezoneAdapter.formatInTimezone(date, selectedTz, 'PPpp')` for input. `TimezoneAdapter.formatInTimezone(date, readerTz, 'PPpp')` for preview. Same date object, different TZ formatting.

### Example 2: Calendar Widget

**Problem**: Month view calendar with events from different timezones. Navigation between months.

**Solution**: `DateAdapter` for month navigation (startOf/endOf month, getDaysInMonth, getDayOfWeek). Events stored as UTC, rendered via `TimezoneAdapter` per event timezone. Calendar grid = pure date math no timezone.

---

## Key Takeaways
- date-fns (current best) → Temporal (future native). Adapter makes swap trivial.
- Timezone is hardest date concern. `TimezoneAdapter` centralizes all TZ operations.
- Duration/interval math differs across libraries — abstract to `DurationAdapter`.
- Locale: format with user locale, never hardcode. Use locale-specific pattern strings.
- Date picker integration: `DatePickerAdapter` converts between library date types.
- Store timezone as IANA string, never UTC offset.

## Common Misconception

**"JavaScript Date handles timezone if I store everything in UTC."**

JavaScript Date stores milliseconds since epoch (UTC). `toISOString()`, `getTime()`, and JSON serialization are UTC. But `toString()`, `getHours()`, `getDate()`, and `toLocaleString()` use local timezone. A Date displayed in New York shows different hours than same Date in Tokyo. You must use timezone-aware functions for display. UTC storage + TZ-aware display is correct.

---

## Feynman Explain
(Explain the difference between UTC storage and timezone-local display. Use analogy: a flight departure time is stored as UTC (absolute), but shown in passenger's local time at airport.)

---

## Reframe
(Pause. Date library abstraction is significant overhead. For an app with simple date formatting (no TZ, no range, no duration), is abstraction justified? When is direct date-fns import better?)

---

## Drill
Take the quiz. MCQs test adapter design, timezone handling, duration math, locale, and Temporal adoption strategy.

Run: `learn.sh quiz external-lib-patterns 09-date-time`

## Quiz: 09-date-time


### Which date library is tree-shakable and currently recommended for new apps?

- [ ] A: Day.js

- [✓] B: date-fns

- [ ] C: Luxon

- [ ] D: Moment.js


**Answer:** B

date-fns is tree-shakable (import only functions you use), TypeScript-native, immutable, and stable. Moment.js is deprecated. Day.js is mutable and not tree-shakable. Luxon is larger bundle.


### What is the recommended long-term strategy for date handling?

- [ ] A: Use Temporal immediately with polyfill

- [✓] B: Use date-fns now with adapter; add Temporal adapter when native browser support ships (ES2025+)

- [ ] C: Never migrate — date-fns is future-proof

- [ ] D: Use Moment.js — it still works


**Answer:** B

Temporal is stage 4 and shipping in browsers 2025+. Start with date-fns adapter. When Temporal is available, add Temporal adapter implementation. Polyfill is too large for production.


### How should user timezone preference be stored?

- [ ] A: UTC offset (e.g., +05:30)

- [✓] B: IANA timezone string (e.g., Asia/Kolkata)

- [ ] C: Numeric offset in hours

- [ ] D: User's IP address — detect on every request


**Answer:** B

IANA timezone string accounts for DST changes and historical timezone changes. UTC offset does not handle DST. Detect via `Intl.DateTimeFormat().resolvedOptions().timeZone`.


### JavaScript Date stores milliseconds since epoch (UTC). What goes wrong when displayed directly?

- [ ] A: Nothing — Date always displays correctly

- [✓] B: toString(), getHours(), getDate() use local timezone, not UTC — same Date shows different times in different timezones

- [ ] C: Date stores local time, not UTC

- [ ] D: Date cannot be serialized


**Answer:** B

Date.getTime() is UTC. But Date.toString(), getHours(), getDate() use runtime local timezone. User in Tokyo sees different display than user in New York for same Date object. Use timezone-aware formatting.


### DateAdapter.format(date, 'yyyy-MM-dd') formats the same across date-fns, Day.js, and Temporal?

- [ ] A: Yes — all use same pattern tokens

- [✓] B: No — each library uses different pattern tokens (date-fns: yyyy-MM-dd, Day.js: YYYY-MM-DD, Temporal: Intl)

- [ ] C: Pattern tokens are standardized

- [ ] D: Only date-fns supports formatting


**Answer:** B

date-fns uses Unicode token format (yyyy-MM-dd). Day.js uses Moment-style tokens (YYYY-MM-DD). Temporal uses Intl.DateTimeFormat options. Adapter hides these differences — consumers use adapter.format() with app-defined token format.


### Why is testing timezone logic difficult?

- [ ] A: Timezones cannot be tested

- [✓] B: Intl and Temporal use system timezone — mocking timezone requires environment-level changes

- [ ] C: Timezone logic is always correct

- [ ] D: Tests run in UTC only


**Answer:** B

Timezone formatting depends on system locale and timezone. Use libraries with injectable timezone (date-fns-tz formatInTimeZone, Temporal.TimeZone.from). Tests set explicit timezone in function calls, not system timezone.


### DatePickerAdapter maps between Date and picker library's date type. Why is this needed?

- [✓] A: Date pickers accept different date objects (Dayjs, Moment, Luxon DateTime)

- [ ] B: Date pickers do not accept JavaScript Date

- [ ] C: Adapter improves performance

- [ ] D: All date pickers accept Date natively


**Answer:** A

MUI X DatePicker accepts Dayjs or date-fns date. AntD DatePicker accepts Moment. React DatePicker accepts Date. DatePickerAdapter converts app's Date to picker-specific type.


### A user schedules a meeting for 3 PM in New York. What should be stored?

- [ ] A: 3 PM as local time string

- [✓] B: UTC timestamp + IANA timezone (America/New_York)

- [ ] C: UTC timestamp only

- [ ] D: Unix timestamp only


**Answer:** B

Store UTC timestamp (absolute point in time) + IANA timezone (original context). Timezone is needed to display '3 PM ET' and to convert to other timezones. UTC alone loses original timezone context.


### DurationAdapter covers addDuration, formatDuration, humanized duration. What makes formatDuration tricky across libraries?

- [ ] A: Duration formatting is standardized

- [✓] B: Libraries produce different output ('2 hours 30 minutes' vs '2h 30m' vs '150 minutes') — need locale-appropriate humanization

- [ ] C: Durations cannot be formatted

- [ ] D: Only Day.js supports duration formatting


**Answer:** B

formatDuration output varies by library and locale. date-fns formatDuration returns '2 hours 30 minutes'. Day.js humanize returns '2 hours'. Temporal with Intl returns locale-specific. Adapter standardizes output format.


### When would you NOT abstract date library behind adapter?

- [✓] A: When app uses only Date.now() and simple toString()

- [ ] B: When app is used globally with multiple timezones

- [ ] C: When app performs complex calendar math

- [ ] D: When app formats dates with user locale


**Answer:** A

If app only uses Date.now() and toISOString() (no formatting, no timezone, no calendar operations), abstraction is overhead. Add adapter when you call format, add, diff, or timezone functions.


---

# Module 10: Multi-Library Architecture & Migration

Est. study time: 3h
Language: en

## Learning Objectives
- Evaluate when to embed, wrap, or abstract each external library
- Design migration strategy between library versions and vendors
- Manage poly-repo vs mono-repo library versioning
- Measure library footprint, coverage, and migration cost

---

## Core Content

### Embed, Wrap, or Abstract

Every library in app needs a strategy:

| Strategy | When to use | Migration cost | Example |
|----------|------------|----------------|---------|
| **Embed** | Library unlikely to change, de-facto standard, used in 1 file | Low (one file) | React, TypeScript |
| **Wrap** | Library may change, has complex config, used across modules | Medium (wrapper file) | Data grid, Date picker |
| **Abstract** | Library will change, has competitors, used across 10+ modules | High (interface + adapter) | Charts, Maps, Date lib, Form |
| **Isolate** | Library has global side effects, version conflicts, or unstable API | Very high (module boundary) | Rich text editor, WebSocket |

Decision framework:

```
Q1: Library likely to change vendor or break? 
  No → Embed. Yes → Q2.
Q2: Library used in 3+ modules? 
  No → Wrap. Yes → Q3.
Q3: Library has realistic competitors? 
  No → Wrap. Yes → Abstract.
Q4: Library has global state or version conflicts?
  Yes → Isolate (if possible) or Abstract.
```

> **Think**: Embed → Wrap → Abstract is a spectrum, not binary. A library may start Embedded, move to Wrapped when second module uses it, and become Abstracted when migration looms. When should you skip to Abstract immediately?
>
> *Answer: Skip to Abstract when: (1) library is in high-churn category (forms, charts, maps), (2) app explicitly plans vendor evaluation, (3) library ecosystem is unstable (new major versions breaking APIs yearly).*

### Migration Strategies

**Strangler Fig Pattern**: Gradually replace library usage module by module while both coexist.

```typescript
// Phase 1: both libraries loaded, feature-flag controlled
const useNewGrid = flags?.enabled('new-data-grid')

function DataGrid<T>(props: GridProps<T>) {
  return useNewGrid
    ? <TanStackWrapper {...props} />
    : <AGridWrapper {...props} />
}
```

Steps:
1. Add new library + adapter (both loaded)
2. Move one module to new implementation behind feature flag
3. Test, fix, ship
4. Enable for all modules
5. Remove old library + adapter

**Big Bang**: Replace all at once. Riskier but faster. Use when: libraries are incompatible (cannot load both), migration is mechanical, testing is comprehensive.

**Side-by-Side**: Both libraries coexist indefinitely for different use cases. Use when: one library excels at specific feature (AG Grid pivot) not covered by replacement.

> **Think**: Feature flags + canary deploy = strangler fig. Feature flags require both libraries in bundle. How to handle bundle size impact?
>
> *Answer: Dynamic import. Load new library only when flag enabled. Code-split old library out. `const Grid = useNewGrid ? await import('new-grid') : await import('old-grid')`. However, this adds latency on first load with new flag.*

#### React 19 Migration Axis

React 19 adds new library compatibility factors: React Compiler (auto-memoization requires Rules of React), Server Components (DOM-dependent libs need "use client" boundary), ref as prop (forwardRef deprecated), use() hook for concurrent data loading.

Migration strategy: add compat layer per library. Strangler fig applies — React 18 and 19 wrappers coexist behind feature flag. Push "use client" boundaries deep, keep business logic in Server Components.

| Library type | RSC safe? | Strategy |
|-------------|-----------|----------|
| Pure utility (date-fns, zod) | Yes | Use in Server Components |
| DOM-dependent (map, chart) | No | "use client" boundary, lazy import |
| Stateful (data grid, editor) | No | "use client" boundary |
| Data fetching (TanStack Query) | Partial | Data in RSC, UI in client |

React Compiler auto-memoizes library wrappers — `React.memo` becomes optional for compiler-safe components. `use()` hook enables concurrent data loading in library-backed views with Suspense boundaries.

### Library Versioning Strategy

External libraries in one app often have conflicting version requirements:

```typescript
// Problem:
// Module A uses date-fns ^2.x
// Module B uses date-fns ^3.x (breaking: import paths changed)
// 
// Solutions:
// 1. Force single version (npm overrides) — may break Module B
// 2. Both versions coexist — duplicates bundle
// 3. Wrap date-fns behind adapter — Module A and B both use adapter
```

Adapter reduces version conflict surface. Library locked behind adapter — only adapter needs to resolve API changes.

**Mono-repo**: Single version of each library across packages. Easier but requires coordinated upgrades.

**Poly-repo**: Each repo manages own dependencies. Adapter ensures consistent API across repos.

> **Think**: Library X has breaking API changes every 6 months. Team cannot keep up with migration. What to do?
>
> *Answer: Options: (1) Fork library and apply only security patches. (2) Abstract behind adapter so API changes are isolated. (3) Evaluate alternative library with stable API. (4) Contribute to library to stabilize API.*

### Measuring Library Impact

Before migration or adoption, measure:

**Bundle footprint**: `import-cost` or `webpack-bundle-analyzer` per library.

**Import count**: `rg "from 'library'" --type ts src | wc -l`. How many files depend?

**API surface used**: grep for library-specific API calls. Count unique functions/components used vs total available.

**Migration cost estimate**: Files changed × average effort per file (1h for simple, 4h for complex, 8h for deep integration).

**Test coverage**: Do tests mock adapter or library? Adapter tests = mock adapter interface. Library tests = mock library. Adapter = cheaper to test.

```typescript
// Lightweight library audit JSON
{
  "date-fns": {
    "version": "3.0.0",
    "files": 47,         // 47 files import date-fns
    "functions": 12,     // 12 unique date-fns functions used
    "bundleKB": 15,      // tree-shaken bundle contribution
    "migration_cost_hours": 30,  // estimate to migrate off
    "risk": "medium"     // evaluation: stable, no breaking changes expected
  }
}
```

> **Think**: Library audit is valuable but rarely done. When is it worth the effort?
>
> *Answer: Worth when: (1) evaluating vendor replacement, (2) preparing for framework upgrade, (3) reducing bundle size. Not worth when: library is stable, no migration planned, team has capacity to handle ad-hoc issues.*

### Polyglot Architecture

Some apps need multiple libraries in same category for different contexts:

- Data grid: AG Grid (dashboard, rich features) + TanStack Table (export, static) 
- Charts: Recharts (standard) + D3 (custom) 
- Editor: Lexical (comments) + TipTap (full documents)

This is valid when each library serves distinct context. Overlap causes confusion. Clear internal documentation: "Use AG Grid for admin panels, TanStack Table for PDF export."

Polyglot rule: < 3 libraries per category, each with documented use case. More = governance failure.

---

### Why This Matters

Library management is the invisible tax on frontend teams. Every library adds: bundle bytes, upgrade risk, API surface to learn, migration liability. Strategic decisions about when to embed, wrap, or abstract determine whether library tax is manageable or crippling. This module gives systematic framework for those decisions.

---

### Common Questions

**Q: Should I standardize on one chart library or allow polyglot?**
A: Standardize when possible. Polyglot when justified (different contexts: dashboard vs export vs custom viz). Document each library's scope. Review every 6 months — unused library is dead weight.

**Q: My team added abstractions but now every library change requires updating adapter, mapper, AND wrapper. Is abstraction a trap?**
A: Abstraction costs are front-loaded. Adapter updates are effort during migration. Without adapter, migration is effort across all consumers. Which is larger? For 10+ consumer files, adapter wins. For 2-3 consumers, direct migration may be cheaper.

**Q: How does React 19 change embed/wrap/abstract decisions?**
A: React Compiler reduces need for manual memo wrappers — embed safer for compiler-safe libs. Server Components add isolation dimension: "use client" boundary = implicit Isolate strategy. use() hook changes data-loading abstraction. Revisit each library decision during React 19 upgrade.

**Q: Can React Compiler optimize library wrapper code?**
A: Yes for pure React components. Compiler auto-memoizes wrapper render output when props unchanged. Does not optimize imperative library interop (D3 DOM ops, map API calls, date mutation). Wrappers following Rules of React get free performance. Those with side effects in render need refactoring.

---

## Examples

### Example 1: Full App Library Audit

**Problem**: 3-year-old app has 47 npm dependencies. Team wants to reduce bundle and standardize.

**Audit result**:
- 5 date libraries (Moment.js, date-fns, Day.js, Luxon, timeago.js) — consolidate to date-fns
- 3 chart libraries (Recharts, Chart.js, D3) — keep Recharts + D3, remove Chart.js
- 2 form libraries (Formik, RHF) — standardize on RHF
- 2 drag libraries (react-beautiful-dnd, dnd-kit) — migrate to dnd-kit

**Plan**: 3-month migration. Adapters prevent regression on existing modules. New modules use target library directly.

### Example 2: Data Grid Migration (AG Grid → TanStack Table)

**Problem**: AG Grid enterprise license too expensive. Migrate to TanStack Table.

**Approach**: Strangler fig. Wrapper already abstracts grid component. New wrapper implementation uses TanStack Table + TanStack Virtual. Column definitions (AppColumnDef) unchanged. Grid state external (already). AG Grid removed module by module. Migration: 2 weeks for 40 grid usages.

### Example 3: Migrating 20+ Libraries to React 19

**Problem**: 3-year-old app with 23 external libs. 8 have no React 19 support, 5 use forwardRef (deprecated), 3 incompatible with React Compiler.

**Approach**: Audit all 23 libs against React 19 compat matrix. Wrap incompatible libs behind existing abstraction layers. Replace 3 compiler-incompatible libs with alternatives. Strangler fig: feature-flag React 19 rendering per module. Use() wrapper for data-loading libs — convert to Suspense-based loading.

**Result**: 6-week migration. Adapters saved 3 weeks. 2 libs replaced. 3 libs forked with patches upstreamed.

---

## Key Takeaways
- Embed (unlikely to change), Wrap (used across modules), Abstract (high churn, competitors), Isolate (global side effects)
- Strangler Fig: both libraries coexist behind feature flag, migrate module by module
- Big Bang: replace all at once — faster but riskier
- Adapter reduces version conflict surface — library locked behind wrapper
- Library audit: bundle footprint, import count, API surface, migration cost estimate
- Polyglot architecture: <3 libraries per category, each with documented context
- Abstraction is front-loaded cost. Adapter wins when 10+ consumer files exist.

## Common Misconception

**"We only need one library per category — standardize everything."**

Standardization reduces cognitive load but not always bundle or migration cost. A lightweight library for simple use cases (Day.js for formatting) and a full-featured library for complex use cases (Temporal for calendar math) may be smaller combined bundle than using the heavy library everywhere. Standardize on interface (Adapter), not implementation library.

---

## Feynman Explain
(Explain the Strangler Fig migration pattern to a product manager. Use analogy: replacing a bridge — build new bridge beside old one, divert traffic lane by lane, demolish old bridge when all traffic is on new one.)

---

## Reframe
(Pause. Abstraction adds complexity. For a startup iterating fast, abstraction may slow down feature development. When is it better to accept future migration cost and just embed libraries directly? How does startup vs enterprise change the embed/wrap/abstract decision?)

---

## Drill
Take the quiz. MCQs test embed/wrap/abstract decisions, migration strategies, version conflict resolution, and library audit.

Run: `learn.sh quiz external-lib-patterns 10-multi-lib-architecture`

## Quiz: 10-multi-lib-architecture


### A library is used in one file, unlikely to change, and is a de-facto standard. What strategy?

- [ ] A: Abstract — always use adapter

- [✓] B: Embed — direct dependency, no wrapper

- [ ] C: Wrap — always wrap external libraries

- [ ] D: Isolate — micro-frontend


**Answer:** B

Embed when library is stable, single-use, and unlikely to change. Wrapping adds unnecessary indirection. Example: a utility like uuid or clsx.


### What migration strategy keeps both libraries loaded simultaneously?

- [ ] A: Big Bang

- [✓] B: Strangler Fig

- [ ] C: Rewrite from scratch

- [ ] D: Do nothing


**Answer:** B

Strangler Fig gradually replaces library usage module by module while both libraries coexist behind feature flags. Big Bang replaces all at once.


### Adapter pattern solves which library versioning problem?

- [ ] A: Bundle size

- [✓] B: Different modules using different library versions — adapter provides uniform API regardless of underlying version

- [ ] C: Tree-shaking

- [ ] D: TypeScript compilation


**Answer:** B

Adapter hides library version behind common interface. Module A uses date-fns v2 adapter, Module B uses date-fns v3 adapter — both expose same DateAdapter. Version conflicts isolated inside adapter files.


### What is the primary risk of Big Bang migration?

- [ ] A: Slower than strangler fig

- [✓] B: Higher chance of regressions across entire app simultaneously

- [ ] C: Requires feature flags

- [ ] D: Cannot test in production


**Answer:** B

Big Bang replaces all at once. If migration has bugs, entire app is affected. Strangler Fig limits blast radius to one module at a time.


### Library audit reveals 5 date libraries in app. What action?

- [ ] A: Keep all — each serves different purpose

- [✓] B: Consolidate to one library; audit purpose of each, remove duplicates

- [ ] C: Remove all — use native Date

- [ ] D: Merge into one super-library


**Answer:** B

5 date libraries indicate governance failure. Audit each library's usage. Keep only those with distinct, justified purpose (e.g., date-fns for general, Temporal for calendar math). Remove duplicates.


### Polyglot chart architecture: Recharts for dashboards, D3 for custom viz. When is this problematic?

- [ ] A: Never — polyglot is always good

- [✓] B: When teams use Recharts for custom viz and D3 for dashboards — no clear boundaries

- [ ] C: When both libraries are same bundle size

- [ ] D: When using TypeScript


**Answer:** B

Polyglot works if each library has clear, documented context. Problems arise when boundaries blur — teams use wrong library for wrong task. Document: 'Recharts for standard business charts. D3 for custom visualizations only.'


### Strangler Fig requires both libraries in bundle. How to minimize bundle impact?

- [ ] A: Do not use strangler fig — bundle will be too large

- [✓] B: Dynamic import of new library when feature flag enabled; code-split old library removal

- [ ] C: Load both libraries in one chunk

- [ ] D: Compress both libraries


**Answer:** B

Dynamic import (`await import('new-lib')`) ensures old and new libraries are not loaded together unless flag is toggled. When migration completes, remove old library dynamic import is removed.


### When does wrapping every library become an anti-pattern?

- [ ] A: Never — wrap all libraries

- [✓] B: When wrapper adds no constraints, defaults, or transformations — thin wrapper indirection

- [ ] C: When any module uses more than 3 wrappers

- [ ] D: When wrapper is 100+ lines


**Answer:** B

Thin wrapper that passes every prop through adds indirection without value. Wrap when you enforce constraints, set app defaults, or transform types. Otherwise, embed directly.


### How to estimate migration cost from library A to library B?

- [ ] A: Guess — no reliable method

- [✓] B: Count files importing library A × average effort per file (based on integration depth)

- [ ] C: Count library A's API surface used vs library B's API — if similar, migration is free

- [ ] D: Migration cost always equals bundle size difference


**Answer:** B

Files × integration depth (simple import = 1h, complex component = 4h, deep lifecycle integration = 8h). API surface comparison helps but actual effort depends on integration complexity.


### Team evaluates embedding or abstracting a chart library for a new dashboard. The app currently has 2 charts in 1 file, expected to grow to 15 charts across 5 modules. What strategy?

- [ ] A: Embed — only 2 charts now, abstraction is premature

- [✓] B: Abstract — expected growth to 15 charts across multiple modules justifies adapter now

- [ ] C: Use no library — CSS-only charts

- [ ] D: Wait until 10 chart files — then abstract


**Answer:** B

With expected growth to 15 charts across 5 modules, adding abstraction early pays off. Adding it later requires retrofitting. Write adapter now, use it for initial 2 charts. When migration happens, only adapter changes.


---

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

## Quiz: 11-animation-framer-motion


### How do you add Framer Motion animations to a third-party Button component?

- [ ] A: Wrap with motion.div — but lose Button's built-in functionality

- [✓] B: Use motion(Button) — returns a motion-enhanced component

- [ ] C: Button does not support animation — use CSS instead

- [ ] D: Copy Button internals into a motion component


**Answer:** B

motion(Component) wraps any component with motion capabilities — forwards ref, accepts motion props, preserves original component's API.


### What is the purpose of AnimatePresence?

- [ ] A: Controls animation timing and easing

- [✓] B: Plays exit animations when a child component unmounts, then removes it from DOM

- [ ] C: Provides animation presets for common patterns

- [ ] D: Detects when animated elements are visible in viewport


**Answer:** B

AnimatePresence tracks children by key. When key disappears from render output, Framer Motion plays the exit animation defined on that element, then unmounts it.


### With AnimatePresence mode='popLayout', what happens during exit?

- [ ] A: Exiting element maintains its layout space until animation completes

- [✓] B: Exiting element immediately removes its layout — remaining elements animate to fill gap

- [ ] C: Exit and enter animations play simultaneously

- [ ] D: popLayout is not a valid mode


**Answer:** B

popLayout removes layout space immediately on exit, so surrounding elements animate to new positions without waiting. sync plays enter/exit simultaneously. wait plays exit then enter.


### What does layoutId enable in Framer Motion?

- [ ] A: Sorts animated elements by z-index

- [✓] B: Shares identity between separate components so Framer Motion animates position/size change as same element

- [ ] C: Assigns layout coordinates to motion elements

- [ ] D: Defines animation sequence order


**Answer:** B

layoutId tells Framer Motion that two separate components (e.g., thumbnail and modal image) represent same element. Position/size transitions animate smoothly instead of mount/unmount.


### How to respect user's reduced-motion preference in Framer Motion?

- [ ] A: Set prefers-reduced-motion: reduce in CSS

- [✓] B: Use useReducedMotion() hook — conditionally render non-animated fallback

- [ ] C: Framer Motion automatically respects reduced-motion

- [ ] D: Disable all animations via motionConfig


**Answer:** B

useReducedMotion() reads prefers-reduced-motion media query. Wrapper conditionally renders children without motion props when user prefers reduced motion.


### Which animation property avoids triggering layout recalculations?

- [ ] A: width

- [ ] B: height

- [ ] C: top

- [✓] D: transform


**Answer:** D

Transform and opacity are GPU-composited — they do not trigger layout or paint recalculations. Width, height, top, left all trigger layout recalc on each frame.


### Two list items swap positions but share same key. What happens?

- [ ] A: AnimatePresence plays exit animation for first, enter for second

- [✓] B: Framer Motion treats them as same element — layout animates position change without mount/unmount

- [ ] C: Items do not animate — keys must be unique

- [ ] D: Both items animate independently to new positions


**Answer:** B

Same key = same element identity. Framer Motion uses layout animation (if layout prop set) to move element from old to new position. AnimatePresence is not involved in same-key swaps.


### What does variants' staggerChildren property do?

- [✓] A: Animates each child with a delay relative to previous child's animation start

- [ ] B: Groups children into animation batches

- [ ] C: Randomizes animation order for visual variety

- [ ] D: Pauses animations on hover


**Answer:** A

staggerChildren creates cascading delay: child 1 animates, then child 2 after staggerChildren delay, then child 3, etc. delayChildren adds initial delay before first child starts.


### Which transition type produces natural-feeling UI animations?

- [ ] A: tween — predictable, linear

- [✓] B: spring — natural motion based on physics (stiffness, damping, mass)

- [ ] C: inertia — velocity-based deceleration

- [ ] D: keyframes — multi-step sequence


**Answer:** B

Spring produces natural feel because real-world objects have mass, stiffness, and damping. Tween is predictable but can feel robotic. Inertia is for drag deceleration. Keyframes for multi-step.


### When wrapping a third-party component with motion(), what must be forwarded?

- [ ] A: Children prop only

- [✓] B: ref — motion components require ref forwarding for layout measurement and gesture tracking

- [ ] C: style prop only

- [ ] D: key prop only


**Answer:** B

motion() requires forwarded ref for internal layout measurement, gesture detection, and scroll tracking. Without ref forwarding, motion props like layout, drag, and whileInView will not work.


---

# Module 12: Routing — TanStack Router

Est. study time: 2h
Language: en

## Learning Objectives
- Define type-safe route trees with TypeScript generics
- Parse and validate search params with zod schemas
- Implement nested layouts with Outlet and route groups
- Add route-level code splitting with lazy()
- Build route guards and middleware with beforeLoad

---

## Core Content

### TanStack Router Architecture

TanStack Router is the first type-safe router for React. Key concepts:
- Route tree defined as TypeScript tree structure (not config object)
- Full type inference — params, search, path, loader data all typed
- File-based routing (optional via `@tanstack/react-router-plugin`)
- First-class search param validation (zod, valibot, or custom)

```typescript
import { Router, Route, RootRoute } from '@tanstack/react-router'
import { z } from 'zod'

const rootRoute = new RootRoute()

const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const productListRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'products',
  component: ProductList,
})

const productDetailRoute = new Route({
  getParentRoute: () => productListRoute,
  path: '$productId',
  component: ProductDetail,
  validateSearch: z.object({
    tab: z.enum(['details', 'reviews', 'specs']).optional().default('details'),
    from: z.string().optional(),
  }),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  productListRoute.addChildren([productDetailRoute]),
])

const router = new Router({ routeTree })
export type AppRouter = typeof router
```

### Type-Safe Route Tree

Every route in TanStack Router generates types:

```typescript
// Type-safe navigation — invalid path is compile error
function Nav() {
  const navigate = useNavigate()

  return (
    <button onClick={() => navigate({ to: '/products/$productId', params: { productId: '123' }, search: { tab: 'reviews' } })}>
      View Product
    </button>
  )
}

// Type-safe link
<Link
  to="/products/$productId"
  params={{ productId: '123' }}
  search={{ tab: 'details', from: '/home' }}
  activeProps={{ className: 'font-bold' }}
>
  Product 123
</Link>
```

Router type must be exported and used across app:

```typescript
// app/router.ts
export const router = new Router({ routeTree })
export type AppRouter = typeof router

// main.tsx
import { RouterProvider } from '@tanstack/react-router'
import { router } from './app/router'

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
```

### Search Params with Zod

Search params are first-class citizens — not just query string strings:

```typescript
const productListRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'products',
  validateSearch: z.object({
    q: z.string().optional().catch(undefined),
    page: z.coerce.number().int().positive().optional().default(1),
    sort: z.enum(['name', 'price', 'date']).optional().default('name'),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
    category: z.array(z.string()).optional().catch([]),
  }),
})
```

`catch()` handles malformed values silently. `default()` sets value when param is absent. `z.coerce.number()` handles string → number conversion from URL.

Using search params in component:

```typescript
function ProductFilters() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <div>
      <input
        value={search.q ?? ''}
        onChange={e => navigate({ search: prev => ({ ...prev, q: e.target.value || undefined }) })}
      />
      <select
        value={search.sort}
        onChange={e => navigate({ search: prev => ({ ...prev, sort: e.target.value as SortOption }) })}
      >
        <option value="name">Name</option>
        <option value="price">Price</option>
      </select>
    </div>
  )
}
```

> **Think**: Zod search validation lives in route definition. What happens when search validation changes and user has invalid URL in browser history?
>
> *Answer: `catch()` returns fallback instead of throwing. Without catch, invalid search causes route error which TanStack Router catches and redirects to error boundary. Design search schemas to be backward-compatible or use migration pattern.*

### Nested Layouts with Outlet

Routes form parent-child tree. Parent renders `<Outlet />` for child content:

```typescript
const rootRoute = new RootRoute({
  component: () => (
    <div>
      <AppHeader />
      <main>
        <Outlet />
      </main>
      <AppFooter />
    </div>
  ),
})

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'dashboard',
  component: () => (
    <div style={{ display: 'flex' }}>
      <DashboardSidebar />
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  ),
})
```

Layout components receive `useMatches()` for breadcrumbs:

```typescript
function Breadcrumbs() {
  const matches = useMatches()
  return (
    <nav>
      {matches.map(m => (
        <Link key={m.routeId} to={m.routeId} params={m.params}>
          {m.routeId}
        </Link>
      ))}
    </nav>
  )
}
```

### Route-Level Code Splitting

Combine with `React.lazy()` or dynamic import:

```typescript
const SettingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: React.lazy(() => import('./pages/settings')),
  pendingComponent: () => <SettingsSkeleton />,
})
```

TanStack Router has built-in pending state support:

```typescript
const heavyRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'analytics',
  component: AnalyticsDashboard,
  pendingComponent: DashboardSkeleton,
  loader: async () => {
    const data = await fetchAnalytics()
    return data
  },
  wrapInSuspense: true, // wraps loader in Suspense boundary
})
```

### Loaders and Data Fetching

Route loaders run before component renders:

```typescript
const productDetailRoute = new Route({
  getParentRoute: () => productListRoute,
  path: '$productId',
  component: ProductDetail,
  loader: async ({ params: { productId } }) => {
    const product = await api.getProduct(productId)
    return { product }
  },
  errorComponent: ProductError,
  pendingComponent: ProductSkeleton,
})

function ProductDetail() {
  const { product } = Route.useLoaderData()
  return <div>{product.name}</div>
}
```

Data persists across navigation — re-fetches only when route deactivates/reactivates. Use `preload()` for prefetching:

```typescript
<Link
  to="/products/$productId"
  params={{ productId: id }}
  preload="intent" // hover-dependent preload
>
  {name}
</Link>
```

### Route Guards / Middleware

`beforeLoad` runs before route loads. Return redirect or throw to block:

```typescript
const authRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'admin',
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw router.navigate({ to: '/login', search: { redirect: location.href } })
    }
    if (!context.auth.hasRole('admin')) {
      throw router.navigate({ to: '/403' })
    }
  },
  component: AdminDashboard,
})
```

Context injection via Router:

```typescript
const router = new Router({
  routeTree,
  context: { auth: authService },
})

// Type-safe context
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

> **Think**: beforeLoad runs on every navigation to guarded route. How to skip guard for same-route param changes?
>
> *Answer: beforeLoad runs on route activation only (not param changes within same route). For param-based guards, use useBlocker or useEffect in component. TanStack Router distinguishes route activation vs param update.*

---

### Why This Matters

React Router is the most-used router but lacks type safety — params, search, and loader data are `any`. TanStack Router catches routing errors at compile time: missing params, invalid search values, mismatched loader types. For apps with complex routing (nested layouts, search-heavy pages, auth guards), type safety eliminates an entire class of runtime errors.

---

### Common Questions

**Q: TanStack Router vs React Router — which to choose?**
A: TanStack Router for: type safety, zod search validation, nested layouts, first-class loaders. React Router for: simpler apps, SSR-heavy projects (Remix), smaller bundle. Migration from React Router is incremental — wrap existing routes gradually.

**Q: How to handle modals with routing?**
A: Nested routes under parent overlay. Modal route renders modal component. Use `router.history.push` for modal open, `router.history.go(-1)` for close. Search param for modal state: `?modal=create-product`.

**Q: Does TanStack Router work with Next.js App Router?**
A: No — Next.js App Router replaces TanStack Router. Use TanStack Router with Vite, CRA, or custom SSR. For Next.js, use built-in router.

---

## Examples

### Example 1: Product Catalog with Search, Pagination, and Filters

**Problem**: Products page with URL-driven search/filter/sort/pagination. All state in URL — shareable, bookmarkable.

**Solution**:
```typescript
const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().default(1),
  sort: z.enum(['name', 'price', 'date']).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  minPrice: z.coerce.number().optional().catch(undefined),
  maxPrice: z.coerce.number().optional().catch(undefined),
})

const catalogRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'catalog',
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps: { search } }) => {
    const products = await api.searchProducts(search)
    return { products }
  },
  component: CatalogPage,
})

function CatalogPage() {
  const { products } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()

  function setPage(page: number) {
    navigate({ search: prev => ({ ...prev, page }) })
  }

  return <ProductGrid products={products} page={search.page} onPageChange={setPage} />
}
```

### Example 2: Multi-Step Onboarding Flow

**Problem**: Wizard-style onboarding with 3 steps. Each step is separate route. Back/forward preserves state. Final step submits.

**Solution**:
```typescript
const onboardingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'onboarding',
  component: () => (
    <div>
      <ProgressBar />
      <Outlet />
    </div>
  ),
})

const step1Route = new Route({
  getParentRoute: () => onboardingRoute,
  path: 'profile',
  component: ProfileStep,
})

const step2Route = new Route({
  getParentRoute: () => onboardingRoute,
  path: 'preferences',
  component: PreferencesStep,
})

const step3Route = new Route({
  getParentRoute: () => onboardingRoute,
  path: 'confirm',
  component: ConfirmStep,
  loader: async () => {
    // Validate all previous steps before showing confirm
    return { isComplete: true }
  },
})
```

---

## Key Takeaways
- Route tree is TypeScript tree — full type inference for params, search, loader data
- `validateSearch` with zod catches malformed search params, provides defaults
- Nested routes with `<Outlet />` build layout hierarchies
- `beforeLoad` runs auth guards, redirects, context injection
- `loader` fetches data before render — integrates with Suspense via `wrapInSuspense`
- Code split with `React.lazy(() => import('./page'))` + `pendingComponent`
- Preload routes with `preload="intent"` for instant navigation

## Common Misconception

**"TanStack Router is just React Router with more TypeScript."**

TanStack Router fundamentally changes routing architecture: (1) route tree as code (not config), (2) search params are first-class with validation, (3) loaders integrate with Suspense and error boundaries, (4) full type inference eliminates `any` casts. React Router v7 (formerly Remix) has added some type safety, but does not match TanStack Router's depth.

---

## Feynman Explain
(Explain TanStack Router's type safety to a React Router user: "Every `useParams()` call in React Router returns `Record<string, string | undefined>`. You either cast or risk runtime crash. In TanStack Router, the param types are known at compile time from the route tree definition. Same for search params, loader data, and context.")

---

## Reframe
(Pause. Type-safe routing is compelling. What about projects with simple routing (5 routes, no search params, no auth guards)? Does TanStack Router's route tree API add unnecessary ceremony? Consider: bundle size ~12KB vs React Router ~7KB, learning curve for junior devs, migration cost from existing router.)

---

## Drill
Take the quiz. MCQs test route tree definition, search validation, loaders, nested layouts, and route guards.

Run: `learn.sh quiz external-lib-patterns 12-routing-tanstack-router`

## Quiz: 12-routing-tanstack-router


### How does TanStack Router define route relationships?

- [ ] A: Flat config object with nested path strings

- [✓] B: Route tree — each Route instance declares its parent via getParentRoute()

- [ ] C: File system directory structure

- [ ] D: JSON route manifest imported at build time


**Answer:** B

Each Route declares getParentRoute() returning its parent route. Tree structure enables full type inference: params, search, loader data flow down the tree with correct types.


### What happens when a search param fails zod validation?

- [ ] A: Router throws error — app crashes

- [ ] B: Invalid param is silently dropped

- [✓] C: Depends on schema method — catch() returns fallback, otherwise route error boundary catches

- [ ] D: Search params are not validated at runtime


**Answer:** C

catch() returns fallback for invalid values. Without catch, validation error triggers route error boundary — errorComponent renders. This prevents malformed URLs from breaking the app.


### How does a parent layout render its child route content?

- [ ] A: Props.children — child component is passed as children

- [✓] B: <Outlet /> — renders active child route component

- [ ] C: React Router's <Routes> component

- [ ] D: Child route is rendered automatically without explicit placeholder


**Answer:** B

Parent route component renders <Outlet /> as placeholder. TanStack Router injects matched child route's component into Outlet. Supports arbitrary nesting depth.


### What does beforeLoad return to redirect user to login?

- [ ] A: Return false

- [ ] B: Return { redirect: '/login' }

- [✓] C: Throw router.navigate({ to: '/login' })

- [ ] D: Return null


**Answer:** C

Throwing router.navigate() from beforeLoad aborts current navigation and redirects. TanStack Router catches the navigate throw in beforeLoad and executes the redirect.


### How to access loader data in a route component?

- [✓] A: Route.useLoaderData() — returns typed loader data

- [ ] B: useLoaderData() — untyped, must cast

- [ ] C: Props.match.data

- [ ] D: window.__LOADER_DATA__


**Answer:** A

Route.useLoaderData() is a hook on the route instance. Return type matches loader's return type — full inference. No casting needed.


### How does TanStack Router handle same-route param changes (e.g., product/1 to product/2)?

- [ ] A: Unmounts and remounts component

- [✓] B: Keeps component mounted — useParams hook updates reactively. beforeLoad does not re-run.

- [ ] C: Runs beforeLoad again for each param change

- [ ] D: Requires window.location.reload()


**Answer:** B

Param changes within same route pattern keep component mounted. useParams and useSearch reactively update. beforeLoad only runs on route activation, not param changes within same route.


### What is the purpose of loaderDeps in a route definition?

- [✓] A: Declares dependencies from search/params that should trigger loader re-run

- [ ] B: Lists npm dependencies the route needs

- [ ] C: Defines type-only dependencies for TypeScript

- [ ] D: Specifies static paths the loader depends on


**Answer:** A

loaderDeps returns a memoized object from search/params. When deps change (same route, different search), loader re-runs. Without loaderDeps, loader only runs on route activation.


### How to code-split a route component in TanStack Router?

- [ ] A: Router handles code splitting automatically

- [✓] B: Use React.lazy(() => import('./page')) as route component

- [ ] C: Split route definitions into separate files

- [ ] D: Use dynamic() from next/dynamic


**Answer:** B

Route component accepts React.lazy() result. Combine with pendingComponent for loading UI and wrapInSuspense: true for Suspense integration.


### Which hook provides access to current route's search params?

- [ ] A: useSearchParams()

- [✓] B: Route.useSearch() — returns typed search object from validateSearch schema

- [ ] C: useQuery()

- [ ] D: useLocation().search


**Answer:** B

Route.useSearch() returns validated search object matching the route's validateSearch schema. TypeScript infers exact shape — no type assertions.


### How does TanStack Router handle route context injection?

- [ ] A: React Context provider nested in route tree

- [✓] B: Router constructor context option — typed via module augmentation (Register interface)

- [ ] C: Global singleton accessed in loader

- [ ] D: Props drilling from RootRoute


**Answer:** B

Context is passed to Router constructor and typed via `declare module '@tanstack/react-router' { interface Register { router: typeof router } }`. beforeLoad and loaders access context through their parameters.


---

# Module 13: File Upload — Uppy

Est. study time: 1.5h
Language: en

## Learning Objectives
- Integrate Uppy Dashboard as React component with proper lifecycle management
- Configure Tus resumable upload protocol for large files
- Register remote sources via Companion (Google Drive, Dropbox, etc.)
- Build file restriction hooks (size, type, count) with user feedback
- Design upload state tracking layer that decouples from Uppy events

---

## Core Content

### Uppy Architecture

Uppy is a modular file upload framework. Core concepts:

- **Core (`@uppy/core`)**: Event-driven upload engine. Manages file state, restrictions, upload pipeline
- **Dashboard (`@uppy/dashboard`)**: Built-in UI with drag-drop, file preview, progress, and provider tabs
- **Tus (`@uppy/tus`)**: Resumable upload via Tus protocol (pause/resume, chunking, network recovery)
- **Companion**: Server-side helper that proxies remote provider APIs (Google Drive, Dropbox, Instagram)

```
React App
  └── Uppy Dashboard (React wrapper)
        └── Uppy Core
              ├── Local files (file input / drag-drop)
              ├── Camera (webcam capture)
              ├── URL (remote URL download)
              └── Companion (Google Drive, Dropbox, Instagram, etc.)
                    └── Tus (resumable upload to server)
```

### Uppy React Integration

Uppy is vanilla JS with React wrapper. Lifecycle must be managed manually:

```typescript
import Uppy from '@uppy/core'
import Dashboard from '@uppy/dashboard'
import Tus from '@uppy/tus'
import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'

function Uploader() {
  const uppy = useMemo(() => {
    return new Uppy({
      restrictions: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxNumberOfFiles: 10,
        allowedFileTypes: ['.pdf', '.docx', '.png', '.jpg'],
      },
      autoProceed: false,
    })
      .use(Dashboard, {
        inline: true,
        target: document.body,
        showProgressDetails: true,
        proudlyDisplayPoweredByUppy: false,
      })
      .use(Tus, { endpoint: 'https://api.example.com/uploads' })
  }, [])

  useEffect(() => {
    return () => uppy.close()
  }, [uppy])

  return <div ref={el => { if (el && !el.hasChildNodes()) uppy.getPlugin('Dashboard').mount(el) }} />
}
```

Better: reusable `UppyUploader` component:

```typescript
interface UppyUploaderProps {
  endpoint: string
  restrictions?: UppyOptions['restrictions']
  onComplete?: (result: UploadResult) => void
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void
  companionUrl?: string
}

function UppyUploader({ endpoint, restrictions, onComplete, onProgress, companionUrl }: UppyUploaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uppyRef = useRef<Uppy | null>(null)

  useEffect(() => {
    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 50 * 1024 * 1024,
        maxNumberOfFiles: 10,
        ...restrictions,
      },
      autoProceed: false,
    })
      .use(Dashboard, { inline: true, target: containerRef.current!, showProgressDetails: true, proudlyDisplayPoweredByUppy: false })
      .use(Tus, { endpoint })

    if (companionUrl) {
      uppy.use(GoogleDrive, { companionUrl })
      uppy.use(Dropbox, { companionUrl })
    }

    uppy.on('complete', (result) => onComplete?.(result))
    uppy.on('progress', (bytesUploaded, bytesTotal) => onProgress?.(bytesUploaded, bytesTotal))

    uppyRef.current = uppy

    return () => { uppy.close({ removeFiles: true }) }
  }, [endpoint, companionUrl])

  return <div ref={containerRef} />
}
```

> **Think**: useEffect dependency array includes endpoint and companionUrl but not restrictions. Why?
>
> *Answer: restrictions object is recreated every render. Including it in deps would re-create Uppy on every render. Stable reference for restrictions via useMemo or omit — restrictions are configuration, not reactive state.*

### Tus Resumable Upload Protocol

Tus splits files into chunks. If upload interrupted (network loss, tab close), resumes from last confirmed chunk:

```typescript
.use(Tus, {
  endpoint: 'https://api.example.com/tus',
  chunkSize: 5 * 1024 * 1024, // 5MB chunks
  retryDelays: [0, 1000, 3000, 5000],
  removeFingerprintOnSuccess: true,
  headers: { Authorization: `Bearer ${token}` },
  onShouldRetry: (err, retryAttempt, options) => {
    if (err?.cause?.status === 403) return false // auth error — do not retry
    return true
  },
})
```

Server-side (Node.js with tus-node-server):

```typescript
import { Server } from '@tus/server'
import { FileStore } from '@tus/file-store'

const server = new Server({
  path: '/uploads',
  datastore: new FileStore({ directory: './uploads' }),
  onUploadCreate: async (req, res, upload) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token || !isValidToken(token)) {
      throw new Error('Unauthorized')
    }
  },
})

server.listen(3000)
```

### Companion — Remote File Sources

Companion is Node.js middleware that proxies OAuth flows for cloud providers:

```typescript
// server/companion.js
import { app } from '@uppy/companion'

const options = {
  providerOptions: {
    google: { key: process.env.GOOGLE_KEY, secret: process.env.GOOGLE_SECRET },
    dropbox: { key: process.env.DROPBOX_KEY, secret: process.env.DROPBOX_SECRET },
    drive: { key: process.env.GOOGLE_DRIVE_KEY, secret: process.env.GOOGLE_DRIVE_SECRET },
  },
  server: { host: 'localhost:3020', protocol: 'http' },
  filePath: './companion-files',
  secret: 'shhh-its-a-secret',
}

app(options).listen(3020)
```

In browser:

```typescript
.use(GoogleDrive, { companionUrl: 'http://localhost:3020' })
.use(Dropbox, { companionUrl: 'http://localhost:3020' })
```

Companion handles OAuth token exchange and file streaming — files never pass through companion server (streams directly to upload destination via Tus).

> **Think**: Self-host Companion vs use Uppy Cloud (companion.uppy.io)? What factors?
>
> *Answer: Self-host for: production apps, custom auth, data sovereignty, no rate limits. Uppy Cloud for: prototyping, small internal tools, low volume. Self-hosting adds operational cost (OAuth credentials, server maintenance, scaling).*

### Event-Driven Upload Tracking

Uppy emits events throughout upload lifecycle. Abstraction layer decouples app from Uppy events:

```typescript
interface UploadTracker {
  files: Map<string, { name: string; progress: number; status: 'pending' | 'uploading' | 'done' | 'error' }>
  totalProgress: number
  isUploading: boolean
}

function useUploadTracker(uppy: Uppy | null): UploadTracker {
  const [state, setState] = useState<UploadTracker>({ files: new Map(), totalProgress: 0, isUploading: false })

  useEffect(() => {
    if (!uppy) return

    const handlers = {
      'file-added': (file: UppyFile) => {
        setState(prev => {
          const files = new Map(prev.files)
          files.set(file.id, { name: file.name, progress: 0, status: 'pending' })
          return { ...prev, files }
        })
      },
      'upload-progress': (file: UppyFile, progress: { bytesUploaded: number; bytesTotal: number }) => {
        setState(prev => {
          const files = new Map(prev.files)
          const existing = files.get(file.id)
          if (existing) files.set(file.id, { ...existing, progress: Math.round((progress.bytesUploaded / progress.bytesTotal) * 100), status: 'uploading' })
          return { ...prev, files, isUploading: true }
        })
      },
      'complete': (result: UploadResult) => {
        setState(prev => {
          const files = new Map(prev.files)
          result.successful.forEach(f => files.set(f.id, { name: f.name, progress: 100, status: 'done' }))
          result.failed.forEach(f => files.set(f.id, { name: f.name, progress: 0, status: 'error' }))
          return { ...prev, files, isUploading: false, totalProgress: 100 }
        })
      },
      'total-progress': (progress: number) => {
        setState(prev => ({ ...prev, totalProgress: progress }))
      },
    }

    Object.entries(handlers).forEach(([event, handler]) => uppy.on(event as any, handler))
    return () => { Object.entries(handlers).forEach(([event, handler]) => uppy.off(event as any, handler)) }
  }, [uppy])

  return state
}
```

### Restrictions and Validation

```typescript
const uppy = new Uppy({
  restrictions: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxNumberOfFiles: 5,
    minNumberOfFiles: 1,
    allowedFileTypes: ['image/*', '.pdf', '.zip'],
  },
  onBeforeFileAdded: (currentFile: UppyFile, files: Record<string, UppyFile>) => {
    if (currentFile.size > 200 * 1024 * 1024) {
      uppy.info(`File too large: ${currentFile.name} (max 200MB)`, 'error', 5000)
      return false
    }
    if (Object.keys(files).length >= 10) {
      uppy.info('Max 10 files', 'error', 5000)
      return false
    }
    return true
  },
  onBeforeUpload: (files: Record<string, UppyFile>) => {
    const totalSize = Object.values(files).reduce((sum, f) => sum + f.size, 0)
    if (totalSize > 500 * 1024 * 1024) {
      uppy.info('Total upload size exceeds 500MB', 'error', 5000)
      return false
    }
    return true
  },
})
```

---

### Why This Matters

File upload is deceptively complex: large files need chunking, network interruptions need resume, remote sources need OAuth, progress needs real-time UI. Uppy handles all of this. Without abstraction, upload logic scatters across components with ad-hoc file inputs and fragile XMLHttpRequest wrappers.

---

### Common Questions

**Q: Uppy vs react-dropzone + fetch — when to use which?**
A: react-dropzone for simple file selection with custom UI. Add Uppy when: large files (Tus resumable), remote sources (Google Drive/Dropbox), progress UI, image preview/editing, batch uploads, server retry logic.

**Q: How to style Uppy Dashboard?**
A: Uppy uses CSS custom properties: `--upply-primary-color`, `--upply-secondary-color`, etc. Override in your CSS. For deep customization, use `Dashboard` with `inline: false` and `trigger: #custom-trigger` to show only the trigger button, render custom modal.

**Q: Does Uppy work with serverless (Vercel, AWS Lambda)?**
A: Tus requires persistent storage for upload state — not ideal for serverless. Options: (1) Use multipart uploads instead of Tus, (2) Use S3 multipart directly via `@uppy/aws-s3`, (3) Run Companion and Tus server as long-running process.

---

## Examples

### Example 1: Avatar Upload with Crop and Preview

**Problem**: User uploads profile photo. Must be image, max 5MB, aspect ratio 1:1. Show preview before upload.

**Solution**:
```typescript
function AvatarUpload({ onUpload }: { onUpload: (url: string) => void }) {
  const uppy = useMemo(() => new Uppy({
    restrictions: { maxFileSize: 5 * 1024 * 1024, allowedFileTypes: ['image/*'], maxNumberOfFiles: 1 },
    autoProceed: false,
  })
    .use(Dashboard, { inline: true, showProgressDetails: true, height: 300 })
    .use(ImageEditor, { cropperOptions: { aspectRatio: 1, viewMode: 1 } })
    .use(Tus, { endpoint: '/api/avatars' }), [])

  useEffect(() => {
    uppy.on('complete', (result) => { if (result.successful[0]) onUpload(result.successful[0].uploadURL) })
    return () => uppy.close()
  }, [uppy, onUpload])

  return <DashboardModal uppy={uppy} open={true} />
}
```

### Example 2: Batch Document Upload with Categorization

**Problem**: Legal document upload. Files sorted into categories (contract, NDA, addendum). Upload as batch.

**Solution**:
```typescript
function DocumentUploader({ matterId }: { matterId: string }) {
  const [category, setCategory] = useState<'contract' | 'nda' | 'addendum'>('contract')

  const uppy = useMemo(() => new Uppy({
    restrictions: { maxFileSize: 100 * 1024 * 1024, allowedFileTypes: ['.pdf', '.docx'] },
  })
    .use(Dashboard, { inline: true })
    .use(Tus, { endpoint: `/api/matters/${matterId}/documents?category=${category}` }), [matterId, category])

  return (
    <div>
      <select value={category} onChange={e => setCategory(e.target.value as typeof category)}>
        <option value="contract">Contract</option>
        <option value="nda">NDA</option>
        <option value="addendum">Addendum</option>
      </select>
      <Dashboard uppy={uppy} />
    </div>
  )
}
```

---

## Key Takeaways
- Uppy Core is event-driven engine. Dashboard provides UI. Tus enables resumable uploads.
- React wrapper must manage lifecycle: create Uppy in useMemo, mount Dashboard in useEffect, cleanup in useEffect return.
- Companion proxies remote providers (Google Drive, Dropbox). Self-host for production.
- App-level upload state tracker decouples from Uppy events — enables custom progress UI.
- Restrictions (size, type, count) configured in Core. onBeforeFileAdded for custom validation.
- Tus chunks files (default 5MB) with retry delays. Server needs tus-node-server or compatible.

## Common Misconception

**"Tus is just for large files."**

Tus resumable upload helps any file upload — even 100KB files benefit from network interruption recovery. Tus also provides: upload metadata, parallel chunks, server-side validation before upload starts, and standardized protocol that works across any tus-compatible server.

---

## Feynman Explain
(Explain Tus protocol to a backend developer: "Tus splits file into chunks. Server stores each chunk. If upload fails midway, client asks 'which chunks do you have?' and sends only missing chunks. Like resume download in browsers, but for uploads.")

---

## Reframe
(Pause. File upload component is complex — Uppy alone is ~50KB gzipped, Companion is a Node.js server. For an internal tool that uploads <1MB CSVs to a single endpoint, is Uppy overkill? Consider: plain `<input type=file>` + fetch multipart upload handles this in 10 lines. When does file upload complexity justify library cost?)

---

## Drill
Take the quiz. MCQs test Uppy lifecycle integration, Tus protocol, Companion setup, restrictions API, and upload tracking abstraction.

Run: `learn.sh quiz external-lib-patterns 13-file-upload-uppy`

## Quiz: 13-file-upload-uppy


### How should Uppy instance lifecycle be managed in React?

- [ ] A: Create new Uppy() on every render — close in useEffect

- [✓] B: useMemo with empty deps for creation, useEffect return for cleanup

- [ ] C: Global singleton — create once at module level

- [ ] D: React ref with useEffect for creation and cleanup


**Answer:** B

useMemo preserves Uppy instance across renders. Empty deps = create once. useEffect return calls uppy.close() to clean up files, events, and DOM on unmount.


### What problem does Tus protocol solve?

- [ ] A: Faster uploads via parallel connections

- [✓] B: Resumable uploads — file upload continues from last confirmed chunk after interruption

- [ ] C: Server-side file processing pipeline

- [ ] D: Client-side file encryption before upload


**Answer:** B

Tus splits uploads into chunks. Client tracks which chunks server acknowledged. On resume, client sends only unacknowledged chunks. Protocol is standardized (tus.io).


### What is Uppy Companion?

- [ ] A: Browser extension for debugging Uppy uploads

- [✓] B: Server-side middleware that proxies remote file providers (Google Drive, Dropbox)

- [ ] C: Alternative to Uppy Dashboard with different UI

- [ ] D: File compression service for images before upload


**Answer:** B

Companion is Node.js server middleware that handles OAuth flows and file streaming for remote providers. Files stream directly from provider to upload destination without passing through companion.


### How to restrict file types before upload starts?

- [ ] A: Validate in server endpoint — reject response

- [✓] B: Uppy restrictions.allowedFileTypes filters file picker and file drop

- [ ] C: CSS hidden input accept attribute only

- [ ] D: TypeScript type checking on File object


**Answer:** B

allowedFileTypes filters both file dialog (accept attribute) and programmatic/file-drop additions. Uses glob patterns: 'image/*', '.pdf'. onBeforeFileAdded for additional custom validation.


### What is the disadvantage of relying on Uppy Dashboard's built-in progress UI?

- [ ] A: Dashboard progress is not real-time

- [✓] B: Couples upload UI to Uppy — switching upload library requires replacing UI

- [ ] C: Dashboard does not support percentage display

- [ ] D: No disadvantage — Dashboard UI is fully customizable


**Answer:** B

Dashboard provides complete UI including progress, preview, retry. Switching to different upload library means replacing all Dashboard-related code. App-level upload state tracker decouples UI from library.


### Which Uppy event provides real-time per-file upload percentage?

- [ ] A: file-added

- [✓] B: upload-progress — provides bytesUploaded and bytesTotal per file

- [ ] C: complete

- [ ] D: total-progress


**Answer:** B

upload-progress fires per file with { bytesUploaded, bytesTotal }. Calculate percentage: Math.round(bytesUploaded / bytesTotal * 100). total-progress provides aggregate across all files.


### When should you self-host Uppy Companion instead of using Uppy Cloud?

- [ ] A: Always — Uppy Cloud adds latency

- [✓] B: When OAuth credentials, data sovereignty, or production-scale reliability is required

- [ ] C: Companion cannot be self-hosted

- [ ] D: Uppy Cloud is the only option — Companion is deprecated


**Answer:** B

Self-hosting gives control over OAuth secrets, data flow, and scaling. Uppy Cloud is convenient for prototyping but imposes rate limits and shares OAuth credentials across tenants.


### What does onBeforeFileAdded return to reject a file?

- [ ] A: Throw an error

- [✓] B: Return false

- [ ] C: Return null

- [ ] D: Call reject() on the file object


**Answer:** B

onBeforeFileAdded returns false to reject file. Use uppy.info() to show user-friendly error message. Can also modify file object (e.g., add metadata) before returning true.


### Why might Tus not be ideal for serverless environments?

- [ ] A: Tus does not work with HTTP

- [✓] B: Tus requires persistent storage for upload state — serverless functions are stateless

- [ ] C: Tus only works with Node.js servers

- [ ] D: Tus is deprecated in favor of multipart uploads


**Answer:** B

Tus upload protocol expects server to store chunk state on disk or database. Serverless functions (Vercel, Lambda) are ephemeral. Workaround: use @uppy/aws-s3 or @uppy/multipart for serverless.


### How does Uppy handle retry after upload failure?

- [ ] A: User must manually re-add files

- [✓] B: Tus plugin retries with configured delays. Server must support Tus protocol for resume.

- [ ] C: Uppy does not support retry

- [ ] D: Retry is handled by browser's built-in retry mechanism


**Answer:** B

Tus plugin configures retryDelays array. On failure, Uppy waits then retries. If server supports Tus resume, it continues from last chunk. If server does not, it restarts from beginning.


---

# Module 14: Toast & Notifications — Sonner

Est. study time: 1h
Language: en

## Learning Objectives
- Integrate Sonner Toaster component with app-wide defaults
- Build typed toast helper functions for consistent notifications
- Implement promise-toast pattern for async operations
- Configure stacked vs expanded notification mode
- Customize toast appearance with CSS variables

---

## Core Content

### Sonner Architecture

Sonner is a minimal toast library for React. Key traits:
- Single `<Toaster />` component placed in app root
- Imperative API: `toast.success()`, `toast.error()`, `toast.promise()`
- Swipe-to-dismiss, stackable, rich content via JSX
- CSS-variable driven styling, no CSS-in-JS dependency
- ~5KB gzipped

```typescript
import { Toaster, toast } from 'sonner'

function App() {
  return (
    <div>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        expand
        visibleToasts={5}
      />
      <MainContent />
    </div>
  )
}

// Anywhere in app:
toast.success('File uploaded')
toast.error('Upload failed')
toast.info('Processing...')
toast.warning('Disk space low')
```

### App-Level Toast Helpers

Raw `toast.success()` is untyped and scattered. Typed helpers enforce consistency:

```typescript
// app/notifications.ts
import { toast } from 'sonner'

type ToastAction = {
  label: string
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface NotifyOptions {
  description?: string
  duration?: number
  action?: ToastAction
  dismissible?: boolean
}

function notifySuccess(message: string, options?: NotifyOptions) {
  return toast.success(message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
    action: options?.action ? {
      label: options.action.label,
      onClick: options.action.onClick,
    } : undefined,
    dismissible: options?.dismissible ?? true,
  })
}

function notifyError(message: string, options?: NotifyOptions) {
  return toast.error(message, {
    description: options?.description,
    duration: options?.duration ?? 6000,
    action: options?.action ? {
      label: options.action.label,
      onClick: options.action.onClick,
      buttonStyle: { backgroundColor: 'var(--color-destructive)' },
    } : undefined,
  })
}

function notifyInfo(message: string, options?: NotifyOptions) {
  return toast.info(message, {
    description: options?.description,
    duration: options?.duration ?? 3000,
  })
}

function dismissToast(id: string | number) {
  toast.dismiss(id)
}

function dismissAll() {
  toast.dismiss()
}
```

Consumption pattern:

```typescript
import { notifySuccess, notifyError } from '~/app/notifications'

notifySuccess('Profile updated', {
  description: 'Your changes have been saved.',
  action: { label: 'Undo', onClick: () => undoProfileUpdate() },
})
```

### Promise Toast Pattern

`toast.promise()` shows loading, success, and error states from a promise:

```typescript
async function uploadFile(file: File) {
  toast.promise(
    api.uploadFile(file),
    {
      loading: 'Uploading file...',
      success: (data) => `${data.name} uploaded successfully`,
      error: (err) => `Upload failed: ${err.message}`,
    }
  )
}
```

Integration with `useActionState` (React 19 server actions):

```typescript
import { useActionState } from 'react'
import { toast } from 'sonner'

function CreateUserForm() {
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await api.createUser(formData)

    if (result.error) {
      toast.error(result.error)
      return { error: result.error }
    }

    toast.success(`User ${result.name} created`)
    return { success: true }
  }, { error: null })

  return (
    <form action={formAction}>
      <input name="name" required />
      <button type="submit" disabled={pending}>
        {pending ? 'Creating...' : 'Create User'}
      </button>
      {state.error && <p style={{ color: 'red' }}>{state.error}</p>}
    </form>
  )
}
```

> **Think**: toast.promise blocks the caller until promise resolves. How to show progress for multi-step operations?
>
> *Answer: Manually manage toast lifecycle: `const id = toast.loading('Step 1...')`, update with `toast.success(msg, { id })` or `toast.error(msg, { id })`. Or chain multiple toast.promise calls sequentially.*

### Stacked vs Expanded Mode

```typescript
// Stacked (default): toasts overlay, newest on top
<Toaster expand={false} visibleToasts={5} />

// Expanded: toasts are stacked vertically with full content visible
<Toaster expand={true} visibleToasts={5} />
```

| Mode | Use Case |
|------|----------|
| Stacked | High-frequency notifications (real-time updates) |
| Expanded | Important messages where each toast needs full visibility |
| Hybrid | Expand only for errors/warnings, stack for success/info |

`visibleToasts` limits how many toasts display. Excess queue until dismissed.

### Rich Content with JSX

```typescript
toast.custom((t) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6' }} />
    <div>
      <p style={{ fontWeight: 600 }}>{message.title}</p>
      <p style={{ fontSize: 12, color: '#666' }}>{message.preview}</p>
    </div>
    <button onClick={() => toast.dismiss(t)} style={{ marginLeft: 'auto' }}>
      <IconX />
    </button>
  </div>
))
```

### Custom Styling with CSS Variables

```typescript
<Toaster
  style={{ fontFamily: 'Inter, sans-serif' }}
  toastOptions={{
    style: { border: '1px solid var(--border)' },
    classNames: {
      toast: 'my-toast',
      title: 'my-toast-title',
      description: 'my-toast-description',
      actionButton: 'my-toast-action',
      cancelButton: 'my-toast-cancel',
    },
  }}
/>
```

CSS variable overrides:

```css
.toaster {
  --sonner-normal-bg: var(--color-bg);
  --sonner-normal-text: var(--color-text);
  --sonner-success-bg: var(--color-success-bg);
  --sonner-success-text: var(--color-success-text);
  --sonner-error-bg: var(--color-error-bg);
  --sonner-error-text: var(--color-error-text);
  --sonner-info-bg: var(--color-info-bg);
  --sonner-info-text: var(--color-info-text);
  --sonner-border: var(--color-border);
  --sonner-radius: 8px;
}
```

---

### Why This Matters

Notifications appear in every app. Without abstraction, imports from Sonner spread across components, toast durations are inconsistent, and error messages lack action buttons. Typed helpers ensure: consistent timing (errors longer than success), accessible patterns (dismissible), and standard positioning.

---

### Common Questions

**Q: Sonner vs react-hot-toast — which to use?**
A: Sonner is smaller (~5KB vs ~7KB), has built-in rich colors, promise toast, and swipe-to-dismiss. react-hot-toast is more mature (wider browser support). Both are good. Sonner's API is slightly more ergonomic.

**Q: How to test toasts?**
A: Sonner exports `toast` imperatively — test by mocking and asserting calls. For E2E (Playwright): `await expect(page.getByText('File uploaded')).toBeVisible()`. For component tests: spy on `notifySuccess` from your helpers module.

**Q: Multiple Toaster instances — works?**
A: Yes — each Toaster is independent. Use multiple Toasters for separate notification zones (e.g., one for app notifications, one for system alerts). Each has own position and settings.

---

## Examples

### Example 1: Server Action Integration with Toast Feedback

**Problem**: Form submission via server action. Show loading while processing, success or error result.

**Solution**:
```typescript
"use server"
async function submitFeedback(prev: unknown, formData: FormData) {
  const message = formData.get('message') as string
  try {
    await db.feedback.create({ data: { message } })
    return { success: true, message: 'Feedback submitted' }
  } catch {
    return { success: false, message: 'Failed to submit feedback' }
  }
}

function FeedbackForm() {
  const [state, formAction, pending] = useActionState(submitFeedback, null)

  useEffect(() => {
    if (state?.success) notifySuccess(state.message)
    if (state && !state.success) notifyError(state.message)
  }, [state])

  return (
    <form action={formAction}>
      <textarea name="message" rows={4} required />
      <button type="submit" disabled={pending}>
        {pending ? <Spinner /> : 'Submit'}
      </button>
    </form>
  )
}
```

### Example 2: Retry Pattern with Action Button

**Problem**: Network request fails. Toast shows "Failed to load data" with Retry button.

**Solution**:
```typescript
function retryableFetch<T>(url: string, options?: RequestInit): Promise<T> {
  return fetch(url, options).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
}

async function loadDashboard() {
  try {
    const data = await retryableFetch('/api/dashboard')
    return data
  } catch (error) {
    notifyError('Failed to load dashboard', {
      duration: 10000,
      action: {
        label: 'Retry',
        onClick: () => loadDashboard(),
        variant: 'destructive',
      },
    })
  }
}
```

---

## Key Takeaways
- Place `<Toaster />` once in app root with app-wide position and styling
- Create typed helper functions (`notifySuccess`, `notifyError`) for consistent toast behavior
- `toast.promise()` handles loading/success/error lifecycle from a promise
- Integrate with React 19 `useActionState` for server action feedback
- `expand={true}` for important notifications, `expand={false}` for high-frequency
- Custom styles via CSS variables and `classNames` on toastOptions
- Rich content via `toast.custom()` for complex notification layouts

## Common Misconception

**"Toasts should only show success/error messages."**

Toasts communicate: success confirmations (file saved), error alerts (upload failed), progress updates (uploading 3/5 files), informational messages (new version available), system status (disconnected), undo actions (item deleted → undo), and rich interactive content (two-factor auth approval request).

---

## Feynman Explain
(Explain Sonner to a junior developer: "Sonner is a notification system. You call `toast.success('Done')` anywhere in your app. Appears as a small popup that auto-dismisses or can be swiped away. Promise toast watches a promise — shows loading while pending, success or error when settled.")

---

## Reframe
(Pause. Notifications are critical UX pattern. But does every action need a toast? Consider: form submission with inline error messages, background sync with silent retries, navigation changes without confirmation. Toast overuse creates notification fatigue — users start ignoring them. When is silence better than toast?)

---

## Drill
Take the quiz. MCQs test Sonner API, promise toast, typed helpers, positioning, and custom styling.

Run: `learn.sh quiz external-lib-patterns 14-toast-sonner`

## Quiz: 14-toast-sonner


### How is Sonner's Toaster component configured in an app?

- [ ] A: Wraps each component that needs notifications

- [✓] B: Single instance placed once in app root — all toasts render from it

- [ ] C: Toaster is automatically injected by Sonner — no component needed

- [ ] D: Each toast call creates its own Toaster instance


**Answer:** B

Place <Toaster /> once at app root (App.tsx, layout.tsx). All toast.success/error/info calls render into this Toaster. Position, styling, expand mode configured here.


### What does toast.promise() return?

- [✓] A: A promise that resolves with toast ID

- [ ] B: The same promise passed in — toast.promise does not block

- [ ] C: Void — no return value

- [ ] D: A new promise that resolves when toast is dismissed


**Answer:** A

toast.promise returns a promise that resolves with the toast ID string/number. The original promise runs in parallel — the function does not await it.


### What is the benefit of typed notification helpers (notifySuccess, notifyError)?

- [ ] A: No benefit — direct toast calls are simpler

- [✓] B: Enforces consistent duration, dismissible behavior, and action button style across app

- [ ] C: Reduces bundle size

- [ ] D: Required for TypeScript compilation


**Answer:** B

Typed helpers centralize toast configuration: error toasts get longer duration, all toasts get consistent action button styling, dismissible behavior is standardized. Changing app-wide behavior changes one file.


### How does Sonner handle multiple toasts stacking?

- [ ] A: Only one toast visible at a time

- [✓] B: Toasts stack vertically, newest at top. visibleToasts prop limits count.

- [ ] C: Toasts appear in random positions

- [ ] D: Toasts replace each other — only latest stays


**Answer:** B

Default stacking: newest on top, older below. visibleToasts (default 3) limits simultaneous display. Excess queue until dismissal. Expand mode shows full content stacks.


### When would you use expand={true} on Toaster?

- [ ] A: Always — expanded mode is better UX

- [✓] B: When toasts contain important information that should not be truncated

- [ ] C: Never — expand mode is deprecated

- [ ] D: Only on mobile devices


**Answer:** B

Expanded mode shows toast content in full vertical layout. Good for: error details, multiple action buttons, rich content. Stacked mode better for high-frequency updates.


### How to update a toast after it's shown?

- [ ] A: Cannot update — dismiss and show new

- [✓] B: Call toast.success(newMsg, { id: existingToastId })

- [ ] C: Use toast.update() method

- [ ] D: Modify toast DOM directly


**Answer:** B

Pass existing toast ID to toast.success/error/info to update content. Pattern: const id = toast.loading('Uploading...'); later toast.success('Done', { id }). Updating dismisses loading and shows success.


### How does Sonner integrate with React 19 useActionState?

- [ ] A: Sonner has built-in useActionState wrapper

- [✓] B: Call toast in server action result handler — useEffect reacts to state change

- [ ] C: Server actions cannot call Sonner — client-only

- [ ] D: Wrap useActionState with Sonner's withToast() higher-order function


**Answer:** B

Call toast from client component. Server action returns result object. Client useEffect watches state changes and calls appropriate toast helper. toast itself is client-side only.


### How to create a toast with custom JSX content in Sonner?

- [ ] A: Not supported — string messages only

- [✓] B: Use toast.custom((t) => <div>...</div>) — receives toast ID for dismiss

- [ ] C: Pass JSX as first argument to toast.success

- [ ] D: Use dangerouslySetInnerHTML in toast message


**Answer:** B

toast.custom() accepts render function. Receives toast ID as argument for custom dismiss behavior. Used for complex layouts with buttons, icons, and formatted text.


### How to style Sonner toasts using CSS?

- [ ] A: Sonner does not support custom styling

- [✓] B: CSS custom properties (--sonner-normal-bg, --sonner-success-bg, etc.) on Toaster container

- [ ] C: Inline styles on toast.success() call only

- [ ] D: CSS modules imported from Sonner package


**Answer:** B

Sonner exposes CSS custom properties on the Toaster element. Override: --sonner-normal-bg, --sonner-normal-text, --sonner-success-bg, --sonner-error-bg, --sonner-radius, etc.


### How should toast duration differ between success and error?

- [ ] A: Both should use same duration

- [✓] B: Error toasts should be longer (5-8s) than success (2-4s) — user needs more time to read error

- [ ] C: Success should be longer — user wants to celebrate

- [ ] D: Duration does not matter — toasts auto-dismiss on click


**Answer:** B

Errors need longer duration because user must read and understand failure. Action button (Retry, Undo) increases duration further. Success toasts disappear faster — positive feedback is lightweight.


---

# Module 15: Command Palette — cmdk

Est. study time: 1.5h
Language: en

## Core Content

### cmdk Architecture

cmdk (⌘K) is a React command palette library. Low-level primitives for building search-driven menus:

```
<Command>           ─── Root context provider
  <CommandInput />  ─── Search input (auto-focused, filtering source)
  <CommandList>     ─── Scrollable results container
    <CommandEmpty>  ─── Shown when no results match
    <CommandGroup>  ─── Group heading + items
      <CommandItem> ─── Selectable item
    </CommandGroup>
  </CommandList>
</Command>
```

```typescript
import { Command } from 'cmdk'

function CommandMenu() {
  return (
    <Command label="Quick navigation" shouldFilter={false}>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => navigate('/dashboard')}>
            <IconDashboard />
            Dashboard
            <CommandShortcut>⌘1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/settings')}>
            <IconSettings />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => createDocument()}>
            <IconPlus />
            New Document
          </CommandItem>
          <CommandItem onSelect={() => openCommand('theme')}>
            <IconPalette />
            Change Theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
```

### Keyboard Shortcut Integration (react-hotkey)

Pairing cmdk with a keyboard shortcut library:

```typescript
import { useHotkeys } from 'react-hotkey'

function useCommandMenu() {
  const [open, setOpen] = useState(false)

  useHotkeys('meta+k', (e) => {
    e.preventDefault()
    setOpen(prev => !prev)
  })

  return { open, setOpen }
}

function AppCommandMenu() {
  const { open, setOpen } = useCommandMenu()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <CommandDialog>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>{/* ... */}</CommandList>
      </CommandDialog>
    </Dialog>
  )
}
```

> **Think**: useHotkeys vs event listener on keydown — what does the library provide?
>
> *Answer: useHotkeys provides: key combos (meta+k), scoping (only fire when not in input), ordering (stop propagation), and platform-aware modifier detection (cmd on Mac, ctrl on Windows).*

### Dynamic Command Registration Pattern

Commands should not be hardcoded. Registry pattern: modules register their commands at initialization:

```typescript
interface CommandRegistration {
  id: string
  label: string
  description?: string
  icon?: React.ComponentType
  keywords?: string[]
  category: string
  shortcut?: string
  perform: () => void
  priority?: number
}

class CommandRegistry {
  private commands = new Map<string, CommandRegistration>()
  private static instance: CommandRegistry

  static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry()
    }
    return CommandRegistry.instance
  }

  register(cmd: CommandRegistration): void {
    this.commands.set(cmd.id, cmd)
  }

  unregister(id: string): void {
    this.commands.delete(id)
  }

  getAll(): CommandRegistration[] {
    return Array.from(this.commands.values())
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  search(query: string): CommandRegistration[] {
    const lower = query.toLowerCase()
    return this.getAll().filter(cmd =>
      cmd.label.toLowerCase().includes(lower) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(lower))
    )
  }
}

export const commandRegistry = CommandRegistry.getInstance()
```

Module registers its commands:

```typescript
// modules/documents/index.ts
export function initDocumentsModule() {
  commandRegistry.register({
    id: 'documents:create',
    label: 'Create Document',
    description: 'Start a new document',
    icon: FilePlus,
    keywords: ['new', 'file', 'write'],
    category: 'Documents',
    shortcut: 'n',
    perform: () => router.navigate('/documents/new'),
    priority: 100,
  })

  commandRegistry.register({
    id: 'documents:search',
    label: 'Search Documents',
    description: 'Find documents by name or content',
    icon: Search,
    keywords: ['find', 'filter'],
    category: 'Documents',
    perform: () => router.navigate('/documents?search=true'),
    priority: 90,
  })
}
```

### Async Data Fetching in Command Items

Commands can fetch data asynchronously:

```typescript
function SearchUsers() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    setLoading(true)

    fetch(`/api/users?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setResults(data))
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [query])

  return (
    <CommandGroup heading="Users">
      {loading && <CommandItem disabled>Searching...</CommandItem>}
      {results.map(user => (
        <CommandItem
          key={user.id}
          onSelect={() => navigate(`/users/${user.id}`)}
          keywords={[user.name, user.email]}
        >
          <Avatar user={user} />
          <div>
            <span>{user.name}</span>
            <span style={{ fontSize: 12, color: 'gray' }}>{user.email}</span>
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
```

### Nested Commands (Submenus)

cmdk supports nested flows by swapping command lists:

```typescript
function ThemeSubmenu({ onBack }: { onBack: () => void }) {
  return (
    <Command>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 8 }}>
        <button onClick={onBack}><IconArrowLeft /></button>
        <CommandInput placeholder="Search themes..." autoFocus />
      </div>
      <CommandList>
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => applyTheme('light')}>
            Light
          </CommandItem>
          <CommandItem onSelect={() => applyTheme('dark')}>
            Dark
          </CommandItem>
          <CommandItem onSelect={() => applyTheme('system')}>
            System
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

// In main command:
<CommandItem onSelect={() => setActiveMenu('theme')}>
  <IconPalette />
  Change Theme
  <CommandShortcut>→</CommandShortcut>
</CommandItem>
```

### Dialog vs Inline Mode

cmdk works in both modes:

```typescript
// Dialog mode — overlay with backdrop
import { CommandDialog } from 'cmdk'

function App() {
  const { open, setOpen } = useCommandMenu()
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search..." />
      <CommandList>{/* ... */}</CommandList>
    </CommandDialog>
  )
}

// Inline mode — embedded in page
function SearchPage() {
  return (
    <div>
      <h2>Quick Actions</h2>
      <Command shouldFilter={false}>
        <CommandInput placeholder="Type to filter..." />
        <CommandList>{/* ... */}</CommandList>
      </Command>
    </div>
  )
}
```

> **Think**: Dialog mode captures keyboard focus inside the modal. Inline mode allows overlapping with page interactions. Which is better for a command palette?
>
> *Answer: Dialog mode — command palette should be a focused interrupt. Inline mode is better for: search pages, filter panels, or always-visible command bars.*

### Filtering and Search Ranking

cmdk has built-in filtering. `shouldFilter` prop controls behavior:

```typescript
// Default — cmdk filters by value and keywords
<Command>
  <CommandInput placeholder="Search..." />
  <CommandList>
    <CommandItem value="dashboard" keywords={['home', 'overview']}>
      Dashboard
    </CommandItem>
  </CommandList>
</Command>

// Custom filtering — cmdk only renders, you handle filtering
<Command shouldFilter={false}>
  <CommandInput onValueChange={setQuery} placeholder="Search..." />
  <CommandList>
    {filteredItems.map(item => (
      <CommandItem key={item.id} onSelect={item.perform}>
        {item.label}
      </CommandItem>
    ))}
  </CommandList>
</Command>
```

cmdk's default ranking: exact match > prefix match > substring match > keyword match.

---

### Why This Matters

Command palette is a power-user feature that makes apps feel professional. But hardcoded commands become stale and ignore module boundaries. Dynamic registration pattern lets each module own its commands — feature teams add commands without touching a central file. Keyboard shortcut integration completes the experience: Cmd+K → type → enter → action.

---

### Common Questions

**Q: cmdk vs react-autosuggest / downshift — when to use which?**
A: cmdk is for command palette (actions, navigation, search). Autosuggest/downshift are for form autocomplete (input suggestions, combobox). cmdk has built-in keyboard navigation, CommandShortcut, and dialog mode. Use downshift for form fields.

**Q: How to handle accessibility?**
A: cmdk uses ARIA combobox pattern: `role="combobox"`, `aria-activedescendant`, `aria-selected`. Items are navigable with arrow keys. <Command> has `label` prop for screen reader announcement.

**Q: Can commands include state toggles (dark mode toggle)?**
A: Yes — onSelect handler toggles state. Show current state in label: `CommandItem>Dark Mode {isDark ? 'On' : 'Off'}`. For toggles, consider checkmark icon or label suffix.

---

## Examples

### Example 1: Reusable CommandMenu Component

**Problem**: Build command palette once, use everywhere. Commands registered by feature modules.

**Solution**:
```typescript
function CommandMenu() {
  const { open, setOpen } = useCommandMenu()
  const [query, setQuery] = useState('')

  const commands = useMemo(() => commandRegistry.search(query), [query])

  return (
    <CommandDialog open={open} onOpenChange={setOpen} label="Quick actions">
      <CommandInput placeholder="Search actions and pages..." onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results for "{query}"</CommandEmpty>
        {groupBy(commands, 'category').map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map(cmd => (
              <CommandItem
                key={cmd.id}
                onSelect={() => { cmd.perform(); setOpen(false) }}
                keywords={cmd.keywords}
              >
                {cmd.icon && <cmd.icon />}
                <span>{cmd.label}</span>
                {cmd.description && <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.6 }}>{cmd.description}</span>}
                {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
```

### Example 2: Command Palette with Context-Aware Results

**Problem**: Commands should be context-aware. On documents page, show document actions first. On settings page, show settings actions first.

**Solution**:
```typescript
function ContextAwareCommandMenu() {
  const matches = useMatches() // from TanStack Router
  const currentRoute = matches[matches.length - 1]?.routeId ?? ''

  const commands = useMemo(() => {
    const all = commandRegistry.getAll()

    // Boost commands matching current context
    const scored = all.map(cmd => ({
      ...cmd,
      score: cmd.context?.includes(currentRoute) ? 1000 : 0,
    }))

    return scored.sort((a, b) => b.score - a.score)
  }, [currentRoute])

  return (
    <CommandDialog>
      <CommandInput placeholder="Search..." />
      <CommandList>
        {groupBy(commands, 'category').map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map(cmd => (
              <CommandItem key={cmd.id} onSelect={cmd.perform}>
                {cmd.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
```

---

## Key Takeaways
- cmdk primitives: Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty
- Dynamic command registration: modules register commands at init, registry manages lifecycle
- Keyboard shortcut: react-hotkey or native keydown for Cmd+K toggle
- Nested commands: swap command list for submenu navigation
- Dialog mode for command palette overlay, inline mode for embedded search
- Async data: fetch in useEffect, abort on query change, display results as CommandItems
- cmdk built-in filtering: value, keywords, and custom filter via shouldFilter={false}

## Common Misconception

**"Command palette is just a search bar."**

Command palette is search + action execution + context awareness. It combines: navigation (go to page), creation (new document), toggles (dark mode), data search (find user), and module-specific commands — all in one unified interface with keyboard-first interaction.

---

## Feynman Explain
(Explain cmdk to a junior developer: "cmdk gives you building blocks for a spotlight-search like VS Code's Cmd+K or Mac's Spotlight. You get a search bar, scrollable results, keyboard arrows, and selection handler. You provide the items and what happens when selected. The library handles focus, filtering, and accessibility.")

---

## Reframe
(Pause. Command palette is a power feature — not every app needs it. Consider: (1) Does the app have enough actions/navigation to justify Cmd+K? (2) Would keyboard shortcuts for individual actions be simpler? (3) How does command palette affect mobile users who lack keyboard? Command palette should grow from actual user feedback, not developer preference.)

---

## Drill
Take the quiz. MCQs test cmdk component architecture, command registration, filtering, keyboard shortcuts, and nested menus.

Run: `learn.sh quiz external-lib-patterns 15-command-palette-cmdk`

## Quiz: 15-command-palette-cmdk


### What is the purpose of cmdk's CommandInput component?

- [✓] A: Renders a styled text input that filters CommandItems by default

- [ ] B: Provides a search bar but filtering must be implemented manually

- [ ] C: Shows keyboard shortcut hints

- [ ] D: Renders input for command arguments


**Answer:** A

CommandInput renders a search input that automatically filters CommandItem children by their value and keywords props. onValueChange callback provides custom filtering alternative.


### How does cmdk rank search results by default?

- [ ] A: Alphabetical order — no ranking

- [✓] B: Exact match > prefix match > substring match > keyword match

- [ ] C: Random order each search

- [ ] D: By order items appear in DOM


**Answer:** B

cmdk's built-in filter ranks: exact value match highest, then prefix match, then substring, then keyword match. Helps users find common actions quickly.


### What pattern enables feature modules to add their own commands without modifying a central file?

- [ ] A: Central commands.tsx file with all commands

- [✓] B: Command registration pattern — modules call registry.register() at init

- [ ] C: Environment variables for each command

- [ ] D: Runtime JSON fetch from /api/commands


**Answer:** B

CommandRegistry singleton accepts register() calls from any module. Each module calls register() during initialization. Registry aggregates and provides commands to CommandMenu component.


### How to implement a submenu/nested command in cmdk?

- [ ] A: cmdk does not support nested commands

- [✓] B: Render separate Command tree when user selects parent item — swap visible content

- [ ] C: Use nested CommandGroup components

- [ ] D: Set depth prop on CommandItem


**Answer:** B

Submenus are separate Command trees rendered conditionally. Parent item's onSelect sets state to show submenu. Submenu includes back button to return to main menu.


### What is the difference between Dialog and Inline mode in cmdk?

- [✓] A: Dialog mode renders overlay with backdrop. Inline embeds command list in page flow.

- [ ] B: No difference — same functionality

- [ ] C: Dialog mode has search, Inline does not

- [ ] D: Inline mode requires shouldFilter={false}


**Answer:** A

CommandDialog wraps Command in a modal dialog (overlay, backdrop, focus trap). Inline mode renders Command directly in DOM for embedded use cases.


### When should you set shouldFilter={false} on Command?

- [ ] A: Always — built-in filtering is buggy

- [✓] B: When implementing custom filtering logic external to cmdk

- [ ] C: When CommandItems have no value prop

- [ ] D: Only in Dialog mode


**Answer:** B

shouldFilter={false} disables cmdk's built-in filtering. Use when: fetch-as-you-type with debounce, server-side search, or custom ranking algorithm. You control what renders in CommandList.


### How does useHotkeys handle platform modifier differences?

- [ ] A: No platform detection — use 'meta' for both Mac and Windows

- [✓] B: Automatically maps meta to cmd on Mac, ctrl on Windows

- [ ] C: Developer must provide separate key combos per platform

- [ ] D: Uses navigator.platform to conditionally register


**Answer:** B

react-hotkey detects OS and maps 'meta' to command key ⌘ on macOS and ctrl on Windows/Linux. useHotkeys('meta+k') works on both platforms without conditional logic.


### How to add keyboard shortcut hints to CommandItems?

- [ ] A: Not supported — shortcuts displayed in separate component

- [✓] B: Use <CommandShortcut> children inside CommandItem

- [ ] C: Add shortcut prop to CommandItem

- [ ] D: Shortcuts are automatically detected from useHotkeys


**Answer:** B

CommandShortcut renders styled keyboard shortcut text inside CommandItem. Visual only — does not register key bindings. Pair with useHotkeys for actual key handling.


### What happens when a user types a query that matches no commands?

- [ ] A: CommandList shows nothing — empty state

- [✓] B: <CommandEmpty> renders with the unmatched query text

- [ ] C: cmdk throws error

- [ ] D: Previous results remain visible


**Answer:** B

CommandEmpty renders when no CommandItem matches current search query. Typically shows 'No results found' or 'No results for {query}'. Only visible when its parent CommandList has no visible CommandItems.


### How to handle async data fetching in command items?

- [ ] A: cmdk has built-in async support — pass fetch function

- [✓] B: Fetch in useEffect with query dependency, abort previous request, render results as CommandItems

- [ ] C: Fetch all data upfront — async fetching not supported

- [ ] D: Use Web Workers for async command data


**Answer:** B

Implement async fetch in useEffect. Use query state as deps. Abort previous fetch on new query via AbortController. Map results to CommandItems. Show loading state during fetch.


---

# Module 16: Internationalization — Lingui

Est. study time: 2h
Language: en

## Learning Objectives
- Set up Lingui provider with React 19 and TypeScript
- Use Trans, useLingui, Plural, Select, and i18n._() for message rendering
- Configure Babel/macro-based extraction with @lingui/cli
- Work with .po/.mo catalog workflow and ICU message format
- Lazy-load locale catalogs for code-split builds
- Compare compile-time vs runtime localization approaches
- Integrate date-fns for date formatting and Intl.NumberFormat for numbers

---

## Core Content

### Lingui Core Concepts

Lingui is compile-time i18n library. Messages extracted at build via Babel macro, typed via CLI typegen.

```typescript
import { Trans, useLingui } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { msg } from '@lingui/core/macro'
import { Plural, Select } from '@lingui/react/macro'
```

Three core rendering approaches:

| Approach | Hook/Component | When to use |
|----------|---------------|-------------|
| Declarative JSX | `<Trans>` | UI text with embedded markup |
| Imperative string | `i18n._(msg\`...\`)` | Dynamic strings, non-JSX context |
| Hook for plural/select | `useLingui()` + `<Plural>` | Count-based or gender-based content |

```typescript
// Declarative — Trans
;<Trans>Welcome to {appName}</Trans>

// Imperative — for aria-labels, tooltips
const label = i18n._(msg`Delete ${item.name}`)

// Plural
;<Plural
  value={count}
  one="# book"
  other="# books"
/>
```

### Macro-Based Extraction Pipeline

Lingui uses Babel macros. Macros parse source code, extract messages, and replace macro calls with runtime calls.

```
Source code (macros)
  → Babel (extract messages)
  → .po file (translation memory)
  → Translator edits .po
  → .mo file (compiled catalog)
  → Import in app
```

Setup:

```typescript
// lingui.config.ts
import type { LinguiConfig } from '@lingui/conf'

const config: LinguiConfig = {
  locales: ['en', 'zh', 'ja', 'ko', 'fr'],
  sourceLocale: 'en',
  catalogs: [{
    path: '<rootDir>/src/locales/{locale}/messages',
    include: ['src'],
  }],
  format: 'po',
}

export default config
```

CLI commands:

```bash
pnpm lingui extract   # Extract messages → .po files
pnpm lingui compile   # Compile .po → .js/.ts catalogs
pnpm lingui compile --typescript  # Generate typed catalogs
```

> **Think**: Why do macros work at compile time instead of runtime? What are the limitations?
>
> *Answer: Macros transform AST — message strings become static IDs at build. No runtime parsing of template strings. Limitation: dynamic message keys not extracted (`msg\`Hello ${dynamicVar}\`` works, but `msg(someVariable)` cannot be extracted).*

### Provider Setup with React 19

```typescript
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { messages as enMessages } from './locales/en/messages'
import { messages as zhMessages } from './locales/zh/messages'

const catalogs = {
  en: enMessages,
  zh: zhMessages,
}

function App() {
  const [locale, setLocale] = useState('en')

  useEffect(() => {
    i18n.activate(locale)
  }, [locale])

  return (
    <I18nProvider i18n={i18n}>
      <AppContent />
    </I18nProvider>
  )
}
```

Lazy-load catalogs for code-splitting:

```typescript
async function activateLocale(locale: string) {
  const { messages } = await import(`./locales/${locale}/messages`)
  catalogs[locale] = messages
  i18n.load(locale, messages)
  i18n.activate(locale)
}
```

### ICU Message Format

Lingui uses ICU syntax inside message strings:

```
{count, plural, one {# book} other {# books}}
{gender, select, male {He} female {She} other {They}}
{name} uploaded {count, plural, one {# file} other {# files}}
```

```typescript
;<Trans>
  {name} uploaded {count, plural,
    one {# file}
    other {# files}
  }
</Trans>
```

Values and components:

```typescript
;<Trans>
  <Link href="/terms">Terms of Service</Link>
  {count, plural,
    one {and # more file}
    other {and # more files}
  }
</Trans>
```

### Typed Messages with Typegen

```bash
pnpm lingui compile --typescript
```

Generated typed catalog:

```typescript
// src/locales/en/messages.d.ts
import { Messages } from '@lingui/core'
declare const messages: Messages
export { messages }
```

Provides autocomplete for message IDs. Prevents runtime reference to non-existent messages.

### Dynamic Messages with Values

```typescript
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'

function Greeting({ name }: { name: string }) {
  const { i18n } = useLingui()
  return <span>{i18n._(msg`Hello, ${name}`)}</span>
}
```

ICU with values:

```typescript
const message = msg`${name} has ${count, plural, one {# item} other {# items}}`
i18n._(message, { name: 'Alice', count: 3 })
// → "Alice has 3 items"
```

### Date and Number Formatting

Lingui delegates to `Intl` for dates/numbers. Pair with date-fns for complex transformations:

```typescript
import { format } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'

function FormattedDate({ date }: { date: Date }) {
  const { i18n } = useLingui()
  const locale = i18n.locale === 'zh' ? zhCN : enUS
  return <span>{format(date, 'PPP', { locale })}</span>
}
```

Numbers via `Intl.NumberFormat`:

```typescript
function Price({ value, currency }: { value: number; currency: string }) {
  const { i18n } = useLingui()
  const formatter = new Intl.NumberFormat(i18n.locale, {
    style: 'currency',
    currency,
  })
  return <span>{formatter.format(value)}</span>
}
```

### Runtime vs Compile-Time Localization

| Approach | Pros | Cons |
|----------|------|------|
| Compile-time (Lingui) | Typed messages, tree-shakeable, no runtime parser | Rebuild required for new translations, Babel setup |
| Runtime (react-i18next) | Dynamic key lookup, hot-reload translations | Bundle includes parser, no type safety on keys |

```typescript
// react-i18next (runtime)
t('welcome.message', { name })  // No type checking — key typo = missing translation

// Lingui (compile-time)
i18n._(msg`Welcome, ${name}`)  // Extracted by macro, typed by CLI
```

> **Think**: When is runtime localization better than compile-time?
>
> *Answer: Runtime better for: (1) CMS-driven content where translation keys change without deployments, (2) user-generated content with dynamic locale switching, (3) apps that need hot-reload translation edits during development without rebuild.*

### Comparison with react-i18next

| Factor | Lingui | react-i18next |
|--------|--------|---------------|
| Extraction | Babel macro (compile) | Manual key management or i18next-parser |
| Type safety | CLI typegen → typed catalogs | No native typing |
| ICU support | Native | Plugin (i18next-icu) |
| Bundle size | ~3 KB (macro removed at build) | ~12 KB + parser |
| React 19 | Full macro support | Compatible |

Lingui chosen for compile-time safety and smaller bundle. react-i18next better for runtime flexibility in CMS contexts.

---

### Why This Matters

i18n is not a feature — it is infrastructure. Wrong approach leads to: missing translations (runtime typos), large bundle (runtime parser), untranslatable strings (concatenation). Lingui's compile-time approach catches translation errors at build, not production.

---

### Common Questions

**Q: What happens when a message ID is not found in the active catalog?**
A: Lingui falls back to source message string (from macro). No blank UI. Source locale messages are always embedded as fallback.

**Q: How to handle RTL languages?**
A: Separate concern. Use CSS logical properties (`margin-inline-start`). Lingui does not handle RTL — pair with `dir` attribute change on locale switch.

---

## Examples

### Example 1: Full App i18n Setup

**Goal**: Set up Lingui with lazy-loaded catalogs for English and Chinese.

```typescript
// src/i18n.ts
import { i18n } from '@lingui/core'

export async function changeLocale(locale: string) {
  const { messages } = await import(
    `../locales/${locale}/messages.ts`
  )
  i18n.loadAndActivate({ locale, messages })
  document.documentElement.lang = locale
}
```

```typescript
// src/App.tsx
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'

export function App() {
  return (
    <I18nProvider i18n={i18n}>
      <Navigation />
      <MainContent />
    </I18nProvider>
  )
}
```

### Example 2: Plural Forms with Component Children

```typescript
import { Plural, Trans } from '@lingui/react/macro'

function CartSummary({ count }: { count: number }) {
  return (
    <p>
      <Plural
        value={count}
        one={<Trans># item in cart</Trans>}
        other={<Trans># items in cart</Trans>}
      />
    </p>
  )
}
```

---

## Key Takeaways
- Lingui uses Babel macros for compile-time extraction. No runtime parser.
- Setup: lingui config → extract → translate → compile → typed catalog.
- `Trans` for JSX, `i18n._(msg\`...\`)` for imperative, `Plural`/`Select` for conditional.
- Lazy-load catalogs (`import()`) for code-split bundles.
- ICU message format supports plural, select, and component interpolation.
- Typegen from CLI (`--typescript`) provides autocomplete + type-safe message IDs.
- date-fns + Intl.NumberFormat for date/number formatting per locale.
- Compile-time i18n (Lingui) vs runtime (react-i18next): trade-off between type safety and flexibility.

## Common Misconception

**"i18n is just string replacement — switch locale, swap strings."**

i18n involves: plural grammar (English: 1 book / 2 books; Chinese: no plural), gender agreement, date/number/currency formatting per locale, text direction, component boundaries inside translations. Lingui handles plural/select via ICU. String concatenation for translation is the root of all i18n bugs.

---

## Feynman Explain
(Explain ICU message format to designer: curly braces are template slots. `{count, plural, one {# book} other {# books}}` reads as "if count is 1, show '1 book', otherwise show 'N books'. Designers can edit .po files without touching code. ICU is the grammar that makes translations grammatically correct.)

---

## Reframe
(Pause. Compile-time i18n adds a build step. For a single-locale internal tool, Lingui overhead outweighs benefit. When does compile-time make sense vs simple `const t = { key: 'value' }` map? Consider: growth path — any app targeting multiple locales should adopt compile-time extraction from day one to avoid retroactive audit of all strings.)

---

## Drill
Take the quiz. MCQs test Lingui macro usage, ICU format, catalog workflow, lazy-loading, typed messages, and comparison with react-i18next.

Run: `learn.sh quiz external-lib-patterns 16-i18n-lingui`

## Quiz: 16-i18n-lingui


### What Babel macro component renders ICU plural forms in JSX?

- [ ] A: <FormatPlural>

- [✓] B: <Plural>

- [ ] C: <Count>

- [ ] D: <Locale>


**Answer:** B

<Plural> is Lingui's ICU plural component. It handles count-based text selection with one/other (and few/many for Slavic languages).


### Lingui compiles messages at build time. What is the primary benefit over runtime i18n?

- [✓] A: Smaller bundle — no runtime parser needed

- [ ] B: Faster locale switching

- [ ] C: Dynamic key resolution

- [ ] D: No build step required


**Answer:** A

Babel macros remove ICU parser from bundle. Application ships only compiled messages. Runtime approaches (react-i18next) include parser in bundle.


### What CLI flag generates typed message catalogs for autocomplete?

- [✓] A: --typescript

- [ ] B: --typed

- [ ] C: --strict

- [ ] D: --dts


**Answer:** A

`lingui compile --typescript` generates .d.ts type declaration files alongside compiled catalogs, enabling autocomplete for message IDs.


### Which method activates a locale after loading its catalog?

- [ ] A: i18n.switch(locale)

- [✓] B: i18n.activate(locale)

- [ ] C: i18n.setLocale(locale)

- [ ] D: i18n.use(locale)


**Answer:** B

`i18n.load(locale, messages)` loads catalog. `i18n.activate(locale)` sets active locale and triggers re-render via I18nProvider.


### ICU message: `{name} uploaded {count, plural, one {# file} other {# files}}`. What does `#` represent?

- [✓] A: The count value

- [ ] B: The message ID

- [ ] C: A hash placeholder for future text

- [ ] D: The translation version number


**Answer:** A

`#` in ICU plural forms is replaced with the numeric value of the count argument. `{count, plural, one {# file} other {# files}}` with count=1 renders '1 file'.


### When does `msg` macro fail to extract a message?

- [ ] A: When message contains JSX

- [✓] B: When argument is a dynamic variable, not a template literal — `msg(someVar)` cannot be extracted

- [ ] C: When message uses ICU syntax

- [ ] D: When message is longer than 100 characters


**Answer:** B

Macros operate on AST at compile time. Static template literal `msg`Hello ${name}`` is analyzable. Dynamic variable `msg(someVar)` cannot be extracted. Always use template literals.


### What Lingui component renders gender-based text selection?

- [ ] A: <Gender>

- [✓] B: <Select>

- [ ] C: <Conditional>

- [ ] D: <Choose>


**Answer:** B

`<Select value={gender} male="He" female="She" other="They" />` handles gender-based text. ICU select format supports arbitrary category values.


### How to lazy-load Lingui catalogs for code-split bundles?

- [ ] A: Load all catalogs eagerly — lazy loading not supported

- [✓] B: Dynamic import of catalog module: `await import('./locales/' + locale + '/messages')`

- [ ] C: Use React.lazy on I18nProvider

- [ ] D: Configure lazy: true in lingui.config.ts


**Answer:** B

Dynamic import keeps locale catalogs in separate chunks. Only active locale's catalog loaded. `i18n.load(locale, messages)` after import.


### Lingui vs react-i18next: when is react-i18next the better choice?

- [ ] A: Always — react-i18next is more popular

- [✓] B: When translation keys are dynamic and change without deployments (CMS-driven content)

- [ ] C: When app targets only one locale

- [ ] D: When using TypeScript


**Answer:** B

Runtime key resolution allows dynamic translation keys from CMS. Lingui requires rebuild for new messages. For CMS-driven multilingual apps, react-i18next flexibility wins.


### What happens if a Lingui message ID is missing from the active catalog?

- [ ] A: Blank string renders

- [ ] B: Runtime error thrown

- [✓] C: Source message string used as fallback

- [ ] D: Message renders but logs warning


**Answer:** C

Lingui embeds source message strings as fallback. Missing translation renders the source code message. No blank UI or runtime error — graceful degradation.


---

# Module 17: Real-time Collaboration — Liveblocks

Est. study time: 2h
Language: en

## Learning Objectives
- Set up RoomProvider with React 19 and Suspense
- Use useStorage for reading shared state and useMutation for writing
- Render presence cursors with useOthers and useMyPresence
- Manage undo/redo history with Liveblocks History API
- Design storage schemas with LiveList, LiveMap, LiveObject
- Build collaborative text editor (Lexical + Yjs integration)
- Render cursor overlays with zustand-free approach
- Understand optimistic updates and conflict resolution strategy

---

## Core Content

### Liveblocks Architecture

Liveblocks provides real-time collaboration infrastructure. Each "room" = synchronized state across connected clients.

```
Client A ────┐
              ├── WebSocket ── Liveblocks Cloud ── WebSocket ──┐── Client B
Client C ────┘                                                └── Client D
```

| Concept | API | Purpose |
|---------|-----|---------|
| Room | `RoomProvider` | Wrap component subtree with room context |
| Storage | `useStorage` | Read shared Live structures (reactive) |
| Mutation | `useMutation` | Write to storage with undo support |
| Presence | `useMyPresence` / `useOthers` | Cursor positions, selection, focus |
| History | `room.history` | Undo/redo operations |
| Threads | `useThreads` / `useCreateThread` | Comments and annotations |

### React 19 Setup with Suspense

```typescript
import { RoomProvider } from '@liveblocks/react/suspense'
import { Client } from '@liveblocks/client'

const client = new Client({
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_KEY!,
})

function App({ roomId }: { roomId: string }) {
  return (
    <RoomProvider id={roomId} initialPresence={{ cursor: null }}>
      <Editor />
    </RoomProvider>
  )
}
```

Suspense integration:

```typescript
;<RoomProvider id={roomId} initialPresence={{ cursor: null }}>
  <Suspense fallback={<Loading />}>
    <Editor />
  </Suspense>
</RoomProvider>

function Editor() {
  const storage = useStorage((root) => root)
  // Suspense waits for room connection + initial storage load
}
```

### Storage Data Structures

Storage is based on CRDT (Yjs under the hood). Conflict-free replicated data types:

```typescript
// Storage schema
type Storage = {
  blocks: LiveList<LiveObject<Block>>
  metadata: LiveObject<{
    title: string
    lastEdited: number
  }>
  collaborators: LiveMap<string, Collaborator>
}

type Block = {
  id: string
  type: 'text' | 'image' | 'code'
  content: string
}
```

```typescript
import { LiveList, LiveObject, LiveMap } from '@liveblocks/client'

function initStorage() {
  return {
    blocks: new LiveList([
      new LiveObject({ id: '1', type: 'text', content: '' }),
    ]),
    metadata: new LiveObject({ title: 'Untitled', lastEdited: Date.now() }),
    collaborators: new LiveMap(),
  }
}
```

### Reading and Writing Storage

```typescript
import { useStorage, useMutation } from '@liveblocks/react/suspense'

function DocumentTitle() {
  // Reactive — re-renders on data change
  const title = useStorage((root) => root.metadata.get('title'))

  const updateTitle = useMutation(
    ({ storage }, newTitle: string) => {
      storage.get('metadata').set('title', newTitle)
    },
    []
  )

  return <input value={title} onChange={(e) => updateTitle(e.target.value)} />
}
```

Complex mutations:

```typescript
const addBlock = useMutation(
  ({ storage }, type: Block['type']) => {
    const blocks = storage.get('blocks')
    const block = new LiveObject({
      id: crypto.randomUUID(),
      type,
      content: '',
    })
    blocks.push(block)
  },
  []
)
```

### Undo / Redo

```typescript
import { useHistory } from '@liveblocks/react/suspense'

function Toolbar() {
  const { undo, redo, canUndo, canRedo } = useHistory()

  return (
    <>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
    </>
  )
}
```

Mutations are automatically batched into history entries. Each `useMutation` call = one undoable step. Manual batching:

```typescript
const batchUpdate = useMutation(
  ({ storage, self }) => {
    // Multiple storage operations — all undo as one step
    storage.get('metadata').set('title', newTitle)
    storage.get('metadata').set('lastEdited', Date.now())
  },
  []
)
```

> **Think**: How does undo/redo work across multiple collaborators? If Alice undoes, does Bob see the undo?
>
> *Answer: History is local. Each client has own undo stack. Undoing Alice's mutation reverts her change from shared storage. Bob sees Alice's block disappear. History = collaborative undo, not per-user isolated history.*

### Presence and Cursors

```typescript
import { useMyPresence, useOthers } from '@liveblocks/react/suspense'

type Presence = {
  cursor: { x: number; y: number } | null
  selection: string | null
  name: string
}
```

Sending own cursor:

```typescript
function Canvas() {
  const [myPresence, updateMyPresence] = useMyPresence()

  const handlePointerMove = (e: React.PointerEvent) => {
    updateMyPresence({
      cursor: { x: e.clientX, y: e.clientY },
    })
  }

  const handlePointerLeave = () => {
    updateMyPresence({ cursor: null })
  }

  return <div onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
    <CursorsOverlay />
  </div>
}
```

Rendering other cursors:

```typescript
function CursorsOverlay() {
  const others = useOthers()

  return others.map((other) => {
    if (!other.presence.cursor) return null
    return (
      <div
        key={other.id}
        style={{
          position: 'absolute',
          left: other.presence.cursor.x,
          top: other.presence.cursor.y,
          background: other.info.color,
        }}
      >
        {other.info.name}
      </div>
    )
  })
}
```

### Collaborative Text Editor (Lexical + Yjs)

Liveblocks provides `@liveblocks/yjs` binding for Yjs, which integrates with Lexical via `@lexical/yjs`.

```typescript
import { createClient } from '@liveblocks/client'
import { YjsProvider } from '@liveblocks/yjs'
import * as Y from 'yjs'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin'

const doc = new Y.Doc()

const yjsProvider = new YjsProvider(client, doc)

function Editor() {
  return (
    <LexicalComposer initialConfig={{
      namespace: 'doc',
      nodes: [],
      theme: {},
    }}>
      <CollaborationPlugin
        id="main"
        providerFactory={() => yjsProvider}
        shouldBootstrap={true}
      />
      <RichTextPlugin />
    </LexicalComposer>
  )
}
```

### Threads and Comments

```typescript
import { useThreads, useCreateThread } from '@liveblocks/react/suspense'

function CommentThreads() {
  const { threads } = useThreads()
  const createThread = useCreateThread()

  const addComment = (x: number, y: number) => {
    createThread({
      body: { content: '' },
      metadata: { x, y, resolved: false },
    })
  }

  return threads.map((thread) => (
    <CommentBubble key={thread.id} thread={thread} />
  ))
}
```

### REST API for Room Management

```typescript
// Server-side room creation
const response = await fetch('https://api.liveblocks.io/v1/rooms', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${LIVEBLOCKS_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ id: roomId, usersAccesses: ['alice', 'bob'] }),
})
```

### Optimistic Updates and Conflict Resolution

Liveblocks uses CRDT conflict resolution: concurrent edits merge deterministically. Last-write-wins for scalar values, insert-without-conflict for lists.

```typescript
const optimisticDelete = useMutation(
  ({ storage }, blockId: string) => {
    // Optimistic: remove immediately
    const blocks = storage.get('blocks')
    const index = blocks.findIndex((b) => b.get('id') === blockId)
    if (index > -1) blocks.delete(index)
    // CRDT ensures conflict resolution if another client also deleted
  },
  []
)
```

> **Think**: What happens when two clients simultaneously rename the same block to different names?
>
> *Answer: Last-write-wins (LWW). The mutation that arrives last at Liveblocks server wins. Since CRDT operations are ordered by vector clock, both clients converge to same state. No "split" or "corruption" possible.*

---

### Why This Matters

Real-time collaboration is table stakes for modern productivity apps. From Notion to Figma to Google Docs, users expect multi-user simultaneous editing. Liveblocks abstracts the complexity of CRDT, WebSocket management, and conflict resolution into React hooks, making collaborative features accessible without CRDT expertise.

---

### Common Questions

**Q: What bandwidth costs should I expect with presence broadcasting?**
A: Presence is sent on every pointer move. Throttle to ~30fps (33ms interval). For 100+ concurrent users, consider limiting presence to visible users only.

**Q: Can Liveblocks be self-hosted?**
A: Liveblocks Cloud is default. Self-hosted option exists via Docker Enterprise edition. For most apps, Cloud is cost-effective ($0-50/mo for small teams).

---

## Examples

### Example 1: Collaborative Whiteboard with Cursors

```typescript
import { RoomProvider, useStorage, useMutation, useMyPresence, useOthers } from '@liveblocks/react/suspense'

function Whiteboard() {
  return (
    <RoomProvider id="whiteboard-1" initialPresence={{ cursor: null }}>
      <Canvas />
      <CursorsOverlay />
    </RoomProvider>
  )
}

function Canvas() {
  const shapes = useStorage((root) => root.shapes)
  const addShape = useMutation(({ storage }, shape: Shape) => {
    storage.get('shapes').push(new LiveObject(shape))
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {shapes.map((shape) => <Shape key={shape.id} {...shape} />)}
      <button onClick={() => addShape({ id: crypto.randomUUID(), x: 100, y: 100 })}>
        Add Shape
      </button>
    </div>
  )
}
```

### Example 2: Undo/Redo in Rich Text

```typescript
function EditorToolbar() {
  const { undo, redo, canUndo, canRedo } = useHistory()

  return (
    <div role="toolbar">
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo}>
        Redo
      </button>
    </div>
  )
}
```

---

## Key Takeaways
- RoomProvider wraps collaborative subtree. Uses Yjs CRDT under the hood.
- storage for shared state (LiveList, LiveMap, LiveObject), presence for transient data (cursors).
- useMutation writes to storage. Reverts via undo/redo (history is local per client).
- useOthers reads other clients' presence. Render cursor overlays from presence data.
- `@liveblocks/yjs` + Lexical CollaborationPlugin for text editor sync.
- Threads API for comment annotations on shared canvas.
- CRDT guarantees conflict-free merging. No network-dependent merge logic needed.
- React 19 Suspense: useSuspenseStorage waits for room connection + initial load.

## Common Misconception

**"Liveblocks replaces my database."**

Liveblocks is for real-time state synchronization — not durable storage. Persist room state to database on save. Liveblocks stores in-memory CRDT state. Unpersisted data lost when room is idle or all clients disconnect. Use Liveblocks REST API to synchronize to database periodically.

---

## Feynman Explain
(Explain CRDT to product manager: "Two people edit same document offline. One deletes paragraph, one fixes typo in same paragraph. Normal sync would conflict. CRDT makes both operations commutative — delete applies to paragraph, then typo fix is ignored because paragraph no longer exists. Everyone sees same final state when back online." Compare to git auto-merge.

---

## Reframe
(Pause. Do you need real-time? 99% of apps don't. Collaboration is sticky feature — once users expect it, removing it is impossible. Before adding Liveblocks: Is collaboration core to product? Does real-time improve outcome vs async? Notion added real-time late (2021) — async editing with page-level locking was sufficient for years.)

---

## Drill
Take the quiz. MCQs test RoomProvider setup, storage vs presence, useMutation vs useStorage, history API, cursor rendering, CRDT conflict resolution, Lexical integration.

Run: `learn.sh quiz external-lib-patterns 17-realtime-liveblocks`

## Quiz: 17-realtime-liveblocks


### What Liveblocks hook reads shared storage state reactively?

- [✓] A: useStorage

- [ ] B: useMyPresence

- [ ] C: useState

- [ ] D: useSharedState


**Answer:** A

useStorage reads Live structures (LiveList, LiveObject, LiveMap) and re-renders component when any observed property changes.


### What is the difference between Storage and Presence?

- [✓] A: Storage persists across sessions; presence is transient (cursors, selection)

- [ ] B: Storage is client-only; presence syncs to server

- [ ] C: Storage is read-only; presence is writable

- [ ] D: No difference — interchangeable


**Answer:** A

Storage holds durable shared state (documents, blocks). Presence holds ephemeral state (cursor position, focus) not persisted after disconnect.


### How does Liveblocks undo/redo handle changes from other users?

- [ ] A: Undoing Alice's change removes it for everyone

- [✓] B: History is local — each client has own undo stack; undo reverses client's own mutations on shared storage

- [ ] C: Undo only affects local presence, not storage

- [ ] D: Undo/redo disabled in collaborative rooms


**Answer:** B

Each client has independent undo stack. Undoing Alice's own mutation reverts that change from shared storage. Bob sees the block disappear. No per-user isolated history.


### What data structure stores an ordered list of objects in Liveblocks storage?

- [ ] A: LiveArray

- [✓] B: LiveList

- [ ] C: LiveSequence

- [ ] D: LiveOrderedSet


**Answer:** B

LiveList is ordered sequence supporting insert, move, delete, and push operations. Children are LiveObject or other Live structures.


### Presence data includes cursor coordinates. How often should presence be sent?

- [ ] A: Every pointer move event (up to 60fps)

- [✓] B: Throttled to ~30fps or 33ms intervals for reasonable bandwidth

- [ ] C: Once per second

- [ ] D: Only on pointer up


**Answer:** B

Sending every pointer-move event generates excessive WebSocket messages. Throttle to ~30fps. For 100+ concurrent users, consider throttling further or limiting to visible users.


### Which hook provides threads for comment annotations?

- [ ] A: useComments

- [✓] B: useThreads

- [ ] C: useAnnotations

- [ ] D: useDiscussions


**Answer:** B

useThreads returns all threads in current room. useCreateThread creates new thread with body content and metadata (position, resolved status).


### Two clients simultaneously rename same block to different names. What happens?

- [ ] A: Both names appear — conflict error

- [✓] B: Last-write-wins — CRDT converges to single name based on deterministic ordering

- [ ] C: First write wins — second rename rejected

- [ ] D: Block splits into two blocks with different names


**Answer:** B

Liveblocks CRDT uses last-write-wins for scalar values. Concurrent operations ordered by vector clock converge deterministically. Both clients see same final state.


### What makes a `useMutation` call undoable as a single step?

- [✓] A: Each mutation call is automatically one undoable step

- [ ] B: Must call history.batch() to group operations

- [ ] C: Only singleton mutations are undoable

- [ ] D: Mutations are not undoable by default


**Answer:** A

Each useMutation invocation is one undoable history entry. Multiple storage.set() calls inside same mutation are grouped as one undo step.


### Why must room state be persisted to external database periodically?

- [✓] A: Liveblocks does not store data durably — in-memory CRDT lost when room becomes idle

- [ ] B: Liveblocks has no storage capability

- [ ] C: Database persistence is optional — Liveblocks handles durability

- [ ] D: Only needed for billing purposes


**Answer:** A

Liveblocks holds CRDT state in memory for active rooms. State lost when all clients disconnect or room idle. Use REST API to read state and persist to database on save events.


### React 19 Suspense with RoomProvider: what does Suspense wait for?

- [ ] A: React hydration completes

- [✓] B: Room connection establishes and initial storage loads

- [ ] C: All presence data arrives from other clients

- [ ] D: First useMutation call


**Answer:** B

useSuspenseStorage triggers Suspense boundary during room connection and initial storage synchronization. Component renders only after storage is available.


---

# Module 18: Authentication — Clerk

Est. study time: 2h
Language: en

## Learning Objectives
- Set up ClerkProvider with React 19 and configure sign-in/sign-up flow
- Use useUser, useAuth, UserButton, SignIn, SignUp components
- Implement RBAC with Protect component and custom guards
- Manage organizations: create, switch, invite members
- Handle session management and webhooks for backend sync
- Configure middleware for route protection
- Use server-side helpers (clerkClient, auth()) in React 19 Server Components
- TypeScript types for user, session, and organization data

---

## Core Content

### Clerk Architecture

Clerk is auth-as-a-service. Pre-built UI components + backend API + session management.

```
Client App
  ├── ClerkProvider ── (context: user, session, org)
  ├── <SignIn /> ──── UI component (modal or page)
  ├── <UserButton /> ── Profile dropdown
  └── <Protect /> ──── RBAC guard

Backend
  ├── clerkClient ── Admin API
  ├── webhooks ───── User/session lifecycle sync
  └── auth() ─────── Server-side session verification
```

| Component | Purpose |
|-----------|---------|
| ClerkProvider | Wraps app with auth context |
| SignIn / SignUp | Pre-built auth forms |
| UserButton | Profile avatar + dropdown |
| Protect | Render children if user has required role/permission |
| OrganizationSwitcher | Switch active organization |

### Setup with React 19

```typescript
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/nextjs'

function App() {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <SignedOut>
        <SignIn routing="hash" />
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </ClerkProvider>
  )
}
```

Custom appearance:

```typescript
<ClerkProvider
  appearance={{
    baseTheme: darkTheme,
    variables: { colorPrimary: '#6366f1' },
    elements: {
      formButtonPrimary: 'bg-indigo-500 hover:bg-indigo-600',
      card: 'shadow-xl',
    },
  }}
>
```

### User and Session Hooks

```typescript
import { useUser, useAuth } from '@clerk/nextjs'

function Profile() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken, sessionId, orgId, orgRole } = useAuth()

  if (!isLoaded) return <Spinner />
  if (!isSignedIn) return null

  return (
    <div>
      <p>{user.fullName}</p>
      <p>{user.primaryEmailAddress?.emailAddress}</p>
      <p>Role: {orgRole}</p>
      <button onClick={async () => {
        const token = await getToken()
        // Use token for API auth header
      }}>
        Get Token
      </button>
    </div>
  )
}
```

Token management:

```typescript
// Pass session token to backend API
const token = await getToken({ template: 'my-api' })
fetch('/api/data', {
  headers: { Authorization: `Bearer ${token}` },
})
```

### RBAC with Protect

Clerk supports role-based access control via organization roles and permissions.

```typescript
import { Protect } from '@clerk/nextjs'

function AdminPanel() {
  return (
    <Protect
      role="org:admin"
      permission="org:sys:memberships:manage"
      fallback={<p>Access denied</p>}
    >
      <UserManagement />
    </Protect>
  )
}
```

Custom guard using useAuth:

```typescript
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { orgRole } = useAuth()

  if (orgRole !== 'org:admin') {
    return <Navigate to="/unauthorized" />
  }

  return children
}
```

### Organization Management

```typescript
import { useOrganization, useOrganizationList } from '@clerk/nextjs'

function OrgSwitcher() {
  const { organization, membership } = useOrganization()
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: true,
  })

  return (
    <div>
      <p>Current org: {organization?.name}</p>
      {userMemberships?.map((mem) => (
        <button key={mem.organization.id} onClick={() => setActive({ organization: mem.organization.id })}>
          Switch to {mem.organization.name}
        </button>
      ))}
    </div>
  )
}
```

### Server-Side Helpers (React 19 Server Components)

```typescript
import { auth, clerkClient } from '@clerk/nextjs/server'

export default async function ServerProtectedPage() {
  const { userId, orgId, sessionClaims } = await auth()

  if (!userId) {
    return <p>Unauthorized</p>
  }

  const user = await clerkClient.users.getUser(userId)

  return (
    <div>
      <h1>Welcome, {user.firstName}</h1>
      <pre>{JSON.stringify(sessionClaims, null, 2)}</pre>
    </div>
  )
}
```

### Middleware for Route Protection

```typescript
// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware({
  publicRoutes: ['/', '/sign-in', '/sign-up', '/api/webhooks(.*)'],
  ignoredRoutes: ['/api/health'],
})

export const config = {
  matcher: ['/((?!_next|static|favicon.ico).*)'],
}
```

Custom middleware with route-by-route rules:

```typescript
export default clerkMiddleware((auth, req) => {
  const { userId, orgRole } = auth()

  if (!userId && !isPublicRoute(req)) {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  // RBAC per route
  if (req.nextUrl.pathname.startsWith('/admin') && orgRole !== 'org:admin') {
    return redirectToUrl('/unauthorized')
  }
})
```

### Webhooks for Backend Sync

Clerk sends webhooks for user/session lifecycle events.

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')!
  const svixTimestamp = headerPayload.get('svix-timestamp')!
  const svixSignature = headerPayload.get('svix-signature')!

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  const payload = wh.verify(
    await req.text(),
    { 'svix-id': svixId, 'svix-timestamp': svixTimestamp, 'svix-signature': svixSignature }
  ) as any

  const eventType = payload.type
  if (eventType === 'user.created') {
    await createUserInDatabase(payload.data)
  }
  if (eventType === 'user.deleted') {
    await deleteUserFromDatabase(payload.data.id)
  }

  return Response.json({ received: true })
}
```

### TypeScript Types

```typescript
import type { UserResource, SessionResource, OrganizationResource } from '@clerk/types'

function displayUser(user: UserResource) {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.primaryEmailAddress?.emailAddress,
    image: user.imageUrl,
  }
}

type OrgRole = 'org:admin' | 'org:member' | 'org:guest'

interface SessionClaims {
  sid: string
  org_id?: string
  org_role?: OrgRole
  org_permissions?: string[]
}
```

### Email / Social / Magic Link Auth

```typescript
// Configure in Clerk Dashboard
// Supported: Google, GitHub, Apple, Email (OTP), Magic Link, Phone (SMS)
// No code change — toggle in dashboard

// Programmatic sign-in (custom flow)
const { signIn, setActive } = await clerk.client.signIn.create({
  identifier: 'user@example.com',
  strategy: 'password',
  password: 'my-password',
})
await setActive({ session: signIn.createdSessionId })
```

> **Think**: What happens when Clerk dashboard changes auth strategy (e.g., disable password, enable Google SSO)?
>
> *Answer: No code changes. Clerk UI components automatically adapt to enabled strategies. Disabled password → password field hidden. Enabled Google → Google button shown. Client checks strategies from Clerk API at runtime.*

---

### Why This Matters

Authentication is the highest-stakes integration in any app. Security bugs in auth can leak user data, bypass access controls, or expose admin endpoints. Clerk abstracts: session management, MFA, social auth, RBAC, orgs, webhooks. Using a dedicated auth service reduces attack surface compared to self-built auth.

---

### Common Questions

**Q: Can I use Clerk with my own backend API?**
A: Yes. Use `getToken()` on client → pass `Authorization: Bearer <token>` header → verify on backend with Clerk SDK or JWKs endpoint.

**Q: Clerk seems expensive compared to self-built auth. When is it worth it?**
A: Worth when: social auth (Google, GitHub, Apple) is required, RBAC with orgs is needed, team has no security expertise. Not worth if: only email/password auth for single-user admin tool.

---

## Examples

### Example 1: Full App Auth Shell

```typescript
// app/layout.tsx
import { ClerkProvider, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <SignedOut>
        <div className="flex items-center justify-center h-screen">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <header className="flex justify-between p-4">
          <h1>My App</h1>
          <UserButton />
        </header>
        <main>{children}</main>
      </SignedIn>
    </ClerkProvider>
  )
}
```

### Example 2: Route Guard with Org Role

```typescript
// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware((auth, req) => {
  const { userId, orgRole } = auth()
  const path = req.nextUrl.pathname

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  if (path.startsWith('/admin') && orgRole !== 'org:admin') {
    return Response.redirect(new URL('/unauthorized', req.url))
  }
})
```

---

## Key Takeaways
- ClerkProvider wraps app with auth context. SignedIn/SignedOut for conditional rendering.
- useUser for user data, useAuth for session token and org role.
- Protect component for RBAC with role and permission checks.
- Organization management: useOrganization, useOrganizationList, OrganizationSwitcher.
- Middleware for route-level auth checks. Public vs protected routes.
- Server-side: auth() for session verification, clerkClient for admin API.
- Webhooks sync user/session lifecycle to backend database.
- TypeScript types: UserResource, SessionResource, OrganizationResource from @clerk/types.
- Auth strategy changes are dashboard-controlled — no code changes needed.

## Common Misconception

**"Auth is just login/logout. Use a simple JWT library."**

Auth includes: password hashing, social OAuth flows, session rotation, MFA, rate limiting, account recovery, RBAC, org management, webhook sync, GDPR compliance. Each is a security surface. A dedicated auth service covers all. Self-built auth misses edge cases that lead to breaches.

---

## Feynman Explain
(Explain Clerk to backend engineer: Clerk is like having a security team build your auth system. They handle password storage, session tokens, OAuth flows. You get pre-built login UI (SignIn component), middleware (guard routes on server), and webhooks (sync users to your database). Your app asks "is this user allowed?" — Clerk answers after handling the crypto. Compare to building locks from scratch vs ordering from lock manufacturer.)

---

## Reframe
(Pause. Auth is not a UI problem — it is a security infrastructure problem. Clerk provides components, but the real value is: never storing passwords, automatic session rotation, breached password detection, and audit logs. Evaluate auth providers on security guarantees, not UI polish. For apps handling PII, SOC 2 compliance of auth provider matters more than developer experience.)

---

## Drill
Take the quiz. MCQs test ClerkProvider setup, useUser/useAuth, Protect RBAC, organization management, middleware, server-side auth(), webhooks, and TypeScript types.

Run: `learn.sh quiz external-lib-patterns 18-auth-clerk`

## Quiz: 18-auth-clerk


### What Clerk component conditionally renders children when user is signed in?

- [ ] A: <Authenticated>

- [✓] B: <SignedIn>

- [ ] C: <UserLoaded>

- [ ] D: <Protected>


**Answer:** B

SignedIn renders children only when user session is active. SignedOut renders children when no session. Pair them for auth-gated layout.


### What hook provides organization role and permissions?

- [ ] A: useUser

- [✓] B: useAuth

- [ ] C: useOrg

- [ ] D: useSession


**Answer:** B

useAuth returns orgRole, orgId, orgPermissions, sessionId, getToken. useUser returns user profile data (name, email, image).


### How to get a session token for backend API authentication?

- [ ] A: Token is in localStorage

- [✓] B: Call user.getToken() or useAuth().getToken()

- [ ] C: Token passed automatically via Cookie

- [ ] D: Import token from @clerk/token


**Answer:** B

getToken() returns a short-lived JWT signed by Clerk. Send as Authorization: Bearer header to backend. Supports token templates for custom claims.


### What Protect permission attribute checks specific action-level access?

- [ ] A: role

- [✓] B: permission

- [ ] C: action

- [ ] D: scope


**Answer:** B

Protect accepts both role (org-level) and permission (action-level). 'org:sys:memberships:manage' is a permission. 'org:admin' is a role.


### What is the correct server-side helper to verify auth in a React 19 Server Component?

- [ ] A: clerkClient.auth()

- [✓] B: auth() from @clerk/nextjs/server

- [ ] C: getAuth() from @clerk/backend

- [ ] D: verifySession() from clerkClient


**Answer:** B

auth() from @clerk/nextjs/server returns userId, orgId, sessionClaims for the current request. Works in Server Components and Route Handlers.


### What happens when social auth strategy is disabled in Clerk Dashboard?

- [ ] A: App must redeploy to reflect change

- [✓] B: Clerk UI components automatically hide disabled strategy — no code change

- [ ] C: Component throws error

- [ ] D: Disabled strategy remains visible but returns 403


**Answer:** B

Clerk UI components fetch enabled strategies from Clerk API at runtime. Disabling Google SSO in dashboard immediately hides Google button. Zero code changes.


### What event type indicates a new user signed up via webhook?

- [ ] A: user.signup

- [✓] B: user.created

- [ ] C: session.created

- [ ] D: user.registered


**Answer:** B

Clerk webhook event 'user.created' fires on new user registration. Payload includes user data (id, email, name, image). Use to sync user to database.


### What middleware configuration sets routes accessible without authentication?

- [ ] A: ignoredRoutes

- [✓] B: publicRoutes

- [ ] C: unprotectedRoutes

- [ ] D: allowedRoutes


**Answer:** B

publicRoutes in clerkMiddleware config defines routes accessible without auth (landing page, sign-in, sign-up, webhook endpoints). All other routes protected by default.


### How to switch active organization programmatically?

- [ ] A: Call clerk.setOrganization(id)

- [✓] B: Call setActive({ organization: orgId }) from useOrganizationList

- [ ] C: Navigate to /org/:id

- [ ] D: Re-render ClerkProvider with new org


**Answer:** B

setActive from useOrganizationList switches current organization. Session token is re-issued with new org claims. All Protect checks re-evaluate against new org role.


### What TypeScript import provides types for UserResource and SessionResource?

- [ ] A: @clerk/nextjs/types

- [✓] B: @clerk/types

- [ ] C: @clerk/backend/types

- [ ] D: types from @clerk/clerk-sdk-node


**Answer:** B

@clerk/types package exports UserResource, SessionResource, OrganizationResource, and other TypeScript interfaces for Clerk data models.


---

# Module 19: Headless UI Components — Radix Primitives

Est. study time: 2h
Language: en

## Learning Objectives
- Understand Radix Primitives philosophy: unstyled, accessible, composable
- Implement Dialog, Popover, DropdownMenu, Select, Tabs, Tooltip, Accordion, Slider
- Use asChild prop and Slot pattern for composition with custom styled components
- Compose primitives with Tailwind CSS or CSS Modules
- Understand FocusScope, keyboard navigation, and accessibility tree bridging
- Build design system layer: Radix Primitive + app styles + additional behavior
- React 19 ref prop compatibility

---

## Core Content

### Radix Primitives Philosophy

Radix Primitives provide headless (unstyled) React components with built-in accessibility, keyboard navigation, and focus management. The "headless" approach separates behavior from presentation.

```
Without Radix:
  <select> — native, hard to style
  Custom <Select> — must build a11y, keyboard nav, focus trap from scratch

With Radix:
  <Select.Root> — behavior (focus, expand, close)
  <Select.Trigger> — your styled trigger (button)
  <Select.Content> — your styled dropdown
  <Select.Item> — your styled options
```

| Primitive | Behavior provided |
|-----------|-----------------|
| Dialog | Open/close, overlay, focus trap, Escape, aria-modal |
| Popover | Positioning, flip, close on outside click |
| DropdownMenu | Submenu nesting, keyboard arrows, typeahead |
| Select | Listbox pattern, search, group labels |
| Tabs | Keyboard navigation (arrow keys, Home/End) |
| Tooltip | Show/hide delay, positioning, role=tooltip |
| Accordion | Expand/collapse, Enter/Space toggle |
| Slider | ARIA slider, keyboard increment, range support |

### Basic Setup

```typescript
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Select from '@radix-ui/react-select'
```

### Slot Pattern and asChild

Radix primitives render native HTML elements by default. `asChild` delegates rendering to child element — the child receives all Radix props and event handlers.

```typescript
// Without asChild — Radix renders <button>
;<Dialog.Trigger>Open</Dialog.Trigger>

// With asChild — Button component receives all Radix behavior
;<Dialog.Trigger asChild>
  <MyCustomButton variant="primary">Open</MyCustomButton>
</Dialog.Trigger>
```

`Slot` component (separate from Radix) enables similar pattern for custom components:

```typescript
import { Slot } from '@radix-ui/react-slot'

function Button({ asChild, ...props }) {
  const Component = asChild ? Slot : 'button'
  return <Component {...props} />
}
```

### Dialog

```typescript
import * as Dialog from '@radix-ui/react-dialog'

function ConfirmDeleteModal({ open, onOpenChange, onConfirm }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl">
          <Dialog.Title>Confirm Delete</Dialog.Title>
          <Dialog.Description>
            This action cannot be undone.
          </Dialog.Description>
          <div className="flex gap-2 mt-4">
            <Dialog.Close asChild>
              <button className="secondary">Cancel</button>
            </Dialog.Close>
            <button className="danger" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

Features: focus trap (Tab cycles within dialog), Escape closes, overlay click closes (configurable), scroll lock.

### Popover

```typescript
import * as Popover from '@radix-ui/react-popover'

function HelpPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button>Help</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={8}
          className="bg-white p-4 rounded shadow-lg"
        >
          <p>Help content here</p>
          <Popover.Close aria-label="Close">X</Popover.Close>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

Features: auto-flip when viewport edge reached, arrow positioning, close on outside click.

### DropdownMenu

```typescript
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

function UserMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button>Account</button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="bg-white rounded shadow-lg p-1 min-w-[200px]">
          <DropdownMenu.Item className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
          <DropdownMenu.Item className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-red-600">
            Logout
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

Features: keyboard arrows, typeahead search, submenu with auto-positon, disabled items.

### Select

```typescript
import * as Select from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'

function LanguageSelect() {
  return (
    <Select.Root defaultValue="en">
      <Select.Trigger className="flex items-center gap-2 px-3 py-2 border rounded">
        <Select.Value placeholder="Select language" />
        <Select.Icon><ChevronDown /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="bg-white rounded shadow-lg">
          <Select.ScrollUpButton />
          <Select.Viewport>
            <Select.Group>
              <Select.Label className="px-3 py-1 text-xs text-gray-500">
                Languages
              </Select.Label>
              <Select.Item value="en" className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
                <Select.ItemText>English</Select.ItemText>
                <Select.ItemIndicator>✓</Select.ItemIndicator>
              </Select.Item>
              <Select.Item value="zh" className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
                <Select.ItemText>Chinese</Select.ItemText>
                <Select.ItemIndicator>✓</Select.ItemIndicator>
              </Select.Item>
            </Select.Group>
          </Select.Viewport>
          <Select.ScrollDownButton />
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
```

### Tabs

```typescript
import * as Tabs from '@radix-ui/react-tabs'

function SettingsTabs() {
  return (
    <Tabs.Root defaultValue="account" orientation="horizontal">
      <Tabs.List className="flex border-b" aria-label="Settings">
        <Tabs.Trigger value="account" className="px-4 py-2 data-[state=active]:border-b-2 border-blue-500">
          Account
        </Tabs.Trigger>
        <Tabs.Trigger value="password" className="px-4 py-2 data-[state=active]:border-b-2 border-blue-500">
          Password
        </Tabs.Trigger>
        <Tabs.Trigger value="notifications" className="px-4 py-2 data-[state=active]:border-b-2 border-blue-500">
          Notifications
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account" className="mt-4">
        Account settings...
      </Tabs.Content>
      <Tabs.Content value="password" className="mt-4">
        Password settings...
      </Tabs.Content>
      <Tabs.Content value="notifications" className="mt-4">
        Notification settings...
      </Tabs.Content>
    </Tabs.Root>
  )
}
```

Features: arrow key navigation, Home/End, roving tabindex.

### Tooltip

```typescript
import * as Tooltip from '@radix-ui/react-tooltip'

function Toolbar() {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button>Undo</button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            className="bg-gray-900 text-white text-sm px-2 py-1 rounded"
          >
            Undo (Cmd+Z)
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
```

### FocusScope and Keyboard Navigation

Radix primitives use `FocusScope` internally for modals and menus. Custom usage:

```typescript
import { FocusScope } from '@radix-ui/react-focus-scope'

function CustomModal({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) {
  if (!isOpen) return null

  return (
    <FocusScope loop trapped>
      <div role="dialog" aria-modal="true">
        {children}
      </div>
    </FocusScope>
  )
}
```

### Build Design System Layer

Pattern: Radix Primitive + app styles + additional behavior = app component.

```typescript
// components/ui/select.tsx
import * as Select from '@radix-ui/react-select'

export function AppSelect({ options, placeholder, onChange, value }: Props) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="app-select-trigger">
        <Select.Value placeholder={placeholder} />
        <Select.Icon><ChevronDown /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="app-select-content">
          <Select.Viewport>
            {options.map((opt) => (
              <Select.Item key={opt.value} value={opt.value} className="app-select-item">
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator>✓</Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
```

### React 19 Ref Compatibility

Radix v2 supports React 19's ref-as-prop pattern. `asChild` components forward refs to child element.

```typescript
;<Dialog.Trigger asChild>
  <button ref={myRef}>Open</button>
</Dialog.Trigger>
```

> **Think**: When should you NOT use Radix primitives and build custom instead?
>
> *Answer: Build custom when: (1) behavior is extremely simple (basic button toggle), (2) accessibility is not critical (internal tool), (3) performance requirements demand minimal DOM (virtual scroller), (4) design requires non-standard interaction that Radix does not support.*

---

### Why This Matters

Accessibility is not optional. Radix primitives provide WCAG-compliant behavior out of the box: ARIA attributes, keyboard navigation, focus management, screen reader announcements. Building these behaviors from scratch is error-prone and rarely comprehensive. Radix allows teams to focus on styling and app logic while relying on battle-tested accessibility patterns.

---

### Common Questions

**Q: Can I use Radix with CSS-in-JS libraries like styled-components?**
A: Yes. asChild prop accepts any styled component. Radix assigns className and data attributes — CSS-in-JS targets them normally.

**Q: How to handle custom animations?**
A: Radix primitives expose data-state attributes (`data-[state=open]`, `data-[state=closed]`). Use these for CSS transitions or pair with Framer Motion's AnimatePresence.

---

## Examples

### Example 1: Design System Dialog

```typescript
// components/ui/modal.tsx
import * as Dialog from '@radix-ui/react-dialog'

export function Modal({ open, onOpenChange, title, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 max-w-md w-full data-[state=open]:animate-scale-in">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### Example 2: Accessible Dropdown Menu

```typescript
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

export function AppMenu({ trigger, items }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[220px] bg-white rounded-lg shadow-lg p-1"
          sideOffset={5}
        >
          {items.map((item) =>
            item.separator ? (
              <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                className="px-3 py-2 hover:bg-gray-100 data-[disabled]:opacity-50 cursor-pointer"
                onSelect={item.onSelect}
              >
                {item.label}
              </DropdownMenu.Item>
            )
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

---

## Key Takeaways
- Radix = headless, accessible, composable primitives. Behavior separated from styling.
- asChild prop delegates rendering to child — the child receives Radix event handlers and ARIA attributes.
- Dialog: focus trap, overlay, Escape handling, aria-modal.
- DropdownMenu: keyboard arrows, typeahead, submenus.
- Select: listbox pattern, search, groups, scroll buttons.
- Tabs: arrow key navigation, roving tabindex, aria-orientation.
- Tooltip: show/hide delay, positioning, accessible description.
- FocusScope: loop/trap for modals, menus, and custom focus management.
- Design system pattern: Radix Primitive + Tailwind styles + app-specific props.
- React 19: ref as prop works with asChild pattern.

## Common Misconception

**"Radix is a component library like Material UI. I can drop it in and get styled components."**

Radix is unstyled. It provides behavior and accessibility only. You must style every element. The power is in full control over appearance while getting production-grade accessibility for free. Compare: MUI gives styled components with default themes. Radix gives unstyled primitives — you build the design system on top.

---

## Feynman Explain
(Explain Radix asChild to designer: "Normal component library gives you pre-styled button. Radix gives you button behavior — focus, click, keyboard — but invisible. You bring your own button component. Radix attaches to your button via asChild prop, like a puppeteer controlling your puppet's movements without changing its appearance." Compare to furniture: IKEA (MUI) gives assembled furniture. Radix gives lumber + tools — you build furniture, but tools guarantee joints hold weight (accessibility).)

---

## Reframe
(Pause. Headless UI adds complexity. For a simple 3-page app, Radix adds boilerplate. For a product with 50+ components, Radix pays off: consistent keyboard behavior, ARIA attributes, focus management across every dialog, menu, and tooltip. Decision rule: if app has more than 10 interactive components, adopt headless UI library. If less, manual ARIA + native elements may be cheaper.)

---

## Drill
Take the quiz. MCQs test Radix primitives, asChild/Slot pattern, accessibility features, keyboard navigation, FocusScope, design system composition, and React 19 ref prop compatibility.

Run: `learn.sh quiz external-lib-patterns 19-headless-ui-radix`

## Quiz: 19-headless-ui-radix


### What does asChild prop do in Radix primitives?

- [ ] A: Renders the primitive as a child of parent component

- [✓] B: Delegates rendering to child element — child receives Radix props and event handlers

- [ ] C: Renders primitive as HTML child element

- [ ] D: Disables primitive rendering


**Answer:** B

asChild merges Radix' behavior (events, ARIA attributes, refs) onto the child element. Child must be a valid React element that accepts forwarded props.


### Which Radix primitive provides focus trapping for modals?

- [ ] A: <FocusLock>

- [✓] B: <FocusScope>

- [ ] C: <Trap>

- [ ] D: <Modal>


**Answer:** B

FocusScope handles focus containment. Used internally by Dialog. Supports loop (cycle through focusable elements) and trapped (prevent focus leaving) modes.


### How to close a DropdownMenu item on selection?

- [ ] A: Call close() on DropdownMenu context

- [✓] B: onSelect callback fires — menu closes automatically by default

- [ ] C: Set closeOnSelect prop on DropdownMenu.Root

- [ ] D: Menu does not close on selection by default


**Answer:** B

DropdownMenu.Item.onSelect fires on click/Enter. Menu closes automatically after onSelect handler runs. Prevent default to keep menu open.


### What is the purpose of Radix's unstyled approach?

- [ ] A: Reduce bundle size by excluding CSS

- [✓] B: Give developers full control over styling while providing production-grade accessibility

- [ ] C: Force use of Tailwind CSS

- [ ] D: Prevent custom styling


**Answer:** B

Unstyled means Radix provides behavior (keyboard nav, focus, ARIA) without assumptions about appearance. Developers style freely while getting battle-tested accessibility.


### Tabs component uses which keyboard navigation model?

- [ ] A: Tab to switch tabs — tabindex=0 for all

- [✓] B: Roving tabindex — arrow keys navigate, Tab moves to active tab panel content

- [ ] C: Enter to switch tabs

- [ ] D: No keyboard navigation — mouse only


**Answer:** B

Tabs uses roving tabindex: only active tab is in tab order. Arrow keys move focus between tabs. Tab key moves focus from active tab into tab panel content.


### What data attribute does Radix set on open overlay elements?

- [ ] A: data-open

- [ ] B: data-visibile

- [✓] C: data-[state=open]

- [ ] D: aria-expanded


**Answer:** C

Radix uses data-[state=open] and data-[state=closed] on elements that toggle visibility. CSS targets these for transitions: `.overlay[data-state=open] { opacity: 1 }`


### When would you NOT use Radix and build custom component instead?

- [ ] A: When app needs accessible components

- [✓] B: When interaction is extremely simple with no complex keyboard or a11y requirements

- [ ] C: When using TypeScript

- [ ] D: When app is large with 50+ components


**Answer:** B

Simple toggle buttons or static lists do not need Radix overhead. Radix valuable for complex interactive components: modals, menus, selects, comboboxes.


### Select component uses which ARIA pattern?

- [ ] A: combobox

- [✓] B: listbox

- [ ] C: menu

- [ ] D: dialog


**Answer:** B

Radix Select implements ARIA listbox pattern: role=listbox on content, role=option on items, aria-selected for current value, aria-activedescendant for focus.


### How to compose Radix Popover with Framer Motion animations?

- [ ] A: Wrap entire Popover.Root with AnimatePresence

- [✓] B: Wrap Popover.Content with AnimatePresence and use data-[state=open] for variants

- [ ] C: Radix does not support animation

- [ ] D: Use CSS transitions only


**Answer:** B

Popover.Content inside AnimatePresence with key based on open state. Variants use data-[state=open] and data-[state=closed] for enter/exit animations.


### Tooltip delayDuration controls what?

- [ ] A: How long tooltip stays visible after mouse leaves

- [✓] B: Delay before tooltip appears on hover (default 700ms)

- [ ] C: Animation duration of tooltip

- [ ] D: Delay before tooltip disappears


**Answer:** B

delayDuration (ms) on Tooltip.Provider sets hover-to-show delay. Default 700ms. Also supports skipDelayDuration for rapid re-triggering.


---

# Module 20: Data Fetching — TanStack Query

Est. study time: 2.5h
Language: en

## Learning Objectives
- Set up QueryClientProvider with React 19
- Use useQuery and useMutation for data fetching and mutations
- Understand staleTime vs gcTime (formerly cacheTime)
- Implement pagination with keepPreviousData and placeholderData
- Build infinite scrolling with useInfiniteQuery
- Implement optimistic updates with onMutate rollback
- Handle parallel, dependent, and conditional queries
- Use React Query DevTools for debugging
- React 19: use() hook vs useQuery, Suspense integration with skipToken
- Design typed query hooks with codegen patterns
- Build cache invalidation and prefetching strategies

---

## Core Content

### TanStack Query Architecture

TanStack Query manages server state: caching, background refetching, stale detection, garbage collection.

```
Component
  ├── useQuery(key, fetcher)
  │     └── QueryClient (cache)
  │           ├── staleTime: data considered fresh (no refetch)
  │           ├── gcTime: data kept in cache after unused
  │           └── retry: auto-retry on failure
  └── useMutation(mutationFn)
        └── invalidateQueries / setQueryData
```

| Concept | Old name | New name (v5+) | Default |
|---------|----------|----------------|---------|
| Freshness duration | staleTime | staleTime | 0 (always stale) |
| Cache retention | cacheTime | gcTime | 5 minutes |
| Refetch on window focus | refetchOnWindowFocus | refetchOnWindowFocus | true |
| Retry count | retry | retry | 3 |

### Setup with React 19

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 min fresh
      gcTime: 1000 * 60 * 30,      // 30 min garbage collection
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Content />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### useQuery

```typescript
import { useQuery } from '@tanstack/react-query'

type User = { id: string; name: string; email: string }

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users')
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

function UsersList() {
  const { data, isLoading, isError, error, isFetching } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  if (isLoading) return <Spinner />
  if (isError) return <p>Error: {error.message}</p>

  return (
    <div>
      {isFetching && <span>Refreshing...</span>}
      {data?.map((user) => <UserCard key={user.id} user={user} />)}
    </div>
  )
}
```

Query keys:

```typescript
// Scalar key
useQuery({ queryKey: ['users'], queryFn: fetchUsers })

// Key with params — unique key per param
useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
})

// Key with object — order matters for cache matching
useQuery({
  queryKey: ['users', { page, limit, sort }],
  queryFn: () => fetchUsers({ page, limit, sort }),
})
```

### useMutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

function CreateUserForm() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (newUser: { name: string; email: string }) =>
      fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      }).then((r) => r.json()),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },

    onError: (error) => {
      toast.error(`Failed: ${error.message}`)
    },
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      mutation.mutate({ name: 'Alice', email: 'alice@example.com' })
    }}>
      <button disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create User'}
      </button>
    </form>
  )
}
```

### staleTime vs gcTime

```typescript
// Data fresh for 5 minutes — no background refetch during this window
useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 1000 * 60 * 5,
})

// Data stays in cache for 30 minutes after last observer unmounts
// Subsequent mount within 30min shows cached data immediately
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: 1000 * 60 * 30 },
  },
})
```

| Setting | Effect |
|---------|--------|
| staleTime: 0 | Always refetch on mount (default) |
| staleTime: Infinity | Never refetch automatically |
| gcTime: 0 | Eager garbage collection — no offline cache |
| gcTime: Infinity | Never garbage collect |

### Pagination

```typescript
function PaginatedUsers() {
  const [page, setPage] = useState(1)

  const { data, isPlaceholderData } = useQuery({
    queryKey: ['users', page],
    queryFn: () => fetchUsersPage(page),
    placeholderData: keepPreviousData,
    // React 19: placeholderData keeps previous data during fetch
  })

  return (
    <div>
      {data?.users.map((user) => <UserCard key={user.id} user={user} />)}
      <button
        disabled={page <= 1}
        onClick={() => setPage((p) => p - 1)}
      >
        Previous
      </button>
      <button
        disabled={isPlaceholderData || !data?.hasMore}
        onClick={() => setPage((p) => p + 1)}
      >
        Next
      </button>
    </div>
  )
}
```

`placeholderData: keepPreviousData` (v5) replaces `keepPreviousData: true` (v4). Shows stale data during fetch transition instead of loading spinner.

### Infinite Scrolling

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'

function InfiniteFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  // IntersectionObserver to trigger fetchNextPage
  return (
    <div>
      {data?.pages.map((page) =>
        page.items.map((item) => <FeedItem key={item.id} item={item} />)
      )}
      <button
        ref={loadMoreRef}
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Load more' : 'All loaded'}
      </button>
    </div>
  )
}
```

### Optimistic Updates

```typescript
function ToggleLike({ postId, liked }: { postId: string; liked: boolean }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => fetch(`/api/posts/${postId}/like`, { method: 'POST' }),

    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['post', postId] })

      // Snapshot previous value
      const previous = queryClient.getQueryData(['post', postId])

      // Optimistically update
      queryClient.setQueryData(['post', postId], (old: Post) => ({
        ...old,
        likes: liked ? old.likes - 1 : old.likes + 1,
        isLiked: !liked,
      }))

      return { previous }
    },

    onError: (_err, _vars, context) => {
      // Rollback on error
      queryClient.setQueryData(['post', postId], context?.previous)
    },

    onSettled: () => {
      // Refetch to ensure server sync
      queryClient.invalidateQueries({ queryKey: ['post', postId] })
    },
  })

  return (
    <button onClick={() => mutation.mutate()}>
      {liked ? 'Unlike' : 'Like'}
    </button>
  )
}
```

### Parallel and Dependent Queries

```typescript
// Parallel — multiple useQuery calls (they run in parallel automatically)
function Dashboard() {
  const users = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const posts = useQuery({ queryKey: ['posts'], queryFn: fetchPosts })
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats })

  if (!users.data || !posts.data || !stats.data) return <Loading />

  return <DashboardView users={users.data} posts={posts.data} stats={stats.data} />
}

// Dependent — enabled when previous query succeeds
function UserPosts({ userId }: { userId: string }) {
  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })

  const postsQuery = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => fetchUserPosts(userId),
    enabled: !!userQuery.data,  // Wait for user load
  })

  if (!userQuery.data || !postsQuery.data) return <Loading />
  return <PostsList user={userQuery.data} posts={postsQuery.data} />
}
```

### Suspense Integration

React 19 Suspense with TanStack Query:

```typescript
function UserProfile() {
  // useSuspenseQuery triggers Suspense boundary instead of returning isLoading
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })

  const { data: posts } = useSuspenseQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => fetchUserPosts(userId),
    // Enabled only after user loads — Suspense handles waterfall
  })

  return <ProfileView user={user} posts={posts} />
}

// Parent
;<Suspense fallback={<BigSpinner />}>
  <UserProfile userId="123" />
</Suspense>
```

`skipToken` for conditional queries without Suspense:

```typescript
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: userId ? () => fetchUser(userId) : skipToken,
})
```

### Prefetching

```typescript
import { useQueryClient } from '@tanstack/react-query'

function UserLink({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  // Prefetch on hover
  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: () => fetchUser(userId),
      staleTime: 1000 * 60,
    })
  }

  return (
    <Link
      to={`/users/${userId}`}
      onMouseEnter={prefetch}
    >
      View Profile
    </Link>
  )
}
```

### Cache Invalidation Strategy

```typescript
// Invalidate single query
queryClient.invalidateQueries({ queryKey: ['users'] })

// Invalidate all queries matching prefix
queryClient.invalidateQueries({ queryKey: ['user'] })  // ['user', id], ['user', 'list']...

// Invalidate with predicate
queryClient.invalidateQueries({
  predicate: (query) => query.queryKey[0] === 'user' && query.state.data?.role === 'admin',
})

// Remove from cache
queryClient.removeQueries({ queryKey: ['temp', id] })
```

### Typed Query Hooks (Codegen Pattern)

```typescript
// hooks/useUser.ts
export function useUser(userId: string) {
  return useQuery<User>({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })
}

// hooks/useUsers.ts
export function useUsers(filters: UserFilters) {
  return useQuery<User[]>({
    queryKey: ['users', filters],
    queryFn: () => fetchUsers(filters),
  })
}

// hooks/useCreateUser.ts
export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

### React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Only in development
;<ReactQueryDevtools
  initialIsOpen={false}
  buttonPosition="bottom-left"
/>
```

DevTools features: inspect cache, query states (fresh/stale/loading/inactive), trigger refetch, toggle disable, view query data.

> **Think**: What is the difference between isLoading and isFetching in useQuery?
>
> *Answer: isLoading = no cached data AND fetch in progress (first load). isFetching = fetch in progress (any fetch — first, background refetch, retry). isFetching is true even when cached data is shown (background refetch). isLoading is only true for the initial load when no data exists in cache.*

---

### Why This Matters

Data fetching is the most common frontend pattern. Every app fetches, caches, paginates, and mutates server data. TanStack Query eliminates boilerplate (loading/error states, refetch logic, cache management) and prevents bugs (stale data, race conditions, unnecessary requests). Understanding its cache model is essential for building performant, reliable React apps.

---

### Common Questions

**Q: Should I put all API calls in TanStack Query or use React Context for shared data?**
A: Use TanStack Query for server state (API data). React Context for client state (theme, locale, feature flags). TanStack Query handles caching, background sync, and invalidation. Context does not.

**Q: How to handle file upload progress?**
A: useMutation with axios `onUploadProgress`. Track progress in mutation state: `const [progress, setProgress] = useState(0)`.

---

## Examples

### Example 1: Full Data Layer with Typed Hooks

```typescript
// api/users.ts
export function fetchUsers(): Promise<User[]> { ... }
export function fetchUser(id: string): Promise<User> { ... }
export function createUser(data: CreateUserDTO): Promise<User> { ... }

// hooks/useUsers.ts
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 1000 * 60 * 2,
  })
}

// hooks/useUser.ts
export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
    enabled: !!id,
  })
}

// hooks/useCreateUser.ts
export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

### Example 2: Optimistic Like Toggle (Social Feed)

```typescript
function LikeButton({ post }: { post: Post }) {
  const qc = useQueryClient()

  const likeMutation = useMutation({
    mutationFn: () => fetch(`/api/posts/${post.id}/like`, { method: 'POST' }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['feed'] })
      const prev = qc.getQueryData(['feed'])
      qc.setQueryData(['feed'], (old: Post[]) =>
        old.map((p) => p.id === post.id ? { ...p, likes: p.likes + 1, liked: true } : p)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['feed'], ctx?.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  return (
    <button onClick={() => likeMutation.mutate()}>
      {post.liked ? 'Liked' : 'Like'} ({post.likes})
    </button>
  )
}
```

---

## Key Takeaways
- QueryClientProvider wraps app. configure staleTime/gcTime defaults.
- useQuery: queryKey (cache key) + queryFn (fetcher). Returns data, isLoading, isError, isFetching.
- useMutation: mutationFn, onSuccess (invalidateQueries), onMutate (optimistic), onError (rollback).
- staleTime: data fresh duration. gcTime: cache retention after unused.
- Pagination: placeholderData: keepPreviousData shows stale data during page transition.
- Infinite scroll: useInfiniteQuery, getNextPageParam, fetchNextPage.
- Optimistic updates: onMutate snapshot + setQueryData, onError rollback, onSettled refetch.
- Dependent queries: enabled option gates query on previous success.
- Suspense: useSuspenseQuery triggers Suspense boundary. skipToken for conditionals.
- Prefetching: queryClient.prefetchQuery on hover for instant navigation.
- Typed hooks: wrap useQuery/useMutation in custom hooks for reusability.

## Common Misconception

**"TanStack Query replaces useState/useReducer for all state."**

TanStack Query manages server state (data from API). Client state (modal open, form input, filter selection) still belongs in useState/useReducer/Context. Using TanStack Query for client state adds unnecessary complexity and memory overhead.

---

## Feynman Explain
(Explain TanStack Query to backend engineer: "TanStack Query is Redis for your frontend. It caches API responses, marks them stale after configurable TTL (staleTime), background-refreshes stale data, and evicts unused cache after gcTime. Components subscribe to cache keys — when you mutate, cache invalidates, subscribed components refetch. Like database materialized view with automatic refresh policy." Compare to React's useState: useState is local variable, TanStack Query is shared cache with coherency protocol.)

---

## Reframe
(Pause. Data fetching libraries are not needed for every project. For a static marketing site, TanStack Query overhead is not justified. For 10+ API endpoints with caching, pagination, and mutations, TanStack Query eliminates more code than it adds. Decision rule: if app fetches data from more than 3 endpoints with mutations, adopt TanStack Query. If app is mostly static pages with one-off fetch calls, native fetch + useEffect is simpler.)

---

## Drill
Take the quiz. MCQs test useQuery/useMutation, staleTime vs gcTime, pagination, infinite query, optimistic updates, Suspense integration, prefetching, cache invalidation, typed hooks, and React 19 compatibility.

Run: `learn.sh quiz external-lib-patterns 20-data-fetching-tanstack-query`

## Quiz: 20-data-fetching-tanstack-query


### What is the difference between staleTime and gcTime (formerly cacheTime)?

- [ ] A: Same concept — synonyms

- [✓] B: staleTime = how long data is considered fresh (no refetch). gcTime = how long unused data stays in cache before garbage collection

- [ ] C: staleTime = cache duration. gcTime = retry timeout

- [ ] D: staleTime = server cache. gcTime = client cache


**Answer:** B

staleTime controls refetch behavior (fresh data does not refetch). gcTime controls cache eviction (data kept in cache after last observer unmounts). Default: staleTime=0, gcTime=5min.


### What does useQuery return when cache has data but a background refetch is in progress?

- [ ] A: isLoading: true, data: undefined

- [✓] B: isLoading: false, isFetching: true, data: cached data

- [ ] C: isFetching: false, data: cached data

- [ ] D: isLoading: true, isFetching: true, data: undefined


**Answer:** B

isLoading = no cached data AND fetch in progress (first load). isFetching = any fetch in progress. Background refetch shows cached data with isFetching=true.


### What TanStack Query v5 option replaces keepPreviousData: true for pagination?

- [ ] A: previousData: true

- [✓] B: placeholderData: keepPreviousData

- [ ] C: staleData: true

- [ ] D: cachePrevious: true


**Answer:** B

v5 renamed keepPreviousData to placeholderData: keepPreviousData. Shows previous page data while next page loads, avoiding loading spinner flash.


### How to prevent a query from fetching until a condition is met?

- [✓] A: Set enabled: condition in query options

- [ ] B: Wrap query in if statement

- [ ] C: Use lazy: true

- [ ] D: Set skip: true


**Answer:** A

enabled option gates query execution. enabled: false means query never runs. enabled: !!userId means query runs when userId is truthy. Used for dependent queries.


### Optimistic update rollback: where to store snapshot of previous data?

- [ ] A: In a global variable

- [✓] B: Return from onMutate — passed as context to onError

- [ ] C: Store in queryClient.getQueryData before mutation

- [ ] D: Snapshot not needed — TanStack Query auto-rolls back


**Answer:** B

onMutate returns context object. If mutation fails, onError receives context as third argument. Use context.previous to restore cached data via setQueryData.


### What hook provides incremental data loading with cursor-based pagination?

- [ ] A: usePaginatedQuery

- [✓] B: useInfiniteQuery

- [ ] C: useCursorQuery

- [ ] D: useLazyQuery


**Answer:** B

useInfiniteQuery supports cursor-based pagination. getNextPageParam returns next cursor from last page response. fetchNextPage loads next page, appending to data.pages array.


### What is the difference between queryClient.invalidateQueries and queryClient.refetchQueries?

- [ ] A: Same behavior — synonyms

- [✓] B: invalidateQueries marks queries as stale (refetch on next render). refetchQueries triggers immediate refetch regardless of stale state

- [ ] C: invalidateQueries triggers immediate refetch. refetchQueries marks stale

- [ ] D: invalidateQueries only affects active queries


**Answer:** B

invalidateQueries sets stale time to 0 — queries refetch on next observer mount or window focus. refetchQueries forces immediate refetch of matching queries regardless of staleTime.


### React 19: which query hook integrates with Suspense boundaries?

- [ ] A: useQuery

- [ ] B: useSuspenseQuery

- [✓] C: useSuspenseQuery replaces useQuery for Suspense — throws promise to Suspense boundary

- [ ] D: QueryClientProvider handles Suspense automatically


**Answer:** C

useSuspenseQuery throws promise during fetch, caught by parent Suspense boundary. Eliminates isLoading check — component renders only with data.


### How to skip query execution in a Suspense-enabled component without enabling/disabling?

- [ ] A: Return null from queryFn

- [✓] B: Use skipToken as queryFn when condition not met

- [ ] C: Set enabled: false on useSuspenseQuery

- [ ] D: Wrap in conditional useQuery


**Answer:** B

skipToken is special sentinel value. When queryFn equals skipToken, query does not execute. Use for conditional queries with Suspense: queryFn: userId ? fetchUser : skipToken.


### useMutation.onSuccess and queryClient.invalidateQueries: what is the common pattern?

- [ ] A: Invalidate is automatic — no manual call needed

- [✓] B: After mutation succeeds, invalidate related queries so they refetch fresh data

- [ ] C: Invalidate removes queries from cache permanently

- [ ] D: onSuccess is optional — invalidation happens in onSettled only


**Answer:** B

Standard pattern: mutation succeeds → invalidate queries that include mutated data → components subscribed to those queries refetch. Example: create user → invalidate ['users'].


---

# Module 21: Component Testing — Testing Library & Vitest

Est. study time: 2h
Language: en

## Learning Objectives
- Set up Vitest with jsdom for React component testing
- Use Testing Library queries (screen, render, fireEvent, userEvent)
- Implement wrapper pattern for providers (Theme, Router, QueryClient)
- Mock external libraries with vi.mock
- Test custom wrappers of AG Grid / Formio
- Understand snapshot vs behavior testing tradeoffs
- Handle React 19 Concurrent Mode + StrictMode test implications
---

## Core Content

### Vitest Setup with jsdom

Vitest is a Vite-native test runner. For React component tests, configure jsdom as the browser-like environment:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```

Setup file configures Testing Library matchers and mocks:

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// Mock browser APIs not available in jsdom
vi.stubGlobal('IntersectionObserver', vi.fn())
vi.stubGlobal('ResizeObserver', vi.fn())
```

### Testing Library Queries

Testing Library encourages testing from user perspective:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders with label and responds to click', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()

    render(<Button label="Submit" onClick={onClick} />)

    // Query by accessible text
    const button = screen.getByRole('button', { name: /submit/i })
    expect(button).toBeInTheDocument()

    // Simulate user interaction
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('supports keyboard navigation', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()

    render(<Button label="Submit" onClick={onClick} />)

    const button = screen.getByRole('button', { name: /submit/i })
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalled()
  })
})
```

Query priority: `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByDisplayValue` > `getByAltText` > `getByTitle` > `getByTestId`.

`screen` methods auto-scope to document body. No need to destructure from render return.

### Wrapper Pattern for Providers

Components often need context providers. Create wrapper factory:

```typescript
// src/test/wrappers.tsx
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../theme'
import type { ReactNode } from 'react'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/']}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>
    )
  }
}
```

Usage:

```typescript
import { render, screen } from '@testing-library/react'
import { UserDashboard } from './UserDashboard'

describe('UserDashboard', () => {
  it('renders user info', () => {
    render(<UserDashboard userId="123" />, { wrapper: createWrapper() })
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })
})
```

### Mocking External Libraries with vi.mock

AG Grid and Formio require mocking due to heavy DOM manipulation:

```typescript
import { vi } from 'vitest'

// Mock AG Grid
vi.mock('ag-grid-react', () => ({
  AgGridReact: ({ rowData, columnDefs }: any) => (
    <div data-testid="ag-grid">
      <div data-testid="grid-rows">{rowData?.length ?? 0} rows</div>
      <div data-testid="grid-columns">{columnDefs?.length ?? 0} cols</div>
    </div>
  ),
}))

// Mock Formio
vi.mock('@formio/react', () => ({
  FormioComponent: ({ component, data, onChange }: any) => (
    <div data-testid="formio-component">
      <input
        data-testid="formio-input"
        value={data?.[component?.key] ?? ''}
        onChange={(e) => onChange?.(component?.key, e.target.value)}
      />
    </div>
  ),
}))
```

Mock at module level (top of file) or inline with `vi.mock` hoisted to top.

### Testing Custom Wrappers

Component wrapping AG Grid:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DataTable } from './DataTable'

describe('DataTable', () => {
  it('renders rows and supports row click', async () => {
    const onRowClick = vi.fn()
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]

    render(<DataTable data={data} onRowClick={onRowClick} />)

    expect(screen.getByTestId('ag-grid')).toBeInTheDocument()
    expect(screen.getByTestId('grid-rows')).toHaveTextContent('2 rows')
  })
})
```

### Snapshot vs Behavior Testing

Snapshot testing serializes component output:

```typescript
it('matches snapshot', () => {
  const { container } = render(<Button label="Submit" />)
  expect(container.firstChild).toMatchSnapshot()
})
```

Snapshots catch unintended DOM changes but produce noisy failures. Behavior testing (query → assert → interact) is more resilient.

Prefer behavior testing. Use snapshots sparingly for stable, small components.

### React 19 Concurrent Mode + StrictMode

React 19 Concurrent Mode affects tests:

```typescript
import { act } from '@testing-library/react'

it('handles concurrent state updates', async () => {
  const user = userEvent.setup()
  render(<ExpensiveList />)

  await act(async () => {
    await user.click(screen.getByRole('button', { name: /load more/i }))
  })

  // Concurrent rendering may batch updates
  expect(screen.getAllByRole('listitem')).toHaveLength(20)
})
```

StrictMode double-invokes effects in development. Tests may need cleanup handling:

```typescript
it('cleans up subscriptions', () => {
  const unsubscribe = vi.fn()
  render(<SubscriptionManager />)

  // StrictMode calls effect twice, cleanup twice
  expect(unsubscribe).toHaveBeenCalledTimes(0)

  unmount()
  expect(unsubscribe).toHaveBeenCalled()
})
```

Use `userEvent.setup()` for realistic interaction simulation. Avoid `fireEvent` for complex interactions.

---

### Why This Matters

Component tests catch regressions before they reach production. Testing Library enforces accessible component design. Mocking strategy determines whether tests are fast and reliable or brittle and slow.

---

### Common Questions

**Q: Should I use `fireEvent` or `userEvent`?**

A: `userEvent` for any interaction that simulates real user behavior (click, type, hover). `fireEvent` only for edge cases (custom events, low-level DOM events that userEvent doesn't support).

**Q: How do I test components that use `use()` hook from React 19?**

A: Wrap component in Suspense boundary. Use `findBy*` queries that wait for async resolution. React 19's `use()` resolves promises during render.

---

## Examples

### Example 1: Testing a Data Grid Wrapper

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DataGridWrapper } from './DataGridWrapper'
import { createWrapper } from '../test/wrappers'

describe('DataGridWrapper', () => {
  it('renders with theme and navigates on row click', async () => {
    const onView = vi.fn()
    const user = userEvent.setup()

    render(
      <DataGridWrapper
        columns={[
          { field: 'name', headerName: 'Name' },
          { field: 'status', headerName: 'Status' },
        ]}
        rows={[
          { id: 1, name: 'Project A', status: 'Active' },
          { id: 2, name: 'Project B', status: 'Archived' },
        ]}
        onView={onView}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId('ag-grid')).toBeInTheDocument()
    expect(screen.getByText('Project A')).toBeInTheDocument()
  })
})
```

### Example 2: Testing a Form with Validation

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RegistrationForm } from './RegistrationForm'

describe('RegistrationForm', () => {
  it('shows validation errors on empty submit', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<RegistrationForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits with valid data', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<RegistrationForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'secure123')
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'secure123',
    })
  })
})
```

### Example 3: Mocking AG Grid Theme Provider

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ThemeDataGrid } from './ThemeDataGrid'

vi.mock('ag-grid-react', () => ({
  AgGridReact: ({ themeClass }: any) => (
    <div data-testid="ag-grid" className={themeClass} />
  ),
}))

describe('ThemeDataGrid', () => {
  it('applies theme class', () => {
    render(<ThemeDataGrid theme="dark" />)
    const grid = screen.getByTestId('ag-grid')
    expect(grid.className).toContain('ag-theme-dark')
  })
})
```

---

## Key Takeaways
- Vitest + jsdom provides fast Node.js-based React testing
- Testing Library queries encourage accessible, user-centric tests
- Wrapper factory pattern provides context providers without repetition
- vi.mock hoists to module level; use for browser-only libs
- Behavior testing over snapshot testing for resilient test suites

## Common Misconception

"**Snapshot testing replaces behavior testing.**"

Snapshots catch accidental DOM changes but miss logic errors. A button snapshot passes if className changes, but the onClick handler might still be broken. Behavior tests verify interactions and state changes.

## Feynman Explain

Component testing verifies UI behaves correctly from user perspective. Think of it like automated QA: render component, find elements the way a user would (by label or role), simulate interactions, assert outcomes. Mock external dependencies (AG Grid, Formio) to isolate component logic.

## Reframe

Test-driven component design produces more accessible, better-architected UIs. Testing Library's role-based queries force you to use semantic HTML. Mock boundaries clarify which responsibilities belong to your component vs third-party libs.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 21-component-testing`

## Quiz: 21-component-testing


### Which Testing Library query should you use as the first preference?

- [ ] A: getByTestId

- [ ] B: getByText

- [✓] C: getByRole

- [ ] D: getByPlaceholderText


**Answer:** C

getByRole is the most accessible query. It finds elements by ARIA role and matches how assistive technology users navigate.


### What is the purpose of the wrapper option in Testing Library's render function?

- [ ] A: Decorate component with CSS classes

- [✓] B: Provide context providers like Router and QueryClient

- [ ] C: Wrap component in error boundary

- [ ] D: Add data-testid attributes automatically


**Answer:** B

Wrapper allows injecting context providers around the tested component without repeating provider setup in every test.


### In Vitest setup with jsdom, why do we mock IntersectionObserver and ResizeObserver?

- [ ] A: They are slow and slow down tests

- [✓] B: They are not implemented in jsdom environment

- [ ] C: They cause memory leaks in tests

- [ ] D: Testing Library requires explicit mock declarations


**Answer:** B

jsdom does not implement IntersectionObserver or ResizeObserver. Tests crash without stubs for these browser APIs.


### How does React 19 Concurrent Mode affect component tests?

- [ ] A: It has no effect on tests

- [✓] B: State updates may be batched, requiring act() wrapping

- [ ] C: All tests must use async/await

- [ ] D: Testing Library throws warnings for concurrent rendering


**Answer:** B

Concurrent Mode batches state updates. Tests wrapping interactions in act() ensures all updates flush before assertions.


### Which approach should be preferred for most component tests?

- [ ] A: Snapshot testing

- [✓] B: Behavior testing with user interactions

- [ ] C: Render-only snapshot assertion

- [ ] D: Manual DOM inspection


**Answer:** B

Behavior testing validates actual user interactions and state changes, producing more resilient tests than snapshots.


### What happens when vi.mock is called at module level?

- [ ] A: It is evaluated at function call time

- [✓] B: It is hoisted to the top of the file before imports

- [ ] C: It only applies within the current describe block

- [ ] D: It requires explicit import path matching


**Answer:** B

vi.mock is hoisted by Vitest's transform pipeline, replacing module imports before test code executes.


### Why should userEvent be preferred over fireEvent for interactions?

- [ ] A: userEvent is faster than fireEvent

- [✓] B: userEvent simulates full user interaction sequence including hover, focus, and keyboard events

- [ ] C: fireEvent is deprecated in Testing Library v14

- [ ] D: userEvent requires less setup code


**Answer:** B

userEvent dispatches the full chain of events (focus, keyDown, keyUp, click, blur) matching real browser behavior.


### When testing a component wrapping AG Grid, what is the recommended approach?

- [ ] A: Test AG Grid API directly

- [✓] B: Mock AgGridReact and test the wrapper component's logic

- [ ] C: Use end-to-end tests instead of unit tests

- [ ] D: Render AG Grid without mocking


**Answer:** B

AG Grid is a complex library with heavy DOM. Mocking the grid component isolates wrapper logic and keeps tests fast.


### What does React 19 StrictMode double-invocation mean for test cleanup?

- [ ] A: Cleanup runs once regardless of StrictMode

- [✓] B: Effects and cleanups run twice in development, requiring careful assertion count handling

- [ ] C: StrictMode is disabled during tests

- [ ] D: Testing Library handles double-invocation automatically


**Answer:** B

StrictMode double-invokes effects for detecting impure logic. Tests asserting on subscription counts must account for this.


### Which Vitest configuration disables retries for React Query in tests?

- [ ] A: retryDelay: 0

- [✓] B: retry: false

- [ ] C: enabled: false

- [ ] D: refetchOnMount: false


**Answer:** B

React Query retries failed queries by default. Setting retry: false in test QueryClient prevents unexpected retries from interfering with assertions.


---

# Module 22: CSS Frameworks — Tailwind CSS

Est. study time: 2h
Language: en

## Learning Objectives
- Understand Tailwind utility-first architecture vs CSS-in-JS
- Use cn() helper (clsx + twMerge) for class composition
- Implement component patterns with className prop
- Map design tokens with CSS variables + tailwind.config
- Understand React 19 Compiler compatibility with Tailwind
- Apply responsive variants and dark mode strategy
- Integrate Tailwind with Radix UI components
---

## Core Content

### Utility-First Architecture

Tailwind provides low-level utility classes instead of pre-built components:

```html
<!-- Traditional CSS approach -->
<div class="card">
  <h2 class="card-title">Hello</h2>
  <p class="card-body">World</p>
</div>

<!-- Tailwind utility approach -->
<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
  <h2 className="text-lg font-semibold text-gray-900">Hello</h2>
  <p className="text-sm text-gray-600">World</p>
</div>
```

Utility-first reduces CSS bundle size (only used utilities are generated), eliminates naming collisions, and keeps styles co-located with markup.

CSS-in-JS (styled-components, Emotion) generates styles at runtime or build time via JS. Tailwind generates CSS at build time via PostCSS — no runtime overhead.

### cn() Helper: clsx + twMerge

`clsx` merges class names conditionally. `twMerge` resolves Tailwind specificity conflicts:

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Usage:

```typescript
cn('px-4 py-2 rounded', isPrimary && 'bg-blue-600 text-white', isLarge && 'px-6 py-3 text-lg')
// Result: 'px-6 py-3 rounded text-lg bg-blue-600 text-white'
// twMerge resolves px-4 vs px-6 conflict
```

### Component Patterns with className Prop

Accept `className` prop and merge with internal styles:

```typescript
// ui/button.tsx
import { forwardRef } from 'react'
import { cn } from '../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
```

Consumers can override without breaking internal styles:

```tsx
<Button className="w-full md:w-auto">Submit</Button>
```

### Design Token Mapping

Use CSS variables for design tokens, reference in tailwind.config:

```css
/* styles/tokens.css */
:root {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-surface: #ffffff;
  --color-surface-secondary: #f8fafc;
  --spacing-grid: 1rem;
  --radius-default: 0.5rem;
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}
```

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          secondary: 'var(--color-surface-secondary)',
        },
      },
      spacing: {
        grid: 'var(--spacing-grid)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius-default)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
}

export default config
```

### React 19 Compiler Compatibility

React 19 Compiler (React Forget) memoizes components automatically. Tailwind has zero runtime CSS-in-JS — all styles are static class names. This makes Tailwind fully compiler-compatible with no migration effort.

CSS-in-JS libraries that use dynamic style injection face challenges with the compiler:

```typescript
// styled-components: runtime style injection — compiler can't optimize
const StyledButton = styled.button`
  background: ${props => props.$primary ? 'blue' : 'gray'};
`

// Tailwind: static classes — compiler-friendly
<button className={cn('bg-blue-600', isPrimary && 'bg-blue-600')}>
```

### Responsive Variants

Tailwind uses breakpoint prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {items.map(item => (
    <Card
      key={item.id}
      className="p-4 sm:p-6 lg:p-8"
    />
  ))}
</div>
```

Custom breakpoints in config:

```typescript
theme: {
  extend: {
    screens: {
      tablet: '768px',
      desktop: '1024px',
    },
  },
}
```

### Dark Mode Strategy

Configure dark mode variant:

```typescript
// tailwind.config.ts
const config: Config = {
  darkMode: 'class', // or 'media' for system preference
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'var(--color-background)',
        },
      },
    },
  },
}
```

Usage:

```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <h1 className="text-gray-900 dark:text-white">Title</h1>
  <p className="text-gray-600 dark:text-gray-400">Description</p>
</div>
```

Toggle strategy:

```typescript
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return [isDark, setIsDark] as const
}
```

### Integration with Radix UI

Radix provides headless UI primitives. Tailwind provides styles. Composition pattern:

```tsx
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../lib/utils'

export function Modal({ open, onOpenChange, title, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out'
        )}>
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

Radix provides `data-state` attributes for styling. Tailwind's `data-*` variant handles transitions.

---

### Why This Matters

Tailwind dominates the CSS framework landscape. Its utility-first approach eliminates CSS maintenance burden, enforces design system consistency, and pairs naturally with React 19 Compiler. Integration pattern with cn() and className prop is the standard for React component libraries in 2026.

---

### Common Questions

**Q: When should I extract repeated utility patterns into a component vs keep inline?**

A: Extract when the same pattern appears 3+ times. Use component composition (className prop) instead of hardcoding class strings in consumers.

**Q: Does Tailwind work with React 19 Server Components?**

A: Yes. Tailwind generates static CSS at build time. Server Components render class names to HTML. No runtime dependency needed.

---

## Examples

### Example 1: Card Component with Composition

```typescript
// ui/card.tsx
import { cn } from '../lib/utils'

interface CardProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-gray-200 bg-white shadow-sm',
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn('border-b border-gray-100 px-6 py-4', className)}>
      {children}
    </div>
  )
}

export function CardContent({ className, children }: CardProps) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  )
}
```

Usage:

```tsx
<Card className="max-w-md">
  <CardHeader>
    <h2 className="text-xl font-semibold">Analytics</h2>
  </CardHeader>
  <CardContent>
    <p className="text-gray-600">Dashboard content here</p>
  </CardContent>
</Card>
```

### Example 2: Responsive Data Grid with Tailwind

```tsx
function ResponsiveGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map(item => (
        <div
          key={item.id}
          className="rounded-lg border p-3 text-center transition-shadow hover:shadow-md"
        >
          <span className="block text-sm font-medium truncate">{item.name}</span>
          <span className="text-xs text-gray-500">{item.category}</span>
        </div>
      ))}
    </div>
  )
}
```

### Example 3: Design Token Plugin

```typescript
// tailwind.config.ts
import plugin from 'tailwindcss/plugin'

const designTokenPlugin = plugin(({ addBase, theme }) => {
  addBase({
    ':root': {
      '--color-primary': theme('colors.blue.600'),
      '--color-surface': theme('colors.white'),
      '--color-text': theme('colors.gray.900'),
      '--shadow-card': theme('boxShadow.DEFAULT'),
    },
  })
})

const config: Config = {
  plugins: [designTokenPlugin],
}
export default config
```

---

## Key Takeaways
- Utility-first eliminates naming collisions and reduces CSS bundle size
- cn() helper (clsx + twMerge) handles conditional classes and conflict resolution
- Accept className prop on all components for consumer customization
- CSS variables in tailwind.config bridge design tokens to utility classes
- Tailwind has zero runtime cost, making it fully compatible with React 19 Compiler

## Common Misconception

"**Utility classes make HTML messy and unmaintainable.**"

Extraction into components with className prop patterns keeps consumers clean. The component is the abstraction; utilities are the implementation detail.

## Feynman Explain

Tailwind gives you Lego bricks (utility classes) instead of pre-built houses (Bootstrap components). You build components by composing bricks, then reuse those components across your app. The cn() helper prevents brick conflicts. className prop lets consumers customize without breaking internal structure.

## Reframe

CSS maintenance cost grows quadratically with team size. Tailwind eliminates the mental overhead of naming things, cascade debugging, and specificity wars. Every class name is a single-purpose constraint that composes predictably.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 22-tailwind-css`

## Quiz: 22-tailwind-css


### What problem does the twMerge function in the cn() helper solve?

- [ ] A: It merges Tailwind config files

- [✓] B: It resolves conflicting Tailwind utility classes, keeping the last one

- [ ] C: It combines separate CSS files into one bundle

- [ ] D: It converts inline styles to Tailwind classes


**Answer:** B

twMerge resolves specificity conflicts between Tailwind utilities (e.g., px-4 vs px-6), keeping the last defined class.


### Why is Tailwind fully compatible with React 19 Compiler?

- [ ] A: Tailwind includes a React 19 plugin

- [✓] B: Tailwind generates static class names at build time with zero runtime CSS-in-JS

- [ ] C: React 19 Compiler only works with Tailwind

- [ ] D: Tailwind uses runtime style injection for compatibility


**Answer:** B

React 19 Compiler memoizes components automatically. Tailwind's static class names need no runtime style computation, so no migration effort is needed.


### What is the correct pattern for making a Button component accept custom styles from consumers?

- [ ] A: Accept a style object prop

- [✓] B: Accept a className prop merged with cn()

- [ ] C: Use CSS variables for all visual properties

- [ ] D: Extend Tailwind config per consumer


**Answer:** B

Accepting className and merging with cn() allows consumers to override or extend styles while preserving internal component styles.


### How do you configure Tailwind to support class-based dark mode toggling?

- [ ] A: Set darkMode: 'media' in tailwind.config

- [✓] B: Set darkMode: 'class' in tailwind.config

- [ ] C: Use the @dark directive in CSS

- [ ] D: Import a dark mode plugin


**Answer:** B

darkMode: 'class' enables toggling dark mode by adding/removing the 'dark' class on the HTML element. 'media' follows system preference.


### What is the advantage of mapping design tokens via CSS variables in tailwind.config?

- [✓] A: CSS variables allow runtime theme switching without recompilation

- [ ] B: CSS variables are faster than Tailwind utility classes

- [ ] C: Tailwind only supports CSS variable tokens

- [ ] D: CSS variables eliminate the need for Tailwind config


**Answer:** A

CSS variables can be toggled at runtime for theme switching. Tailing config references them, so utility classes automatically reflect the current theme.


### Which Radix UI state attribute does Tailwind use for styling open/closed transitions?

- [ ] A: aria-expanded

- [✓] B: data-state

- [ ] C: data-open

- [ ] D: role


**Answer:** B

Radix UI components expose data-state attribute (e.g., data-[state=open], data-[state=closed]) for styling via Tailwind's data-* variant.


### What is the difference between Tailwind utility-first approach and CSS-in-JS?

- [✓] A: Tailwind generates CSS at build time; CSS-in-JS generates styles at runtime or build time via JavaScript

- [ ] B: They are the same approach with different syntax

- [ ] C: CSS-in-JS is faster than Tailwind

- [ ] D: Tailwind only works with React


**Answer:** A

Tailwind uses PostCSS to generate CSS at build time. CSS-in-JS libraries may generate styles at runtime or use compile-time extraction.


### Which responsive breakpoint pattern creates a 4-column grid on desktop and 2-column on tablet?

- [ ] A: grid-cols-4 sm:grid-cols-2

- [✓] B: grid-cols-2 lg:grid-cols-4

- [ ] C: grid-cols-4 md:grid-cols-2

- [ ] D: grid-cols-2 md:grid-cols-4


**Answer:** B

In Tailwind mobile-first breakpoints, lg: overrides the default (mobile) grid. grid-cols-2 default becomes lg:grid-cols-4 on large screens.


### How should you handle repeated utility patterns that appear many times across components?

- [ ] A: Keep inline utilities for consistency

- [✓] B: Extract into a reusable component with className prop

- [ ] C: Add a custom utility class via @apply

- [ ] D: Use inline styles for the repeated patterns


**Answer:** B

Reusable components encapsulate utility patterns. className prop allows consumer customization while reducing duplication.


### What does the clsx function in the cn() helper do?

- [ ] A: Merges Tailwind classes resolving conflicts

- [✓] B: Conditionally joins class names together

- [ ] C: Converts CSS modules to Tailwind

- [ ] D: Generates responsive variants


**Answer:** B

clsx handles conditional class name joining (e.g., clsx('base', condition && 'extra')) returning a single string.


---

# Module 23: Type-Safe APIs — tRPC

Est. study time: 2h
Language: en

## Learning Objectives
- Understand tRPC architecture (server router -> client caller)
- Leverage TypeScript inference end-to-end
- Integrate with React Query via tRPC wrappers
- Implement server context (auth) and middleware (rate limit, logging)
- Format and handle errors on both server and client
- Use tRPC with React 19 Server Components (server caller pattern)
- Build mutations compatible with useActionState
---

## Core Content

### tRPC Architecture

tRPC provides end-to-end type safety without code generation:

```typescript
// server/router.ts
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()

export const appRouter = t.router({
  // Query — data fetching
  getUser: t.procedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      const user = await db.user.findUnique({ where: { id: input } })
      return user
    }),

  // Mutation — data modification
  createUser: t.procedure
    .input(z.object({
      name: z.string().min(2),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      return db.user.create({ data: input })
    }),
})

export type AppRouter = typeof appRouter
```

Client consumes with full type inference:

```typescript
// client/api.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../server/router'

export const trpc = createTRPCReact<AppRouter>()
```

### TypeScript Inference End-to-End

No code generation needed. TypeScript infers types from server router:

```typescript
// The return type of getUser is automatically inferred
const { data: user } = trpc.getUser.useQuery('some-uuid')
// user: { id: string, name: string, email: string } | undefined

// Input validation is type-checked at compile time
const mutation = trpc.createUser.useMutation()
mutation.mutate({ name: 'Alice', email: 'alice@example.com' })
// Error: missing 'email' field
// Error: wrong type for 'name'
```

Zod schemas on server define both runtime validation and TypeScript types:

```typescript
const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
})

type UserInput = z.infer<typeof UserSchema>
// { name: string; email: string; role: 'admin' | 'user' }
```

### React Query Integration

tRPC wraps TanStack React Query:

```typescript
// _app.tsx — provider setup
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { trpc } from '../utils/api'
import { useState } from 'react'

export function App({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: '/api/trpc' })],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

Usage with query key management and caching:

```typescript
function UserProfile({ userId }: { userId: string }) {
  const utils = trpc.useUtils()

  const { data: user, isLoading } = trpc.getUser.useQuery(userId, {
    staleTime: 30_000, // Cache for 30s
  })

  const updateUser = trpc.updateUser.useMutation({
    onSuccess: () => {
      // Invalidate cache to refetch
      utils.getUser.invalidate(userId)
      // Or invalidate all queries
      utils.invalidate()
    },
  })

  if (isLoading) return <Spinner />
  return <ProfileView user={user} onUpdate={updateUser.mutate} />
}
```

### Server Context and Middleware

Context injects request-scoped data:

```typescript
// server/context.ts
import type { CreateNextContextOptions } from '@trpc/server/adapters/next'
import { getServerSession } from 'next-auth'

export async function createContext({ req, res }: CreateNextContextOptions) {
  const session = await getServerSession(req, res)

  return {
    session,
    user: session?.user ?? null,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
```

Middleware pattern:

```typescript
import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'

const t = initTRPC.context<Context>().create()

// Auth middleware
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

// Rate limit middleware
const rateLimit = t.middleware(async ({ ctx, next, path }) => {
  const key = `ratelimit:${ctx.user?.id ?? 'anon'}:${path}`
  const count = await redis.incr(key)
  if (count > 100) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS' })
  }
  return next()
})

// Logging middleware
const logger = t.middleware(async ({ path, type, next, input }) => {
  const start = Date.now()
  const result = await next()
  const duration = Date.now() - start
  console.log(`[${type}] ${path} — ${duration}ms`)
  return result
})

// Composed procedures
const protectedProcedure = t.procedure.use(logger).use(isAuthenticated).use(rateLimit)
```

Usage:

```typescript
export const appRouter = t.router({
  getDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      return db.dashboard.findMany({ where: { userId: ctx.user.id } })
    }),
})
```

### Error Formatting

Default error serialization:

```typescript
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Expose validation errors client-side
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})
```

Client-side error handling:

```typescript
const mutation = trpc.createUser.useMutation({
  onError: (error) => {
    if (error.data?.zodError) {
      const fieldErrors = error.data.zodError.fieldErrors
      // { name: ['Name is too short'], email: ['Invalid email'] }
      setErrors(fieldErrors)
    }
    if (error.data?.code === 'UNAUTHORIZED') {
      redirectToLogin()
    }
  },
})
```

### React 19 Server Components + tRPC

Server-side caller pattern for Server Components:

```typescript
// server/caller.ts
import { createCallerFactory } from '@trpc/server'
import { appRouter, AppRouter } from './router'

// Singleton caller factory
const createCaller = createCallerFactory(appRouter)

// Async Server Component usage
async function UserProfilePage({ userId }: { userId: string }) {
  // Server-side call with full type safety
  const caller = createCaller({ session: null, user: null })
  const user = await caller.getUser(userId)
  // Typed response without HTTP round-trip

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

### Mutations with useActionState (React 19)

```typescript
'use client'
import { useActionState } from 'react'
import { trpc } from '../utils/api'

function CreateUserForm() {
  const utils = trpc.useUtils()
  const mutation = trpc.createUser.useMutation()

  const [state, formAction, isPending] = useActionState(
    async (prevState: { error?: string }, formData: FormData) => {
      try {
        await mutation.mutateAsync({
          name: formData.get('name') as string,
          email: formData.get('email') as string,
        })
        await utils.getUsers.invalidate()
        return { error: undefined }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
    { error: undefined }
  )

  return (
    <form action={formAction}>
      <input name="name" required minLength={2} />
      <input name="email" type="email" required />
      <button disabled={isPending} type="submit">
        {isPending ? 'Creating...' : 'Create User'}
      </button>
      {state.error && <p className="text-red-500">{state.error}</p>}
    </form>
  )
}
```

---

### Why This Matters

tRPC eliminates the most common source of bugs in full-stack apps: mismatched API contracts. Shared types between server and client mean refactoring a database field propagates type errors everywhere it's used, catching issues at compile time.

---

### Common Questions

**Q: How does tRPC compare to GraphQL?**

A: tRPC is simpler — no schema definition language, no resolvers, no code generation. Both provide type safety. tRPC is RPC-style; GraphQL is query-language-style. tRPC excels for server-rendered apps; GraphQL suits client-driven data requirements.

**Q: Can tRPC handle file uploads?**

A: Yes. Use form data with tRPC's `httpBatchLink` or handle uploads separately outside tRPC, then pass the URL as procedure input.

---

## Examples

### Example 1: Complete Router with Middleware

```typescript
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.context<Context>().create()

const auth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})

const protectedProcedure = t.procedure.use(auth)

export const appRouter = t.router({
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    return db.project.findMany({ where: { ownerId: ctx.user.id } })
  }),

  createProject: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.project.create({
        data: { ...input, ownerId: ctx.user.id },
      })
    }),

  deleteProject: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      const project = await db.project.findUnique({ where: { id: input } })
      if (!project || project.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      return db.project.delete({ where: { id: input } })
    }),
})
```

### Example 2: React Wrapper Hooks with Query Integration

```typescript
// hooks/useProjects.ts
import { trpc } from '../utils/api'

export function useProjects() {
  const utils = trpc.useUtils()

  const { data: projects, isLoading } = trpc.listProjects.useQuery(undefined, {
    staleTime: 60_000,
  })

  const createProject = trpc.createProject.useMutation({
    onSuccess: () => {
      utils.listProjects.invalidate()
    },
  })

  const deleteProject = trpc.deleteProject.useMutation({
    onSuccess: (deletedId) => {
      utils.listProjects.setData(undefined, (old) =>
        old?.filter(p => p.id !== deletedId)
      )
    },
  })

  return { projects, isLoading, createProject, deleteProject }
}
```

### Example 3: Server-Side Caller in Next.js App Router

```typescript
// app/dashboard/page.tsx
import { createCaller } from '@/server/caller'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const caller = createCaller({
    session: await getServerSession(),
    user: null,
  })

  const [projects, stats] = await Promise.all([
    caller.listProjects(),
    caller.getDashboardStats(),
  ])

  return <DashboardClient projects={projects} stats={stats} />
}
```

---

## Key Takeaways
- tRPC provides end-to-end type safety without code generation
- Zod schemas define both validation and TypeScript types
- Middleware pattern enables auth, rate limiting, and logging
- React 19 Server Components use server caller pattern directly
- useActionState composes with tRPC mutations for progressive enhancement

## Common Misconception

"**tRPC only works with Next.js and React.**"

tRPC is framework-agnostic. Server adapters exist for Express, Fastify, AWS Lambda, Next.js. Client adapters exist for React, Vue, Svelte, and vanilla TypeScript.

## Feynman Explain

tRPC makes your API types flow from database to UI automatically. Define a function on server that takes typed input and returns typed output. Client calls that function as if it were local. TypeScript ensures types match — no manual API docs, no TypeScript duplication, no runtime surprises.

## Reframe

Every type mismatch between frontend and backend is a bug that type checking could have caught. tRPC closes that gap entirely. The cost: you commit to TypeScript on both sides. The benefit: API contract violations become compile errors instead of runtime crashes.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 23-trpc`

## Quiz: 23-trpc


### What does tRPC use to define both runtime validation and TypeScript types?

- [ ] A: TypeScript interfaces

- [✓] B: Zod schemas

- [ ] C: GraphQL SDL

- [ ] D: Joi schemas


**Answer:** B

Zod schemas define runtime validation rules and TypeScript infers static types from them via z.infer().


### How does tRPC provide end-to-end type safety without code generation?

- [ ] A: It generates TypeScript types at build time

- [✓] B: TypeScript infers types from the server router definition shared with the client

- [ ] C: It uses GraphQL introspection

- [ ] D: It requires manual type definitions on both sides


**Answer:** B

The AppRouter type is exported from the server. The client imports it as a generic parameter, and TypeScript infers all input/output types.


### Which tRPC pattern should you use for calling procedures from React 19 Server Components without an HTTP round-trip?

- [ ] A: tRPC React Query hooks

- [✓] B: Server caller pattern with createCaller

- [ ] C: HTTP batch link direct invocation

- [ ] D: WebSocket subscription


**Answer:** B

createCaller creates a server-side caller that invokes procedures directly in-process, bypassing HTTP. Used in Server Components.


### What is the purpose of tRPC middleware?

- [ ] A: Transform response data before sending

- [✓] B: Inject cross-cutting concerns like auth, logging, and rate limiting

- [ ] C: Define database queries

- [ ] D: Configure HTTP headers


**Answer:** B

Middleware intercepts procedure execution for cross-cutting logic. Multiple middleware compose in order, sharing context via next({ ctx: ... }).


### How do you invalidate cached queries after a mutation in tRPC?

- [ ] A: Clear the QueryClient entirely

- [✓] B: Call utils.procedureName.invalidate() with the relevant input

- [ ] C: Restart the React component

- [ ] D: Set staleTime to 0


**Answer:** B

tRPC provides useUtils() returning helpers per procedure. Invalidate refetches the query with matching input keys.


### What does the Zod z.infer<typeof Schema> utility do?

- [ ] A: Validates input at runtime

- [✓] B: Extracts the TypeScript type from a Zod schema definition

- [ ] C: Creates a new schema instance

- [ ] D: Converts Zod types to TypeScript interfaces


**Answer:** B

z.infer extracts the static TypeScript type that a Zod schema validates against, enabling single-source-of-truth typing.


### Which React 19 hook is recommended for composing with tRPC mutations in progressive enhancement patterns?

- [ ] A: useReducer

- [✓] B: useActionState

- [ ] C: useDeferredValue

- [ ] D: useSyncExternalStore


**Answer:** B

useActionState handles form submission state and progressive enhancement. It pairs with tRPC mutateAsync for server mutations.


### What error code does tRPC use for unauthenticated requests?

- [ ] A: BAD_REQUEST

- [ ] B: FORBIDDEN

- [✓] C: UNAUTHORIZED

- [ ] D: NOT_FOUND


**Answer:** C

tRPC maps TRPCError codes to HTTP status codes. UNAUTHORIZED maps to 401. FORBIDDEN (403) is for insufficient permissions despite authentication.


### How does tRPC integrate with TanStack React Query under the hood?

- [ ] A: tRPC replaces React Query entirely

- [✓] B: tRPC wraps React Query hooks, providing typed query/mutation hooks

- [ ] C: React Query wraps tRPC procedures

- [ ] D: They operate independently with no integration


**Answer:** B

tRPC React Query adapter (createTRPCReact) generates typed hooks that internally use React Query's useQuery and useMutation.


### What happens when a tRPC middleware throws a TRPCError?

- [ ] A: The error is silently ignored

- [✓] B: The error propagates to the client with the configured error formatter

- [ ] C: The server crashes

- [ ] D: The procedure retries automatically


**Answer:** B

TRPCError propagates through the middleware chain to the client. The errorFormatter can add context like Zod validation errors.


---

# Module 24: Image Optimization — next/image & Sharp

Est. study time: 1.5h
Language: en

## Learning Objectives
- Configure next/image component for responsive images
- Use Sharp for server-side transforms (resize, format, quality)
- Generate blurDataUrl for placeholder effects
- Implement responsive srcSet for different viewports
- Apply native lazy loading with loading="lazy"
- Use React 19 Server Components for static image metadata
- Understand CDN delivery patterns
---

## Core Content

### next/image Component

Next.js Image component provides automatic optimization:

```tsx
import Image from 'next/image'

export function Hero() {
  return (
    <Image
      src="/hero-desktop.webp"
      alt="Hero banner"
      width={1920}
      height={1080}
      priority
      className="rounded-lg"
    />
  )
}
```

Key props:

- `priority` — preloads image (above-the-fold only). Adds `<link rel="preload">`
- `loading` — `lazy` (default) or `eager`. Native browser lazy loading
- `sizes` — responsive sizes hint: `(max-width: 768px) 100vw, 50vw`
- `quality` — 1-100, default 75
- `placeholder` — `blur` or `empty`. blur requires `blurDataURL`
- `fill` — fills parent container. Requires parent `position: relative` and dimensions

### Responsive Images with next/image

```tsx
function ResponsiveGallery({ images }: { images: ImageData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {images.map(img => (
        <div key={img.id} className="relative aspect-video">
          <Image
            src={img.url}
            alt={img.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover rounded-lg"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  )
}
```

### Sharp for Server-Side Transforms

Sharp is a high-performance Node.js image processing library:

```typescript
// lib/image-processing.ts
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

interface TransformOptions {
  width?: number
  height?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
  quality?: number
}

export async function transformImage(
  inputPath: string,
  outputPath: string,
  options: TransformOptions
) {
  const { width, height, format = 'webp', quality = 80 } = options

  let pipeline = sharp(inputPath)

  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: true,
    })
  }

  switch (format) {
    case 'avif':
      pipeline = pipeline.avif({ quality })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality })
      break
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality })
      break
    case 'png':
      pipeline = pipeline.png({ quality })
      break
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await pipeline.toFile(outputPath)
}
```

Batch processing:

```typescript
// scripts/optimize-images.ts
import { glob } from 'glob'
import { transformImage } from '../lib/image-processing'

async function optimizeAll() {
  const images = await glob('public/images/raw/**/*.{jpg,png}')

  const sizes = [320, 640, 768, 1024, 1920]

  for (const img of images) {
    const name = path.parse(img).name

    await Promise.all(
      sizes.map(size =>
        transformImage(img, `public/images/optimized/${name}-${size}w.webp`, {
          width: size,
          format: 'webp',
          quality: 80,
        })
      )
    )

    // Generate AVIF for modern browsers
    await transformImage(img, `public/images/optimized/${name}.avif`, {
      format: 'avif',
      quality: 70,
    })
  }
}

optimizeAll().catch(console.error)
```

### blurDataURL Generation

Blur placeholder improves perceived performance:

```typescript
// lib/blur-placeholder.ts
import sharp from 'sharp'

export async function generateBlurDataUrl(inputPath: string): Promise<string> {
  const buffer = await sharp(inputPath)
    .resize(8, 8, { fit: 'cover' })
    .webp({ quality: 20 })
    .toBuffer()

  return `data:image/webp;base64,${buffer.toString('base64')}`
}

// Usage with next/image
export async function getImageProps(src: string) {
  const blurDataURL = await generateBlurDataUrl(src)
  return { src, placeholder: 'blur' as const, blurDataURL }
}
```

### Responsive srcSet Pattern

Manual srcSet for custom Image wrapper:

```typescript
interface SrcSetConfig {
  src: string
  sizes: number[]
  format?: 'webp' | 'avif'
}

function generateSrcSet({ src, sizes, format = 'webp' }: SrcSetConfig): string {
  return sizes
    .map(size => {
      const ext = path.extname(src)
      const base = src.replace(ext, '')
      return `${base}-${size}w.${format} ${size}w`
    })
    .join(', ')
}

// srcSet output:
// "/images/photo-320w.webp 320w, /images/photo-640w.webp 640w, /images/photo-1024w.webp 1024w"
```

### Lazy Loading with Native Loading

```tsx
function LazyImage({ src, alt, className }: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('transition-opacity duration-300', className)}
    />
  )
}
```

`loading="lazy"` defers loading until image approaches viewport. `decoding="async"` reduces main thread impact.

### React 19 Server Components for Static Image Metadata

```tsx
// app/gallery/page.tsx (Server Component)
import { readFile } from 'fs/promises'
import { GalleryClient } from './GalleryClient'

interface ImageMeta {
  src: string
  width: number
  height: number
  blurDataURL: string
  alt: string
}

async function getImageMetadata(imageDir: string): Promise<ImageMeta[]> {
  const images = await glob(`${imageDir}/*.{webp,avif,jpg}`)
  const metadata: ImageMeta[] = []

  for (const img of images) {
    const { width, height } = await sharp(img).metadata()
    const blurDataURL = await generateBlurDataUrl(img)
    metadata.push({
      src: img.replace('public', ''),
      width: width!,
      height: height!,
      blurDataURL,
      alt: path.parse(img).name,
    })
  }

  return metadata
}

export default async function GalleryPage() {
  const images = await getImageMetadata('public/images/gallery')

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Gallery</h1>
      <GalleryClient images={images} />
    </div>
  )
}
```

### CDN Delivery Patterns

Configure remote patterns in next.config:

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        port: '',
        pathname: '/images/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}

export default nextConfig
```

CDN URLs still go through next/image optimization:

```tsx
<Image
  src="https://cdn.example.com/images/photo.jpg"
  alt="CDN image"
  width={800}
  height={600}
  priority
/>
```

---

### Why This Matters

Images account for ~50% of web page weight. Poor image optimization is the single biggest performance bottleneck. next/image + Sharp combination gives automatic optimization, responsive sizing, and modern formats without manual effort.

---

### Common Questions

**Q: Should I use next/image or a custom img tag?**

A: Use next/image for most cases — automatic optimization, lazy loading, responsive srcSet, and blur placeholders. Use custom img tag only for fully static content or when next/image's optimization overhead isn't needed.

**Q: What's the difference between WebP and AVIF?**

A: AVIF offers ~20% smaller file sizes at same quality but lower browser support (~92% vs ~97% for WebP). next/image serves AVIF with WebP fallback via the `<picture>` element.

---

## Examples

### Example 1: Custom Image Wrapper with BlurHash

```tsx
'use client'
import Image from 'next/image'
import { useState } from 'react'
import { cn } from '../lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  blurDataURL: string
  width: number
  height: number
  className?: string
  priority?: boolean
}

export function OptimizedImage({
  src,
  alt,
  blurDataURL,
  width,
  height,
  className,
  priority = false,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        placeholder="blur"
        blurDataURL={blurDataURL}
        priority={priority}
        className={cn(
          'transition-opacity duration-500',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  )
}
```

### Example 2: Sharp Pipeline for Batch Processing

```typescript
// scripts/build-images.ts
import sharp from 'sharp'
import { glob } from 'glob'
import { basename, dirname, join, parse } from 'path'
import { mkdir, readFile } from 'fs/promises'

const CONFIG = {
  sizes: [320, 640, 1024, 1920],
  formats: [
    { name: 'webp' as const, quality: 80 },
    { name: 'avif' as const, quality: 65 },
  ],
  inputDir: 'public/images/raw',
  outputDir: 'public/images/optimized',
}

async function processImage(inputPath: string) {
  const { name } = parse(inputPath)
  const image = sharp(await readFile(inputPath))
  const metadata = await image.metadata()

  const tasks = CONFIG.formats.flatMap(({ name: format, quality }) =>
    CONFIG.sizes.map(async (width) => {
      const outDir = join(CONFIG.outputDir, `${width}w`)
      await mkdir(outDir, { recursive: true })

      await sharp(inputPath)
        .resize(width, undefined, { withoutEnlargement: true })
        [format]({ quality })
        .toFile(join(outDir, `${name}.${format}`))
    })
  )

  return Promise.all(tasks)
}

async function main() {
  const files = await glob(`${CONFIG.inputDir}/**/*.{jpg,jpeg,png}`)
  await Promise.all(files.map(processImage))
  console.log(`Processed ${files.length} images`)
}

main().catch(console.error)
```

### Example 3: BlurHash Generation Server Action

```typescript
'use server'
import sharp from 'sharp'

export async function generateBlurHash(formData: FormData) {
  const file = formData.get('image') as File
  const buffer = Buffer.from(await file.arrayBuffer())

  const { width, height } = await sharp(buffer).metadata()

  const blurBuffer = await sharp(buffer)
    .resize(16, 16, { fit: 'cover' })
    .webp({ quality: 30 })
    .toBuffer()

  return {
    width,
    height,
    blurDataURL: `data:image/webp;base64,${blurBuffer.toString('base64')}`,
  }
}
```

---

## Key Takeaways
- next/image provides automatic optimization, lazy loading, and responsive srcSet
- Sharp handles server-side transforms (resize, format conversion, quality)
- blurDataURL improves perceived performance with instant placeholders
- React 19 Server Components extract image metadata at request time
- CDN + next/image combine for optimal delivery

## Common Misconception

"**next/image always makes images faster.**"

next/image adds overhead for the optimization server (especially in development). For fully static content, pre-optimize with Sharp at build time and serve directly. Use next/image when you need dynamic optimization or don't control the source images.

## Feynman Explain

Images are the heaviest resources on most pages. next/image shrinks them automatically — resize to screen size, convert to modern formats, lazy-load below the fold, show blurry preview while loading. Sharp does the heavy lifting on the server. Together they make images fast without manual optimization per image.

## Reframe

Image optimization isn't about reducing quality — it's about delivering the right pixels at the right time. No one needs a 4000px image on a 375px phone screen. next/image + Sharp automate the decision of what, when, and how to deliver.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 24-image-optimization`

## Quiz: 24-image-optimization


### What does the priority prop on next/image do?

- [ ] A: Sets the image as highest quality

- [✓] B: Preloads the image with a <link rel=preload> tag

- [ ] C: Prioritizes the image in the CDN queue

- [ ] D: Increases the loading timeout


**Answer:** B

priority adds a preload link in the document head, telling the browser to start loading the image immediately rather than waiting for discovery.


### Which Sharp pipeline step converts an image to WebP with quality control?

- [✓] A: sharp(input).webp({ quality: 80 })

- [ ] B: sharp(input).toFormat('webp', { quality: 80 })

- [ ] C: sharp(input).convert('webp', 80)

- [ ] D: sharp(input).encode('webp', { quality: 80 })


**Answer:** A

Sharp provides format-specific methods (.webp(), .avif(), .jpeg()) accepting an options object with quality and other format-specific settings.


### What is the purpose of blurDataURL in next/image?

- [ ] A: Blur the image on hover

- [✓] B: Show a blurry placeholder while the full image loads, improving perceived performance

- [ ] C: Reduce image quality for bandwidth savings

- [ ] D: Apply CSS blur filter automatically


**Answer:** B

blurDataURL is a tiny base64-encoded image shown as placeholder. placeholder='blur' must be set alongside blurDataURL for this effect.


### How should you use React 19 Server Components with image metadata?

- [✓] A: Process image metadata in the Server Component and pass as props to the client component

- [ ] B: Fetch metadata client-side with useEffect

- [ ] C: Define metadata in a static JSON file

- [ ] D: Use onLoad callback to capture metadata


**Answer:** A

Server Components can read file system, process images with Sharp, and pass metadata (dimensions, blurDataURL) to client components as props.


### Which sizes attribute value serves full-viewport images on mobile and half-viewport on desktop?

- [ ] A: (max-width: 768px) 50vw, 100vw

- [✓] B: (max-width: 768px) 100vw, 50vw

- [ ] C: 100vw

- [ ] D: 50vw


**Answer:** B

The sizes attribute tells the browser what width the image will display at each breakpoint. Mobile gets 100vw, desktop gets 50vw.


### What does the 'withoutEnlargement: true' option in Sharp's resize do?

- [ ] A: Crops the image instead of resizing

- [✓] B: Prevents upscaling images smaller than the target dimensions

- [ ] C: Enlarges images to fill the target size

- [ ] D: Removes EXIF data during resize


**Answer:** B

withoutEnlargement ensures small images aren't scaled up (which would degrade quality). The image stays at its original dimensions if smaller than target.


### What is the difference between WebP and AVIF formats?

- [ ] A: WebP is smaller than AVIF at equal quality

- [✓] B: AVIF offers ~20% better compression but lower browser support than WebP

- [ ] C: WebP supports transparency, AVIF does not

- [ ] D: AVIF is only supported in Chrome


**Answer:** B

AVIF (AV1 Image File Format) provides better compression ratios than WebP but has lower browser support (~92% vs ~97%).


### What happens when you set fill on next/image without a parent with position: relative?

- [ ] A: The image fills the viewport

- [ ] B: The image collapses to zero dimensions

- [✓] C: next/image throws a runtime error

- [ ] D: The image uses intrinsic dimensions instead


**Answer:** C

fill requires a parent with position: relative (or absolute/fixed) and defined dimensions. Without it, the image has no container to fill.


### Which native attribute defers image loading until near the viewport?

- [ ] A: decoding='async'

- [✓] B: loading='lazy'

- [ ] C: fetchpriority='low'

- [ ] D: importance='low'


**Answer:** B

loading='lazy' defers loading until the image approaches the viewport (browser-defined distance). decoding='async' is complementary but unrelated to loading timing.


### Why configure remotePatterns in next.config for image optimization?

- [✓] A: It enables next/image to optimize images from external CDNs

- [ ] B: It speeds up image download from external sources

- [ ] C: It caches external images locally

- [ ] D: It allows external images but disables optimization


**Answer:** A

remotePatterns tells next/image which external hosts are safe to optimize. Optimized images are served through Next.js's optimization endpoint.


---

# Module 25: PDF Rendering — @react-pdf/renderer

Est. study time: 1.5h
Language: en

## Learning Objectives
- Use @react-pdf Document/Page/View/Text components
- Build PDF layouts with Flexbox
- Register and use custom fonts
- Embed images in PDF documents
- Generate dynamic PDF content
- Implement PDF download in browser
- Stream large PDFs for performance
- Use React 19 Suspense for async PDF generation
- Apply useTransition for export button to prevent UI freeze
---

## Core Content

### Document/Page/View/Text Components

@react-pdf/renderer provides React components that compile to PDF:

```tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 8,
  },
})

export function SimpleDocument() {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.heading}>Invoice</Text>
          <Text style={styles.paragraph}>
            This is a sample PDF document generated with React components.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
```

Components: `Document` (root), `Page` (one per page), `View` (layout container, like div), `Text` (text content), `Image`, `Link`, `Note`, `Svg`.

### Layout with Flexbox

@react-pdf supports Flexbox for layout:

```tsx
const styles = StyleSheet.create({
  page: { padding: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    borderBottom: '1px solid #ccc',
    paddingBottom: 16,
  },
  invoiceTable: {
    flexDirection: 'column',
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #eee',
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  cell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
  },
  cellAmount: {
    width: 100,
    textAlign: 'right',
    padding: 8,
    fontSize: 10,
  },
})

function InvoiceTable({ items }: { items: LineItem[] }) {
  return (
    <View style={styles.invoiceTable}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={styles.cell}>Description</Text>
        <Text style={styles.cell}>Qty</Text>
        <Text style={styles.cell}>Rate</Text>
        <Text style={styles.cellAmount}>Amount</Text>
      </View>
      {items.map((item, i) => (
        <View style={styles.tableRow} key={i}>
          <Text style={styles.cell}>{item.description}</Text>
          <Text style={styles.cell}>{item.quantity}</Text>
          <Text style={styles.cell}>${item.rate.toFixed(2)}</Text>
          <Text style={styles.cellAmount}>${item.amount.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  )
}
```

### Register Custom Fonts

```tsx
import { Font } from '@react-pdf/renderer'

Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Inter-Bold.ttf', fontWeight: 700 },
    { src: '/fonts/Inter-Italic.ttf', fontStyle: 'italic' },
  ],
})

Font.register({
  family: 'NotoSansSC',
  src: '/fonts/NotoSansSC-Regular.otf',
  // For CJK character support
})
```

Usage:

```tsx
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
  },
  heading: {
    fontFamily: 'Inter',
    fontWeight: 700,
  },
})
```

### Images in PDF

```tsx
import { Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  logo: {
    width: 120,
    height: 40,
    marginBottom: 16,
  },
  photo: {
    width: '100%',
    height: 200,
    objectFit: 'cover',
  },
})

function InvoiceHeader() {
  return (
    <View>
      <Image style={styles.logo} src="/logo.png" />
      <Image style={styles.photo} src={{ uri: '/header-bg.jpg', method: 'GET' }} />
    </View>
  )
}
```

Images can be local files, remote URLs, or base64 data URIs.

### Dynamic Content Generation

```tsx
function InvoiceDocument({ invoice }: { invoice: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{invoice.company.name}</Text>
            <Text>{invoice.company.address}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE #{invoice.number}</Text>
            <Text>Date: {invoice.date}</Text>
            <Text>Due: {invoice.dueDate}</Text>
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.sectionTitle}>Bill To:</Text>
          <Text>{invoice.client.name}</Text>
          <Text>{invoice.client.email}</Text>
        </View>

        <InvoiceTable items={invoice.items} />

        <View style={styles.totals}>
          <Text>Subtotal: ${invoice.subtotal.toFixed(2)}</Text>
          <Text>Tax: ${invoice.tax.toFixed(2)}</Text>
          <Text style={styles.total}>Total: ${invoice.total.toFixed(2)}</Text>
        </View>

        <Text style={styles.footer}>
          Payment due within 30 days. Thank you for your business.
        </Text>
      </Page>
    </Document>
  )
}
```

### PDF Download in Browser

```tsx
'use client'
import { pdf } from '@react-pdf/renderer'
import { InvoiceDocument } from './InvoiceDocument'
import { useState, useTransition } from 'react'

function DownloadInvoiceButton({ invoice }: { invoice: InvoiceData }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDownload = () => {
    startTransition(async () => {
      try {
        setError(null)
        const blob = await pdf(<InvoiceDocument invoice={invoice} />).toBlob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${invoice.number}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        setError('Failed to generate PDF')
      }
    })
  }

  return (
    <div>
      <button onClick={handleDownload} disabled={isPending}>
        {isPending ? 'Generating PDF...' : 'Download Invoice'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  )
}
```

### Streaming Large PDFs

For large documents, use `toBuffer()` for server-side streaming:

```tsx
// app/api/invoice/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { pdf } from '@react-pdf/renderer'
import { InvoiceDocument } from '@/components/pdf/InvoiceDocument'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoice = await getInvoice(params.id)

  const pdfStream = await pdf(<InvoiceDocument invoice={invoice} />).toBuffer()

  return new NextResponse(pdfStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
      'Content-Length': pdfStream.length.toString(),
    },
  })
}
```

### React 19 Suspense for Async PDF Generation

```tsx
import { Suspense } from 'react'
import { PDFViewer } from '@react-pdf/renderer'

async function InvoicePDFContent({ invoiceId }: { invoiceId: string }) {
  const invoice = await fetchInvoiceData(invoiceId)

  return (
    <PDFViewer width="100%" height={600}>
      <InvoiceDocument invoice={invoice} />
    </PDFViewer>
  )
}

export default function InvoicePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="animate-pulse h-[600px] bg-gray-100 rounded" />}>
      <InvoicePDFContent invoiceId={params.id} />
    </Suspense>
  )
}
```

---

### Why This Matters

PDF generation is a common requirement (invoices, reports, certificates). @react-pdf/renderer brings React component model to PDF authoring, making layouts declarative and reusable. Combined with React 19's async rendering capabilities, PDF generation integrates naturally into the React data flow.

---

### Common Questions

**Q: Can @react-pdf/renderer render HTML?**

A: No. Use View/Text components for layout. For HTML-to-PDF conversion, consider puppeteer or a dedicated HTML-to-PDF service.

**Q: How do I handle page breaks for long content?**

A: Use `wrap={false}` on View/Text to prevent breaking across pages. Set `break` prop on View to force page breaks. For auto page break, wrap content in a layout that splits dynamically.

---

## Examples

### Example 1: Invoice PDF Component

```tsx
import { Document, Page, View, Text, StyleSheet, Font, Image } from '@react-pdf/renderer'

Font.register({
  family: 'Inter',
  src: '/fonts/Inter-Regular.ttf',
  fontWeight: 400,
})

Font.register({
  family: 'Inter',
  src: '/fonts/Inter-Bold.ttf',
  fontWeight: 700,
})

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#1a1a1a',
  },
  logo: {
    width: 100,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#2563eb',
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #f1f5f9',
    paddingVertical: 8,
  },
  colDescription: { flex: 3, paddingHorizontal: 8 },
  colQty: { flex: 1, paddingHorizontal: 8, textAlign: 'center' },
  colRate: { flex: 1, paddingHorizontal: 8, textAlign: 'right' },
  colAmount: { flex: 1, paddingHorizontal: 8, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    paddingTop: 16,
    borderTop: '2px solid #e2e8f0',
  },
  totalText: {
    fontSize: 16,
    fontWeight: 700,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 48,
    right: 48,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 8,
  },
})

interface InvoiceData {
  number: string
  date: string
  dueDate: string
  company: { name: string; address: string }
  client: { name: string; email: string }
  items: Array<{ description: string; quantity: number; rate: number; amount: number }>
  subtotal: number
  tax: number
  total: number
}

export function InvoicePDF({ invoice }: { invoice: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image style={styles.logo} src="/logo.png" />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{invoice.company.name}</Text>
            <Text>{invoice.company.address}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.label}>Number</Text>
            <Text>{invoice.number}</Text>
            <Text style={styles.label}>Date</Text>
            <Text>{invoice.date}</Text>
            <Text style={styles.label}>Due Date</Text>
            <Text>{invoice.dueDate}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 32 }}>
          <Text style={styles.label}>Bill To</Text>
          <Text>{invoice.client.name}</Text>
          <Text>{invoice.client.email}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colDescription}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>

        {invoice.items.map((item, i) => (
          <View style={styles.tableRow} key={i}>
            <Text style={styles.colDescription}>{item.description}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colRate}>${item.rate.toFixed(2)}</Text>
            <Text style={styles.colAmount}>${item.amount.toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalText}>Total: ${invoice.total.toFixed(2)}</Text>
        </View>

        <Text style={styles.footer}>
          Payment due within 30 days. Thank you for your business.
        </Text>
      </Page>
    </Document>
  )
}
```

### Example 2: Export Hook with Loading State

```typescript
// hooks/useExportPDF.ts
import { useState, useTransition } from 'react'
import { pdf } from '@react-pdf/renderer'

interface UseExportPDFOptions {
  fileName?: string
}

export function useExportPDF(options: UseExportPDFOptions = {}) {
  const { fileName = 'document.pdf' } = options
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<Error | null>(null)

  const exportPDF = async (document: React.ReactElement) => {
    startTransition(async () => {
      try {
        setError(null)
        const blob = await pdf(document).toBlob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('PDF export failed'))
      }
    })
  }

  return { exportPDF, isPending, error }
}
```

Usage:

```tsx
function InvoiceActions({ invoice }: { invoice: InvoiceData }) {
  const { exportPDF, isPending } = useExportPDF({
    fileName: `invoice-${invoice.number}.pdf`,
  })

  return (
    <button
      onClick={() => exportPDF(<InvoicePDF invoice={invoice} />)}
      disabled={isPending}
    >
      {isPending ? 'Generating...' : 'Export PDF'}
    </button>
  )
}
```

### Example 3: Suspense for Async PDF Viewer

```tsx
import { Suspense } from 'react'
import { PDFViewer } from '@react-pdf/renderer'
import { InvoicePDF } from './InvoicePDF'

async function InvoiceViewer({ invoiceId }: { invoiceId: string }) {
  const response = await fetch(`/api/invoices/${invoiceId}`)
  const invoice: InvoiceData = await response.json()

  return (
    <PDFViewer style={{ width: '100%', height: '80vh' }}>
      <InvoicePDF invoice={invoice} />
    </PDFViewer>
  )
}

export function InvoicePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="h-[80vh] bg-gray-100 animate-pulse rounded-lg" />}>
      <InvoiceViewer invoiceId={params.id} />
    </Suspense>
  )
}
```

---

## Key Takeaways
- @react-pdf/renderer uses React components for PDF layout
- Flexbox-based layout system mirrors web development
- Custom fonts registered via Font.register before use
- Dynamic content generation from component props
- useTransition prevents UI freeze during PDF generation
- MongoDB-style streaming for large PDFs via toBuffer

## Common Misconception

"**@react-pdf/renderer can render any HTML component.**"

@react-pdf/renderer provides its own set of components (Document, Page, View, Text, Image). HTML elements like div, span, h1 are not supported. Use View+Text as div+span equivalents.

## Feynman Explain

@react-pdf/renderer lets you write PDF documents like React components. Instead of HTML, you use Document/Page/View/Text. Instead of CSS, you use StyleSheet.create. Layout is Flexbox. Everything else is standard React — props, composition, hooks.

## Reframe

PDF generation is typically imperative and error-prone. @react-pdf/renderer makes it declarative. The same mental model you use for web UIs applies to PDFs. Dynamic content, conditional rendering, and data-driven layouts work the same way.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 25-pdf-rendering`

## Quiz: 25-pdf-rendering


### Which component serves as the root container in @react-pdf/renderer?

- [ ] A: Root

- [✓] B: Document

- [ ] C: PDF

- [ ] D: Container


**Answer:** B

Document is the root component that wraps one or more Page components. It receives global style and metadata props.


### What layout system does @react-pdf/renderer use for positioning elements?

- [ ] A: CSS Grid

- [✓] B: Flexbox

- [ ] C: Absolute positioning only

- [ ] D: Table layout


**Answer:** B

@react-pdf/renderer uses Flexbox for layout. Properties like flexDirection, justifyContent, alignItems, and flex work similarly to CSS Flexbox.


### How do you add custom fonts to a @react-pdf document?

- [ ] A: Import font file directly in the component

- [✓] B: Call Font.register with family name and source paths

- [ ] C: Add font to a global CSS file

- [ ] D: Use @font-face in a style tag


**Answer:** B

Font.register registers fonts before rendering. It accepts a family name and array of font variants (weight, style, src).


### Which method converts a @react-pdf document to a downloadable Blob?

- [✓] A: pdf(document).toBlob()

- [ ] B: document.renderToBlob()

- [ ] C: PDFGenerator.blob(document)

- [ ] D: convertToPdf(document).blob()


**Answer:** A

pdf(document).toBlob() asynchronously renders the document and returns a Blob object suitable for download or URL creation.


### Why should useTransition be used for PDF generation button clicks?

- [ ] A: It speeds up PDF rendering

- [✓] B: It prevents UI freezes by marking PDF generation as a non-urgent state update

- [ ] C: It adds animation to the download process

- [ ] D: It automatically retries failed PDF generation


**Answer:** B

useTransition marks the state update as non-urgent, allowing the browser to remain responsive during the PDF generation process.


### Which component is used to embed an image in a @react-pdf document?

- [ ] A: Img

- [✓] B: Image

- [ ] C: Photo

- [ ] D: Picture


**Answer:** B

The Image component accepts src (local path, remote URL, or base64 data URI), width, height, and objectFit props.


### What is the equivalent of a div element in @react-pdf/renderer?

- [ ] A: Box

- [✓] B: View

- [ ] C: Container

- [ ] D: Section


**Answer:** B

View is the generic layout container, equivalent to a div in HTML. Use it for grouping elements and applying layout styles.


### How should you handle large PDF documents in @react-pdf/renderer?

- [ ] A: Generate the entire PDF in memory and download

- [✓] B: Use toBuffer() for server-side streaming with appropriate Content-Length headers

- [ ] C: Split the document into multiple smaller PDFs

- [ ] D: Use client-side rendering only


**Answer:** B

For large PDFs, use toBuffer() on the server and stream the response with Content-Length header for efficient delivery.


### How does React 19 Suspense integrate with @react-pdf document generation?

- [ ] A: Suspense wraps PDF generation automatically

- [✓] B: Use Suspense to show fallback UI while async data for PDF content is loading

- [ ] C: @react-pdf does not support Suspense

- [ ] D: Suspense replaces pdf().toBlob() for async generation


**Answer:** B

Suspense wraps async data fetching for PDF content. The PDF component tree renders once data resolves, showing a fallback during loading.


### What happens if you use HTML elements like div or span inside a @react-pdf component?

- [ ] A: They render with basic styling

- [✓] B: They cause a runtime error or produce empty output

- [ ] C: They are converted to View and Text components

- [ ] D: They render correctly in all cases


**Answer:** B

@react-pdf/renderer only understands its own components (Document, Page, View, Text, Image). HTML elements are not supported and cause errors or blank output.


---

# Module 26: Markdown Rendering — react-markdown

Est. study time: 1.5h
Language: en

## Learning Objectives
- Understand react-markdown architecture (unified pipeline)
- Use remark plugins (remark-gfm, remark-frontmatter)
- Use rehype plugins (rehype-highlight, rehype-raw)
- Build custom renderers (code block with copy button, link handler)
- Create custom remark plugin (extract headings for TOC)
- Apply security practices (rehype-sanitize, allowedElements)
- Use React 19 Server Components for server-side markdown
- Implement Suspense boundaries for async markdown loading

---

## Core Content

### react-markdown Architecture

react-markdown uses unified ecosystem: markdown string → mdast (remark) → hast (rehype) → React elements.

```
Input String
  │
  ▼
remarkParse ────────────────────── parse to mdast
  │
  ▼
remarkPlugins (remark-gfm, custom) ─ transform mdast
  │
  ▼
remarkRehype ───────────────────── convert mdast → hast
  │
  ▼
rehypePlugins (rehype-highlight, custom) ─ transform hast
  │
  ▼
React Components ───────────────── render hast to JSX
```

```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeSanitize]}
    >
      {content}
    </ReactMarkdown>
  )
}
```

No dangerouslySetInnerHTML — unified pipeline produces safe React elements.

### Supported Markdown Features via remark-gfm

GFM (GitHub Flavored Markdown) adds:

| Feature | Example | Without remark-gfm |
|---------|---------|-------------------|
| Tables | `\| A \| B \|` | No table support |
| Strikethrough | `~~text~~` | Not rendered |
| Task lists | `- [x] done` | Rendered as checkbox? No |
| URL autolinks | `https://example.com` | No auto-link |
| Footnotes | `[^1]` | Not supported |

```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const markdown = `
| Feature | Status |
|---------|--------|
| Tables  | ✅     |
| Lists   | ✅     |

- [x] Completed task
- [ ] Pending task

This is ~~strikethrough~~ text.
`

function GfmDemo() {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
}
```

### Custom Renderers

Override default element rendering with `components` prop:

```typescript
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  className?: string
  children?: React.ReactNode
}

function CodeBlock({ className, children }: CodeBlockProps) {
  const match = /language-(\w+)/.exec(className ?? '')
  const code = String(children).replace(/\n$/, '')
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={copyToClipboard}
        style={{ position: 'absolute', right: 8, top: 8 }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <SyntaxHighlighter
        style={oneDark}
        language={match?.[1] ?? 'text'}
        customStyle={{ margin: 0 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

function MarkdownWithCodeBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        },
        pre({ children }) {
          return <CodeBlock>{children}</CodeBlock>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
```

Custom link renderer with external link indicator:

```typescript
function ExternalLink({
  href,
  children,
}: {
  href?: string
  children?: React.ReactNode
}) {
  const isExternal = href?.startsWith('http')
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
    >
      {children}
      {isExternal && <ExternalLinkIcon />}
    </a>
  )
}

<ReactMarkdown
  components={{
    a: ExternalLink,
  }}
>
  {markdownContent}
</ReactMarkdown>
```

### Custom Remark Plugin: Extract Headings as TOC

```typescript
import { visit } from 'unist-util-visit'
import type { Heading } from 'mdast'

interface TocEntry {
  id: string
  text: string
  depth: number
}

function remarkExtractHeadings() {
  const headings: TocEntry[] = []

  function transformer(tree: any) {
    visit(tree, 'heading', (node: Heading) => {
      const text = node.children
        .filter((child: any) => child.type === 'text')
        .map((child: any) => child.value)
        .join('')

      const id = text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')

      headings.push({ id, text, depth: node.depth })
    })
  }

  transformer.headings = headings
  return transformer
}

function MarkdownWithToc({ content }: { content: string }) {
  const plugin = remarkExtractHeadings()

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <nav style={{ width: 200, flexShrink: 0 }}>
        <h4>Table of Contents</h4>
        <ul>
          {plugin.headings
            .filter((h) => h.depth <= 3)
            .map((h) => (
              <li
                key={h.id}
                style={{ paddingLeft: (h.depth - 1) * 12 }}
              >
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
        </ul>
      </nav>
      <article style={{ flex: 1 }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, plugin]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h2: ({ children, ...props }) => {
              const id = String(children)
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '')
              return <h2 id={id} {...props}>{children}</h2>
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  )
}
```

### rehype-raw for HTML in Markdown

```typescript
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

<ReactMarkdown
  rehypePlugins={[rehypeRaw, rehypeSanitize]}
>
  {`
## Embed Video

<video controls width="100%">
  <source src="/intro.mp4" type="video/mp4" />
</video>

## Custom HTML

<div class="callout">
  <strong>Note:</strong> This is raw HTML embedded.
</div>
  `}
</ReactMarkdown>
```

rehype-raw parses embedded HTML tags into hast. Must use with rehype-sanitize to prevent XSS.

### Security with rehype-sanitize

```typescript
import rehypeSanitize from 'rehype-sanitize'

// Default: strips all HTML except safe elements (a, b, i, em, strong, code, pre, etc.)
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
  {userContent}
</ReactMarkdown>

// Custom allowlist
const schema = {
  ...rehypeSanitize.defaultSchema,
  attributes: {
    ...rehypeSanitize.defaultSchema?.attributes,
    code: ['className'],
    span: ['className', 'style'],
    div: ['className', 'data-*'],
  },
}

<ReactMarkdown rehypePlugins={[[rehypeSanitize, schema]]}>
  {userContent}
</ReactMarkdown>
```

Never render user-supplied markdown without rehype-sanitize. XSS vectors exist via `[xss](javascript:alert(1))` and raw HTML.

### React 19 Server Components for Markdown

```typescript
// MarkdownRenderer.server.tsx — Server Component
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Server-only: no client-side JS for rendering
async function MarkdownRenderer({ filePath }: { filePath: string }) {
  const fs = await import('fs/promises')
  const content = await fs.readFile(filePath, 'utf-8')

  return (
    <article>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </article>
  )
}

// Parent — Suspense for async file read
function LessonPage({ filePath }: { filePath: string }) {
  return (
    <Suspense fallback={<MarkdownSkeleton />}>
      <MarkdownRenderer filePath={filePath} />
    </Suspense>
  )
}
```

Server Components eliminate bundle cost of react-markdown (~8KB gzipped). Content rendered on server, sent as HTML.

### Suspense for Async Markdown Loading

```typescript
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Suspense, use } from 'react'

async function fetchMarkdown(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load markdown: ${res.status}`)
  return res.text()
}

function MarkdownContent({ markdownPromise }: { markdownPromise: Promise<string> }) {
  const content = use(markdownPromise)

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  )
}

function AsyncMarkdownPage({ url }: { url: string }) {
  const markdownPromise = fetchMarkdown(url)

  return (
    <Suspense fallback={<div>Loading content...</div>}>
      <MarkdownContent markdownPromise={markdownPromise} />
    </Suspense>
  )
}
```

React 19 `use()` hook consumes promise inside component, triggered by Suspense boundary. Eliminates manual loading state.

> **Think**: What happens to Copy button in code blocks when markdown renders in Server Component?
>
> *Answer: Copy button needs client interactivity. Use `'use client'` wrapper around only the code block component. Server Component handles markdown parsing, client component hydrates interactive parts. Pattern: server renders static content, client islands for interactivity.*

---

### Why This Matters

Markdown rendering appears in documentation sites, blog platforms, CMS editors, AI chat outputs, and help pages. Without structured rendering, apps fall back to dangerouslySetInnerHTML — XSS vulnerabilities. react-markdown provides safe, extensible pipeline with plugin ecosystem.

---

### Common Questions

**Q: react-markdown vs marked vs showdown?**
A: react-markdown uses unified pipeline (no dangerouslySetInnerHTML). Marked and showdown produce HTML strings — require dangerouslySetInnerHTML in React. react-markdown is safer and more extensible.

**Q: How to render math (LaTeX) in markdown?**
A: Use `remark-math` + `rehype-katex`. Adds $inline$ and $$block$$ math support with KaTeX rendering.

---

## Examples

### Example 1: Full Documentation Viewer with TOC, Code Highlighting, and Copy

```typescript
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { visit } from 'unist-util-visit'

interface DocPageProps {
  content: string
}

function createTocPlugin() {
  const headings: Array<{ id: string; text: string; depth: number }> = []
  const transformer = (tree: any) => {
    visit(tree, 'heading', (node: any) => {
      const text = node.children
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.value)
        .join('')
      const id = text.toLowerCase().replace(/\s+/g, '-')
      headings.push({ id, text, depth: node.depth })
    })
  }
  transformer.headings = headings
  return transformer
}

function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function DocPage({ content }: DocPageProps) {
  const tocPlugin = createTocPlugin()
  const [codeBlocks, setCodeBlocks] = useState<Record<string, string>>({})

  return (
    <div className="doc-layout">
      <nav className="toc">
        <h3>Contents</h3>
        <ul>
          {tocPlugin.headings
            .filter((h) => h.depth <= 3)
            .map((h) => (
              <li key={h.id} style={{ paddingLeft: (h.depth - 1) * 12 }}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
        </ul>
      </nav>
      <article className="doc-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, tocPlugin]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h2: ({ children, ...props }) => {
              const id = String(children).toLowerCase().replace(/\s+/g, '-')
              return <h2 id={id} {...props}>{children}</h2>
            },
            h3: ({ children, ...props }) => {
              const id = String(children).toLowerCase().replace(/\s+/g, '-')
              return <h3 id={id} {...props}>{children}</h3>
            },
            pre: ({ children }) => {
              const codeEl = children as any
              const code = codeEl?.props?.children ?? ''
              return (
                <div className="code-block-wrapper">
                  <CodeCopyButton code={String(code)} />
                  <pre>{children}</pre>
                </div>
              )
            },
            a: ({ href, children }) => {
              const isExternal = href?.startsWith('http')
              return (
                <a
                  href={href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                >
                  {children}
                </a>
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  )
}
```

### Example 2: Custom Remark Plugin — Image Gallery from Directory

```typescript
import { visit } from 'unist-util-visit'

function remarkImageGallery(options: { directory: string }) {
  return function transformer(tree: any) {
    visit(tree, 'paragraph', (node: any, index: number, parent: any) => {
      const hasGalleryMarker = node.children?.some(
        (child: any) =>
          child.type === 'text' && child.value.trim() === '%%gallery%%'
      )

      if (hasGalleryMarker) {
        parent.children[index] = {
          type: 'paragraph',
          data: {
            hName: 'ImageGallery',
            hProperties: { directory: options.directory },
          },
          children: [],
        }
      }
    })
  }
}

// Usage in markdown:
// %%gallery%%

// Custom component maps the hName to React component:
;<ReactMarkdown
  remarkPlugins={[remarkGfm, [remarkImageGallery, { directory: '/images/screenshots' }]]}
  components={{
    ImageGallery: ({ directory }: { directory: string }) => {
      const [images, setImages] = useState<string[]>([])
      useEffect(() => {
        fetch(`/api/images?dir=${directory}`)
          .then((r) => r.json())
          .then(setImages)
      }, [directory])

      return (
        <div className="gallery">
          {images.map((src) => (
            <img key={src} src={src} alt="" loading="lazy" />
          ))}
        </div>
      )
    },
  }}
>
  {markdownContent}
</ReactMarkdown>
```

---

## Key Takeaways
- react-markdown uses unified pipeline: markdown → mdast → hast → React elements
- remark plugins transform mdast (GFM tables, frontmatter, TOC extraction)
- rehype plugins transform hast (syntax highlighting, raw HTML, sanitization)
- Custom renderers via `components` prop override any HTML element mapping
- Custom remark plugins use unist-util-visit to traverse and modify AST
- rehype-sanitize prevents XSS — required for user-supplied markdown
- React 19 Server Components render markdown server-side, eliminate bundle cost
- Suspense + `use()` handles async markdown fetching declaratively
- Interactive elements (copy button) need client component islands
- Heading IDs enable anchor links and TOC navigation

## Common Misconception

"**react-markdown re-renders the entire document on every content change.**"

react-markdown only re-parses when content prop changes. For static content, it parses once. For large documents, use `memo` on the renderer component. For live editing, consider splitting document into sections with separate ReactMarkdown instances or using `remark-split` to parse once.

---

## Feynman Explain
(Explain react-markdown to a backend engineer: "react-markdown takes a markdown string, parses it through a pipeline of plugins, and outputs React components directly — no innerHTML. Think of it like a build pipeline: source (markdown) → AST transformations (remark) → format conversion (rehype) → output (JSX). Each plugin stage transforms the AST. Code blocks become SyntaxHighlighter components. Headings get anchor IDs. Tables become styled table elements.")

---

## Reframe
(Pause. Markdown rendering seems solved — libraries exist for every platform. But the unified pipeline architecture is the real lesson. Separating parse → transform → render stages applies to compilers, bundlers, formatters, and data pipelines. Every plugin is a pure AST transformer. When you understand the pipeline pattern, you can build custom pipelines for any structured text format.)

---

## Drill
Take the quiz. MCQs test unified pipeline, remark/rehype plugin roles, custom renderers, custom plugin creation, security, Server Components, Suspense integration, and React 19 patterns.

Run: `learn.sh quiz external-lib-patterns 26-markdown-rendering`

## Quiz: 26-markdown-rendering


### What is the correct unified pipeline order in react-markdown?

- [ ] A: rehype plugins → remark plugins → React elements

- [✓] B: remark plugins → rehype plugins → React elements

- [ ] C: React elements → remark plugins → rehype plugins

- [ ] D: rehype plugins → React elements → remark plugins


**Answer:** B

Pipeline order: remarkParse (mdast) → remarkPlugins (transform mdast) → remarkRehype (mdast→hast) → rehypePlugins (transform hast) → render to React elements.


### What threat does rehype-sanitize protect against in react-markdown?

- [ ] A: Slow rendering performance

- [✓] B: XSS attacks via embedded HTML and javascript: URLs

- [ ] C: Memory leaks from large markdown files

- [ ] D: Unicode normalization issues


**Answer:** B

rehype-sanitize strips dangerous HTML elements and attributes. Prevents XSS vectors like <script> tags, javascript: URLs in links, onerror handlers, and other injection attacks.


### How would you add a Copy button to code blocks rendered by react-markdown?

- [ ] A: Not possible — react-markdown does not support custom UI

- [✓] B: Override the pre component in components prop with a wrapper containing Copy button

- [ ] C: Use CSS ::after pseudo-element

- [ ] D: Inject Copy button via rehype plugin only


**Answer:** B

Override pre element renderer via components prop. Wrap children with div containing Clipboard API button. Rehype plugin approach also works but component override is simpler.


### What does remark-gfm add that base react-markdown does not support?

- [ ] A: Bold and italic text

- [✓] B: Tables, strikethrough, task lists, URL autolinks

- [ ] C: Image embedding

- [ ] D: Ordered and unordered lists


**Answer:** B

GitHub Flavored Markdown adds tables (| col | col |), strikethrough (~~text~~), task lists (- [x]), URL autolinks, and footnotes. Base commonmark does not include these.


### How does React 19 Server Component rendering benefit markdown display?

- [ ] A: Markdown can be edited by server admins at runtime

- [✓] B: react-markdown bundle (~8KB) not sent to client — rendered to HTML on server

- [ ] C: Server Components allow real-time markdown collaboration

- [ ] D: Server Components automatically add syntax highlighting


**Answer:** B

Server Component renders markdown on server, sends HTML. Client never downloads react-markdown or its plugin dependencies. Smaller bundle, faster initial render.


### What unist utility is commonly used to traverse and modify the markdown AST in custom remark plugins?

- [ ] A: unist-walk

- [✓] B: unist-util-visit

- [ ] C: mdast-traverse

- [ ] D: hast-walk


**Answer:** B

unist-util-visit visits nodes matching a type. Pattern: visit(tree, 'heading', (node) => { ... }). Used in custom remark plugins to extract, modify, or annotate AST nodes.


### What happens when rehype-raw is used without rehype-sanitize?

- [ ] A: Nothing — rehype-raw includes sanitization

- [✓] B: Embedded HTML from markdown source renders without restriction — XSS risk

- [ ] C: rehype-raw errors without rehype-sanitize

- [ ] D: Only text content is rendered


**Answer:** B

rehype-raw parses HTML tags embedded in markdown into hast. Without rehype-sanitize, <script>, onerror, and javascript: URLs render. Always pair rehype-raw with rehype-sanitize.


### How does React 19 Suspense integrate with react-markdown for async content loading?

- [ ] A: Wrap ReactMarkdown in Suspense — no additional setup

- [✓] B: Use use() hook with fetch promise inside component, wrapped in Suspense boundary

- [ ] C: ReactMarkdown has built-in async loading prop

- [ ] D: Suspense only works with Server Components


**Answer:** B

Fetch markdown as promise, pass to component using use() hook. Suspense boundary handles loading state. Pattern: const content = use(markdownPromise); return <ReactMarkdown>{content}</ReactMarkdown>.


### Which prop on ReactMarkdown overrides default HTML element rendering?

- [ ] A: elements

- [✓] B: components

- [ ] C: renderers

- [ ] D: overrides


**Answer:** B

components prop maps HTML tag names to custom React components. Example: components={{ pre: CustomPre, a: CustomLink, code: CustomCode }}.


### What is the purpose of remarkRehype in the unified pipeline?

- [ ] A: Parses markdown string into mdast

- [✓] B: Converts mdast (remark AST) to hast (rehype AST)

- [ ] C: Adds syntax highlighting to code blocks

- [ ] D: Sanitizes HTML output


**Answer:** B

remarkRehype bridges remark and rehype ecosystems. Converts mdast (Markdown AST) to hast (HTML AST) so rehype plugins can process the tree before React rendering.


---

# Module 27: Full-Text Search — Algolia InstantSearch

Est. study time: 2h
Language: en

## Learning Objectives
- Understand Algolia architecture (indices, records, searchable attributes)
- Use InstantSearch React hooks (useSearchBox, useHits, useRefinementList, usePagination)
- Build custom widgets from hooks
- Design faceting strategy with filter UI
- Configure highlighting and snippeting
- Implement analytics (clickEvents, conversion tracking)
- Use React 19 useTransition for debounce-free search input
- Apply React Compiler to search result components
- Use Server Components for initial SSR search results

---

## Core Content

### Algolia Architecture

Algolia indexes JSON records. Each record has searchable attributes, facet attributes, and ranking criteria.

```
Application
  └── Index (e.g., "products")
        ├── Record { objectID, name, description, price, category, tags }
        ├── Record { objectID, name, description, price, category, tags }
        └── ...
  └── Index (e.g., "articles")
        └── ...
```

Key concepts:

| Concept | Description |
|---------|-------------|
| Index | Collection of records, like DB table |
| Record | Document with objectID + attributes |
| Searchable attributes | Fields searched for text match |
| Facet attributes | Fields used for filtering/refinement |
| Ranking | Text relevance + custom ranking metrics |
| Highlighting | Matching text wrapped in <mark> tags |

### InstantSearch Setup

```typescript
import algoliasearch from 'algoliasearch/lite'
import { InstantSearch, SearchBox, Hits } from 'react-instantsearch'

const searchClient = algoliasearch(
  'YOUR_APP_ID',
  'YOUR_SEARCH_API_KEY'  // search-only, not admin
)

function SearchPage() {
  return (
    <InstantSearch
      searchClient={searchClient}
      indexName="products"
    >
      <SearchBox />
      <Hits />
    </InstantSearch>
  )
}
```

Uses search-only API key (public). Admin API key never on client.

### Hooks API

InstantSearch React hooks provide granular control:

```typescript
import { useSearchBox, useHits, useRefinementList, usePagination } from 'react-instantsearch'

function CustomSearchBox() {
  const { query, refine, clear } = useSearchBox()

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => refine(e.target.value)}
        placeholder="Search products..."
      />
      {query && <button onClick={clear}>Clear</button>}
    </div>
  )
}

function CustomHits() {
  const { items, sendEvent } = useHits<{
    objectID: string
    name: string
    price: number
    category: string
  }>()

  return (
    <ul>
      {items.map((hit) => (
        <li
          key={hit.objectID}
          onClick={() => sendEvent('click', hit, 'Hit Clicked')}
        >
          <article>
            <h3><HitHighlight attribute="name" hit={hit} /></h3>
            <p><HitHighlight attribute="description" hit={hit} /></p>
            <p>${hit.price} — {hit.category}</p>
          </article>
        </li>
      ))}
    </ul>
  )
}

function CustomRefinementList() {
  const { items, refine } = useRefinementList({ attribute: 'category' })

  return (
    <fieldset>
      <legend>Filter by Category</legend>
      {items.map((item) => (
        <label key={item.value}>
          <input
            type="checkbox"
            checked={item.isRefined}
            onChange={() => refine(item.value)}
          />
          {item.label} ({item.count})
        </label>
      ))}
    </fieldset>
  )
}

function CustomPagination() {
  const { pages, currentRefinement, refine } = usePagination()

  return (
    <nav>
      {pages.map((page) => (
        <button
          key={page}
          onClick={() => refine(page)}
          disabled={page === currentRefinement}
        >
          {page + 1}
        </button>
      ))}
    </nav>
  )
}
```

### Faceting Strategy

```typescript
// InstantSearch config with faceting
function SearchWithFacets() {
  return (
    <InstantSearch
      searchClient={searchClient}
      indexName="products"
    >
      <div className="search-layout">
        <aside className="filters">
          <h3>Filters</h3>
          <section>
            <h4>Category</h4>
            <CustomRefinementList attribute="category" />
          </section>
          <section>
            <h4>Price Range</h4>
            <CustomNumericMenu
              attribute="price"
              items={[
                { label: 'Under $50', start: 0, end: 50 },
                { label: '$50 - $100', start: 50, end: 100 },
                { label: 'Over $100', start: 100 },
              ]}
            />
          </section>
          <section>
            <h4>Rating</h4>
            <CustomRatingMenu attribute="rating" />
          </section>
        </aside>
        <main>
          <CustomSearchBox />
          <CustomHits />
          <CustomPagination />
        </main>
      </div>
    </InstantSearch>
  )
}
```

Facet strategy considerations:

| Strategy | Use Case |
|----------|----------|
| Single select | Category, brand (mutually exclusive) |
| Multi select | Tags, features (and/or logic) |
| Range/Numeric | Price, year, rating |
| Hierarchical | Category tree (Electronics > Phones > iOS) |
| Disjunctive | OR across facets, AND within facet |

### Highlighting and Snippeting

```typescript
import { Highlight, Snippet } from 'react-instantsearch'

function SearchResult({ hit }: { hit: any }) {
  return (
    <div>
      <h3>
        <Highlight attribute="name" hit={hit} />
      </h3>
      <p>
        <Highlight attribute="description" hit={hit} />
      </p>
      <p className="snippet">
        <Snippet attribute="longDescription" hit={hit} />
      </p>
    </div>
  )
}
```

Highlight wraps matching words in `<mark>` tags. Snippet truncates long text with ellipsis around matches. Configure snippet size in Algolia dashboard.

### Analytics: clickEvents and Conversion

```typescript
import { useHit, useSearchBox } from 'react-instantsearch'

function TrackedSearchBox() {
  const { query, refine } = useSearchBox()

  const handleSearch = (value: string) => {
    refine(value)
    // Send search event
    if (window.aa) {
      window.aa('clickedObjectIDsAfterSearch', {
        index: 'products',
        queryID: '',  // from Algolia response
      })
    }
  }

  return (
    <input
      type="search"
      value={query}
      onChange={(e) => handleSearch(e.target.value)}
    />
  )
}
```

```typescript
// Conversion tracking
function PurchaseButton({ hit }: { hit: any }) {
  const { sendEvent } = useHit()

  const handlePurchase = () => {
    sendEvent('conversion', hit, 'Purchased')
    // Process purchase...
  }

  return <button onClick={handlePurchase}>Buy Now</button>
}
```

Algolia analytics tracks: searches, clicks, conversions, popular searches, click-through rate (CTR), zero-result queries.

### Custom Widget from Hooks

```typescript
import { useConnector } from 'react-instantsearch'
import type { Connector } from 'instantsearch.js'

// Custom connector for recent searches
interface RecentSearchesWidgetProps {
  limit?: number
  onSelect: (query: string) => void
}

function RecentSearchesWidget({ limit = 5, onSelect }: RecentSearchesWidgetProps) {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const stored = localStorage.getItem('algolia-recent-searches')
    return stored ? JSON.parse(stored) : []
  })

  const addSearch = (query: string) => {
    setRecentSearches((prev) => {
      const updated = [query, ...prev.filter((q) => q !== query)].slice(0, limit)
      localStorage.setItem('algolia-recent-searches', JSON.stringify(updated))
      return updated
    })
  }

  const clearRecent = () => {
    setRecentSearches([])
    localStorage.removeItem('algolia-recent-searches')
  }

  return (
    <div className="recent-searches">
      <div className="recent-header">
        <span>Recent searches</span>
        <button onClick={clearRecent}>Clear</button>
      </div>
      {recentSearches.length === 0 ? (
        <p className="empty">No recent searches</p>
      ) : (
        <ul>
          {recentSearches.map((query) => (
            <li key={query}>
              <button onClick={() => onSelect(query)}>{query}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Usage
function SearchWithRecent() {
  const { refine } = useSearchBox()

  return (
    <div>
      <CustomSearchBox onSearch={(q) => refine(q)} />
      <RecentSearchesWidget onSelect={(q) => refine(q)} />
      <CustomHits />
    </div>
  )
}
```

### React 19 useTransition for Search Input

```typescript
'use client'

import { useSearchBox } from 'react-instantsearch'
import { useState, useTransition, useDeferredValue } from 'react'

function TransitionSearchBox() {
  const { refine } = useSearchBox()
  const [inputValue, setInputValue] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Mark search refinement as low-priority update
    startTransition(() => {
      refine(value)
    })
  }

  return (
    <div>
      <input
        type="search"
        value={inputValue}
        onChange={handleChange}
        placeholder="Search..."
        style={{
          borderColor: isPending ? 'var(--color-pending)' : undefined,
        }}
      />
      {isPending && <span className="search-pending">Updating...</span>}
    </div>
  )
}
```

useTransition marks search refinement as non-urgent. Input stays responsive while search results update. No debounce needed — React prioritizes input update over result rendering.

```typescript
// Alternative: useDeferredValue
function DeferredSearchBox() {
  const { refine } = useSearchBox()
  const [inputValue, setInputValue] = useState('')
  const deferredQuery = useDeferredValue(inputValue)

  useEffect(() => {
    refine(deferredQuery)
  }, [deferredQuery, refine])

  return (
    <input
      type="search"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
    />
  )
}
```

useDeferredValue holds stale value for rendering while new value loads. Combined with isPending indicator.

> **Think**: useTransition vs useDeferredValue vs debounce — which to use for search?
>
> *Answer: useTransition marks state update as low priority inside event handler. useDeferredValue holds stale value for derived state (good when search value read by multiple components). Debounce adds fixed delay regardless of render speed. useTransition adapts to device speed — no magic number needed.*

### React Compiler with Search Result Components

```typescript
'use client'

import { memo } from 'react'
import { Highlight } from 'react-instantsearch'

// React Compiler (automatic memoization) handles this component
// No manual useMemo/useCallback needed with React 19 + Compiler
function SearchHit({ hit }: { hit: Hit }) {
  return (
    <article className="search-hit">
      <h3><Highlight attribute="name" hit={hit} /></h3>
      <p><Highlight attribute="description" hit={hit} /></p>
      <div className="hit-meta">
        <span className="hit-price">${hit.price}</span>
        <span className="hit-rating">{'★'.repeat(Math.round(hit.rating))}</span>
      </div>
    </article>
  )
}

// Without compiler, use memo for identical hits not re-rendering
const MemoizedSearchHit = memo(SearchHit)

function SearchResults({ items }: { items: Hit[] }) {
  return (
    <ul>
      {items.map((item) => (
        <MemoizedSearchHit key={item.objectID} hit={item} />
      ))}
    </ul>
  )
}
```

React Compiler automatically memoizes components and hooks. For non-compiler projects, manual memo on SearchHit prevents re-render of unchanged hits when query changes.

### Server Components for Initial SSR Results

```typescript
// SearchResults.server.tsx
import algoliasearch from 'algoliasearch'

const searchClient = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_API_KEY!  // server-side only
)

async function ServerSearchResults({ query }: { query: string }) {
  const result = await searchClient.initIndex('products').search(query, {
    hitsPerPage: 20,
    attributesToRetrieve: ['name', 'description', 'price', 'category', 'rating'],
  })

  return (
    <div>
      <p>{result.nbHits} results found</p>
      <ul>
        {result.hits.map((hit: any) => (
          <li key={hit.objectID}>
            <h3>{hit.name}</h3>
            <p>{hit.description}</p>
            <p>${hit.price}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Page component
async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = searchParams.q ?? ''

  return (
    <div>
      <ClientSearchInput defaultValue={query} />
      <Suspense fallback={<SearchSkeleton />}>
        <ServerSearchResults query={query} />
      </Suspense>
    </div>
  )
}
```

Server Components render initial search results on first load. Client components handle subsequent interactive search. Reduces client-side API calls on page load.

---

### Why This Matters

Search is universal in data-driven apps. Without dedicated search infrastructure, apps resort to client-side filter (O(n) scan) or naive SQL LIKE queries. Algolia provides sub-50ms full-text search with typo tolerance, faceting, and analytics. Understanding InstantSearch hooks allows building custom search UIs without full platform lock-in.

---

### Common Questions

**Q: Algolia vs Elasticsearch vs Meilisearch?**
A: Algolia is SaaS, fully managed, fastest (sub-50ms). Elasticsearch is self-hosted, more complex, more configurable. Meilisearch is open-source, simpler than Elasticsearch, good middle ground. For most React apps, Algolia's managed service reduces ops burden.

**Q: How to handle user-specific search results?**
A: Use Secured API Keys (with filters) to scope results per user. Never filter on client side — users can inspect network requests. Generate API key on server: `client.generateSecuredApiKey(searchKey, { filters: 'user_id:123' })`.

---

## Examples

### Example 1: Multi-Facet Filter Sidebar

```typescript
'use client'

import {
  useRefinementList,
  useRange,
  useRatingMenu,
  useClearRefinements,
} from 'react-instantsearch'

function FilterSidebar() {
  return (
    <aside className="filter-sidebar">
      <ClearFilters />
      <CategoryFilter />
      <PriceRangeFilter />
      <RatingFilter />
      <BrandFilter />
    </aside>
  )
}

function ClearFilters() {
  const { refine, canRefine } = useClearRefinements()

  return (
    <button onClick={refine} disabled={!canRefine}>
      Clear all filters
    </button>
  )
}

function CategoryFilter() {
  const { items, refine } = useRefinementList({
    attribute: 'category',
    sortBy: ['count:desc'],
    limit: 10,
    showMore: true,
  })

  return (
    <div className="filter-section">
      <h4>Category</h4>
      <ul>
        {items.map((item) => (
          <li key={item.value} className="filter-item">
            <label>
              <input
                type="checkbox"
                checked={item.isRefined}
                onChange={() => refine(item.value)}
              />
              <span className="filter-label">{item.label}</span>
              <span className="filter-count">({item.count})</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PriceRangeFilter() {
  const { range, refine } = useRange({
    attribute: 'price',
    min: 0,
    max: 500,
  })

  const [min, max] = range
  const [currentMin, currentMax] = range

  return (
    <div className="filter-section">
      <h4>Price Range</h4>
      <div className="range-inputs">
        <input
          type="number"
          value={currentMin}
          onChange={(e) => refine([Number(e.target.value), currentMax])}
          min={min}
          max={max}
        />
        <span>to</span>
        <input
          type="number"
          value={currentMax}
          onChange={(e) => refine([currentMin, Number(e.target.value)])}
          min={min}
          max={max}
        />
      </div>
    </div>
  )
}

function RatingFilter() {
  const { items, refine } = useRatingMenu({ attribute: 'rating' })

  return (
    <div className="filter-section">
      <h4>Minimum Rating</h4>
      <ul>
        {items.map((item) => (
          <li key={item.value} className="filter-item">
            <button
              onClick={() => refine(item.value)}
              className={item.isRefined ? 'active' : ''}
            >
              {'★'.repeat(Number(item.value))} & up ({item.count})
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BrandFilter() {
  const { items, refine } = useRefinementList({
    attribute: 'brand',
    searchable: true,
    searchablePlaceholder: 'Search brands...',
  })

  return (
    <div className="filter-section">
      <h4>Brand</h4>
      <ul>
        {items.map((item) => (
          <li key={item.value} className="filter-item">
            <label>
              <input
                type="checkbox"
                checked={item.isRefined}
                onChange={() => refine(item.value)}
              />
              <span className="filter-label">{item.label}</span>
              <span className="filter-count">({item.count})</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FilterSidebar
```

### Example 2: Custom SearchBox with Recent Searches and Autocomplete

```typescript
'use client'

import { useSearchBox } from 'react-instantsearch'
import { useState, useRef, useEffect, useTransition } from 'react'

interface RecentSearch {
  query: string
  timestamp: number
}

const STORAGE_KEY = 'recent-searches'
const MAX_RECENT = 8

function useRecentSearches() {
  const [recent, setRecent] = useState<RecentSearch[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  })

  const addRecent = (query: string) => {
    if (!query.trim()) return
    setRecent((prev) => {
      const filtered = prev.filter((r) => r.query !== query)
      const updated = [{ query, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const clearRecent = () => {
    setRecent([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return { recent, addRecent, clearRecent }
}

import { useSearchBox } from 'react-instantsearch'

function AutocompleteSearchBox() {
  const { refine, query } = useSearchBox()
  const [inputValue, setInputValue] = useState(query)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { recent, addRecent, clearRecent } = useRecentSearches()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowDropdown(true)
    startTransition(() => {
      refine(value)
    })
  }

  const handleSearch = (value: string) => {
    setInputValue(value)
    addRecent(value)
    setShowDropdown(false)
    startTransition(() => {
      refine(value)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      addRecent(inputValue.trim())
      setShowDropdown(false)
    }
  }

  return (
    <div className="search-box-container">
      <form onSubmit={handleSubmit} role="search">
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="search"
            value={inputValue}
            onChange={handleChange}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search products, categories, brands..."
            aria-label="Search"
            className={isPending ? 'search-pending' : ''}
          />
          {isPending && <span className="search-spinner" aria-label="Searching" />}
        </div>
      </form>

      {showDropdown && (
        <div ref={dropdownRef} className="search-dropdown">
          {inputValue.length < 2 && recent.length > 0 && (
            <section className="recent-searches">
              <div className="dropdown-header">
                <span>Recent searches</span>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="clear-btn"
                >
                  Clear
                </button>
              </div>
              <ul>
                {recent.map((r) => (
                  <li key={r.query}>
                    <button
                      type="button"
                      onClick={() => handleSearch(r.query)}
                      className="recent-item"
                    >
                      {r.query}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {inputValue.trim() && (
            <section className="suggestions">
              <div className="dropdown-header">
                <span>Suggestions</span>
              </div>
              <ul>
                <li>
                  <button
                    type="button"
                    onClick={() => handleSearch(inputValue)}
                    className="suggestion-item"
                  >
                    Search for "{inputValue}"
                  </button>
                </li>
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default AutocompleteSearchBox
```

---

## Key Takeaways
- Algolia indexes JSON records with searchable and facet attributes
- InstantSearch hooks: useSearchBox (query input), useHits (results), useRefinementList (filters), usePagination
- Custom widgets built from hooks for full UI control
- Faceting strategy: multi-select for tags, range for numbers, hierarchical for categories
- Highlight wraps matches in <mark>, Snippet truncates with context
- Analytics: sendEvent for click tracking, conversion events
- React 19 useTransition marks search refinement as low-priority — no debounce needed
- React Compiler auto-memoizes search result components
- Server Components render initial search results server-side
- Secured API Keys scope search results per user

## Common Misconception

"**InstantSearch forces predefined UI components — cannot customize.**"

InstantSearch provides hooks (useSearchBox, useHits, etc.) for completely custom UI. The prebuilt <SearchBox /> and <Hits /> are optional convenience components. Custom widgets built from hooks render any layout, interactivity, and styling.

---

## Feynman Explain
(Explain Algolia to a junior: "Algolia is like Google for your app data. You upload records (JSON objects), define which fields are searchable (like title, description), and users get fast autocomplete-style results. InstantSearch is React bindings — hooks connect your custom UI components to Algolia. Use transition to keep input responsive while search runs. Facets are filters like category or price range. Server Components render first search on page load so user sees results instantly.")

---

## Reframe
(Pause. Search is not just about search boxes. Algolia's faceting teaches a broader lesson: data should be filterable by multiple dimensions simultaneously. The faceting pattern — defining facets, managing OR/AND logic, counting results per facet — applies to e-commerce filters, dashboard data exploration, knowledge base browsing. The mental model of segmented refinement is more valuable than the Algolia-specific API.)

---

## Drill
Take the quiz. MCQs test Algolia architecture, InstantSearch hooks, faceting, highlighting, React 19 useTransition/useDeferredValue, Server Components, custom widgets, analytics, and React Compiler.

Run: `learn.sh quiz external-lib-patterns 27-fulltext-search`

## Quiz: 27-fulltext-search

(quiz parse error: while parsing a block mapping
  in "./subjects/external-lib-patterns/modules/27-fulltext-search/quiz.yaml", line 45, column 3
expected <block end>, but found '<scalar>'
  in "./subjects/external-lib-patterns/modules/27-fulltext-search/quiz.yaml", line 53, column 129)


---

# Module 28: Monorepo — Turborepo

Est. study time: 1.5h
Language: en

## Learning Objectives
- Understand Turborepo architecture (pipeline, cache, remote caching)
- Configure turbo.json with task graph and dependsOn
- Implement caching strategies for build outputs
- Set up remote caching with Vercel
- Integrate with pnpm workspaces
- Create shared TypeScript config packages
- Create shared ESLint and Prettier config packages
- Maintain library version consistency across consumers
- Plan React 19 rollout strategy across monorepo

---

## Core Content

### Turborepo Architecture

Turborepo orchestrates monorepo task execution with caching. Core concepts:

| Concept | Description |
|---------|-------------|
| Pipeline | Defines tasks per package or globally |
| dependsOn | Task ordering: ^build (upstream builds first) |
| Cache | Persistent task output cache (local + remote) |
| Remote caching | Shared cache across CI machines and developers |

```
Project Root
  ├── turbo.json
  ├── package.json (workspaces)
  └── packages/
        ├── config-typescript/
        │     ├── package.json
        │     └── base.json
        ├── config-eslint/
        │     ├── package.json
        │     └── index.js
        ├── ui/
        │     ├── package.json
        │     ├── tsconfig.json
        │     └── src/
        └── app-web/
              ├── package.json
              ├── tsconfig.json
              └── src/
```

### Workspace Configuration

```json
// package.json (root)
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "dev": "turbo run dev --parallel"
  }
}
```

pnpm workspace config:

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

### turbo.json Pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"],
      "inputs": ["src/**", "tsconfig.json"],
      "env": ["NEXT_PUBLIC_API_URL", "DATABASE_URL"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": [],
      "inputs": ["src/**", ".eslintrc.js"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": [],
      "inputs": ["src/**", "*.test.*"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

Key pipeline options:

| Option | Purpose |
|--------|---------|
| dependsOn: ["^build"] | Wait for dependency build before running |
| dependsOn: ["build"] | Wait for own previous build task |
| outputs | Files to cache (glob patterns) |
| inputs | Files that affect cache key |
| env | Environment variables in cache key |
| cache: false | Skip caching (dev servers, watchers) |
| persistent: true | Long-running process (dev server) |

### Cache Strategies

```json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "lint": {
      "outputs": [],
      "inputs": ["src/**", ".eslintrc.js"]
    }
  }
}
```

Cache hit = skip task execution entirely. Cache key computed from: task definition, inputs file hashes, global dependencies, env vars.

Selective outputs caching:

| Strategy | When |
|----------|------|
| Cache everything (dist/**) | Standard builds |
| No cache (outputs: []) | Lint, typecheck (fast anyway) |
| Partial cache | Large outputs, cache specific artifacts |
| No cache + persistent | Dev servers, watchers |

### Remote Caching with Vercel

```bash
# Link project to Vercel remote cache
npx turbo login
npx turbo link

# Or configure in turbo.json
{
  "remoteCache": {
    "signature": true,
    "enabled": true
  }
}
```

Remote cache benefits:
- CI builds skip if output exists from any contributor
- PR checks reuse cached builds from main branch
- Developer machines skip rebuild when pulling branch
- Cache key includes branch — main branch cache shared across all PRs

### Shared TypeScript Config

```json
// packages/config-typescript/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

```json
// packages/config-typescript/nextjs.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "noEmit": true
  }
}
```

```json
// packages/config-typescript/react-library.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

Consumer packages reference config:

```json
// apps/web/tsconfig.json
{
  "extends": "config-typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"]
}
```

### Shared ESLint Config

```typescript
// packages/config-eslint/index.js
module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/no-unescaped-entities': 'off',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
        'newlines-between': 'always',
      },
    ],
  },
}
```

```json
// apps/web/.eslintrc.js
module.exports = {
  root: true,
  extends: ['config-eslint'],
}
```

### Shared Prettier Config

```typescript
// packages/config-prettier/index.js
module.exports = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  plugins: ['prettier-plugin-tailwindcss'],
}
```

```json
// .prettierrc.js (root)
const config = require('config-prettier')
module.exports = config
```

### Version Consistency

```typescript
// packages/ui/package.json
{
  "name": "@myorg/ui",
  "version": "0.1.0",
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

```typescript
// packages/config-eslint/package.json
{
  "name": "config-eslint",
  "version": "0.1.0",
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-react": "^7.34.0"
  },
  "peerDependencies": {
    "eslint": "^8.56.0 || ^9.0.0"
  }
}
```

Consistency strategies:

| Strategy | Implementation |
|----------|----------------|
| Single version policy | Same React/ReactDOM version across all packages |
| Peer dependencies | Library packages declare peer dependency range |
| Sync script | GitHub action to check version alignment |
| Renovate/Dependabot | Auto-update dependencies across all packages |
| overrides/resolutions | Force single version for transitive dependencies |

```json
{
  "pnpm": {
    "overrides": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0"
    }
  }
}
```

### React 19 Rollout Across Monorepo

```json
{
  "pipeline": {
    "build:canary": {
      "dependsOn": ["^build:canary"],
      "outputs": ["dist/**"]
    },
    "test:canary": {
      "dependsOn": ["build:canary"],
      "outputs": []
    }
  }
}
```

Gradual adoption strategy:

```json
// packages/ui-canary/package.json
{
  "name": "@myorg/ui-canary",
  "version": "0.1.0-canary",
  "peerDependencies": {
    "react": "^19.0.0-rc",
    "react-dom": "^19.0.0-rc"
  }
}
```

```typescript
// apps/web-canary/next.config.js
/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    reactCompiler: true,
  },
}
```

Rollout plan:

1. Create canary versions of library packages
2. Canary app workspace tests React 19
3. Shared packages updated to support both React 18 and 19
4. Peer dependencies use range: `"react": "^18.0.0 || ^19.0.0"`
5. Migration verified in CI with both React 18 and 19 build

```typescript
// packages/ui/package.json (dual support)
{
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  }
}
```

> **Think**: Why use peer dependencies for React instead of direct dependencies in library packages?
>
> *Answer: Peer dependencies ensure consumer app controls React version. Direct dependency would install duplicate React versions. With monorepo, single React instance shared across all packages. Peer dependencies enforce version alignment without duplicates.*

### Task Graph Visualization

```
turbo run build

build:packages/ui
  │
  ▼
build:apps/web (depends on ^build — waits for ui build)
  │
  ▼
lint:apps/web (depends on build — sequential)
```

Turborepo parallelizes independent tasks:

```
turbo run build

build:packages/config-typescript    build:packages/config-eslint
        │                                     │
        └─────────────┬───────────────────────┘
                      ▼
              build:packages/ui
                      │
                      ▼
                 build:apps/web
```

### Remote Caching Configuration

```json
{
  "remoteCache": {
    "signature": true,
    "enabled": true
  }
}
```

```bash
# Environment variables for remote cache
TURBO_TOKEN=your_token
TURBO_TEAM=your_team
TURBO_REMOTE_CACHE_SIGNATURE_KEY=your_key

# Or via Vercel
npx turbo link
```

---

### Why This Matters

Monorepos solve code sharing problems: duplicate config files, inconsistent dependency versions, complex cross-package testing. Turborepo adds caching — CI build time drops from minutes to seconds when cache hits. Without monorepo tooling, organizations end up with disconnected repos, copy-pasted configs, and version drift.

---

### Common Questions

**Q: Turborepo vs Nx vs Lerna — which to choose?**
A: Turborepo is simplest setup (one turbo.json), fastest cache (Go binary), best Vercel integration. Nx has more features (affected detection, generators, codegen). Lerna is legacy (npm workspaces + task runner). For new projects: Turborepo.

**Q: Can Turborepo cache Docker builds?**
A: No — Turborepo caches JS/TS build outputs. Docker builds should use Docker layer caching or separate CI caching. Turborepo can build the application that goes into Docker.

---

## Examples

### Example 1: Full turbo.json Pipeline Config

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**", "build/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"],
      "env": ["NODE_ENV", "API_URL", "DATABASE_URL"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": [],
      "inputs": ["src/**", "*.test.*", "*.spec.*"]
    },
    "e2e": {
      "dependsOn": ["build"],
      "outputs": [],
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    },
    "format:check": {
      "outputs": []
    },
    "format:write": {
      "outputs": [],
      "cache": false
    }
  }
}
```

Run commands:

```bash
# Build everything sequentially respecting dependency graph
turbo run build

# Lint and typecheck in parallel
turbo run lint typecheck

# Test and build concurrently
turbo run test build

# Dev servers for all workspaces (no cache, persistent)
turbo run dev --parallel

# Filter to specific package
turbo run build --filter=@myorg/ui

# Show task graph (no execution)
turbo run build --dry-run

# Show execution summary
turbo run build --summarize
```

### Example 2: Shared tsconfig Pattern

```json
// packages/config-typescript/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

```json
// packages/config-typescript/react-library.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

```json
// packages/config-typescript/nextjs.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Consumer pattern:

```json
// apps/web/tsconfig.json
{
  "extends": "config-typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@myorg/ui/*": ["../../packages/ui/src/*"]
    }
  }
}
```

```json
// packages/ui/tsconfig.json
{
  "extends": "config-typescript/react-library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

---

## Key Takeaways
- Turborepo orchestrates monorepo tasks with dependency graph and caching
- turbo.json defines pipeline: dependsOn, outputs, inputs, env
- Cache key includes task definition, input hashes, global deps, env vars
- Remote caching shares cache across CI and developers via Vercel
- pnpm workspaces manages workspace package resolution
- Shared tsconfig packages extend base config per framework
- Shared ESLint/Prettier configs ensure consistent code style
- Version consistency via peer dependencies and overrides
- React 19 rollout: canary packages, dual peer dependency ranges
- Task filtering (--filter) targets specific packages
- --dry-run visualizes dependency graph without execution

## Common Misconception

"**Turborepo only works with Next.js on Vercel.**"

Turborepo works with any framework (React, Vue, Angular, Svelte, Node) and any platform. Vercel integration is optional — use S3-compatible remote cache (turbo-server) or local cache only. Turborepo is framework-agnostic.

---

## Feynman Explain
(Explain Turborepo to a junior: "Turborepo is a task scheduler for monorepos. It knows that app-web depends on ui and config-typescript. When you run build, it builds dependencies first, then the dependent packages. It caches outputs — if nobody changed code since last build, it skips the task and copies from cache. Remote cache stores these artifacts in cloud so your CI and coworkers share cache hits.")

---

## Reframe
(Pause. Monorepo is not about tooling — it is about dependency management at scale. Turborepo solves task orchestration with caching, but the deeper win is shared configuration. When every package uses `config-typescript/nextjs.json`, consistency is enforced at the monorepo level. Config packages become the source of truth for tooling decisions. Platform upgrade (TypeScript 6.0) means updating one package, not 20 repos.)

---

## Drill
Take the quiz. MCQs test turbo.json pipeline, cache configuration, remote caching, shared config packages, workspace configuration, version consistency, React 19 rollout, and task graph.

Run: `learn.sh quiz external-lib-patterns 28-monorepo`

## Quiz: 28-monorepo


### What does dependsOn: ['^build'] mean in turbo.json?

- [ ] A: Run build after all tasks complete

- [✓] B: Wait for upstream dependency builds before running this task

- [ ] C: Build current package, then build dependencies

- [ ] D: Skip cache for build task


**Answer:** B

^ prefix indicates upstream dependencies. '^build' means this package's build waits for its dependencies' build tasks to complete first. Ensures compiled dependencies are available.


### What determines whether Turborepo returns a cache hit or executes a task?

- [ ] A: Only the source file modification timestamps

- [✓] B: Hash of task definition + input file hashes + global dependency hashes + env vars

- [ ] C: Git commit hash

- [ ] D: Package version number


**Answer:** B

Cache key = hash(task definition, input glob hashes, globalDependencies hashes, env vars, lockfile). Any change invalidates cache. Consistent across machines.


### How does shared TypeScript config prevent configuration drift across packages?

- [ ] A: Each package has independent config — no drift possible

- [✓] B: Packages extend a base config from a shared package — changes propagate automatically

- [ ] C: TypeScript CLI flags override per-package config

- [ ] D: Turborepo enforces tsconfig rules


**Answer:** B

Shared config package (e.g., config-typescript/base.json) defines base compiler options. Consumer tsconfig uses extends: 'config-typescript/nextjs.json'. Updating shared config updates all consumers.


### What is the purpose of remote caching in Turborepo?

- [ ] A: Store build artifacts on users local machine

- [✓] B: Share cached build outputs across CI machines and developer machines

- [ ] C: Replace package manager's lockfile

- [ ] D: Cache npm packages for faster installs


**Answer:** B

Remote cache stores build outputs in cloud (Vercel, S3). CI pipeline and developers share cache. PR build skips if main branch already built same inputs.


### What is the correct way for a library package to declare React dependency in a monorepo?

- [ ] A: Direct dependency on react in library's package.json

- [✓] B: Peer dependency with supported version range

- [ ] C: No declaration — React is provided globally

- [ ] D: Dependency on React in turbo.json


**Answer:** B

Peer dependency: 'react': '^18.0.0 || ^19.0.0'. Ensures consumer app controls React version. Monorepo's single React instance shared across all packages. Avoids duplicate React installation.


### What does outputs: [] in a turbo.json pipeline task mean?

- [ ] A: Task outputs are stored in default cache directory

- [✓] B: Task has no cacheable outputs — always executes

- [ ] C: Outputs are deleted after task completes

- [ ] D: Outputs are streamed to stdout


**Answer:** B

Empty outputs array means task produces no cacheable artifacts. Examples: lint, typecheck, test. These tasks always execute because caching them provides no benefit.


### How to run a Turborepo task for only one workspace?

- [ ] A: turbo run build --workspace=@myorg/ui

- [✓] B: turbo run build --filter=@myorg/ui

- [ ] C: cd packages/ui && turbo run build

- [ ] D: turbo run build @myorg/ui


**Answer:** B

--filter flag targets specific workspace. Example: turbo run build --filter=@myorg/ui. Builds only that package and its dependencies. Other workspaces unaffected.


### What is the recommended strategy for adopting React 19 in a monorepo with existing React 18 packages?

- [ ] A: Upgrade all packages at once

- [✓] B: Create canary versions of packages, canary app workspace, dual peer dependency support

- [ ] C: Stay on React 18 until all dependencies support React 19

- [ ] D: Use React 18 and React 19 in same bundle


**Answer:** B

Gradual rollout: canary package variants with React 19, separate canary app workspace, peer dependency range '^18.0.0 || ^19.0.0'. Test in CI with both versions before full migration.


### What file defines Turborepo's task graph, dependencies, caching, and outputs?

- [ ] A: package.json

- [✓] B: turbo.json

- [ ] C: .turborepo.yaml

- [ ] D: workspace.json


**Answer:** B

turbo.json at project root defines pipeline (tasks, dependsOn, outputs, inputs, env), globalDependencies, remoteCache configuration. Schema at https://turbo.build/schema.json.


### What does globalDependencies: ['.env'] in turbo.json achieve?

- [ ] A: Makes .env available to all task processes

- [✓] B: Includes .env hash in cache key — cache invalidates when .env changes

- [ ] C: Copies .env to each workspace during build

- [ ] D: Validates .env file exists before running tasks


**Answer:** B

globalDependencies lists files whose content contributes to cache key for all tasks. .env changes invalidate all caches. Prevents stale builds when environment variables change.


---

# Module 29: E2E Testing — Playwright

Est. study time: 2h
Language: en

## Learning Objectives
- Understand Playwright architecture (browser contexts, pages, fixtures)
- Write component tests with Playwright
- Implement locator strategy (getByRole, getByText over XPath)
- Use assertions (toHaveText, toBeVisible)
- Mock network requests with route interception
- Implement visual regression testing
- Configure CI integration (sharding, retries)
- Test React 19 Server Components from E2E
- Test streaming SSR behavior

---

## Core Content

### Playwright Architecture

Playwright controls real browser engines (Chromium, Firefox, WebKit) via CDP protocol.

```
Test Runner
  └── Browser
        └── BrowserContext (isolated session, cookies, localStorage)
              └── Page (tab)
                    ├── Locator (getByRole, getByText)
                    ├── Assertions (toHaveText, toBeVisible)
                    └── Route (request interception)
```

Key concepts:

| Concept | Description |
|---------|-------------|
| Browser | Chromium/Firefox/WebKit instance |
| BrowserContext | Isolated session with own storage |
| Page | Single tab or window |
| Locator | Element finding strategy |
| Fixture | Reusable test setup (auth state, DB seed) |
| Trace | Recorded execution log for debugging |

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test'

test('user can log in', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Welcome back')).toBeVisible()
  await expect(page).toHaveURL('/dashboard')
})

test.describe('authenticated', () => {
  test.use({ storageState: 'auth/user.json' })

  test('user can view profile', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible()
  })
})
```

### Locator Strategy

```typescript
import { test, expect } from '@playwright/test'

// Prefer accessible locators
test('accessible locator strategy', async ({ page }) => {
  await page.goto('/products')

  // Role-based (best — matches accessible names)
  await page.getByRole('button', { name: 'Add to Cart' }).click()
  await page.getByRole('link', { name: 'View product' }).click()
  await page.getByRole('heading', { name: 'Product Details' }).click()

  // Label-based (form fields)
  await page.getByLabel('Search products').fill('laptop')

  // Text-based (fallback)
  await page.getByText('No results found').waitFor()

  // Placeholder (input hints)
  await page.getByPlaceholder('Enter your email').fill('a@b.com')

  // Test ID (last resort)
  await page.getByTestId('checkout-button').click()
})

// Avoid XPath and CSS selectors tied to DOM structure
// ❌ await page.locator('#root > div > form > button:nth-child(3)')
// ❌ await page.locator('//div[@class="submit-wrapper"]/button')
```

| Locator | Priority | When to Use |
|---------|----------|-------------|
| getByRole | 1st | Interactive elements (buttons, links, headings) |
| getByLabel | 1st | Form inputs with labels |
| getByText | 2nd | Non-interactive text content |
| getByPlaceholder | 2nd | Input placeholders |
| getByTestId | 3rd | Complex components without accessible labels |
| locator(CSS) | Last | Dynamic content, shadow DOM |
| locator(XPath) | Never | XPath is brittle |

### Assertions

```typescript
import { test, expect } from '@playwright/test'

test('assertions', async ({ page }) => {
  await page.goto('/settings')

  // Visibility
  await expect(page.getByRole('heading')).toBeVisible()
  await expect(page.getByText('Loading...')).toBeHidden()

  // Text content
  await expect(page.getByTestId('username')).toHaveText('alice')
  await expect(page.getByTestId('email')).toContainText('example.com')

  // Attribute
  await expect(page.getByRole('button')).toBeEnabled()
  await expect(page.getByRole('button')).not.toBeDisabled()
  await expect(page.getByRole('textbox')).toBeEditable()

  // URL
  await expect(page).toHaveURL('/settings')
  await expect(page).toHaveTitle('Settings - My App')

  // Count
  await expect(page.getByRole('listitem')).toHaveCount(5)

  // CSS
  await expect(page.getByTestId('error')).toHaveCSS('color', 'rgb(255, 0, 0)')
})

// Auto-retrying assertions — no manual waits
// toHaveText, toBeVisible, toBeEnabled retry until timeout
```

### Network Mocking

```typescript
import { test, expect } from '@playwright/test'

test('mock API response', async ({ page }) => {
  // Mock before navigation
  await page.route('**/api/products', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Mock Product', price: 29.99 },
      ]),
    })
  })

  await page.goto('/products')
  await expect(page.getByText('Mock Product')).toBeVisible()
})

test('mock API failure', async ({ page }) => {
  await page.route('**/api/products', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal server error' }),
    })
  })

  await page.goto('/products')
  await expect(page.getByText('Failed to load products')).toBeVisible()
})

test('abort requests', async ({ page }) => {
  // Block analytics scripts
  await page.route('**/analytics/**', async (route) => {
    await route.abort()
  })

  // Block images (speed up tests)
  await page.route('**/*.{png,jpg,jpeg,gif,webp}', async (route) => {
    await route.abort()
  })

  await page.goto('/dashboard')
})

test('modify response', async ({ page }) => {
  await page.route('**/api/user', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.name = 'Modified Name'  // Override field
    await route.fulfill({ response, body: JSON.stringify(body) })
  })

  await page.goto('/profile')
  await expect(page.getByText('Modified Name')).toBeVisible()
})
```

### Visual Regression Testing

```typescript
import { test, expect } from '@playwright/test'

test('homepage visual snapshot', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveScreenshot('homepage.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  })
})

test('component visual regression', async ({ page }) => {
  await page.goto('/components/button')
  const button = page.getByRole('button', { name: 'Submit' })

  // Default state
  await expect(button).toHaveScreenshot('button-default.png')

  // Hover state
  await button.hover()
  await expect(button).toHaveScreenshot('button-hover.png')

  // Focus state
  await button.focus()
  await expect(button).toHaveScreenshot('button-focus.png')

  // Disabled state
  await page.getByRole('button', { name: 'Disabled' }).click()
  await expect(button).toHaveScreenshot('button-disabled.png')
})
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  snapshotDir: './__snapshots__',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
})
```

### Component Testing with Playwright

```typescript
// Button.comp.spec.tsx
import { test, expect } from '@playwright/experimental-ct-react'
import Button from './Button'

test('render with text', async ({ mount }) => {
  const component = await mount(<Button variant="primary">Submit</Button>)
  await expect(component).toContainText('Submit')
})

test('click triggers handler', async ({ mount }) => {
  let clicked = false
  const component = await mount(
    <Button onClick={() => { clicked = true }}>Click me</Button>
  )
  await component.click()
  expect(clicked).toBe(true)
})

test('shows loading state', async ({ mount }) => {
  const component = await mount(<Button loading>Save</Button>)
  await expect(component.getByRole('button')).toBeDisabled()
  await expect(component.getByText('Saving...')).toBeVisible()
})
```

### Custom Fixtures

```typescript
// fixtures.ts
import { test as base, type Page } from '@playwright/test'

interface AuthFixtures {
  authenticatedPage: Page
  adminPage: Page
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: 'auth/user.json',
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },

  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: 'auth/admin.json',
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
```

```typescript
// profile.spec.ts
import { test, expect } from './fixtures'

test('user sees own profile', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/profile')
  await expect(authenticatedPage.getByText('alice@example.com')).toBeVisible()
})

test('admin sees admin panel', async ({ adminPage }) => {
  await adminPage.goto('/admin')
  await expect(adminPage.getByText('Admin Dashboard')).toBeVisible()
})
```

### CI Integration

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npx playwright test
          --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ matrix.shardIndex }}
          path: playwright-report/
          retention-days: 7
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html'],
    ['list'],
    ['github'],  // Annotations in CI
  ],
  use: {
    baseURL: process.env.CI ? 'http://localhost:3000' : 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
```

### React 19: Testing Server Components from E2E

```typescript
import { test, expect } from '@playwright/test'

test('Server Component renders content', async ({ page }) => {
  await page.goto('/product/server-rendered')

  // Content rendered server-side — verify HTML
  const serverContent = page.locator('[data-server-rendered="true"]')
  await expect(serverContent).toBeVisible()
  await expect(serverContent.locator('h1')).toHaveText('Server Product')
})

test('streaming content appears progressively', async ({ page }) => {
  await page.goto('/slow-page')

  // Initial shell renders immediately
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  // Streamed content appears after delay
  await expect(page.getByText('Slow Data Loaded')).toBeVisible({ timeout: 10000 })
})

test('Suspense boundary shows fallback', async ({ page }) => {
  await page.goto('/async-content')

  // Suspense fallback shown initially
  await expect(page.getByText('Loading...')).toBeVisible()

  // Real content replaces fallback
  await expect(page.getByRole('heading', { name: 'Async Content' })).toBeVisible()
})
```

```typescript
// Server Component with data attributes for testing
async function ProductDetail({ id }: { id: string }) {
  const product = await db.product.findUnique({ where: { id } })

  return (
    <div data-server-rendered="true" data-product-id={id}>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </div>
  )
}
```

### Testing Streaming SSR

```typescript
import { test, expect } from '@playwright/test'

test('streaming SSR progressive enhancement', async ({ page }) => {
  // Navigate to page with streaming SSR
  await page.goto('/streaming-page')

  // Verify shell renders immediately
  await expect(page.locator('#shell')).toBeVisible()
  await expect(page.locator('#shell')).toContainText('Header')

  // Wait for streamed content
  await expect(page.locator('#main-content')).toBeVisible()
  await expect(page.locator('#main-content h1')).toHaveText('Main Content')

  // Verify footer (lowest priority chunk) renders
  await expect(page.locator('#footer')).toBeVisible()
})

test('streaming navigation preserves scroll position', async ({ page }) => {
  await page.goto('/long-list')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

  // Trigger navigation that streams
  await page.getByRole('link', { name: 'Next Page' }).click()

  // Scroll position should be maintained
  const scrollY = await page.evaluate(() => window.scrollY)
  expect(scrollY).toBeGreaterThan(0)
})

test('loading UI during streaming', async ({ page }) => {
  await page.goto('/slow-streaming')

  // Verify Suspense fallback
  const loadingFallback = page.getByTestId('loading-skeleton')
  await expect(loadingFallback).toBeVisible()

  // Wait for async component to resolve
  await expect(page.getByTestId('async-data')).toBeVisible({ timeout: 15000 })

  // Fallback should be gone
  await expect(loadingFallback).toBeHidden()
})
```

> **Think**: Why test with data-testid on Server Components instead of text content?
>
> *Answer: Server Components render server-side text in HTML. Text-based assertions work. data-testid is more resilient to text changes and localization. However, prefer accessible locators (getByRole, getByText) for meaningful assertions. Use data-testid only for elements without semantic roles.*

---

### Why This Matters

E2E tests catch integration bugs that unit and integration tests miss: server-side rendering mismatches, API integration failures, navigation issues, visual regressions. Playwright provides cross-browser coverage with fast execution. Without E2E testing, production bugs slip through that no amount of unit tests catch.

---

### Common Questions

**Q: Playwright vs Cypress — which to use?**
A: Playwright supports more browsers (Chromium, Firefox, WebKit), has better network mocking (route interception), component testing, and trace viewer. Cypress has better debugging UI and community plugins. Playwright is faster and more modern.

**Q: How many E2E tests is enough?**
A: Focus on critical user journeys (login, checkout, search). 20-50 well-written E2E tests cover most risk. Avoid testing every component state in E2E — use component tests for granular UI states.

---

## Examples

### Example 1: Page Object Model Pattern

```typescript
// pages/LoginPage.ts
import type { Page, Locator } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly successMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.getByLabel('Email')
    this.passwordInput = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Sign in' })
    this.errorMessage = page.getByTestId('login-error')
    this.successMessage = page.getByText('Welcome back')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async expectSuccess() {
    await expect(this.successMessage).toBeVisible()
    await expect(this.page).toHaveURL('/dashboard')
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toHaveText(message)
  }
}
```

```typescript
// pages/CheckoutPage.ts
import type { Page, Locator } from '@playwright/test'
import { CheckoutInfo } from '../types'

export class CheckoutPage {
  readonly page: Page
  readonly cartItems: Locator
  readonly checkoutButton: Locator
  readonly totalPrice: Locator
  readonly shippingForm: Locator
  readonly placeOrderButton: Locator
  readonly orderConfirmation: Locator

  constructor(page: Page) {
    this.page = page
    this.cartItems = page.getByTestId('cart-item')
    this.checkoutButton = page.getByRole('button', { name: 'Proceed to Checkout' })
    this.totalPrice = page.getByTestId('total-price')
    this.shippingForm = page.getByTestId('shipping-form')
    this.placeOrderButton = page.getByRole('button', { name: 'Place Order' })
    this.orderConfirmation = page.getByTestId('order-confirmation')
  }

  async goto() {
    await this.page.goto('/cart')
  }

  async proceedToCheckout() {
    await this.checkoutButton.click()
  }

  async fillShippingInfo(info: CheckoutInfo) {
    await this.page.getByLabel('Full Name').fill(info.name)
    await this.page.getByLabel('Address').fill(info.address)
    await this.page.getByLabel('City').fill(info.city)
    await this.page.getByLabel('ZIP Code').fill(info.zip)
  }

  async placeOrder() {
    await this.placeOrderButton.click()
  }

  async expectOrderConfirmed() {
    await expect(this.orderConfirmation).toBeVisible()
  }
}
```

```typescript
// checkout.spec.ts
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'
import { CheckoutPage } from './pages/CheckoutPage'

test('complete checkout flow', async ({ page }) => {
  const login = new LoginPage(page)
  const checkout = new CheckoutPage(page)

  await login.goto()
  await login.login('user@example.com', 'password123')

  await checkout.goto()
  await checkout.proceedToCheckout()
  await checkout.fillShippingInfo({
    name: 'Alice',
    address: '123 Main St',
    city: 'Portland',
    zip: '97201',
  })
  await checkout.placeOrder()
  await checkout.expectOrderConfirmed()
})
```

### Example 2: Custom Fixture for Authenticated User

```typescript
// fixtures.ts
import { test as base, expect, type Page } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

interface UserFixtures {
  user: {
    email: string
    name: string
    role: 'user' | 'admin'
  }
  authenticatedPage: Page
}

export const test = base.extend<UserFixtures>({
  user: ['user@example.com', { option: true }],

  authenticatedPage: async ({ browser, user }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const login = new LoginPage(page)

    await login.goto()
    await login.login(user.email, 'password123')
    await login.expectSuccess()

    // Save authenticated state
    await context.storageState({ path: `auth/${user.role}.json` })
    await context.close()

    // Reopen with saved state
    const authContext = await browser.newContext({
      storageState: `auth/${user.role}.json`,
    })
    const authPage = await authContext.newPage()
    await use(authPage)
    await authContext.close()
  },
})

export { expect }
```

```typescript
// admin.spec.ts
import { test, expect } from './fixtures'

test.describe('Admin panel', () => {
  test('shows user management', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/admin/users')
    await expect(
      authenticatedPage.getByRole('heading', { name: 'User Management' })
    ).toBeVisible()
  })

  test('can create new user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/admin/users/new')

    await authenticatedPage.getByLabel('Name').fill('New User')
    await authenticatedPage.getByLabel('Email').fill('new@example.com')
    await authenticatedPage.getByLabel('Role').selectOption('user')
    await authenticatedPage.getByRole('button', { name: 'Create' }).click()

    await expect(
      authenticatedPage.getByText('User created successfully')
    ).toBeVisible()
  })
})
```

---

## Key Takeaways
- Playwright controls real browsers via BrowserContext (isolated session) and Page (tab)
- Prefer accessible locators: getByRole, getByLabel over CSS/XPath
- Assertions auto-retry until timeout — no manual wait/sleep calls
- page.route() intercepts and mocks network requests
- Visual regression: toHaveScreenshot with maxDiffPixelRatio threshold
- Component testing mounts components directly with Playwright
- Custom fixtures provide reusable test setup (auth state)
- CI: sharding splits tests across workers, retries on failure
- React 19: test Server Components via data attributes and content assertions
- Streaming SSR: verify Suspense fallback appears before streamed content
- Page Object Model abstracts page interactions into reusable classes

## Common Misconception

"**E2E tests replace unit tests and integration tests.**"

E2E tests are slow and expensive. Unit tests (milliseconds) catch logic errors. Integration tests (seconds) catch component interaction bugs. E2E tests (minutes) catch real browser scenarios. Pyramid: many unit tests, some integration tests, few E2E tests.

---

## Feynman Explain
(Explain Playwright to a junior: "Playwright is a robot that uses your app like a real person. It opens browser, clicks buttons, types text, checks things appear. Tests are scripts: go to login page, type email and password, click sign in, verify welcome message shows. Assertions are smart — they wait automatically. Network mocking pretends to be server so tests work offline. Visual snapshots compare pixels to catch layout bugs.")

---

## Reframe
(Pause. Playwright teaches a testing philosophy: test user behavior, not implementation. Locators based on accessible roles and labels mirror how real users and assistive technology interact. Testing by role=button catches changes when button refactored from <button> to <div role="button"> — CSS selectors would fail. Accessible locators align testing with accessibility and maintainability.)

---

## Drill
Take the quiz. MCQs test Playwright architecture, locator strategy, assertions, network mocking, visual regression, fixtures, CI, Server Component testing, streaming SSR, and Page Object Model.

Run: `learn.sh quiz external-lib-patterns 29-e2e-playwright`

## Quiz: 29-e2e-playwright


### What is the preferred locator strategy in Playwright?

- [ ] A: CSS selectors for performance

- [ ] B: XPath for complex DOM queries

- [✓] C: Accessible locators (getByRole, getByLabel) — resilient to DOM changes

- [ ] D: data-testid attributes for all elements


**Answer:** C

getByRole and getByLabel match how users and assistive tech interact. Resilient to DOM structure changes. CSS/XPath tied to implementation. Prefer role/label, then text, then test-id.


### What does page.route() intercept in Playwright?

- [ ] A: JavaScript errors

- [✓] B: Network requests — allows mocking, blocking, or modifying responses

- [ ] C: Console messages

- [ ] D: Page navigation events


**Answer:** B

page.route() intercepts HTTP requests matching URL pattern. Supports fulfill (mock response), abort (block), fetch (pass through and modify). Used for offline testing, error states, slow responses.


### How does Playwright handle dynamic content loading without explicit waits?

- [✓] A: Assertions auto-retry until condition met or timeout — no manual wait/sleep

- [ ] B: Use page.waitForTimeout() for all dynamic content

- [ ] C: Playwright does not support dynamic content

- [ ] D: CSS animations must be disabled for assertions to work


**Answer:** A

Playwright assertions (toHaveText, toBeVisible) auto-retry with configurable timeout. No manual sleep/wait. Waits disappear with each retry — test stays as fast as content loads.


### What is the purpose of BrowserContext in Playwright?

- [ ] A: Represents a single browser tab

- [✓] B: Isolated session with own cookies, localStorage, and storageState

- [ ] C: Configuration file for browser launch options

- [ ] D: Test runner instance


**Answer:** B

BrowserContext is isolated browser session. Each context has separate cookies, localStorage, and cache. Enables parallel tests with different auth states. storageState persists context.


### What does toHaveScreenshot() compare against?

- [ ] A: Previous test run screenshot

- [✓] B: Stored baseline screenshot in snapshot directory

- [ ] C: Design mockup image

- [ ] D: DOM structure hash


**Answer:** B

toHaveScreenshot compares current render against stored baseline image in snapshotDir (default __snapshots__/). maxDiffPixelRatio allows small tolerance. Fails if diff exceeds threshold.


### How should React 19 Server Components be identified in E2E tests?

- [ ] A: Server Components cannot be tested in E2E

- [✓] B: Use data attributes (data-server-rendered) or locator text content — HTML present in initial response

- [ ] C: Test only client components wrapping Server Components

- [ ] D: Use React DevTools protocol


**Answer:** B

Server Components render HTML server-side, visible in page source. Use data attributes for resilience or text-based assertions. getByRole/getByText work on server-rendered content.


### What is the Page Object Model pattern in Playwright?

- [ ] A: Pattern where each test file represents one page

- [✓] B: Class that encapsulates page interactions and locators — reusable across tests

- [ ] C: Page is mocked object in test setup

- [ ] D: Page rendered as object in snapshot


**Answer:** B

Page Object Model creates class per page (LoginPage, CheckoutPage). Exposes locators and methods (login(), fillShippingInfo()). Reduces duplication when same interaction used across tests.


### How should visual regression tests handle components with dynamic data?

- [ ] A: Do not use visual regression for dynamic components

- [✓] B: Mock API data with page.route() before navigation — deterministic snapshots

- [ ] C: Use larger pixel diff threshold

- [ ] D: Disable visual regression in CI


**Answer:** B

Mock API responses with page.route() to control rendered data. Same mock each run produces identical snapshots. Works for any component fetching data.


### What Playwright feature records execution details for debugging failures?

- [ ] A: Screenshots only

- [✓] B: Trace Viewer — captures action log, screenshots, network, console, and DOM snapshots

- [ ] C: Video recording of full test

- [ ] D: Console.log output


**Answer:** B

Trace records full execution: timeline, DOM snapshots before/after each action, network requests, console logs. Opened via npx playwright show-trace. Enabled with trace: 'on' or 'on-first-retry'.


### What is the purpose of test.use({ storageState: 'auth/user.json' }) in Playwright?

- [ ] A: Stores test results in JSON file

- [✓] B: Reuses pre-authenticated browser state — skips login step for subsequent tests

- [ ] C: Saves page screenshot to file

- [ ] D: Caches API responses for faster tests


**Answer:** B

storageState loads saved cookies and localStorage into BrowserContext. Tests start already authenticated. Commonly created by first test (login → save context) then reused by remaining suite.


---

# Module 30: GraphQL — Apollo Client

Est. study time: 2h
Language: en

## Learning Objectives
- Understand Apollo Client architecture (InMemoryCache, link chain, typePolicies)
- Use useQuery, useMutation, useSubscription
- Configure normalized cache (keyFields, merge strategies)
- Implement fragment composition with codegen
- Handle errors (onError link, retry link)
- Implement pagination (offset, cursor, relay)
- Compare Apollo Client vs React Query
- React 19: Suspense integration with useSuspenseQuery
- React 19: useTransition for pagination
- React 19: ref as prop for client access

---

## Core Content

### Apollo Client Architecture

Apollo Client is GraphQL state management: cache-first fetching, normalized cache, link-based middleware.

```
ApolloClient
  ├── InMemoryCache (normalized data store)
  │     ├── typePolicies (custom keyFields, merge strategies)
  │     └── cache redirects
  └── Link Chain (middleware pipeline)
        ├── HttpLink (fetch from GraphQL endpoint)
        ├── onError Link (error handling)
        ├── RetryLink (automatic retry)
        └── AuthLink (token injection)
```

```typescript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { RetryLink } from '@apollo/client/link/retry'

const httpLink = createHttpLink({
  uri: '/graphql',
})

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`[GraphQL error]: ${message}`, locations, path)
    })
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`)
  }
})

const retryLink = new RetryLink({
  delay: { initial: 300, max: 3000, jitter: true },
  attempts: { max: 3 },
})

const client = new ApolloClient({
  link: retryLink.concat(errorLink).concat(httpLink),
  cache: new InMemoryCache(),
})

export default client
```

### ApolloProvider Setup

```typescript
import { ApolloProvider } from '@apollo/client'
import client from './apollo-client'

function App() {
  return (
    <ApolloProvider client={client}>
      <RouterProvider router={router} />
    </ApolloProvider>
  )
}
```

ApolloProvider makes client available via React context. All useQuery/useMutation hooks use this client.

### useQuery

```typescript
import { gql, useQuery } from '@apollo/client'

const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
      email
      posts {
        id
        title
      }
    }
  }
`

interface User {
  id: string
  name: string
  email: string
  posts: Array<{ id: string; title: string }>
}

interface UsersData {
  users: User[]
}

function UsersList() {
  const { loading, error, data } = useQuery<UsersData>(GET_USERS)

  if (loading) return <Spinner />
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {data?.users.map((user) => (
        <li key={user.id}>{user.name} — {user.email}</li>
      ))}
    </ul>
  )
}
```

### useMutation

```typescript
import { gql, useMutation } from '@apollo/client'

const CREATE_USER = gql`
  mutation CreateUser($name: String!, $email: String!) {
    createUser(name: $name, email: $email) {
      id
      name
      email
    }
  }
`

function CreateUserForm() {
  const [createUser, { loading, error }] = useMutation(CREATE_USER, {
    refetchQueries: [{ query: GET_USERS }],
    onCompleted: (data) => {
      toast.success(`User ${data.createUser.name} created`)
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createUser({
      variables: {
        name: form.get('name') as string,
        email: form.get('email') as string,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create User'}
      </button>
      {error && <p className="error">{error.message}</p>}
    </form>
  )
}
```

### useSubscription

```typescript
import { gql, useSubscription } from '@apollo/client'

const MESSAGE_SUB = gql`
  subscription OnMessageReceived($chatId: ID!) {
    messageReceived(chatId: $chatId) {
      id
      content
      sender {
        id
        name
      }
      timestamp
    }
  }
`

function ChatRoom({ chatId }: { chatId: string }) {
  const { data, loading } = useSubscription(MESSAGE_SUB, {
    variables: { chatId },
  })

  return (
    <div>
      {data?.messageReceived && (
        <div className="message">
          <strong>{data.messageReceived.sender.name}:</strong>
          {data.messageReceived.content}
        </div>
      )}
    </div>
  )
}
```

### InMemoryCache and typePolicies

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client'

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        users: {
          merge(existing = [], incoming: any[]) {
            return [...existing, ...incoming]
          },
        },
      },
    },
    User: {
      keyFields: ['id'],
    },
    Post: {
      keyFields: ['id', 'authorId'],
    },
  },
})
```

Cache normalization:

| Concept | Description |
|---------|-------------|
| Cache ID | Default: `__typename:id` (e.g., `User:123`) |
| keyFields | Custom cache ID fields |
| typePolicies | Field-level read/merge behavior |
| Cache redirect | Point query to existing cache data |

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    Product: {
      keyFields: ['sku', 'category'],
    },
    Review: {
      keyFields: ['id', 'productId'],
    },
  },
})
```

### Fragment Composition

```typescript
import { gql, useQuery } from '@apollo/client'

const USER_FRAGMENT = gql`
  fragment UserFields on User {
    id
    name
    email
    avatarUrl
  }
`

const POST_FRAGMENT = gql`
  fragment PostFields on Post {
    id
    title
    body
    createdAt
    author {
      ...UserFields
    }
  }
  ${USER_FRAGMENT}
`

const GET_FEED = gql`
  query GetFeed {
    feed {
      ...PostFields
    }
  }
  ${POST_FRAGMENT}
`

function Feed() {
  const { data } = useQuery(GET_FEED)

  return (
    <div>
      {data?.feed.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

Fragment composition with codegen:

```typescript
// codegen.ts
import { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'http://localhost:4000/graphql',
  documents: ['src/**/*.tsx'],
  generates: {
    './src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],
    },
  },
}

export default config
```

```typescript
import { useGetFeedQuery, useCreateUserMutation } from '../generated/graphql'

function Feed() {
  const { data, loading } = useGetFeedQuery()
  return <div>{data?.feed.map((post) => <PostCard key={post.id} post={post} />)}</div>
}
```

### Error Handling

```typescript
import { onError } from '@apollo/client/link/error'
import { ApolloClient, InMemoryCache, from } from '@apollo/client'

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      switch (err.extensions?.code) {
        case 'UNAUTHENTICATED':
          window.location.href = '/login'
          break
        case 'FORBIDDEN':
          toast.error('You do not have permission')
          break
        case 'RATE_LIMITED':
          toast.warning('Too many requests — slow down')
          break
        default:
          console.error(`GraphQL error on ${operation.operationName}:`, err.message)
      }
    }
  }

  if (networkError) {
    toast.error('Network connection lost')
  }
})

const client = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache(),
})
```

```typescript
import { RetryLink } from '@apollo/client/link/retry'

const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 10000,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error) => !!error,
  },
})

const RETRY_DISABLED = new RetryLink({ attempts: { max: 0 } })
```

### Pagination

```typescript
import { gql, useQuery } from '@apollo/client'

const GET_PAGINATED_USERS = gql`
  query GetUsers($offset: Int!, $limit: Int!) {
    users(offset: $offset, limit: $limit) {
      id
      name
      email
    }
  }
`

function UsersPaginated() {
  const [page, setPage] = useState(0)
  const limit = 20

  const { data, loading, fetchMore } = useQuery(GET_PAGINATED_USERS, {
    variables: { offset: page * limit, limit },
  })

  return (
    <div>
      {data?.users.map((user) => <UserCard key={user.id} user={user} />)}
      <button
        onClick={() => setPage((p) => p - 1)}
        disabled={page === 0}
      >
        Previous
      </button>
      <button
        onClick={() => {
          fetchMore({ variables: { offset: (page + 1) * limit, limit } })
          setPage((p) => p + 1)
        }}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Next'}
      </button>
    </div>
  )
}
```

```typescript
import { gql, useQuery } from '@apollo/client'

const GET_COMMENTS = gql`
  query GetComments($first: Int!, $after: String) {
    comments(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          text
          author { name }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

function CommentsList() {
  const { data, fetchMore } = useQuery(GET_COMMENTS, {
    variables: { first: 10 },
  })

  const loadMore = () => {
    if (!data?.comments.pageInfo.hasNextPage) return
    fetchMore({
      variables: {
        after: data.comments.pageInfo.endCursor,
      },
    })
  }

  return (
    <div>
      {data?.comments.edges.map(({ node }) => (
        <CommentCard key={node.id} comment={node} />
      ))}
      {data?.comments.pageInfo.hasNextPage && (
        <button onClick={loadMore}>Load More Comments</button>
      )}
    </div>
  )
}
```

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        comments: {
          keyArgs: false,
          merge(existing, incoming) {
            if (!existing) return incoming
            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            }
          },
        },
      },
    },
  },
})
```

### React 19: useSuspenseQuery

```typescript
import { gql, useSuspenseQuery } from '@apollo/client'

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      posts {
        id
        title
      }
    }
  }
`

function UserProfile({ userId }: { userId: string }) {
  const { data } = useSuspenseQuery<{ user: User }>(GET_USER, {
    variables: { id: userId },
  })

  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
      <h2>Posts</h2>
      {data.user.posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

function UserPage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<UserSkeleton />}>
      <UserProfile userId={userId} />
    </Suspense>
  )
}
```

### React 19: useTransition for Pagination

```typescript
import { useTransition } from 'react'
import { gql, useSuspenseQuery } from '@apollo/client'

function ProductList() {
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const { data } = useSuspenseQuery(GET_PRODUCTS, {
    variables: { page, limit: 20 },
  })

  const goToPage = (nextPage: number) => {
    startTransition(() => {
      setPage(nextPage)
    })
  }

  return (
    <div>
      <div className={`products ${isPending ? 'products-fade' : ''}`}>
        {data.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <div className="pagination">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1 || isPending}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          onClick={() => goToPage(page + 1)}
          disabled={isPending}
        >
          {isPending ? 'Loading...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
```

### React 19: ref as Prop for Client Access

```typescript
import { useRef } from 'react'
import { ApolloClient } from '@apollo/client'

function MutationButton({ clientRef }: { clientRef: React.RefObject<ApolloClient<unknown> | null> }) {
  const handleClick = async () => {
    const client = clientRef.current
    if (!client) return

    const result = await client.mutate({
      mutation: CREATE_USER,
      variables: { name: 'Alice', email: 'alice@example.com' },
    })
  }

  return <button onClick={handleClick}>Create User Imperatively</button>
}

function App() {
  const clientRef = useRef<ApolloClient<unknown> | null>(null)

  return (
    <ApolloProvider client={client}>
      <MutationButton clientRef={clientRef} />
    </ApolloProvider>
  )
}
```

### Apollo Client vs React Query

| Aspect | Apollo Client | React Query (TanStack Query) |
|--------|---------------|------------------------------|
| Protocol | GraphQL only | Any async function (REST, GraphQL) |
| Cache | Normalized (entity store) | Key-value (document cache) |
| Schema | Required for codegen | No schema needed |
| DevTools | Apollo DevTools | React Query DevTools |
| Bundle size | ~35KB | ~13KB |
| Subscriptions | Built-in (WebSocket) | Requires external library |
| Fragment composition | Native | Manual |
| Learning curve | Steeper | Gentler |

When to use each:

| Scenario | Choice |
|----------|--------|
| GraphQL API | Apollo Client (normalized cache benefits) |
| REST API | React Query |
| Mixed API (REST + GraphQL) | React Query |
| Real-time subscriptions | Apollo Client (built-in) |
| Simple cache needs | React Query (lighter) |
| Complex entity relationships | Apollo Client (normalization) |

> **Think**: What problem does normalized cache solve that document cache does not?
>
> *Answer: Normalized cache stores each entity once by ID. Two queries returning same user update single cache entry. Document cache stores each query response separately — same user data duplicated across responses. Normalization ensures consistency: update user in one place, all queries reflecting that user see new data.*

---

### Why This Matters

GraphQL solves over-fetching and under-fetching by letting clients specify exact data shapes. Apollo Client adds normalized caching, optimistic updates, and pagination. Understanding both Apollo Client and React Query helps choose right tool: Apollo for GraphQL-heavy apps, React Query for mixed or REST APIs.

---

### Common Questions

**Q: Why does my mutation not update the cache automatically?**
A: Apollo Client auto-updates cache for mutations returning objects with id matching existing cache entries. For list queries, use refetchQueries or manually update cache with cache.modify or cache.writeQuery. typePolicies merge function handles list appends.

**Q: How to handle file uploads with Apollo Client?**
A: Use apollo-upload-client's createUploadLink instead of HttpLink. Accepts File/Blob in variables. Server processes multipart form data. Apollo Client serializes File objects automatically.

---

## Examples

### Example 1: typePolicies Cache Configuration

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client'

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        products: {
          keyArgs: ['category'],
          merge(existing = { edges: [], pageInfo: {} }, incoming) {
            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            }
          },
        },
        notifications: {
          merge(_, incoming) {
            return incoming
          },
        },
      },
    },
    Product: {
      keyFields: ['sku'],
      fields: {
        displayName: {
          read(product: { name: string; variant: string }) {
            return `${product.name} (${product.variant})`
          },
        },
        formattedPrice: {
          read(product: { price: number }) {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(product.price)
          },
        },
      },
    },
    User: {
      keyFields: ['id'],
      fields: {
        fullName: {
          read(user: { firstName: string; lastName: string }) {
            return `${user.firstName} ${user.lastName}`
          },
        },
      },
    },
    Review: {
      keyFields: ['id', 'productId'],
    },
    Cart: {
      keyFields: [],
    },
  },
})
```

### Example 2: Pagination Hook with Cursor

```typescript
import { gql, useQuery } from '@apollo/client'
import { useCallback, useState } from 'react'

const GET_REPOSITORIES = gql`
  query GetRepositories($first: Int!, $after: String, $query: String!) {
    search(type: REPOSITORY, first: $first, after: $after, query: $query) {
      repositoryCount
      edges {
        cursor
        node {
          ... on Repository {
            id
            name
            owner { login }
            stargazerCount
            description
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

interface RepositoryNode {
  id: string
  name: string
  owner: { login: string }
  stargazerCount: number
  description: string | null
}

interface SearchEdge {
  cursor: string
  node: RepositoryNode
}

interface SearchResult {
  search: {
    repositoryCount: number
    edges: SearchEdge[]
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | null
    }
  }
}

interface UseCursorPaginationOptions {
  query: string
  pageSize?: number
}

function useCursorPagination({ query, pageSize = 20 }: UseCursorPaginationOptions) {
  const [cursors, setCursors] = useState<string[]>([""])
  const [currentPage, setCurrentPage] = useState(0)

  const after = cursors[currentPage] || undefined

  const { data, loading, error, fetchMore } = useQuery<SearchResult>(
    GET_REPOSITORIES,
    {
      variables: { first: pageSize, after, query },
      notifyOnNetworkStatusChange: true,
    }
  )

  const nextPage = useCallback(() => {
    if (!data?.search.pageInfo.hasNextPage) return
    const endCursor = data.search.pageInfo.endCursor!
    setCursors((prev) => {
      const updated = [...prev]
      updated[currentPage + 1] = endCursor
      return updated
    })
    setCurrentPage((p) => p + 1)
  }, [data, currentPage])

  const previousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1))
  }, [])

  const goToPage = useCallback((pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex <= currentPage) {
      setCurrentPage(pageIndex)
    }
  }, [currentPage])

  return {
    data,
    loading,
    error,
    pageInfo: data?.search.pageInfo,
    repositoryCount: data?.search.repositoryCount,
    currentPage,
    totalPages: currentPage + 1,
    hasNextPage: data?.search.pageInfo.hasNextPage ?? false,
    hasPreviousPage: currentPage > 0,
    nextPage,
    previousPage,
    goToPage,
    edges: data?.search.edges ?? [],
  }
}

function RepositoryBrowser() {
  const pagination = useCursorPagination({ query: 'react', pageSize: 10 })

  return (
    <div>
      <p>{pagination.repositoryCount} repositories found</p>
      <ul>
        {pagination.edges.map(({ node }) => (
          <li key={node.id}>
            <a href={`https://github.com/${node.owner.login}/${node.name}`}>
              {node.owner.login}/{node.name}
            </a>
            <span> {node.stargazerCount} stars</span>
            {node.description && <p>{node.description}</p>}
          </li>
        ))}
      </ul>
      <div className="pagination-controls">
        <button
          onClick={pagination.previousPage}
          disabled={!pagination.hasPreviousPage}
        >
          Previous
        </button>
        <span>Page {pagination.currentPage + 1}</span>
        <button
          onClick={pagination.nextPage}
          disabled={!pagination.hasNextPage || pagination.loading}
        >
          {pagination.loading ? 'Loading...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
```

---

## Key Takeaways
- Apollo Client architecture: InMemoryCache (normalized) + Link Chain (middleware pipeline)
- useQuery fetches data with cache-first policy; useMutation modifies data with refetchQueries
- useSubscription listens to real-time events via WebSocket
- typePolicies define custom keyFields (cache IDs) and merge strategies (paginated lists)
- Fragment composition splits GraphQL queries into reusable pieces; codegen generates typed hooks
- Error handling via onError link (per-error-type handling) and RetryLink (backoff strategy)
- Pagination: offset (fetchMore), cursor (Relay-style edges), merge strategy in typePolicies
- useSuspenseQuery triggers Suspense boundary — no loading state in component
- useTransition marks page changes as low priority — keeps stale content visible during load
- ref as prop enables imperative client access outside hooks
- Apollo Client for GraphQL APIs; React Query for REST/mixed APIs

## Common Misconception

"**Apollo Client cache automatically updates after every mutation.**"

Apollo Client auto-updates cache only when mutation returns an object with matching id AND typename already in cache. List queries do not auto-update. Use refetchQueries, cache.modify, or cache.writeQuery for list invalidation. typePolicies merge function configures how paginated lists append.

---

## Feynman Explain
(Explain Apollo Client to a backend engineer: "Apollo Client is like a local database that mirrors your GraphQL API. It stores normalized entities by ID — each user, post, comment stored once. When component A fetches { users { id name } } and component B fetches { users { id email } }, Apollo merges them into single user entity. Mutations update entity cache automatically if they return full object. For lists, you tell Apollo how to merge with typePolicies.")

---

## Reframe
(Pause. GraphQL and Apollo teach a data-fetching philosophy: declare data requirements alongside components, not in a centralized API layer. Fragments colocated with components mean no over-fetching. Normalized cache means data consistency without manual sync. This mental model — declaring data needs at component level — applies beyond GraphQL to any data layer where components own their data shape.)

---

## Drill
Take the quiz. MCQs test Apollo Client architecture, useQuery/useMutation/useSubscription, InMemoryCache typePolicies, fragment composition, error handling, pagination, React 19 useSuspenseQuery, useTransition, ref prop, and comparison with React Query.

Run: `learn.sh quiz external-lib-patterns 30-graphql-apollo`

## Quiz: 30-graphql-apollo


### What is the purpose of typePolicies in Apollo Client's InMemoryCache?

- [ ] A: Defines GraphQL schema types for validation

- [✓] B: Customizes cache behavior: keyFields for cache IDs, merge strategies for field updates

- [ ] C: Configures HTTP headers for GraphQL requests

- [ ] D: Generates TypeScript types from GraphQL schema


**Answer:** B

typePolicies configure per-type cache behavior. keyFields defines custom cache ID (default __typename:id). merge controls how incoming data merges with cached data (critical for pagination). read computes derived fields.


### How does Apollo Client's normalized cache differ from React Query's document cache?

- [ ] A: No difference — both store query responses as-is

- [✓] B: Normalized cache stores each entity once by ID. Document cache stores each query response separately

- [ ] C: Apollo stores cache in IndexedDB. React Query stores in memory

- [ ] D: Normalized cache is slower but more accurate


**Answer:** B

Normalized cache: entities normalized by ID (User:123 stored once). Two queries returning same user update single cache entry. Document cache: each query response cached as blob — same user data duplicated across queries.


### What Apollo Client hook enables Suspense integration in React 19?

- [ ] A: useQuery with suspense: true option

- [✓] B: useSuspenseQuery — throws promise to Suspense boundary

- [ ] C: useSuspenseQuery wraps useQuery internally

- [ ] D: ApolloProvider handles Suspense automatically


**Answer:** B

useSuspenseQuery throws promise during fetch, caught by parent Suspense boundary. Component renders only when data available. No loading state in component.


### How do you handle UNAUTHENTICATED errors globally in Apollo Client?

- [ ] A: Catch error in each useQuery's onError callback

- [✓] B: Use onError link to intercept errors and redirect to login

- [ ] C: Wrap ApolloProvider in error boundary

- [ ] D: UNAUTHENTICATED errors are handled automatically


**Answer:** B

onError link intercepts all GraphQL and network errors. Check err.extensions.code === 'UNAUTHENTICATED' in onError link handler. Redirect to login page or refresh token.


### What is the correct way to append paginated data in Apollo cache?

- [ ] A: Cache appends automatically — no configuration needed

- [✓] B: Define merge function in typePolicies that combines existing and incoming arrays

- [ ] C: Use cache.appendQuery for paginated fields

- [ ] D: Set paginated: true in query options


**Answer:** B

typePolicies field merge function controls list merging. Example: merge(existing = [], incoming) => [...existing, ...incoming]. Without custom merge, Apollo replaces existing data with incoming.


### What is the purpose of fragment composition in Apollo Client?

- [ ] A: Splits large queries into smaller network requests

- [✓] B: Reusable field selections shared across queries — single source of truth for data shape

- [ ] C: Fragments are deprecated in Apollo Client v4

- [ ] D: Fragments improve query performance by reducing payload


**Answer:** B

Fragments define reusable field sets. Query includes fragment with ...spread syntax. Change fragment definition → all queries using it update. Improves maintainability of GraphQL document colocation.


### When should you choose React Query over Apollo Client?

- [ ] A: Apollo Client is always better for any React app

- [✓] B: REST or mixed REST/GraphQL APIs — React Query works with any async function

- [ ] C: React Query only for REST APIs

- [ ] D: React Query replaces Apollo Client for GraphQL too


**Answer:** B

React Query is protocol-agnostic. Works with any async function (REST, GraphQL, tRPC). Apollo Client is GraphQL-only. Use React Query for mixed or non-GraphQL APIs. Use Apollo Client for GraphQL-heavy apps.


### How does Apollo Client handle subscriptions (real-time data)?

- [ ] A: Subscriptions use polling — not real-time

- [✓] B: useSubscription hook with WebSocket link — receives pushed data from server

- [ ] C: Subscriptions require external library — not built into Apollo Client

- [ ] D: Subscriptions work only with Apollo Server


**Answer:** B

useSubscription listens to GraphQL subscription via WebSocket. Server pushes data when events occur. Requires GraphQLWsLink or WebSocketLink for transport. Built-in, no external library needed.


### What does cache.modify() do in Apollo Client?

- [ ] A: Clears entire cache

- [✓] B: Modifies specific cached field values without refetch — used after mutations

- [ ] C: Modifies GraphQL schema settings

- [ ] D: Updates HTTP headers for next query


**Answer:** B

cache.modify() updates specific cached fields directly. Pattern: cache.modify({ id: cache.identify(user), fields: { name: () => newName } }). Avoids refetch when mutation result already known.


### How does React 19 useTransition improve pagination UX with Apollo Client?

- [ ] A: useTransition speeds up GraphQL queries

- [✓] B: Marks page state change as low priority — stale content visible during fetch, no loading flash

- [ ] C: useTransition replaces fetchMore for pagination

- [ ] D: useTransition disables pagination buttons during fetch


**Answer:** B

useTransition wraps page state update as non-urgent. React renders stale page content while next page loads. Suspense handles loading. User sees previous page until next page ready.


---

# Module 31: Audio — Howler.js

Est. study time: 1.5h
Language: en

## Learning Objectives
- Architect audio playback wrapper around Howler.js
- Implement audio sprite sheets for memory-efficient sound clips
- Control playback lifecycle with Howl instance methods
- Integrate spatial audio via Howler.pos()
- Build React 19 useHowler hook with imperative ref API

---

## Core Content

### Howler.js Architecture

Howler.js provides two core objects:

- `Howl` — individual audio instance (file or sprite sheet). Each Howl manages playback state, volume, rate, and position.
- `Howler` — global singleton. Controls global mute, volume, orientation (spatial audio), and codec detection.

```typescript
import { Howl, Howler } from 'howler'

const sfx = new Howl({
  src: ['sfx.mp3', 'sfx.ogg'],
  volume: 0.8,
  rate: 1,
  onload: () => console.log('loaded'),
  onplayerror: (id, err) => console.error('play error', id, err),
})

sfx.play() // returns sound ID for control
sfx.pause(sfxId)
sfx.stop(sfxId)
sfx.seek(5, sfxId) // seek to 5s
sfx.volume(0.5, sfxId)
```

Howler global for cross-instance control:

```typescript
Howler.mute(true)
Howler.volume(0.3)
Howler.pos(0, 0, -1) // set listener position for spatial audio
```

### Audio Sprites

Single audio file split into named clips. Dramatically reduces HTTP requests and memory (one decode vs many).

```typescript
const spriteSheet = new Howl({
  src: ['sprites.webm', 'sprites.mp3'],
  sprite: {
    click: [0, 300],          // offset 0ms, duration 300ms
    confirm: [300, 500],      // offset 300ms, duration 500ms
    cancel: [800, 400],
    notification: [1200, 2000],
  },
})

spriteSheet.play('click')
spriteSheet.play('confirm')
```

Sprite definition format: `[offsetMs, durationMs]`. All clips share same volume/rate context until overridden.

Playback returns numeric `soundId` per call — needed to control individual overlapping plays:

```typescript
const id1 = spriteSheet.play('notification')
setTimeout(() => spriteSheet.fade(1, 0, 500, id1), 3000)
```

### Playback Controls

| Method | Description | Parameters |
|--------|-------------|------------|
| `play(spriteOrId)` | Start/resume | sprite name or sound ID |
| `pause(id)` | Pause specific sound | sound ID |
| `stop(id)` | Stop specific sound | sound ID |
| `mute(muted, id)` | Mute specific sound | boolean, optional ID |
| `volume(vol, id)` | Set volume 0-1 | number, optional ID |
| `rate(rate, id)` | Set playback rate | 0.5-4, optional ID |
| `seek(pos, id)` | Seek to position | seconds, optional ID |
| `state()` | Get ready state | 'unloaded'|'loading'|'loaded' |
| `playing(id)` | Is sound playing | boolean |
| `duration(id)` | Duration in seconds | number |
| `fade(from, to, duration, id)` | Smooth volume transition | numbers |

### Event System

Howl emits lifecycle events. Register via constructor options or `on()`:

```typescript
const sound = new Howl({
  src: ['music.mp3'],
  onload: () => { /* ready */ },
  onloaderror: (id, code) => { /* codec/network error */ },
  onplay: (id) => { /* playback started */ },
  onpause: (id) => { /* paused */ },
  onstop: (id) => { /* stopped */ },
  onend: (id) => { /* natural end */ },
  onseek: (id) => { /* seek completed */ },
  onmute: (id) => { /* muted state changed */ },
  onvolume: (id) => { /* volume changed */ },
  onrate: (id) => { /* rate changed */ },
})

// Dynamic registration
sound.on('play', (id) => updateUI(id))
sound.once('load', () => setLoaded(true))
sound.off('play')
```

Event handlers receive `soundId`. Critical for multi-instance scenarios where one event fires per sound.

### Cross-Browser Codec Support

Howler detects browser support and picks first playable format from `src` array. Best practice — provide at least:

| Codec | Browser Support | Quality |
|-------|----------------|---------|
| MP3 | All | Good |
| OGG | Firefox, Chrome, Edge | Good |
| WebM | Chrome, Firefox | Best/compression |
| AAC | Safari, iOS | Good |
| WAV | All | Uncompressed (large) |

```typescript
new Howl({
  src: [
    'audio.webm', // prefer smallest
    'audio.ogg',
    'audio.mp3',  // safest fallback
  ],
})
```

### Spatial Audio

Howler supports Web Audio API spatialization via global listener:

```typescript
// Position of listener
Howler.pos(x, y, z) // default: (0, 0, 0)

// Orientation
Howler.orientation(frontX, frontY, frontZ, upX, upY, upZ)
```

Per-sound spatial attributes:

```typescript
const gunshot = new Howl({
  src: ['shot.mp3'],
  autoplay: false,
  sprite: { shot: [0, 800] },
  orientation: [1, 0, 0],
  pos: [10, 0, 5], // 3D position
})

// Update position during playback
gunshot.pos([20, 0, 5], soundId)
```

`pos()` on Howl sets 3D position relative to listener `Howler.pos()`. Distance model configurable via `Howler.distanceModel('inverse' | 'linear' | 'exponential')`.

### Think: Sound Pool Pattern

Games and UI toolkits often fire same sound overlapping (multiple clicks). Each `play()` creates new sound instance. Manage pool to avoid allocation overhead:

```typescript
class SoundPool {
  private pool: Howl[] = []
  private current = 0

  constructor(src: string[], poolSize = 4) {
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(
        new Howl({ src, pool: i, volume: 0.5 })
      )
    }
  }

  play(sprite?: string) {
    this.pool[this.current].play(sprite)
    this.current = (this.current + 1) % this.pool.length
  }
}
```

---

### Why This Matters

Audio in web apps ranges from notification pings to full game soundtracks. Without structured wrapper, audio code fragments across components — one component sets volume globally, another forgets to stop loops on unmount, memory leaks from orphan Howl instances. Howler.js provides solid foundation; wrapper pattern makes it safe, testable, swappable.

Wrapper isolates browser audio quirks (autoplay policies, codec fallback, suspend/resume) behind clean interface. Your app logic never touches Web Audio API directly.

---

### Common Questions

**Q: How to handle autoplay restrictions?**
A: Browsers block `play()` without user gesture. Check `Howler.ctx.state === 'suspended'`. Resume context on first user interaction via `Howler.ctx.resume()`. Pattern: add one-time click listener at app root.

**Q: Can I change sprite definition after Howl creation?**
A: No. Sprite offsets baked into audio buffer at load time. Delete Howl instance and create new one with updated sprite map.

**Q: Why does seek not work with sprites?**
A: Seek position is relative to full audio file, not sprite start. Use `sprite[offset]` on sprite end behavior instead.

---

## Examples

### Example 1: useHowler Hook

React 19 ref-as-prop pattern for imperative audio control:

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Howl } from 'howler'

interface UseHowlerOptions {
  src: string[]
  sprite?: Record<string, [number, number]>
  volume?: number
  onLoad?: () => void
  onEnd?: (sprite: string) => void
}

interface HowlerHandle {
  play: (sprite?: string) => number | undefined
  pause: (id?: number) => void
  stop: (id?: number) => void
  seek: (seconds: number, id?: number) => void
  isPlaying: (id?: number) => boolean
  setVolume: (vol: number, id?: number) => void
}

function useHowler(options: UseHowlerOptions, ref?: React.RefObject<HowlerHandle | null>): HowlerHandle {
  const howlRef = useRef<Howl | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let isCancelled = false
    const { Howl } = require('howler')
    const howl = new Howl({
      src: options.src,
      sprite: options.sprite,
      volume: options.volume ?? 1,
      onload: () => {
        if (!isCancelled) {
          setLoaded(true)
          options.onLoad?.()
        }
      },
      onend: (id) => {
        const spriteName = Object.entries(options.sprite ?? {}).find(
          ([, [offset]]) => howl.seek(id) === offset
        )?.[0]
        options.onEnd?.(spriteName ?? '')
      },
    })
    howlRef.current = howl
    return () => {
      isCancelled = true
      howl.unload()
    }
  }, [options.src.join(','), JSON.stringify(options.sprite)])

  const handle: HowlerHandle = {
    play: useCallback((sprite) => howlRef.current?.play(sprite), []),
    pause: useCallback((id) => howlRef.current?.pause(id), []),
    stop: useCallback((id) => howlRef.current?.stop(id), []),
    seek: useCallback((seconds, id) => howlRef.current?.seek(seconds, id), []),
    isPlaying: useCallback((id) => howlRef.current?.playing(id) ?? false, []),
    setVolume: useCallback((vol, id) => howlRef.current?.volume(vol, id), []),
  }

  useEffect(() => {
    if (ref && howlRef.current) {
      ref.current = handle
    }
  }, [ref, loaded])

  return handle
}
```

### Example 2: Audio Player with Sprite Sheet

React 19 component using `useTransition` for playlist transitions:

```typescript
'use client'

import { useTransition } from 'react'
import { useHowler } from './useHowler'

const SPRITES = {
  intro: [0, 3000],
  verse: [3000, 8000],
  chorus: [11000, 6000],
  bridge: [17000, 4000],
  outro: [21000, 3000],
}

export function AudioPlayer() {
  const [isPending, startTransition] = useTransition()
  const audio = useHowler({
    src: ['song.webm', 'song.mp3'],
    sprite: SPRITES,
    volume: 0.7,
  })

  function handlePlaySection(section: string) {
    startTransition(() => {
      audio.play(section)
    })
  }

  return (
    <div>
      {Object.keys(SPRITES).map((section) => (
        <button
          key={section}
          onClick={() => handlePlaySection(section)}
          disabled={isPending}
        >
          {section}
        </button>
      ))}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        onChange={(e) => audio.setVolume(Number(e.target.value))}
      />
    </div>
  )
}
```

### Example 3: Audio Visualizer with Canvas

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { Howl } from 'howler'

type Props = {
  src: string[]
}

export function AudioVisualizer({ src }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)

  useEffect(() => {
    const howl = new Howl({ src })
    const audioCtx = (Howler as any).ctx as AudioContext
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256

    // Connect Howler internal gain node to analyser
    const gainNode = (howl as any)._sounds[0]?._node
      ?.bufferNode?.source?.context?.destination
    if (gainNode) {
      // Simplified — real impl connects through Howler's audio graph
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function draw() {
      analyser.getByteFrequencyData(dataArray)
      ctx.fillStyle = 'rgb(20, 20, 30)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] * 0.5
        ctx.fillStyle = `rgb(${barHeight + 100}, 50, 200)`
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }
      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [src])

  return <canvas ref={canvasRef} width={400} height={200} />
}
```

---

## Key Takeaways
- Howl = individual audio instance; Howler = global singleton for mute/volume/spatial
- Audio sprites: single file, named offset-duration pairs, reduce HTTP requests
- Provide mp3 + ogg + webm for cross-browser coverage
- React 19 ref-as-prop pattern exposes imperative play/pause/seek to parent
- `useTransition` prevents playlist jank during section switching
- Always unload Howl on unmount to prevent memory leaks
- Web Audio API spatialization via Howler.pos() and Howl.pos()

## Common Misconception

"**Audio autoplay can be forced by setting attributes.**"

Modern browsers require user gesture for AudioContext creation. `autoplay` attribute and `howl.play()` in useEffect both fail before first click. Wrap app in one-time gesture handler that calls `Howler.ctx.resume()`. Feature: use `Howler.usingWebAudio` to check if Web Audio is available.

---

## Feynman Explain
(Explain Howler.js architecture to someone who only knows `<audio>` tag. Howl = audio file with controls. Howler = radio manager. Sprites = one CD with multiple tracks. Spatial audio = sound seems to come from left/right based on listener position.)

---

## Reframe
(How much audio abstraction is right? Notification pings probably don't need spatial audio. Full game soundtrack needs sprite pooling and volume ducking. Start with thin useHowler wrapper. Add pooling, spatial, visualizer only when profiling proves they are needed. YAGNI applies to audio too.)

---

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 31-audio-howler`

## Quiz: 31-audio-howler


### What is the difference between Howl and Howler in Howler.js?

- [ ] A: Howl is global singleton; Howler manages individual instances

- [✓] B: Howl manages individual audio instances; Howler is the global singleton for mute/volume/spatial

- [ ] C: They are interchangeable aliases

- [ ] D: Howl handles sprites; Howler handles non-sprite audio


**Answer:** B

Howl creates individual audio instances with playback control. Howler provides global state: mute, volume, listener position for spatial audio, and codec detection.


### How are audio sprites defined in Howler.js?

- [ ] A: Array of file paths, played in sequence

- [✓] B: Object mapping sprite names to [offsetMs, durationMs] arrays

- [ ] C: Separate JSON manifest file linked in constructor

- [ ] D: CSS animation timing applied to audio element


**Answer:** B

Sprite definition is Record<string, [number, number]> where each entry maps name to [offsetMs, durationMs] within a single audio file.


### Which method signature correctly seeks a specific sound instance?

- [ ] A: howl.seek(5)

- [✓] B: howl.seek(5, soundId)

- [ ] C: howl.seek(soundId, 5)

- [ ] D: Howler.seek(5, soundId)


**Answer:** B

Howl.seek(seconds, soundId) seeks specific playback instance. Without soundId, seeks first/default instance. Howler has no seek method.


### What is the purpose of providing multiple formats in Howl src array?

- [ ] A: Play all formats simultaneously for redundancy

- [✓] B: Howler picks first playable format based on browser codec support

- [ ] C: Increases audio quality by merging codecs

- [ ] D: Required for sprite sheets to work


**Answer:** B

Howler detects browser codec support and selects first playable entry from src array. Pattern: [webm, ogg, mp3] for optimal coverage.


### How does the React 19 ref-as-prop pattern work with Howler.js?

- [ ] A: Ref holds Howl instance created inside effect

- [✓] B: Ref exposes imperative audio control methods (play, pause, seek) to parent

- [ ] C: Ref replaces useState for audio state

- [ ] D: Ref stores audio buffer for visualizer


**Answer:** B

Ref-as-prop in React 19 passes ref to child, which assigns handle object with play/pause/seek/volume methods. Parent calls audio.handle.play() imperatively.


### Why use useTransition when triggering audio sprite playback?

- [ ] A: Transition lowers audio latency

- [✓] B: Prevents UI jank during rapid section switching by marking state update as low priority

- [ ] C: Transition enables crossfade between sprites

- [ ] D: Required for Howler autoplay policy


**Answer:** B

useTransition marks state update as non-urgent, keeping UI responsive during rapid playlist navigation. Audio playback itself is imperative and unaffected by React render.


### What happens if seek is called on a sprite-based Howl instance?

- [ ] A: Seeks to position within current sprite

- [✓] B: Seeks to position within full audio file, not relative to sprite

- [ ] C: Throws error — seek not supported with sprites

- [ ] D: Seeks to next sprite boundary


**Answer:** B

Seek position is relative to full audio buffer, not sprite. To control sprite playback position, restart the sprite or adjust sprite offset definition.


### Which pattern prevents memory leaks when using Howler.js in React components?

- [✓] A: Call howl.unload() in useEffect cleanup

- [ ] B: Set howl reference to null on unmount

- [ ] C: Use ref instead of state to store Howl

- [ ] D: Wrap Howl in useMemo with empty deps


**Answer:** A

Howl allocates AudioContext resources. useEffect cleanup must call howl.unload() to release buffers and disconnect audio graph. Without unload, memory grows per mount.


### How does Howler.js handle browser autoplay restrictions?

- [ ] A: Plays anyway after user scroll

- [✓] B: Must resume AudioContext via Howler.ctx.resume() after user gesture

- [ ] C: Schedules play for after page load

- [ ] D: Always autoplays in Web Worker context


**Answer:** B

Browsers suspend AudioContext until user gesture. Call Howler.ctx.resume() inside click/submit handler to resume audio processing. Pattern: one-time gesture listener at app root.


### When should the Sound Pool pattern be used with Howler.js?

- [ ] A: Always — pool is default best practice

- [✓] B: When same sound played repeatedly and overlapping (e.g., UI clicks, game sfx)

- [ ] C: Only for spatial audio

- [ ] D: Pool replaces sprite sheet for large audio files


**Answer:** B

Sound Pool pre-allocates multiple Howl instances and rotates play() calls. Prevents allocation overhead for rapid overlapping sounds like UI clicks or game events. Not needed for sequential playback.


---

# Module 32: Video — Vidstack

Est. study time: 1.5h
Language: en

## Learning Objectives
- Architect video player wrapper using Vidstack provider abstraction
- Configure HLS streaming with hls.js integration
- Build custom UI slots for branded player skin
- Manage quality tracks and subtitle selection
- Integrate React 19 concurrent mode with media event handlers

---

## Core Content

### Vidstack Architecture

Vidstack is headless media framework with provider abstraction layer:

- `MediaProvider` — abstract interface for media sources. Concrete providers: `Html5VideoProvider`, `HlsProvider`, `YouTubeProvider`, `VimeoProvider`.
- `MediaPlayer` — orchestrator component managing playback state, UI interactions, track management.
- `MediaOutlet` — rendering surface (HTMLVideoElement, iframe, etc).

```typescript
import { MediaPlayer, MediaOutlet } from '@vidstack/react'

function Player() {
  return (
    <MediaPlayer src="https://example.com/video.mp4">
      <MediaOutlet />
    </MediaPlayer>
  )
}
```

Provider auto-detection based on `src`:

| Provider | Source Type | Use Case |
|----------|-----------|----------|
| Html5Video | .mp4, .webm, .mov | Direct file playback |
| HlsProvider | .m3u8 | Live/adaptive streaming |
| YouTubeProvider | YouTube URL | Embed YouTube |
| VimeoProvider | Vimeo URL | Embed Vimeo |

### Provider Abstraction Pattern

Vidstack normalizes provider APIs behind common interface:

```typescript
interface MediaProviderAdapter {
  type: string
  play(): Promise<void>
  pause(): void
  get currentTime(): number
  set currentTime(time: number)
  get paused(): boolean
  get duration(): number
  get volume(): number
  set volume(vol: number)
  on: (event: string, handler: Function) => void
}
```

Swap provider by changing `src` — all player UI, controls, and tracks work unchanged:

```typescript
function AdaptivePlayer({ quality }: { quality: 'hd' | 'sd' | 'hls' }) {
  const src = quality === 'hls'
    ? 'https://stream.example.com/live.m3u8'
    : quality === 'hd'
    ? 'https://cdn.example.com/movie-hd.mp4'
    : 'https://cdn.example.com/movie-sd.mp4'

  return (
    <MediaPlayer src={src}>
      <MediaOutlet />
    </MediaPlayer>
  )
}
```

### HLS Streaming with hls.js

Vidstack integrates hls.js for HLS playback. Install `@vidstack/hls` and register provider:

```typescript
import { HlsProvider } from '@vidstack/hls'
import { defineCustomElement } from '@vidstack/react'

defineCustomElement(HlsProvider)

function LivePlayer() {
  return (
    <MediaPlayer src="https://live.example.com/stream.m3u8">
      <MediaOutlet />
      {/* HLS quality selector */}
      <MediaQualitySlider />
    </MediaPlayer>
  )
}
```

HLS configuration via `hlsConfig` prop:

```typescript
<MediaPlayer
  src="stream.m3u8"
  hlsConfig={{
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    startLevel: 2, // start at specific quality level
    abrEwmaDefaultEstimate: 500000, // 500kbps estimate
    enableWorker: true,
  }}
>
  <MediaOutlet />
</MediaPlayer>
```

### UI Components

Vidstack ships accessible UI components:

```typescript
import {
  MediaPlayer, MediaOutlet,
  MediaControls, MediaPlayButton,
  MediaSeekButton, MediaVolumeSlider,
  MediaTime, MediaSlider,
  MediaFullscreenButton, MediaCaptions,
} from '@vidstack/react'

function PlayerWithControls() {
  return (
    <MediaPlayer src="video.mp4">
      <MediaOutlet>
        <MediaCaptions />
      </MediaOutlet>
      <MediaControls>
        <MediaPlayButton />
        <MediaSeekButton seconds={-10} />
        <MediaSlider>
          <MediaTime type="current" />
          <MediaSlider.Value />
          <MediaTime type="total" />
        </MediaSlider>
        <MediaVolumeSlider />
        <MediaFullscreenButton />
      </MediaControls>
    </MediaPlayer>
  )
}
```

### Custom UI Slots

Override default slots for branded player skin:

```typescript
function CustomControls() {
  return (
    <MediaPlayer src="video.mp4">
      <MediaOutlet />
      {/* Custom slot replaces default controls */}
      <MediaControls className="custom-controls">
        <MediaPlayButton>
          <PlayIcon slot="play" />
          <PauseIcon slot="pause" />
        </MediaPlayButton>
        <MediaTime type="current" className="time-display" />
        <MediaSlider className="custom-slider" />
      </MediaControls>
    </MediaPlayer>
  )
}
```

Slot system uses named `slot` attributes on children:

| Slot | Component |
|------|-----------|
| `play` | Icon shown when paused |
| `pause` | Icon shown when playing |
| `on` | Icon for enabled toggle |
| `off` | Icon for disabled toggle |

### Tracks: Subtitles, Chapters, Quality

Vidstack supports multiple track types:

```typescript
<MediaPlayer src="video.mp4">
  <MediaOutlet />

  {/* Subtitle tracks */}
  <track
    kind="subtitles"
    src="/subs/en.vtt"
    srcLang="en"
    label="English"
    default
  />
  <track
    kind="subtitles"
    src="/subs/es.vtt"
    srcLang="es"
    label="Spanish"
  />

  {/* Chapter markers */}
  <track
    kind="chapters"
    src="/chapters/en.vtt"
    srcLang="en"
    label="Chapters"
  />

  {/* Quality selector rendered by UI */}
  <MediaQualitySlider />
</MediaPlayer>
```

### Responsive Video

Vidstack supports aspect ratio and art direction:

```typescript
// Preserve aspect ratio
<MediaPlayer
  src="video.mp4"
  aspectRatio={16 / 9}
  style={{ maxWidth: 960 }}
>

// Art direction via src set
<MediaPlayer
  src={[
    { src: 'video-mobile.mp4', media: '(max-width: 768px)' },
    { src: 'video-desktop.mp4', media: '(min-width: 769px)' },
  ]}
>
```

### Think: Media Event Performance

Video events fire at high frequency (timeupdate at ~4-60Hz, playbackratechange, volumechange). Each event triggers React re-render if handler calls setState. React 19 concurrent mode marks video UI updates as non-urgent to prevent dropped frames:

```typescript
import { useTransition, useCallback } from 'react'

function VideoProgressTracker() {
  const [isPending, startTransition] = useTransition()
  const [progress, setProgress] = useState(0)

  const onTimeUpdate = useCallback((event: MediaProgressEvent) => {
    startTransition(() => {
      setProgress(event.detail.currentTime)
    })
  }, [])

  return (
    <MediaPlayer onTimeUpdate={onTimeUpdate}>
      <MediaOutlet />
      <ProgressBar value={progress} aria-busy={isPending} />
    </MediaPlayer>
  )
}
```

---

### Why This Matters

Video is the heaviest media type in web apps — bandwidth, decoding, rendering all stress the browser. Choosing raw HTMLVideoElement couples UI to one provider. Vidstack abstracts provider differences (HLS vs YouTube vs direct MP4) behind one declarative API. Result: swap CDN, add live streaming, or embed third-party video without rebuilding player UI.

Branded player skin separates design from media logic. Custom slot system keeps accessible defaults while allowing full visual control.

---

### Common Questions

**Q: Can I use Vidstack without web components?**
A: Yes. `@vidstack/react` exports React components wrapping the web component core. No shadow DOM conflicts.

**Q: How to handle DRM-protected streams?**
A: Vidstack supports Encrypted Media Extensions via provider config. Attach `mediaKeySystemAccess` to HlsProvider or Html5VideoProvider.

**Q: Does HLS work in Safari natively?**
A: Safari has native HLS support. Vidstack detects and uses native HLS over hls.js when available, falling back to hls.js in other browsers.

---

## Examples

### Example 1: Custom Player Skin with Vidstack Slots

```typescript
'use client'

import {
  MediaPlayer, MediaOutlet, MediaControls,
  MediaPlayButton, MediaSeekButton,
  MediaVolumeSlider, MediaTime, MediaSlider,
  MediaFullscreenButton, MediaCaptions,
} from '@vidstack/react'

type Props = {
  src: string
  poster?: string
  aspectRatio?: number
}

export function CustomPlayer({ src, poster, aspectRatio = 16 / 9 }: Props) {
  return (
    <MediaPlayer
      src={src}
      poster={poster}
      aspectRatio={aspectRatio}
      className="media-player"
    >
      <MediaOutlet>
        <MediaCaptions className="custom-captions" />
      </MediaOutlet>

      <MediaControls className="media-controls">
        <div className="controls-left">
          <MediaPlayButton>
            <svg slot="play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            <svg slot="pause" viewBox="0 0 24 24"><path d="M6 4h4v16H6z M14 4h4v16h-4z" /></svg>
          </MediaPlayButton>

          <MediaSeekButton seconds={-10}>
            <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" /></svg>
          </MediaSeekButton>
        </div>

        <MediaSlider className="progress-slider">
          <MediaTime type="current" className="time" />
          <MediaSlider.Value />
          <MediaTime type="total" className="time" />
        </MediaSlider>

        <div className="controls-right">
          <MediaVolumeSlider className="volume-slider" />
          <MediaFullscreenButton>
            <svg slot="on" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3z M5 10h2V7h3V5H5v5z M17 17h-3v2h5v-5h-2v3z M14 5v2h3v3h2V5h-5z" /></svg>
            <svg slot="off" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2z M8 8H5v2h5V5H8v3z M19 8h-3V5h-2v5h5V8z M16 16h3v-2h-5v5h2v-3z" /></svg>
          </MediaFullscreenButton>
        </div>
      </MediaControls>
    </MediaPlayer>
  )
}
```

### Example 2: HLS Provider with Quality Selector

```typescript
'use client'

import { useState } from 'react'
import { MediaPlayer, MediaOutlet } from '@vidstack/react'
import { HlsProvider } from '@vidstack/hls'

type Quality = 'auto' | '1080p' | '720p' | '480p'

const QUALITY_LEVELS: Record<Quality, number | undefined> = {
  auto: undefined,
  '1080p': 5,
  '720p': 3,
  '480p': 1,
}

export function HlsPlayer() {
  const [quality, setQuality] = useState<Quality>('auto')
  const [hlsLevels, setHlsLevels] = useState<{ height: number; bitrate: number }[]>([])

  function onHlsInstance(hls: Hls) {
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setHlsLevels(
        hls.levels.map((level) => ({
          height: level.height,
          bitrate: level.bitrate,
        }))
      )
    })
  }

  return (
    <div>
      <MediaPlayer
        src="https://stream.example.com/live.m3u8"
        hlsConfig={{
          startLevel: QUALITY_LEVELS[quality],
        }}
        onHlsInstance={onHlsInstance}
      >
        <MediaOutlet />
      </MediaPlayer>

      <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
        <option value="auto">Auto</option>
        {hlsLevels.map((level, i) => (
          <option key={i} value={`${level.height}p`}>
            {level.height}p ({Math.round(level.bitrate / 1000)}kbps)
          </option>
        ))}
      </select>
    </div>
  )
}
```

### Example 3: React Compiler Optimization for Media Events

React Compiler automatically memoizes event handlers. Vidstack `onTimeUpdate` fires at high frequency — Compiler prevents unnecessary re-renders:

```typescript
'use client'

// With React Compiler enabled, this component auto-memoizes
function VideoPlayer() {
  const [currentTime, setCurrentTime] = useState(0)

  return (
    <MediaPlayer
      src="video.mp4"
      onTimeUpdate={(event) => {
        // Compiler infers this setState is fine-grained enough
        setCurrentTime(event.detail.currentTime)
      }}
    >
      <MediaOutlet />
      <div>Progress: {Math.round(currentTime)}s</div>
    </MediaPlayer>
  )
}
```

---

## Key Takeaways
- Vidstack provider abstraction normalizes Html5Video, HLS, YouTube, Vimeo behind common interface
- HLS streaming via hls.js integration with configurable ABR, buffer, quality levels
- Slot system for custom UI overrides without losing accessibility
- Tracks: subtitles (VTT), chapters, quality levels
- React 19 concurrent mode via useTransition for high-frequency media events
- React Compiler auto-memoizes media event handlers
- Responsive video via aspectRatio prop and media-conditional src arrays

## Common Misconception

"**Custom player skin means rebuilding accessible controls from scratch.**"

Vidstack slot system preserves ARIA roles, keyboard navigation, and focus management. Custom skins override visuals only — accessibility tree comes from Vidstack core. Replace icons and styles, never touch behavior.

---

## Feynman Explain
(Explain Vidstack to someone who knows HTMLVideoElement. Vidstack = adapter layer that makes MP4, HLS live stream, YouTube embed, and Vimeo all look same to your player code. Slots = labeled holes in default UI where you drop your own icons. Tracks = extra data streams riding alongside video.)

---

## Reframe
(Does every video need HLS and custom skin? Marketing hero video on landing page could use simple HTMLVideoElement. Vidstack adds bundle weight. Reach for Vidstack when: multiple providers, live streaming, subtitle/quality controls, or branded player is requirement. Start with `<video>` tag for single MP4.)

---

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 32-video-vidstack`

## Quiz: 32-video-vidstack


### What is the purpose of Vidstack provider abstraction?

- [ ] A: Provides DRM decryption for all video formats

- [✓] B: Normalizes Html5Video, HLS, YouTube, and Vimeo APIs behind common interface

- [ ] C: Replaces HTMLVideoElement entirely with WebGL rendering

- [ ] D: Compresses video files on the client


**Answer:** B

Provider abstraction lets developers swap between video sources (mp4, HLS, YouTube, Vimeo) without changing player UI or control logic. Each provider implements MediaProviderAdapter.


### Which Vidstack components are required for a minimal player?

- [ ] A: MediaProvider and MediaUI

- [✓] B: MediaPlayer and MediaOutlet

- [ ] C: MediaContainer and MediaSource

- [ ] D: MediaHost and MediaRenderer


**Answer:** B

MediaPlayer orchestrates state and tracks. MediaOutlet renders the underlying video element/iframe. Controls are optional and slot into MediaControls.


### How does Vidstack determine which provider to use?

- [ ] A: Manual provider prop on MediaPlayer

- [✓] B: Auto-detection from src URL extension or type

- [ ] C: Separate import for each provider

- [ ] D: Configuration in MediaPlayer constructor


**Answer:** B

Vidstack inspects src extension (.mp4, .m3u8) or URL pattern (youtube.com, vimeo.com) to select appropriate provider. Manual override via type prop if needed.


### How does Vidstack integrate hls.js for HLS streaming?

- [ ] A: Bundled inside Vidstack core

- [✓] B: Separate @vidstack/hls package with HlsProvider registration

- [ ] C: Manual hls.js instance passed via ref

- [ ] D: HLS support only available in premium tier


**Answer:** B

@vidstack/hls exports HlsProvider registered via defineCustomElement. hlsConfig prop passes options like maxBufferLength, startLevel, abrEwmaDefaultEstimate.


### What is the slot system in Vidstack UI components?

- [ ] A: CSS grid slots for layout

- [✓] B: Named slots replacing default icons (play/pause/fullscreen) with custom SVGs

- [ ] C: Slot machine animation for loading states

- [ ] D: Time slots for ad insertion


**Answer:** B

Slot attribute (slot='play', slot='pause', slot='on', slot='off') on child elements replaces default icons while preserving accessibility and behavior.


### Why use useTransition for timeupdate event handlers in Vidstack?

- [ ] A: Transition increases video playback speed

- [✓] B: Prevents UI jank by marking progress setState as non-urgent during 4-60Hz events

- [ ] C: Required for HLS buffer management

- [ ] D: Transition synchronizes subtitle rendering


**Answer:** B

timeupdate fires at high frequency. useTransition marks React state update as low priority to avoid frame drops during video playback. UI stays responsive.


### Which track types does Vidstack support?

- [ ] A: Subtitles only

- [✓] B: Subtitles, chapters, and quality levels

- [ ] C: Audio description tracks only

- [ ] D: Metadata and cue points


**Answer:** B

Vidstack supports subtitles (VTT), chapter markers (VTT), and quality level tracks rendered via MediaQualitySlider. Track elements declared as children of MediaPlayer.


### How does Vidstack handle responsive video across screen sizes?

- [ ] A: Media queries in CSS only

- [✓] B: aspectRatio prop for ratio locking and src array with media conditions for art direction

- [ ] C: JavaScript resize observer only

- [ ] D: Separate player component per breakpoint


**Answer:** B

aspectRatio prop locks player dimensions. src array with media condition strings enables art-direction responsive video (different source per breakpoint).


### What is the benefit of React Compiler with Vidstack media event handlers?

- [ ] A: Compiler converts media events to Web Workers

- [✓] B: Auto-memoizes event handlers, preventing unnecessary re-renders from high-frequency media events

- [ ] C: Compiler generates native video element code

- [ ] D: No benefit — media events are not reactive


**Answer:** B

React Compiler automatically memoizes callbacks and components. Vidstack onTimeUpdate fires 4-60 times/second — Compiler prevents these from causing cascading re-renders.


### When would you NOT use Vidstack and instead use raw HTMLVideoElement?

- [✓] A: Simple single-MP4 playback without controls customization

- [ ] B: HLS live streaming with quality selector

- [ ] C: Multi-provider support (YouTube + MP4)

- [ ] D: Application with subtitle track requirements


**Answer:** A

Vidstack adds bundle size for provider abstraction. For a single MP4 with default controls, bare <video> element with controls attribute is simpler and lighter.


---

# Module 33: QR & Barcodes — react-qrcode & jsbarcode

Est. study time: 1h
Language: en

## Learning Objectives
- Generate QR codes with react-qrcode (canvas and SVG modes)
- Configure error correction levels and QR customization
- Generate barcodes with jsbarcode (multiple formats)
- Build batch generation pattern with virtual scrolling
- Use React 19 Server Components for pre-rendered QR codes
- Implement canvas export to PNG via imperative ref API

---

## Core Content

### react-qrcode Architecture

Two renderers in react-qrcode:

- `QRCodeCanvas` — renders QR to `<canvas>` element
- `QRCodeSVG` — renders QR as SVG element (scalable, copyable)

```typescript
import { QRCodeCanvas, QRCodeSVG } from 'react-qrcode'

// Canvas renderer — good for export/print
<QRCodeCanvas value="https://example.com" size={256} />

// SVG renderer — good for inline display, copy, embedding
<QRCodeSVG
  value="https://example.com"
  size={256}
  bgColor="#ffffff"
  fgColor="#000000"
  level="M"
  includeMargin={false}
/>
```

### Error Correction Levels

| Level | Recovery | Use Case |
|-------|----------|----------|
| L | 7% | High density, clean surfaces |
| M | 15% | Moderate damage, general use |
| Q | 25% | Logo overlay, heavy wear |
| H | 30% | Maximum reliability, small data |

```typescript
// Pass with logo overlay; H level ensures scan still works
<QRCodeSVG value="https://example.com" level="H" />
```

### QR Customization

Color, size, margin, and logo overlay:

```typescript
<QRCodeSVG
  value="https://example.com"
  size={300}
  bgColor="#f0f0f0"
  fgColor="#333333"
  level="Q"
  includeMargin={true}
  marginSize={4}
  // Custom dot style (if supported by renderer)
  imageSettings={{
    src: '/logo.png',
    x: undefined, // auto-center
    y: undefined,
    height: 40,
    width: 40,
    excavate: true, // clear background behind logo
  }}
/>
```

`excavate` removes QR modules behind logo — prevents scan interference.

### jsbarcode Architecture

jsbarcode generates SVG or Canvas barcodes. Supports multiple formats:

```typescript
import JsBarcode from 'jsbarcode'

// SVG element
const svg = document.createElement('svg')
JsBarcode(svg, '1234567890128', {
  format: 'EAN-13',
  width: 2,
  height: 100,
  displayValue: true,
})
document.getElementById('barcode').appendChild(svg)

// Canvas element
const canvas = document.createElement('canvas')
JsBarcode(canvas, 'ABC-123', {
  format: 'CODE128',
  lineColor: '#000',
  background: '#fff',
})
```

### Barcode Formats

| Format | Usage | Character Set | Length |
|--------|-------|---------------|--------|
| CODE128 | Alphanumeric, general purpose | Full ASCII | Variable |
| EAN-13 | Retail products | Numeric | 13 digits |
| EAN-8 | Small packaging | Numeric | 8 digits |
| UPC-A | US retail | Numeric | 12 digits |
| CODE39 | Logistics, government | Alphanumeric + symbols | Variable |
| DataMatrix | Small items, electronics | Binary | Up to 2335 chars |
| ITF | Warehouse, shipping | Numeric | Variable |

### Batch Generation Pattern

Generating hundreds of QR/barcodes individually causes layout thrashing. Use virtual scrolling with generation outside visible window:

```typescript
'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { QRCodeSVG } from 'react-qrcode'
import { useRef } from 'react'

type Props = {
  items: { id: string; url: string }[]
}

export function QRCodeList({ items }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280,
  })

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index]
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <QRCodeSVG value={item.url} size={200} level="M" />
              <span>{item.id}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### React 19 Ref as Prop: Canvas Export

```typescript
'use client'

import { useRef } from 'react'
import { QRCodeCanvas } from 'react-qrcode'

type Props = {
  value: string
  fileName?: string
}

export function ExportableQR({ value, fileName = 'qr.png' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = fileName
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div>
      <QRCodeCanvas
        ref={canvasRef}
        value={value}
        size={256}
        level="H"
      />
      <button onClick={handleDownload}>Download PNG</button>
    </div>
  )
}
```

### Think: Server Components for Pre-rendered QR

QR codes are deterministic — same input produces same output. React 19 Server Components can pre-render QR to SVG string, sending zero JS to client:

```typescript
// Server Component — runs at build/request time
import { QRCodeSVG } from 'react-qrcode/server'

// This component never ships to client bundle
export async function StaticQR({ value }: { value: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={512}
      level="H"
    />
  )
}
```

`react-qrcode/server` renders to string without browser APIs. Wrap in Suspense for streaming:

```typescript
import { Suspense } from 'react'
import { StaticQR } from './StaticQR'

export default function Page() {
  return (
    <Suspense fallback={<QRSkeleton />}>
      <StaticQR value="https://example.com/product/123" />
    </Suspense>
  )
}
```

---

### Why This Matters

QR codes and barcodes bridge physical and digital worlds — ticketing, inventory, payments, authentication. Without wrapper, each feature duplicates configuration (error correction, format, size). Centralized wrapper ensures consistent scan reliability, format selection, and export behavior across all barcode features.

Server Components eliminate QR generation JS from client bundle. For product pages with 50 QR codes, this saves ~150KB compressed JS.

---

### Common Questions

**Q: Canvas vs SVG for QR codes — which to use?**
A: SVG for inline display (scales, copies, inspectable). Canvas for export (toDataURL/toBlob) or when you need pixel-level control.

**Q: Can jsbarcode generate QR codes too?**
A: jsbarcode supports QR format but it is limited. Use react-qrcode for QR codes (better error correction, customization, React integration). Use jsbarcode for linear barcodes (CODE128, EAN-13, etc).

**Q: How to batch generate 10000 labels without crashing browser?**
A: Virtual scroll rendering + offscreen generation via requestIdleCallback. Generate SVG strings in chunks, insert as HTML. Never mount 10000 DOM nodes.

---

## Examples

### Example 1: QR Component with Logo Overlay

```typescript
'use client'

import { QRCodeSVG } from 'react-qrcode'

type Props = {
  value: string
  logoSrc?: string
  size?: number
  errorLevel?: 'L' | 'M' | 'Q' | 'H'
}

export function QRWithLogo({
  value,
  logoSrc,
  size = 256,
  errorLevel = 'Q',
}: Props) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <QRCodeSVG
        value={value}
        size={size}
        level={errorLevel}
        imageSettings={logoSrc ? {
          src: logoSrc,
          height: size * 0.2,
          width: size * 0.2,
          excavate: true,
        } : undefined}
      />
    </div>
  )
}
```

### Example 2: Barcode SVG Component with jsbarcode

```typescript
'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

type Props = {
  value: string
  format?: 'CODE128' | 'EAN-13' | 'EAN-8' | 'UPC-A' | 'CODE39'
  width?: number
  height?: number
  displayValue?: boolean
}

export function Barcode({
  value,
  format = 'CODE128',
  width = 2,
  height = 80,
  displayValue = true,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, {
        format,
        width,
        height,
        displayValue,
      })
    }
  }, [value, format, width, height, displayValue])

  return <svg ref={svgRef} />
}
```

### Example 3: Export Hook for PNG Download

```typescript
'use client'

import { useCallback, useRef } from 'react'

export function useQRExport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const exportPNG = useCallback((fileName = 'qrcode.png') => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Increase resolution for print
    const scale = 4
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Scale canvas for high-res export
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width * scale
    tempCanvas.height = canvas.height * scale
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    tempCtx.scale(scale, scale)
    tempCtx.drawImage(canvas, 0, 0)

    const link = document.createElement('a')
    link.download = fileName
    link.href = tempCanvas.toDataURL('image/png', 1)
    link.click()
  }, [])

  return { canvasRef, exportPNG }
}
```

---

## Key Takeaways
- react-qrcode: Canvas for export, SVG for inline display
- Error correction: L (7%) to H (30%) — use H for logo overlay
- jsbarcode: CODE128 (general), EAN-13 (retail), DataMatrix (small items)
- Virtual scroll + batch generation prevents DOM thrashing for 100+ codes
- React 19 Server Components pre-render QR codes, zero client JS
- Ref-as-prop pattern for imperative canvas export to PNG
- excate=true on imageSettings clears QR modules behind logo

## Common Misconception

"**All QR codes with logo use same error correction as plain QR codes.**"

Logo overlay covers 15-25% of QR modules. Error correction must compensate. Always use level Q (25% recovery) or H (30% recovery) when overlaying logo. Level M (15%) will fail to scan with typical logo size.

---

## Feynman Explain
(Explain QR and barcodes to someone who has only scanned them. QR = checkerboard pattern stores URL/text. Error correction = redundancy — like spelling word twice so one smudge still readable. Barcodes = vertical lines encode numbers. Different barcode types for different industries. Logo on QR works because error correction fills in covered squares.)

---

## Reframe
(When not to use QR/barcode libraries? Tiny volumes (1-5 codes) can use online generator. Pre-generated static codes for print don't need React component at all — just serve SVG file. Library wrapper pays off when codes are dynamic (user-generated, batch exports, multi-format) or part of larger system.)

---

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 33-qr-barcode`

## Quiz: 33-qr-barcode


### What is the difference between QRCodeCanvas and QRCodeSVG in react-qrcode?

- [ ] A: Canvas supports color; SVG is monochrome

- [✓] B: Canvas renders to canvas element (good for export); SVG renders scalable vector (good for inline display)

- [ ] C: SVG is faster; Canvas supports more error levels

- [ ] D: They are identical — name only differs for SSR compatibility


**Answer:** B

QRCodeCanvas renders to <canvas> — use for export (toDataURL, toBlob). QRCodeSVG renders to <svg> — use for inline display, copy, embedding, scaling.


### Which error correction level should be used when overlaying a logo on a QR code?

- [ ] A: L (7% recovery)

- [ ] B: M (15% recovery)

- [✓] C: Q (25% recovery) or H (30% recovery)

- [ ] D: Error correction has no effect on logo overlays


**Answer:** C

Logo covers 15-25% of QR modules. Need Q (25%) or H (30%) recovery to ensure scan succeeds. L or M will fail with typical logo sizes.


### What does the excate prop do in react-qrcode imageSettings?

- [ ] A: Creates embossed effect on logo

- [✓] B: Removes QR modules behind logo to prevent scan interference

- [ ] C: Excavates background color around QR code

- [ ] D: Exports QR as SVG file


**Answer:** B

excate=true tells renderer to clear QR data modules in logo area. Without this, logo overlay creates contrast issues that degrade scanning.


### Which barcode format is appropriate for retail product labeling?

- [ ] A: CODE128

- [✓] B: EAN-13

- [ ] C: CODE39

- [ ] D: DataMatrix


**Answer:** B

EAN-13 is the international retail product barcode standard. CODE128 is general alphanumeric. CODE39 is logistics. DataMatrix is for small electronics.


### Why use virtual scrolling for batch QR code generation?

- [ ] A: Virtual scrolling increases QR generation speed

- [✓] B: Prevents DOM thrashing by only rendering visible QR codes

- [ ] C: Required for jsbarcode to work in batches

- [ ] D: Virtual scrolling enables PNG export


**Answer:** B

Rendering hundreds of QR/barcode DOM nodes simultaneously causes layout thrashing and jank. Virtual scroll renders only visible items, recycling DOM nodes.


### How does the React 19 ref-as-prop pattern enable QR export to PNG?

- [ ] A: Ref holds QR value as string

- [✓] B: Ref provides access to canvas element for toDataURL/toBlob calls

- [ ] C: Ref triggers automatic download on mount

- [ ] D: Ref stores QR SVG source


**Answer:** B

Canvas ref via ref-as-prop gives imperative access to underlying <canvas>. Call canvas.toDataURL('image/png') or canvas.toBlob() to trigger PNG download.


### What is the advantage of using React 19 Server Components for QR codes?

- [ ] A: Faster client-side rendering

- [✓] B: Zero JS shipped to client — QR rendered to SVG string at build/request time

- [ ] C: Higher error correction available on server

- [ ] D: Server can generate animated QR codes


**Answer:** B

Server Components pre-render QR to SVG string deterministically. No QR library JS sent to client. Wrap in Suspense for streaming delivery.


### Which jsbarcode format supports full ASCII character set?

- [ ] A: EAN-13

- [ ] B: UPC-A

- [✓] C: CODE128

- [ ] D: ITF


**Answer:** C

CODE128 supports full ASCII character set (alphanumeric + symbols) with variable length. EAN-13/UPC-A are fixed-length numeric. ITF is numeric only.


### When would you prefer react-qrcode over jsbarcode for generating QR codes?

- [ ] A: Always — react-qrcode supports all barcode formats

- [✓] B: For QR codes specifically — better error correction, customization, and React integration

- [ ] C: jsbarcode cannot generate QR codes

- [ ] D: They both generate identical QR output


**Answer:** B

react-qrcode specializes in QR codes with better customization, error correction levels, and React component API. jsbarcode supports QR but is focused on linear barcodes.


### What is the correct approach for high-resolution QR export suitable for print?

- [ ] A: Use QRCodeSVG at large size

- [✓] B: Scale canvas element using drawImage with resolution multiplier before toDataURL

- [ ] C: Increase size prop on QRCodeCanvas

- [ ] D: Export as JPEG for smaller file size


**Answer:** B

Screen canvas resolution is limited. For print, draw canvas to offscreen canvas at 4x scale via drawImage with scale transform, then export via toDataURL at quality 1.


---

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

## Quiz: 34-resizable-panels


### What are the three core components of react-resizable-panels?

- [ ] A: Splitter, Pane, Divider

- [✓] B: PanelGroup, Panel, PanelResizeHandle

- [ ] C: Container, Section, Handle

- [ ] D: Row, Column, Gutter


**Answer:** B

PanelGroup wraps the layout (direction). Panel defines resizable regions with min/max/collapse. PanelResizeHandle is the draggable separator between panels.


### What is the difference between controlled and uncontrolled Panel?

- [✓] A: Controlled uses size prop with onLayout; uncontrolled uses defaultSize

- [ ] B: Controlled panels are not resizable by users

- [ ] C: Uncontrolled panels require minSize prop

- [ ] D: No difference — they are aliases


**Answer:** A

Controlled mode: parent manages sizes via size prop and receives updates via onLayout. Uncontrolled mode: panel manages own size via defaultSize without external state.


### What happens if panel sizes total exceeds 100%?

- [ ] A: PanelGroup throws error

- [✓] B: Sizes are normalized proportionally to sum to 100%

- [ ] C: Last panel is clipped

- [ ] D: Overflow scrollbar appears


**Answer:** B

PanelGroup auto-normalizes sizes. If panels sum > 100%, each scales down proportionally. Use onLayout output (always normalized) for persistence.


### How to persist panel layout across sessions?

- [ ] A: PanelGroup auto-saves to localStorage

- [✓] B: Use onLayout callback to save sizes array to localStorage; restore via size prop

- [ ] C: Panels persist automatically via React state

- [ ] D: Store panel refs in global context


**Answer:** B

onLayout fires number[] of percentage sizes. Save to localStorage. On mount, read saved array and pass as size prop to each Panel in controlled mode.


### Why use useTransition when persisting panel layout to localStorage?

- [ ] A: Required for localStorage write permission

- [✓] B: Debounces high-frequency onLayout calls during drag, preventing main thread blocking

- [ ] C: Transition enables undo of layout changes

- [ ] D: Layout persistence is async by default


**Answer:** B

onLayout fires during every pixel of drag at high frequency. useTransition marks localStorage write as low priority, keeping resize responsive.


### How are Suspense boundaries used with resizable panels?

- [ ] A: Suspense wraps PanelGroup for loading state

- [✓] B: Each Panel wraps its content in Suspense for lazy-loaded panel content

- [ ] C: PanelResizeHandle supports Suspense for resize animations

- [ ] D: Suspense replaces PanelResizeHandle


**Answer:** B

Each Panel wraps its content in <Suspense> so lazy-loaded panel sections stream independently. One panel's loading state does not block adjacent panels.


### What keyboard keys resize panels by default?

- [ ] A: Tab and Shift+Tab

- [✓] B: Arrow keys (left/right/up/down), Home/End, Enter

- [ ] C: Space and Escape

- [ ] D: Page Up and Page Down


**Answer:** B

Arrow keys adjust size incrementally. Home/End minimize/maximize panel. Enter toggles collapse. Enabled without extra configuration.


### How to create a collapsible sidebar that hides completely?

- [✓] A: Set collapsible=true and collapsedSize=0 on Panel

- [ ] B: Use visibility:hidden CSS class

- [ ] C: Set minSize=0 on Panel

- [ ] D: Wrap sidebar in conditional render


**Answer:** A

collapsible=true enables collapse. collapsedSize=0 hides panel completely. onCollapse/onExpand callbacks notify parent of state change.


### How does RTL support work in react-resizable-panels?

- [ ] A: Must set document.dir manually

- [✓] B: dir='rtl' prop on PanelGroup reverses handle resize direction

- [ ] C: CSS direction property on parent element

- [ ] D: Auto-detected from HTML lang attribute


**Answer:** B

dir='rtl' on PanelGroup reverses resize behavior — dragging handle left increases right panel. Arrow keys also reverse accordingly.


### How to programmatically trigger panel resize via React 19 ref?

- [✓] A: Panels expose resize(percentage) and collapse()/expand() methods on ref

- [ ] B: Set size prop to new value — ref not needed for imperative control

- [ ] C: Dispatch custom DOM event on panel element

- [ ] D: Call panelRef.current.style.flex property


**Answer:** A

Panels expose imperative API via ref: resize(percentage), collapse(), expand(). Pass ref as prop (React 19 pattern) for parent-controlled imperative operations.


---

# Module 35: Color Picker — react-colorful

Est. study time: 1h
Language: en

## Learning Objectives
- Integrate react-colorful as lightweight color picker (3KB, zero deps)
- Handle color models: hex, HSL, HSV, RGB
- Style picker via CSS custom properties (--r, --g, --b, --h, --s, --l)
- Build controlled and uncontrolled color picker wrappers
- Implement keyboard-accessible color selection
- Use React 19 Server Components with Client boundary for picker
- Apply React Compiler optimization for onChange handlers

---

## Core Content

### react-colorful Architecture

react-colorful is tiny color picker (3KB gzipped, zero dependencies). Ships as uncontrolled component:

```typescript
import { HexColorPicker } from 'react-colorful'

function Picker() {
  const [color, setColor] = useState('#aabbcc')
  return <HexColorPicker color={color} onChange={setColor} />
}
```

Available picker variants by color model:

| Component | Model | Output |
|-----------|-------|--------|
| `HexColorPicker` | Hex | `#rrggbb` |
| `HexAlphaColorPicker` | Hex + Alpha | `#rrggbbaa` |
| `HslColorPicker` | HSL | `{ h, s, l }` |
| `HslStringColorPicker` | HSL | `hsl(h, s%, l%)` |
| `HsvColorPicker` | HSV | `{ h, s, v }` |
| `HsvStringColorPicker` | HSV | `hsv(h, s%, v%)` |
| `RgbColorPicker` | RGB | `{ r, g, b }` |
| `RgbStringColorPicker` | RGB | `rgb(r, g, b)` |
| `RgbaStringColorPicker` | RGB + Alpha | `rgba(r, g, b, a)` |

### Controlled vs Uncontrolled

Uncontrolled (recommended for simple cases):

```typescript
<HexColorPicker color="#3366ff" onChange={setColor} />
```

Controlled via `color` prop:

```typescript
<HexColorPicker
  color={storedColor ?? '#000000'}
  onChange={(hex) => {
    setStoredColor(hex)
    localStorage.setItem('theme', hex)
  }}
/>
```

### Custom Styling with CSS Variables

react-colorful exposes CSS custom properties for theming:

```typescript
// CSS
.custom-picker {
  --r: 51;
  --g: 102;
  --b: 255;
  --h: 220;
  --s: 100;
  --l: 60;
  width: 200px !important;
  height: 200px !important;
}

.custom-picker .react-colorful__saturation {
  border-radius: 8px 8px 0 0;
}

.custom-picker .react-colorful__hue {
  border-radius: 0 0 8px 8px;
}
```

```typescript
<HexColorPicker className="custom-picker" color={color} onChange={setColor} />
```

Available CSS variables:

| Variable | Type | Description |
|----------|------|-------------|
| `--r`, `--g`, `--b` | 0-255 | Current RGB values |
| `--h` | 0-360 | Current hue |
| `--s`, `--l` | 0-100 | Current saturation/lightness |
| `--a` | 0-1 | Current alpha |

Custom sizing:

```typescript
<HexColorPicker style={{ width: 300, height: 300 }} />
```

### Accessibility

react-colorful supports keyboard interaction:

- Arrow keys adjust hue/saturation
- Tab between saturation and hue sliders
- ARIA labels on interactive elements

Wrap with labeled container:

```typescript
<label>
  Background Color
  <HexColorPicker
    color={bgColor}
    onChange={setBgColor}
    aria-label="Background color picker"
  />
</label>
```

### Color Format Conversion

react-colorful does not include conversion utilities — use small helpers:

```typescript
// Hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

// RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}

// Hex to HSL (standard conversion)
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex)
  const r1 = r / 255, g1 = g / 255, b1 = b / 255
  const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1)
  let h = 0, s = 0, l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r1: h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6; break
      case g1: h = ((b1 - r1) / d + 2) / 6; break
      case b1: h = ((r1 - g1) / d + 4) / 6; break
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

// Contrast ratio for accessibility
function getContrastRatio(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? 1 : 21 // simplified
}
```

### Think: React Compiler with onChange Handlers

Color picker fires `onChange` on every hue/saturation movement (many times per second during drag). React Compiler auto-memoizes callbacks:

```typescript
function ColorPickerWithCompiler() {
  const [color, setColor] = useState('#663399')

  // Compiler auto-memoizes — no useCallback needed
  return (
    <HexColorPicker
      color={color}
      onChange={setColor}
    />
  )
}
```

Without Compiler, wrap `setColor` in `useCallback` or use `useMemo` for color values derived from state.

---

### Why This Matters

Color pickers appear in design tools, theme editors, settings panels, and product customization UIs. react-colorful offers best trade-off: tiny bundle (3KB), accessible, themeable via CSS variables, supports all major color models. No dependencies means no version conflicts.

Wrapper pattern standardizes: which color model app uses, output format (hex vs RGB object), preset colors, and accessibility labels. Single component change if picker needs replacement later.

---

### Common Questions

**Q: Can I use react-colorful in a Server Component?**
A: No — picker requires browser APIs (pointer events, DOM measurements). Use Client boundary (`'use client'`) at wrapper component. Server Component can read initial color from database.

**Q: How to get real-time RGB values while user drags?**
A: Use `RgbColorPicker` instead of hex variant, or convert hex to RGB via `hexToRgb` utility inside `onChange`.

**Q: Does it support color alpha/opacity?**
A: Yes — `HexAlphaColorPicker` and `RgbaStringColorPicker` include alpha channel. Set initial color with alpha: `#3366ff80`.

---

## Examples

### Example 1: Color Picker Wrapper with Hex/RGB Output

```typescript
'use client'

import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'

type ColorFormat = 'hex' | 'rgb'

type Props = {
  initialColor?: string
  format?: ColorFormat
  onChange?: (color: string) => void
}

export function ColorPicker({
  initialColor = '#3366ff',
  format = 'hex',
  onChange,
}: Props) {
  const [color, setColor] = useState(initialColor)

  function handleChange(hex: string) {
    setColor(hex)
    const output = format === 'rgb'
      ? hexToRgb(hex)
      : hex
    onChange?.(output)
  }

  const rgb = hexToRgb(color)

  return (
    <div>
      <HexColorPicker color={color} onChange={handleChange} />
      <div className="color-info">
        <div className="color-swatch" style={{ backgroundColor: color }} />
        <div>Hex: {color}</div>
        <div>RGB: {rgb.r}, {rgb.g}, {rgb.b}</div>
      </div>
    </div>
  )
}
```

### Example 2: Theme Color Picker with Presets

```typescript
'use client'

import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'

const PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
]

type Props = {
  value: string
  onChange: (color: string) => void
}

export function ThemeColorPicker({ value, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<'picker' | 'presets'>('presets')

  return (
    <div>
      <div className="tab-bar">
        <button
          onClick={() => setActiveTab('presets')}
          aria-pressed={activeTab === 'presets'}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab('picker')}
          aria-pressed={activeTab === 'picker'}
        >
          Custom
        </button>
      </div>

      {activeTab === 'presets' ? (
        <div className="preset-grid">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              className="preset-swatch"
              style={{ backgroundColor: preset }}
              onClick={() => onChange(preset)}
              aria-label={preset}
              aria-pressed={value === preset}
            />
          ))}
        </div>
      ) : (
        <HexColorPicker color={value} onChange={onChange} />
      )}
    </div>
  )
}
```

### Example 3: Color Format Conversion Utilities

```typescript
// Color utility module — no dependencies

export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const r1 = r / 255, g1 = g / 255, b1 = b / 255
  const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r1: h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) * 60; break
      case g1: h = ((b1 - r1) / d + 2) * 60; break
      case b1: h = ((r1 - g1) / d + 4) * 60; break
    }
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex))
}
```

---

## Key Takeaways
- react-colorful: 3KB, zero deps, multiple color model pickers
- CSS custom properties (--r, --g, --b, --h, --s, --l) for seamless theming
- Controlled via `color` + `onChange`; uncontrolled with `defaultColor`
- Picker is Client-only — wrap with `'use client'`, Server Components read initial value
- React Compiler auto-memoizes onChange handlers for drag performance
- Convert between color models with small utility functions (no lib needed)
- Keyboard accessible: arrow keys, Tab, ARIA labels
- Preset grid for common colors plus custom picker for fine control

## Common Misconception

"**Color picker library must be large to support all color models.**"

react-colorful proves lightweight picker can support Hex, HSL, HSV, RGB, and alpha variants all in 3KB gzipped. The library avoids runtime conversion dependencies — pickers directly output the model you choose. Each variant is separate import, so tree-shaking removes unused ones.

---

## Feynman Explain
(Explain color picker to someone who uses paint palette. react-colorful = palette with hue strip on bottom and saturation/brightness square on top. CSS variables = palette follows your theme colors automatically. Presets = pre-mixed paint blobs. Hex code = exact recipe for color. RGB = how much red, green, blue light.)

---

## Reframe
(Color pickers are deceptively complex — HSV/HSL conversion, accessibility, touch/fine motor control, theme integration. react-colorful handles most of this in 3KB. Only consider alternatives if you need eyedropper tool, color harmony rules, or gradient picking.)

---

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 35-color-picker`

## Quiz: 35-color-picker


### What is the bundle size and dependency count of react-colorful?

- [ ] A: 10KB, depends on color-convert

- [✓] B: 3KB gzipped, zero dependencies

- [ ] C: 15KB, depends on react-color

- [ ] D: 1KB, depends on tinycolor2


**Answer:** B

react-colorful is 3KB gzipped with zero external dependencies. This makes it the smallest React color picker library.


### Which component would you use for picking colors with alpha channel support?

- [ ] A: HexColorPicker

- [✓] B: HexAlphaColorPicker or RgbaStringColorPicker

- [ ] C: HslColorPicker

- [ ] D: RgbColorPicker


**Answer:** B

HexAlphaColorPicker outputs #rrggbbaa. RgbaStringColorPicker outputs rgba(r, g, b, a). Standard HexColorPicker does not support alpha.


### How does react-colorful support custom theming?

- [ ] A: Styling prop with CSS-in-JS objects

- [✓] B: CSS custom properties (--r, --g, --b, --h, --s, --l) reflecting current color

- [ ] C: Inline style overrides via defaultStyles prop

- [ ] D: Theme context provider wrapper


**Answer:** B

react-colorful exposes CSS variables (--r, --g, --b, --h, --s, --l) that update live with current color. Use them in CSS selectors on picker class.


### Why must react-colorful components have a Client boundary ('use client')?

- [ ] A: Library has not been updated for React 19

- [✓] B: Picker requires browser APIs (pointer events, DOM measurements) for drag interaction

- [ ] C: Server Components cannot import any npm packages

- [ ] D: CSS variables only work in browser


**Answer:** B

Color picker needs pointer/mouse/touch events and DOM element measurements for saturation square and hue slider interaction. Server Components have no browser API access.


### What keyboard interactions does react-colorful support?

- [ ] A: Only mouse and touch input

- [✓] B: Arrow keys for hue and saturation adjustment, Tab between controls

- [ ] C: Number input fields for exact color values

- [ ] D: Voice commands


**Answer:** B

Arrow keys adjust hue (left/right) and saturation (up/down). Tab moves focus between saturation area and hue slider. ARIA labels on interactive elements.


### How does React Compiler optimize color picker onChange handlers?

- [ ] A: Compiler skips re-render for all color changes

- [✓] B: Auto-memoizes onChange callback, preventing unnecessary re-renders during drag

- [ ] C: Compiler moves color calculations to Web Worker

- [ ] D: Compiler debounces onChange calls


**Answer:** B

onChange fires many times per second during color picker drag. React Compiler automatically memoizes the handler and derived values, reducing re-render work.


### Which approach outputs color as RGB object from react-colorful?

- [ ] A: HexColorPicker with hexToRgb conversion

- [ ] B: RgbColorPicker component outputs { r, g, b }

- [ ] C: HslColorPicker with hslToRgb conversion

- [✓] D: All of the above


**Answer:** D

RgbColorPicker directly outputs { r, g, b }. HexColorPicker output can be converted via hexToRgb utility. HslColorPicker output can be converted via hslToRgb.


### What design pattern is illustrated by the ThemeColorPicker with presets?

- [ ] A: Facade — simplify complex color model API

- [✓] B: Wrapper — compose preset grid and custom picker with unified interface

- [ ] C: Adapter — convert hex to RGB behind the scenes

- [ ] D: Strategy — swap picker variant at runtime


**Answer:** B

Wrapper composes preset selection and custom picker behind single ThemeColorPicker component with consistent value/onChange API. Consumers do not manage tab state.


### What is the react-colorful approach to color format conversion?

- [ ] A: Built-in convert() method on picker instance

- [✓] B: Library does not include conversion utilities — use small custom helpers

- [ ] C: Conversion via external color-convert peer dependency

- [ ] D: Automatic conversion based on output component variant


**Answer:** B

react-colorful provides pickers for each format but no cross-format conversion. Write small hexToRgb, rgbToHsl helpers (~10 lines each) when needed.


### When should you choose react-colorful over a native input type='color'?

- [ ] A: Always — react-colorful is always better

- [✓] B: When you need custom styling, preset colors, alpha channel, or exact color model control

- [ ] C: Only for mobile applications

- [ ] D: When bundle size is not a concern


**Answer:** B

Native input type='color' is 0KB but limited: no alpha, no HSL/HSV, no custom styling, small palette preview. react-colorful excels when app needs branded picker or specific color model.


---

# Module 36: Clipboard Utilities

Est. study time: 1h
Language: en

## Learning Objectives
- Use navigator.clipboard API for text and rich content copy
- Handle Permissions API for clipboard-read and clipboard-write
- Implement paste event sanitization for Excel/Word content
- Build custom useCopyToClipboard hook with React 19 patterns
- Understand clipboard security constraints (HTTPS, user gesture)
- Manage Client Component boundary in React 19 Server Components
---

## Core Content

### navigator.clipboard API

Modern browsers expose asynchronous clipboard access via `navigator.clipboard`. Two tiers: text-only and rich content.

```
// text write
await navigator.clipboard.writeText("text");

// text read
const text = await navigator.clipboard.readText();

// rich content write
await navigator.clipboard.write([
  new ClipboardItem({
    "text/plain": new Blob(["plain"], { type: "text/plain" }),
    "text/html": new Blob(["<b>rich</b>"], { type: "text/html" }),
  }),
]);

// rich content read
const items = await navigator.clipboard.read();
for (const item of items) {
  for (const type of item.types) {
    const blob = await item.getType(type);
  }
}
```

Async clipboard requires a secure context (HTTPS or localhost) and must be triggered by user gesture (click, keydown).

### Permissions API

Check availability before reading clipboard:

```typescript
const permission = await navigator.permissions.query({
  // @ts-expect-error clipboard-read experimental in some browsers
  name: "clipboard-read",
});
if (permission.state === "granted") {
  // read allowed
} else if (permission.state === "prompt") {
  // triggers browser prompt
}
```

clipboard-write permission is automatically granted in secure contexts. clipboard-read must be requested.

### Polyfill Strategy for Legacy Browsers

```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  // fallback: execCommand (deprecated but works)
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
}
```

### Rich Content Copy

Copy structured data (e.g., table from data grid) as HTML:

```typescript
interface GridRow {
  cells: string[];
}

function buildHtmlTable(rows: GridRow[]): string {
  const header = rows[0].cells.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = rows.slice(1).map(
    (r) => `<tr>${r.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
  ).join("");
  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function copyGrid(rows: GridRow[]): Promise<void> {
  const html = buildHtmlTable(rows);
  const plain = rows.map((r) => r.cells.join("\t")).join("\n");
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": new Blob([plain], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    }),
  ]);
}
```

### Paste Event Handling

```typescript
function onPaste(event: ClipboardEvent): void {
  event.preventDefault();
  const items = event.clipboardData?.items;
  if (!items) return;

  let html = "";
  let plain = "";

  for (const item of items) {
    if (item.type === "text/html") {
      item.getAsString((s) => { html = s; });
    } else if (item.type === "text/plain") {
      item.getAsString((s) => { plain = s; });
    }
  }
}
```

Paste sanitization strips dangerous HTML from Excel/Word:

```typescript
function sanitizePaste(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const allowed = ["p", "br", "ul", "ol", "li", "strong", "em", "a", "table", "thead", "tbody", "tr", "th", "td"];

  function clean(node: Node): Node {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (!allowed.includes(el.tagName.toLowerCase())) {
        const span = doc.createElement("span");
        while (el.firstChild) span.appendChild(clean(el.firstChild));
        return span;
      }
      if (el.tagName.toLowerCase() === "a") {
        el.setAttribute("href", el.getAttribute("href") || "#");
        el.removeAttribute("style");
      }
      el.removeAttribute("style");
      el.removeAttribute("class");
      Array.from(el.childNodes).forEach((child, _i) => {
        el.replaceChild(clean(child), child);
      });
    }
    return node;
  }

  clean(doc.body);
  return doc.body.innerHTML;
}
```

### Security Constraints

| Constraint | Detail |
|---|---|
| HTTPS required | Async clipboard throws in insecure context |
| User gesture | `click`, `keydown`, `touchstart` handler must initiate |
| Focus required | Document must have focus |
| Permission prompt | `clipboard-read` may show browser prompt |
| Same-origin | `read()` returns only same-origin data |

### React 19: useCopyToClipboard Hook

```typescript
"use client";

import { useCallback, useRef, useState, useTransition } from "react";

interface CopyState {
  copied: boolean;
  error: Error | null;
}

interface UseCopyToClipboardOptions {
  timeout?: number;
}

export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): {
  copy: (text: string) => Promise<void>;
  state: CopyState;
  reset: () => void;
} {
  const { timeout = 2000 } = options;
  const [{ copied, error }, setState] = useState<CopyState>({
    copied: false,
    error: null,
  });
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textarea);
          if (!ok) throw new Error("execCommand copy failed");
        }
        startTransition(() => {
          setState({ copied: true, error: null });
        });
        clearTimer();
        timerRef.current = setTimeout(() => {
          startTransition(() => {
            setState({ copied: false, error: null });
          });
        }, timeout);
      } catch (err) {
        setState({
          copied: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    },
    [clearTimer, timeout, startTransition]
  );

  const reset = useCallback(() => {
    clearTimer();
    setState({ copied: false, error: null });
  }, [clearTimer]);

  return { copy, state: { copied, error }, reset };
}
```

useTransition provides low-priority state update for copy feedback. React Compiler auto-memoizes `copy`, `reset` when compiled.

### React 19: Rich Content Copy Hook

```typescript
"use client";

import { useCallback } from "react";

interface RichClipboardItem {
  html: string;
  plain: string;
}

export function useRichCopy() {
  const copyRich = useCallback(async (item: RichClipboardItem) => {
    const clipboardItem = new ClipboardItem({
      "text/plain": new Blob([item.plain], { type: "text/plain" }),
      "text/html": new Blob([item.html], { type: "text/html" }),
    });
    await navigator.clipboard.write([clipboardItem]);
  }, []);

  return { copyRich };
}
```

### React 19 Server Components

Clipboard API = browser-only. Component must use "use client":

```typescript
// CopyButton.tsx — Client Component
"use client";

import { useCopyToClipboard } from "./useCopyToClipboard";

export function CopyButton({ value }: { value: string }) {
  const { copy, state } = useCopyToClipboard();

  return (
    <button
      className="inline-button"
      onClick={() => copy(value)}
    >
      {state.copied ? "Copied!" : "Copy"}
    </button>
  );
}
```

```typescript
// CodeBlock.tsx — Server Component
import { CopyButton } from "./CopyButton";

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre>
      <code>{code}</code>
      <CopyButton value={code} />
    </pre>
  );
}
```

Server Component renders static code; CopyButton is client island. React Compiler compiles CopyButton's callback once, no re-render overhead.

---

### Why This Matters

Clipboard is fundamental interaction. Users expect copy/paste to work like native apps. Rich content copy differentiates professional data tools. Paste sanitization prevents XSS and formatting corruption. React 19 Server Components force understanding of client boundary for browser APIs.

---

### Common Questions

**Q: Why does navigator.clipboard.read() return empty?**
A: Requires "clipboard-read" permission which most browsers prompt for. Also requires focused document and user gesture.

**Q: How to detect if clipboard API is available?**
A: Check `navigator.clipboard?.writeText`. For old browsers, check `document.execCommand("copy")` (deprecated but functional).

**Q: Does paste work in Server Components?**
A: No. Paste events are browser DOM events. Attach handler in Client Component with `onPaste` prop.

---

## Examples

### Example 1: Copy Table from Data Grid

```typescript
// DataGrid.tsx (Client Component)
"use client";

import { useCallback } from "react";
import { useRichCopy } from "./useRichCopy";

interface Column {
  key: string;
  header: string;
}

interface DataGridProps {
  columns: Column[];
  rows: Record<string, string>[];
}

function buildTableHtml(columns: Column[], rows: Record<string, string>[]): string {
  const head = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body = rows.map(
    (r) => `<tr>${columns.map((c) => `<td>${escapeHtml(r[c.key] ?? "")}</td>`).join("")}</tr>`
  ).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function buildTablePlain(columns: Column[], rows: Record<string, string>[]): string {
  const head = columns.map((c) => c.header).join("\t");
  const body = rows.map((r) => columns.map((c) => r[c.key] ?? "").join("\t")).join("\n");
  return `${head}\n${body}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function DataGrid({ columns, rows }: DataGridProps) {
  const { copyRich } = useRichCopy();
  const { copy, state } = useCopyToClipboard();

  const handleCopy = useCallback(() => {
    copyRich({
      html: buildTableHtml(columns, rows),
      plain: buildTablePlain(columns, rows),
    });
  }, [columns, rows, copyRich]);

  return (
    <div>
      <button className="inline-button" onClick={handleCopy}>
        {state.copied ? "Table Copied" : "Copy Table"}
      </button>
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Example 2: Paste Sanitizer for Rich Text Input

```typescript
"use client";

import { useCallback, useState } from "react";

export function RichPasteInput() {
  const [content, setContent] = useState("");

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    const sanitized = sanitizePaste(html || `<p>${escapeHtml(plain)}</p>`);
    setContent((prev) => prev + sanitized);
  }, []);

  const handleCopyPlain = useCallback(() => {
    (async () => {
      await navigator.clipboard.writeText(content);
    })();
  }, [content]);

  return (
    <div>
      <div
        contentEditable
        suppressContentEditableWarning
        onPaste={handlePaste}
        className="rich-editor"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      <button className="inline-button" onClick={handleCopyPlain}>
        Copy Plain
      </button>
    </div>
  );
}
```

---

## Key Takeaways
- navigator.clipboard API requires HTTPS + user gesture
- Rich content copy sends both text/plain and text/html in ClipboardItem
- Paste events need sanitization to strip Word/Excel styles
- Polyfill with execCommand for legacy browser support
- React 19: useClient + useTransition for copy feedback
- Server Components render static content; clipboard hooks live in Client Components
- React Compiler auto-memoizes copy callbacks when enabled

## Common Misconception

"**Paste sanitization only matters for security.**"

Sanitization also prevents layout breaks. Word paste includes inline styles (mso-*, font-family, absolute positioning) that clash with app CSS. Strip styles, keep only semantic HTML tags. Excel paste includes messy table markup with colgroup, col widths — normalize to simple thead/tbody.

## Feynman Explain

Clipboard = shared buffer between apps. navigator.clipboard.writeText puts string in buffer. navigator.clipboard.readText gets string from buffer. For tables, put two formats: plain (tab-separated, pastes into spreadsheet) and HTML (styled table, pastes into Word). Paste event is opposite flow: browser fires event with clipboard data, app reads and sanitizes before inserting.

## Reframe

Clipboard is poor man's data transfer protocol. navigator.clipboard.write is equivalent to writing response in HTTP — you control MIME types (text/plain, text/html). Paste sanitization is input validation for clipboard channel. Rich content copy = serialization format negotiation.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 36-clipboard`

## Quiz: 36-clipboard


### What security requirement must the page satisfy for navigator.clipboard.writeText to work?

- [✓] A: HTTPS or localhost (secure context)

- [ ] B: Page must be loaded over HTTP

- [ ] C: Clipboard API requires no security constraints

- [ ] D: Only works in incognito mode


**Answer:** A

navigator.clipboard API requires a secure context (HTTPS or localhost). Insecure HTTP contexts throw an error.


### Which MIME types should be included when copying rich content (e.g., a table) to clipboard?

- [ ] A: text/plain only

- [✓] B: text/html and text/plain

- [ ] C: application/json and text/plain

- [ ] D: text/html only


**Answer:** B

Rich content copy should include both text/html (formatted, for rich editors) and text/plain (fallback, for plain text targets).


### What is the recommended approach for reading clipboard contents in a secure context?

- [✓] A: navigator.clipboard.readText()

- [ ] B: document.execCommand('paste')

- [ ] C: window.clipboardData.getData('Text')

- [ ] D: ClipboardEvent.clipboardData.getData() on read


**Answer:** A

navigator.clipboard.readText() is the modern async API for reading clipboard text. execCommand is deprecated. clipboardData on events is for paste handling, not programmatic read.


### In React 19, why must clipboard hooks use 'use client'?

- [ ] A: Clipboard API reads are slow and block Server Components

- [✓] B: navigator.clipboard is only available in browser environments, not on the server

- [ ] C: Server Components cannot handle Promises

- [ ] D: Clipboard API requires useState which is not available on server


**Answer:** B

navigator is a browser global. Server Components execute on the server where navigator does not exist. 'use client' marks the boundary.


### What problem does paste sanitization primarily solve beyond security?

- [ ] A: Reduces paste latency by skipping formatting

- [✓] B: Prevents layout corruption from Word/Excel inline styles

- [ ] C: Increases clipboard read speed

- [ ] D: Enables cross-origin clipboard access


**Answer:** B

Word and Excel paste includes absolute positioning, mso-* styles, and colgroup markup that clash with app CSS. Sanitization normalizes to semantic HTML.


### Which React 19 feature is used in the useCopyToClipboard hook for non-urgent state updates (copy feedback)?

- [ ] A: useDeferredValue

- [✓] B: useTransition

- [ ] C: useOptimistic

- [ ] D: useSyncExternalStore


**Answer:** B

useTransition marks the copied state update as low-priority, preventing copy feedback from blocking urgent UI updates like typing.


### What is the legacy fallback for copying text when navigator.clipboard.writeText is unavailable?

- [ ] A: window.copyText()

- [✓] B: document.execCommand('copy') with a hidden textarea

- [ ] C: navigator.clipboard.writeText() is available in all browsers

- [ ] D: ClipboardEvent.clipboardData.setData()


**Answer:** B

document.execCommand('copy') with a textarea.select() is the deprecated but widely supported fallback for legacy browsers.


### What permission status does clipboard-read typically start as in modern browsers?

- [ ] A: granted

- [ ] B: denied

- [✓] C: prompt

- [ ] D: unavailable


**Answer:** C

clipboard-read permission starts as 'prompt' and triggers a browser permission dialog. clipboard-write is auto-granted in secure contexts.


### Which of the following triggers is NOT sufficient for clipboard API access?

- [ ] A: click event handler

- [ ] B: keydown event handler

- [ ] C: touchstart event handler

- [✓] D: DOMContentLoaded event handler


**Answer:** D

Clipboard API requires a user gesture (click, keydown, touchstart). DOMContentLoaded fires automatically without user interaction.


### When the React Compiler is enabled, what happens to the copy callback in useCopyToClipboard?

- [ ] A: It becomes a Server Action automatically

- [✓] B: It is automatically memoized, removing the need for useCallback wrapping

- [ ] C: It is transformed to use execCommand instead of navigator.clipboard

- [ ] D: It is stripped from the bundle because clipboard code is server-only


**Answer:** B

React Compiler auto-memoizes functions and values, so the useCallback wrapper around the copy function is no longer necessary.


---

# Module 37: Hooks Libraries — usehooks-ts

Est. study time: 1.5h
Language: en

## Learning Objectives
- Use usehooks-ts library hooks (useBoolean, useLocalStorage, useMediaQuery, useDebounce, useIntersectionObserver)
- Compare usehooks-ts vs react-use vs @uidotdev/usehooks tradeoffs
- Build custom hook wrapper replacing third-party dependency
- Integrate React 19 useTransition for debounce UX
- Apply React Compiler auto-memoization to custom hooks
- Handle SSR edge cases in browser-only hooks
---

## Core Content

### usehooks-ts Overview

usehooks-ts is a TypeScript-first hooks library with tree-shakeable exports. No dependencies. Each hook is a single file.

```
npm install usehooks-ts
```

Common hooks:

| Hook | Purpose |
|---|---|
| useBoolean | Boolean toggle with actions (setTrue, setFalse, toggle) |
| useEffectOnce | useEffect that fires exactly once |
| useEventListener | Attach event listener with auto-cleanup |
| useLocalStorage | Persist state to localStorage with SSR guard |
| useMediaQuery | Reactive CSS media query match |
| useIntersectionObserver | Observe element visibility |
| useDebounce | Debounce value or callback |
| useThrottle | Throttle value |
| useToggle | Simple boolean toggle (returns [value, toggle]) |

### useBoolean Pattern

```typescript
import { useBoolean } from "usehooks-ts";

export function Accordion({ children }: { children: React.ReactNode }) {
  const { value: isOpen, toggle, setTrue, setFalse } = useBoolean(false);

  return (
    <div>
      <button className="inline-button" onClick={toggle}>
        {isOpen ? "Close" : "Open"}
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  );
}
```

### useLocalStorage with SSR

```typescript
import { useLocalStorage } from "usehooks-ts";

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("theme", "light");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, toggleTheme, setTheme };
}
```

useLocalStorage reads initial value from `window.localStorage` on mount. During SSR, returns default. State syncs bidirectionally: state changes write to localStorage; external localStorage changes (another tab) trigger re-render via `storage` event listener.

### useMediaQuery

```typescript
import { useMediaQuery } from "usehooks-ts";

export function ResponsiveSidebar() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  return <aside>{isDesktop ? <FullSidebar /> : <CollapsedSidebar />}</aside>;
}
```

SSR: returns `false` by default (no window.matchMedia on server). React 19 Server Components render static fallback; client hydration picks up correct value.

### useEventListener

```typescript
import { useEventListener } from "usehooks-ts";

export function useKeyboardShortcut(key: string, handler: () => void) {
  useEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === key) {
      handler();
    }
  });
}
```

In React 19, `useEventListener` accepts `ref` as target parameter:

```typescript
import { useRef } from "react";
import { useEventListener } from "usehooks-ts";

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEventListener("mouseenter", () => console.log("hover"), ref);

  return <div ref={ref}>{children}</div>;
}
```

Target parameter accepts `ref` object (React 19 style), `window`, `document`, or `HTMLElement`.

### useDebounce

```typescript
import { useDebounce } from "usehooks-ts";

export function SearchInput({ onSearch }: { onSearch: (q: string) => void }) {
  const [input, setInput] = useState("");
  const debouncedInput = useDebounce(input, 300);

  useEffect(() => {
    onSearch(debouncedInput);
  }, [debouncedInput, onSearch]);

  return (
    <input
      type="text"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### useIntersectionObserver

```typescript
import { useIntersectionObserver } from "usehooks-ts";

export function LazyImage({ src, alt }: { src: string; alt: string }) {
  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0.1,
  });

  return (
    <div ref={ref} style={{ minHeight: 200 }}>
      {isIntersecting ? (
        <img src={src} alt={alt} />
      ) : (
        <div className="skeleton" />
      )}
    </div>
  );
}
```

### Library Comparison

| Criteria | usehooks-ts | react-use | @uidotdev/usehooks |
|---|---|---|---|
| TypeScript | Full | Partial | Full |
| Bundle size | 0 deps, tree-shakeable | 18+ deps | 0 deps |
| React 19 support | Yes (ref as target) | Partial | Yes |
| SSR handling | Explicit | Mixed | Explicit |
| Maintenance | Active | Slow | Active |
| Hook count | ~40 | ~80 | ~20 |

Tradeoff: react-use has more hooks but heavy bundle. @uidotdev/usehooks is smallest API surface. usehooks-ts balances size and breadth.

### Custom Wrapper: useLocalStorage with Migration

```typescript
"use client";

import { useCallback, useRef } from "react";
import { useLocalStorage } from "usehooks-ts";

interface Schema<T> {
  version: number;
  data: T;
}

interface Migration<T> {
  fromVersion: number;
  migrate: (old: unknown) => T;
}

export function useVersionedLocalStorage<T>(
  key: string,
  initialValue: T,
  migrations: Migration<T>[] = []
) {
  const [raw, setRaw] = useLocalStorage<string>(key, JSON.stringify({
    version: 0,
    data: initialValue,
  } as Schema<T>));

  const parseValue = useCallback((): T => {
    try {
      const parsed: Schema<unknown> = JSON.parse(raw);
      let current = parsed;
      const sorted = [...migrations].sort((a, b) => a.fromVersion - b.fromVersion);
      for (const m of sorted) {
        if (current.version === m.fromVersion) {
          current = { version: m.fromVersion + 1, data: m.migrate(current.data) };
        }
      }
      return current.data as T;
    } catch {
      return initialValue;
    }
  }, [raw, migrations, initialValue]);

  const [value, setValue] = useState<T>(parseValue);
  const prevRawRef = useRef(raw);

  if (raw !== prevRawRef.current) {
    prevRawRef.current = raw;
    setValue(parseValue());
  }

  const setVersionedValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof newValue === "function"
          ? (newValue as (prev: T) => T)(prev)
          : newValue;
        const schema: Schema<T> = {
          version: migrations.length,
          data: resolved,
        };
        setRaw(JSON.stringify(schema));
        return resolved;
      });
    },
    [setRaw, migrations]
  );

  return [value, setVersionedValue] as const;
}
```

### Custom Wrapper: useMediaQuery with SSR

```typescript
"use client";

import { useEffect, useState } from "react";

interface UseMediaQueryOptions {
  defaultValue?: boolean;
  initializeWithValue?: boolean;
}

export function useSafeMediaQuery(
  query: string,
  options: UseMediaQueryOptions = {}
): boolean {
  const { defaultValue = false, initializeWithValue = true } = options;
  const [matches, setMatches] = useState(
    initializeWithValue ? defaultValue : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
```

### React 19: useDebounce with useTransition

```typescript
"use client";

import { useState, useTransition, useCallback } from "react";
import { useDebounce } from "usehooks-ts";

interface UseDebouncedSearchOptions {
  debounceMs?: number;
}

export function useDebouncedSearch(
  onSearch: (query: string) => Promise<void>,
  options: UseDebouncedSearchOptions = {}
) {
  const { debounceMs = 300 } = options;
  const [input, setInput] = useState("");
  const debouncedInput = useDebounce(input, debounceMs);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!debouncedInput) return;
    startTransition(async () => {
      try {
        setError(null);
        await onSearch(debouncedInput);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }, [debouncedInput, onSearch, startTransition]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    []
  );

  return {
    input,
    handleChange,
    isPending,
    error,
    debouncedValue: debouncedInput,
  };
}
```

### React Compiler with Custom Hooks

React Compiler auto-memoizes all returned values and callbacks from custom hooks:

```typescript
"use client";

// No useCallback needed — React Compiler memoizes automatically
export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);

  const toggle = () => setOn((prev) => !prev);
  const setTrue = () => setOn(true);
  const setFalse = () => setOn(false);

  return { on, toggle, setTrue, setFalse };
}
```

Without React Compiler, each render creates new function references. With compiler, all closures are memoized, and downstream `memo` wrappers skip re-renders.

---

### Why This Matters

Hooks libraries eliminate boilerplate. Every app needs debounce, localStorage, media query, event listener. Standardizing on one library (usehooks-ts) vs building from scratch reduces maintenance. Understanding implementation lets you swap libraries or write custom wrappers when third-party dependency is heavy or abandoned.

---

### Common Questions

**Q: When should I build custom hook instead of using library?**
A: When you need versioned schema migration (useLocalStorage), SSR-specific behavior (useMediaQuery), or wrapper around third-party hook (useDebounce with useTransition).

**Q: Does usehooks-ts work in React 19?**
A: Yes. useEventListener accepts ref as target. All hooks compatible with Server Components when wrapped in "use client".

**Q: useDebounce vs lodash debounce?**
A: useDebounce is React-aware (re-triggers on value change). lodash debounce wraps function calls. useDebounce = debounced value; lodash = debounced function.

---

## Examples

### Example 1: Search Input with Debounce + useTransition

```typescript
"use client";

import { useDebouncedSearch } from "./useDebouncedSearch";

export function SearchPage() {
  const { input, handleChange, isPending, error } = useDebouncedSearch(
    async (q) => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    }
  );

  return (
    <div>
      <div className="search-container">
        <input
          type="text"
          value={input}
          onChange={handleChange}
          placeholder="Search..."
          className="search-input"
        />
        {isPending && <span className="spinner" />}
      </div>
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

### Example 2: Lazy Image Gallery with IntersectionObserver

```typescript
"use client";

import { useIntersectionObserver } from "usehooks-ts";

const IMAGES = [
  "https://picsum.photos/id/1/400/300",
  "https://picsum.photos/id/10/400/300",
  "https://picsum.photos/id/100/400/300",
];

function LazyGalleryImage({ src }: { src: string }) {
  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: "100px",
  });

  return (
    <div ref={ref} className="image-wrapper">
      {isIntersecting ? (
        <img src={src} alt="" loading="lazy" />
      ) : (
        <div className="skeleton" style={{ width: 400, height: 300 }} />
      )}
    </div>
  );
}

export function ImageGallery() {
  return (
    <div className="gallery-grid">
      {IMAGES.map((src, i) => (
        <LazyGalleryImage key={i} src={src} />
      ))}
    </div>
  );
}
```

### Example 3: Theme Toggle with useLocalStorage

```typescript
"use client";

import { useLocalStorage } from "usehooks-ts";

type Theme = "light" | "dark";

export function useThemeToggle() {
  const [theme, setTheme] = useLocalStorage<Theme>("app-theme", "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, toggle };
}

export function ThemeToggle() {
  const { theme, toggle } = useThemeToggle();

  return (
    <button className="inline-button" onClick={toggle}>
      {theme === "light" ? "Dark Mode" : "Light Mode"}
    </button>
  );
}
```

---

## Key Takeaways
- usehooks-ts: TypeScript-first, tree-shakeable, 0 deps
- useLocalStorage handles SSR by returning default, syncs cross-tab
- useMediaQuery returns false during SSR; hydrate on client
- useDebounce debounces value (not function), pairs with useTransition
- Custom wrappers add migration, compression, SSR control
- React 19: useEventListener accepts ref as target
- React Compiler auto-memoizes custom hook return values
- Prefer usehooks-ts over react-use for bundle size and React 19 compat

## Common Misconception

"**useDebounce from usehooks-ts is the same as lodash.debounce.**"

useDebounce returns a debounced value — it changes after delay. lodash.debounce returns a debounced function — it delays invocation. useDebounce is declarative (value changes → effect fires). lodash.debounce is imperative (call wrapped function → delayed exec). Use useDebounce for search input values; use lodash.debounce for resize handler.

## Feynman Explain

Hooks = reusable state logic. useBoolean = useState(false) + setTrue/setFalse/toggle. useLocalStorage = useState but reads/writes localStorage under hook. useDebounce = useState that waits before updating value (stops jitter). useIntersectionObserver = ref + IntersectionObserver + state. Each hook isolates one browser API or UI pattern into a function you call in any component.

## Reframe

Hooks libraries are React's standard library. Just as Python ships batteries-included (os, json, re), hooks libraries ship common state patterns. Writing custom hook wrapper = subclassing standard lib to add app-specific behavior (migration, compression, analytics). Replacing third-party hook with custom version = reducing external dependency surface.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 37-hooks-libraries`

## Quiz: 37-hooks-libraries


### Which of the following best describes usehooks-ts compared to react-use?

- [ ] A: Larger bundle but more hooks

- [✓] B: Zero dependencies, tree-shakeable, TypeScript-first

- [ ] C: Only provides React 18 compatible hooks

- [ ] D: Requires lodash as a peer dependency


**Answer:** B

usehooks-ts has zero external dependencies, each hook is tree-shakeable, and the entire library is written in TypeScript.


### What does useLocalStorage return during SSR (server-side rendering)?

- [ ] A: Throws an error because localStorage is not available

- [✓] B: The default value passed to the hook

- [ ] C: undefined

- [ ] D: Reads from a server-side cookie store


**Answer:** B

useLocalStorage returns the initial default value during SSR because window.localStorage does not exist on the server.


### In React 19, what types can useEventListener accept as its target parameter?

- [ ] A: window only

- [✓] B: ref object, window, document, or HTMLElement

- [ ] C: string CSS selector only

- [ ] D: Server Component boundary only


**Answer:** B

React 19 allows ref as prop, so useEventListener accepts ref objects directly, along with window, document, and HTMLElement.


### What is the key difference between useDebounce from usehooks-ts and lodash.debounce?

- [ ] A: They are functionally identical

- [✓] B: useDebounce returns a debounced value; lodash.debounce returns a debounced function

- [ ] C: useDebounce returns a debounced function; lodash.debounce returns a debounced value

- [ ] D: useDebounce uses setTimeout; lodash.debounce uses requestAnimationFrame


**Answer:** B

useDebounce is declarative: it returns the value after a delay. lodash.debounce is imperative: it wraps a function to delay invocations.


### When useMediaQuery returns false during SSR, what technique ensures the correct value is shown post-hydration?

- [ ] A: Server Components read navigator.userAgent

- [✓] B: Client hydration runs useEffect which fires the matchMedia listener and updates state

- [ ] C: useMediaQuery uses synchronous XHR to check viewport

- [ ] D: A cookie stores the viewport width between requests


**Answer:** B

useMediaQuery initializes with default (false), then useEffect runs on client to call window.matchMedia and set the correct value.


### Which React 19 API pairs naturally with useDebounce for search input to keep UI responsive?

- [ ] A: useDeferredValue

- [✓] B: useTransition

- [ ] C: useOptimistic

- [ ] D: useFormStatus


**Answer:** B

useTransition wraps the async search call as low-priority, keeping the input responsive while search results load.


### What advantage does React Compiler provide for custom hooks?

- [ ] A: Eliminates the need for useEffect

- [✓] B: Auto-memoizes returned callbacks and values, removing useCallback/useMemo wrappers

- [ ] C: Converts custom hooks to Server Actions

- [ ] D: Adds runtime type checking to hook parameters


**Answer:** B

React Compiler auto-memoizes all closures and values returned from hooks, making explicit useCallback/useMemo wrappers unnecessary.


### In a custom useLocalStorage wrapper with versioned schema migration, why is raw string comparison needed?

- [✓] A: To detect cross-tab storage changes and re-parse with current migrations

- [ ] B: To compress the stored JSON for performance

- [ ] C: To encrypt the localStorage value

- [ ] D: To check if the user has disabled cookies


**Answer:** A

Comparing raw string detects changes made in other tabs via the storage event, triggering re-parsing with the latest migration chain.


### Which hook would you use to detect when a DOM element becomes visible for lazy loading?

- [ ] A: useMediaQuery

- [ ] B: useEventListener

- [✓] C: useIntersectionObserver

- [ ] D: useResizeObserver


**Answer:** C

useIntersectionObserver wraps IntersectionObserver API to report when an element enters the viewport (or a specified root margin).


### Why would you wrap useMediaQuery in a custom hook with initializeWithValue option?

- [ ] A: To improve SSR performance by skipping initial render

- [✓] B: To skip the initial window.matchMedia call on first render to avoid hydration mismatch

- [ ] C: To add analytics tracking for viewport changes

- [ ] D: To memoize the query string


**Answer:** B

Setting initializeWithValue: false returns false on first render, then useEffect sets real value. This avoids hydration mismatch when server-rendered HTML has a different initial value than client.


---

# Module 38: AI Streaming — Vercel AI SDK

Est. study time: 2h
Language: en

## Learning Objectives
- Integrate Vercel AI SDK useChat hook for streaming conversation
- Implement Server Action chat endpoint with streamText
- Build generative UI pattern where tool calls render React components
- Handle streaming Markdown rendering with react-markdown
- Manage abort, regenerate, and error states
- Apply React 19 patterns: useActionState, Suspense, use()
---

## Core Content

### Vercel AI SDK Architecture

Vercel AI SDK layers:

```
React Component
  └─ useChat / useCompletion / useAssistant hook
       └─ AI SDK Core (streamText, generateText)
            └─ Provider SDK (OpenAI, Anthropic, Google, etc.)
```

Three main hooks:

| Hook | Use case |
|---|---|
| useChat | Multi-turn chat with message history |
| useCompletion | Single-turn text completion |
| useAssistant | OpenAI Assistants API |

```
npm install ai @ai-sdk/openai
```

### useChat Integration

```typescript
"use client";

import { useChat } from "ai/react";

export function ChatWindow() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, stop, reload } =
    useChat({
      api: "/api/chat",
    });

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "user-msg" : "assistant-msg"}>
            <strong>{m.role === "user" ? "You" : "AI"}:</strong>
            <div>{m.content}</div>
          </div>
        ))}
        {isLoading && <div className="typing-indicator">Typing...</div>}
      </div>
      {error && (
        <div className="error-bar">
          {error.message}
          <button className="inline-button" onClick={reload}>Retry</button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="input-row">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything..."
          disabled={isLoading}
        />
        {isLoading ? (
          <button type="button" className="secondary-button" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" className="primary-button">Send</button>
        )}
      </form>
    </div>
  );
}
```

### Server Action Chat Endpoint

```typescript
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createAI } from "ai/rsc";

const AI = createAI({
  initialAIState: [],
  initialUIState: [],
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    system: "You are a helpful assistant.",
    temperature: 0.7,
    maxTokens: 4096,
  });

  return result.toDataStreamResponse();
}
```

With React 19 Server Actions:

```typescript
// app/chat/actions.ts
"use server";

import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createStreamableValue } from "ai/rsc";

export async function continueConversation(history: Message[]) {
  const stream = createStreamableValue("");

  (async () => {
    const { textStream } = streamText({
      model: openai("gpt-4o"),
      messages: history,
    });

    for await (const chunk of textStream) {
      stream.update(chunk);
    }
    stream.done();
  })();

  return { stream: stream.value };
}
```

### Streaming Markdown Rendering

```typescript
"use client";

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useChat } from "ai/react";

export function ChatWithMarkdown() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          {m.role === "assistant" ? (
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return match ? (
                    <SyntaxHighlighter language={match[1]} PreTag="div">
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {m.content}
            </ReactMarkdown>
          ) : (
            <p>{m.content}</p>
          )}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

Streaming renders progressively. Each new chunk updates Markdown tree. react-markdown re-renders on content change.

### Generative UI Pattern

AI SDK supports tool calls that render React components:

```typescript
// weather tool definition
const tools = {
  getWeather: {
    description: "Get weather for a location",
    parameters: z.object({
      location: z.string(),
    }),
    execute: async ({ location }: { location: string }) => {
      const res = await fetch(`https://api.weather.com/${location}`);
      return res.json();
    },
  },
};

// Server action with tool rendering
"use server";

import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";

export async function chatWithTools(history: Message[]) {
  const result = streamText({
    model: openai("gpt-4o"),
    messages: history,
    tools: {
      getWeather: tool({
        description: "Get weather for a location",
        parameters: z.object({ location: z.string() }),
        execute: async ({ location }) => {
          return { temperature: 72, condition: "sunny", location };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
```

Client renders tool call results as React components:

```typescript
"use client";

import { useChat } from "ai/react";

function WeatherCard({ temperature, condition, location }: {
  temperature: number;
  condition: string;
  location: string;
}) {
  return (
    <div className="weather-card">
      <h3>{location}</h3>
      <p>{temperature}F — {condition}</p>
    </div>
  );
}

export function GenerativeChat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          {m.role === "assistant" && m.toolInvocations?.map((inv) => {
            if (inv.toolName === "getWeather" && inv.state === "result") {
              return <WeatherCard key={inv.id} {...inv.result} />;
            }
            return null;
          })}
          {m.content && <ReactMarkdown>{m.content}</ReactMarkdown>}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Abort and Regenerate

```typescript
const { stop, reload } = useChat();

// Stop current generation
<button onClick={stop}>Stop</button>

// Regenerate last response
<button onClick={reload}>Regenerate</button>
```

useChat handles AbortController internally. `stop` aborts the fetch. `reload` re-sends last user message minus the failed assistant response.

### Error Handling

```typescript
const { error, reload } = useChat({
  onError: (err) => {
    console.error("Chat error:", err);
  },
});

// Rate limit, token limit, network errors
if (error) {
  const message = error.message.includes("429")
    ? "Rate limited. Wait a moment."
    : error.message.includes("tok")
    ? "Token limit reached. Start new conversation."
    : "Connection error.";
}
```

### React 19: useActionState for Chat Form

```typescript
"use client";

import { useActionState } from "react";
import { continueConversation } from "./actions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ActionStateChat() {
  const [messages, submitAction, isPending] = useActionState(
    async (prev: Message[], formData: FormData) => {
      const input = formData.get("input") as string;
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: input };
      const updated = [...prev, userMsg];
      const { stream } = await continueConversation(updated);
      let full = "";
      for await (const chunk of stream) {
        full += chunk;
      }
      const aiMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: full };
      return [...updated, aiMsg];
    },
    []
  );

  return (
    <div>
      {messages.map((m) => (
        <p key={m.id}><strong>{m.role}:</strong> {m.content}</p>
      ))}
      <form action={submitAction}>
        <input name="input" required />
        <button type="submit" disabled={isPending}>
          {isPending ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
}
```

### React 19: Suspense for Streaming

```typescript
import { Suspense } from "react";

async function StreamingResponse({ prompt }: { prompt: string }) {
  const { textStream } = streamText({
    model: openai("gpt-4o"),
    messages: [{ role: "user", content: prompt }],
  });

  let text = "";
  for await (const chunk of textStream) {
    text += chunk;
  }
  return <div>{text}</div>;
}

export function StreamingPage({ prompt }: { prompt: string }) {
  return (
    <Suspense fallback={<div className="loading">Generating...</div>}>
      <StreamingResponse prompt={prompt} />
    </Suspense>
  );
}
```

### React 19: use() Hook for Async Model Response

```typescript
"use client";

import { use } from "react";

function ModelResponse({ responsePromise }: { responsePromise: Promise<string> }) {
  const text = use(responsePromise);
  return <div>{text}</div>;
}

export function ChatWithUse({ prompt }: { prompt: string }) {
  const responsePromise = generateResponse(prompt);
  return (
    <Suspense fallback={<div>Thinking...</div>}>
      <ModelResponse responsePromise={responsePromise} />
    </Suspense>
  );
}
```

---

### Why This Matters

AI streaming is the dominant UI pattern for 2025+ apps. Vercel AI SDK abstracts away streaming protocol, abort logic, tool call serialization. Understanding useChat, generative UI, and Server Action integration lets you build ChatGPT-like interfaces in minutes. React 19 Server Actions + Suspense make streaming declarative.

---

### Common Questions

**Q: useChat vs useCompletion?**
A: useChat maintains message history array. useCompletion is single prompt-response. Use useChat for conversational UI, useCompletion for one-shot generate.

**Q: How to stream from non-OpenAI models?**
A: AI SDK provider abstraction. Use `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/mistral`. API identical.

**Q: Does generative UI work with all models?**
A: Only models supporting tool calls (function calling): GPT-4o, Claude 3.5+, Gemini 2.0+. Basic models skip tool execution.

---

## Examples

### Example 1: Full Chat with Markdown + Syntax Highlighting

```typescript
// app/chat/page.tsx
"use client";

import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function ChatPage() {
  const {
    messages, input, handleInputChange, handleSubmit,
    isLoading, error, stop, reload,
  } = useChat();

  return (
    <div className="chat-layout">
      <div className="message-list">
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            {m.role === "assistant" ? (
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return match ? (
                      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    );
                  },
                }}
              >
                {m.content}
              </ReactMarkdown>
            ) : (
              <p>{m.content}</p>
            )}
          </div>
        ))}
        {isLoading && <div className="cursor-blink" />}
        {error && (
          <div className="error">
            {error.message}
            <button onClick={reload}>Retry</button>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="input-area">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
        />
        {isLoading ? (
          <button type="button" onClick={stop}>Stop</button>
        ) : (
          <button type="submit">Send</button>
        )}
      </form>
    </div>
  );
}
```

### Example 2: Generative UI — Tool Call Renders Component

```typescript
// app/weather/actions.ts
"use server";

import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";
import { createStreamableUI } from "ai/rsc";

export async function askWeather(query: string) {
  const ui = createStreamableUI();

  (async () => {
    const { textStream, toolCalls } = streamText({
      model: openai("gpt-4o"),
      messages: [{ role: "user", content: query }],
      tools: {
        getWeather: tool({
          description: "Get current weather",
          parameters: z.object({ location: z.string() }),
          execute: async ({ location }) => {
            return { temp: 72, condition: "Sunny", location };
          },
        }),
      },
    });

    let text = "";
    for await (const chunk of textStream) {
      text += chunk;
      ui.update(<div>{text}</div>);
    }

    for await (const call of toolCalls) {
      if (call.toolName === "getWeather") {
        ui.done(<WeatherCard {...call.args} />);
      }
    }
  })();

  return ui.value;
}
```

### Example 3: Server Action Chat with useActionState

```typescript
// app/chat-actions/page.tsx
"use client";

import { useActionState } from "react";
import { continueConversation } from "./actions";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function ActionStateChatPage() {
  const [history, formAction, isPending] = useActionState(
    async (prev: Msg[], fd: FormData) => {
      const input = fd.get("msg") as string;
      const updated = [...prev, { role: "user" as const, content: input }];
      const { stream } = await continueConversation(updated);
      let reply = "";
      for await (const chunk of stream) {
        reply += chunk;
      }
      return [...updated, { role: "assistant" as const, content: reply }];
    },
    []
  );

  return (
    <div>
      {history.map((m, i) => (
        <p key={i}><strong>{m.role}:</strong> {m.content}</p>
      ))}
      <form action={formAction}>
        <input name="msg" required />
        <button type="submit" disabled={isPending}>
          {isPending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
```

---

## Key Takeaways
- useChat: streaming multi-turn chat with built-in abort/regenerate
- Server Actions + createStreamableValue for server-side streaming
- react-markdown renders streaming Markdown progressively
- Generative UI: tool calls on server render React components on client
- Error states: rate limit, token limit, network — handle with onError
- React 19: useActionState for form-driven chat, Suspense for streaming, use() for async
- AI SDK provider abstraction: swap OpenAI/Anthropic/Google without code change

## Common Misconception

"**Generative UI requires the AI model to generate JSX code.**"

Generative UI does not mean the model writes JSX. The model calls a tool (function). The tool execution returns data. The client maps that data to a React component. The model never sees the component code; it only sees the tool signature and description.

## Feynman Explain

useChat = useState for messages + fetch to API + streaming reader. Server Action with streamText = generator that yields tokens one by one. react-markdown = Markdown parser that converts text to React elements. Generative UI = model calls function (getWeather), function returns data, React renders component from data. Each piece is independent; AI SDK wires them together.

## Reframe

AI SDK is RPC framework for LLM. useChat = client RPC stub. Server Action = server RPC handler. streamText = streaming deserialization. Tool calls = typed RPC methods the model discovers via schema. Generative UI = RPC return value drives component tree. React 19 Suspense + use() = async/await for components.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 38-ai-streaming`

## Quiz: 38-ai-streaming


### Which hook from the Vercel AI SDK is used for multi-turn chat with message history?

- [ ] A: useCompletion

- [✓] B: useChat

- [ ] C: useAssistant

- [ ] D: useStream


**Answer:** B

useChat manages message history, streaming, abort, and regenerate for conversational interfaces.


### How do you switch from OpenAI to Anthropic Claude with the Vercel AI SDK?

- [ ] A: Change the API endpoint URL only

- [✓] B: Install @ai-sdk/anthropic and change the model parameter passed to streamText

- [ ] C: Rewrite all useChat calls to useCompletion

- [ ] D: Anthropic is not supported by the AI SDK


**Answer:** B

The AI SDK uses provider packages (@ai-sdk/openai, @ai-sdk/anthropic). Just install the provider and pass its model to streamText.


### What React 19 hook replaces the traditional form submission pattern for chat in the example?

- [ ] A: useReducer

- [✓] B: useActionState

- [ ] C: useDeferredValue

- [ ] D: useOptimistic


**Answer:** B

useActionState manages form submission state and pending status, replacing manual handleSubmit + useState for loading.


### In the generative UI pattern, what does the AI model actually execute on the server?

- [ ] A: JSX rendering code

- [✓] B: A named tool/function with typed parameters

- [ ] C: Inline React components

- [ ] D: CSS-in-JS styles


**Answer:** B

The model calls a registered tool (function). The tool returns data. The client maps the data to a React component.


### What is the purpose of createStreamableValue in the Server Action chat pattern?

- [ ] A: It creates a new OpenAI client instance

- [✓] B: It wraps a stream so the client can read chunks progressively via async iteration

- [ ] C: It compresses tokens for faster transfer

- [ ] D: It caches responses in localStorage


**Answer:** B

createStreamableValue creates a stream that the client reads with for-await-of, enabling progressive UI updates.


### Which library is recommended for rendering streaming Markdown responses in the chat UI?

- [ ] A: marked

- [✓] B: react-markdown

- [ ] C: remark

- [ ] D: showdown


**Answer:** B

react-markdown integrates as a React component that re-renders when content updates, ideal for streaming text.


### What does the stop() function returned by useChat do internally?

- [ ] A: Pauses the stream temporarily

- [✓] B: Aborts the underlying fetch request via AbortController

- [ ] C: Clears all messages from history

- [ ] D: Disconnects the WebSocket


**Answer:** B

useChat uses AbortController internally. stop() aborts the current fetch, halting the stream on the server.


### When should you use useCompletion instead of useChat?

- [ ] A: When you need multi-turn conversation history

- [✓] B: When you have a single prompt-response without chat history

- [ ] C: When you need tool calls

- [ ] D: When using Anthropic instead of OpenAI


**Answer:** B

useCompletion is for single-turn completion tasks. useChat manages a conversation array with multiple exchanges.


### What React 19 feature enables a component to suspend while waiting for an async model response?

- [ ] A: useEffect with dependency array

- [✓] B: Suspense boundary with use() for promise consumption

- [ ] C: forwardRef with async callback

- [ ] D: createPortal with streaming


**Answer:** B

React 19's use() hook reads a promise within a Suspense boundary, suspending the component until the promise resolves.


### How does the AI SDK handle tool call serialization between server and client?

- [ ] A: Tool calls are sent as raw JSX strings

- [✓] B: The tool name + parameters are serialized in the stream; client maps to components

- [ ] C: The server renders HTML and sends it to the client

- [ ] D: Tool calls bypass the stream and use a separate WebSocket


**Answer:** B

The stream contains structured tool invocation data (name, args, result). The client reads these and renders corresponding React components.


---

# Module 39: Full-Stack Framework — Next.js App Router

Est. study time: 2.5h
Language: en

## Learning Objectives
- Architect Next.js App Router with layout.tsx, page.tsx, loading.tsx, error.tsx
- Distinguish Server Components vs Client Components and data fetching patterns
- Implement Route Handlers, Middleware, Metadata API, and ISR
- Build Server Actions for mutations with React 19 useActionState
- Apply Streaming SSR with Suspense boundaries
- Manage React 19 patterns: use(), ref as prop in RSC boundaries
---

## Core Content

### App Router File Conventions

```
app/
├── layout.tsx          # Shared layout (wraps all pages)
├── page.tsx            # Home page (/)
├── loading.tsx         # Loading UI (Suspense fallback)
├── error.tsx           # Error boundary
├── global-error.tsx    # Root error boundary
├── not-found.tsx       # 404 page
├── route.tsx           # Route handler (API endpoint; pick one)
├── template.tsx        # Re-mount on navigation (rare)
└── [slug]/
    ├── page.tsx
    └── loading.tsx
```

Each segment can define its own layout, loading, and error. Nested layouts persist across navigations.

### Layout Hierarchy

```typescript
// app/layout.tsx — Root layout
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav>{/* shared nav */}</nav>
        </header>
        <main>{children}</main>
        <footer>{/* shared footer */}</footer>
      </body>
    </html>
  );
}
```

```typescript
// app/courses/layout.tsx — Segment layout
export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="courses-container">
      <aside>{/* sidebar filters */}</aside>
      <article>{children}</article>
    </section>
  );
}
```

### Server Components vs Client Components

All components in App Router are **Server Components by default**.

| Aspect | Server Component | Client Component |
|---|---|---|
| Default | Yes | No (must use "use client") |
| Data fetching | Direct (async, DB) | useEffect or lib |
| Bundle size | Zero JS | Full JS in bundle |
| State/hooks | No | useState, useEffect, etc |
| Event handlers | No | onClick, onSubmit |
| When to use | Static data, layout, SEO | Interactivity, browser APIs |

```typescript
// Server Component: fetches data directly
// app/courses/page.tsx
import { db } from "@/lib/db";

async function getCourses() {
  return db.query("SELECT * FROM courses");
}

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <ul>
      {courses.map((c) => (
        <li key={c.id}>{c.title}</li>
      ))}
    </ul>
  );
}
```

```typescript
// Client Component: interactive filter
"use client";

import { useState } from "react";

export function CourseFilter({ tags }: { tags: string[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (tag: string) => {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div>
      {tags.map((tag) => (
        <button
          key={tag}
          className={selected.includes(tag) ? "active" : ""}
          onClick={() => toggle(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
```

### Data Fetching Patterns

```typescript
// Parallel data fetching
async function Page({ params }: { params: { slug: string } }) {
  const [course, reviews] = await Promise.all([
    getCourse(params.slug),
    getReviews(params.slug),
  ]);

  return (
    <div>
      <CourseDetail course={course} />
      <ReviewList reviews={reviews} />
    </div>
  );
}
```

```typescript
// Sequential data fetching (waterfall)
async function InstructorPage({ params }: { params: { id: string } }) {
  const instructor = await getInstructor(params.id);
  const courses = await getCoursesByInstructor(instructor.id);

  return <InstructorProfile instructor={instructor} courses={courses} />;
}
```

### Route Handlers

```typescript
// app/api/courses/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const tag = searchParams.get("tag");

  const courses = await db.query(
    "SELECT * FROM courses WHERE tag = $1",
    [tag]
  );

  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const course = await db.insert("courses", body);
  return NextResponse.json(course, { status: 201 });
}
```

### Middleware

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("session")?.value;

  if (!token && req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (req.nextUrl.pathname.startsWith("/fr")) {
    const rest = req.nextUrl.pathname.replace("/fr", "");
    return NextResponse.rewrite(new URL(rest, req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/fr/:path*"],
};
```

### Metadata API

```typescript
// app/courses/[slug]/page.tsx
import type { Metadata } from "next";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await getCourse(params.slug);

  return {
    title: `${course.title} | CourseReader`,
    description: course.description,
    openGraph: {
      title: course.title,
      description: course.description,
      type: "article",
    },
  };
}

export default async function CoursePage({ params }: Props) {
  const course = await getCourse(params.slug);
  return <CourseDetail course={course} />;
}
```

### Static Generation and ISR

```typescript
// Static generation (SSG) at build time
export async function generateStaticParams() {
  const courses = await db.query("SELECT slug FROM courses");
  return courses.map((c: { slug: string }) => ({ slug: c.slug }));
}

// ISR: revalidate every 60 seconds
export const revalidate = 60;

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  return <CourseDetail course={course} />;
}
```

### Dynamic Rendering

Next.js detects dynamic APIs (cookies, headers, searchParams) and opts into dynamic rendering:

```typescript
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const results = q ? await searchCourses(q) : [];

  return (
    <div>
      <SearchForm initialQuery={q} />
      {results.map((r) => (
        <SearchResult key={r.id} result={r} />
      ))}
    </div>
  );
}
```

### Streaming SSR with loading.tsx

```typescript
// app/courses/[slug]/loading.tsx
export default function CourseLoading() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-title" />
      <div className="skeleton-body" />
    </div>
  );
}
```

```typescript
// app/courses/[slug]/page.tsx
import { Suspense } from "react";

async function CourseContent({ slug }: { slug: string }) {
  await new Promise((r) => setTimeout(r, 500)); // simulate slow fetch
  const course = await getCourse(slug);
  return <CourseDetail course={course} />;
}

async function ReviewsContent({ slug }: { slug: string }) {
  await new Promise((r) => setTimeout(r, 1000));
  const reviews = await getReviews(slug);
  return <ReviewList reviews={reviews} />;
}

export default async function CoursePage({ params }: { params: { slug: string } }) {
  return (
    <div>
      <Suspense fallback={<div className="skeleton-title" />}>
        <CourseContent slug={params.slug} />
      </Suspense>
      <Suspense fallback={<div className="skeleton-reviews" />}>
        <ReviewsContent slug={params.slug} />
      </Suspense>
    </div>
  );
}
```

### React 19: Server Actions for Mutations

```typescript
// app/courses/[slug]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

const ReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(10),
});

export async function submitReview(slug: string, formData: FormData) {
  const parsed = ReviewSchema.parse({
    rating: Number(formData.get("rating")),
    comment: formData.get("comment"),
  });

  await db.insert("reviews", {
    courseSlug: slug,
    ...parsed,
    createdAt: new Date(),
  });

  revalidatePath(`/courses/${slug}`);
}
```

```typescript
// app/courses/[slug]/ReviewForm.tsx
"use client";

import { useActionState } from "react";
import { submitReview } from "./actions";

export function ReviewForm({ slug }: { slug: string }) {
  const [state, action, isPending] = useActionState(
    async (_prev: { success: boolean; error?: string }, formData: FormData) => {
      try {
        await submitReview(slug, formData);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    { success: false }
  );

  if (state.success) return <p>Review submitted!</p>;

  return (
    <form action={action}>
      <input type="number" name="rating" min={1} max={5} required />
      <textarea name="comment" required />
      {state.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
```

### React 19: use() for Parallel Data Fetching

```typescript
import { use } from "react";

function CourseDetails({ coursePromise }: { coursePromise: Promise<Course> }) {
  const course = use(coursePromise);
  return <CourseDetail course={course} />;
}

function ReviewSection({ reviewsPromise }: { reviewsPromise: Promise<Review[]> }) {
  const reviews = use(reviewsPromise);
  return <ReviewList reviews={reviews} />;
}

export default function CoursePage({ params }: { params: { slug: string } }) {
  const coursePromise = getCourse(params.slug);
  const reviewsPromise = getReviews(params.slug);

  return (
    <div>
      <Suspense fallback={<div>Loading course...</div>}>
        <CourseDetails coursePromise={coursePromise} />
      </Suspense>
      <Suspense fallback={<div>Loading reviews...</div>}>
        <ReviewSection reviewsPromise={reviewsPromise} />
      </Suspense>
    </div>
  );
}
```

### React 19: Ref as Prop in RSC Boundaries

```typescript
"use client";

import { useRef } from "react";

export function ScrollableSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div ref={ref}>
      {children}
      <button className="inline-button" onClick={scrollToTop}>
        Scroll to top
      </button>
    </div>
  );
}
```

React 19 passes `ref` as regular prop, not special `forwardRef`. Server Components pass props to Client Components that use ref.

### React Compiler in Next.js

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
};
export default nextConfig;
```

React Compiler auto-memoizes Server Actions and Client Component callbacks, reducing re-renders in form-heavy pages.

---

### Why This Matters

Next.js App Router is the de facto full-stack React framework. Server Components eliminate client JS for data fetching. Streaming SSR improves perceived performance. Server Actions simplify mutations without API routes. Understanding layout hierarchy, data patterns, and React 19 integration is essential for production Next.js apps.

---

### Common Questions

**Q: When to use Route Handler vs Server Action?**
A: Route Handler for external API consumption (mobile apps, third-party). Server Action for form mutations within same app (revalidatePath, progressive enhancement).

**Q: Can I use useState in Server Component?**
A: No. Server Components execute on server, no state hooks. Use Client Component for interactivity.

**Q: How does ISR work with dynamic routes?**
A: generateStaticParams pre-builds pages. revalidate tag in page re-fetches data and regenerates HTML on-demand after stale time.

---

## Examples

### Example 1: Full App Router Page with Streaming

```typescript
// app/dashboard/page.tsx
import { Suspense } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { StatsCards } from "./StatsCards";
import { RecentActivity } from "./RecentActivity";
import { DashboardSkeleton } from "./loading";

export default async function DashboardPage() {
  return (
    <div>
      <DashboardHeader />
      <Suspense fallback={<DashboardSkeleton />}>
        <StatsCards />
      </Suspense>
      <Suspense fallback={<div className="skeleton-list" />}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}
```

```typescript
// app/dashboard/StatsCards.tsx (Server Component)
import { db } from "@/lib/db";

export async function StatsCards() {
  const [totalUsers, revenue, activeCourses] = await Promise.all([
    db.query("SELECT COUNT(*) as count FROM users"),
    db.query("SELECT SUM(amount) as total FROM payments"),
    db.query("SELECT COUNT(*) as count FROM courses WHERE active = true"),
  ]);

  return (
    <div className="stats-grid">
      <StatCard label="Users" value={totalUsers[0].count} />
      <StatCard label="Revenue" value={`$${revenue[0].total}`} />
      <StatCard label="Active Courses" value={activeCourses[0].count} />
    </div>
  );
}
```

### Example 2: Server Action Form with Validation

```typescript
// app/newsletter/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

const EmailSchema = z.string().email();

export async function subscribeNewsletter(formData: FormData) {
  const email = formData.get("email");

  const parsed = EmailSchema.safeParse(email);
  if (!parsed.success) {
    return { error: "Invalid email address" };
  }

  await db.insert("newsletter_subscribers", {
    email: parsed.data,
    subscribedAt: new Date(),
  });

  revalidatePath("/newsletter");
  return { success: true };
}
```

```typescript
// app/newsletter/SubscribeForm.tsx
"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "./actions";

export function SubscribeForm() {
  const [state, action, isPending] = useActionState(
    async (_prev: { error?: string; success?: boolean }, fd: FormData) => {
      return subscribeNewsletter(fd);
    },
    {}
  );

  return (
    <form action={action} className="subscribe-form">
      <input type="email" name="email" placeholder="you@example.com" required />
      <button type="submit" disabled={isPending}>
        {isPending ? "Subscribing..." : "Subscribe"}
      </button>
      {state?.success && <p className="success">Subscribed!</p>}
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
```

### Example 3: Middleware Auth + i18n

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "fr", "es"];
const defaultLocale = "en";

function getLocale(req: NextRequest): string {
  const acceptLang = req.headers.get("accept-language");
  if (!acceptLang) return defaultLocale;
  const preferred = acceptLang.split(",")[0].split("-")[0];
  return locales.includes(preferred) ? preferred : defaultLocale;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale) {
    const locale = getLocale(req);
    return NextResponse.redirect(
      new URL(`/${locale}${pathname}`, req.url)
    );
  }

  const token = req.cookies.get("session")?.value;
  if (!token && pathname.includes("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next|static|favicon.ico).*)"],
};
```

---

## Key Takeaways
- App Router: layout.tsx wraps page.tsx, loading.tsx = Suspense fallback, error.tsx = error boundary
- Server Components fetch data directly; Client Components handle interactivity
- Route Handlers for external APIs; Server Actions for form mutations
- ISR: generateStaticParams + revalidate for hybrid static/dynamic pages
- Streaming SSR: Suspense boundaries stream independent sections
- React 19: useActionState for form state, use() for parallel data, ref as prop
- React Compiler: experimental flag in next.config.ts auto-memoizes
- Middleware handles auth + i18n before request reaches page

## Common Misconception

"**Server Actions replace all API routes.**"

Server Actions replace form mutations within same Next.js app. They cannot be consumed by external clients (mobile apps, curl). Route Handlers (app/api/route.ts) remain necessary for REST API endpoints consumed outside the Next.js app.

## Feynman Explain

Next.js App Router = filesystem routing + server rendering + streaming + mutations. layout.tsx = persistent shell. page.tsx = route content. loading.tsx = what user sees while waiting. error.tsx = what user sees on failure. Server Components run SQL on server, send HTML (no JS). Client Components send JS bundle for interactivity. Server Actions are functions that run on server when form submits. Streaming sends HTML in chunks as each async fetch resolves.

## Reframe

Next.js App Router merges backend (Express routes, DB queries) with frontend (React components). Server Components = controller + view merged. Server Actions = controller mutation endpoint. Route Handlers = REST API. Middleware = reverse proxy. ISR = CDN cache with background revalidation. Layout hierarchy = component tree as URL tree.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 39-fullstack-nextjs`

## Quiz: 39-fullstack-nextjs


### What is the default rendering model for all components in the Next.js App Router?

- [ ] A: Client Component

- [✓] B: Server Component

- [ ] C: Static HTML export

- [ ] D: Edge Function


**Answer:** B

All components in App Router are Server Components by default. 'use client' is required to opt into client-side interactivity.


### Which file convention provides Suspense fallback UI for a route segment?

- [ ] A: error.tsx

- [✓] B: loading.tsx

- [ ] C: fallback.tsx

- [ ] D: pending.tsx


**Answer:** B

loading.tsx automatically wraps the page in a Suspense boundary with the loading component as fallback.


### What is the difference between a Route Handler (app/api/*) and a Server Action?

- [ ] A: They are functionally identical

- [✓] B: Route Handlers work with external clients (mobile, curl); Server Actions are for form mutations within the same app

- [ ] C: Server Actions are faster because they skip HTTP

- [ ] D: Route Handlers cannot access the database


**Answer:** B

Route Handlers serve external API consumers. Server Actions run on form submission within the app with revalidatePath for cache invalidation.


### What does revalidatePath do in a Server Action?

- [✓] A: Clears the server-side cache for the given path, triggering re-fetch

- [ ] B: Refreshes the client-side router cache only

- [ ] C: Deletes the API route for that path

- [ ] D: Redirects the user to a different page


**Answer:** A

revalidatePath purges the server cache for the specified route, causing the next request to re-fetch data and regenerate the page.


### Which Next.js feature allows static pages to be regenerated on-demand after build time?

- [ ] A: Dynamic rendering

- [✓] B: Incremental Static Regeneration (ISR)

- [ ] C: Client-side fetching

- [ ] D: Edge Runtime


**Answer:** B

ISR with revalidate tag pre-builds pages at build time and re-generates them when stale requests come in.


### What React 19 hook replaces manual form submission state management in the Next.js Server Action pattern?

- [ ] A: useFormStatus

- [✓] B: useActionState

- [ ] C: useOptimistic

- [ ] D: useFormState


**Answer:** B

useActionState (formerly useFormState) manages form pending state and return values, integrating with Server Actions.


### How does Next.js detect that a page requires dynamic rendering?

- [ ] A: The page must export const dynamic = 'force-dynamic'

- [✓] B: Using cookies(), headers(), or searchParams in the Server Component

- [ ] C: Dynamic rendering is the default; opt out with static export

- [ ] D: It checks if the component uses the useState hook


**Answer:** B

Next.js automatically opts into dynamic rendering when Server Components use dynamic APIs like cookies(), headers(), or searchParams.


### What is the purpose of the matcher config in middleware.ts?

- [ ] A: It defines which database tables the middleware can access

- [✓] B: It specifies which routes trigger the middleware function

- [ ] C: It sets the matching algorithm for path parameters

- [ ] D: It configures the rate limiter for API routes


**Answer:** B

The matcher config limits which paths execute the middleware, preventing unnecessary runs on static assets and API routes.


### How do you pass a ref to a Client Component from a Server Component in React 19?

- [✓] A: Use React.forwardRef in the Client Component; Server Components pass ref directly

- [ ] B: Ref is automatically forwarded for all components

- [ ] C: Server Components cannot pass refs; only props are allowed across the boundary

- [ ] D: Use the useImperativeHandle hook in the Server Component


**Answer:** A

In React 19, ref is a regular prop. Client Components use forwardRef to receive it; Server Components pass it as any other prop.


### What does enabling experimental.reactCompiler in next.config.ts achieve?

- [ ] A: Compiles JSX to plain JavaScript for older browsers

- [✓] B: Auto-memoizes Server Actions and Client Component callbacks, reducing re-renders

- [ ] C: Enables TypeScript strict mode for all components

- [ ] D: Automatically converts Server Components to Client Components


**Answer:** B

React Compiler auto-memoizes functions and values, eliminating manual useCallback/useMemo wrappers and reducing unnecessary re-renders.


---

# Module 40: Design Tokens — Style Dictionary

Est. study time: 1.5h
Language: en

## Learning Objectives
- Configure Style Dictionary for multi-platform token output
- Define token hierarchy: global → alias → component
- Build custom transforms for React Native and Tailwind config
- Implement theming with CSS custom properties from tokens
- Integrate token CI pipeline with linting and breaking change detection
- Apply React 19 patterns: static class names for React Compiler, zero-cost theming in Server Components
---

## Core Content

### Style Dictionary Architecture

Style Dictionary reads structured token JSON and transforms/ formats for multiple platforms.

```
tokens/
├── global/
│   ├── color.json
│   ├── spacing.json
│   └── typography.json
├── alias.json
└── components/
    ├── button.json
    └── card.json
```

```typescript
// config.json (Style Dictionary config)
{
  "source": ["tokens/**/*.json"],
  "platforms": {
    "css": {
      "transformGroup": "css",
      "buildPath": "dist/css/",
      "files": [{
        "destination": "tokens.css",
        "format": "css/variables"
      }]
    },
    "js": {
      "transformGroup": "js",
      "buildPath": "dist/js/",
      "files": [{
        "destination": "tokens.js",
        "format": "javascript/es6"
      }]
    },
    "ts": {
      "transformGroup": "js",
      "buildPath": "dist/ts/",
      "files": [{
        "destination": "tokens.ts",
        "format": "typescript/es6-declarations"
      }]
    }
  }
}
```

### Token Format

Token structure follows Design Token Community Group spec:

```json
{
  "color": {
    "neutral": {
      "white": { "value": "#FFFFFF", "type": "color" },
      "gray-100": { "value": "#F5F5F5", "type": "color" },
      "gray-500": { "value": "#9CA3AF", "type": "color" },
      "gray-900": { "value": "#111827", "type": "color" },
      "black": { "value": "#000000", "type": "color" }
    },
    "primary": {
      "500": { "value": "#3B82F6", "type": "color" },
      "600": { "value": "#2563EB", "type": "color" },
      "700": { "value": "#1D4ED8", "type": "color" }
    }
  },
  "spacing": {
    "xs": { "value": "4px", "type": "dimension" },
    "sm": { "value": "8px", "type": "dimension" },
    "md": { "value": "16px", "type": "dimension" },
    "lg": { "value": "24px", "type": "dimension" },
    "xl": { "value": "32px", "type": "dimension" }
  },
  "border-radius": {
    "sm": { "value": "4px", "type": "dimension" },
    "md": { "value": "8px", "type": "dimension" },
    "lg": { "value": "16px", "type": "dimension" }
  }
}
```

### Alias Tokens

```json
{
  "color": {
    "background": {
      "primary": { "value": "{color.primary.500}", "type": "color" },
      "surface": { "value": "{color.neutral.white}", "type": "color" }
    },
    "text": {
      "primary": { "value": "{color.neutral.gray-900}", "type": "color" },
      "secondary": { "value": "{color.neutral.gray-500}", "type": "color" }
    }
  },
  "spacing": {
    "button": {
      "padding-x": { "value": "{spacing.md}", "type": "dimension" },
      "padding-y": { "value": "{spacing.sm}", "type": "dimension" }
    }
  }
}
```

### Component Tokens

```json
{
  "button": {
    "background": {
      "primary": { "value": "{color.background.primary}", "type": "color" },
      "hover": { "value": "{color.primary.600}", "type": "color" }
    },
    "text-color": {
      "primary": { "value": "{color.text.primary}", "type": "color" }
    },
    "border-radius": { "value": "{border-radius.md}", "type": "dimension" }
  }
}
```

### CSS Output

```css
:root {
  --color-neutral-white: #FFFFFF;
  --color-neutral-gray-100: #F5F5F5;
  --color-neutral-gray-500: #9CA3AF;
  --color-neutral-gray-900: #111827;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --color-background-primary: var(--color-primary-500);
  --color-background-surface: var(--color-neutral-white);
  --color-text-primary: var(--color-neutral-gray-900);
  --button-background-primary: var(--color-background-primary);
}

[data-theme="dark"] {
  --color-neutral-white: #1F2937;
  --color-neutral-gray-900: #F9FAFB;
  --color-background-surface: var(--color-neutral-gray-100);
  --color-text-primary: var(--color-neutral-gray-900);
}
```

### Custom Transforms

```typescript
// style-dictionary.config.ts
import StyleDictionary from "style-dictionary";

// Custom transform: px to React Native dp
StyleDictionary.registerTransform({
  name: "size/pxToDp",
  type: "value",
  matcher: (token) => token.type === "dimension",
  transformer: (token) => {
    const value = token.value as string;
    const num = parseFloat(value);
    return isNaN(num) ? value : `${num * 2}dp`;
  },
});

// Custom format: Tailwind config
const tailwindFormat = StyleDictionary.registerFormat({
  name: "tailwind/config",
  formatter: ({ dictionary }) => {
    const colors = dictionary.allTokens
      .filter((t) => t.type === "color")
      .reduce((acc: Record<string, string>, t) => {
        const key = t.path.join("-");
        acc[key] = t.value as string;
        return acc;
      }, {});

    const spacing = dictionary.allTokens
      .filter((t) => t.type === "dimension")
      .reduce((acc: Record<string, string>, t) => {
        const key = t.path.join("-");
        const num = parseFloat(t.value as string);
        acc[key] = isNaN(num) ? t.value : `${num / 4}rem`;
        return acc;
      }, {});

    return JSON.stringify({ theme: { extend: { colors, spacing } } }, null, 2);
  },
});

export default {
  source: ["tokens/**/*.json"],
  platforms: {
    "rn": {
      transformGroup: "js",
      transforms: ["size/pxToDp"],
      buildPath: "dist/rn/",
      files: [{ destination: "tokens.js", format: "javascript/es6" }],
    },
    "tailwind": {
      transformGroup: "js",
      buildPath: "dist/tailwind/",
      files: [{ destination: "tailwind.config.extend.json", format: "tailwind/config" }],
    },
  },
};
```

### Theming with CSS Custom Properties

```typescript
// tokens/theme/light.json
{
  "theme": {
    "background": {
      "primary": { "value": "#FFFFFF", "type": "color" },
      "secondary": { "value": "#F5F5F5", "type": "color" }
    },
    "text": {
      "primary": { "value": "#111827", "type": "color" },
      "secondary": { "value": "#6B7280", "type": "color" }
    }
  }
}
```

```typescript
// tokens/theme/dark.json
{
  "theme": {
    "background": {
      "primary": { "value": "#1F2937", "type": "color" },
      "secondary": { "value": "#374151", "type": "color" }
    },
    "text": {
      "primary": { "value": "#F9FAFB", "type": "color" },
      "secondary": { "value": "#D1D5DB", "type": "color" }
    }
  }
}
```

```css
/* dist/css/tokens.css */
:root, [data-theme="light"] {
  --theme-background-primary: #FFFFFF;
  --theme-background-secondary: #F5F5F5;
  --theme-text-primary: #111827;
  --theme-text-secondary: #6B7280;
}

[data-theme="dark"] {
  --theme-background-primary: #1F2937;
  --theme-background-secondary: #374151;
  --theme-text-primary: #F9FAFB;
  --theme-text-secondary: #D1D5DB;
}
```

```typescript
// ThemeToggle.tsx
"use client";

import { useCallback } from "react";

export function ThemeToggle() {
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
  }, []);

  return <button className="inline-button" onClick={toggle}>Toggle Theme</button>;
}
```

### CI Integration

```yaml
# .github/workflows/token-check.yml
name: Design Token Check
on: [pull_request]
jobs:
  token-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install style-dictionary
      - run: npx style-dictionary build --config config.json
      - name: Check for breaking changes
        run: |
          git fetch origin main
          diff --unified \
            <(git show origin/main:dist/css/tokens.css) \
            dist/css/tokens.css \
            && echo "No breaking changes" \
            || echo "Token changes detected — review required"
```

### Token Hierarchy

```
Global tokens (foundation)
  └─ Alias tokens (semantic mapping)
       └─ Component tokens (scoped override)
```

| Level | Example | Scope |
|---|---|---|
| Global | `color.primary.500`, `spacing.md` | Design system foundation |
| Alias | `color.background.primary` | Semantic purpose |
| Component | `button.background.primary` | Component-specific override |

### React Compiler with Token-Based Styles

Static class names = compiler-friendly:

```typescript
// compiler can memoize this — no dynamic style object
export function Button({ variant }: { variant: "primary" | "secondary" }) {
  return (
    <button className={`btn btn--${variant}`}>
      {children}
    </button>
  );
}
```

```css
/* tokens.css defines --button-background-primary */
.btn--primary {
  background-color: var(--button-background-primary);
  color: var(--button-text-primary);
  border-radius: var(--button-border-radius);
  padding: var(--spacing-sm) var(--spacing-md);
}
```

No inline style objects = React Compiler skips dynamic style reconciliation.

### Server Components with Token CSS

```typescript
// app/page.tsx — Server Component
import "./tokens.css"; // imported in root layout once

export default async function Page() {
  return (
    <div className="page-container">
      <h1 className="heading-xl">Design System</h1>
      <p className="text-body">Token-driven styling with zero runtime cost.</p>
    </div>
  );
}
```

Server Components emit HTML with class names. CSS custom properties resolve at paint time, no JS runtime. No theming cost on server.

---

### Why This Matters

Design tokens decouple visual style from component code. One token source generates CSS for web, JSON for mobile, config for Tailwind. CI checks prevent visual regressions. React 19 static class names optimize compiler output. Server Components render themed CSS without JavaScript.

---

### Common Questions

**Q: Should I use inline styles or CSS custom properties from tokens?**
A: CSS custom properties. Inline styles cannot be overridden by theme without component re-render. Custom properties re-theme via attribute change (data-theme) without re-render.

**Q: How do I handle token deprecation?**
A: Mark deprecated tokens in JSON with `deprecated: true`. Add CI check that warns on usage of deprecated tokens. Remove after migration window.

**Q: Can I use tokens without Style Dictionary?**
A: Yes, but you lose platform transforms, CI integration, and format standardization. Style Dictionary is the industry standard for token pipeline.

---

## Examples

### Example 1: Multi-Platform Token Pipeline

```typescript
// style-dictionary.config.ts
import StyleDictionary from "style-dictionary";

StyleDictionary.registerTransform({
  name: "size/rem",
  type: "value",
  matcher: (token) => token.type === "dimension",
  transformer: (token) => {
    const num = parseFloat(token.value as string);
    return isNaN(num) ? token.value : `${num / 16}rem`;
  },
});

const buildConfigs = [
  {
    source: ["tokens/**/*.json"],
    platforms: {
      css: {
        transformGroup: "css",
        buildPath: "dist/web/",
        files: [{ destination: "variables.css", format: "css/variables" }],
      },
      scss: {
        transformGroup: "scss",
        buildPath: "dist/web/",
        files: [{ destination: "_variables.scss", format: "scss/variables" }],
      },
      "react-native": {
        transformGroup: "js",
        transforms: ["size/pxToDp", "attribute/cti"],
        buildPath: "dist/mobile/",
        files: [{ destination: "tokens.js", format: "javascript/es6" }],
      },
      tailwind: {
        transformGroup: "js",
        buildPath: "dist/tailwind/",
        files: [{ destination: "extend.json", format: "tailwind/config" }],
      },
    },
  },
];

buildConfigs.forEach((cfg) => {
  const sd = new StyleDictionary(cfg);
  sd.buildAllPlatforms();
});
```

### Example 2: Custom Transform for React Native

```typescript
// transforms/rn-transform.ts
import StyleDictionary from "style-dictionary";

StyleDictionary.registerTransform({
  name: "size/pxToDp",
  type: "value",
  matcher: (token) => token.type === "dimension",
  transformer: (token) => {
    const value = token.value as string;
    const num = parseFloat(value);
    return isNaN(num) ? value : num * 2;
  },
});

StyleDictionary.registerTransformGroup({
  name: "custom/rn",
  transforms: [
    "attribute/cti",
    "name/cti/camel",
    "size/pxToDp",
    "color/css",
  ],
});

export default {
  source: ["tokens/**/*.json"],
  platforms: {
    rn: {
      transformGroup: "custom/rn",
      buildPath: "dist/rn/",
      files: [{ destination: "tokens.ts", format: "typescript/es6-declarations" }],
    },
  },
};
```

Output:

```typescript
// dist/rn/tokens.ts
export const ColorNeutralWhite = "#FFFFFF";
export const ColorPrimary500 = "#3B82F6";
export const SpacingMd = 32; // 16px * 2 = 32dp
export const BorderRadiusMd = 16; // 8px * 2 = 16dp
```

### Example 3: CI Token Diff Checker

```typescript
// scripts/check-token-diff.ts
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const BASE_BRANCH = "main";
const CSS_PATH = "dist/css/variables.css";

function getCurrentTokens(): string {
  return readFileSync(resolve(CSS_PATH), "utf-8");
}

function getBaseTokens(): string {
  try {
    return execSync(
      `git show origin/${BASE_BRANCH}:${CSS_PATH}`,
      { encoding: "utf-8" }
    );
  } catch {
    return "";
  }
}

function parseVariables(css: string): Map<string, string> {
  const map = new Map();
  const regex = /--([^:]+):\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    map.set(match[1].trim(), match[2].trim());
  }
  return map;
}

function checkBreakingChanges(): void {
  if (!existsSync(CSS_PATH)) {
    console.log("No token CSS file found. Skipping.");
    process.exit(0);
  }

  const current = parseVariables(getCurrentTokens());
  const base = parseVariables(getBaseTokens());

  let breaking = false;

  for (const [key, value] of current) {
    if (base.has(key) && base.get(key) !== value) {
      console.warn(`BREAKING: ${key} changed from ${base.get(key)} to ${value}`);
      breaking = true;
    }
  }

  for (const key of current.keys()) {
    if (!base.has(key)) {
      console.log(`NEW: ${key} = ${current.get(key)}`);
    }
  }

  if (breaking) {
    console.error("Breaking token changes found. Review required.");
    process.exit(1);
  }

  console.log("No breaking token changes.");
}

checkBreakingChanges();
```

---

## Key Takeaways
- Style Dictionary: single token source → CSS, JS, TS, Tailwind, React Native
- Token hierarchy: global foundation → alias semantics → component overrides
- Custom transforms: pxToDp for React Native, rem for web, custom format for Tailwind
- Theming: multiple token sets (light/dark) → CSS custom properties → data-theme attribute
- CI: lint tokens on PR, detect breaking changes via CSS diff
- React 19: static class names = compiler-friendly (no dynamic style objects)
- Server Components: class names + CSS custom properties = zero JS runtime for theming

## Common Misconception

"**Design tokens are only for design systems teams.**"

Design tokens benefit any app with theming, multi-platform output, or visual consistency. Even a single app benefits from alias tokens (color.danger instead of hardcoding #DC2626). The CI token diff prevents accidental color regressions across teams.

## Feynman Explain

Design tokens = named variables for every visual property. Style Dictionary = compiler that reads tokens and writes CSS files, JS files, config files. Token hierarchy: global = raw materials (blue #3B82F6), alias = purpose (danger = blue), component = specific (button danger background = danger). Theming = swapping token values based on data-theme attribute. React Compiler loves static class names because it can cache rendering unconditionally.

## Reframe

Style Dictionary is Webpack for design. Input: standardized token JSON. Output: platform-specific artifacts (CSS custom properties, TypeScript enums, Tailwind config, Android XML, iOS asset catalog). Custom transforms = loaders (px → dp, px → rem). CI pipeline = lint + type-check for visual properties. Token hierarchy = component inheritance chain (global → theme → component).

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 40-design-tokens`

## Quiz: 40-design-tokens


### What is the primary purpose of Style Dictionary?

- [ ] A: A CSS framework for responsive design

- [✓] B: A build tool that transforms design tokens into platform-specific output

- [ ] C: A design tool for creating color palettes

- [ ] D: A runtime theme engine for React


**Answer:** B

Style Dictionary takes structured token JSON and generates platform-specific files (CSS, JS, TS, Android XML, etc.) via transforms and formats.


### In the token hierarchy, what is the difference between alias tokens and component tokens?

- [ ] A: Alias tokens are for JavaScript; component tokens are for CSS

- [✓] B: Alias tokens map global tokens to semantic purposes; component tokens scope overrides to specific components

- [ ] C: They are the same thing with different naming conventions

- [ ] D: Alias tokens are deprecated; component tokens are the standard


**Answer:** B

Alias tokens add semantic meaning (color.danger). Component tokens further scope values to specific components (button.background.danger).


### How do CSS custom properties enable runtime theming without re-render?

- [ ] A: CSS custom properties trigger React re-render when changed

- [✓] B: Custom properties resolve at paint time; changing data-theme attribute swaps values without component re-render

- [ ] C: They use JavaScript setters to update the DOM

- [ ] D: They are polyfilled by Style Dictionary at build time


**Answer:** B

CSS custom properties are evaluated by the browser at paint time. Changing data-theme on a parent element cascades new values to all children without JavaScript re-render.


### What does a custom Style Dictionary transform do?

- [ ] A: Changes the file format of the output

- [✓] B: Modifies token values during build (e.g., px to dp, px to rem)

- [ ] C: Validates token JSON schema

- [ ] D: Compresses the output CSS


**Answer:** B

Transforms are middleware that modify token values (or attributes) during build, enabling platform-specific value conversion.


### Why are static class names compiler-friendly for React Compiler?

- [ ] A: Static class names are faster to hash

- [✓] B: Static class names produce no dynamic style objects, so the compiler can memoize the rendering unconditionally

- [ ] C: React Compiler only works with className strings, not objects

- [ ] D: Static class names automatically tree-shake unused styles


**Answer:** B

Static class names avoid dynamic style object creation. React Compiler can memoize the virtual DOM output without tracking style dependencies.


### What is the token reference syntax Style Dictionary uses for alias resolution?

- [ ] A: $ref: path.to.token

- [✓] B: {path.to.token}

- [ ] C: @path/to/token

- [ ] D: var(--path-to-token)


**Answer:** B

Style Dictionary uses {path.to.token} to reference other tokens. References are resolved at build time, not runtime.


### How does the CI token diff checker detect breaking changes?

- [ ] A: Comparing file sizes of the output CSS

- [✓] B: Parsing CSS custom properties from current and base branch, then checking for value changes on existing keys

- [ ] C: Running the full Style Dictionary build twice

- [ ] D: Comparing git commit hashes of token files


**Answer:** B

The checker parses --variable: value pairs from CSS output on both branches. If an existing key has a different value, it's a breaking change.


### What is the benefit of Server Components consuming token CSS?

- [ ] A: Server Components can modify CSS custom properties

- [✓] B: Zero JS runtime cost for theming — CSS custom properties resolve at paint time on the client

- [ ] C: Server Components inline all CSS into the HTML

- [ ] D: Tokens are compiled to inline styles by the server


**Answer:** B

Server Components emit HTML with class names. CSS custom properties handle theming at paint time. No JavaScript executes for token resolution.


### Which Style Dictionary format output would you use to generate TypeScript type definitions for tokens?

- [ ] A: css/variables

- [ ] B: javascript/es6

- [✓] C: typescript/es6-declarations

- [ ] D: scss/variables


**Answer:** C

typescript/es6-declarations generates .d.ts type definitions alongside .js token files for TypeScript consumers.


### What scenario would require a custom Style Dictionary format instead of a built-in format?

- [ ] A: Generating CSS custom properties for the web

- [ ] B: Generating SCSS variables for a Sass project

- [✓] C: Generating a Tailwind CSS config extension from tokens

- [ ] D: Generating JavaScript ES6 module exports


**Answer:** C

Tailwind config is a custom JSON structure not covered by built-in formats. A custom format function transforms tokens into the Tailwind extend config shape.
