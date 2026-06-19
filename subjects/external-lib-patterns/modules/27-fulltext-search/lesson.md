# Module 27: Full-Text Search — Algolia InstantSearch

Est. study time: 2h
Language: en

## Learning Objectives
- Understand Algolia architecture (indices, records, searchable attributes)
- Use InstantSearch React hooks (useSearchBox, useHits, useRefinementList, usePagination)
- Build custom widgets from hooks
- Design faceting strategy with filter UI
- Configure highlighting and snippeting
- Implement analytics (clickEvents, conversion tracking)
- Use React 19 useTransition for debounce-free search input
- Apply React Compiler to search result components
- Use Server Components for initial SSR search results

---

## Core Content

### Algolia Architecture

Algolia indexes JSON records. Each record has searchable attributes, facet attributes, and ranking criteria.

```
Application
  └── Index (e.g., "products")
        ├── Record { objectID, name, description, price, category, tags }
        ├── Record { objectID, name, description, price, category, tags }
        └── ...
  └── Index (e.g., "articles")
        └── ...
```

Key concepts:

| Concept | Description |
|---------|-------------|
| Index | Collection of records, like DB table |
| Record | Document with objectID + attributes |
| Searchable attributes | Fields searched for text match |
| Facet attributes | Fields used for filtering/refinement |
| Ranking | Text relevance + custom ranking metrics |
| Highlighting | Matching text wrapped in <mark> tags |

### InstantSearch Setup

```typescript
import algoliasearch from 'algoliasearch/lite'
import { InstantSearch, SearchBox, Hits } from 'react-instantsearch'

const searchClient = algoliasearch(
  'YOUR_APP_ID',
  'YOUR_SEARCH_API_KEY'  // search-only, not admin
)

function SearchPage() {
  return (
    <InstantSearch
      searchClient={searchClient}
      indexName="products"
    >
      <SearchBox />
      <Hits />
    </InstantSearch>
  )
}
```

Uses search-only API key (public). Admin API key never on client.

### Hooks API

InstantSearch React hooks provide granular control:

```typescript
import { useSearchBox, useHits, useRefinementList, usePagination } from 'react-instantsearch'

function CustomSearchBox() {
  const { query, refine, clear } = useSearchBox()

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => refine(e.target.value)}
        placeholder="Search products..."
      />
      {query && <button onClick={clear}>Clear</button>}
    </div>
  )
}

function CustomHits() {
  const { items, sendEvent } = useHits<{
    objectID: string
    name: string
    price: number
    category: string
  }>()

  return (
    <ul>
      {items.map((hit) => (
        <li
          key={hit.objectID}
          onClick={() => sendEvent('click', hit, 'Hit Clicked')}
        >
          <article>
            <h3><HitHighlight attribute="name" hit={hit} /></h3>
            <p><HitHighlight attribute="description" hit={hit} /></p>
            <p>${hit.price} — {hit.category}</p>
          </article>
        </li>
      ))}
    </ul>
  )
}

function CustomRefinementList() {
  const { items, refine } = useRefinementList({ attribute: 'category' })

  return (
    <fieldset>
      <legend>Filter by Category</legend>
      {items.map((item) => (
        <label key={item.value}>
          <input
            type="checkbox"
            checked={item.isRefined}
            onChange={() => refine(item.value)}
          />
          {item.label} ({item.count})
        </label>
      ))}
    </fieldset>
  )
}

function CustomPagination() {
  const { pages, currentRefinement, refine } = usePagination()

  return (
    <nav>
      {pages.map((page) => (
        <button
          key={page}
          onClick={() => refine(page)}
          disabled={page === currentRefinement}
        >
          {page + 1}
        </button>
      ))}
    </nav>
  )
}
```

### Faceting Strategy

