# Module 8: Testing Library Ecosystem — Query Best Practices

Est. study time: 2h
Language: en
Description: Master testing-library queries with the priority system. Write resilient tests that survive refactors.

## Learning Objectives
- Apply query priority: getByRole > getByLabelText > getByText > getByTestId
- Write accessible queries that match user experience
- Use data-testid as intentional contract, not escape hatch
- Avoid fragile CSS-class-based queries

---

## Core Content

### 8.1 The Query Priority

testing-library defines a clear query priority. Follow it in order:

```
1. getByRole        — accessible name, best for user behavior
2. getByLabelText   — form inputs, label associations
3. getByPlaceholderText — secondary for inputs
4. getByText        — visible text content
5. getByDisplayValue — form values
6. getByAltText     — images, inputs with alt text
7. getByTitle       — tooltip / title attribute
8. getByTestId      — last resort, data-testid attribute
```

Each step down is more coupled to implementation. `getByRole` tests what the user perceives. `getByTestId` tests what the developer named the element.

```typescript
// ❌ Fragile — Tailwind class selector
container.querySelector('.bg-blue-500 button')

// ❌ Fragile — test ID when role works
screen.getByTestId('submit-button')

// ✅ Resilient — accessible role + name
screen.getByRole('button', { name: /submit/i })

// ✅ Explicit when element has no accessible role
screen.getByText('No courses available')
```

> **Think**: Why does getByRole survive component refactors?
>
> *Answer: Roles are part of the accessibility tree, not the visual design. Changing from `<button>` to `<div role="button">` breaks accessibility but users don't care — but tests using `getByRole` still work. Changing from `bg-blue-500` to `bg-green-600` breaks CSS-class queries silently.*

### 8.2 getByRole — The Gold Standard

`getByRole` queries by ARIA role and optional accessible name.

```typescript
// Basic role query
screen.getByRole('button')
screen.getByRole('heading')
screen.getByRole('textbox')
screen.getByRole('list')
screen.getByRole('listitem')
screen.getByRole('dialog')
screen.getByRole('tab')
screen.getByRole('progressbar')

// With accessible name (most specific)
screen.getByRole('button', { name: /submit/i })
screen.getByRole('heading', { name: /course details/i })
screen.getByRole('tab', { name: /overview/i })

// Level for headings
screen.getByRole('heading', { level: 1 })

// With state
screen.getByRole('button', { name: /next/i, pressed: true })
screen.getByRole('checkbox', { checked: false })
```

**The accessible name** is computed from:
- `aria-label`
- `aria-labelledby`
- Inner text content (for buttons, links)
- Associated `<label>` element (for inputs)

```typescript
// These all match getByRole('button', { name: /save/i })
<button>Save</button>
<button aria-label="Save"><Icon icon="floppy" /></button>
<button aria-labelledby="save-label"><span id="save-label">Save</span></button>
```

> **Think**: What happens when getByRole can't find an element?
>
> *Answer: It throws a clear error listing all elements with that role and their accessible names. This is better than getByTestId which just says "not found" — you see what IS in the DOM.*

### 8.3 The data-testid Contract

`data-testid` is the only query that survives all refactors — but it's also the most coupled to implementation.

**When to use data-testid:**
- Element has no accessible role (decorative SVG, custom component without ARIA)
- Element has no visible text (icon-only button)
- Need to disambiguate multiple elements with same role and text
- The element's content is dynamic and unpredictable

**When NOT to use:**
- When `getByRole` or `getByText` works (most cases)
- As first choice — always try role/text first
- For CSS/styling verification (not test responsibility)

```typescript
// ✅ Good use — icon-only button with no accessible name
<button data-testid="sort-asc" onClick={sortAsc}>
  <ArrowUpIcon />
</button>

// ❌ Bad use — button has visible text
<button data-testid="submit-btn">Submit</button>
// Use: getByRole('button', { name: /submit/i })

// ✅ Good use — dynamic list items need specific selection
// But try getByRole('listitem', { name: ... }) first
```

**Naming convention for data-testid:**
- kebab-case: `data-testid="course-list-item"`
- Descriptive, not presentational: `data-testid="loading-spinner"` not `data-testid="blue-div"`
- Consistent pattern: `<Component>-<element>` prefixed by component name

> **Think**: What's the cost of using data-testid when getByRole would work?
>
> *Answer: The test breaks if someone removes or renames the data-testid attribute without changing behavior. getByRole tests the behavior (is there a button with label "Submit"?), not the implementation (is there an element with testid="submit"?).*

### 8.4 queryBy vs getBy vs findBy

