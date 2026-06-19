# Module 5: Rich Text Editors — TipTap & Lexical

Est. study time: 2.5h
Language: en

## Learning Objectives
- Architect editor wrapper supporting multiple rich text engines
- Design extension system (custom nodes, marks, plugins) library-agnostic
- Implement controlled vs uncontrolled editing with external state management
- Handle collaborative editing, mentions/autocomplete, and custom UI overlays

---

## Core Content

### Editor Engine Comparison

| Feature | TipTap (ProseMirror) | Lexical (Meta) | Slate | Quill 2 |
|---------|---------------------|----------------|-------|---------|
| Architecture | ProseMirror wrapper | Custom editor | React-first | Iframe-based |
| State model | Immutable (steps) | Immutable (updates) | Immutable | Mutable DOM |
| Extension model | Node/Mark/Plugin | Nodes/Plugins | Render elements | Formats/modules |
| Custom node complexity | High | Medium | High | Low |
| Bundle | ~60KB | ~40KB | ~80KB | ~50KB |
| Collaboration | Y.js (separate) | Built-in (>=0.12) | Y.js | OT (separate) |
| Learning curve | Steep (PM concept) | Moderate | Steep | Low |

**TipTap**: Best for complex editing (collaborative, custom document structure). Heavier learning curve.

**Lexical**: Best for modern apps needing custom text editing without ProseMirror complexity. Active development.

### Controlled vs Uncontrolled

Editors store internal document state. Controlled mode: app owns state, editor is display component. Uncontrolled: editor owns state, app reads value on demand.

```typescript
type EditorMode = 'controlled' | 'uncontrolled'

interface AppEditorProps {
  mode?: EditorMode
  value?: EditorDocument  // required in controlled mode
  onChange?: (doc: EditorDocument) => void  // required in controlled
  defaultValue?: EditorDocument  // used in uncontrolled
  extensions?: AppExtension[]
  readOnly?: boolean
  placeholder?: string
}
```

**Controlled**: App stores `EditorDocument` in state. Editor calls `onChange` on every mutation. Enables undo/redo outside editor, saves drafts, syncs to URL or store.

**Uncontrolled**: Editor manages state. App reads via ref or `onBlur`. Simpler for forms where editor value is submitted on save.

Abstraction: convert internal editor document to normalized format:

```typescript
type EditorDocument = {
  type: 'doc'
  content: EditorNode[]
}

type EditorNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: EditorNode[]
  text?: string
  marks?: EditorMark[]
}

type EditorMark = {
  type: string
  attrs?: Record<string, unknown>
}
```

TipTap ↔ Lexical mappers convert between this format and library-specific document models.

> **Think**: Converting between editor formats loses information (fine-grained formatting, custom node data). When is normalized document model worth the lossy conversion?
>
> *Answer: Worth it when: (1) app stores documents in DB and may change editor, (2) app renders editor content outside editor (preview, export). Not worth it when: editing is internal-only and migration is unlikely.*

### Extension System

TipTap extensions are ProseMirror plugins. Lexical extensions are nodes + plugins. Abstraction:

```typescript
interface AppExtension {
  name: string
  type: 'node' | 'mark' | 'plugin'
  schema?: NodeSpec | MarkSpec
  commands?: Record<string, (...args: unknown[]) => CommandFn>
  shortcuts?: Record<string, string>
}

// TipTap adapter
function toTipTapExtension(ext: AppExtension): Extension {
  return Extension.create({
    name: ext.name,
    addCommands: () => ext.commands ?? {},
    addKeyboardShortcuts: () => ext.shortcuts ?? {}
  })
}

// Lexical adapter
function toLexicalNode(ext: AppExtension): LexicalNode {
  // Map AppExtension to Lexical node/plugin
}
```

Built-in extensions bundled in wrapper: bold, italic, underline, heading, bulletList, orderedList, link, image, code, blockquote.