```typescript
// InstantSearch config with faceting
function SearchWithFacets() {
  return (
    <InstantSearch
      searchClient={searchClient}
      indexName="products"
    >
      <div className="search-layout">
        <aside className="filters">
          <h3>Filters</h3>
          <section>
            <h4>Category</h4>
            <CustomRefinementList attribute="category" />
          </section>
          <section>
            <h4>Price Range</h4>
            <CustomNumericMenu
              attribute="price"
              items={[
                { label: 'Under $50', start: 0, end: 50 },
                { label: '$50 - $100', start: 50, end: 100 },
                { label: 'Over $100', start: 100 },
              ]}
            />
          </section>
          <section>
            <h4>Rating</h4>
            <CustomRatingMenu attribute="rating" />
          </section>
        </aside>
        <main>
          <CustomSearchBox />
          <CustomHits />
          <CustomPagination />
        </main>
      </div>
    </InstantSearch>
  )
}
```

Facet strategy considerations:

| Strategy | Use Case |
|----------|----------|
| Single select | Category, brand (mutually exclusive) |
| Multi select | Tags, features (and/or logic) |
| Range/Numeric | Price, year, rating |
| Hierarchical | Category tree (Electronics > Phones > iOS) |
| Disjunctive | OR across facets, AND within facet |

### Highlighting and Snippeting

```typescript
import { Highlight, Snippet } from 'react-instantsearch'

function SearchResult({ hit }: { hit: any }) {
  return (
    <div>
      <h3>
        <Highlight attribute="name" hit={hit} />
      </h3>
      <p>
        <Highlight attribute="description" hit={hit} />
      </p>
      <p className="snippet">
        <Snippet attribute="longDescription" hit={hit} />
      </p>
    </div>
  )
}
```

Highlight wraps matching words in `<mark>` tags. Snippet truncates long text with ellipsis around matches. Configure snippet size in Algolia dashboard.

### Analytics: clickEvents and Conversion

```typescript
import { useHit, useSearchBox } from 'react-instantsearch'

function TrackedSearchBox() {
  const { query, refine } = useSearchBox()

  const handleSearch = (value: string) => {
    refine(value)
    // Send search event
    if (window.aa) {
      window.aa('clickedObjectIDsAfterSearch', {
        index: 'products',
        queryID: '',  // from Algolia response
      })
    }
  }

  return (
    <input
      type="search"
      value={query}
      onChange={(e) => handleSearch(e.target.value)}
    />
  )
}
```

```typescript
// Conversion tracking
function PurchaseButton({ hit }: { hit: any }) {
  const { sendEvent } = useHit()

  const handlePurchase = () => {
    sendEvent('conversion', hit, 'Purchased')
    // Process purchase...
  }

  return <button onClick={handlePurchase}>Buy Now</button>
}
```

Algolia analytics tracks: searches, clicks, conversions, popular searches, click-through rate (CTR), zero-result queries.

### Custom Widget from Hooks

```typescript
import { useConnector } from 'react-instantsearch'
import type { Connector } from 'instantsearch.js'

// Custom connector for recent searches
interface RecentSearchesWidgetProps {
  limit?: number
  onSelect: (query: string) => void
}

function RecentSearchesWidget({ limit = 5, onSelect }: RecentSearchesWidgetProps) {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const stored = localStorage.getItem('algolia-recent-searches')
    return stored ? JSON.parse(stored) : []
  })

  const addSearch = (query: string) => {
    setRecentSearches((prev) => {
      const updated = [query, ...prev.filter((q) => q !== query)].slice(0, limit)
      localStorage.setItem('algolia-recent-searches', JSON.stringify(updated))
      return updated
    })
  }

  const clearRecent = () => {
    setRecentSearches([])
    localStorage.removeItem('algolia-recent-searches')
  }

  return (
    <div className="recent-searches">
      <div className="recent-header">
        <span>Recent searches</span>
        <button onClick={clearRecent}>Clear</button>
      </div>
      {recentSearches.length === 0 ? (
        <p className="empty">No recent searches</p>
      ) : (
        <ul>
          {recentSearches.map((query) => (
            <li key={query}>
              <button onClick={() => onSelect(query)}>{query}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Usage
function SearchWithRecent() {
  const { refine } = useSearchBox()

  return (
    <div>
      <CustomSearchBox onSearch={(q) => refine(q)} />
      <RecentSearchesWidget onSelect={(q) => refine(q)} />
      <CustomHits />
    </div>
  )
}
```

