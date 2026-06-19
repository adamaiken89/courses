# Module 1: Schema & Type System

Est. study time: 2h
Language: en

## Learning Objectives
- Write GraphQL schemas using SDL with all type system constructs
- Distinguish object, interface, union, enum, input, and scalar types
- Apply type modifiers (!, []) and custom directives

---

## Core Content

### SDL: Schema Definition Language

GraphQL defines its API contract via SDL — a declarative language independent of any programming language. The schema is the single source of truth.

```graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}
```

Every schema must have a `query` root type. `mutation` and `subscription` are optional.

> **Think**: Why does GraphQL require a single `query` root type rather than supporting arbitrary entry points like REST endpoints?
>
> *Answer: A single root type forces all data access through one contract, enabling the client to request exactly what it needs in one round trip. REST scatters entry points across URLs; GraphQL centralizes them in the type system.*

---

### Scalar Types

Built-in scalars:
- `String`, `Int`, `Float`, `Boolean`, `ID` (serialized as String, but indicates identity, not human-readable)

Custom scalars — for domain-specific values:

```graphql
scalar DateTime
scalar JSON
scalar URL

# With specification URL (validates behavior):
scalar PhoneNumber @specifiedBy(url: "https://www.itu.int/rec/T-REC-E.164")
```

> **Think**: When should you create a custom scalar vs using a String with validation in resolvers?
>
> *Answer: Custom scalars when the type is reused across multiple fields and has well-defined serialization/parsing rules. Use String + resolver validation for one-off cases. Custom scalars make the schema self-documenting and enable tooling (codegen, validation) at the type level.*

---

### Object Types

Core building block. Fields map to data:

```graphql
type User {
  id: ID!
  name: String!
  email: String
  posts: [Post!]!
  profileUrl: URL
}
```

Type modifiers:
- `!` — non-null (field always returns value)
- `[Type]` — nullable list
- `[Type!]` — list is nullable, elements are non-null
- `[Type]!` — list is non-null, elements nullable
- `[Type!]!` — both non-null

> **Think**: Why consider `[Type!]!` over `[Type]` as the default list shape?
>
> *Answer: `[Type!]!` communicates "this field always returns a list, and every element is guaranteed valid." Simplifies client null-checking. Use nullable variants only when null carries semantic meaning (e.g., "access denied" → null list, or "some elements failed validation" → null elements).*

---

### Enums

Finite set of allowed values. More type-safe than strings:

```graphql
enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

GraphQL enums are serialized as strings. In codegen, they become native enum types.

---

### Interfaces

Abstract type defining shared fields. Objects implement interfaces:

```graphql
interface Node {
  id: ID!
  createdAt: DateTime!
}

type User implements Node {
  id: ID!
  createdAt: DateTime!
  name: String!
  email: String
}

type Post implements Node {
  id: ID!
  createdAt: DateTime!
  title: String!
  body: String!
}
```

Queries on interface fields can use inline fragments to access type-specific fields:

```graphql
query {
  nodes {
    id
    createdAt
    ... on User { name }
    ... on Post { title }
  }
}
```

---

### Unions

Like interfaces but no shared fields. Useful when types have nothing in common:

```graphql
union SearchResult = User | Post | Comment

type Query {
  search(term: String!): [SearchResult!]!
}
```

Clients must use inline fragments to access any fields:

```graphql
query {
  search(term: "graphql") {
    ... on User { id name }
    ... on Post { id title body }
    ... on Comment { id text }
  }
}
```

> **Question**: Interface vs Union — when to choose which?
>
> *Answer: Interface when types share common fields and you want to query them without fragments. Union when types are semantically grouped but structurally unrelated. Interface is "is-a" relationship; union is "could-be-any-of" relationship.*

---

### Input Types

Arguments in GraphQL accept individual scalars, but for complex operations use `input`:

```graphql
input CreateUserInput {
  name: String!
  email: String!
  avatarUrl: URL
  role: UserRole = USER  # default value
}

