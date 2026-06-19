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
