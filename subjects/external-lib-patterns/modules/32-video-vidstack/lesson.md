# Module 32: Video — Vidstack

Est. study time: 1.5h
Language: en

## Learning Objectives
- Architect video player wrapper using Vidstack provider abstraction
- Configure HLS streaming with hls.js integration
- Build custom UI slots for branded player skin
- Manage quality tracks and subtitle selection
- Integrate React 19 concurrent mode with media event handlers

---

## Core Content

### Vidstack Architecture

Vidstack is headless media framework with provider abstraction layer:

- `MediaProvider` — abstract interface for media sources. Concrete providers: `Html5VideoProvider`, `HlsProvider`, `YouTubeProvider`, `VimeoProvider`.
- `MediaPlayer` — orchestrator component managing playback state, UI interactions, track management.
- `MediaOutlet` — rendering surface (HTMLVideoElement, iframe, etc).

```typescript
import { MediaPlayer, MediaOutlet } from '@vidstack/react'

function Player() {
  return (
    <MediaPlayer src="https://example.com/video.mp4">
      <MediaOutlet />
    </MediaPlayer>
  )
}
```

Provider auto-detection based on `src`:

| Provider | Source Type | Use Case |
|----------|-----------|----------|
| Html5Video | .mp4, .webm, .mov | Direct file playback |
| HlsProvider | .m3u8 | Live/adaptive streaming |
| YouTubeProvider | YouTube URL | Embed YouTube |
| VimeoProvider | Vimeo URL | Embed Vimeo |

### Provider Abstraction Pattern

Vidstack normalizes provider APIs behind common interface:

```typescript
interface MediaProviderAdapter {
  type: string
  play(): Promise<void>
  pause(): void
  get currentTime(): number
  set currentTime(time: number)
  get paused(): boolean
  get duration(): number
  get volume(): number
  set volume(vol: number)
  on: (event: string, handler: Function) => void
}
```

Swap provider by changing `src` — all player UI, controls, and tracks work unchanged:

```typescript
function AdaptivePlayer({ quality }: { quality: 'hd' | 'sd' | 'hls' }) {
  const src = quality === 'hls'
    ? 'https://stream.example.com/live.m3u8'
    : quality === 'hd'
    ? 'https://cdn.example.com/movie-hd.mp4'
    : 'https://cdn.example.com/movie-sd.mp4'

  return (
    <MediaPlayer src={src}>
      <MediaOutlet />
    </MediaPlayer>
  )
}
```

### HLS Streaming with hls.js

Vidstack integrates hls.js for HLS playback. Install `@vidstack/hls` and register provider:

```typescript
import { HlsProvider } from '@vidstack/hls'
import { defineCustomElement } from '@vidstack/react'

defineCustomElement(HlsProvider)

function LivePlayer() {
  return (
    <MediaPlayer src="https://live.example.com/stream.m3u8">
      <MediaOutlet />
      {/* HLS quality selector */}
      <MediaQualitySlider />
    </MediaPlayer>
  )
}
```

HLS configuration via `hlsConfig` prop:

```typescript
<MediaPlayer
  src="stream.m3u8"
  hlsConfig={{
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    startLevel: 2, // start at specific quality level
    abrEwmaDefaultEstimate: 500000, // 500kbps estimate
    enableWorker: true,
  }}
>
  <MediaOutlet />
</MediaPlayer>
```

### UI Components

Vidstack ships accessible UI components:

```typescript
import {
  MediaPlayer, MediaOutlet,
  MediaControls, MediaPlayButton,
  MediaSeekButton, MediaVolumeSlider,
  MediaTime, MediaSlider,
  MediaFullscreenButton, MediaCaptions,
} from '@vidstack/react'

function PlayerWithControls() {
  return (
    <MediaPlayer src="video.mp4">
      <MediaOutlet>
        <MediaCaptions />
      </MediaOutlet>
      <MediaControls>
        <MediaPlayButton />
        <MediaSeekButton seconds={-10} />
        <MediaSlider>
          <MediaTime type="current" />
          <MediaSlider.Value />
          <MediaTime type="total" />
        </MediaSlider>
        <MediaVolumeSlider />
        <MediaFullscreenButton />
      </MediaControls>
    </MediaPlayer>
  )
}
```

### Custom UI Slots

Override default slots for branded player skin:

