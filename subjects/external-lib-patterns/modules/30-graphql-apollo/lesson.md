# Module 30: GraphQL — Apollo Client

Est. study time: 2h
Language: en

## Learning Objectives
- Understand Apollo Client architecture (InMemoryCache, link chain, typePolicies)
- Use useQuery, useMutation, useSubscription
- Configure normalized cache (keyFields, merge strategies)
- Implement fragment composition with codegen
- Handle errors (onError link, retry link)
- Implement pagination (offset, cursor, relay)
- Compare Apollo Client vs React Query
- React 19: Suspense integration with useSuspenseQuery
- React 19: useTransition for pagination
- React 19: ref as prop for client access

---

## Core Content

### Apollo Client Architecture

Apollo Client is GraphQL state management: cache-first fetching, normalized cache, link-based middleware.

```
ApolloClient
  ├── InMemoryCache (normalized data store)
  │     ├── typePolicies (custom keyFields, merge strategies)
  │     └── cache redirects
  └── Link Chain (middleware pipeline)
        ├── HttpLink (fetch from GraphQL endpoint)
        ├── onError Link (error handling)
        ├── RetryLink (automatic retry)
        └── AuthLink (token injection)
```

```typescript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { RetryLink } from '@apollo/client/link/retry'

const httpLink = createHttpLink({
  uri: '/graphql',
})

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`[GraphQL error]: ${message}`, locations, path)
    })
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`)
  }
})

const retryLink = new RetryLink({
  delay: { initial: 300, max: 3000, jitter: true },
  attempts: { max: 3 },
})

const client = new ApolloClient({
  link: retryLink.concat(errorLink).concat(httpLink),
  cache: new InMemoryCache(),
})

export default client
```

### ApolloProvider Setup

```typescript
import { ApolloProvider } from '@apollo/client'
import client from './apollo-client'

function App() {
  return (
    <ApolloProvider client={client}>
      <RouterProvider router={router} />
    </ApolloProvider>
  )
}
```

ApolloProvider makes client available via React context. All useQuery/useMutation hooks use this client.

### useQuery

```typescript
import { gql, useQuery } from '@apollo/client'

const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
      email
      posts {
        id
        title
      }
    }
  }
`

interface User {
  id: string
  name: string
  email: string
  posts: Array<{ id: string; title: string }>
}

interface UsersData {
  users: User[]
}

function UsersList() {
  const { loading, error, data } = useQuery<UsersData>(GET_USERS)

  if (loading) return <Spinner />
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {data?.users.map((user) => (
        <li key={user.id}>{user.name} — {user.email}</li>
      ))}
    </ul>
  )
}
```

### useMutation

```typescript
import { gql, useMutation } from '@apollo/client'

const CREATE_USER = gql`
  mutation CreateUser($name: String!, $email: String!) {
    createUser(name: $name, email: $email) {
      id
      name
      email
    }
  }
`

function CreateUserForm() {
  const [createUser, { loading, error }] = useMutation(CREATE_USER, {
    refetchQueries: [{ query: GET_USERS }],
    onCompleted: (data) => {
      toast.success(`User ${data.createUser.name} created`)
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createUser({
      variables: {
        name: form.get('name') as string,
        email: form.get('email') as string,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create User'}
      </button>
      {error && <p className="error">{error.message}</p>}
    </form>
  )
}
```

### useSubscription

```typescript
import { gql, useSubscription } from '@apollo/client'

const MESSAGE_SUB = gql`
  subscription OnMessageReceived($chatId: ID!) {
    messageReceived(chatId: $chatId) {
      id
      content
      sender {
        id
        name
      }
      timestamp
    }
  }
`

function ChatRoom({ chatId }: { chatId: string }) {
  const { data, loading } = useSubscription(MESSAGE_SUB, {
    variables: { chatId },
  })

  return (
    <div>
      {data?.messageReceived && (
        <div className="message">
          <strong>{data.messageReceived.sender.name}:</strong>
          {data.messageReceived.content}
        </div>
      )}
    </div>
  )
}
```

### InMemoryCache and typePolicies

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client'

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        users: {
          merge(existing = [], incoming: any[]) {
            return [...existing, ...incoming]
          },
        },
      },
    },
    User: {
      keyFields: ['id'],
    },
    Post: {
      keyFields: ['id', 'authorId'],
    },
  },
})
```

Cache normalization:

| Concept | Description |
|---------|-------------|
| Cache ID | Default: `__typename:id` (e.g., `User:123`) |
| keyFields | Custom cache ID fields |
| typePolicies | Field-level read/merge behavior |
| Cache redirect | Point query to existing cache data |

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    Product: {
      keyFields: ['sku', 'category'],
    },
    Review: {
      keyFields: ['id', 'productId'],
    },
  },
})
```

### Fragment Composition

