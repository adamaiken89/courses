# Module 15: Command Palette — cmdk

Est. study time: 1.5h
Language: en

## Core Content

### cmdk Architecture

cmdk (⌘K) is a React command palette library. Low-level primitives for building search-driven menus:

```
<Command>           ─── Root context provider
  <CommandInput />  ─── Search input (auto-focused, filtering source)
  <CommandList>     ─── Scrollable results container
    <CommandEmpty>  ─── Shown when no results match
    <CommandGroup>  ─── Group heading + items
      <CommandItem> ─── Selectable item
    </CommandGroup>
  </CommandList>
</Command>
```

```typescript
import { Command } from 'cmdk'

function CommandMenu() {
  return (
    <Command label="Quick navigation" shouldFilter={false}>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => navigate('/dashboard')}>
            <IconDashboard />
            Dashboard
            <CommandShortcut>⌘1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/settings')}>
            <IconSettings />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => createDocument()}>
            <IconPlus />
            New Document
          </CommandItem>
          <CommandItem onSelect={() => openCommand('theme')}>
            <IconPalette />
            Change Theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
```

### Keyboard Shortcut Integration (react-hotkey)

Pairing cmdk with a keyboard shortcut library:

```typescript
import { useHotkeys } from 'react-hotkey'

function useCommandMenu() {
  const [open, setOpen] = useState(false)

  useHotkeys('meta+k', (e) => {
    e.preventDefault()
    setOpen(prev => !prev)
  })

  return { open, setOpen }
}

function AppCommandMenu() {
  const { open, setOpen } = useCommandMenu()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <CommandDialog>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>{/* ... */}</CommandList>
      </CommandDialog>
    </Dialog>
  )
}
```

> **Think**: useHotkeys vs event listener on keydown — what does the library provide?
>
> *Answer: useHotkeys provides: key combos (meta+k), scoping (only fire when not in input), ordering (stop propagation), and platform-aware modifier detection (cmd on Mac, ctrl on Windows).*

### Dynamic Command Registration Pattern

Commands should not be hardcoded. Registry pattern: modules register their commands at initialization:

```typescript
interface CommandRegistration {
  id: string
  label: string
  description?: string
  icon?: React.ComponentType
  keywords?: string[]
  category: string
  shortcut?: string
  perform: () => void
  priority?: number
}

class CommandRegistry {
  private commands = new Map<string, CommandRegistration>()
  private static instance: CommandRegistry

  static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry()
    }
    return CommandRegistry.instance
  }

  register(cmd: CommandRegistration): void {
    this.commands.set(cmd.id, cmd)
  }

  unregister(id: string): void {
    this.commands.delete(id)
  }

  getAll(): CommandRegistration[] {
    return Array.from(this.commands.values())
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  search(query: string): CommandRegistration[] {
    const lower = query.toLowerCase()
    return this.getAll().filter(cmd =>
      cmd.label.toLowerCase().includes(lower) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(lower))
    )
  }
}

export const commandRegistry = CommandRegistry.getInstance()
```

Module registers its commands:

```typescript
// modules/documents/index.ts
export function initDocumentsModule() {
  commandRegistry.register({
    id: 'documents:create',
    label: 'Create Document',
    description: 'Start a new document',
    icon: FilePlus,
    keywords: ['new', 'file', 'write'],
    category: 'Documents',
    shortcut: 'n',
    perform: () => router.navigate('/documents/new'),
    priority: 100,
  })

  commandRegistry.register({
    id: 'documents:search',
    label: 'Search Documents',
    description: 'Find documents by name or content',
    icon: Search,
    keywords: ['find', 'filter'],
    category: 'Documents',
    perform: () => router.navigate('/documents?search=true'),
    priority: 90,
  })
}
```

### Async Data Fetching in Command Items

Commands can fetch data asynchronously:

