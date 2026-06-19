# Module 25: PDF Rendering — @react-pdf/renderer

Est. study time: 1.5h
Language: en

## Learning Objectives
- Use @react-pdf Document/Page/View/Text components
- Build PDF layouts with Flexbox
- Register and use custom fonts
- Embed images in PDF documents
- Generate dynamic PDF content
- Implement PDF download in browser
- Stream large PDFs for performance
- Use React 19 Suspense for async PDF generation
- Apply useTransition for export button to prevent UI freeze
---

## Core Content

### Document/Page/View/Text Components

@react-pdf/renderer provides React components that compile to PDF:

```tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 8,
  },
})

export function SimpleDocument() {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.heading}>Invoice</Text>
          <Text style={styles.paragraph}>
            This is a sample PDF document generated with React components.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
```

Components: `Document` (root), `Page` (one per page), `View` (layout container, like div), `Text` (text content), `Image`, `Link`, `Note`, `Svg`.

### Layout with Flexbox

@react-pdf supports Flexbox for layout:

```tsx
const styles = StyleSheet.create({
  page: { padding: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    borderBottom: '1px solid #ccc',
    paddingBottom: 16,
  },
  invoiceTable: {
    flexDirection: 'column',
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #eee',
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  cell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
  },
  cellAmount: {
    width: 100,
    textAlign: 'right',
    padding: 8,
    fontSize: 10,
  },
})

function InvoiceTable({ items }: { items: LineItem[] }) {
  return (
    <View style={styles.invoiceTable}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={styles.cell}>Description</Text>
        <Text style={styles.cell}>Qty</Text>
        <Text style={styles.cell}>Rate</Text>
        <Text style={styles.cellAmount}>Amount</Text>
      </View>
      {items.map((item, i) => (
        <View style={styles.tableRow} key={i}>
          <Text style={styles.cell}>{item.description}</Text>
          <Text style={styles.cell}>{item.quantity}</Text>
          <Text style={styles.cell}>${item.rate.toFixed(2)}</Text>
          <Text style={styles.cellAmount}>${item.amount.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  )
}
```

### Register Custom Fonts

```tsx
import { Font } from '@react-pdf/renderer'

Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Inter-Bold.ttf', fontWeight: 700 },
    { src: '/fonts/Inter-Italic.ttf', fontStyle: 'italic' },
  ],
})

Font.register({
  family: 'NotoSansSC',
  src: '/fonts/NotoSansSC-Regular.otf',
  // For CJK character support
})
```

Usage:

```tsx
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
  },
  heading: {
    fontFamily: 'Inter',
    fontWeight: 700,
  },
})
```

### Images in PDF

```tsx
import { Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  logo: {
    width: 120,
    height: 40,
    marginBottom: 16,
  },
  photo: {
    width: '100%',
    height: 200,
    objectFit: 'cover',
  },
})

function InvoiceHeader() {
  return (
    <View>
      <Image style={styles.logo} src="/logo.png" />
      <Image style={styles.photo} src={{ uri: '/header-bg.jpg', method: 'GET' }} />
    </View>
  )
}
```

Images can be local files, remote URLs, or base64 data URIs.

### Dynamic Content Generation

```tsx
function InvoiceDocument({ invoice }: { invoice: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{invoice.company.name}</Text>
            <Text>{invoice.company.address}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE #{invoice.number}</Text>
            <Text>Date: {invoice.date}</Text>
            <Text>Due: {invoice.dueDate}</Text>
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.sectionTitle}>Bill To:</Text>
          <Text>{invoice.client.name}</Text>
          <Text>{invoice.client.email}</Text>
        </View>

        <InvoiceTable items={invoice.items} />

        <View style={styles.totals}>
          <Text>Subtotal: ${invoice.subtotal.toFixed(2)}</Text>
          <Text>Tax: ${invoice.tax.toFixed(2)}</Text>
          <Text style={styles.total}>Total: ${invoice.total.toFixed(2)}</Text>
        </View>

        <Text style={styles.footer}>
          Payment due within 30 days. Thank you for your business.
        </Text>
      </Page>
    </Document>
  )
}
```

