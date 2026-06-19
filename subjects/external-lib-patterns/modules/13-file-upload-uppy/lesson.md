# Module 13: File Upload — Uppy

Est. study time: 1.5h
Language: en

## Learning Objectives
- Integrate Uppy Dashboard as React component with proper lifecycle management
- Configure Tus resumable upload protocol for large files
- Register remote sources via Companion (Google Drive, Dropbox, etc.)
- Build file restriction hooks (size, type, count) with user feedback
- Design upload state tracking layer that decouples from Uppy events

---

## Core Content

### Uppy Architecture

Uppy is a modular file upload framework. Core concepts:

- **Core (`@uppy/core`)**: Event-driven upload engine. Manages file state, restrictions, upload pipeline
- **Dashboard (`@uppy/dashboard`)**: Built-in UI with drag-drop, file preview, progress, and provider tabs
- **Tus (`@uppy/tus`)**: Resumable upload via Tus protocol (pause/resume, chunking, network recovery)
- **Companion**: Server-side helper that proxies remote provider APIs (Google Drive, Dropbox, Instagram)

```
React App
  └── Uppy Dashboard (React wrapper)
        └── Uppy Core
              ├── Local files (file input / drag-drop)
              ├── Camera (webcam capture)
              ├── URL (remote URL download)
              └── Companion (Google Drive, Dropbox, Instagram, etc.)
                    └── Tus (resumable upload to server)
```

### Uppy React Integration

Uppy is vanilla JS with React wrapper. Lifecycle must be managed manually:

```typescript
import Uppy from '@uppy/core'
import Dashboard from '@uppy/dashboard'
import Tus from '@uppy/tus'
import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'

function Uploader() {
  const uppy = useMemo(() => {
    return new Uppy({
      restrictions: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxNumberOfFiles: 10,
        allowedFileTypes: ['.pdf', '.docx', '.png', '.jpg'],
      },
      autoProceed: false,
    })
      .use(Dashboard, {
        inline: true,
        target: document.body,
        showProgressDetails: true,
        proudlyDisplayPoweredByUppy: false,
      })
      .use(Tus, { endpoint: 'https://api.example.com/uploads' })
  }, [])

  useEffect(() => {
    return () => uppy.close()
  }, [uppy])

  return <div ref={el => { if (el && !el.hasChildNodes()) uppy.getPlugin('Dashboard').mount(el) }} />
}
```

Better: reusable `UppyUploader` component:

```typescript
interface UppyUploaderProps {
  endpoint: string
  restrictions?: UppyOptions['restrictions']
  onComplete?: (result: UploadResult) => void
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void
  companionUrl?: string
}

function UppyUploader({ endpoint, restrictions, onComplete, onProgress, companionUrl }: UppyUploaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uppyRef = useRef<Uppy | null>(null)

  useEffect(() => {
    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 50 * 1024 * 1024,
        maxNumberOfFiles: 10,
        ...restrictions,
      },
      autoProceed: false,
    })
      .use(Dashboard, { inline: true, target: containerRef.current!, showProgressDetails: true, proudlyDisplayPoweredByUppy: false })
      .use(Tus, { endpoint })

    if (companionUrl) {
      uppy.use(GoogleDrive, { companionUrl })
      uppy.use(Dropbox, { companionUrl })
    }

    uppy.on('complete', (result) => onComplete?.(result))
    uppy.on('progress', (bytesUploaded, bytesTotal) => onProgress?.(bytesUploaded, bytesTotal))

    uppyRef.current = uppy

    return () => { uppy.close({ removeFiles: true }) }
  }, [endpoint, companionUrl])

  return <div ref={containerRef} />
}
```

> **Think**: useEffect dependency array includes endpoint and companionUrl but not restrictions. Why?
>
> *Answer: restrictions object is recreated every render. Including it in deps would re-create Uppy on every render. Stable reference for restrictions via useMemo or omit — restrictions are configuration, not reactive state.*

### Tus Resumable Upload Protocol

Tus splits files into chunks. If upload interrupted (network loss, tab close), resumes from last confirmed chunk:

```typescript
.use(Tus, {
  endpoint: 'https://api.example.com/tus',
  chunkSize: 5 * 1024 * 1024, // 5MB chunks
  retryDelays: [0, 1000, 3000, 5000],
  removeFingerprintOnSuccess: true,
  headers: { Authorization: `Bearer ${token}` },
  onShouldRetry: (err, retryAttempt, options) => {
    if (err?.cause?.status === 403) return false // auth error — do not retry
    return true
  },
})
```

Server-side (Node.js with tus-node-server):