```typescript
function CustomControls() {
  return (
    <MediaPlayer src="video.mp4">
      <MediaOutlet />
      {/* Custom slot replaces default controls */}
      <MediaControls className="custom-controls">
        <MediaPlayButton>
          <PlayIcon slot="play" />
          <PauseIcon slot="pause" />
        </MediaPlayButton>
        <MediaTime type="current" className="time-display" />
        <MediaSlider className="custom-slider" />
      </MediaControls>
    </MediaPlayer>
  )
}
```

Slot system uses named `slot` attributes on children:

| Slot | Component |
|------|-----------|
| `play` | Icon shown when paused |
| `pause` | Icon shown when playing |
| `on` | Icon for enabled toggle |
| `off` | Icon for disabled toggle |

### Tracks: Subtitles, Chapters, Quality

Vidstack supports multiple track types:

```typescript
<MediaPlayer src="video.mp4">
  <MediaOutlet />

  {/* Subtitle tracks */}
  <track
    kind="subtitles"
    src="/subs/en.vtt"
    srcLang="en"
    label="English"
    default
  />
  <track
    kind="subtitles"
    src="/subs/es.vtt"
    srcLang="es"
    label="Spanish"
  />

  {/* Chapter markers */}
  <track
    kind="chapters"
    src="/chapters/en.vtt"
    srcLang="en"
    label="Chapters"
  />

  {/* Quality selector rendered by UI */}
  <MediaQualitySlider />
</MediaPlayer>
```

### Responsive Video

Vidstack supports aspect ratio and art direction:

```typescript
// Preserve aspect ratio
<MediaPlayer
  src="video.mp4"
  aspectRatio={16 / 9}
  style={{ maxWidth: 960 }}
>

// Art direction via src set
<MediaPlayer
  src={[
    { src: 'video-mobile.mp4', media: '(max-width: 768px)' },
    { src: 'video-desktop.mp4', media: '(min-width: 769px)' },
  ]}
>
```

### Think: Media Event Performance

Video events fire at high frequency (timeupdate at ~4-60Hz, playbackratechange, volumechange). Each event triggers React re-render if handler calls setState. React 19 concurrent mode marks video UI updates as non-urgent to prevent dropped frames:

```typescript
import { useTransition, useCallback } from 'react'

function VideoProgressTracker() {
  const [isPending, startTransition] = useTransition()
  const [progress, setProgress] = useState(0)

  const onTimeUpdate = useCallback((event: MediaProgressEvent) => {
    startTransition(() => {
      setProgress(event.detail.currentTime)
    })
  }, [])

  return (
    <MediaPlayer onTimeUpdate={onTimeUpdate}>
      <MediaOutlet />
      <ProgressBar value={progress} aria-busy={isPending} />
    </MediaPlayer>
  )
}
```

---

### Why This Matters

Video is the heaviest media type in web apps — bandwidth, decoding, rendering all stress the browser. Choosing raw HTMLVideoElement couples UI to one provider. Vidstack abstracts provider differences (HLS vs YouTube vs direct MP4) behind one declarative API. Result: swap CDN, add live streaming, or embed third-party video without rebuilding player UI.

Branded player skin separates design from media logic. Custom slot system keeps accessible defaults while allowing full visual control.

---

### Common Questions

**Q: Can I use Vidstack without web components?**
A: Yes. `@vidstack/react` exports React components wrapping the web component core. No shadow DOM conflicts.

**Q: How to handle DRM-protected streams?**
A: Vidstack supports Encrypted Media Extensions via provider config. Attach `mediaKeySystemAccess` to HlsProvider or Html5VideoProvider.

**Q: Does HLS work in Safari natively?**
A: Safari has native HLS support. Vidstack detects and uses native HLS over hls.js when available, falling back to hls.js in other browsers.

---

## Examples

### Example 1: Custom Player Skin with Vidstack Slots