### PDF Download in Browser

```tsx
'use client'
import { pdf } from '@react-pdf/renderer'
import { InvoiceDocument } from './InvoiceDocument'
import { useState, useTransition } from 'react'

function DownloadInvoiceButton({ invoice }: { invoice: InvoiceData }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDownload = () => {
    startTransition(async () => {
      try {
        setError(null)
        const blob = await pdf(<InvoiceDocument invoice={invoice} />).toBlob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${invoice.number}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        setError('Failed to generate PDF')
      }
    })
  }

  return (
    <div>
      <button onClick={handleDownload} disabled={isPending}>
        {isPending ? 'Generating PDF...' : 'Download Invoice'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  )
}
```

### Streaming Large PDFs

For large documents, use `toBuffer()` for server-side streaming:

```tsx
// app/api/invoice/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { pdf } from '@react-pdf/renderer'
import { InvoiceDocument } from '@/components/pdf/InvoiceDocument'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoice = await getInvoice(params.id)

  const pdfStream = await pdf(<InvoiceDocument invoice={invoice} />).toBuffer()

  return new NextResponse(pdfStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
      'Content-Length': pdfStream.length.toString(),
    },
  })
}
```

### React 19 Suspense for Async PDF Generation

```tsx
import { Suspense } from 'react'
import { PDFViewer } from '@react-pdf/renderer'

async function InvoicePDFContent({ invoiceId }: { invoiceId: string }) {
  const invoice = await fetchInvoiceData(invoiceId)

  return (
    <PDFViewer width="100%" height={600}>
      <InvoiceDocument invoice={invoice} />
    </PDFViewer>
  )
}

export default function InvoicePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="animate-pulse h-[600px] bg-gray-100 rounded" />}>
      <InvoicePDFContent invoiceId={params.id} />
    </Suspense>
  )
}
```

---

### Why This Matters

PDF generation is a common requirement (invoices, reports, certificates). @react-pdf/renderer brings React component model to PDF authoring, making layouts declarative and reusable. Combined with React 19's async rendering capabilities, PDF generation integrates naturally into the React data flow.

---

### Common Questions

**Q: Can @react-pdf/renderer render HTML?**

A: No. Use View/Text components for layout. For HTML-to-PDF conversion, consider puppeteer or a dedicated HTML-to-PDF service.

**Q: How do I handle page breaks for long content?**

A: Use `wrap={false}` on View/Text to prevent breaking across pages. Set `break` prop on View to force page breaks. For auto page break, wrap content in a layout that splits dynamically.

---

## Examples

### Example 1: Invoice PDF Component

```tsx
import { Document, Page, View, Text, StyleSheet, Font, Image } from '@react-pdf/renderer'

Font.register({
  family: 'Inter',
  src: '/fonts/Inter-Regular.ttf',
  fontWeight: 400,
})

Font.register({
  family: 'Inter',
  src: '/fonts/Inter-Bold.ttf',
  fontWeight: 700,
})

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#1a1a1a',
  },
  logo: {
    width: 100,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#2563eb',
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #f1f5f9',
    paddingVertical: 8,
  },
  colDescription: { flex: 3, paddingHorizontal: 8 },
  colQty: { flex: 1, paddingHorizontal: 8, textAlign: 'center' },
  colRate: { flex: 1, paddingHorizontal: 8, textAlign: 'right' },
  colAmount: { flex: 1, paddingHorizontal: 8, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    paddingTop: 16,
    borderTop: '2px solid #e2e8f0',
  },
  totalText: {
    fontSize: 16,
    fontWeight: 700,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 48,
    right: 48,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 8,
  },
})

interface InvoiceData {
  number: string
  date: string
  dueDate: string
  company: { name: string; address: string }
  client: { name: string; email: string }
  items: Array<{ description: string; quantity: number; rate: number; amount: number }>
  subtotal: number
  tax: number
  total: number
}

export function InvoicePDF({ invoice }: { invoice: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image style={styles.logo} src="/logo.png" />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{invoice.company.name}</Text>
            <Text>{invoice.company.address}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.label}>Number</Text>
            <Text>{invoice.number}</Text>
            <Text style={styles.label}>Date</Text>
            <Text>{invoice.date}</Text>
            <Text style={styles.label}>Due Date</Text>
            <Text>{invoice.dueDate}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 32 }}>
          <Text style={styles.label}>Bill To</Text>
          <Text>{invoice.client.name}</Text>
          <Text>{invoice.client.email}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colDescription}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>

        {invoice.items.map((item, i) => (
          <View style={styles.tableRow} key={i}>
            <Text style={styles.colDescription}>{item.description}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colRate}>${item.rate.toFixed(2)}</Text>
            <Text style={styles.colAmount}>${item.amount.toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalText}>Total: ${invoice.total.toFixed(2)}</Text>
        </View>

        <Text style={styles.footer}>
          Payment due within 30 days. Thank you for your business.
        </Text>
      </Page>
    </Document>
  )
}
```

