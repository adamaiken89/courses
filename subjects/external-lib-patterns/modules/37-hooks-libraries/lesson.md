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
