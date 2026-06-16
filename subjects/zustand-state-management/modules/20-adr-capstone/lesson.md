# Module 20: Capstone — Architecture Decision Record

Est. study time: 2.5h
Language: en

## Learning Objectives
- Author Architecture Decision Records (ADRs) for state management decisions
- Evaluate state solutions systematically using a decision matrix
- Document store architecture: boundaries, slice ownership, selector API commitments
- Apply ADR review criteria: tradeoff analysis, rollback plan, success metrics

---

## Core Content

### What Is an Architecture Decision Record — Why State Management Needs ADRs

Architecture Decision Record (ADR) is a lightweight document capturing a decision, its context, tradeoffs, and consequences. Originated by Michael Nygard for capturing architecture decisions rather than rediscovering them every 6 months.

State management decisions are prime ADR candidates because:
- **Irreversible**: choosing Context means restructuring component tree. Choosing Zustand means installing dependency. Reversing both costs weeks.
- **Cross-cutting**: store serves 50 components. Wrong boundary infects 50 files.
- **Tribal knowledge dilutes**: team grows, original reasons vanish. Next engineer re-litigates "why Zustand not Context?"
- **Tradeoff heavy**: no universal best. Every choice depends on team size, app type, performance requirements.

```
ADR: State Management Selection
Status: Accepted
Date: 2024-06-15
Deciders: Frontend team (5 engineers)

Context: App needs shared auth state, cart state, UI preferences.
  20 components read each domain.

Decision: Zustand for all three domains (separate stores).

Tradeoffs:
  - Pro: No provider tree. Smaller bundle than Redux.
  - Con: No middleware ecosystem (no saga/thunk).
  - Pro: Simpler mental model — actions are methods.
  - Con: Team must learn new API.

Consequences:
  - Positive: re-renders scoped per selector.
  - Positive: bundle -17KB vs RTK.
  - Negative: team ramp-up ~1 week.
  - Risk: Zustand ecosystem smaller — no entity adapter.
```

> **Think**: A new engineer joins 6 months after Zustand selection. No ADR exists. What happens when they evaluate "should we switch to Redux?"?
>
> *Answer: They spend 2 days re-evaluating tradeoffs your team already worked through. They might reach different conclusion because context changed (team grew, app grew, etc.). Without ADR, they cannot distinguish "we chose this for reasons that still hold" from "we chose this by accident." ADR answers "why" so new context triggers valid re-evaluation, not accidental replay.*

### Evaluating State Solutions: Decision Matrix

Systematic evaluation prevents recency bias ("Jotai is popular, use Jotai"). Matrix across dimensions:

| Criteria | useState | Context | Redux Toolkit | Zustand | Jotai |
|----------|----------|---------|---------------|---------|-------|
| Bundle size | 0KB | 0KB | 18.5KB | 1.1KB | 3.4KB |
| Provider needed | No | Yes | Yes | No | No |
| Re-render control | Manual | All consumers | Selectors | Selectors | Atomic |
| Boilerplate per feature | None | Low | Medium | Low | Low |
| SSR support | Native | Native | With provider | Vanilla API | SSR adapter |
| DevTools | React DevTools | React DevTools | Redux DevTools | Redux DevTools | Custom |
| Middleware ecosystem | None | None | Rich (saga/thunk) | Basic | Minimal |
| Learning curve | None | Low | Medium | Low | Medium |
| Best for | Local state | Low-frequency global | Large teams, complex state | Medium apps, cross-cutting | Atomic derived state |

Criteria weights depend on project. Example weighting:

```
Project: E-commerce dashboard
Weighted score (1-5 each, criteria weighted):
- Bundle size: 4 (mobile users) → Zustand 5, Redux 1
- Re-render control: 5 (performance critical) → Zustand/Redux 4, Context 2
- Learning curve: 4 (team of juniors) → Zustand/Context 5, Redux 2
- Middleware: 2 (simple API calls) → Redux 5, Zustand 3
- DevTools: 3 (debugging helpful) → Redux/Zustand 5

Total: Zustand wins for this project profile.
```

