# Module 26: Markdown Rendering — react-markdown

Est. study time: 1.5h
Language: en

## Learning Objectives
- Understand react-markdown architecture (unified pipeline)
- Use remark plugins (remark-gfm, remark-frontmatter)
- Use rehype plugins (rehype-highlight, rehype-raw)
- Build custom renderers (code block with copy button, link handler)
- Create custom remark plugin (extract headings for TOC)
- Apply security practices (rehype-sanitize, allowedElements)
- Use React 19 Server Components for server-side markdown
- Implement Suspense boundaries for async markdown loading

---

## Core Content

### react-markdown Architecture

react-markdown uses unified ecosystem: markdown string → mdast (remark) → hast (rehype) → React elements.

```
Input String
  │
  ▼
remarkParse ────────────────────── parse to mdast
  │
  ▼
remarkPlugins (remark-gfm, custom) ─ transform mdast
  │
  ▼
remarkRehype ───────────────────── convert mdast → hast
  │
  ▼
rehypePlugins (rehype-highlight, custom) ─ transform hast
  │
  ▼
React Components ───────────────── render hast to JSX
```

```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeSanitize]}
    >
      {content}
    </ReactMarkdown>
  )
}
```

No dangerouslySetInnerHTML — unified pipeline produces safe React elements.

### Supported Markdown Features via remark-gfm

GFM (GitHub Flavored Markdown) adds:

| Feature | Example | Without remark-gfm |
|---------|---------|-------------------|
| Tables | `\| A \| B \|` | No table support |
| Strikethrough | `~~text~~` | Not rendered |
| Task lists | `- [x] done` | Rendered as checkbox? No |
| URL autolinks | `https://example.com` | No auto-link |
| Footnotes | `[^1]` | Not supported |

```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const markdown = `
| Feature | Status |
|---------|--------|
| Tables  | ✅     |
| Lists   | ✅     |

- [x] Completed task
- [ ] Pending task

This is ~~strikethrough~~ text.
`

function GfmDemo() {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
}
```

### Custom Renderers

Override default element rendering with `components` prop:

```typescript
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  className?: string
  children?: React.ReactNode
}

function CodeBlock({ className, children }: CodeBlockProps) {
  const match = /language-(\w+)/.exec(className ?? '')
  const code = String(children).replace(/\n$/, '')
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={copyToClipboard}
        style={{ position: 'absolute', right: 8, top: 8 }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <SyntaxHighlighter
        style={oneDark}
        language={match?.[1] ?? 'text'}
        customStyle={{ margin: 0 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

function MarkdownWithCodeBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        },
        pre({ children }) {
          return <CodeBlock>{children}</CodeBlock>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
```

Custom link renderer with external link indicator:

```typescript
function ExternalLink({
  href,
  children,
}: {
  href?: string
  children?: React.ReactNode
}) {
  const isExternal = href?.startsWith('http')
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
    >
      {children}
      {isExternal && <ExternalLinkIcon />}
    </a>
  )
}

<ReactMarkdown
  components={{
    a: ExternalLink,
  }}
>
  {markdownContent}
</ReactMarkdown>
```

### Custom Remark Plugin: Extract Headings as TOC

```typescript
import { visit } from 'unist-util-visit'
import type { Heading } from 'mdast'

interface TocEntry {
  id: string
  text: string
  depth: number
}

function remarkExtractHeadings() {
  const headings: TocEntry[] = []

  function transformer(tree: any) {
    visit(tree, 'heading', (node: Heading) => {
      const text = node.children
        .filter((child: any) => child.type === 'text')
        .map((child: any) => child.value)
        .join('')

      const id = text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')

      headings.push({ id, text, depth: node.depth })
    })
  }

  transformer.headings = headings
  return transformer
}

function MarkdownWithToc({ content }: { content: string }) {
  const plugin = remarkExtractHeadings()

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <nav style={{ width: 200, flexShrink: 0 }}>
        <h4>Table of Contents</h4>
        <ul>
          {plugin.headings
            .filter((h) => h.depth <= 3)
            .map((h) => (
              <li
                key={h.id}
                style={{ paddingLeft: (h.depth - 1) * 12 }}
              >
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
        </ul>
      </nav>
      <article style={{ flex: 1 }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, plugin]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h2: ({ children, ...props }) => {
              const id = String(children)
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '')
              return <h2 id={id} {...props}>{children}</h2>
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  )
}
```

### rehype-raw for HTML in Markdown

```typescript
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

<ReactMarkdown
  rehypePlugins={[rehypeRaw, rehypeSanitize]}
>
  {`
