# Module 14: Toast & Notifications — Sonner

Est. study time: 1h
Language: en

## Learning Objectives
- Integrate Sonner Toaster component with app-wide defaults
- Build typed toast helper functions for consistent notifications
- Implement promise-toast pattern for async operations
- Configure stacked vs expanded notification mode
- Customize toast appearance with CSS variables

---

## Core Content

### Sonner Architecture

Sonner is a minimal toast library for React. Key traits:
- Single `<Toaster />` component placed in app root
- Imperative API: `toast.success()`, `toast.error()`, `toast.promise()`
- Swipe-to-dismiss, stackable, rich content via JSX
- CSS-variable driven styling, no CSS-in-JS dependency
- ~5KB gzipped

```typescript
import { Toaster, toast } from 'sonner'

function App() {
  return (
    <div>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        expand
        visibleToasts={5}
      />
      <MainContent />
    </div>
  )
}

// Anywhere in app:
toast.success('File uploaded')
toast.error('Upload failed')
toast.info('Processing...')
toast.warning('Disk space low')
```

### App-Level Toast Helpers

Raw `toast.success()` is untyped and scattered. Typed helpers enforce consistency:

```typescript
// app/notifications.ts
import { toast } from 'sonner'

type ToastAction = {
  label: string
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface NotifyOptions {
  description?: string
  duration?: number
  action?: ToastAction
  dismissible?: boolean
}

function notifySuccess(message: string, options?: NotifyOptions) {
  return toast.success(message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
    action: options?.action ? {
      label: options.action.label,
      onClick: options.action.onClick,
    } : undefined,
    dismissible: options?.dismissible ?? true,
  })
}

function notifyError(message: string, options?: NotifyOptions) {
  return toast.error(message, {
    description: options?.description,
    duration: options?.duration ?? 6000,
    action: options?.action ? {
      label: options.action.label,
      onClick: options.action.onClick,
      buttonStyle: { backgroundColor: 'var(--color-destructive)' },
    } : undefined,
  })
}

function notifyInfo(message: string, options?: NotifyOptions) {
  return toast.info(message, {
    description: options?.description,
    duration: options?.duration ?? 3000,
  })
}

function dismissToast(id: string | number) {
  toast.dismiss(id)
}

function dismissAll() {
  toast.dismiss()
}
```

Consumption pattern:

```typescript
import { notifySuccess, notifyError } from '~/app/notifications'

notifySuccess('Profile updated', {
  description: 'Your changes have been saved.',
  action: { label: 'Undo', onClick: () => undoProfileUpdate() },
})
```

### Promise Toast Pattern

`toast.promise()` shows loading, success, and error states from a promise:

```typescript
async function uploadFile(file: File) {
  toast.promise(
    api.uploadFile(file),
    {
      loading: 'Uploading file...',
      success: (data) => `${data.name} uploaded successfully`,
      error: (err) => `Upload failed: ${err.message}`,
    }
  )
}
```

Integration with `useActionState` (React 19 server actions):

```typescript
import { useActionState } from 'react'
import { toast } from 'sonner'

function CreateUserForm() {
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await api.createUser(formData)

    if (result.error) {
      toast.error(result.error)
      return { error: result.error }
    }

    toast.success(`User ${result.name} created`)
    return { success: true }
  }, { error: null })

  return (
    <form action={formAction}>
      <input name="name" required />
      <button type="submit" disabled={pending}>
        {pending ? 'Creating...' : 'Create User'}
      </button>
      {state.error && <p style={{ color: 'red' }}>{state.error}</p>}
    </form>
  )
}
```

> **Think**: toast.promise blocks the caller until promise resolves. How to show progress for multi-step operations?
>
> *Answer: Manually manage toast lifecycle: `const id = toast.loading('Step 1...')`, update with `toast.success(msg, { id })` or `toast.error(msg, { id })`. Or chain multiple toast.promise calls sequentially.*

### Stacked vs Expanded Mode

```typescript
// Stacked (default): toasts overlay, newest on top
<Toaster expand={false} visibleToasts={5} />

// Expanded: toasts are stacked vertically with full content visible
<Toaster expand={true} visibleToasts={5} />
```

| Mode | Use Case |
|------|----------|
| Stacked | High-frequency notifications (real-time updates) |
| Expanded | Important messages where each toast needs full visibility |
| Hybrid | Expand only for errors/warnings, stack for success/info |

`visibleToasts` limits how many toasts display. Excess queue until dismissed.

### Rich Content with JSX

```typescript
toast.custom((t) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6' }} />
    <div>
      <p style={{ fontWeight: 600 }}>{message.title}</p>
      <p style={{ fontSize: 12, color: '#666' }}>{message.preview}</p>
    </div>
    <button onClick={() => toast.dismiss(t)} style={{ marginLeft: 'auto' }}>
      <IconX />
    </button>
  </div>
))
```

### Custom Styling with CSS Variables