### React 19 useTransition for Search Input

```typescript
'use client'

import { useSearchBox } from 'react-instantsearch'
import { useState, useTransition, useDeferredValue } from 'react'

function TransitionSearchBox() {
  const { refine } = useSearchBox()
  const [inputValue, setInputValue] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Mark search refinement as low-priority update
    startTransition(() => {
      refine(value)
    })
  }

  return (
    <div>
      <input
        type="search"
        value={inputValue}
        onChange={handleChange}
        placeholder="Search..."
        style={{
          borderColor: isPending ? 'var(--color-pending)' : undefined,
        }}
      />
      {isPending && <span className="search-pending">Updating...</span>}
    </div>
  )
}
```

useTransition marks search refinement as non-urgent. Input stays responsive while search results update. No debounce needed — React prioritizes input update over result rendering.

```typescript
// Alternative: useDeferredValue
function DeferredSearchBox() {
  const { refine } = useSearchBox()
  const [inputValue, setInputValue] = useState('')
  const deferredQuery = useDeferredValue(inputValue)

  useEffect(() => {
    refine(deferredQuery)
  }, [deferredQuery, refine])

  return (
    <input
      type="search"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
    />
  )
}
```

useDeferredValue holds stale value for rendering while new value loads. Combined with isPending indicator.

> **Think**: useTransition vs useDeferredValue vs debounce — which to use for search?
>
> *Answer: useTransition marks state update as low priority inside event handler. useDeferredValue holds stale value for derived state (good when search value read by multiple components). Debounce adds fixed delay regardless of render speed. useTransition adapts to device speed — no magic number needed.*

### React Compiler with Search Result Components

```typescript
'use client'

import { memo } from 'react'
import { Highlight } from 'react-instantsearch'

// React Compiler (automatic memoization) handles this component
// No manual useMemo/useCallback needed with React 19 + Compiler
function SearchHit({ hit }: { hit: Hit }) {
  return (
    <article className="search-hit">
      <h3><Highlight attribute="name" hit={hit} /></h3>
      <p><Highlight attribute="description" hit={hit} /></p>
      <div className="hit-meta">
        <span className="hit-price">${hit.price}</span>
        <span className="hit-rating">{'★'.repeat(Math.round(hit.rating))}</span>
      </div>
    </article>
  )
}

// Without compiler, use memo for identical hits not re-rendering
const MemoizedSearchHit = memo(SearchHit)

function SearchResults({ items }: { items: Hit[] }) {
  return (
    <ul>
      {items.map((item) => (
        <MemoizedSearchHit key={item.objectID} hit={item} />
      ))}
    </ul>
  )
}
```

React Compiler automatically memoizes components and hooks. For non-compiler projects, manual memo on SearchHit prevents re-render of unchanged hits when query changes.

### Server Components for Initial SSR Results

```typescript
// SearchResults.server.tsx
import algoliasearch from 'algoliasearch'

const searchClient = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_API_KEY!  // server-side only
)

async function ServerSearchResults({ query }: { query: string }) {
  const result = await searchClient.initIndex('products').search(query, {
    hitsPerPage: 20,
    attributesToRetrieve: ['name', 'description', 'price', 'category', 'rating'],
  })

  return (
    <div>
      <p>{result.nbHits} results found</p>
      <ul>
        {result.hits.map((hit: any) => (
          <li key={hit.objectID}>
            <h3>{hit.name}</h3>
            <p>{hit.description}</p>
            <p>${hit.price}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Page component
async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = searchParams.q ?? ''

  return (
    <div>
      <ClientSearchInput defaultValue={query} />
      <Suspense fallback={<SearchSkeleton />}>
        <ServerSearchResults query={query} />
      </Suspense>
    </div>
  )
}
```

Server Components render initial search results on first load. Client components handle subsequent interactive search. Reduces client-side API calls on page load.

---

### Why This Matters

Search is universal in data-driven apps. Without dedicated search infrastructure, apps resort to client-side filter (O(n) scan) or naive SQL LIKE queries. Algolia provides sub-50ms full-text search with typo tolerance, faceting, and analytics. Understanding InstantSearch hooks allows building custom search UIs without full platform lock-in.