> **Think**: A team of 2 building a prototype with 3 global state values. Redux wins on middleware score (5) but loses on every other dimension. What evaluation mistake happened?
>
> *Answer: No context weighting. Middleware scored high but team of 2 building prototype does not need sagas or thunks. Over-weighting irrelevant criteria skewed result. Score must be multiplied by importance weight derived from project constraints. Without weights, decision matrix is misleading precision.*

### Store Architecture Documentation: Boundaries, Ownership, API

ADR must define **store boundaries** (what goes in which store), **ownership** (which team/module owns each slice), and **selector API** (what external consumers depend on).

**Store boundaries template:**
```
## Store Map
| Store | Domain | Owned by | Consumer count | Data lifetime |
|-------|--------|----------|----------------|---------------|
| auth | Auth, session | Platform team | 45 components | Session |
| cart | Shopping cart | Cart team | 12 components | Browser tab |
| ui | Theme, sidebar, modals | Platform team | 30 components | Device |
| product-filter | Filter, sort, search | Catalog team | 8 components | Page view |
```

**Ownership rules:**
- Single owner per store: one team writes mutations, all teams read
- No cross-store transactions: if Auth store + Cart store must update atomically, architects mixed boundary
- Store file lives in owning team's directory: `src/platform/stores/auth-store.ts`, `src/cart/stores/cart-store.ts`

**Selector API commitment:**
- Public selectors: documented, versioned, tested. Breaking changes require ADR update.
- Private selectors: internal to owning team, may change without notice.
- Shape contract: `useAuthStore((s) => s.user)` — consumer reads `user` shape. If shape changes, all consumers break.

```typescript
// Public API — documented, tested, semver
export const selectUser = (s: AuthStore) => s.user
export const selectIsLoggedIn = (s: AuthStore) => s.user !== null

// Private — internal to auth store, may change
const selectSessionToken = (s: AuthStore) => s.session.token
```

> **Think**: A cart team stores `items: CartItem[]` in their store. Platform team wants to read cart count for a badge. Should Platform team import `selectCartItems` from cart store?
>
> *Answer: Yes, if Cart store exports a public selector `selectCartCount`. No, if Platform team reaches into Cart store's internal `items` shape. The store owner exports only what external consumers need. If Cart team renames `items` to `entries`, Platform teams using `selectCartCount` do not break. Those importing `items` directly do.*

### Performance Decision: Atomic Stores vs Monolithic Store

Central tension: one big store vs many small stores.

**Monolithic store:**
```typescript
// One store for everything
const useAppStore = create<AppStore>((set) => ({
  user: null,
  items: [],
  cart: [],
  theme: 'light',
  sidebarOpen: true,
  notifications: [],
  settings: {},
  // ... grows as app grows
}))
```

- Pros: single `getState()` call, simple import, easy cross-slice reads
- Cons: selector granularity must be precise or whole app re-renders on any change; one Zustand "context" shared implicitly

**Atomic stores (recommended):**
```typescript
// Separate stores per domain
const useAuthStore = create<AuthStore>(...)
const useCartStore = create<CartStore>(...)
const useUIStore = create<UIStore>(...)
```

- Pros: isolated re-renders, clear ownership, independent testing, no accidental cross-slice coupling
- Cons: cross-store reads require importing multiple stores; more files

**Decision matrix:**

| Factor | Monolithic | Atomic |
|--------|-----------|--------|
| Cross-slice reads | Trivial | Multi-import |
| Re-render isolation | Must use fine selectors | Natural per-store boundary |
| Testing | Single store setup | Per-store setup |
| Team ownership | Unclear | Clear per store |
| Refactoring risk | High (touching shared shape) | Low (per-store) |
| Bundle splitting | Hard (single chunk) | Natural (lazy-load stores) |