```typescript
import { gql, useQuery } from '@apollo/client'

const USER_FRAGMENT = gql`
  fragment UserFields on User {
    id
    name
    email
    avatarUrl
  }
`

const POST_FRAGMENT = gql`
  fragment PostFields on Post {
    id
    title
    body
    createdAt
    author {
      ...UserFields
    }
  }
  ${USER_FRAGMENT}
`

const GET_FEED = gql`
  query GetFeed {
    feed {
      ...PostFields
    }
  }
  ${POST_FRAGMENT}
`

function Feed() {
  const { data } = useQuery(GET_FEED)

  return (
    <div>
      {data?.feed.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

Fragment composition with codegen:

```typescript
// codegen.ts
import { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'http://localhost:4000/graphql',
  documents: ['src/**/*.tsx'],
  generates: {
    './src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],
    },
  },
}

export default config
```

```typescript
import { useGetFeedQuery, useCreateUserMutation } from '../generated/graphql'

function Feed() {
  const { data, loading } = useGetFeedQuery()
  return <div>{data?.feed.map((post) => <PostCard key={post.id} post={post} />)}</div>
}
```

### Error Handling

```typescript
import { onError } from '@apollo/client/link/error'
import { ApolloClient, InMemoryCache, from } from '@apollo/client'

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      switch (err.extensions?.code) {
        case 'UNAUTHENTICATED':
          window.location.href = '/login'
          break
        case 'FORBIDDEN':
          toast.error('You do not have permission')
          break
        case 'RATE_LIMITED':
          toast.warning('Too many requests — slow down')
          break
        default:
          console.error(`GraphQL error on ${operation.operationName}:`, err.message)
      }
    }
  }

  if (networkError) {
    toast.error('Network connection lost')
  }
})

const client = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache(),
})
```

```typescript
import { RetryLink } from '@apollo/client/link/retry'

const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 10000,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error) => !!error,
  },
})

const RETRY_DISABLED = new RetryLink({ attempts: { max: 0 } })
```

### Pagination

```typescript
import { gql, useQuery } from '@apollo/client'

const GET_PAGINATED_USERS = gql`
  query GetUsers($offset: Int!, $limit: Int!) {
    users(offset: $offset, limit: $limit) {
      id
      name
      email
    }
  }
`

function UsersPaginated() {
  const [page, setPage] = useState(0)
  const limit = 20

  const { data, loading, fetchMore } = useQuery(GET_PAGINATED_USERS, {
    variables: { offset: page * limit, limit },
  })

  return (
    <div>
      {data?.users.map((user) => <UserCard key={user.id} user={user} />)}
      <button
        onClick={() => setPage((p) => p - 1)}
        disabled={page === 0}
      >
        Previous
      </button>
      <button
        onClick={() => {
          fetchMore({ variables: { offset: (page + 1) * limit, limit } })
          setPage((p) => p + 1)
        }}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Next'}
      </button>
    </div>
  )
}
```

```typescript
import { gql, useQuery } from '@apollo/client'

const GET_COMMENTS = gql`
  query GetComments($first: Int!, $after: String) {
    comments(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          text
          author { name }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

function CommentsList() {
  const { data, fetchMore } = useQuery(GET_COMMENTS, {
    variables: { first: 10 },
  })

  const loadMore = () => {
    if (!data?.comments.pageInfo.hasNextPage) return
    fetchMore({
      variables: {
        after: data.comments.pageInfo.endCursor,
      },
    })
  }

  return (
    <div>
      {data?.comments.edges.map(({ node }) => (
        <CommentCard key={node.id} comment={node} />
      ))}
      {data?.comments.pageInfo.hasNextPage && (
        <button onClick={loadMore}>Load More Comments</button>
      )}
    </div>
  )
}
```

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        comments: {
          keyArgs: false,
          merge(existing, incoming) {
            if (!existing) return incoming
            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            }
          },
        },
      },
    },
  },
})
```

### React 19: useSuspenseQuery

```typescript
import { gql, useSuspenseQuery } from '@apollo/client'

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      posts {
        id
        title
      }
    }
  }
`

function UserProfile({ userId }: { userId: string }) {
  const { data } = useSuspenseQuery<{ user: User }>(GET_USER, {
    variables: { id: userId },
  })

  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
      <h2>Posts</h2>
      {data.user.posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

function UserPage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<UserSkeleton />}>
      <UserProfile userId={userId} />
    </Suspense>
  )
}
```

### React 19: useTransition for Pagination

```typescript
import { useTransition } from 'react'
import { gql, useSuspenseQuery } from '@apollo/client'

function ProductList() {
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const { data } = useSuspenseQuery(GET_PRODUCTS, {
    variables: { page, limit: 20 },
  })

  const goToPage = (nextPage: number) => {
    startTransition(() => {
      setPage(nextPage)
    })
  }

  return (
    <div>
      <div className={`products ${isPending ? 'products-fade' : ''}`}>
        {data.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <div className="pagination">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1 || isPending}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          onClick={() => goToPage(page + 1)}
          disabled={isPending}
        >
          {isPending ? 'Loading...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
```

