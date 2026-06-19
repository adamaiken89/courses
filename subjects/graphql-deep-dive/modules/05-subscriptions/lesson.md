# Module 5: Subscriptions

Est. study time: 2.5h
Language: en

## Learning Objectives
- Implement subscription resolvers using async iterators and pub/sub patterns
- Distinguish WebSocket (graphql-ws) and Server-Sent Events transport
- Handle auth, back-pressure, and event sourcing in subscriptions

---

## Core Content

### Real-Time GraphQL

Subscriptions enable server-to-client push. Client sends subscription query, server streams events as data changes. Unlike queries (request-response) and mutations (write-then-read), subscriptions maintain persistent connection.

```graphql
type Subscription {
  postCreated: Post!
  postUpdated(postId: ID!): Post
  notificationReceived: Notification!
}
```

Client subscribes:

```graphql
subscription OnPostCreated {
  postCreated {
    id
    title
    author { name }
  }
}
```

Server pushes each new Post as created.

> **Think**: When would you choose subscription over polling?
>
> *Answer: Subscriptions for latency-sensitive updates where data changes unpredictably (chat, notifications, live prices). Polling for predictable intervals where near-real-time is acceptable (dashboard metrics every 30s). Subscriptions waste resources if events are frequent and client can't keep up.*

---

### Transport: WebSocket

WebSocket is bidirectional, persistent TCP connection. Two common protocols:

**subscriptions-transport-ws** (legacy, Apollo):

```
Client → Server: {"type":"connection_init","payload":{...}}
Server → Client: {"type":"connection_ack"}
Client → Server: {"type":"start","id":"1","payload":{"query":"subscription {...}"}}
Server → Client: {"type":"data","id":"1","payload":{"data":{...}}}
Server → Client: {"type":"complete","id":"1"}
```

**graphql-ws** (modern, recommended):

```
Client → Server: {"type":"subscribe","id":"1","payload":{"query":"subscription {...}"}}
Server → Client: {"type":"next","id":"1","payload":{"data":{...}}}
Server → Client: {"type":"complete","id":"1"}
```

Key difference: graphql-ws removes handshake as mandatory first message. `connection_init` becomes optional, sent only when auth needed. Fewer round trips.

> ```mermaid
> sequenceDiagram
>     participant Client
>     participant WS as WebSocket Server
>     participant Resolver as Subscription Resolver
>     participant PS as PubSub System
>     
>     Client->>WS: subscribe { postCreated { id title } }
>     WS->>Resolver: Invoke subscribe fn
>     Resolver->>PS: asyncIterator('POST_CREATED')
>     PS-->>Resolver: AsyncIterator
>     Resolver-->>WS: Return iterator
>     WS-->>Client: ack subscription
>     
>     Note over PS: Later: new post created
>     PS->>PS: publish('POST_CREATED', {post})
>     PS-->>Resolver: Iterator yields value
>     Resolver-->>WS: Format & send
>     WS-->>Client: {"data":{"postCreated":{...}}}
>     
>     Client->>WS: complete
>     WS->>Resolver: Return from iterator
>     WS->>PS: Dispose subscription
> ```

---

### Subscription Resolver Pattern

GraphQL subscriptions use `subscribe` function (returns async iterable) and `resolve` function (shapes each event):

```javascript
const resolvers = {
  Subscription: {
    postCreated: {
      subscribe: (_, args, { pubsub }) =>
        pubsub.asyncIterator(['POST_CREATED']),
      resolve: (payload) => payload.postCreated,
    },
    postUpdated: {
      subscribe: (_, { postId }, { pubsub }) =>
        pubsub.asyncIterator([`POST_UPDATED_${postId}`]),
      resolve: (payload, { postId }) =>
        payload.postUpdated.postId === postId ? payload.postUpdated : null,
    },
  },
}
```

Filtered subscriptions — resolver returns `null` to skip event for client:

```javascript
subscribe: (_, { severity }, { pubsub }) =>
  pubsub.asyncIterator(['LOG_EVENT']),
resolve: (payload, { severity }) =>
  payload.logEvent.severity >= severity ? payload.logEvent : null,
```