---

### Common Questions

**Q: Algolia vs Elasticsearch vs Meilisearch?**
A: Algolia is SaaS, fully managed, fastest (sub-50ms). Elasticsearch is self-hosted, more complex, more configurable. Meilisearch is open-source, simpler than Elasticsearch, good middle ground. For most React apps, Algolia's managed service reduces ops burden.

**Q: How to handle user-specific search results?**
A: Use Secured API Keys (with filters) to scope results per user. Never filter on client side — users can inspect network requests. Generate API key on server: `client.generateSecuredApiKey(searchKey, { filters: 'user_id:123' })`.

---

## Examples

### Example 1: Multi-Facet Filter Sidebar

```typescript
'use client'

import {
  useRefinementList,
  useRange,
  useRatingMenu,
  useClearRefinements,
} from 'react-instantsearch'

function FilterSidebar() {
  return (
    <aside className="filter-sidebar">
      <ClearFilters />
      <CategoryFilter />
      <PriceRangeFilter />
      <RatingFilter />
      <BrandFilter />
    </aside>
  )
}

function ClearFilters() {
  const { refine, canRefine } = useClearRefinements()

  return (
    <button onClick={refine} disabled={!canRefine}>
      Clear all filters
    </button>
  )
}

function CategoryFilter() {
  const { items, refine } = useRefinementList({
    attribute: 'category',
    sortBy: ['count:desc'],
    limit: 10,
    showMore: true,
  })

  return (
    <div className="filter-section">
      <h4>Category</h4>
      <ul>
        {items.map((item) => (
          <li key={item.value} className="filter-item">
            <label>
              <input
                type="checkbox"
                checked={item.isRefined}
                onChange={() => refine(item.value)}
              />
              <span className="filter-label">{item.label}</span>
              <span className="filter-count">({item.count})</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PriceRangeFilter() {
  const { range, refine } = useRange({
    attribute: 'price',
    min: 0,
    max: 500,
  })

  const [min, max] = range
  const [currentMin, currentMax] = range

  return (
    <div className="filter-section">
      <h4>Price Range</h4>
      <div className="range-inputs">
        <input
          type="number"
          value={currentMin}
          onChange={(e) => refine([Number(e.target.value), currentMax])}
          min={min}
          max={max}
        />
        <span>to</span>
        <input
          type="number"
          value={currentMax}
          onChange={(e) => refine([currentMin, Number(e.target.value)])}
          min={min}
          max={max}
        />
      </div>
    </div>
  )
}

function RatingFilter() {
  const { items, refine } = useRatingMenu({ attribute: 'rating' })

  return (
    <div className="filter-section">
      <h4>Minimum Rating</h4>
      <ul>
        {items.map((item) => (
          <li key={item.value} className="filter-item">
            <button
              onClick={() => refine(item.value)}
              className={item.isRefined ? 'active' : ''}
            >
              {'★'.repeat(Number(item.value))} & up ({item.count})
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BrandFilter() {
  const { items, refine } = useRefinementList({
    attribute: 'brand',
    searchable: true,
    searchablePlaceholder: 'Search brands...',
  })

  return (
    <div className="filter-section">
      <h4>Brand</h4>
      <ul>
        {items.map((item) => (
          <li key={item.value} className="filter-item">
            <label>
              <input
                type="checkbox"
                checked={item.isRefined}
                onChange={() => refine(item.value)}
              />
              <span className="filter-label">{item.label}</span>
              <span className="filter-count">({item.count})</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FilterSidebar
```

### Example 2: Custom SearchBox with Recent Searches and Autocomplete