> **Think**: E-commerce app: auth, cart, product catalog, search, notifications. How many stores? Where is the boundary between "atomic" and "too many stores"?
>
> *Answer: 5 stores — one per domain. Not "too many." Each has clear ownership, independent lifecycle, separate consumers. Too many stores = 50 stores for 50 small pieces where cross-reads are constant. Rule of thumb: if you import 5+ stores in every component, they might be one domain split too thin. Consolidate stores that always read together.*

### Testing Strategy Documentation: What to Test at Store vs Component Level

ADR documents testing boundaries — what each test level validates.

**Store-level tests (unit):**
```typescript
describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState(initialAuthState)
  })

  it('login sets user', async () => {
    mockApi.login.mockResolvedValue({ user: { id: '1', name: 'Alice' } })
    await useAuthStore.getState().login('alice@example.com', 'pw')
    expect(useAuthStore.getState().user?.name).toBe('Alice')
  })

  it('login sets error on failure', async () => {
    mockApi.login.mockRejectedValue(new Error('Invalid credentials'))
    await useAuthStore.getState().login('bad@example.com', 'pw')
    expect(useAuthStore.getState().error).toBe('Invalid credentials')
  })

  it('logout clears user', () => {
    useAuthStore.setState({ user: { id: '1', name: 'Alice' } })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
```

**What to test at store level:**
- Action logic: does state change correctly?
- Async lifecycle: loading → success/error transitions
- Edge cases: empty state, concurrent actions, error recovery
- Selector output: derived values from store state

**Component-level tests (integration):**
```typescript
it('renders user name from store', () => {
  useAuthStore.setState({ user: { id: '1', name: 'Alice' } })
  render(<UserProfile />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

it('dispatches login on button click', async () => {
  render(<LoginForm />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
  fireEvent.click(screen.getByText('Login'))
  await waitFor(() => {
    expect(mockApi.login).toHaveBeenCalledWith('a@b.com')
  })
})
```

**What to test at component level:**
- Rendering: correct UI for given store state
- Interaction: user action triggers correct store method
- Error display: store error state → error UI
- NOT: store logic itself (tested at store level)

**ADR testing section template:**
```
## Testing Strategy
| Test level | Scope | Files | Run frequency | Owner |
|------------|-------|-------|---------------|-------|
| Store unit | State mutations, action logic | stores/*.test.ts | CI per commit | Store owner |
| Component integration | UI renders from store state | components/*.test.tsx | CI per PR | Component owner |
| E2E | Full user flow (login → cart → checkout) | e2e/*.spec.ts | CI per deployment | QA |
```

> **Think**: A login form test fails. Logout test fails too. Both call `useAuthStore.getState().login()` and `logout()`. Is the bug in the store or the component?
>
> *Answer: Bug is likely in store — both failures involve store actions. If store tests also fail, confirm store logic. If store tests pass but component tests fail, component uses store incorrectly (wrong selector, wrong action called, missing await). Store-level tests isolate the root cause before debugging component interaction.*

### Migration ADR: Documenting Migration Plan, Rollback Criteria, Success Metrics

Migration ADR is specialized template for state management migrations. Structure:

