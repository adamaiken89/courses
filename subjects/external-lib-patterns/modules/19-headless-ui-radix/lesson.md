# Module 19: Headless UI Components — Radix Primitives

Est. study time: 2h
Language: en

## Learning Objectives
- Understand Radix Primitives philosophy: unstyled, accessible, composable
- Implement Dialog, Popover, DropdownMenu, Select, Tabs, Tooltip, Accordion, Slider
- Use asChild prop and Slot pattern for composition with custom styled components
- Compose primitives with Tailwind CSS or CSS Modules
- Understand FocusScope, keyboard navigation, and accessibility tree bridging
- Build design system layer: Radix Primitive + app styles + additional behavior
- React 19 ref prop compatibility

---

## Core Content

### Radix Primitives Philosophy

Radix Primitives provide headless (unstyled) React components with built-in accessibility, keyboard navigation, and focus management. The "headless" approach separates behavior from presentation.

```
Without Radix:
  <select> — native, hard to style
  Custom <Select> — must build a11y, keyboard nav, focus trap from scratch

With Radix:
  <Select.Root> — behavior (focus, expand, close)
  <Select.Trigger> — your styled trigger (button)
  <Select.Content> — your styled dropdown
  <Select.Item> — your styled options
```

| Primitive | Behavior provided |
|-----------|-----------------|
| Dialog | Open/close, overlay, focus trap, Escape, aria-modal |
| Popover | Positioning, flip, close on outside click |
| DropdownMenu | Submenu nesting, keyboard arrows, typeahead |
| Select | Listbox pattern, search, group labels |
| Tabs | Keyboard navigation (arrow keys, Home/End) |
| Tooltip | Show/hide delay, positioning, role=tooltip |
| Accordion | Expand/collapse, Enter/Space toggle |
| Slider | ARIA slider, keyboard increment, range support |

### Basic Setup

```typescript
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Select from '@radix-ui/react-select'
```

### Slot Pattern and asChild

Radix primitives render native HTML elements by default. `asChild` delegates rendering to child element — the child receives all Radix props and event handlers.

```typescript
// Without asChild — Radix renders <button>
;<Dialog.Trigger>Open</Dialog.Trigger>

// With asChild — Button component receives all Radix behavior
;<Dialog.Trigger asChild>
  <MyCustomButton variant="primary">Open</MyCustomButton>
</Dialog.Trigger>
```

`Slot` component (separate from Radix) enables similar pattern for custom components:

```typescript
import { Slot } from '@radix-ui/react-slot'

function Button({ asChild, ...props }) {
  const Component = asChild ? Slot : 'button'
  return <Component {...props} />
}
```

### Dialog

```typescript
import * as Dialog from '@radix-ui/react-dialog'

function ConfirmDeleteModal({ open, onOpenChange, onConfirm }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl">
          <Dialog.Title>Confirm Delete</Dialog.Title>
          <Dialog.Description>
            This action cannot be undone.
          </Dialog.Description>
          <div className="flex gap-2 mt-4">
            <Dialog.Close asChild>
              <button className="secondary">Cancel</button>
            </Dialog.Close>
            <button className="danger" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

Features: focus trap (Tab cycles within dialog), Escape closes, overlay click closes (configurable), scroll lock.

### Popover

```typescript
import * as Popover from '@radix-ui/react-popover'

function HelpPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button>Help</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={8}
          className="bg-white p-4 rounded shadow-lg"
        >
          <p>Help content here</p>
          <Popover.Close aria-label="Close">X</Popover.Close>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

Features: auto-flip when viewport edge reached, arrow positioning, close on outside click.

### DropdownMenu

```typescript
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

function UserMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button>Account</button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="bg-white rounded shadow-lg p-1 min-w-[200px]">
          <DropdownMenu.Item className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
          <DropdownMenu.Item className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-red-600">
            Logout
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

Features: keyboard arrows, typeahead search, submenu with auto-positon, disabled items.

### Select

```typescript
import * as Select from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'

