# Module 17: Real-time Collaboration — Liveblocks

Est. study time: 2h
Language: en

## Learning Objectives
- Set up RoomProvider with React 19 and Suspense
- Use useStorage for reading shared state and useMutation for writing
- Render presence cursors with useOthers and useMyPresence
- Manage undo/redo history with Liveblocks History API
- Design storage schemas with LiveList, LiveMap, LiveObject
- Build collaborative text editor (Lexical + Yjs integration)
- Render cursor overlays with zustand-free approach
- Understand optimistic updates and conflict resolution strategy

---

## Core Content

### Liveblocks Architecture

Liveblocks provides real-time collaboration infrastructure. Each "room" = synchronized state across connected clients.

```
Client A ────┐
              ├── WebSocket ── Liveblocks Cloud ── WebSocket ──┐── Client B
Client C ────┘                                                └── Client D
```

| Concept | API | Purpose |
|---------|-----|---------|
| Room | `RoomProvider` | Wrap component subtree with room context |
| Storage | `useStorage` | Read shared Live structures (reactive) |
| Mutation | `useMutation` | Write to storage with undo support |
| Presence | `useMyPresence` / `useOthers` | Cursor positions, selection, focus |
| History | `room.history` | Undo/redo operations |
| Threads | `useThreads` / `useCreateThread` | Comments and annotations |

### React 19 Setup with Suspense

```typescript
import { RoomProvider } from '@liveblocks/react/suspense'
import { Client } from '@liveblocks/client'

const client = new Client({
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_KEY!,
})

function App({ roomId }: { roomId: string }) {
  return (
    <RoomProvider id={roomId} initialPresence={{ cursor: null }}>
      <Editor />
    </RoomProvider>
  )
}
```

Suspense integration:

```typescript
;<RoomProvider id={roomId} initialPresence={{ cursor: null }}>
  <Suspense fallback={<Loading />}>
    <Editor />
  </Suspense>
</RoomProvider>

function Editor() {
  const storage = useStorage((root) => root)
  // Suspense waits for room connection + initial storage load
}
```

### Storage Data Structures

Storage is based on CRDT (Yjs under the hood). Conflict-free replicated data types:

```typescript
// Storage schema
type Storage = {
  blocks: LiveList<LiveObject<Block>>
  metadata: LiveObject<{
    title: string
    lastEdited: number
  }>
  collaborators: LiveMap<string, Collaborator>
}

type Block = {
  id: string
  type: 'text' | 'image' | 'code'
  content: string
}
```

```typescript
import { LiveList, LiveObject, LiveMap } from '@liveblocks/client'

function initStorage() {
  return {
    blocks: new LiveList([
      new LiveObject({ id: '1', type: 'text', content: '' }),
    ]),
    metadata: new LiveObject({ title: 'Untitled', lastEdited: Date.now() }),
    collaborators: new LiveMap(),
  }
}
```

### Reading and Writing Storage

```typescript
import { useStorage, useMutation } from '@liveblocks/react/suspense'

function DocumentTitle() {
  // Reactive — re-renders on data change
  const title = useStorage((root) => root.metadata.get('title'))

  const updateTitle = useMutation(
    ({ storage }, newTitle: string) => {
      storage.get('metadata').set('title', newTitle)
    },
    []
  )

  return <input value={title} onChange={(e) => updateTitle(e.target.value)} />
}
```

Complex mutations:

```typescript
const addBlock = useMutation(
  ({ storage }, type: Block['type']) => {
    const blocks = storage.get('blocks')
    const block = new LiveObject({
      id: crypto.randomUUID(),
      type,
      content: '',
    })
    blocks.push(block)
  },
  []
)
```

### Undo / Redo

```typescript
import { useHistory } from '@liveblocks/react/suspense'

function Toolbar() {
  const { undo, redo, canUndo, canRedo } = useHistory()

  return (
    <>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
    </>
  )
}
```

