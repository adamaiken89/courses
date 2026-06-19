# Module 35: Color Picker — react-colorful

Est. study time: 1h
Language: en

## Learning Objectives
- Integrate react-colorful as lightweight color picker (3KB, zero deps)
- Handle color models: hex, HSL, HSV, RGB
- Style picker via CSS custom properties (--r, --g, --b, --h, --s, --l)
- Build controlled and uncontrolled color picker wrappers
- Implement keyboard-accessible color selection
- Use React 19 Server Components with Client boundary for picker
- Apply React Compiler optimization for onChange handlers

---

## Core Content

### react-colorful Architecture

react-colorful is tiny color picker (3KB gzipped, zero dependencies). Ships as uncontrolled component:

```typescript
import { HexColorPicker } from 'react-colorful'

function Picker() {
  const [color, setColor] = useState('#aabbcc')
  return <HexColorPicker color={color} onChange={setColor} />
}
```

Available picker variants by color model:

| Component | Model | Output |
|-----------|-------|--------|
| `HexColorPicker` | Hex | `#rrggbb` |
| `HexAlphaColorPicker` | Hex + Alpha | `#rrggbbaa` |
| `HslColorPicker` | HSL | `{ h, s, l }` |
| `HslStringColorPicker` | HSL | `hsl(h, s%, l%)` |
| `HsvColorPicker` | HSV | `{ h, s, v }` |
| `HsvStringColorPicker` | HSV | `hsv(h, s%, v%)` |
| `RgbColorPicker` | RGB | `{ r, g, b }` |
| `RgbStringColorPicker` | RGB | `rgb(r, g, b)` |
| `RgbaStringColorPicker` | RGB + Alpha | `rgba(r, g, b, a)` |

### Controlled vs Uncontrolled

Uncontrolled (recommended for simple cases):

```typescript
<HexColorPicker color="#3366ff" onChange={setColor} />
```

Controlled via `color` prop:

```typescript
<HexColorPicker
  color={storedColor ?? '#000000'}
  onChange={(hex) => {
    setStoredColor(hex)
    localStorage.setItem('theme', hex)
  }}
/>
```

### Custom Styling with CSS Variables

react-colorful exposes CSS custom properties for theming:

```typescript
// CSS
.custom-picker {
  --r: 51;
  --g: 102;
  --b: 255;
  --h: 220;
  --s: 100;
  --l: 60;
  width: 200px !important;
  height: 200px !important;
}

.custom-picker .react-colorful__saturation {
  border-radius: 8px 8px 0 0;
}

.custom-picker .react-colorful__hue {
  border-radius: 0 0 8px 8px;
}
```

```typescript
<HexColorPicker className="custom-picker" color={color} onChange={setColor} />
```

Available CSS variables:

| Variable | Type | Description |
|----------|------|-------------|
| `--r`, `--g`, `--b` | 0-255 | Current RGB values |
| `--h` | 0-360 | Current hue |
| `--s`, `--l` | 0-100 | Current saturation/lightness |
| `--a` | 0-1 | Current alpha |

Custom sizing:

```typescript
<HexColorPicker style={{ width: 300, height: 300 }} />
```

### Accessibility

react-colorful supports keyboard interaction:

- Arrow keys adjust hue/saturation
- Tab between saturation and hue sliders
- ARIA labels on interactive elements

Wrap with labeled container:

```typescript
<label>
  Background Color
  <HexColorPicker
    color={bgColor}
    onChange={setBgColor}
    aria-label="Background color picker"
  />
</label>
```

### Color Format Conversion

react-colorful does not include conversion utilities — use small helpers:

```typescript
// Hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

// RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}

// Hex to HSL (standard conversion)
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex)
  const r1 = r / 255, g1 = g / 255, b1 = b / 255
  const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1)
  let h = 0, s = 0, l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r1: h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6; break
      case g1: h = ((b1 - r1) / d + 2) / 6; break
      case b1: h = ((r1 - g1) / d + 4) / 6; break
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

// Contrast ratio for accessibility
function getContrastRatio(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? 1 : 21 // simplified
}
```

### Think: React Compiler with onChange Handlers

Color picker fires `onChange` on every hue/saturation movement (many times per second during drag). React Compiler auto-memoizes callbacks:

```typescript
function ColorPickerWithCompiler() {
  const [color, setColor] = useState('#663399')

  // Compiler auto-memoizes — no useCallback needed
  return (
    <HexColorPicker
      color={color}
      onChange={setColor}
    />
  )
}
```

Without Compiler, wrap `setColor` in `useCallback` or use `useMemo` for color values derived from state.

---

### Why This Matters