type Mutation {
  createUser(input: CreateUserInput!): User!
}
```

Rules:
- Input types cannot have arguments
- Input types cannot reference object types (or other input types? they can nest)
- Input types can reference other input types (nested inputs)
- Input types must be used as argument types only

---

### Directives

Built-in directives:

```graphql
@deprecated(reason: String)
@specifiedBy(url: String!)
@skip(if: Boolean!)
@include(if: Boolean!)
@oneOf  # GraphQL spec 2024 — exactly one field must be set
```

Custom directives (server-side):

```graphql
directive @auth(requires: Role!) on OBJECT | FIELD_DEFINITION
directive @rateLimit(max: Int!, window: Int!) on FIELD_DEFINITION
directive @upper on FIELD_DEFINITION

type Query {
  adminDashboard: Dashboard @auth(requires: ADMIN)
  publicData: String
}
```

> **Think**: What's the tradeoff of using custom directives vs resolver middleware?
>
> *Answer: Directives make schema self-documenting — the auth requirement is visible in SDL. Middleware keeps resolvers clean but hides cross-cutting concerns. Directives couple behavior to the schema layer, so changing behavior requires schema change. Middleware can be toggled per-environment. Prefer directives for schema-intrinsic concerns (auth, validation), middleware for operational concerns (logging, metrics).*
  
---

> ```mermaid
> graph TD
>   subgraph GraphQL Type System
>     A[Schema] --> B[Root Types]
>     A --> C[Type Definitions]
>     B --> D[Query]
>     B --> E[Mutation]
>     B --> F[Subscription]
>     C --> G[Object Types]
>     C --> H[Interface]
>     C --> I[Union]
>     C --> J[Enum]
>     C --> K[Scalar]
>     C --> L[Input Types]
>     G --> M[Fields with Type Modifiers]
>     M --> N["!" Non-Null]
>     M --> O["[]" List]
>   end
> ```

### Why This Matters

The type system is GraphQL's superpower. Every tool — codegen, validation, introspection, client cache, federation — depends on the schema being precise. A sloppy schema (overuse of String, missing non-null, wrong interface hierarchy) causes cascading problems: fragile clients, broken caching, confused teams.

---

## Examples

### Example 1: E-commerce Schema Skeleton

```graphql
scalar DateTime
scalar JSON

enum ProductStatus {
  ACTIVE
  DISCONTINUED
  OUT_OF_STOCK
}

interface Node {
  id: ID!
  createdAt: DateTime!
}

type Product implements Node {
  id: ID!
  createdAt: DateTime!
  name: String!
  price: Float!
  status: ProductStatus!
  variants: [ProductVariant!]!
}

type ProductVariant implements Node {
  id: ID!
  createdAt: DateTime!
  sku: String!
  attributes: JSON!
  stock: Int!
}

union CatalogItem = Product | ProductVariant

input ProductFilter {
  status: ProductStatus
  minPrice: Float
  maxPrice: Float
  search: String
}

type Query {
  products(filter: ProductFilter): [Product!]!
  catalogItems(ids: [ID!]!): [CatalogItem!]!
}
```

---

## Key Takeaways
- Schema is the single source of truth, defined in SDL
- Six type kinds: scalar, object, enum, interface, union, input
- Type modifiers express nullability and list constraints
- Interfaces share fields; unions group unrelated types
- Input types are the only way to pass complex arguments
- Directives annotate schema elements for runtime behavior
- Precision in schema design prevents downstream problems

---

## Common Misconception

**"Non-null everywhere is better — fewer null checks."**

Wrong. Non-null breaks at the field level, but null propagates up through non-null parents. If `User.email` is `String!` but the DB returns null, GraphQL nulls the entire `User` object, not just email. The null-bubble rule: a non-null field that resolves to null causes its parent to become null. Use `!` confidently for fields that are truly guaranteed, but prefer nullable for fields that could fail (external API calls, optional data).

---

## Feynman Explain
Explain GraphQL's type system to a backend developer who knows REST. Focus on: why SDL exists, what problem interfaces solve that REST doesn't have, and why non-null has a dangerous edge case. Use 3 sentences max per concept.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 1` — AI will probe your explanation for gaps.*

---

## Reframe
Critique: GraphQL's type system is verbose compared to TypeScript or Protobuf. Does requiring both server and client to define types create duplication? What scenarios justify this overhead?

---

## Drill
Take the quiz. MCQs test different angles — recall, application, scenario.

Run: `learn.sh quiz graphql-deep-dive 1`