Mutations are automatically batched into history entries. Each `useMutation` call = one undoable step. Manual batching:

```typescript
const batchUpdate = useMutation(
  ({ storage, self }) => {
    // Multiple storage operations — all undo as one step
    storage.get('metadata').set('title', newTitle)
    storage.get('metadata').set('lastEdited', Date.now())
  },
  []
)
```

> **Think**: How does undo/redo work across multiple collaborators? If Alice undoes, does Bob see the undo?
>
> *Answer: History is local. Each client has own undo stack. Undoing Alice's mutation reverts her change from shared storage. Bob sees Alice's block disappear. History = collaborative undo, not per-user isolated history.*

### Presence and Cursors

```typescript
import { useMyPresence, useOthers } from '@liveblocks/react/suspense'

type Presence = {
  cursor: { x: number; y: number } | null
  selection: string | null
  name: string
}
```

Sending own cursor:

```typescript
function Canvas() {
  const [myPresence, updateMyPresence] = useMyPresence()

  const handlePointerMove = (e: React.PointerEvent) => {
    updateMyPresence({
      cursor: { x: e.clientX, y: e.clientY },
    })
  }

  const handlePointerLeave = () => {
    updateMyPresence({ cursor: null })
  }

  return <div onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
    <CursorsOverlay />
  </div>
}
```

Rendering other cursors:

```typescript
function CursorsOverlay() {
  const others = useOthers()

  return others.map((other) => {
    if (!other.presence.cursor) return null
    return (
      <div
        key={other.id}
        style={{
          position: 'absolute',
          left: other.presence.cursor.x,
          top: other.presence.cursor.y,
          background: other.info.color,
        }}
      >
        {other.info.name}
      </div>
    )
  })
}
```

### Collaborative Text Editor (Lexical + Yjs)

Liveblocks provides `@liveblocks/yjs` binding for Yjs, which integrates with Lexical via `@lexical/yjs`.

```typescript
import { createClient } from '@liveblocks/client'
import { YjsProvider } from '@liveblocks/yjs'
import * as Y from 'yjs'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin'

const doc = new Y.Doc()

const yjsProvider = new YjsProvider(client, doc)

function Editor() {
  return (
    <LexicalComposer initialConfig={{
      namespace: 'doc',
      nodes: [],
      theme: {},
    }}>
      <CollaborationPlugin
        id="main"
        providerFactory={() => yjsProvider}
        shouldBootstrap={true}
      />
      <RichTextPlugin />
    </LexicalComposer>
  )
}
```

### Threads and Comments

```typescript
import { useThreads, useCreateThread } from '@liveblocks/react/suspense'

function CommentThreads() {
  const { threads } = useThreads()
  const createThread = useCreateThread()

  const addComment = (x: number, y: number) => {
    createThread({
      body: { content: '' },
      metadata: { x, y, resolved: false },
    })
  }

  return threads.map((thread) => (
    <CommentBubble key={thread.id} thread={thread} />
  ))
}
```

### REST API for Room Management

```typescript
// Server-side room creation
const response = await fetch('https://api.liveblocks.io/v1/rooms', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${LIVEBLOCKS_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ id: roomId, usersAccesses: ['alice', 'bob'] }),
})
```

### Optimistic Updates and Conflict Resolution

Liveblocks uses CRDT conflict resolution: concurrent edits merge deterministically. Last-write-wins for scalar values, insert-without-conflict for lists.

```typescript
const optimisticDelete = useMutation(
  ({ storage }, blockId: string) => {
    // Optimistic: remove immediately
    const blocks = storage.get('blocks')
    const index = blocks.findIndex((b) => b.get('id') === blockId)
    if (index > -1) blocks.delete(index)
    // CRDT ensures conflict resolution if another client also deleted
  },
  []
)
```

