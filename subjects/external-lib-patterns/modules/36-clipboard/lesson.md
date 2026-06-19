# Module 36: Clipboard Utilities

Est. study time: 1h
Language: en

## Learning Objectives
- Use navigator.clipboard API for text and rich content copy
- Handle Permissions API for clipboard-read and clipboard-write
- Implement paste event sanitization for Excel/Word content
- Build custom useCopyToClipboard hook with React 19 patterns
- Understand clipboard security constraints (HTTPS, user gesture)
- Manage Client Component boundary in React 19 Server Components
---

## Core Content

### navigator.clipboard API

Modern browsers expose asynchronous clipboard access via `navigator.clipboard`. Two tiers: text-only and rich content.

```
// text write
await navigator.clipboard.writeText("text");

// text read
const text = await navigator.clipboard.readText();

// rich content write
await navigator.clipboard.write([
  new ClipboardItem({
    "text/plain": new Blob(["plain"], { type: "text/plain" }),
    "text/html": new Blob(["<b>rich</b>"], { type: "text/html" }),
  }),
]);

// rich content read
const items = await navigator.clipboard.read();
for (const item of items) {
  for (const type of item.types) {
    const blob = await item.getType(type);
  }
}
```

Async clipboard requires a secure context (HTTPS or localhost) and must be triggered by user gesture (click, keydown).

### Permissions API

Check availability before reading clipboard:

```typescript
const permission = await navigator.permissions.query({
  // @ts-expect-error clipboard-read experimental in some browsers
  name: "clipboard-read",
});
if (permission.state === "granted") {
  // read allowed
} else if (permission.state === "prompt") {
  // triggers browser prompt
}
```

clipboard-write permission is automatically granted in secure contexts. clipboard-read must be requested.

### Polyfill Strategy for Legacy Browsers

```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  // fallback: execCommand (deprecated but works)
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
}
```

### Rich Content Copy

Copy structured data (e.g., table from data grid) as HTML:

```typescript
interface GridRow {
  cells: string[];
}

function buildHtmlTable(rows: GridRow[]): string {
  const header = rows[0].cells.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = rows.slice(1).map(
    (r) => `<tr>${r.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
  ).join("");
  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function copyGrid(rows: GridRow[]): Promise<void> {
  const html = buildHtmlTable(rows);
  const plain = rows.map((r) => r.cells.join("\t")).join("\n");
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": new Blob([plain], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    }),
  ]);
}
```

### Paste Event Handling

```typescript
function onPaste(event: ClipboardEvent): void {
  event.preventDefault();
  const items = event.clipboardData?.items;
  if (!items) return;

  let html = "";
  let plain = "";

  for (const item of items) {
    if (item.type === "text/html") {
      item.getAsString((s) => { html = s; });
    } else if (item.type === "text/plain") {
      item.getAsString((s) => { plain = s; });
    }
  }
}
```

Paste sanitization strips dangerous HTML from Excel/Word:

```typescript
function sanitizePaste(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const allowed = ["p", "br", "ul", "ol", "li", "strong", "em", "a", "table", "thead", "tbody", "tr", "th", "td"];

  function clean(node: Node): Node {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (!allowed.includes(el.tagName.toLowerCase())) {
        const span = doc.createElement("span");
        while (el.firstChild) span.appendChild(clean(el.firstChild));
        return span;
      }
      if (el.tagName.toLowerCase() === "a") {
        el.setAttribute("href", el.getAttribute("href") || "#");
        el.removeAttribute("style");
      }
      el.removeAttribute("style");
      el.removeAttribute("class");
      Array.from(el.childNodes).forEach((child, _i) => {
        el.replaceChild(clean(child), child);
      });
    }
    return node;
  }

  clean(doc.body);
  return doc.body.innerHTML;
}
```

### Security Constraints

| Constraint | Detail |
|---|---|
| HTTPS required | Async clipboard throws in insecure context |
| User gesture | `click`, `keydown`, `touchstart` handler must initiate |
| Focus required | Document must have focus |
| Permission prompt | `clipboard-read` may show browser prompt |
| Same-origin | `read()` returns only same-origin data |

### React 19: useCopyToClipboard Hook

```typescript
"use client";

import { useCallback, useRef, useState, useTransition } from "react";

interface CopyState {
  copied: boolean;
  error: Error | null;
}

interface UseCopyToClipboardOptions {
  timeout?: number;
}

export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): {
  copy: (text: string) => Promise<void>;
  state: CopyState;
  reset: () => void;
} {
  const { timeout = 2000 } = options;
  const [{ copied, error }, setState] = useState<CopyState>({
    copied: false,
    error: null,
  });
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textarea);
          if (!ok) throw new Error("execCommand copy failed");
        }
        startTransition(() => {
          setState({ copied: true, error: null });
        });
        clearTimer();
        timerRef.current = setTimeout(() => {
          startTransition(() => {
            setState({ copied: false, error: null });
          });
        }, timeout);
      } catch (err) {
        setState({
          copied: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    },
    [clearTimer, timeout, startTransition]
  );

  const reset = useCallback(() => {
    clearTimer();
    setState({ copied: false, error: null });
  }, [clearTimer]);

  return { copy, state: { copied, error }, reset };
}
```

useTransition provides low-priority state update for copy feedback. React Compiler auto-memoizes `copy`, `reset` when compiled.

### React 19: Rich Content Copy Hook

```typescript
"use client";

import { useCallback } from "react";

interface RichClipboardItem {
  html: string;
  plain: string;
}

