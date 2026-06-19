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
