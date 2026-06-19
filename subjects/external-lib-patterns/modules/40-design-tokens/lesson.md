# Module 40: Design Tokens — Style Dictionary

Est. study time: 1.5h
Language: en

## Learning Objectives
- Configure Style Dictionary for multi-platform token output
- Define token hierarchy: global → alias → component
- Build custom transforms for React Native and Tailwind config
- Implement theming with CSS custom properties from tokens
- Integrate token CI pipeline with linting and breaking change detection
- Apply React 19 patterns: static class names for React Compiler, zero-cost theming in Server Components
---

## Core Content

### Style Dictionary Architecture

Style Dictionary reads structured token JSON and transforms/ formats for multiple platforms.

```
tokens/
├── global/
│   ├── color.json
│   ├── spacing.json
│   └── typography.json
├── alias.json
└── components/
    ├── button.json
    └── card.json
```

```typescript
// config.json (Style Dictionary config)
{
  "source": ["tokens/**/*.json"],
  "platforms": {
    "css": {
      "transformGroup": "css",
      "buildPath": "dist/css/",
      "files": [{
        "destination": "tokens.css",
        "format": "css/variables"
      }]
    },
    "js": {
      "transformGroup": "js",
      "buildPath": "dist/js/",
      "files": [{
        "destination": "tokens.js",
        "format": "javascript/es6"
      }]
    },
    "ts": {
      "transformGroup": "js",
      "buildPath": "dist/ts/",
      "files": [{
        "destination": "tokens.ts",
        "format": "typescript/es6-declarations"
      }]
    }
  }
}
```

### Token Format

Token structure follows Design Token Community Group spec:

```json
{
  "color": {
    "neutral": {
      "white": { "value": "#FFFFFF", "type": "color" },
      "gray-100": { "value": "#F5F5F5", "type": "color" },
      "gray-500": { "value": "#9CA3AF", "type": "color" },
      "gray-900": { "value": "#111827", "type": "color" },
      "black": { "value": "#000000", "type": "color" }
    },
    "primary": {
      "500": { "value": "#3B82F6", "type": "color" },
      "600": { "value": "#2563EB", "type": "color" },
      "700": { "value": "#1D4ED8", "type": "color" }
    }
  },
  "spacing": {
    "xs": { "value": "4px", "type": "dimension" },
    "sm": { "value": "8px", "type": "dimension" },
    "md": { "value": "16px", "type": "dimension" },
    "lg": { "value": "24px", "type": "dimension" },
    "xl": { "value": "32px", "type": "dimension" }
  },
  "border-radius": {
    "sm": { "value": "4px", "type": "dimension" },
    "md": { "value": "8px", "type": "dimension" },
    "lg": { "value": "16px", "type": "dimension" }
  }
}
```

### Alias Tokens

```json
{
  "color": {
    "background": {
      "primary": { "value": "{color.primary.500}", "type": "color" },
      "surface": { "value": "{color.neutral.white}", "type": "color" }
    },
    "text": {
      "primary": { "value": "{color.neutral.gray-900}", "type": "color" },
      "secondary": { "value": "{color.neutral.gray-500}", "type": "color" }
    }
  },
  "spacing": {
    "button": {
      "padding-x": { "value": "{spacing.md}", "type": "dimension" },
      "padding-y": { "value": "{spacing.sm}", "type": "dimension" }
    }
  }
}
```

### Component Tokens

```json
{
  "button": {
    "background": {
      "primary": { "value": "{color.background.primary}", "type": "color" },
      "hover": { "value": "{color.primary.600}", "type": "color" }
    },
    "text-color": {
      "primary": { "value": "{color.text.primary}", "type": "color" }
    },
    "border-radius": { "value": "{border-radius.md}", "type": "dimension" }
  }
}
```

### CSS Output