function LanguageSelect() {
  return (
    <Select.Root defaultValue="en">
      <Select.Trigger className="flex items-center gap-2 px-3 py-2 border rounded">
        <Select.Value placeholder="Select language" />
        <Select.Icon><ChevronDown /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="bg-white rounded shadow-lg">
          <Select.ScrollUpButton />
          <Select.Viewport>
            <Select.Group>
              <Select.Label className="px-3 py-1 text-xs text-gray-500">
                Languages
              </Select.Label>
              <Select.Item value="en" className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
                <Select.ItemText>English</Select.ItemText>
                <Select.ItemIndicator>✓</Select.ItemIndicator>
              </Select.Item>
              <Select.Item value="zh" className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
                <Select.ItemText>Chinese</Select.ItemText>
                <Select.ItemIndicator>✓</Select.ItemIndicator>
              </Select.Item>
            </Select.Group>
          </Select.Viewport>
          <Select.ScrollDownButton />
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
```

### Tabs

```typescript
import * as Tabs from '@radix-ui/react-tabs'

function SettingsTabs() {
  return (
    <Tabs.Root defaultValue="account" orientation="horizontal">
      <Tabs.List className="flex border-b" aria-label="Settings">
        <Tabs.Trigger value="account" className="px-4 py-2 data-[state=active]:border-b-2 border-blue-500">
          Account
        </Tabs.Trigger>
        <Tabs.Trigger value="password" className="px-4 py-2 data-[state=active]:border-b-2 border-blue-500">
          Password
        </Tabs.Trigger>
        <Tabs.Trigger value="notifications" className="px-4 py-2 data-[state=active]:border-b-2 border-blue-500">
          Notifications
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account" className="mt-4">
        Account settings...
      </Tabs.Content>
      <Tabs.Content value="password" className="mt-4">
        Password settings...
      </Tabs.Content>
      <Tabs.Content value="notifications" className="mt-4">
        Notification settings...
      </Tabs.Content>
    </Tabs.Root>
  )
}
```

Features: arrow key navigation, Home/End, roving tabindex.

### Tooltip

```typescript
import * as Tooltip from '@radix-ui/react-tooltip'

function Toolbar() {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button>Undo</button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            className="bg-gray-900 text-white text-sm px-2 py-1 rounded"
          >
            Undo (Cmd+Z)
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
```

### FocusScope and Keyboard Navigation

Radix primitives use `FocusScope` internally for modals and menus. Custom usage:

```typescript
import { FocusScope } from '@radix-ui/react-focus-scope'

function CustomModal({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) {
  if (!isOpen) return null

  return (
    <FocusScope loop trapped>
      <div role="dialog" aria-modal="true">
        {children}
      </div>
    </FocusScope>
  )
}
```

### Build Design System Layer

Pattern: Radix Primitive + app styles + additional behavior = app component.

```typescript
// components/ui/select.tsx
import * as Select from '@radix-ui/react-select'

export function AppSelect({ options, placeholder, onChange, value }: Props) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="app-select-trigger">
        <Select.Value placeholder={placeholder} />
        <Select.Icon><ChevronDown /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="app-select-content">
          <Select.Viewport>
            {options.map((opt) => (
              <Select.Item key={opt.value} value={opt.value} className="app-select-item">
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator>✓</Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
```

### React 19 Ref Compatibility

Radix v2 supports React 19's ref-as-prop pattern. `asChild` components forward refs to child element.

```typescript
;<Dialog.Trigger asChild>
  <button ref={myRef}>Open</button>
</Dialog.Trigger>
```

> **Think**: When should you NOT use Radix primitives and build custom instead?
>
> *Answer: Build custom when: (1) behavior is extremely simple (basic button toggle), (2) accessibility is not critical (internal tool), (3) performance requirements demand minimal DOM (virtual scroller), (4) design requires non-standard interaction that Radix does not support.*

---

### Why This Matters

Accessibility is not optional. Radix primitives provide WCAG-compliant behavior out of the box: ARIA attributes, keyboard navigation, focus management, screen reader announcements. Building these behaviors from scratch is error-prone and rarely comprehensive. Radix allows teams to focus on styling and app logic while relying on battle-tested accessibility patterns.

---

### Common Questions

**Q: Can I use Radix with CSS-in-JS libraries like styled-components?**
A: Yes. asChild prop accepts any styled component. Radix assigns className and data attributes — CSS-in-JS targets them normally.

**Q: How to handle custom animations?**
A: Radix primitives expose data-state attributes (`data-[state=open]`, `data-[state=closed]`). Use these for CSS transitions or pair with Framer Motion's AnimatePresence.

---

## Examples

### Example 1: Design System Dialog

```typescript
// components/ui/modal.tsx
import * as Dialog from '@radix-ui/react-dialog'

export function Modal({ open, onOpenChange, title, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 max-w-md w-full data-[state=open]:animate-scale-in">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### Example 2: Accessible Dropdown Menu

```typescript
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

export function AppMenu({ trigger, items }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[220px] bg-white rounded-lg shadow-lg p-1"
          sideOffset={5}
        >
          {items.map((item) =>
            item.separator ? (
              <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                className="px-3 py-2 hover:bg-gray-100 data-[disabled]:opacity-50 cursor-pointer"
                onSelect={item.onSelect}
              >
                {item.label}
              </DropdownMenu.Item>
            )
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

---

## Key Takeaways
- Radix = headless, accessible, composable primitives. Behavior separated from styling.
- asChild prop delegates rendering to child — the child receives Radix event handlers and ARIA attributes.
- Dialog: focus trap, overlay, Escape handling, aria-modal.
- DropdownMenu: keyboard arrows, typeahead, submenus.
- Select: listbox pattern, search, groups, scroll buttons.
- Tabs: arrow key navigation, roving tabindex, aria-orientation.
- Tooltip: show/hide delay, positioning, accessible description.
- FocusScope: loop/trap for modals, menus, and custom focus management.
- Design system pattern: Radix Primitive + Tailwind styles + app-specific props.
- React 19: ref as prop works with asChild pattern.

## Common Misconception

**"Radix is a component library like Material UI. I can drop it in and get styled components."**

Radix is unstyled. It provides behavior and accessibility only. You must style every element. The power is in full control over appearance while getting production-grade accessibility for free. Compare: MUI gives styled components with default themes. Radix gives unstyled primitives — you build the design system on top.

---

## Feynman Explain
(Explain Radix asChild to designer: "Normal component library gives you pre-styled button. Radix gives you button behavior — focus, click, keyboard — but invisible. You bring your own button component. Radix attaches to your button via asChild prop, like a puppeteer controlling your puppet's movements without changing its appearance." Compare to furniture: IKEA (MUI) gives assembled furniture. Radix gives lumber + tools — you build furniture, but tools guarantee joints hold weight (accessibility).)

---

## Reframe
(Pause. Headless UI adds complexity. For a simple 3-page app, Radix adds boilerplate. For a product with 50+ components, Radix pays off: consistent keyboard behavior, ARIA attributes, focus management across every dialog, menu, and tooltip. Decision rule: if app has more than 10 interactive components, adopt headless UI library. If less, manual ARIA + native elements may be cheaper.)

---

## Drill
Take the quiz. MCQs test Radix primitives, asChild/Slot pattern, accessibility features, keyboard navigation, FocusScope, design system composition, and React 19 ref prop compatibility.

Run: `learn.sh quiz external-lib-patterns 19-headless-ui-radix`