```
ADR: Migrate Cart from Context to Zustand
Status: Draft → Proposed → Accepted → Implemented → Closed

## Context
Cart uses Context with useReducer. 15 components consume cart context.
Re-renders: any cart change re-renders all 15 + parents up to provider.
Performance: cart interaction adds 35ms to frame time.

## Decision
Migrate cart to Zustand. Incremental: one store, module-by-module component migration.

## Migration Plan
| Step | Description | Duration | Risk |
|------|-------------|----------|------|
| 1 | Create Zustand cart store (mirror reducer logic) | 1 day | Low |
| 2 | Add parity tests (same inputs, same outputs) | 1 day | Low |
| 3 | Migrate CartBadge component (reads count) | 2 hours | Low |
| 4 | Migrate CartPage (reads full state) | 4 hours | Medium |
| 5 | Migrate CheckoutButton (writes checkout action) | 2 hours | Medium |
| 6 | Remove Context provider after all consumers migrated | 1 hour | Low |
| 7 | Delete old reducer, context definition, tests | 30 min | None |

## Rollback Criteria
- Re-render count not reduced by 50% after migration of first 3 components
- Any production regression in cart functionality
- Bundle size increases (should decrease by ~2KB)
- Rollback: revert PRs per component, restore Context provider

## Success Metrics
| Metric | Before | Target | Measured after migration |
|--------|--------|--------|--------------------------|
| Re-renders on cart update | 15 components | ≤3 components | 2 components |
| Cart interaction frame time | 35ms | ≤10ms | 8ms |
| Bundle size (cart deps) | ~15KB (Context) | ~1KB (Zustand) | 1.2KB |
| Lines of code (cart state) | 145 LOC | ~70 LOC | 68 LOC |

## Review Notes
- Approved by: Senior frontend engineer, Tech lead
- Concerns addressed: No provider nesting change needed; selector granularity handles re-renders
- Date: 2024-07-10
```

**Rollback criteria** must be objective and pre-agreed. If migration passes metrics, keep. If fails, revert. No "we spent 2 weeks, let's keep it" — that is sunk cost fallacy.

> **Think**: Migration passes 3 of 4 success metrics but misses "re-renders ≤3" (actual: 5). Do you revert?
>
> *Answer: Depends on rollback criteria written in ADR. If criteria says "re-render count not reduced by 50%" — actual is 87% reduction (15 → 5), so criteria passes. If criteria says "≤3" — fails, revert. Ambiguous criteria cause arguments. Write measurable thresholds in ADR before migration starts.*

### Team Conventions ADR: Store Patterns, Naming, File Organization

Team conventions ADR documents shared patterns for consistency across all stores.

```
ADR: Zustand Team Conventions
Status: Accepted

## Store Organization
src/
  stores/
    auth-store.ts
    cart-store.ts
    ui-store.ts
    product-filter-store.ts

File naming: {domain}-store.ts (kebab-case, -store suffix)
One file per store. Max 200 lines per store file.

## Store Definition Pattern
interface AuthStore {
  // State (nouns)
  user: User | null
  loading: boolean
  error: string | null

  // Actions (verbs)
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      user: null,
      loading: false,
      error: null,
      login: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const user = await api.login(email, password)
          set({ user, loading: false })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },
      logout: () => set({ user: null }),
      clearError: () => set({ error: null }),
    }),
    { name: 'auth-store' }
  )
)
```

**Convention rules:**
1. Store files in `src/stores/` directory, one per domain
2. State declared as interface with state fields (nouns) and actions (verbs)
3. Export `use{Name}Store` hook as default consumer API
4. Use `devtools` middleware in development
5. Actions are async methods, not dispatched objects
6. Selectors inline for simple reads, exported for reused logic
7. No cross-store imports inside store files (store reads other store via `get()` from outside)
8. Max 200 lines per store — if exceeds, split domain

> **Think**: A store reaches 250 lines. Developer argues "splitting adds complexity." When do you enforce the 200-line rule?
>
> *Answer: When the store mixes two domains. 250 lines for auth + user preferences: split. 250 lines for complex auth with 5 API endpoints, 3 role types, session management: auth alone is one domain. Consider increasing limit to 300 before split. The line limit exists to force domain decomposition questions, not as rigid cap.*

### Reviewing ADRs: Criteria for Accepting or Rejecting State Architecture Decisions

ADR review process prevents bad decisions from shipping. Standard review criteria:

**Accept criteria (all must pass):**
1. **Context clear**: reader understands problem without prior knowledge
2. **Alternatives considered**: at least 2 alternatives evaluated (not strawman)
3. **Tradeoffs explicit**: both pros and cons listed for chosen option
4. **Consequences stated**: positive and negative outcomes of decision
5. **Rollback plan exists**: conditions under which decision should be reversed
6. **Success metrics defined**: measurable, time-bound
7. **Stakeholders listed**: who was involved, who approves