### Example 2: Export Hook with Loading State

```typescript
// hooks/useExportPDF.ts
import { useState, useTransition } from 'react'
import { pdf } from '@react-pdf/renderer'

interface UseExportPDFOptions {
  fileName?: string
}

export function useExportPDF(options: UseExportPDFOptions = {}) {
  const { fileName = 'document.pdf' } = options
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<Error | null>(null)

  const exportPDF = async (document: React.ReactElement) => {
    startTransition(async () => {
      try {
        setError(null)
        const blob = await pdf(document).toBlob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('PDF export failed'))
      }
    })
  }

  return { exportPDF, isPending, error }
}
```

Usage:

```tsx
function InvoiceActions({ invoice }: { invoice: InvoiceData }) {
  const { exportPDF, isPending } = useExportPDF({
    fileName: `invoice-${invoice.number}.pdf`,
  })

  return (
    <button
      onClick={() => exportPDF(<InvoicePDF invoice={invoice} />)}
      disabled={isPending}
    >
      {isPending ? 'Generating...' : 'Export PDF'}
    </button>
  )
}
```

### Example 3: Suspense for Async PDF Viewer

```tsx
import { Suspense } from 'react'
import { PDFViewer } from '@react-pdf/renderer'
import { InvoicePDF } from './InvoicePDF'

async function InvoiceViewer({ invoiceId }: { invoiceId: string }) {
  const response = await fetch(`/api/invoices/${invoiceId}`)
  const invoice: InvoiceData = await response.json()

  return (
    <PDFViewer style={{ width: '100%', height: '80vh' }}>
      <InvoicePDF invoice={invoice} />
    </PDFViewer>
  )
}

export function InvoicePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="h-[80vh] bg-gray-100 animate-pulse rounded-lg" />}>
      <InvoiceViewer invoiceId={params.id} />
    </Suspense>
  )
}
```

---

## Key Takeaways
- @react-pdf/renderer uses React components for PDF layout
- Flexbox-based layout system mirrors web development
- Custom fonts registered via Font.register before use
- Dynamic content generation from component props
- useTransition prevents UI freeze during PDF generation
- MongoDB-style streaming for large PDFs via toBuffer

## Common Misconception

"**@react-pdf/renderer can render any HTML component.**"

@react-pdf/renderer provides its own set of components (Document, Page, View, Text, Image). HTML elements like div, span, h1 are not supported. Use View+Text as div+span equivalents.

## Feynman Explain

@react-pdf/renderer lets you write PDF documents like React components. Instead of HTML, you use Document/Page/View/Text. Instead of CSS, you use StyleSheet.create. Layout is Flexbox. Everything else is standard React — props, composition, hooks.

## Reframe

PDF generation is typically imperative and error-prone. @react-pdf/renderer makes it declarative. The same mental model you use for web UIs applies to PDFs. Dynamic content, conditional rendering, and data-driven layouts work the same way.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 25-pdf-rendering`
