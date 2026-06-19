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