```css
:root {
  --color-neutral-white: #FFFFFF;
  --color-neutral-gray-100: #F5F5F5;
  --color-neutral-gray-500: #9CA3AF;
  --color-neutral-gray-900: #111827;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --color-background-primary: var(--color-primary-500);
  --color-background-surface: var(--color-neutral-white);
  --color-text-primary: var(--color-neutral-gray-900);
  --button-background-primary: var(--color-background-primary);
}

[data-theme="dark"] {
  --color-neutral-white: #1F2937;
  --color-neutral-gray-900: #F9FAFB;
  --color-background-surface: var(--color-neutral-gray-100);
  --color-text-primary: var(--color-neutral-gray-900);
}
```

### Custom Transforms

```typescript
// style-dictionary.config.ts
import StyleDictionary from "style-dictionary";

// Custom transform: px to React Native dp
StyleDictionary.registerTransform({
  name: "size/pxToDp",
  type: "value",
  matcher: (token) => token.type === "dimension",
  transformer: (token) => {
    const value = token.value as string;
    const num = parseFloat(value);
    return isNaN(num) ? value : `${num * 2}dp`;
  },
});

// Custom format: Tailwind config
const tailwindFormat = StyleDictionary.registerFormat({
  name: "tailwind/config",
  formatter: ({ dictionary }) => {
    const colors = dictionary.allTokens
      .filter((t) => t.type === "color")
      .reduce((acc: Record<string, string>, t) => {
        const key = t.path.join("-");
        acc[key] = t.value as string;
        return acc;
      }, {});

    const spacing = dictionary.allTokens
      .filter((t) => t.type === "dimension")
      .reduce((acc: Record<string, string>, t) => {
        const key = t.path.join("-");
        const num = parseFloat(t.value as string);
        acc[key] = isNaN(num) ? t.value : `${num / 4}rem`;
        return acc;
      }, {});

    return JSON.stringify({ theme: { extend: { colors, spacing } } }, null, 2);
  },
});

export default {
  source: ["tokens/**/*.json"],
  platforms: {
    "rn": {
      transformGroup: "js",
      transforms: ["size/pxToDp"],
      buildPath: "dist/rn/",
      files: [{ destination: "tokens.js", format: "javascript/es6" }],
    },
    "tailwind": {
      transformGroup: "js",
      buildPath: "dist/tailwind/",
      files: [{ destination: "tailwind.config.extend.json", format: "tailwind/config" }],
    },
  },
};
```

### Theming with CSS Custom Properties

```typescript
// tokens/theme/light.json
{
  "theme": {
    "background": {
      "primary": { "value": "#FFFFFF", "type": "color" },
      "secondary": { "value": "#F5F5F5", "type": "color" }
    },
    "text": {
      "primary": { "value": "#111827", "type": "color" },
      "secondary": { "value": "#6B7280", "type": "color" }
    }
  }
}
```

```typescript
// tokens/theme/dark.json
{
  "theme": {
    "background": {
      "primary": { "value": "#1F2937", "type": "color" },
      "secondary": { "value": "#374151", "type": "color" }
    },
    "text": {
      "primary": { "value": "#F9FAFB", "type": "color" },
      "secondary": { "value": "#D1D5DB", "type": "color" }
    }
  }
}
```

```css
/* dist/css/tokens.css */
:root, [data-theme="light"] {
  --theme-background-primary: #FFFFFF;
  --theme-background-secondary: #F5F5F5;
  --theme-text-primary: #111827;
  --theme-text-secondary: #6B7280;
}

[data-theme="dark"] {
  --theme-background-primary: #1F2937;
  --theme-background-secondary: #374151;
  --theme-text-primary: #F9FAFB;
  --theme-text-secondary: #D1D5DB;
}
```

```typescript
// ThemeToggle.tsx
"use client";

import { useCallback } from "react";

export function ThemeToggle() {
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
  }, []);

  return <button className="inline-button" onClick={toggle}>Toggle Theme</button>;
}
```

### CI Integration

```yaml
# .github/workflows/token-check.yml
name: Design Token Check
on: [pull_request]
jobs:
  token-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install style-dictionary
      - run: npx style-dictionary build --config config.json
      - name: Check for breaking changes
        run: |
          git fetch origin main
          diff --unified \
            <(git show origin/main:dist/css/tokens.css) \
            dist/css/tokens.css \
            && echo "No breaking changes" \
            || echo "Token changes detected — review required"
```