```typescript
function SearchUsers() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    setLoading(true)

    fetch(`/api/users?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setResults(data))
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [query])

  return (
    <CommandGroup heading="Users">
      {loading && <CommandItem disabled>Searching...</CommandItem>}
      {results.map(user => (
        <CommandItem
          key={user.id}
          onSelect={() => navigate(`/users/${user.id}`)}
          keywords={[user.name, user.email]}
        >
          <Avatar user={user} />
          <div>
            <span>{user.name}</span>
            <span style={{ fontSize: 12, color: 'gray' }}>{user.email}</span>
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
```

### Nested Commands (Submenus)

cmdk supports nested flows by swapping command lists:

```typescript
function ThemeSubmenu({ onBack }: { onBack: () => void }) {
  return (
    <Command>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 8 }}>
        <button onClick={onBack}><IconArrowLeft /></button>
        <CommandInput placeholder="Search themes..." autoFocus />
      </div>
      <CommandList>
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => applyTheme('light')}>
            Light
          </CommandItem>
          <CommandItem onSelect={() => applyTheme('dark')}>
            Dark
          </CommandItem>
          <CommandItem onSelect={() => applyTheme('system')}>
            System
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

// In main command:
<CommandItem onSelect={() => setActiveMenu('theme')}>
  <IconPalette />
  Change Theme
  <CommandShortcut>→</CommandShortcut>
</CommandItem>
```

### Dialog vs Inline Mode

cmdk works in both modes:

```typescript
// Dialog mode — overlay with backdrop
import { CommandDialog } from 'cmdk'

function App() {
  const { open, setOpen } = useCommandMenu()
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search..." />
      <CommandList>{/* ... */}</CommandList>
    </CommandDialog>
  )
}

// Inline mode — embedded in page
function SearchPage() {
  return (
    <div>
      <h2>Quick Actions</h2>
      <Command shouldFilter={false}>
        <CommandInput placeholder="Type to filter..." />
        <CommandList>{/* ... */}</CommandList>
      </Command>
    </div>
  )
}
```

> **Think**: Dialog mode captures keyboard focus inside the modal. Inline mode allows overlapping with page interactions. Which is better for a command palette?
>
> *Answer: Dialog mode — command palette should be a focused interrupt. Inline mode is better for: search pages, filter panels, or always-visible command bars.*

### Filtering and Search Ranking

cmdk has built-in filtering. `shouldFilter` prop controls behavior:

```typescript
// Default — cmdk filters by value and keywords
<Command>
  <CommandInput placeholder="Search..." />
  <CommandList>
    <CommandItem value="dashboard" keywords={['home', 'overview']}>
      Dashboard
    </CommandItem>
  </CommandList>
</Command>

// Custom filtering — cmdk only renders, you handle filtering
<Command shouldFilter={false}>
  <CommandInput onValueChange={setQuery} placeholder="Search..." />
  <CommandList>
    {filteredItems.map(item => (
      <CommandItem key={item.id} onSelect={item.perform}>
        {item.label}
      </CommandItem>
    ))}
  </CommandList>
</Command>
```

cmdk's default ranking: exact match > prefix match > substring match > keyword match.

---

### Why This Matters

Command palette is a power-user feature that makes apps feel professional. But hardcoded commands become stale and ignore module boundaries. Dynamic registration pattern lets each module own its commands — feature teams add commands without touching a central file. Keyboard shortcut integration completes the experience: Cmd+K → type → enter → action.

---

### Common Questions

**Q: cmdk vs react-autosuggest / downshift — when to use which?**
A: cmdk is for command palette (actions, navigation, search). Autosuggest/downshift are for form autocomplete (input suggestions, combobox). cmdk has built-in keyboard navigation, CommandShortcut, and dialog mode. Use downshift for form fields.

**Q: How to handle accessibility?**
A: cmdk uses ARIA combobox pattern: `role="combobox"`, `aria-activedescendant`, `aria-selected`. Items are navigable with arrow keys. <Command> has `label` prop for screen reader announcement.

**Q: Can commands include state toggles (dark mode toggle)?**
A: Yes — onSelect handler toggles state. Show current state in label: `CommandItem>Dark Mode {isDark ? 'On' : 'Off'}`. For toggles, consider checkmark icon or label suffix.

---

## Examples

### Example 1: Reusable CommandMenu Component

**Problem**: Build command palette once, use everywhere. Commands registered by feature modules.

**Solution**:
```typescript
function CommandMenu() {
  const { open, setOpen } = useCommandMenu()
  const [query, setQuery] = useState('')

  const commands = useMemo(() => commandRegistry.search(query), [query])

  return (
    <CommandDialog open={open} onOpenChange={setOpen} label="Quick actions">
      <CommandInput placeholder="Search actions and pages..." onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results for "{query}"</CommandEmpty>
        {groupBy(commands, 'category').map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map(cmd => (
              <CommandItem
                key={cmd.id}
                onSelect={() => { cmd.perform(); setOpen(false) }}
                keywords={cmd.keywords}
              >
                {cmd.icon && <cmd.icon />}
                <span>{cmd.label}</span>
                {cmd.description && <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.6 }}>{cmd.description}</span>}
                {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
```

### Example 2: Command Palette with Context-Aware Results

**Problem**: Commands should be context-aware. On documents page, show document actions first. On settings page, show settings actions first.

**Solution**:
```typescript
function ContextAwareCommandMenu() {
  const matches = useMatches() // from TanStack Router
  const currentRoute = matches[matches.length - 1]?.routeId ?? ''

  const commands = useMemo(() => {
    const all = commandRegistry.getAll()

    // Boost commands matching current context
    const scored = all.map(cmd => ({
      ...cmd,
      score: cmd.context?.includes(currentRoute) ? 1000 : 0,
    }))

    return scored.sort((a, b) => b.score - a.score)
  }, [currentRoute])

  return (
    <CommandDialog>
      <CommandInput placeholder="Search..." />
      <CommandList>
        {groupBy(commands, 'category').map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map(cmd => (
              <CommandItem key={cmd.id} onSelect={cmd.perform}>
                {cmd.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
```

---

## Key Takeaways
- cmdk primitives: Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty
- Dynamic command registration: modules register commands at init, registry manages lifecycle
- Keyboard shortcut: react-hotkey or native keydown for Cmd+K toggle
- Nested commands: swap command list for submenu navigation
- Dialog mode for command palette overlay, inline mode for embedded search
- Async data: fetch in useEffect, abort on query change, display results as CommandItems
- cmdk built-in filtering: value, keywords, and custom filter via shouldFilter={false}

## Common Misconception

**"Command palette is just a search bar."**

Command palette is search + action execution + context awareness. It combines: navigation (go to page), creation (new document), toggles (dark mode), data search (find user), and module-specific commands — all in one unified interface with keyboard-first interaction.

---

## Feynman Explain
(Explain cmdk to a junior developer: "cmdk gives you building blocks for a spotlight-search like VS Code's Cmd+K or Mac's Spotlight. You get a search bar, scrollable results, keyboard arrows, and selection handler. You provide the items and what happens when selected. The library handles focus, filtering, and accessibility.")

---

## Reframe
(Pause. Command palette is a power feature — not every app needs it. Consider: (1) Does the app have enough actions/navigation to justify Cmd+K? (2) Would keyboard shortcuts for individual actions be simpler? (3) How does command palette affect mobile users who lack keyboard? Command palette should grow from actual user feedback, not developer preference.)

---

## Drill
Take the quiz. MCQs test cmdk component architecture, command registration, filtering, keyboard shortcuts, and nested menus.

Run: `learn.sh quiz external-lib-patterns 15-command-palette-cmdk`