### React 19: ref as Prop for Client Access

```typescript
import { useRef } from 'react'
import { ApolloClient } from '@apollo/client'

function MutationButton({ clientRef }: { clientRef: React.RefObject<ApolloClient<unknown> | null> }) {
  const handleClick = async () => {
    const client = clientRef.current
    if (!client) return

    const result = await client.mutate({
      mutation: CREATE_USER,
      variables: { name: 'Alice', email: 'alice@example.com' },
    })
  }

  return <button onClick={handleClick}>Create User Imperatively</button>
}

function App() {
  const clientRef = useRef<ApolloClient<unknown> | null>(null)

  return (
    <ApolloProvider client={client}>
      <MutationButton clientRef={clientRef} />
    </ApolloProvider>
  )
}
```

### Apollo Client vs React Query

| Aspect | Apollo Client | React Query (TanStack Query) |
|--------|---------------|------------------------------|
| Protocol | GraphQL only | Any async function (REST, GraphQL) |
| Cache | Normalized (entity store) | Key-value (document cache) |
| Schema | Required for codegen | No schema needed |
| DevTools | Apollo DevTools | React Query DevTools |
| Bundle size | ~35KB | ~13KB |
| Subscriptions | Built-in (WebSocket) | Requires external library |
| Fragment composition | Native | Manual |
| Learning curve | Steeper | Gentler |

When to use each:

| Scenario | Choice |
|----------|--------|
| GraphQL API | Apollo Client (normalized cache benefits) |
| REST API | React Query |
| Mixed API (REST + GraphQL) | React Query |
| Real-time subscriptions | Apollo Client (built-in) |
| Simple cache needs | React Query (lighter) |
| Complex entity relationships | Apollo Client (normalization) |

> **Think**: What problem does normalized cache solve that document cache does not?
>
> *Answer: Normalized cache stores each entity once by ID. Two queries returning same user update single cache entry. Document cache stores each query response separately — same user data duplicated across responses. Normalization ensures consistency: update user in one place, all queries reflecting that user see new data.*

---

### Why This Matters

GraphQL solves over-fetching and under-fetching by letting clients specify exact data shapes. Apollo Client adds normalized caching, optimistic updates, and pagination. Understanding both Apollo Client and React Query helps choose right tool: Apollo for GraphQL-heavy apps, React Query for mixed or REST APIs.

---

### Common Questions

**Q: Why does my mutation not update the cache automatically?**
A: Apollo Client auto-updates cache for mutations returning objects with id matching existing cache entries. For list queries, use refetchQueries or manually update cache with cache.modify or cache.writeQuery. typePolicies merge function handles list appends.

**Q: How to handle file uploads with Apollo Client?**
A: Use apollo-upload-client's createUploadLink instead of HttpLink. Accepts File/Blob in variables. Server processes multipart form data. Apollo Client serializes File objects automatically.

---

## Examples

### Example 1: typePolicies Cache Configuration

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client'

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        products: {
          keyArgs: ['category'],
          merge(existing = { edges: [], pageInfo: {} }, incoming) {
            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            }
          },
        },
        notifications: {
          merge(_, incoming) {
            return incoming
          },
        },
      },
    },
    Product: {
      keyFields: ['sku'],
      fields: {
        displayName: {
          read(product: { name: string; variant: string }) {
            return `${product.name} (${product.variant})`
          },
        },
        formattedPrice: {
          read(product: { price: number }) {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(product.price)
          },
        },
      },
    },
    User: {
      keyFields: ['id'],
      fields: {
        fullName: {
          read(user: { firstName: string; lastName: string }) {
            return `${user.firstName} ${user.lastName}`
          },
        },
      },
    },
    Review: {
      keyFields: ['id', 'productId'],
    },
    Cart: {
      keyFields: [],
    },
  },
})
```

### Example 2: Pagination Hook with Cursor

```typescript
import { gql, useQuery } from '@apollo/client'
import { useCallback, useState } from 'react'