### Token Hierarchy

```
Global tokens (foundation)
  └─ Alias tokens (semantic mapping)
       └─ Component tokens (scoped override)
```

| Level | Example | Scope |
|---|---|---|
| Global | `color.primary.500`, `spacing.md` | Design system foundation |
| Alias | `color.background.primary` | Semantic purpose |
| Component | `button.background.primary` | Component-specific override |

### React Compiler with Token-Based Styles

Static class names = compiler-friendly:

```typescript
// compiler can memoize this — no dynamic style object
export function Button({ variant }: { variant: "primary" | "secondary" }) {
  return (
    <button className={`btn btn--${variant}`}>
      {children}
    </button>
  );
}
```

```css
/* tokens.css defines --button-background-primary */
.btn--primary {
  background-color: var(--button-background-primary);
  color: var(--button-text-primary);
  border-radius: var(--button-border-radius);
  padding: var(--spacing-sm) var(--spacing-md);
}
```

No inline style objects = React Compiler skips dynamic style reconciliation.

### Server Components with Token CSS

```typescript
// app/page.tsx — Server Component
import "./tokens.css"; // imported in root layout once

export default async function Page() {
  return (
    <div className="page-container">
      <h1 className="heading-xl">Design System</h1>
      <p className="text-body">Token-driven styling with zero runtime cost.</p>
    </div>
  );
}
```

Server Components emit HTML with class names. CSS custom properties resolve at paint time, no JS runtime. No theming cost on server.

---

### Why This Matters

Design tokens decouple visual style from component code. One token source generates CSS for web, JSON for mobile, config for Tailwind. CI checks prevent visual regressions. React 19 static class names optimize compiler output. Server Components render themed CSS without JavaScript.

---

### Common Questions

**Q: Should I use inline styles or CSS custom properties from tokens?**
A: CSS custom properties. Inline styles cannot be overridden by theme without component re-render. Custom properties re-theme via attribute change (data-theme) without re-render.

**Q: How do I handle token deprecation?**
A: Mark deprecated tokens in JSON with `deprecated: true`. Add CI check that warns on usage of deprecated tokens. Remove after migration window.

**Q: Can I use tokens without Style Dictionary?**
A: Yes, but you lose platform transforms, CI integration, and format standardization. Style Dictionary is the industry standard for token pipeline.

---

## Examples

### Example 1: Multi-Platform Token Pipeline

```typescript
// style-dictionary.config.ts
import StyleDictionary from "style-dictionary";

StyleDictionary.registerTransform({
  name: "size/rem",
  type: "value",
  matcher: (token) => token.type === "dimension",
  transformer: (token) => {
    const num = parseFloat(token.value as string);
    return isNaN(num) ? token.value : `${num / 16}rem`;
  },
});

const buildConfigs = [
  {
    source: ["tokens/**/*.json"],
    platforms: {
      css: {
        transformGroup: "css",
        buildPath: "dist/web/",
        files: [{ destination: "variables.css", format: "css/variables" }],
      },
      scss: {
        transformGroup: "scss",
        buildPath: "dist/web/",
        files: [{ destination: "_variables.scss", format: "scss/variables" }],
      },
      "react-native": {
        transformGroup: "js",
        transforms: ["size/pxToDp", "attribute/cti"],
        buildPath: "dist/mobile/",
        files: [{ destination: "tokens.js", format: "javascript/es6" }],
      },
      tailwind: {
        transformGroup: "js",
        buildPath: "dist/tailwind/",
        files: [{ destination: "extend.json", format: "tailwind/config" }],
      },
    },
  },
];

buildConfigs.forEach((cfg) => {
  const sd = new StyleDictionary(cfg);
  sd.buildAllPlatforms();
});
```

### Example 2: Custom Transform for React Native