## Embed Video

<video controls width="100%">
  <source src="/intro.mp4" type="video/mp4" />
</video>

## Custom HTML

<div class="callout">
  <strong>Note:</strong> This is raw HTML embedded.
</div>
  `}
</ReactMarkdown>
```

rehype-raw parses embedded HTML tags into hast. Must use with rehype-sanitize to prevent XSS.

### Security with rehype-sanitize

```typescript
import rehypeSanitize from 'rehype-sanitize'

// Default: strips all HTML except safe elements (a, b, i, em, strong, code, pre, etc.)
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
  {userContent}
</ReactMarkdown>

// Custom allowlist
const schema = {
  ...rehypeSanitize.defaultSchema,
  attributes: {
    ...rehypeSanitize.defaultSchema?.attributes,
    code: ['className'],
    span: ['className', 'style'],
    div: ['className', 'data-*'],
  },
}

<ReactMarkdown rehypePlugins={[[rehypeSanitize, schema]]}>
  {userContent}
</ReactMarkdown>
```

Never render user-supplied markdown without rehype-sanitize. XSS vectors exist via `[xss](javascript:alert(1))` and raw HTML.

### React 19 Server Components for Markdown

```typescript
// MarkdownRenderer.server.tsx — Server Component
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Server-only: no client-side JS for rendering
async function MarkdownRenderer({ filePath }: { filePath: string }) {
  const fs = await import('fs/promises')
  const content = await fs.readFile(filePath, 'utf-8')

  return (
    <article>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </article>
  )
}

// Parent — Suspense for async file read
function LessonPage({ filePath }: { filePath: string }) {
  return (
    <Suspense fallback={<MarkdownSkeleton />}>
      <MarkdownRenderer filePath={filePath} />
    </Suspense>
  )
}
```

Server Components eliminate bundle cost of react-markdown (~8KB gzipped). Content rendered on server, sent as HTML.

### Suspense for Async Markdown Loading

```typescript
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Suspense, use } from 'react'

async function fetchMarkdown(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load markdown: ${res.status}`)
  return res.text()
}

function MarkdownContent({ markdownPromise }: { markdownPromise: Promise<string> }) {
  const content = use(markdownPromise)

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  )
}

function AsyncMarkdownPage({ url }: { url: string }) {
  const markdownPromise = fetchMarkdown(url)

  return (
    <Suspense fallback={<div>Loading content...</div>}>
      <MarkdownContent markdownPromise={markdownPromise} />
    </Suspense>
  )
}
```

React 19 `use()` hook consumes promise inside component, triggered by Suspense boundary. Eliminates manual loading state.

> **Think**: What happens to Copy button in code blocks when markdown renders in Server Component?
>
> *Answer: Copy button needs client interactivity. Use `'use client'` wrapper around only the code block component. Server Component handles markdown parsing, client component hydrates interactive parts. Pattern: server renders static content, client islands for interactivity.*

---

### Why This Matters

Markdown rendering appears in documentation sites, blog platforms, CMS editors, AI chat outputs, and help pages. Without structured rendering, apps fall back to dangerouslySetInnerHTML — XSS vulnerabilities. react-markdown provides safe, extensible pipeline with plugin ecosystem.

---

### Common Questions

**Q: react-markdown vs marked vs showdown?**
A: react-markdown uses unified pipeline (no dangerouslySetInnerHTML). Marked and showdown produce HTML strings — require dangerouslySetInnerHTML in React. react-markdown is safer and more extensible.

**Q: How to render math (LaTeX) in markdown?**
A: Use `remark-math` + `rehype-katex`. Adds $inline$ and $$block$$ math support with KaTeX rendering.

---

## Examples

### Example 1: Full Documentation Viewer with TOC, Code Highlighting, and Copy

```typescript
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { visit } from 'unist-util-visit'

interface DocPageProps {
  content: string
}

function createTocPlugin() {
  const headings: Array<{ id: string; text: string; depth: number }> = []
  const transformer = (tree: any) => {
    visit(tree, 'heading', (node: any) => {
      const text = node.children
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.value)
        .join('')
      const id = text.toLowerCase().replace(/\s+/g, '-')
      headings.push({ id, text, depth: node.depth })
    })
  }
  transformer.headings = headings
  return transformer
}