const GET_REPOSITORIES = gql`
  query GetRepositories($first: Int!, $after: String, $query: String!) {
    search(type: REPOSITORY, first: $first, after: $after, query: $query) {
      repositoryCount
      edges {
        cursor
        node {
          ... on Repository {
            id
            name
            owner { login }
            stargazerCount
            description
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

interface RepositoryNode {
  id: string
  name: string
  owner: { login: string }
  stargazerCount: number
  description: string | null
}

interface SearchEdge {
  cursor: string
  node: RepositoryNode
}

interface SearchResult {
  search: {
    repositoryCount: number
    edges: SearchEdge[]
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | null
    }
  }
}

interface UseCursorPaginationOptions {
  query: string
  pageSize?: number
}

function useCursorPagination({ query, pageSize = 20 }: UseCursorPaginationOptions) {
  const [cursors, setCursors] = useState<string[]>([""])
  const [currentPage, setCurrentPage] = useState(0)

  const after = cursors[currentPage] || undefined

  const { data, loading, error, fetchMore } = useQuery<SearchResult>(
    GET_REPOSITORIES,
    {
      variables: { first: pageSize, after, query },
      notifyOnNetworkStatusChange: true,
    }
  )

  const nextPage = useCallback(() => {
    if (!data?.search.pageInfo.hasNextPage) return
    const endCursor = data.search.pageInfo.endCursor!
    setCursors((prev) => {
      const updated = [...prev]
      updated[currentPage + 1] = endCursor
      return updated
    })
    setCurrentPage((p) => p + 1)
  }, [data, currentPage])

  const previousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1))
  }, [])

  const goToPage = useCallback((pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex <= currentPage) {
      setCurrentPage(pageIndex)
    }
  }, [currentPage])

  return {
    data,
    loading,
    error,
    pageInfo: data?.search.pageInfo,
    repositoryCount: data?.search.repositoryCount,
    currentPage,
    totalPages: currentPage + 1,
    hasNextPage: data?.search.pageInfo.hasNextPage ?? false,
    hasPreviousPage: currentPage > 0,
    nextPage,
    previousPage,
    goToPage,
    edges: data?.search.edges ?? [],
  }
}

function RepositoryBrowser() {
  const pagination = useCursorPagination({ query: 'react', pageSize: 10 })

  return (
    <div>
      <p>{pagination.repositoryCount} repositories found</p>
      <ul>
        {pagination.edges.map(({ node }) => (
          <li key={node.id}>
            <a href={`https://github.com/${node.owner.login}/${node.name}`}>
              {node.owner.login}/{node.name}
            </a>
            <span> {node.stargazerCount} stars</span>
            {node.description && <p>{node.description}</p>}
          </li>
        ))}
      </ul>
      <div className="pagination-controls">
        <button
          onClick={pagination.previousPage}
          disabled={!pagination.hasPreviousPage}
        >
          Previous
        </button>
        <span>Page {pagination.currentPage + 1}</span>
        <button
          onClick={pagination.nextPage}
          disabled={!pagination.hasNextPage || pagination.loading}
        >
          {pagination.loading ? 'Loading...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
```

---

## Key Takeaways
- Apollo Client architecture: InMemoryCache (normalized) + Link Chain (middleware pipeline)
- useQuery fetches data with cache-first policy; useMutation modifies data with refetchQueries
- useSubscription listens to real-time events via WebSocket
- typePolicies define custom keyFields (cache IDs) and merge strategies (paginated lists)
- Fragment composition splits GraphQL queries into reusable pieces; codegen generates typed hooks
- Error handling via onError link (per-error-type handling) and RetryLink (backoff strategy)
- Pagination: offset (fetchMore), cursor (Relay-style edges), merge strategy in typePolicies
- useSuspenseQuery triggers Suspense boundary — no loading state in component
- useTransition marks page changes as low priority — keeps stale content visible during load
- ref as prop enables imperative client access outside hooks
- Apollo Client for GraphQL APIs; React Query for REST/mixed APIs

## Common Misconception

"**Apollo Client cache automatically updates after every mutation.**"

Apollo Client auto-updates cache only when mutation returns an object with matching id AND typename already in cache. List queries do not auto-update. Use refetchQueries, cache.modify, or cache.writeQuery for list invalidation. typePolicies merge function configures how paginated lists append.

---

## Feynman Explain
(Explain Apollo Client to a backend engineer: "Apollo Client is like a local database that mirrors your GraphQL API. It stores normalized entities by ID — each user, post, comment stored once. When component A fetches { users { id name } } and component B fetches { users { id email } }, Apollo merges them into single user entity. Mutations update entity cache automatically if they return full object. For lists, you tell Apollo how to merge with typePolicies.")

---

## Reframe
(Pause. GraphQL and Apollo teach a data-fetching philosophy: declare data requirements alongside components, not in a centralized API layer. Fragments colocated with components mean no over-fetching. Normalized cache means data consistency without manual sync. This mental model — declaring data needs at component level — applies beyond GraphQL to any data layer where components own their data shape.)

---

## Drill
Take the quiz. MCQs test Apollo Client architecture, useQuery/useMutation/useSubscription, InMemoryCache typePolicies, fragment composition, error handling, pagination, React 19 useSuspenseQuery, useTransition, ref prop, and comparison with React Query.

Run: `learn.sh quiz external-lib-patterns 30-graphql-apollo`