export function useRichCopy() {
  const copyRich = useCallback(async (item: RichClipboardItem) => {
    const clipboardItem = new ClipboardItem({
      "text/plain": new Blob([item.plain], { type: "text/plain" }),
      "text/html": new Blob([item.html], { type: "text/html" }),
    });
    await navigator.clipboard.write([clipboardItem]);
  }, []);

  return { copyRich };
}
```

### React 19 Server Components

Clipboard API = browser-only. Component must use "use client":

```typescript
// CopyButton.tsx — Client Component
"use client";

import { useCopyToClipboard } from "./useCopyToClipboard";

export function CopyButton({ value }: { value: string }) {
  const { copy, state } = useCopyToClipboard();

  return (
    <button
      className="inline-button"
      onClick={() => copy(value)}
    >
      {state.copied ? "Copied!" : "Copy"}
    </button>
  );
}
```

```typescript
// CodeBlock.tsx — Server Component
import { CopyButton } from "./CopyButton";

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre>
      <code>{code}</code>
      <CopyButton value={code} />
    </pre>
  );
}
```

Server Component renders static code; CopyButton is client island. React Compiler compiles CopyButton's callback once, no re-render overhead.

---

### Why This Matters

Clipboard is fundamental interaction. Users expect copy/paste to work like native apps. Rich content copy differentiates professional data tools. Paste sanitization prevents XSS and formatting corruption. React 19 Server Components force understanding of client boundary for browser APIs.

---

### Common Questions

**Q: Why does navigator.clipboard.read() return empty?**
A: Requires "clipboard-read" permission which most browsers prompt for. Also requires focused document and user gesture.

**Q: How to detect if clipboard API is available?**
A: Check `navigator.clipboard?.writeText`. For old browsers, check `document.execCommand("copy")` (deprecated but functional).

**Q: Does paste work in Server Components?**
A: No. Paste events are browser DOM events. Attach handler in Client Component with `onPaste` prop.

---

## Examples

### Example 1: Copy Table from Data Grid

```typescript
// DataGrid.tsx (Client Component)
"use client";

import { useCallback } from "react";
import { useRichCopy } from "./useRichCopy";

interface Column {
  key: string;
  header: string;
}

interface DataGridProps {
  columns: Column[];
  rows: Record<string, string>[];
}

function buildTableHtml(columns: Column[], rows: Record<string, string>[]): string {
  const head = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body = rows.map(
    (r) => `<tr>${columns.map((c) => `<td>${escapeHtml(r[c.key] ?? "")}</td>`).join("")}</tr>`
  ).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function buildTablePlain(columns: Column[], rows: Record<string, string>[]): string {
  const head = columns.map((c) => c.header).join("\t");
  const body = rows.map((r) => columns.map((c) => r[c.key] ?? "").join("\t")).join("\n");
  return `${head}\n${body}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function DataGrid({ columns, rows }: DataGridProps) {
  const { copyRich } = useRichCopy();
  const { copy, state } = useCopyToClipboard();

  const handleCopy = useCallback(() => {
    copyRich({
      html: buildTableHtml(columns, rows),
      plain: buildTablePlain(columns, rows),
    });
  }, [columns, rows, copyRich]);

  return (
    <div>
      <button className="inline-button" onClick={handleCopy}>
        {state.copied ? "Table Copied" : "Copy Table"}
      </button>
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Example 2: Paste Sanitizer for Rich Text Input

```typescript
"use client";

import { useCallback, useState } from "react";

export function RichPasteInput() {
  const [content, setContent] = useState("");

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    const sanitized = sanitizePaste(html || `<p>${escapeHtml(plain)}</p>`);
    setContent((prev) => prev + sanitized);
  }, []);

  const handleCopyPlain = useCallback(() => {
    (async () => {
      await navigator.clipboard.writeText(content);
    })();
  }, [content]);

  return (
    <div>
      <div
        contentEditable
        suppressContentEditableWarning
        onPaste={handlePaste}
        className="rich-editor"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      <button className="inline-button" onClick={handleCopyPlain}>
        Copy Plain
      </button>
    </div>
  );
}
```

---

## Key Takeaways
- navigator.clipboard API requires HTTPS + user gesture
- Rich content copy sends both text/plain and text/html in ClipboardItem
- Paste events need sanitization to strip Word/Excel styles
- Polyfill with execCommand for legacy browser support
- React 19: useClient + useTransition for copy feedback
- Server Components render static content; clipboard hooks live in Client Components
- React Compiler auto-memoizes copy callbacks when enabled

## Common Misconception

"**Paste sanitization only matters for security.**"

Sanitization also prevents layout breaks. Word paste includes inline styles (mso-*, font-family, absolute positioning) that clash with app CSS. Strip styles, keep only semantic HTML tags. Excel paste includes messy table markup with colgroup, col widths — normalize to simple thead/tbody.

## Feynman Explain

Clipboard = shared buffer between apps. navigator.clipboard.writeText puts string in buffer. navigator.clipboard.readText gets string from buffer. For tables, put two formats: plain (tab-separated, pastes into spreadsheet) and HTML (styled table, pastes into Word). Paste event is opposite flow: browser fires event with clipboard data, app reads and sanitizes before inserting.

## Reframe

Clipboard is poor man's data transfer protocol. navigator.clipboard.write is equivalent to writing response in HTTP — you control MIME types (text/plain, text/html). Paste sanitization is input validation for clipboard channel. Rich content copy = serialization format negotiation.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 36-clipboard`