**Reject reasons (any triggers rejection):**
- Missing alternative: "we chose X because it's what we know" — no comparison
- One-sided tradeoffs: only pros listed, no cons
- Vague metrics: "better performance" without baseline or target
- No rollback: decision treated as permanent with no reversal criteria
- Misunderstood constraint: "bundle size critical" but chosen solution has larger bundle
- Team not consulted: store affects 3 teams, only 1 team wrote decision

**Review template:**
```
ADR Review: [Title]
Reviewer: [Name]
Date: [Date]

□ Context adequate for uninformed reader?
□ Alternatives evaluated (≥2)?
□ Tradeoffs balanced (pros and cons)?
□ Consequences documented?
□ Rollback plan specified?
□ Success metrics measurable?
□ Affected stakeholders reviewed?

Comments:
________________________________________

Verdict: [Accept / Revise / Reject]
```

> **Think**: A junior dev submits ADR choosing Zustand over Redux. ADR has good tradeoffs but mentions no alternatives. Do you reject?
>
> *Answer: Revise, not reject. Ask for Context + Jotai evaluation. ADR framework is teaching tool too. Rejection punishes good effort. Revise instruction: "Add Context and Jotai comparison, even briefly. Helps future readers understand why Zustand, not just that Zustand was chosen."*

### Real Example: ADR for Migrating E-Commerce App from Context to Zustand

Complete ADR for a real scenario:

```
ADR: 007 — Migrate Cart State from React Context to Zustand
Status: Implemented
Date: 2024-08-01
Deciders: Alice (FE lead), Bob (cart team), Carol (platform team)

## Context
Cart feature uses React Context + useReducer. 15 components consume cart context
across header (badge), page (list), and modal (quick add).

Performance problem: adding item to cart re-renders all 15 consumers +
any parent up to provider boundary. Profiler shows 45ms frame time on "add to cart."

Developer experience problem: adding new cart feature requires:
1. New context value + useMemo wrapping
2. New Context.Provider wrapping
3. All consumers re-render regardless of which value changed

## Considered Alternatives

### A. Context + useReducer (current) — Status quo
- Pros: No new dependency, team knows pattern
- Cons: Provider nesting, unnecessary re-renders, new feature overhead
- Cost: $0

### B. Zustand (selected)
- Pros: No provider, granular selectors, 1.1KB bundle, devtools middleware
- Cons: New dependency, team ramp-up
- Cost: 1 week for first store, then per-feature savings

### C. Redux Toolkit
- Pros: Rich ecosystem, sagas for side effects
- Cons: 18.5KB bundle, Provider required, ceremony for small cart domain
- Cost: Overkill for 15-component domain

## Tradeoffs
| Concern | Context | Zustand |
|---------|---------|---------|
| Re-renders per cart action | 15+ | N (subscribed selectors) |
| Bundle impact | 0KB | +1.1KB |
| Team learning | 0 days | ~3 days |
| New cart feature LOC | ~50 lines | ~15 lines |
| Test setup | Provider wrapper | Store.setStore() |

## Consequences
Positive:
- Re-renders drop from 15+ to 1-3 per cart action
- No Provider in component tree
- Cart feature code reduces ~60%
- DevTools timeline visible

Negative:
- Cart team learns new API
- No built-in entity adapter (manual CRUD)

Risks:
- Zustand ecosystem smaller than Redux
- Mitigation: cart is small domain, unlikely to need complex middleware

## Migration Plan
Week 1:
- Create Zustand cart store (mirror reducer)
- Parity tests: 10 test cases comparing old → new outputs
- Feature flag: toggle cart between Context and Zustand

Week 2:
- Migrate CartBadge (1 component, reads count)
- Migrate AddToCartButton (3 components, writes)
- Dual-write in staging for 48h

Week 3:
- Migrate CartPage (full state read/write)
- Cut over: 10% → 50% → 100% over 3 days
- Remove Context provider and reducer

## Rollback Criteria
- Re-renders not reduced by at least 60%
- Any user-facing cart regression
- Bundle size increases more than 2KB
- Rollback: revert PRs, restore Context provider

## Success Metrics
| Metric | Before | Target | Actual (2 weeks post) |
|--------|--------|--------|----------------------|
| Re-renders on add to cart | 15+ components | ≤3 | 2 |
| Frame time (add to cart) | 45ms | ≤15ms | 12ms |
| Bundle size (cart deps) | ~0KB (Context) | ≤2KB | 1.1KB |
| Cart feature LOC | 210 | ≤120 | 85 |
| Test setup time per test | 15s (wrap provider) | ≤1s | 0s |

## Review
- Alice (FE lead): Approved. Selector granularity directly addresses re-render pain.
- Bob (cart team): Approved. Concern about learning curve. Mitigation: pair programming for week 1.
- Carol (platform): Approved. Ensure cart store does not import other stores.

## Lessons Learned
1. Migration took 2.5 weeks vs estimated 3 — easier than expected
2. Parity testing caught 2 edge cases where Context initializer differed from Zustand initial state
3. Team prefers Zustand pattern after first week — no desire to revert
```