> **Think**: Why does filtering happen in resolve, not subscribe?
>
> *Answer: subscribe returns a fixed async iterator per subscription channel. Filtering in resolve lets the server push once to all subscribers on same channel, then each subscriber's resolve determines if event passes. More efficient than per-subscriber iterators.*

---

### Pub/Sub Implementations

In-memory (development only):

```javascript
class InMemoryPubSub {
  constructor() {
    this.subscribers = {}
  }
  publish(triggerName, payload) {
    this.subscribers[triggerName]?.forEach(fn => fn(payload))
  }
  asyncIterator(triggers) {
    const pullQueue = []
    const pushQueue = []
    // implementation: event buffer + async generator
    return {
      next() {
        // pull from pushQueue or await new event
      }
    }
  }
}
```

Production: Redis, Kafka, RabbitMQ, NATS. Pub/sub decouples mutation resolvers (publishers) from subscription resolvers (consumers). Across processes, Redis PubSub or Kafka topics relay events.

---

### Event Sourcing Integration

Subscription events often come from event-sourced systems. Mutation → domain event → subscription:

```javascript
const mutationResolvers = {
  Mutation: {
    createPost: async (_, { input }, { db, pubsub }) => {
      const post = await db.posts.create(input)
      await pubsub.publish('POST_CREATED', { postCreated: post })
      // Also publish to event store
      await eventStore.append('PostCreated', post)
      return post
    },
  },
}
```

Event sourcing guarantees: events are durable, replayable, ordered. Subscriptions consume live events; event store provides audit trail.

---

### Back-Pressure Handling

Client consumes slower than server produces → back-pressure. Mitigation strategies:

1. **Buffer with bounded size**: Drop oldest when full (ring buffer)
2. **Client ack protocol**: Server waits for client acknowledgement before next event
3. **Rate limiting**: Throttle events per-subscriber
4. **Client disconnect**: Close slow consumer

```javascript
// Bounded buffer example
const MAX_BUFFER = 100
const buffer = []

function onEvent(event) {
  if (buffer.length >= MAX_BUFFER) {
    buffer.shift() // drop oldest
  }
  buffer.push(event)
  processBuffer()
}
```

> **Think**: What happens when subscription client disconnects mid-stream?
>
> *Answer: Server calls `return()` on async iterator, which disposes the subscription in pub/sub. Cleanup handlers run. Client reconnects — sends new subscribe. Server may replay last N events (at-least-once) or start fresh (at-most-once), depending on design.*

---

### Auth in Subscriptions

WebSocket auth happens at connection time via `connection_init` payload:

```javascript
// graphql-ws server setup
const server = createServer({
  onConnect: (ctx) => {
    const { token } = ctx.connectionParams || {}
    if (!token) throw new Error('Auth required')
    const user = verifyToken(token)
    ctx.session = { user }
  },
  context: (ctx) => ({
    user: ctx.session?.user,
  }),
})
```

Per-subscription auth — validate in subscribe resolver:

```javascript
subscribe: (_, args, { user }) => {
  if (!user) throw new Error('Not authenticated')
  if (!user.roles.includes('EDITOR')) throw new Error('Not authorized')
  return pubsub.asyncIterator(['POST_CREATED'])
},
```

> **Think**: Why auth at connection level vs per-subscription level?
>
> *Answer: Connection-level auth validates once per WebSocket session — efficient for multiple subscriptions. Per-subscription auth enables fine-grained control (user can subscribe to public events but not admin events). Use both: connection-level for base identity, per-subscription for authorization.*

---

### graphql-over-sse (Server-Sent Events)

SSE is HTTP-based, unidirectional (server→client). Simpler than WebSocket, works over HTTP/2, no upgrade required:

```graphql
# Client request (POST):
{
  "query": "subscription { notificationReceived { message } }"
}

# Server response (text/event-stream):
event: next
data: {"data":{"notificationReceived":{"message":"New message"}}}

event: next
data: {"data":{"notificationReceived":{"message":"Another one"}}}

event: complete
```

