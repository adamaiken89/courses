# Module 28: Monorepo — Turborepo

Est. study time: 1.5h
Language: en

## Learning Objectives
- Understand Turborepo architecture (pipeline, cache, remote caching)
- Configure turbo.json with task graph and dependsOn
- Implement caching strategies for build outputs
- Set up remote caching with Vercel
- Integrate with pnpm workspaces
- Create shared TypeScript config packages
- Create shared ESLint and Prettier config packages
- Maintain library version consistency across consumers
- Plan React 19 rollout strategy across monorepo

---

## Core Content

### Turborepo Architecture

Turborepo orchestrates monorepo task execution with caching. Core concepts:

| Concept | Description |
|---------|-------------|
| Pipeline | Defines tasks per package or globally |
| dependsOn | Task ordering: ^build (upstream builds first) |
| Cache | Persistent task output cache (local + remote) |
| Remote caching | Shared cache across CI machines and developers |

```
Project Root
  ├── turbo.json
  ├── package.json (workspaces)
  └── packages/
        ├── config-typescript/
        │     ├── package.json
        │     └── base.json
        ├── config-eslint/
        │     ├── package.json
        │     └── index.js
        ├── ui/
        │     ├── package.json
        │     ├── tsconfig.json
        │     └── src/
        └── app-web/
              ├── package.json
              ├── tsconfig.json
              └── src/
```

### Workspace Configuration

```json
// package.json (root)
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "dev": "turbo run dev --parallel"
  }
}
```

pnpm workspace config:

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

