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
