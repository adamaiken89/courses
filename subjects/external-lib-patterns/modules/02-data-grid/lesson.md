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
