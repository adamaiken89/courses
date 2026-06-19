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