```typescript
'use client'

import { useSearchBox } from 'react-instantsearch'
import { useState, useRef, useEffect, useTransition } from 'react'

interface RecentSearch {
  query: string
  timestamp: number
}

const STORAGE_KEY = 'recent-searches'
const MAX_RECENT = 8

function useRecentSearches() {
  const [recent, setRecent] = useState<RecentSearch[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  })

  const addRecent = (query: string) => {
    if (!query.trim()) return
    setRecent((prev) => {
      const filtered = prev.filter((r) => r.query !== query)
      const updated = [{ query, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const clearRecent = () => {
    setRecent([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return { recent, addRecent, clearRecent }
}

import { useSearchBox } from 'react-instantsearch'

function AutocompleteSearchBox() {
  const { refine, query } = useSearchBox()
  const [inputValue, setInputValue] = useState(query)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { recent, addRecent, clearRecent } = useRecentSearches()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowDropdown(true)
    startTransition(() => {
      refine(value)
    })
  }

  const handleSearch = (value: string) => {
    setInputValue(value)
    addRecent(value)
    setShowDropdown(false)
    startTransition(() => {
      refine(value)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      addRecent(inputValue.trim())
      setShowDropdown(false)
    }
  }

  return (
    <div className="search-box-container">
      <form onSubmit={handleSubmit} role="search">
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="search"
            value={inputValue}
            onChange={handleChange}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search products, categories, brands..."
            aria-label="Search"
            className={isPending ? 'search-pending' : ''}
          />
          {isPending && <span className="search-spinner" aria-label="Searching" />}
        </div>
      </form>

      {showDropdown && (
        <div ref={dropdownRef} className="search-dropdown">
          {inputValue.length < 2 && recent.length > 0 && (
            <section className="recent-searches">
              <div className="dropdown-header">
                <span>Recent searches</span>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="clear-btn"
                >
                  Clear
                </button>
              </div>
              <ul>
                {recent.map((r) => (
                  <li key={r.query}>
                    <button
                      type="button"
                      onClick={() => handleSearch(r.query)}
                      className="recent-item"
                    >
                      {r.query}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {inputValue.trim() && (
            <section className="suggestions">
              <div className="dropdown-header">
                <span>Suggestions</span>
              </div>
              <ul>
                <li>
                  <button
                    type="button"
                    onClick={() => handleSearch(inputValue)}
                    className="suggestion-item"
                  >
                    Search for "{inputValue}"
                  </button>
                </li>
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default AutocompleteSearchBox
```

---

## Key Takeaways
- Algolia indexes JSON records with searchable and facet attributes
- InstantSearch hooks: useSearchBox (query input), useHits (results), useRefinementList (filters), usePagination
- Custom widgets built from hooks for full UI control
- Faceting strategy: multi-select for tags, range for numbers, hierarchical for categories
- Highlight wraps matches in <mark>, Snippet truncates with context
- Analytics: sendEvent for click tracking, conversion events
- React 19 useTransition marks search refinement as low-priority — no debounce needed
- React Compiler auto-memoizes search result components
- Server Components render initial search results server-side
- Secured API Keys scope search results per user

## Common Misconception

"**InstantSearch forces predefined UI components — cannot customize.**"

InstantSearch provides hooks (useSearchBox, useHits, etc.) for completely custom UI. The prebuilt <SearchBox /> and <Hits /> are optional convenience components. Custom widgets built from hooks render any layout, interactivity, and styling.

---

## Feynman Explain
(Explain Algolia to a junior: "Algolia is like Google for your app data. You upload records (JSON objects), define which fields are searchable (like title, description), and users get fast autocomplete-style results. InstantSearch is React bindings — hooks connect your custom UI components to Algolia. Use transition to keep input responsive while search runs. Facets are filters like category or price range. Server Components render first search on page load so user sees results instantly.")

---

## Reframe
(Pause. Search is not just about search boxes. Algolia's faceting teaches a broader lesson: data should be filterable by multiple dimensions simultaneously. The faceting pattern — defining facets, managing OR/AND logic, counting results per facet — applies to e-commerce filters, dashboard data exploration, knowledge base browsing. The mental model of segmented refinement is more valuable than the Algolia-specific API.)

---

## Drill
Take the quiz. MCQs test Algolia architecture, InstantSearch hooks, faceting, highlighting, React 19 useTransition/useDeferredValue, Server Components, custom widgets, analytics, and React Compiler.

Run: `learn.sh quiz external-lib-patterns 27-fulltext-search`