```typescript
<Toaster
  style={{ fontFamily: 'Inter, sans-serif' }}
  toastOptions={{
    style: { border: '1px solid var(--border)' },
    classNames: {
      toast: 'my-toast',
      title: 'my-toast-title',
      description: 'my-toast-description',
      actionButton: 'my-toast-action',
      cancelButton: 'my-toast-cancel',
    },
  }}
/>
```

CSS variable overrides:

```css
.toaster {
  --sonner-normal-bg: var(--color-bg);
  --sonner-normal-text: var(--color-text);
  --sonner-success-bg: var(--color-success-bg);
  --sonner-success-text: var(--color-success-text);
  --sonner-error-bg: var(--color-error-bg);
  --sonner-error-text: var(--color-error-text);
  --sonner-info-bg: var(--color-info-bg);
  --sonner-info-text: var(--color-info-text);
  --sonner-border: var(--color-border);
  --sonner-radius: 8px;
}
```

---

### Why This Matters

Notifications appear in every app. Without abstraction, imports from Sonner spread across components, toast durations are inconsistent, and error messages lack action buttons. Typed helpers ensure: consistent timing (errors longer than success), accessible patterns (dismissible), and standard positioning.

---

### Common Questions

**Q: Sonner vs react-hot-toast — which to use?**
A: Sonner is smaller (~5KB vs ~7KB), has built-in rich colors, promise toast, and swipe-to-dismiss. react-hot-toast is more mature (wider browser support). Both are good. Sonner's API is slightly more ergonomic.

**Q: How to test toasts?**
A: Sonner exports `toast` imperatively — test by mocking and asserting calls. For E2E (Playwright): `await expect(page.getByText('File uploaded')).toBeVisible()`. For component tests: spy on `notifySuccess` from your helpers module.

**Q: Multiple Toaster instances — works?**
A: Yes — each Toaster is independent. Use multiple Toasters for separate notification zones (e.g., one for app notifications, one for system alerts). Each has own position and settings.

---

## Examples

### Example 1: Server Action Integration with Toast Feedback

**Problem**: Form submission via server action. Show loading while processing, success or error result.

**Solution**:
```typescript
"use server"
async function submitFeedback(prev: unknown, formData: FormData) {
  const message = formData.get('message') as string
  try {
    await db.feedback.create({ data: { message } })
    return { success: true, message: 'Feedback submitted' }
  } catch {
    return { success: false, message: 'Failed to submit feedback' }
  }
}

function FeedbackForm() {
  const [state, formAction, pending] = useActionState(submitFeedback, null)

  useEffect(() => {
    if (state?.success) notifySuccess(state.message)
    if (state && !state.success) notifyError(state.message)
  }, [state])

  return (
    <form action={formAction}>
      <textarea name="message" rows={4} required />
      <button type="submit" disabled={pending}>
        {pending ? <Spinner /> : 'Submit'}
      </button>
    </form>
  )
}
```

### Example 2: Retry Pattern with Action Button

**Problem**: Network request fails. Toast shows "Failed to load data" with Retry button.

**Solution**:
```typescript
function retryableFetch<T>(url: string, options?: RequestInit): Promise<T> {
  return fetch(url, options).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
}

async function loadDashboard() {
  try {
    const data = await retryableFetch('/api/dashboard')
    return data
  } catch (error) {
    notifyError('Failed to load dashboard', {
      duration: 10000,
      action: {
        label: 'Retry',
        onClick: () => loadDashboard(),
        variant: 'destructive',
      },
    })
  }
}
```

---

## Key Takeaways
- Place `<Toaster />` once in app root with app-wide position and styling
- Create typed helper functions (`notifySuccess`, `notifyError`) for consistent toast behavior
- `toast.promise()` handles loading/success/error lifecycle from a promise
- Integrate with React 19 `useActionState` for server action feedback
- `expand={true}` for important notifications, `expand={false}` for high-frequency
- Custom styles via CSS variables and `classNames` on toastOptions
- Rich content via `toast.custom()` for complex notification layouts

## Common Misconception

**"Toasts should only show success/error messages."**

Toasts communicate: success confirmations (file saved), error alerts (upload failed), progress updates (uploading 3/5 files), informational messages (new version available), system status (disconnected), undo actions (item deleted → undo), and rich interactive content (two-factor auth approval request).

---

## Feynman Explain
(Explain Sonner to a junior developer: "Sonner is a notification system. You call `toast.success('Done')` anywhere in your app. Appears as a small popup that auto-dismisses or can be swiped away. Promise toast watches a promise — shows loading while pending, success or error when settled.")

---

## Reframe
(Pause. Notifications are critical UX pattern. But does every action need a toast? Consider: form submission with inline error messages, background sync with silent retries, navigation changes without confirmation. Toast overuse creates notification fatigue — users start ignoring them. When is silence better than toast?)

---

## Drill
Take the quiz. MCQs test Sonner API, promise toast, typed helpers, positioning, and custom styling.

Run: `learn.sh quiz external-lib-patterns 14-toast-sonner`
