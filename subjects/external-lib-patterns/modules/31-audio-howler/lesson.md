# Module 31: Audio — Howler.js

Est. study time: 1.5h
Language: en

## Learning Objectives
- Architect audio playback wrapper around Howler.js
- Implement audio sprite sheets for memory-efficient sound clips
- Control playback lifecycle with Howl instance methods
- Integrate spatial audio via Howler.pos()
- Build React 19 useHowler hook with imperative ref API

---

## Core Content

### Howler.js Architecture

Howler.js provides two core objects:

- `Howl` — individual audio instance (file or sprite sheet). Each Howl manages playback state, volume, rate, and position.
- `Howler` — global singleton. Controls global mute, volume, orientation (spatial audio), and codec detection.

```typescript
import { Howl, Howler } from 'howler'

const sfx = new Howl({
  src: ['sfx.mp3', 'sfx.ogg'],
  volume: 0.8,
  rate: 1,
  onload: () => console.log('loaded'),
  onplayerror: (id, err) => console.error('play error', id, err),
})

sfx.play() // returns sound ID for control
sfx.pause(sfxId)
sfx.stop(sfxId)
sfx.seek(5, sfxId) // seek to 5s
sfx.volume(0.5, sfxId)
```

Howler global for cross-instance control:

```typescript
Howler.mute(true)
Howler.volume(0.3)
Howler.pos(0, 0, -1) // set listener position for spatial audio
```

### Audio Sprites

Single audio file split into named clips. Dramatically reduces HTTP requests and memory (one decode vs many).

```typescript
const spriteSheet = new Howl({
  src: ['sprites.webm', 'sprites.mp3'],
  sprite: {
    click: [0, 300],          // offset 0ms, duration 300ms
    confirm: [300, 500],      // offset 300ms, duration 500ms
    cancel: [800, 400],
    notification: [1200, 2000],
  },
})

spriteSheet.play('click')
spriteSheet.play('confirm')
```

Sprite definition format: `[offsetMs, durationMs]`. All clips share same volume/rate context until overridden.

Playback returns numeric `soundId` per call — needed to control individual overlapping plays:

```typescript
const id1 = spriteSheet.play('notification')
setTimeout(() => spriteSheet.fade(1, 0, 500, id1), 3000)
```

### Playback Controls

| Method | Description | Parameters |
|--------|-------------|------------|
| `play(spriteOrId)` | Start/resume | sprite name or sound ID |
| `pause(id)` | Pause specific sound | sound ID |
| `stop(id)` | Stop specific sound | sound ID |
| `mute(muted, id)` | Mute specific sound | boolean, optional ID |
| `volume(vol, id)` | Set volume 0-1 | number, optional ID |
| `rate(rate, id)` | Set playback rate | 0.5-4, optional ID |
| `seek(pos, id)` | Seek to position | seconds, optional ID |
| `state()` | Get ready state | 'unloaded'|'loading'|'loaded' |
| `playing(id)` | Is sound playing | boolean |
| `duration(id)` | Duration in seconds | number |
| `fade(from, to, duration, id)` | Smooth volume transition | numbers |

### Event System

Howl emits lifecycle events. Register via constructor options or `on()`:

```typescript
const sound = new Howl({
  src: ['music.mp3'],
  onload: () => { /* ready */ },
  onloaderror: (id, code) => { /* codec/network error */ },
  onplay: (id) => { /* playback started */ },
  onpause: (id) => { /* paused */ },
  onstop: (id) => { /* stopped */ },
  onend: (id) => { /* natural end */ },
  onseek: (id) => { /* seek completed */ },
  onmute: (id) => { /* muted state changed */ },
  onvolume: (id) => { /* volume changed */ },
  onrate: (id) => { /* rate changed */ },
})

// Dynamic registration
sound.on('play', (id) => updateUI(id))
sound.once('load', () => setLoaded(true))
sound.off('play')
```

Event handlers receive `soundId`. Critical for multi-instance scenarios where one event fires per sound.

### Cross-Browser Codec Support

Howler detects browser support and picks first playable format from `src` array. Best practice — provide at least:

