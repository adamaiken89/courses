# Module 33: QR & Barcodes — react-qrcode & jsbarcode

Est. study time: 1h
Language: en

## Learning Objectives
- Generate QR codes with react-qrcode (canvas and SVG modes)
- Configure error correction levels and QR customization
- Generate barcodes with jsbarcode (multiple formats)
- Build batch generation pattern with virtual scrolling
- Use React 19 Server Components for pre-rendered QR codes
- Implement canvas export to PNG via imperative ref API

---

## Core Content

### react-qrcode Architecture

Two renderers in react-qrcode:

- `QRCodeCanvas` — renders QR to `<canvas>` element
- `QRCodeSVG` — renders QR as SVG element (scalable, copyable)

```typescript
import { QRCodeCanvas, QRCodeSVG } from 'react-qrcode'

// Canvas renderer — good for export/print
<QRCodeCanvas value="https://example.com" size={256} />

// SVG renderer — good for inline display, copy, embedding
<QRCodeSVG
  value="https://example.com"
  size={256}
  bgColor="#ffffff"
  fgColor="#000000"
  level="M"
  includeMargin={false}
/>
```

### Error Correction Levels

| Level | Recovery | Use Case |
|-------|----------|----------|
| L | 7% | High density, clean surfaces |
| M | 15% | Moderate damage, general use |
| Q | 25% | Logo overlay, heavy wear |
| H | 30% | Maximum reliability, small data |

```typescript
// Pass with logo overlay; H level ensures scan still works
<QRCodeSVG value="https://example.com" level="H" />
```

### QR Customization

Color, size, margin, and logo overlay:

```typescript
<QRCodeSVG
  value="https://example.com"
  size={300}
  bgColor="#f0f0f0"
  fgColor="#333333"
  level="Q"
  includeMargin={true}
  marginSize={4}
  // Custom dot style (if supported by renderer)
  imageSettings={{
    src: '/logo.png',
    x: undefined, // auto-center
    y: undefined,
    height: 40,
    width: 40,
    excavate: true, // clear background behind logo
  }}
/>
```

`excavate` removes QR modules behind logo — prevents scan interference.

### jsbarcode Architecture

jsbarcode generates SVG or Canvas barcodes. Supports multiple formats:

```typescript
import JsBarcode from 'jsbarcode'

// SVG element
const svg = document.createElement('svg')
JsBarcode(svg, '1234567890128', {
  format: 'EAN-13',
  width: 2,
  height: 100,
  displayValue: true,
})
document.getElementById('barcode').appendChild(svg)

// Canvas element
const canvas = document.createElement('canvas')
JsBarcode(canvas, 'ABC-123', {
  format: 'CODE128',
  lineColor: '#000',
  background: '#fff',
})
```

### Barcode Formats

| Format | Usage | Character Set | Length |
|--------|-------|---------------|--------|
| CODE128 | Alphanumeric, general purpose | Full ASCII | Variable |
| EAN-13 | Retail products | Numeric | 13 digits |
| EAN-8 | Small packaging | Numeric | 8 digits |
| UPC-A | US retail | Numeric | 12 digits |
| CODE39 | Logistics, government | Alphanumeric + symbols | Variable |
| DataMatrix | Small items, electronics | Binary | Up to 2335 chars |
| ITF | Warehouse, shipping | Numeric | Variable |

### Batch Generation Pattern

Generating hundreds of QR/barcodes individually causes layout thrashing. Use virtual scrolling with generation outside visible window:

```typescript
'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { QRCodeSVG } from 'react-qrcode'
import { useRef } from 'react'

type Props = {
  items: { id: string; url: string }[]
}

export function QRCodeList({ items }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280,
  })

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index]
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <QRCodeSVG value={item.url} size={200} level="M" />
              <span>{item.id}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### React 19 Ref as Prop: Canvas Export

```typescript
'use client'

import { useRef } from 'react'
import { QRCodeCanvas } from 'react-qrcode'

type Props = {
  value: string
  fileName?: string
}

export function ExportableQR({ value, fileName = 'qr.png' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = fileName
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div>
      <QRCodeCanvas
        ref={canvasRef}
        value={value}
        size={256}
        level="H"
      />
      <button onClick={handleDownload}>Download PNG</button>
    </div>
  )
}
```

### Think: Server Components for Pre-rendered QR

QR codes are deterministic — same input produces same output. React 19 Server Components can pre-render QR to SVG string, sending zero JS to client:

```typescript
// Server Component — runs at build/request time
import { QRCodeSVG } from 'react-qrcode/server'

// This component never ships to client bundle
export async function StaticQR({ value }: { value: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={512}
      level="H"
    />
  )
}
```

`react-qrcode/server` renders to string without browser APIs. Wrap in Suspense for streaming:

```typescript
import { Suspense } from 'react'
import { StaticQR } from './StaticQR'

