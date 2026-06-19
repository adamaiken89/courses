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