> **Think**: Custom extensions contain business logic (e.g., @mention suggests users, #tag links to issues). Where does extension logic live — inside wrapper or outside?
>
> *Answer: Extension definition lives outside wrapper (app concern). Wrapper provides `registerExtension` interface. Extension adapter (toTipTap/toLexical) lives inside wrapper. This separates "what the extension does" from "how the editor registers it."*

### Mentions & Autocomplete

Both libraries handle mentions differently:

| Concern | TipTap | Lexical |
|---------|--------|---------|
| Trigger | `@` character | `@` character (customizable) |
| Suggestions | Separate UI component | Inline menu plugin |
| Mentions store | Suggestion plugin | `MentionNode` + custom logic |
| Async filter | By suggestion plugin | Manual |

Abstraction: `MentionProvider` interface:

```typescript
interface MentionProvider {
  search(query: string, context?: MentionContext): Promise<MentionItem[]>
  format(mention: MentionItem): MentionNodeData
}

interface MentionItem {
  id: string
  label: string
  description?: string
  avatar?: string
  type: 'user' | 'issue' | 'tag'
}

interface MentionNodeData {
  id: string
  label: string
  type: string
}
```

Wrapper wires MentionProvider to editor-specific mention mechanism. Consumer implements provider once.

### Collaborative Editing

**TipTap**: Uses Y.js (CRDT) via `@tiptap/y` and `y-websocket`/`y-partykit`.

**Lexical**: Built-in collaboration in v0.12+ via `@lexical/yjs`.

Abstraction:

```typescript
interface CollaborationConfig {
  provider: 'y-websocket' | 'y-partykit' | 'liveblocks' | 'custom'
  endpoint: string
  room: string
  user: { name: string; color: string }
  onAwarenessChange?: (users: AwarenessUser[]) => void
}
```

Wrapper initializes Y.js document, connects provider, binds to editor instance. Consumer configures endpoint and room. If app switches editor, collab config shape stays the same.

> **Think**: Collaborative editing changes editor architecture from "single user edits document" to "multiple users edit document concurrently." How does abstraction help in collab migration?
>
> *Answer: CRDT logic (Y.js document, awareness, undo/redo) is shared between TipTap and Lexical. Wrapper abstracting collab setup means the collab service, awareness UI, and user presence logic remain unchanged when editor changes.*

### React 19 Integration

React 19 deprecates `forwardRef` — `ref` is now a regular prop. Rich text editors commonly expose imperative APIs (focus, getHTML, insertContent, getJSON). Previously wrapped in `forwardRef`, these now use `ref` directly:

```typescript
function TipTapEditor({ ref, content, extensions }: EditorProps & { ref?: React.Ref<EditorAPI> }) {
  const editorRef = useRef<Editor>(null)

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.commands.focus(),
    getContent: () => editorRef.current?.getJSON(),
    insertContent: (html: string) => editorRef.current?.chain().insertContent(html).run()
  }))

  return <EditorContent ref={editorRef} editor={editorRef.current} />
}
```

Rich text editors are inherently client-only — they depend on DOM APIs, selection APIs, and browser events. In Server Components, the editor wrapper must declare `"use client"` and be imported via dynamic import with `ssr: false`:

```typescript
// page.tsx (Server Component)
import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('./EditorWrapper'), { ssr: false })

export default function Page() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <Editor />
    </Suspense>
  )
}
```

For collaborative editing, `useOptimistic` provides instant local feedback while remote changes propagate. When a user edits collaboratively, their changes appear immediately in the local document model while the Y.js sync happens in the background:

```typescript
function CollaborativeEditor({ room, user }: CollabProps) {
  const [doc, setDoc] = useState<EditorDocument>(initialDoc)
  const [optimisticDoc, addOptimisticEdit] = useOptimistic(
    doc,
    (current, edit: EditorEdit) => applyEditLocal(current, edit)
  )

  function handleLocalEdit(edit: EditorEdit) {
    addOptimisticEdit(edit)
    yDoc.transact(() => applyYjsEdit(yDoc, edit))
  }

  return <EditorView doc={optimisticDoc} onEdit={handleLocalEdit} />
}
```

Concurrent rendering (React 19) improves large document performance by splitting rendering into interruptible chunks. Editors with thousands of nodes benefit from `useTransition` for expensive operations (search-and-replace, syntax highlighting, document transformations) — these run as low-priority updates without blocking user input:

```typescript
function useSearchReplace(editor: Editor | null) {
  const [isPending, startTransition] = useTransition()

  const replaceAll = useCallback((find: string, replace: string) => {
    startTransition(() => {
      editor?.chain().search(find).replace(replace).run()
    })
  }, [editor])

  return { replaceAll, isReplacing: isPending }
}
```

---

### Why This Matters

Rich text editors are the most integrated third-party component in most apps. Mentions, embeds, collaboration, custom blocks, slash commands — each ties deeply into app logic. Editor migration (TipTap → Lexical) is a 3-6 month project without abstraction. With clean editor abstraction and extension mapping, it becomes 2-4 weeks.

---

### Common Questions

**Q: Should I normalize editor output to HTML or JSON?**
A: JSON (structured data). HTML loses semantic information (what is a "mention" vs plain linked text?). HTML is for rendering; JSON is for storage. Convert JSON to HTML in preview/export, not vice versa.

**Q: How to handle image uploads in editor?**
A: Abstract behind `UploadHandler` interface. TipTap: `Image.configure({ upload: handler })`. Lexical: `ImageNode` with custom upload plugin. Same interface, different wiring.

---

## Examples

### Example 1: Rich Comment Box with @Mentions

**Problem**: Comment editor needs bold, italic, @mention users, #link issues, slash commands.

**Solution**: `AppEditor` wrapper with `MentionProvider` for users and issues. Extensions: bold, italic, mention, issue-link, slash-command. Output: JSON stored in DB, rendered via `AppEditorPreview` (converts JSON to HTML).

### Example 2: Document Editor with Collaboration

**Problem**: Collaborative document editor used by 500 concurrent users. Needs conflict resolution, presence awareness, offline support.

**Solution**: TipTap (mature Y.js integration) + y-partykit for WebSocket. Wrapper configures `CollaborationConfig`. When app needs offline, add y-indexeddb persistence provider — no editor code changes.

---

## Key Takeaways
- TipTap (complex, collaborative) vs Lexical (modern, lighter). Abstraction supports both.
- Controlled mode: app owns document state. Uncontrolled: editor owns state. Abstraction supports both.
- Normalized document model (JSON) prevents editor lock-in. Mapping is lossy — trade precision for portability.
- Extension abstraction: app writes extension schema/commands once, wrapper maps to editor-specific format.
- MentionProvider interface isolates autocomplete logic from editor library.
- Collaborative editing setup (Y.js, provider, awareness) is shared between editors — abstract it.

## Common Misconception

**"Rich text editors output HTML, so store HTML."**

HTML is a rendering format, not a data format. HTML cannot distinguish between "bold text" and "heading level 3 bold" — both are `<strong>` inside different container elements. JSON preserves semantic structure. Store JSON, render HTML. This also prevents XSS attacks that HTML storage enables.

---

## Feynman Explain
(Explain ProseMirror's "immutable state" model to a React developer familiar with useState. How is editor state different from React state? Why does every keystroke produce a new state snapshot?)

---

## Reframe
(Pause. Rich text editors add enormous complexity. For many apps, a Markdown textarea or Notion-style block editor (using Slate/Lexical) suffices. When should you avoid rich text entirely? Consider: mobile editing experience, accessibility for complex editing, storage format decisions.)

---

## Drill
Take the quiz. MCQs test editor selection, controlled vs uncontrolled, extension abstraction, mentions, and collaboration.

Run: `learn.sh quiz external-lib-patterns 05-rich-text-editors`
