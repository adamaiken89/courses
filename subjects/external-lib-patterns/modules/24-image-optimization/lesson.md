# Module 24: Image Optimization — next/image & Sharp

Est. study time: 1.5h
Language: en

## Learning Objectives
- Configure next/image component for responsive images
- Use Sharp for server-side transforms (resize, format, quality)
- Generate blurDataUrl for placeholder effects
- Implement responsive srcSet for different viewports
- Apply native lazy loading with loading="lazy"
- Use React 19 Server Components for static image metadata
- Understand CDN delivery patterns
---

## Core Content

### next/image Component

Next.js Image component provides automatic optimization:

```tsx
import Image from 'next/image'

export function Hero() {
  return (
    <Image
      src="/hero-desktop.webp"
      alt="Hero banner"
      width={1920}
      height={1080}
      priority
      className="rounded-lg"
    />
  )
}
```

Key props:

- `priority` — preloads image (above-the-fold only). Adds `<link rel="preload">`
- `loading` — `lazy` (default) or `eager`. Native browser lazy loading
- `sizes` — responsive sizes hint: `(max-width: 768px) 100vw, 50vw`
- `quality` — 1-100, default 75
- `placeholder` — `blur` or `empty`. blur requires `blurDataURL`
- `fill` — fills parent container. Requires parent `position: relative` and dimensions

### Responsive Images with next/image

```tsx
function ResponsiveGallery({ images }: { images: ImageData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {images.map(img => (
        <div key={img.id} className="relative aspect-video">
          <Image
            src={img.url}
            alt={img.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover rounded-lg"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  )
}
```

### Sharp for Server-Side Transforms

Sharp is a high-performance Node.js image processing library:

```typescript
// lib/image-processing.ts
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

interface TransformOptions {
  width?: number
  height?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
  quality?: number
}

export async function transformImage(
  inputPath: string,
  outputPath: string,
  options: TransformOptions
) {
  const { width, height, format = 'webp', quality = 80 } = options

  let pipeline = sharp(inputPath)

  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: true,
    })
  }

  switch (format) {
    case 'avif':
      pipeline = pipeline.avif({ quality })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality })
      break
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality })
      break
    case 'png':
      pipeline = pipeline.png({ quality })
      break
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await pipeline.toFile(outputPath)
}
```

Batch processing:

```typescript
// scripts/optimize-images.ts
import { glob } from 'glob'
import { transformImage } from '../lib/image-processing'

async function optimizeAll() {
  const images = await glob('public/images/raw/**/*.{jpg,png}')

  const sizes = [320, 640, 768, 1024, 1920]

  for (const img of images) {
    const name = path.parse(img).name

    await Promise.all(
      sizes.map(size =>
        transformImage(img, `public/images/optimized/${name}-${size}w.webp`, {
          width: size,
          format: 'webp',
          quality: 80,
        })
      )
    )

    // Generate AVIF for modern browsers
    await transformImage(img, `public/images/optimized/${name}.avif`, {
      format: 'avif',
      quality: 70,
    })
  }
}

optimizeAll().catch(console.error)
```

### blurDataURL Generation

Blur placeholder improves perceived performance:

```typescript
// lib/blur-placeholder.ts
import sharp from 'sharp'

export async function generateBlurDataUrl(inputPath: string): Promise<string> {
  const buffer = await sharp(inputPath)
    .resize(8, 8, { fit: 'cover' })
    .webp({ quality: 20 })
    .toBuffer()

  return `data:image/webp;base64,${buffer.toString('base64')}`
}

// Usage with next/image
export async function getImageProps(src: string) {
  const blurDataURL = await generateBlurDataUrl(src)
  return { src, placeholder: 'blur' as const, blurDataURL }
}
```

### Responsive srcSet Pattern

Manual srcSet for custom Image wrapper:

```typescript
interface SrcSetConfig {
  src: string
  sizes: number[]
  format?: 'webp' | 'avif'
}

function generateSrcSet({ src, sizes, format = 'webp' }: SrcSetConfig): string {
  return sizes
    .map(size => {
      const ext = path.extname(src)
      const base = src.replace(ext, '')
      return `${base}-${size}w.${format} ${size}w`
    })
    .join(', ')
}

// srcSet output:
// "/images/photo-320w.webp 320w, /images/photo-640w.webp 640w, /images/photo-1024w.webp 1024w"
```

### Lazy Loading with Native Loading

```tsx
function LazyImage({ src, alt, className }: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('transition-opacity duration-300', className)}
    />
  )
}
```

`loading="lazy"` defers loading until image approaches viewport. `decoding="async"` reduces main thread impact.

### React 19 Server Components for Static Image Metadata