> **Think**: ADR was written 3 months ago. Cart team adds "save for later" feature. Should they update the ADR?
>
> *Answer: Not necessary. ADR documents the migration decision, not every feature addition. Update ADR only if: (1) a new alternative would have changed the original decision, (2) success metrics no longer hold, (3) consequences not predicted occurred. "Save for later" is normal feature work within existing Zustand architecture. Write a new ADR if save-for-later requires a separate store or new middleware.*

### ADR Template for State Management Decisions

Reusable template:

```
ADR: [Number] — [Title]
Status: [Draft / Proposed / Accepted / Deprecated / Superseded]
Date: [YYYY-MM-DD]
Deciders: [Names / Roles]

## Context
[Why decision needed? What problem? Current state? Constraints? 2-5 sentences.]

## Decision
[What was decided? One sentence.]

## Considered Alternatives
### A. [Option 1] — [Current / Status quo]
- Pros: [List 2-3]
- Cons: [List 2-3]

### B. [Option 2] — [Selected / Runner up]
- Pros:
- Cons:

### C. [Option 3]
- Pros:
- Cons:

## Tradeoffs
| Dimension | Option A | Option B | Option C |
|-----------|----------|----------|----------|

## Consequences
Positive:
- [List expected benefits]

Negative:
- [List expected costs]

Risks:
- [Risk] → Mitigation: [Plan]

## Rollback Plan
[Conditions under which decision reverses. Concrete criteria.]

## Success Metrics
| Metric | Baseline | Target | Measured |
|--------|----------|--------|----------|
| [Metric] | [Current value] | [Target value] | [Actual] |

## Review
- [Reviewer]: [Approved/Reject + reason]
```

**Usage rules:**
- One ADR per decision. If two decisions linked, write two ADRs referencing each other.
- Status follows lifecycle: Draft → Proposed → Accepted → Implemented → Closed (or Deprecated/Superseded)
- Keep ADR under 1 page. If longer, split — decision is too complex for single ADR.
- Store in repository: `docs/adrs/` directory. Filename: `NNNN-title.md` (zero-padded number + kebab-title).

> **Think**: A team has 50 ADRs in `docs/adrs`. How does a new engineer find the one about why Zustand was chosen?
>
> *Answer: ADR index file (`docs/adrs/README.md` or `INDEX.md`) lists all ADRs with title, status, and one-line summary. Search by keyword (`grep -ri 'zustand' docs/adrs/`). ADRs that supersede older ones should reference them: "Supersedes ADR-0012 (Context selection)." New engineer reads index, picks relevant ADR, follows reference chain if superseded.*

---

### Why This Matters