```typescript
'use client'

import {
  MediaPlayer, MediaOutlet, MediaControls,
  MediaPlayButton, MediaSeekButton,
  MediaVolumeSlider, MediaTime, MediaSlider,
  MediaFullscreenButton, MediaCaptions,
} from '@vidstack/react'

type Props = {
  src: string
  poster?: string
  aspectRatio?: number
}

export function CustomPlayer({ src, poster, aspectRatio = 16 / 9 }: Props) {
  return (
    <MediaPlayer
      src={src}
      poster={poster}
      aspectRatio={aspectRatio}
      className="media-player"
    >
      <MediaOutlet>
        <MediaCaptions className="custom-captions" />
      </MediaOutlet>

      <MediaControls className="media-controls">
        <div className="controls-left">
          <MediaPlayButton>
            <svg slot="play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            <svg slot="pause" viewBox="0 0 24 24"><path d="M6 4h4v16H6z M14 4h4v16h-4z" /></svg>
          </MediaPlayButton>

          <MediaSeekButton seconds={-10}>
            <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" /></svg>
          </MediaSeekButton>
        </div>

        <MediaSlider className="progress-slider">
          <MediaTime type="current" className="time" />
          <MediaSlider.Value />
          <MediaTime type="total" className="time" />
        </MediaSlider>

        <div className="controls-right">
          <MediaVolumeSlider className="volume-slider" />
          <MediaFullscreenButton>
            <svg slot="on" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3z M5 10h2V7h3V5H5v5z M17 17h-3v2h5v-5h-2v3z M14 5v2h3v3h2V5h-5z" /></svg>
            <svg slot="off" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2z M8 8H5v2h5V5H8v3z M19 8h-3V5h-2v5h5V8z M16 16h3v-2h-5v5h2v-3z" /></svg>
          </MediaFullscreenButton>
        </div>
      </MediaControls>
    </MediaPlayer>
  )
}
```

### Example 2: HLS Provider with Quality Selector

```typescript
'use client'

import { useState } from 'react'
import { MediaPlayer, MediaOutlet } from '@vidstack/react'
import { HlsProvider } from '@vidstack/hls'

type Quality = 'auto' | '1080p' | '720p' | '480p'

const QUALITY_LEVELS: Record<Quality, number | undefined> = {
  auto: undefined,
  '1080p': 5,
  '720p': 3,
  '480p': 1,
}

export function HlsPlayer() {
  const [quality, setQuality] = useState<Quality>('auto')
  const [hlsLevels, setHlsLevels] = useState<{ height: number; bitrate: number }[]>([])

  function onHlsInstance(hls: Hls) {
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setHlsLevels(
        hls.levels.map((level) => ({
          height: level.height,
          bitrate: level.bitrate,
        }))
      )
    })
  }

  return (
    <div>
      <MediaPlayer
        src="https://stream.example.com/live.m3u8"
        hlsConfig={{
          startLevel: QUALITY_LEVELS[quality],
        }}
        onHlsInstance={onHlsInstance}
      >
        <MediaOutlet />
      </MediaPlayer>

      <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
        <option value="auto">Auto</option>
        {hlsLevels.map((level, i) => (
          <option key={i} value={`${level.height}p`}>
            {level.height}p ({Math.round(level.bitrate / 1000)}kbps)
          </option>
        ))}
      </select>
    </div>
  )
}
```

### Example 3: React Compiler Optimization for Media Events

React Compiler automatically memoizes event handlers. Vidstack `onTimeUpdate` fires at high frequency — Compiler prevents unnecessary re-renders:

```typescript
'use client'

// With React Compiler enabled, this component auto-memoizes
function VideoPlayer() {
  const [currentTime, setCurrentTime] = useState(0)

  return (
    <MediaPlayer
      src="video.mp4"
      onTimeUpdate={(event) => {
        // Compiler infers this setState is fine-grained enough
        setCurrentTime(event.detail.currentTime)
      }}
    >
      <MediaOutlet />
      <div>Progress: {Math.round(currentTime)}s</div>
    </MediaPlayer>
  )
}
```

---

## Key Takeaways
- Vidstack provider abstraction normalizes Html5Video, HLS, YouTube, Vimeo behind common interface
- HLS streaming via hls.js integration with configurable ABR, buffer, quality levels
- Slot system for custom UI overrides without losing accessibility
- Tracks: subtitles (VTT), chapters, quality levels
- React 19 concurrent mode via useTransition for high-frequency media events
- React Compiler auto-memoizes media event handlers
- Responsive video via aspectRatio prop and media-conditional src arrays

## Common Misconception

"**Custom player skin means rebuilding accessible controls from scratch.**"

Vidstack slot system preserves ARIA roles, keyboard navigation, and focus management. Custom skins override visuals only — accessibility tree comes from Vidstack core. Replace icons and styles, never touch behavior.

---

## Feynman Explain
(Explain Vidstack to someone who knows HTMLVideoElement. Vidstack = adapter layer that makes MP4, HLS live stream, YouTube embed, and Vimeo all look same to your player code. Slots = labeled holes in default UI where you drop your own icons. Tracks = extra data streams riding alongside video.)

---

## Reframe
(Does every video need HLS and custom skin? Marketing hero video on landing page could use simple HTMLVideoElement. Vidstack adds bundle weight. Reach for Vidstack when: multiple providers, live streaming, subtitle/quality controls, or branded player is requirement. Start with `<video>` tag for single MP4.)

---

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 32-video-vidstack`