```typescript
import { Server } from '@tus/server'
import { FileStore } from '@tus/file-store'

const server = new Server({
  path: '/uploads',
  datastore: new FileStore({ directory: './uploads' }),
  onUploadCreate: async (req, res, upload) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token || !isValidToken(token)) {
      throw new Error('Unauthorized')
    }
  },
})

server.listen(3000)
```

### Companion — Remote File Sources

Companion is Node.js middleware that proxies OAuth flows for cloud providers:

```typescript
// server/companion.js
import { app } from '@uppy/companion'

const options = {
  providerOptions: {
    google: { key: process.env.GOOGLE_KEY, secret: process.env.GOOGLE_SECRET },
    dropbox: { key: process.env.DROPBOX_KEY, secret: process.env.DROPBOX_SECRET },
    drive: { key: process.env.GOOGLE_DRIVE_KEY, secret: process.env.GOOGLE_DRIVE_SECRET },
  },
  server: { host: 'localhost:3020', protocol: 'http' },
  filePath: './companion-files',
  secret: 'shhh-its-a-secret',
}

app(options).listen(3020)
```

In browser:

```typescript
.use(GoogleDrive, { companionUrl: 'http://localhost:3020' })
.use(Dropbox, { companionUrl: 'http://localhost:3020' })
```

Companion handles OAuth token exchange and file streaming — files never pass through companion server (streams directly to upload destination via Tus).

> **Think**: Self-host Companion vs use Uppy Cloud (companion.uppy.io)? What factors?
>
> *Answer: Self-host for: production apps, custom auth, data sovereignty, no rate limits. Uppy Cloud for: prototyping, small internal tools, low volume. Self-hosting adds operational cost (OAuth credentials, server maintenance, scaling).*

### Event-Driven Upload Tracking

Uppy emits events throughout upload lifecycle. Abstraction layer decouples app from Uppy events:

```typescript
interface UploadTracker {
  files: Map<string, { name: string; progress: number; status: 'pending' | 'uploading' | 'done' | 'error' }>
  totalProgress: number
  isUploading: boolean
}

function useUploadTracker(uppy: Uppy | null): UploadTracker {
  const [state, setState] = useState<UploadTracker>({ files: new Map(), totalProgress: 0, isUploading: false })

  useEffect(() => {
    if (!uppy) return

    const handlers = {
      'file-added': (file: UppyFile) => {
        setState(prev => {
          const files = new Map(prev.files)
          files.set(file.id, { name: file.name, progress: 0, status: 'pending' })
          return { ...prev, files }
        })
      },
      'upload-progress': (file: UppyFile, progress: { bytesUploaded: number; bytesTotal: number }) => {
        setState(prev => {
          const files = new Map(prev.files)
          const existing = files.get(file.id)
          if (existing) files.set(file.id, { ...existing, progress: Math.round((progress.bytesUploaded / progress.bytesTotal) * 100), status: 'uploading' })
          return { ...prev, files, isUploading: true }
        })
      },
      'complete': (result: UploadResult) => {
        setState(prev => {
          const files = new Map(prev.files)
          result.successful.forEach(f => files.set(f.id, { name: f.name, progress: 100, status: 'done' }))
          result.failed.forEach(f => files.set(f.id, { name: f.name, progress: 0, status: 'error' }))
          return { ...prev, files, isUploading: false, totalProgress: 100 }
        })
      },
      'total-progress': (progress: number) => {
        setState(prev => ({ ...prev, totalProgress: progress }))
      },
    }

    Object.entries(handlers).forEach(([event, handler]) => uppy.on(event as any, handler))
    return () => { Object.entries(handlers).forEach(([event, handler]) => uppy.off(event as any, handler)) }
  }, [uppy])

  return state
}
```

### Restrictions and Validation

```typescript
const uppy = new Uppy({
  restrictions: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxNumberOfFiles: 5,
    minNumberOfFiles: 1,
    allowedFileTypes: ['image/*', '.pdf', '.zip'],
  },
  onBeforeFileAdded: (currentFile: UppyFile, files: Record<string, UppyFile>) => {
    if (currentFile.size > 200 * 1024 * 1024) {
      uppy.info(`File too large: ${currentFile.name} (max 200MB)`, 'error', 5000)
      return false
    }
    if (Object.keys(files).length >= 10) {
      uppy.info('Max 10 files', 'error', 5000)
      return false
    }
    return true
  },
  onBeforeUpload: (files: Record<string, UppyFile>) => {
    const totalSize = Object.values(files).reduce((sum, f) => sum + f.size, 0)
    if (totalSize > 500 * 1024 * 1024) {
      uppy.info('Total upload size exceeds 500MB', 'error', 5000)
      return false
    }
    return true
  },
})
```

---

### Why This Matters

File upload is deceptively complex: large files need chunking, network interruptions need resume, remote sources need OAuth, progress needs real-time UI. Uppy handles all of this. Without abstraction, upload logic scatters across components with ad-hoc file inputs and fragile XMLHttpRequest wrappers.