| Codec | Browser Support | Quality |
|-------|----------------|---------|
| MP3 | All | Good |
| OGG | Firefox, Chrome, Edge | Good |
| WebM | Chrome, Firefox | Best/compression |
| AAC | Safari, iOS | Good |
| WAV | All | Uncompressed (large) |

```typescript
new Howl({
  src: [
    'audio.webm', // prefer smallest
    'audio.ogg',
    'audio.mp3',  // safest fallback
  ],
})
```

### Spatial Audio

Howler supports Web Audio API spatialization via global listener:

```typescript
// Position of listener
Howler.pos(x, y, z) // default: (0, 0, 0)

// Orientation
Howler.orientation(frontX, frontY, frontZ, upX, upY, upZ)
```

Per-sound spatial attributes:

```typescript
const gunshot = new Howl({
  src: ['shot.mp3'],
  autoplay: false,
  sprite: { shot: [0, 800] },
  orientation: [1, 0, 0],
  pos: [10, 0, 5], // 3D position
})

// Update position during playback
gunshot.pos([20, 0, 5], soundId)
```

`pos()` on Howl sets 3D position relative to listener `Howler.pos()`. Distance model configurable via `Howler.distanceModel('inverse' | 'linear' | 'exponential')`.

### Think: Sound Pool Pattern

Games and UI toolkits often fire same sound overlapping (multiple clicks). Each `play()` creates new sound instance. Manage pool to avoid allocation overhead:

```typescript
class SoundPool {
  private pool: Howl[] = []
  private current = 0

  constructor(src: string[], poolSize = 4) {
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(
        new Howl({ src, pool: i, volume: 0.5 })
      )
    }
  }

  play(sprite?: string) {
    this.pool[this.current].play(sprite)
    this.current = (this.current + 1) % this.pool.length
  }
}
```

---

### Why This Matters

Audio in web apps ranges from notification pings to full game soundtracks. Without structured wrapper, audio code fragments across components — one component sets volume globally, another forgets to stop loops on unmount, memory leaks from orphan Howl instances. Howler.js provides solid foundation; wrapper pattern makes it safe, testable, swappable.

Wrapper isolates browser audio quirks (autoplay policies, codec fallback, suspend/resume) behind clean interface. Your app logic never touches Web Audio API directly.

---

### Common Questions

**Q: How to handle autoplay restrictions?**
A: Browsers block `play()` without user gesture. Check `Howler.ctx.state === 'suspended'`. Resume context on first user interaction via `Howler.ctx.resume()`. Pattern: add one-time click listener at app root.

**Q: Can I change sprite definition after Howl creation?**
A: No. Sprite offsets baked into audio buffer at load time. Delete Howl instance and create new one with updated sprite map.

**Q: Why does seek not work with sprites?**
A: Seek position is relative to full audio file, not sprite start. Use `sprite[offset]` on sprite end behavior instead.

---

## Examples

### Example 1: useHowler Hook

React 19 ref-as-prop pattern for imperative audio control:

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Howl } from 'howler'

interface UseHowlerOptions {
  src: string[]
  sprite?: Record<string, [number, number]>
  volume?: number
  onLoad?: () => void
  onEnd?: (sprite: string) => void
}

interface HowlerHandle {
  play: (sprite?: string) => number | undefined
  pause: (id?: number) => void
  stop: (id?: number) => void
  seek: (seconds: number, id?: number) => void
  isPlaying: (id?: number) => boolean
  setVolume: (vol: number, id?: number) => void
}