```tsx
// app/gallery/page.tsx (Server Component)
import { readFile } from 'fs/promises'
import { GalleryClient } from './GalleryClient'

interface ImageMeta {
  src: string
  width: number
  height: number
  blurDataURL: string
  alt: string
}

async function getImageMetadata(imageDir: string): Promise<ImageMeta[]> {
  const images = await glob(`${imageDir}/*.{webp,avif,jpg}`)
  const metadata: ImageMeta[] = []

  for (const img of images) {
    const { width, height } = await sharp(img).metadata()
    const blurDataURL = await generateBlurDataUrl(img)
    metadata.push({
      src: img.replace('public', ''),
      width: width!,
      height: height!,
      blurDataURL,
      alt: path.parse(img).name,
    })
  }

  return metadata
}

export default async function GalleryPage() {
  const images = await getImageMetadata('public/images/gallery')

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Gallery</h1>
      <GalleryClient images={images} />
    </div>
  )
}
```

### CDN Delivery Patterns

Configure remote patterns in next.config:

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        port: '',
        pathname: '/images/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}

export default nextConfig
```

CDN URLs still go through next/image optimization:

```tsx
<Image
  src="https://cdn.example.com/images/photo.jpg"
  alt="CDN image"
  width={800}
  height={600}
  priority
/>
```

---

### Why This Matters

Images account for ~50% of web page weight. Poor image optimization is the single biggest performance bottleneck. next/image + Sharp combination gives automatic optimization, responsive sizing, and modern formats without manual effort.

---

### Common Questions

**Q: Should I use next/image or a custom img tag?**

A: Use next/image for most cases — automatic optimization, lazy loading, responsive srcSet, and blur placeholders. Use custom img tag only for fully static content or when next/image's optimization overhead isn't needed.

**Q: What's the difference between WebP and AVIF?**

A: AVIF offers ~20% smaller file sizes at same quality but lower browser support (~92% vs ~97% for WebP). next/image serves AVIF with WebP fallback via the `<picture>` element.

---

## Examples

### Example 1: Custom Image Wrapper with BlurHash

```tsx
'use client'
import Image from 'next/image'
import { useState } from 'react'
import { cn } from '../lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  blurDataURL: string
  width: number
  height: number
  className?: string
  priority?: boolean
}

export function OptimizedImage({
  src,
  alt,
  blurDataURL,
  width,
  height,
  className,
  priority = false,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        placeholder="blur"
        blurDataURL={blurDataURL}
        priority={priority}
        className={cn(
          'transition-opacity duration-500',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  )
}
```

### Example 2: Sharp Pipeline for Batch Processing

```typescript
// scripts/build-images.ts
import sharp from 'sharp'
import { glob } from 'glob'
import { basename, dirname, join, parse } from 'path'
import { mkdir, readFile } from 'fs/promises'

const CONFIG = {
  sizes: [320, 640, 1024, 1920],
  formats: [
    { name: 'webp' as const, quality: 80 },
    { name: 'avif' as const, quality: 65 },
  ],
  inputDir: 'public/images/raw',
  outputDir: 'public/images/optimized',
}

async function processImage(inputPath: string) {
  const { name } = parse(inputPath)
  const image = sharp(await readFile(inputPath))
  const metadata = await image.metadata()

  const tasks = CONFIG.formats.flatMap(({ name: format, quality }) =>
    CONFIG.sizes.map(async (width) => {
      const outDir = join(CONFIG.outputDir, `${width}w`)
      await mkdir(outDir, { recursive: true })

      await sharp(inputPath)
        .resize(width, undefined, { withoutEnlargement: true })
        [format]({ quality })
        .toFile(join(outDir, `${name}.${format}`))
    })
  )

  return Promise.all(tasks)
}

async function main() {
  const files = await glob(`${CONFIG.inputDir}/**/*.{jpg,jpeg,png}`)
  await Promise.all(files.map(processImage))
  console.log(`Processed ${files.length} images`)
}

main().catch(console.error)
```

### Example 3: BlurHash Generation Server Action

```typescript
'use server'
import sharp from 'sharp'

export async function generateBlurHash(formData: FormData) {
  const file = formData.get('image') as File
  const buffer = Buffer.from(await file.arrayBuffer())

  const { width, height } = await sharp(buffer).metadata()

  const blurBuffer = await sharp(buffer)
    .resize(16, 16, { fit: 'cover' })
    .webp({ quality: 30 })
    .toBuffer()

  return {
    width,
    height,
    blurDataURL: `data:image/webp;base64,${blurBuffer.toString('base64')}`,
  }
}
```

---

## Key Takeaways
- next/image provides automatic optimization, lazy loading, and responsive srcSet
- Sharp handles server-side transforms (resize, format conversion, quality)
- blurDataURL improves perceived performance with instant placeholders
- React 19 Server Components extract image metadata at request time
- CDN + next/image combine for optimal delivery

## Common Misconception

"**next/image always makes images faster.**"

next/image adds overhead for the optimization server (especially in development). For fully static content, pre-optimize with Sharp at build time and serve directly. Use next/image when you need dynamic optimization or don't control the source images.

## Feynman Explain

Images are the heaviest resources on most pages. next/image shrinks them automatically — resize to screen size, convert to modern formats, lazy-load below the fold, show blurry preview while loading. Sharp does the heavy lifting on the server. Together they make images fast without manual optimization per image.

## Reframe

Image optimization isn't about reducing quality — it's about delivering the right pixels at the right time. No one needs a 4000px image on a 375px phone screen. next/image + Sharp automate the decision of what, when, and how to deliver.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 24-image-optimization`