```typescript
// transforms/rn-transform.ts
import StyleDictionary from "style-dictionary";

StyleDictionary.registerTransform({
  name: "size/pxToDp",
  type: "value",
  matcher: (token) => token.type === "dimension",
  transformer: (token) => {
    const value = token.value as string;
    const num = parseFloat(value);
    return isNaN(num) ? value : num * 2;
  },
});

StyleDictionary.registerTransformGroup({
  name: "custom/rn",
  transforms: [
    "attribute/cti",
    "name/cti/camel",
    "size/pxToDp",
    "color/css",
  ],
});

export default {
  source: ["tokens/**/*.json"],
  platforms: {
    rn: {
      transformGroup: "custom/rn",
      buildPath: "dist/rn/",
      files: [{ destination: "tokens.ts", format: "typescript/es6-declarations" }],
    },
  },
};
```

Output:

```typescript
// dist/rn/tokens.ts
export const ColorNeutralWhite = "#FFFFFF";
export const ColorPrimary500 = "#3B82F6";
export const SpacingMd = 32; // 16px * 2 = 32dp
export const BorderRadiusMd = 16; // 8px * 2 = 16dp
```

### Example 3: CI Token Diff Checker

```typescript
// scripts/check-token-diff.ts
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const BASE_BRANCH = "main";
const CSS_PATH = "dist/css/variables.css";

function getCurrentTokens(): string {
  return readFileSync(resolve(CSS_PATH), "utf-8");
}

function getBaseTokens(): string {
  try {
    return execSync(
      `git show origin/${BASE_BRANCH}:${CSS_PATH}`,
      { encoding: "utf-8" }
    );
  } catch {
    return "";
  }
}

function parseVariables(css: string): Map<string, string> {
  const map = new Map();
  const regex = /--([^:]+):\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    map.set(match[1].trim(), match[2].trim());
  }
  return map;
}

function checkBreakingChanges(): void {
  if (!existsSync(CSS_PATH)) {
    console.log("No token CSS file found. Skipping.");
    process.exit(0);
  }

  const current = parseVariables(getCurrentTokens());
  const base = parseVariables(getBaseTokens());

  let breaking = false;

  for (const [key, value] of current) {
    if (base.has(key) && base.get(key) !== value) {
      console.warn(`BREAKING: ${key} changed from ${base.get(key)} to ${value}`);
      breaking = true;
    }
  }

  for (const key of current.keys()) {
    if (!base.has(key)) {
      console.log(`NEW: ${key} = ${current.get(key)}`);
    }
  }

  if (breaking) {
    console.error("Breaking token changes found. Review required.");
    process.exit(1);
  }

  console.log("No breaking token changes.");
}

checkBreakingChanges();
```

---

## Key Takeaways
- Style Dictionary: single token source → CSS, JS, TS, Tailwind, React Native
- Token hierarchy: global foundation → alias semantics → component overrides
- Custom transforms: pxToDp for React Native, rem for web, custom format for Tailwind
- Theming: multiple token sets (light/dark) → CSS custom properties → data-theme attribute
- CI: lint tokens on PR, detect breaking changes via CSS diff
- React 19: static class names = compiler-friendly (no dynamic style objects)
- Server Components: class names + CSS custom properties = zero JS runtime for theming

## Common Misconception

"**Design tokens are only for design systems teams.**"

Design tokens benefit any app with theming, multi-platform output, or visual consistency. Even a single app benefits from alias tokens (color.danger instead of hardcoding #DC2626). The CI token diff prevents accidental color regressions across teams.

## Feynman Explain

Design tokens = named variables for every visual property. Style Dictionary = compiler that reads tokens and writes CSS files, JS files, config files. Token hierarchy: global = raw materials (blue #3B82F6), alias = purpose (danger = blue), component = specific (button danger background = danger). Theming = swapping token values based on data-theme attribute. React Compiler loves static class names because it can cache rendering unconditionally.

## Reframe

Style Dictionary is Webpack for design. Input: standardized token JSON. Output: platform-specific artifacts (CSS custom properties, TypeScript enums, Tailwind config, Android XML, iOS asset catalog). Custom transforms = loaders (px → dp, px → rem). CI pipeline = lint + type-check for visual properties. Token hierarchy = component inheritance chain (global → theme → component).

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 40-design-tokens`