State architecture decisions are the most expensive decisions in frontend development. Wrong choice costs months in refactoring, re-render bugs, and dev velocity. ADRs make these decisions explicit, reviewable, and reversible. Teams that document state architecture decisions spend less time re-litigating "why did we pick this?" and more time shipping features. The ADR discipline separates engineering organizations that make deliberate architecture choices from those that drift into accidental architecture. This capstone module synthesizes every previous module — store boundaries, slices, selectors, atomic stores, persistence, migration, testing — into one documented, reviewable, measurable architecture decision.

---

### Common Questions

**Q: How is an ADR different from a design doc?**
A: ADR focuses on one decision, not full design. Design doc explores problem space, ADR captures single decision outcome. ADRs are lighter (1 page), machine-searchable, and version-controlled. Write design doc for exploration, ADR for decision capture.

**Q: Who writes ADRs? Who reviews?**
A: Anyone can write. Tech lead + affected team members review. For state management ADRs, include at least one engineer from each team whose components consume the store. ADR review is lighter than RFC — 2-3 reviewers, 1-2 day review cycle.

**Q: When should an ADR be updated vs deprecated?**
A: Update when decision still holds but context changed (e.g., success metric target adjusted). Deprecate when decision is reversed (e.g., migrating away from Zustand). Superseded when replaced by new ADR (e.g., ADR-007 supersedes ADR-003). Never delete ADRs — history matters.

**Q: What if no one reads ADRs?**
A: Make ADRs part of the review process. PR that touches store architecture must reference relevant ADR. CI check: if store changes without ADR number in PR description, flag for review. Cultural adoption takes time — start with one ADR per quarter, increase as team sees value.

**Q: Can ADRs be used for non-state decisions?**
A: Yes. ADR format generalizes to any architecture decision: library selection, build tool choice, API design pattern, deployment strategy. State management ADR is this module's focus, but the template and review criteria apply universally.

---

## Examples

### Example 1: Choosing Zustand vs Redux for a Fintech Dashboard

**Problem**: Fintech dashboard needs real-time trade data, complex derived metrics, multiple data sources. Team of 8. Performance critical — re-render lag costs users money.

**ADR summary**:
- **Context**: Dashboard aggregates real-time trade data, portfolio metrics, risk calculations. 40 components. Re-render latency currently 80ms on data refresh (Context).
- **Alternatives**: Zustand (selected), Redux Toolkit, Jotai
- **Decision**: Zustand + atomic stores per domain (trades, portfolio, risk, UI)

**Key tradeoffs driving decision**:
| Concern | Zustand | Redux Toolkit |
|---------|---------|---------------|
| Re-render control | Granular selectors | Granular selectors (equal) |
| Bundle (mobile web) | 1.1KB | 18.5KB |
| Real-time data (WebSocket) | Async action | Thunk/saga (more mature) |
| Complex derived state | External (reselect or manual) | createSelector |
| Team learning | 1 week (new) | Already know (existing) |

**Why Zustand won**: Redux knowledge exists but bundle + re-render concerns outweighed. Derived state handled by custom `useMemo` in selectors. Real-time WebSocket lives in action method, not saga — simpler.

**Result**: Bundle -17KB, re-renders 40 → 6 per data refresh, team productive after 1 week.

### Example 2: ADR for Adding Persistence to Cart Store

```
ADR: 012 — Cart Store Persistence with localStorage
Status: Accepted
Date: 2024-10-01

Context: Cart store lives in memory. User refreshes page, cart lost.
  Customer complaints about re-adding items each visit.

Decision: Add Zustand persist middleware to cart store.

Alternatives considered:
  A. persist middleware (selected) — 2 lines added, works out of box
  B. Manual localStorage sync — more control, more boilerplate
  C. Server-side cart persistence — requires backend changes, not scoped

Tradeoffs:
  - persist middleware is scoped to browser — no SSR
  - Cart store init reads from localStorage before server data arrives
  - Migration: existing cart data must be compatible with persisted shape

Consequences:
  - Cart survives page refresh (+ user satisfaction)
  - Bundle +0.5KB (persist middleware)
  - Must handle mismatch between persisted localStorage shape and new store shape (version migration)

Success metrics:
  - Cart retention on refresh: 0% → 100%
  - Customer complaints: reduced by estimated 30%
```