function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function DocPage({ content }: DocPageProps) {
  const tocPlugin = createTocPlugin()
  const [codeBlocks, setCodeBlocks] = useState<Record<string, string>>({})

  return (
    <div className="doc-layout">
      <nav className="toc">
        <h3>Contents</h3>
        <ul>
          {tocPlugin.headings
            .filter((h) => h.depth <= 3)
            .map((h) => (
              <li key={h.id} style={{ paddingLeft: (h.depth - 1) * 12 }}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
        </ul>
      </nav>
      <article className="doc-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, tocPlugin]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h2: ({ children, ...props }) => {
              const id = String(children).toLowerCase().replace(/\s+/g, '-')
              return <h2 id={id} {...props}>{children}</h2>
            },
            h3: ({ children, ...props }) => {
              const id = String(children).toLowerCase().replace(/\s+/g, '-')
              return <h3 id={id} {...props}>{children}</h3>
            },
            pre: ({ children }) => {
              const codeEl = children as any
              const code = codeEl?.props?.children ?? ''
              return (
                <div className="code-block-wrapper">
                  <CodeCopyButton code={String(code)} />
                  <pre>{children}</pre>
                </div>
              )
            },
            a: ({ href, children }) => {
              const isExternal = href?.startsWith('http')
              return (
                <a
                  href={href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                >
                  {children}
                </a>
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  )
}
```

### Example 2: Custom Remark Plugin — Image Gallery from Directory

```typescript
import { visit } from 'unist-util-visit'

function remarkImageGallery(options: { directory: string }) {
  return function transformer(tree: any) {
    visit(tree, 'paragraph', (node: any, index: number, parent: any) => {
      const hasGalleryMarker = node.children?.some(
        (child: any) =>
          child.type === 'text' && child.value.trim() === '%%gallery%%'
      )

      if (hasGalleryMarker) {
        parent.children[index] = {
          type: 'paragraph',
          data: {
            hName: 'ImageGallery',
            hProperties: { directory: options.directory },
          },
          children: [],
        }
      }
    })
  }
}

// Usage in markdown:
// %%gallery%%

// Custom component maps the hName to React component:
;<ReactMarkdown
  remarkPlugins={[remarkGfm, [remarkImageGallery, { directory: '/images/screenshots' }]]}
  components={{
    ImageGallery: ({ directory }: { directory: string }) => {
      const [images, setImages] = useState<string[]>([])
      useEffect(() => {
        fetch(`/api/images?dir=${directory}`)
          .then((r) => r.json())
          .then(setImages)
      }, [directory])

      return (
        <div className="gallery">
          {images.map((src) => (
            <img key={src} src={src} alt="" loading="lazy" />
          ))}
        </div>
      )
    },
  }}
>
  {markdownContent}
</ReactMarkdown>
```

---

## Key Takeaways
- react-markdown uses unified pipeline: markdown → mdast → hast → React elements
- remark plugins transform mdast (GFM tables, frontmatter, TOC extraction)
- rehype plugins transform hast (syntax highlighting, raw HTML, sanitization)
- Custom renderers via `components` prop override any HTML element mapping
- Custom remark plugins use unist-util-visit to traverse and modify AST
- rehype-sanitize prevents XSS — required for user-supplied markdown
- React 19 Server Components render markdown server-side, eliminate bundle cost
- Suspense + `use()` handles async markdown fetching declaratively
- Interactive elements (copy button) need client component islands
- Heading IDs enable anchor links and TOC navigation

## Common Misconception

"**react-markdown re-renders the entire document on every content change.**"

react-markdown only re-parses when content prop changes. For static content, it parses once. For large documents, use `memo` on the renderer component. For live editing, consider splitting document into sections with separate ReactMarkdown instances or using `remark-split` to parse once.

---

## Feynman Explain
(Explain react-markdown to a backend engineer: "react-markdown takes a markdown string, parses it through a pipeline of plugins, and outputs React components directly — no innerHTML. Think of it like a build pipeline: source (markdown) → AST transformations (remark) → format conversion (rehype) → output (JSX). Each plugin stage transforms the AST. Code blocks become SyntaxHighlighter components. Headings get anchor IDs. Tables become styled table elements.")

---

## Reframe
(Pause. Markdown rendering seems solved — libraries exist for every platform. But the unified pipeline architecture is the real lesson. Separating parse → transform → render stages applies to compilers, bundlers, formatters, and data pipelines. Every plugin is a pure AST transformer. When you understand the pipeline pattern, you can build custom pipelines for any structured text format.)

---

## Drill
Take the quiz. MCQs test unified pipeline, remark/rehype plugin roles, custom renderers, custom plugin creation, security, Server Components, Suspense integration, and React 19 patterns.

Run: `learn.sh quiz external-lib-patterns 26-markdown-rendering`