function useHowler(options: UseHowlerOptions, ref?: React.RefObject<HowlerHandle | null>): HowlerHandle {
  const howlRef = useRef<Howl | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let isCancelled = false
    const { Howl } = require('howler')
    const howl = new Howl({
      src: options.src,
      sprite: options.sprite,
      volume: options.volume ?? 1,
      onload: () => {
        if (!isCancelled) {
          setLoaded(true)
          options.onLoad?.()
        }
      },
      onend: (id) => {
        const spriteName = Object.entries(options.sprite ?? {}).find(
          ([, [offset]]) => howl.seek(id) === offset
        )?.[0]
        options.onEnd?.(spriteName ?? '')
      },
    })
    howlRef.current = howl
    return () => {
      isCancelled = true
      howl.unload()
    }
  }, [options.src.join(','), JSON.stringify(options.sprite)])

  const handle: HowlerHandle = {
    play: useCallback((sprite) => howlRef.current?.play(sprite), []),
    pause: useCallback((id) => howlRef.current?.pause(id), []),
    stop: useCallback((id) => howlRef.current?.stop(id), []),
    seek: useCallback((seconds, id) => howlRef.current?.seek(seconds, id), []),
    isPlaying: useCallback((id) => howlRef.current?.playing(id) ?? false, []),
    setVolume: useCallback((vol, id) => howlRef.current?.volume(vol, id), []),
  }

  useEffect(() => {
    if (ref && howlRef.current) {
      ref.current = handle
    }
  }, [ref, loaded])

  return handle
}
```

### Example 2: Audio Player with Sprite Sheet

React 19 component using `useTransition` for playlist transitions:

```typescript
'use client'

import { useTransition } from 'react'
import { useHowler } from './useHowler'

const SPRITES = {
  intro: [0, 3000],
  verse: [3000, 8000],
  chorus: [11000, 6000],
  bridge: [17000, 4000],
  outro: [21000, 3000],
}

export function AudioPlayer() {
  const [isPending, startTransition] = useTransition()
  const audio = useHowler({
    src: ['song.webm', 'song.mp3'],
    sprite: SPRITES,
    volume: 0.7,
  })

  function handlePlaySection(section: string) {
    startTransition(() => {
      audio.play(section)
    })
  }

  return (
    <div>
      {Object.keys(SPRITES).map((section) => (
        <button
          key={section}
          onClick={() => handlePlaySection(section)}
          disabled={isPending}
        >
          {section}
        </button>
      ))}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        onChange={(e) => audio.setVolume(Number(e.target.value))}
      />
    </div>
  )
}
```

### Example 3: Audio Visualizer with Canvas

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { Howl } from 'howler'

type Props = {
  src: string[]
}

export function AudioVisualizer({ src }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)

  useEffect(() => {
    const howl = new Howl({ src })
    const audioCtx = (Howler as any).ctx as AudioContext
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256

    // Connect Howler internal gain node to analyser
    const gainNode = (howl as any)._sounds[0]?._node
      ?.bufferNode?.source?.context?.destination
    if (gainNode) {
      // Simplified — real impl connects through Howler's audio graph
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function draw() {
      analyser.getByteFrequencyData(dataArray)
      ctx.fillStyle = 'rgb(20, 20, 30)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] * 0.5
        ctx.fillStyle = `rgb(${barHeight + 100}, 50, 200)`
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }
      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [src])

  return <canvas ref={canvasRef} width={400} height={200} />
}
```

---

## Key Takeaways
- Howl = individual audio instance; Howler = global singleton for mute/volume/spatial
- Audio sprites: single file, named offset-duration pairs, reduce HTTP requests
- Provide mp3 + ogg + webm for cross-browser coverage
- React 19 ref-as-prop pattern exposes imperative play/pause/seek to parent
- `useTransition` prevents playlist jank during section switching
- Always unload Howl on unmount to prevent memory leaks
- Web Audio API spatialization via Howler.pos() and Howl.pos()

## Common Misconception

"**Audio autoplay can be forced by setting attributes.**"

Modern browsers require user gesture for AudioContext creation. `autoplay` attribute and `howl.play()` in useEffect both fail before first click. Wrap app in one-time gesture handler that calls `Howler.ctx.resume()`. Feature: use `Howler.usingWebAudio` to check if Web Audio is available.

---

## Feynman Explain
(Explain Howler.js architecture to someone who only knows `<audio>` tag. Howl = audio file with controls. Howler = radio manager. Sprites = one CD with multiple tracks. Spatial audio = sound seems to come from left/right based on listener position.)

---

## Reframe
(How much audio abstraction is right? Notification pings probably don't need spatial audio. Full game soundtrack needs sprite pooling and volume ducking. Start with thin useHowler wrapper. Add pooling, spatial, visualizer only when profiling proves they are needed. YAGNI applies to audio too.)

---

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 31-audio-howler`