export default function Page() {
  return (
    <Suspense fallback={<QRSkeleton />}>
      <StaticQR value="https://example.com/product/123" />
    </Suspense>
  )
}
```

---

### Why This Matters

QR codes and barcodes bridge physical and digital worlds — ticketing, inventory, payments, authentication. Without wrapper, each feature duplicates configuration (error correction, format, size). Centralized wrapper ensures consistent scan reliability, format selection, and export behavior across all barcode features.

Server Components eliminate QR generation JS from client bundle. For product pages with 50 QR codes, this saves ~150KB compressed JS.

---

### Common Questions

**Q: Canvas vs SVG for QR codes — which to use?**
A: SVG for inline display (scales, copies, inspectable). Canvas for export (toDataURL/toBlob) or when you need pixel-level control.

**Q: Can jsbarcode generate QR codes too?**
A: jsbarcode supports QR format but it is limited. Use react-qrcode for QR codes (better error correction, customization, React integration). Use jsbarcode for linear barcodes (CODE128, EAN-13, etc).

**Q: How to batch generate 10000 labels without crashing browser?**
A: Virtual scroll rendering + offscreen generation via requestIdleCallback. Generate SVG strings in chunks, insert as HTML. Never mount 10000 DOM nodes.

---

## Examples

### Example 1: QR Component with Logo Overlay

```typescript
'use client'

import { QRCodeSVG } from 'react-qrcode'

type Props = {
  value: string
  logoSrc?: string
  size?: number
  errorLevel?: 'L' | 'M' | 'Q' | 'H'
}

export function QRWithLogo({
  value,
  logoSrc,
  size = 256,
  errorLevel = 'Q',
}: Props) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <QRCodeSVG
        value={value}
        size={size}
        level={errorLevel}
        imageSettings={logoSrc ? {
          src: logoSrc,
          height: size * 0.2,
          width: size * 0.2,
          excavate: true,
        } : undefined}
      />
    </div>
  )
}
```

### Example 2: Barcode SVG Component with jsbarcode

```typescript
'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

type Props = {
  value: string
  format?: 'CODE128' | 'EAN-13' | 'EAN-8' | 'UPC-A' | 'CODE39'
  width?: number
  height?: number
  displayValue?: boolean
}

export function Barcode({
  value,
  format = 'CODE128',
  width = 2,
  height = 80,
  displayValue = true,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, {
        format,
        width,
        height,
        displayValue,
      })
    }
  }, [value, format, width, height, displayValue])

  return <svg ref={svgRef} />
}
```

### Example 3: Export Hook for PNG Download

```typescript
'use client'

import { useCallback, useRef } from 'react'

export function useQRExport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const exportPNG = useCallback((fileName = 'qrcode.png') => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Increase resolution for print
    const scale = 4
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Scale canvas for high-res export
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width * scale
    tempCanvas.height = canvas.height * scale
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    tempCtx.scale(scale, scale)
    tempCtx.drawImage(canvas, 0, 0)

    const link = document.createElement('a')
    link.download = fileName
    link.href = tempCanvas.toDataURL('image/png', 1)
    link.click()
  }, [])

  return { canvasRef, exportPNG }
}
```

---

## Key Takeaways
- react-qrcode: Canvas for export, SVG for inline display
- Error correction: L (7%) to H (30%) — use H for logo overlay
- jsbarcode: CODE128 (general), EAN-13 (retail), DataMatrix (small items)
- Virtual scroll + batch generation prevents DOM thrashing for 100+ codes
- React 19 Server Components pre-render QR codes, zero client JS
- Ref-as-prop pattern for imperative canvas export to PNG
- excate=true on imageSettings clears QR modules behind logo

## Common Misconception

"**All QR codes with logo use same error correction as plain QR codes.**"

Logo overlay covers 15-25% of QR modules. Error correction must compensate. Always use level Q (25% recovery) or H (30% recovery) when overlaying logo. Level M (15%) will fail to scan with typical logo size.

---

## Feynman Explain
(Explain QR and barcodes to someone who has only scanned them. QR = checkerboard pattern stores URL/text. Error correction = redundancy — like spelling word twice so one smudge still readable. Barcodes = vertical lines encode numbers. Different barcode types for different industries. Logo on QR works because error correction fills in covered squares.)

---

## Reframe
(When not to use QR/barcode libraries? Tiny volumes (1-5 codes) can use online generator. Pre-generated static codes for print don't need React component at all — just serve SVG file. Library wrapper pays off when codes are dynamic (user-generated, batch exports, multi-format) or part of larger system.)

---

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 33-qr-barcode`