When to choose SSE over WebSocket:

| Factor | WebSocket | SSE |
|--------|-----------|-----|
| Bidirectional | Yes | No (client→server uses regular HTTP) |
| HTTP/2 native | No (upgrade) | Yes |
| Auto-reconnect | Manual | Built-in (EventSource API) |
| Binary support | Yes | Text only (SSE) |
| Browser support | Full | Full (except IE) |
| Multiplexing | Single connection, channels via protocol | Per-connection per stream |

GraphQL over SSE spec (graphql-sse library) defines protocol for SSE-based subscriptions.

---

### Why This Matters

Subscriptions enable real-time features that differentiate modern apps: live chat, collaborative editing, price tickers, notification streams. Choosing wrong transport (WebSocket for simple one-way notifications) wastes complexity. Understanding async iterator pattern, back-pressure, and auth model prevents production issues.

---

## Examples

### Example 1: Chat Subscription

```graphql
type Subscription {
  messageReceived(roomId: ID!): Message!
  typingIndicator(roomId: ID!): TypingUser
}

type Mutation {
  sendMessage(roomId: ID!, text: String!): Message!
  typing(roomId: ID!, isTyping: Boolean!): Boolean!
}
```

```javascript
// Resolver
const resolvers = {
  Subscription: {
    messageReceived: {
      subscribe: (_, { roomId }, { pubsub }) =>
        pubsub.asyncIterator([`MESSAGE_${roomId}`]),
      resolve: (payload) => payload.messageReceived,
    },
  },
  Mutation: {
    sendMessage: async (_, { roomId, text }, { pubsub, user }) => {
      const message = { id: uuid(), roomId, text, author: user, timestamp: Date.now() }
      await pubsub.publish(`MESSAGE_${roomId}`, { messageReceived: message })
      return message
    },
  },
}
```

---

### Example 2: GraphQL over SSE Setup

```javascript
import { createHandler } from 'graphql-sse'

const handler = createHandler({
  schema,
  context: async (req) => ({
    user: await authenticate(req),
  }),
})

// Express integration
app.use('/graphql/stream', (req, res) => {
  if (req.method === 'POST' && req.query?.query) {
    handler(req, res)
  }
})
```

Client side:

```javascript
const eventSource = new EventSource('/graphql/stream?query=subscription{...}')

eventSource.addEventListener('next', ({ data }) => {
  const parsed = JSON.parse(data)
  console.log(parsed.data.notificationReceived)
})
```

---

## Key Takeaways
- Subscriptions use async iterators — server pushes, client consumes
- graphql-ws is modern WebSocket protocol (simpler handshake than legacy)
- Pub/sub decouples mutation publish from subscription consume
- Filtered subscriptions filter in resolve, not subscribe
- Back-pressure strategies: bounded buffer, rate limiting, client ack
- Connection-level auth for base identity; per-subscription for authorization
- SSE is simpler than WebSocket for server→client only streams
- graphql-over-sse works over HTTP/2 without upgrade

---

## Common Misconception

**"WebSocket is always better for real-time than SSE."**

WebSocket is overused. Many apps only need server→client push (not bidirectional). SSE works over HTTP/2 (multiplexed), has built-in reconnect, simpler infrastructure (no WebSocket load balancer config), and lower overhead when client never sends data after subscribe. Use WebSocket when client needs to send data through the same connection (chat typing indicators, collaborative editing ops).

---

## Feynman Explain
Explain GraphQL subscriptions to a backend developer who knows WebSockets but not GraphQL. Cover: async iterator pattern, pub/sub decoupling, and why filtered subscriptions use resolve not subscribe. 3 sentences max each.

---

## Reframe
Critique: Subscriptions add significant complexity over polling — WebSocket infrastructure, connection management, back-pressure, auth lifecycle. When does the real-time benefit justify this cost? When does polling + short cache TTL win?

---

## Drill
Take the quiz.

Run: `learn.sh quiz graphql-deep-dive 5`