| Query | Returns | If Not Found |
|---|---|---|
| `getBy*` | Element | Throws — test fails immediately |
| `queryBy*` | Element or null | Returns null — test continues |
| `findBy*` | Promise<Element> | Throws after timeout — async wait |

```typescript
// getBy* — element MUST exist
expect(screen.getByText('Submit')).toBeInTheDocument()

// queryBy* — element MAY exist (asserting absence)
expect(screen.queryByText('Loading')).not.toBeInTheDocument()

// findBy* — element WILL appear async
expect(await screen.findByText('Data loaded')).toBeInTheDocument()
```

**Rule of thumb:**
- Use `getBy*` when element must be in DOM
- Use `queryBy*` with `.not.toBeInTheDocument()` to assert absence
- Use `findBy*` for async-appearing elements
- Never use `queryBy*` with `.toBeInTheDocument()` — use `getBy*` instead

```typescript
// ❌ Redundant — queryBy returns null, wrapping in expect
expect(screen.queryByText('Submit')).toBeTruthy()

// ✅ Clear — getBy throws if not found
expect(screen.getByText('Submit')).toBeInTheDocument()

// ❌ Broken pattern — queryBy with toBeInTheDocument
expect(screen.queryByText('Submit')).toBeInTheDocument()
// queryBy returns null → expect(null).toBeInTheDocument() → fails with confusing message
```

> **Think**: Why does `expect(queryByText('x')).not.toBeInTheDocument()` work but `expect(queryByText('x')).toBeInTheDocument()` is wrong?
>
> *Answer: queryBy returns null if not found. `expect(null).not.toBeInTheDocument()` passes (null is not in document). `expect(null).toBeInTheDocument()` fails with "null is not in the document" — a confusing error. Use getBy for positive assertions (it throws with a clear "element not found" message).*

### 8.5 Multiple Elements — getAllBy, queryAllBy, findAllBy

```typescript
// Single element
screen.getByRole('listitem')

// Multiple elements
screen.getAllByRole('listitem') // throws if none found
screen.queryAllByRole('listitem') // returns [] if none found
screen.findAllByRole('listitem') // async, throws if none after timeout
```

**Testing list rendering:**

```typescript
test('renders 3 courses', async () => {
  render(<CourseList />)
  const items = await screen.findAllByRole('listitem')
  expect(items).toHaveLength(3)
})

// Sequential assertions
test('first item is most recent', async () => {
  render(<CourseList />)
  const items = await screen.findAllByRole('listitem')
  expect(items[0]).toHaveTextContent(/course 3/)
})
```

### 8.6 Testing Accessibility

testing-library queries inherently test accessibility. If `getByRole` finds an element, it has a role in the accessibility tree.

```typescript
// This test also verifies accessibility:
test('navigation has correct aria labels', () => {
  render(<Navigation />)

  const nav = screen.getByRole('navigation', { name: /main/i })
  expect(nav).toBeInTheDocument()

  const links = within(nav).getAllByRole('link')
  expect(links).toHaveLength(4)
})
```

If you can't query an element with `getByRole`, it likely has an accessibility issue. This is testing-library's design: tests that verify user behavior also verify accessibility.

---

## Why This Matters

Query strategy determines test resilience. `getByRole` tests survive style refactors, markup changes, and component renames. CSS-class-based queries break on every visual change. The priority system ensures minimal maintenance.

---

## Common Questions

**Q: What if my app uses a design system that doesn't natively use semantic HTML?**
A: Add ARIA roles. This improves both accessibility and testability. A `<div>` that acts as a button should have `role="button"`.

**Q: Should I use within() for scoped queries?**
A: Yes. `within(container).getByRole('button')` scopes the query to a sub-tree. Useful for complex pages with repeated elements.

**Q: How do I query by partial text?**
A: Use regex: `getByText(/partial text/i)`. The `i` flag makes it case-insensitive.

---

## Key Takeaways

- Query priority: getByRole > getByLabelText > getByText > getByTestId
- getByRole tests accessible name — survives refactors
- data-testid is a contract, not an escape hatch — use only when no role/text works
- getBy* throws if not found, queryBy* returns null, findBy* waits async
- Use queryBy* only for `.not.toBeInTheDocument()` assertions
- Testing with getByRole inherently tests accessibility

---

## Common Misconception

**"data-testid is the most reliable query — it always works."**

data-testid is the most coupled to implementation. Removing or renaming the attribute silently breaks the test without changing behavior. getByRole tests what the user actually sees and interacts with — more reliable in the long run.

---

## Feynman Explain

(Explain the query priority order. Why is getByRole better than getByTestId? When would you use each level? Give a real example of a test breaking from a CSS change.)

---

## Drill

Run: `learn.sh quiz testing 8`