> **Think**: What happens when two clients simultaneously rename the same block to different names?
>
> *Answer: Last-write-wins (LWW). The mutation that arrives last at Liveblocks server wins. Since CRDT operations are ordered by vector clock, both clients converge to same state. No "split" or "corruption" possible.*

---

### Why This Matters

Real-time collaboration is table stakes for modern productivity apps. From Notion to Figma to Google Docs, users expect multi-user simultaneous editing. Liveblocks abstracts the complexity of CRDT, WebSocket management, and conflict resolution into React hooks, making collaborative features accessible without CRDT expertise.

---

### Common Questions

**Q: What bandwidth costs should I expect with presence broadcasting?**
A: Presence is sent on every pointer move. Throttle to ~30fps (33ms interval). For 100+ concurrent users, consider limiting presence to visible users only.

**Q: Can Liveblocks be self-hosted?**
A: Liveblocks Cloud is default. Self-hosted option exists via Docker Enterprise edition. For most apps, Cloud is cost-effective ($0-50/mo for small teams).

---

## Examples

### Example 1: Collaborative Whiteboard with Cursors

```typescript
import { RoomProvider, useStorage, useMutation, useMyPresence, useOthers } from '@liveblocks/react/suspense'

function Whiteboard() {
  return (
    <RoomProvider id="whiteboard-1" initialPresence={{ cursor: null }}>
      <Canvas />
      <CursorsOverlay />
    </RoomProvider>
  )
}

function Canvas() {
  const shapes = useStorage((root) => root.shapes)
  const addShape = useMutation(({ storage }, shape: Shape) => {
    storage.get('shapes').push(new LiveObject(shape))
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {shapes.map((shape) => <Shape key={shape.id} {...shape} />)}
      <button onClick={() => addShape({ id: crypto.randomUUID(), x: 100, y: 100 })}>
        Add Shape
      </button>
    </div>
  )
}
```

### Example 2: Undo/Redo in Rich Text

```typescript
function EditorToolbar() {
  const { undo, redo, canUndo, canRedo } = useHistory()

  return (
    <div role="toolbar">
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo}>
        Redo
      </button>
    </div>
  )
}
```

---

## Key Takeaways
- RoomProvider wraps collaborative subtree. Uses Yjs CRDT under the hood.
- storage for shared state (LiveList, LiveMap, LiveObject), presence for transient data (cursors).
- useMutation writes to storage. Reverts via undo/redo (history is local per client).
- useOthers reads other clients' presence. Render cursor overlays from presence data.
- `@liveblocks/yjs` + Lexical CollaborationPlugin for text editor sync.
- Threads API for comment annotations on shared canvas.
- CRDT guarantees conflict-free merging. No network-dependent merge logic needed.
- React 19 Suspense: useSuspenseStorage waits for room connection + initial load.

## Common Misconception

**"Liveblocks replaces my database."**

Liveblocks is for real-time state synchronization — not durable storage. Persist room state to database on save. Liveblocks stores in-memory CRDT state. Unpersisted data lost when room is idle or all clients disconnect. Use Liveblocks REST API to synchronize to database periodically.

---

## Feynman Explain
(Explain CRDT to product manager: "Two people edit same document offline. One deletes paragraph, one fixes typo in same paragraph. Normal sync would conflict. CRDT makes both operations commutative — delete applies to paragraph, then typo fix is ignored because paragraph no longer exists. Everyone sees same final state when back online." Compare to git auto-merge.

---

## Reframe
(Pause. Do you need real-time? 99% of apps don't. Collaboration is sticky feature — once users expect it, removing it is impossible. Before adding Liveblocks: Is collaboration core to product? Does real-time improve outcome vs async? Notion added real-time late (2021) — async editing with page-level locking was sufficient for years.)

---

## Drill
Take the quiz. MCQs test RoomProvider setup, storage vs presence, useMutation vs useStorage, history API, cursor rendering, CRDT conflict resolution, Lexical integration.

Run: `learn.sh quiz external-lib-patterns 17-realtime-liveblocks`