**Result**: persist middleware added in 15 minutes. Cart survives refresh. 2 weeks later, no regressions. Customer complaints about cart loss dropped 90%.

### Example 3: ADR for Splitting Monolithic Store

```
ADR: 015 — Split AppStore into Domain Stores
Status: Accepted
Date: 2024-11-15

Context: AppStore holds auth, cart, UI, notifications, settings.
  400 lines. 5 teams own different slices. PR conflicts weekly on
  the same file. Testing setup loads entire app state for single-domain tests.

Decision: Split into 5 stores: auth, cart, ui, notifications, settings.

Migration: New stores created alongside AppStore. Each team migrates
  own domain over 2 weeks. AppStore deleted after all migrated.

Results: PR conflicts reduced 80%. Test setup simplified. Each store
  testable in isolation. Bundle unchanged (same total state).
```

> **Think**: Team splits monolithic store into 5. After 1 month, a new employee asks "why is this app using 5 stores instead of 1?" What do you point them to?
>
> *Answer: ADR-015. They read context (PR conflicts, test overhead, ownership ambiguity), alternatives considered (keep monolithic, split by team, split by data lifetime), and results. No need to re-litigate. If new context arises (e.g., 5 stores now cause cross-store query overhead), they open new ADR to re-evaluate.*

---

## Key Takeaways
- ADR captures one architecture decision: context, alternatives, tradeoffs, consequences, success metrics
- Decision matrix evaluates state solutions across weighted criteria — avoid recency bias
- Store architecture ADR defines boundaries (one per domain), ownership (one team per store), selector API (public vs private)
- Monolithic vs atomic stores: atomic wins for ownership + re-render isolation; monolithic for cross-slice read simplicity
- Testing strategy ADR documents store-level (logic, actions) vs component-level (UI from store state) boundaries
- Migration ADR includes plan, rollback criteria, and success metrics — avoid sunk cost fallacy
- Team conventions ADR standardizes naming, file structure, store patterns across all stores
- ADR review criteria: context clear, ≥2 alternatives, balanced tradeoffs, measurable metrics, rollback plan
- Real example: migration from Context to Zustand reduced re-renders from 15+ to 2, LOC 210 to 85, frame time 45ms to 12ms
- Reusable ADR template: one decision per ADR, 1-page max, stored in `docs/adrs/`, lifecycle from Draft to Closed

## Common Misconception

**"ADR is bureaucracy — writing docs slows us down."**

ADR format is 1 page. Writing takes 30 minutes. What costs time: re-litigating the same decision 6 months later with different team members, discovering migration breaks another team's store because no ownership was documented, or debugging re-render issues because store boundaries were never explicit. An ADR is insurance against tribal knowledge loss. Teams that "move fast without documentation" spend 2x time rediscovering decisions. The ADR is not the overhead. Hidden overhead is undocumenting decisions and paying the tax every time context changes.

---

## Feynman Explain
(Explain ADR to a product manager who knows "state management" exists but not details. Use a real estate analogy: ADR is the deed for a property decision. It records who owns which piece of the frontend, why they chose that plot, what it cost, and when they might need to move to a different plot. The deed does not build the house — it prevents neighbors from fighting over the same land.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Judge: When is ADR overkill? For a solo developer building a prototype, does ADR-001 on state management choice add value? For a 2-person startup, what is the minimum viable ADR — one sentence in a README? For a 20-person team, is 1-page ADR too light? Write your evaluation. Consider the spectrum from "no documentation" to "formal ADR" and where each team size falls on that spectrum.)

---

## Drill
Take the quiz. MCQs test ADR structure, decision matrix weighting, store boundary documentation, migration criteria, review process, and the real e-commerce migration example.

Run: `learn.sh quiz zustand-state-management 20-adr-capstone`