### turbo.json Pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"],
      "inputs": ["src/**", "tsconfig.json"],
      "env": ["NEXT_PUBLIC_API_URL", "DATABASE_URL"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": [],
      "inputs": ["src/**", ".eslintrc.js"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": [],
      "inputs": ["src/**", "*.test.*"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

Key pipeline options:

| Option | Purpose |
|--------|---------|
| dependsOn: ["^build"] | Wait for dependency build before running |
| dependsOn: ["build"] | Wait for own previous build task |
| outputs | Files to cache (glob patterns) |
| inputs | Files that affect cache key |
| env | Environment variables in cache key |
| cache: false | Skip caching (dev servers, watchers) |
| persistent: true | Long-running process (dev server) |

### Cache Strategies

```json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "lint": {
      "outputs": [],
      "inputs": ["src/**", ".eslintrc.js"]
    }
  }
}
```

Cache hit = skip task execution entirely. Cache key computed from: task definition, inputs file hashes, global dependencies, env vars.

Selective outputs caching:

| Strategy | When |
|----------|------|
| Cache everything (dist/**) | Standard builds |
| No cache (outputs: []) | Lint, typecheck (fast anyway) |
| Partial cache | Large outputs, cache specific artifacts |
| No cache + persistent | Dev servers, watchers |

### Remote Caching with Vercel

```bash
# Link project to Vercel remote cache
npx turbo login
npx turbo link

# Or configure in turbo.json
{
  "remoteCache": {
    "signature": true,
    "enabled": true
  }
}
```

Remote cache benefits:
- CI builds skip if output exists from any contributor
- PR checks reuse cached builds from main branch
- Developer machines skip rebuild when pulling branch
- Cache key includes branch — main branch cache shared across all PRs

### Shared TypeScript Config

```json
// packages/config-typescript/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

```json
// packages/config-typescript/nextjs.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "noEmit": true
  }
}
```

```json
// packages/config-typescript/react-library.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

Consumer packages reference config:

```json
// apps/web/tsconfig.json
{
  "extends": "config-typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"]
}
```

### Shared ESLint Config

```typescript
// packages/config-eslint/index.js
module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/no-unescaped-entities': 'off',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
        'newlines-between': 'always',
      },
    ],
  },
}
```

```json
// apps/web/.eslintrc.js
module.exports = {
  root: true,
  extends: ['config-eslint'],
}
```

### Shared Prettier Config

```typescript
// packages/config-prettier/index.js
module.exports = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  plugins: ['prettier-plugin-tailwindcss'],
}
```

```json
// .prettierrc.js (root)
const config = require('config-prettier')
module.exports = config
```

### Version Consistency

```typescript
// packages/ui/package.json
{
  "name": "@myorg/ui",
  "version": "0.1.0",
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

```typescript
// packages/config-eslint/package.json
{
  "name": "config-eslint",
  "version": "0.1.0",
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-react": "^7.34.0"
  },
  "peerDependencies": {
    "eslint": "^8.56.0 || ^9.0.0"
  }
}
```

Consistency strategies:

| Strategy | Implementation |
|----------|----------------|
| Single version policy | Same React/ReactDOM version across all packages |
| Peer dependencies | Library packages declare peer dependency range |
| Sync script | GitHub action to check version alignment |
| Renovate/Dependabot | Auto-update dependencies across all packages |
| overrides/resolutions | Force single version for transitive dependencies |

```json
{
  "pnpm": {
    "overrides": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0"
    }
  }
}
```

### React 19 Rollout Across Monorepo

```json
{
  "pipeline": {
    "build:canary": {
      "dependsOn": ["^build:canary"],
      "outputs": ["dist/**"]
    },
    "test:canary": {
      "dependsOn": ["build:canary"],
      "outputs": []
    }
  }
}
```

Gradual adoption strategy:

```json
// packages/ui-canary/package.json
{
  "name": "@myorg/ui-canary",
  "version": "0.1.0-canary",
  "peerDependencies": {
    "react": "^19.0.0-rc",
    "react-dom": "^19.0.0-rc"
  }
}
```

```typescript
// apps/web-canary/next.config.js
/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    reactCompiler: true,
  },
}
```

Rollout plan:

1. Create canary versions of library packages
2. Canary app workspace tests React 19
3. Shared packages updated to support both React 18 and 19
4. Peer dependencies use range: `"react": "^18.0.0 || ^19.0.0"`
5. Migration verified in CI with both React 18 and 19 build

```typescript
// packages/ui/package.json (dual support)
{
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  }
}
```

> **Think**: Why use peer dependencies for React instead of direct dependencies in library packages?
>
> *Answer: Peer dependencies ensure consumer app controls React version. Direct dependency would install duplicate React versions. With monorepo, single React instance shared across all packages. Peer dependencies enforce version alignment without duplicates.*

### Task Graph Visualization

```
turbo run build

build:packages/ui
  │
  ▼
build:apps/web (depends on ^build — waits for ui build)
  │
  ▼
lint:apps/web (depends on build — sequential)
```

Turborepo parallelizes independent tasks:

```
turbo run build

build:packages/config-typescript    build:packages/config-eslint
        │                                     │
        └─────────────┬───────────────────────┘
                      ▼
              build:packages/ui
                      │
                      ▼
                 build:apps/web
```

### Remote Caching Configuration

```json
{
  "remoteCache": {
    "signature": true,
    "enabled": true
  }
}
```

```bash
# Environment variables for remote cache
TURBO_TOKEN=your_token
TURBO_TEAM=your_team
TURBO_REMOTE_CACHE_SIGNATURE_KEY=your_key

# Or via Vercel
npx turbo link
```

---

### Why This Matters

Monorepos solve code sharing problems: duplicate config files, inconsistent dependency versions, complex cross-package testing. Turborepo adds caching — CI build time drops from minutes to seconds when cache hits. Without monorepo tooling, organizations end up with disconnected repos, copy-pasted configs, and version drift.

---

### Common Questions

**Q: Turborepo vs Nx vs Lerna — which to choose?**
A: Turborepo is simplest setup (one turbo.json), fastest cache (Go binary), best Vercel integration. Nx has more features (affected detection, generators, codegen). Lerna is legacy (npm workspaces + task runner). For new projects: Turborepo.

**Q: Can Turborepo cache Docker builds?**
A: No — Turborepo caches JS/TS build outputs. Docker builds should use Docker layer caching or separate CI caching. Turborepo can build the application that goes into Docker.

---

## Examples

### Example 1: Full turbo.json Pipeline Config

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**", "build/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"],
      "env": ["NODE_ENV", "API_URL", "DATABASE_URL"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": [],
      "inputs": ["src/**", "*.test.*", "*.spec.*"]
    },
    "e2e": {
      "dependsOn": ["build"],
      "outputs": [],
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    },
    "format:check": {
      "outputs": []
    },
    "format:write": {
      "outputs": [],
      "cache": false
    }
  }
}
```

Run commands:

```bash
# Build everything sequentially respecting dependency graph
turbo run build

# Lint and typecheck in parallel
turbo run lint typecheck

# Test and build concurrently
turbo run test build

# Dev servers for all workspaces (no cache, persistent)
turbo run dev --parallel

# Filter to specific package
turbo run build --filter=@myorg/ui

# Show task graph (no execution)
turbo run build --dry-run

# Show execution summary
turbo run build --summarize
```

### Example 2: Shared tsconfig Pattern

```json
// packages/config-typescript/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

```json
// packages/config-typescript/react-library.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

```json
// packages/config-typescript/nextjs.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Consumer pattern:

```json
// apps/web/tsconfig.json
{
  "extends": "config-typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@myorg/ui/*": ["../../packages/ui/src/*"]
    }
  }
}
```

```json
// packages/ui/tsconfig.json
{
  "extends": "config-typescript/react-library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

---

## Key Takeaways
- Turborepo orchestrates monorepo tasks with dependency graph and caching
- turbo.json defines pipeline: dependsOn, outputs, inputs, env
- Cache key includes task definition, input hashes, global deps, env vars
- Remote caching shares cache across CI and developers via Vercel
- pnpm workspaces manages workspace package resolution
- Shared tsconfig packages extend base config per framework
- Shared ESLint/Prettier configs ensure consistent code style
- Version consistency via peer dependencies and overrides
- React 19 rollout: canary packages, dual peer dependency ranges
- Task filtering (--filter) targets specific packages
- --dry-run visualizes dependency graph without execution

## Common Misconception

"**Turborepo only works with Next.js on Vercel.**"

Turborepo works with any framework (React, Vue, Angular, Svelte, Node) and any platform. Vercel integration is optional — use S3-compatible remote cache (turbo-server) or local cache only. Turborepo is framework-agnostic.

---

## Feynman Explain
(Explain Turborepo to a junior: "Turborepo is a task scheduler for monorepos. It knows that app-web depends on ui and config-typescript. When you run build, it builds dependencies first, then the dependent packages. It caches outputs — if nobody changed code since last build, it skips the task and copies from cache. Remote cache stores these artifacts in cloud so your CI and coworkers share cache hits.")

---

## Reframe
(Pause. Monorepo is not about tooling — it is about dependency management at scale. Turborepo solves task orchestration with caching, but the deeper win is shared configuration. When every package uses `config-typescript/nextjs.json`, consistency is enforced at the monorepo level. Config packages become the source of truth for tooling decisions. Platform upgrade (TypeScript 6.0) means updating one package, not 20 repos.)

---

## Drill
Take the quiz. MCQs test turbo.json pipeline, cache configuration, remote caching, shared config packages, workspace configuration, version consistency, React 19 rollout, and task graph.

Run: `learn.sh quiz external-lib-patterns 28-monorepo`