Color pickers appear in design tools, theme editors, settings panels, and product customization UIs. react-colorful offers best trade-off: tiny bundle (3KB), accessible, themeable via CSS variables, supports all major color models. No dependencies means no version conflicts.

Wrapper pattern standardizes: which color model app uses, output format (hex vs RGB object), preset colors, and accessibility labels. Single component change if picker needs replacement later.

---

### Common Questions

**Q: Can I use react-colorful in a Server Component?**
A: No — picker requires browser APIs (pointer events, DOM measurements). Use Client boundary (`'use client'`) at wrapper component. Server Component can read initial color from database.

**Q: How to get real-time RGB values while user drags?**
A: Use `RgbColorPicker` instead of hex variant, or convert hex to RGB via `hexToRgb` utility inside `onChange`.

**Q: Does it support color alpha/opacity?**
A: Yes — `HexAlphaColorPicker` and `RgbaStringColorPicker` include alpha channel. Set initial color with alpha: `#3366ff80`.

---

## Examples

### Example 1: Color Picker Wrapper with Hex/RGB Output

```typescript
'use client'

import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'

type ColorFormat = 'hex' | 'rgb'

type Props = {
  initialColor?: string
  format?: ColorFormat
  onChange?: (color: string) => void
}

export function ColorPicker({
  initialColor = '#3366ff',
  format = 'hex',
  onChange,
}: Props) {
  const [color, setColor] = useState(initialColor)

  function handleChange(hex: string) {
    setColor(hex)
    const output = format === 'rgb'
      ? hexToRgb(hex)
      : hex
    onChange?.(output)
  }

  const rgb = hexToRgb(color)

  return (
    <div>
      <HexColorPicker color={color} onChange={handleChange} />
      <div className="color-info">
        <div className="color-swatch" style={{ backgroundColor: color }} />
        <div>Hex: {color}</div>
        <div>RGB: {rgb.r}, {rgb.g}, {rgb.b}</div>
      </div>
    </div>
  )
}
```

### Example 2: Theme Color Picker with Presets

```typescript
'use client'

import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'

const PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
]

type Props = {
  value: string
  onChange: (color: string) => void
}

export function ThemeColorPicker({ value, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<'picker' | 'presets'>('presets')

  return (
    <div>
      <div className="tab-bar">
        <button
          onClick={() => setActiveTab('presets')}
          aria-pressed={activeTab === 'presets'}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab('picker')}
          aria-pressed={activeTab === 'picker'}
        >
          Custom
        </button>
      </div>

      {activeTab === 'presets' ? (
        <div className="preset-grid">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              className="preset-swatch"
              style={{ backgroundColor: preset }}
              onClick={() => onChange(preset)}
              aria-label={preset}
              aria-pressed={value === preset}
            />
          ))}
        </div>
      ) : (
        <HexColorPicker color={value} onChange={onChange} />
      )}
    </div>
  )
}
```

### Example 3: Color Format Conversion Utilities

```typescript
// Color utility module — no dependencies

export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const r1 = r / 255, g1 = g / 255, b1 = b / 255
  const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r1: h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) * 60; break
      case g1: h = ((b1 - r1) / d + 2) * 60; break
      case b1: h = ((r1 - g1) / d + 4) * 60; break
    }
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex))
}
```

---

## Key Takeaways
- react-colorful: 3KB, zero deps, multiple color model pickers
- CSS custom properties (--r, --g, --b, --h, --s, --l) for seamless theming
- Controlled via `color` + `onChange`; uncontrolled with `defaultColor`
- Picker is Client-only — wrap with `'use client'`, Server Components read initial value
- React Compiler auto-memoizes onChange handlers for drag performance
- Convert between color models with small utility functions (no lib needed)
- Keyboard accessible: arrow keys, Tab, ARIA labels
- Preset grid for common colors plus custom picker for fine control

## Common Misconception

"**Color picker library must be large to support all color models.**"

react-colorful proves lightweight picker can support Hex, HSL, HSV, RGB, and alpha variants all in 3KB gzipped. The library avoids runtime conversion dependencies — pickers directly output the model you choose. Each variant is separate import, so tree-shaking removes unused ones.

---

## Feynman Explain
(Explain color picker to someone who uses paint palette. react-colorful = palette with hue strip on bottom and saturation/brightness square on top. CSS variables = palette follows your theme colors automatically. Presets = pre-mixed paint blobs. Hex code = exact recipe for color. RGB = how much red, green, blue light.)

---

## Reframe
(Color pickers are deceptively complex — HSV/HSL conversion, accessibility, touch/fine motor control, theme integration. react-colorful handles most of this in 3KB. Only consider alternatives if you need eyedropper tool, color harmony rules, or gradient picking.)

---

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 35-color-picker`