---

### Common Questions

**Q: Uppy vs react-dropzone + fetch — when to use which?**
A: react-dropzone for simple file selection with custom UI. Add Uppy when: large files (Tus resumable), remote sources (Google Drive/Dropbox), progress UI, image preview/editing, batch uploads, server retry logic.

**Q: How to style Uppy Dashboard?**
A: Uppy uses CSS custom properties: `--upply-primary-color`, `--upply-secondary-color`, etc. Override in your CSS. For deep customization, use `Dashboard` with `inline: false` and `trigger: #custom-trigger` to show only the trigger button, render custom modal.

**Q: Does Uppy work with serverless (Vercel, AWS Lambda)?**
A: Tus requires persistent storage for upload state — not ideal for serverless. Options: (1) Use multipart uploads instead of Tus, (2) Use S3 multipart directly via `@uppy/aws-s3`, (3) Run Companion and Tus server as long-running process.

---

## Examples

### Example 1: Avatar Upload with Crop and Preview

**Problem**: User uploads profile photo. Must be image, max 5MB, aspect ratio 1:1. Show preview before upload.

**Solution**:
```typescript
function AvatarUpload({ onUpload }: { onUpload: (url: string) => void }) {
  const uppy = useMemo(() => new Uppy({
    restrictions: { maxFileSize: 5 * 1024 * 1024, allowedFileTypes: ['image/*'], maxNumberOfFiles: 1 },
    autoProceed: false,
  })
    .use(Dashboard, { inline: true, showProgressDetails: true, height: 300 })
    .use(ImageEditor, { cropperOptions: { aspectRatio: 1, viewMode: 1 } })
    .use(Tus, { endpoint: '/api/avatars' }), [])

  useEffect(() => {
    uppy.on('complete', (result) => { if (result.successful[0]) onUpload(result.successful[0].uploadURL) })
    return () => uppy.close()
  }, [uppy, onUpload])

  return <DashboardModal uppy={uppy} open={true} />
}
```

### Example 2: Batch Document Upload with Categorization

**Problem**: Legal document upload. Files sorted into categories (contract, NDA, addendum). Upload as batch.

**Solution**:
```typescript
function DocumentUploader({ matterId }: { matterId: string }) {
  const [category, setCategory] = useState<'contract' | 'nda' | 'addendum'>('contract')

  const uppy = useMemo(() => new Uppy({
    restrictions: { maxFileSize: 100 * 1024 * 1024, allowedFileTypes: ['.pdf', '.docx'] },
  })
    .use(Dashboard, { inline: true })
    .use(Tus, { endpoint: `/api/matters/${matterId}/documents?category=${category}` }), [matterId, category])

  return (
    <div>
      <select value={category} onChange={e => setCategory(e.target.value as typeof category)}>
        <option value="contract">Contract</option>
        <option value="nda">NDA</option>
        <option value="addendum">Addendum</option>
      </select>
      <Dashboard uppy={uppy} />
    </div>
  )
}
```

---

## Key Takeaways
- Uppy Core is event-driven engine. Dashboard provides UI. Tus enables resumable uploads.
- React wrapper must manage lifecycle: create Uppy in useMemo, mount Dashboard in useEffect, cleanup in useEffect return.
- Companion proxies remote providers (Google Drive, Dropbox). Self-host for production.
- App-level upload state tracker decouples from Uppy events — enables custom progress UI.
- Restrictions (size, type, count) configured in Core. onBeforeFileAdded for custom validation.
- Tus chunks files (default 5MB) with retry delays. Server needs tus-node-server or compatible.

## Common Misconception

**"Tus is just for large files."**

Tus resumable upload helps any file upload — even 100KB files benefit from network interruption recovery. Tus also provides: upload metadata, parallel chunks, server-side validation before upload starts, and standardized protocol that works across any tus-compatible server.

---

## Feynman Explain
(Explain Tus protocol to a backend developer: "Tus splits file into chunks. Server stores each chunk. If upload fails midway, client asks 'which chunks do you have?' and sends only missing chunks. Like resume download in browsers, but for uploads.")

---

## Reframe
(Pause. File upload component is complex — Uppy alone is ~50KB gzipped, Companion is a Node.js server. For an internal tool that uploads <1MB CSVs to a single endpoint, is Uppy overkill? Consider: plain `<input type=file>` + fetch multipart upload handles this in 10 lines. When does file upload complexity justify library cost?)

---

## Drill
Take the quiz. MCQs test Uppy lifecycle integration, Tus protocol, Companion setup, restrictions API, and upload tracking abstraction.

Run: `learn.sh quiz external-lib-patterns 13-file-upload-uppy`
