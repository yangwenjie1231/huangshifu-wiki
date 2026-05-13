# AGENTS.md

***

**Strong success criteria let you close the loop independently. Weak criteria ("make it work") require constant clarification.**

***

## 1. Project Identity

| Dimension           | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Name**            | 黄诗扶 Wiki (Huangshifu Wiki) — `react-example` in package.json                          |
| **Type**            | Full-stack React SPA + Express API (monorepo-style single package)                    |
| **Runtime**         | Browser (React 19) + Node.js (Express 4)                                              |
| **Database**        | PostgreSQL via Prisma ORM (`provider = "postgresql"`)                                 |
| **Vector DB**       | Qdrant (CLIP image embeddings + wiki text embeddings)                                 |
| **Auth**            | Custom JWT + WeChat Mini Program (微信小程序)                                              |
| **Storage**         | Triple storage: local disk / S3-compatible (Bitiful) / external (Superbed, Lsky Pro+) |
| **Entry Point**     | `server.ts` — wires Express routes, serves Vite dev middleware or `dist/` static      |
| **Package Manager** | npm (lockfile: `package-lock.json`)                                                   |
| **Node Version**    | 22 (CI enforced)                                                                      |
| **Module System**   | ESM (`"type": "module"`)                                                              |

### Domain Model (what this app does)

A fan wiki / community platform for musician 黄诗扶, featuring:

- **Wiki pages** with Git-like branch → PR → merge collaboration workflow
- **Forum posts** with sections, hot scoring, moderation queue
- **Music aggregation** across 5 platforms (Netease/Tencent/Kugou/Baidu/Kuwo) with multi-platform playback
- **Photo galleries** with CLIP-based vector image search
- **AI-powered features**: relation recommendation (Gemini), auto-embeddings
- **Admin dashboard**: backups, disk monitoring, variant management, embedding sync, review queue

***

## 2. Source of Truth (trust these over README prose)

When files conflict, trust in this order:

1. `package.json` — scripts, dependencies, metadata
2. `tsconfig.json` — compiler options, path aliases
3. `prisma/schema.prisma` — database schema (single source of truth for data model)
4. `.env.example` — all environment variables
5. `server.ts` — runtime wiring, middleware order, route registration
6. `vite.config.ts` — build config, chunk splitting, alias resolution

***

## 3. Architecture Overview

### Layer Stack (top → bottom)

**Frontend (Browser — React 19)**

- `src/pages/` — Route-level components, all lazy-loaded via `React.lazy()`
- `src/components/` — \~50 reusable UI components organized by domain (Modal/, Music/, Navbar/, wiki/, search/, charts/, admin/)
- `src/context/` — Global state: `AuthProvider` → `MusicProvider` → `UserPreferencesProvider`
- `src/hooks/` — 18 custom hooks: `useApi`, `useSearch`, `usePagination`, `useVirtualList`, etc.
- `src/lib/` + `src/types/` + `src/utils/` — Frontend utilities, type definitions, pure helpers

**Shared HTTP Layer**

- `src/lib/apiClient.ts` — Single HTTP client with GET dedup + SWR cache + error classification. Exports `apiGet/apiPost/apiPut/apiDelete/apiUpload`. All requests use `credentials: 'include'` (JWT cookies). **Always prefer this over raw fetch.**

**Backend (Node.js — Express 4, wired by** **`server.ts`)**

1. **Middleware chain:** `authMiddleware` (JWT attach) → `rateLimiter` → `requestLogger`
2. **Routes** (`src/server/routes/`, 22 files): Per-domain Express Routers — `wiki.routes.ts` is the largest. Registered via factory functions `registerXxxRoutes(app)`
3. **Server Utils barrel** (`src/server/utils/index.ts`): Re-exports from 13 sub-modules — config, parsers, authorization, response-transformers, music, upload, wiki-relations, cache, backup, wechat, notifications, post-scoring, hash. **Route handlers import from this barrel; do not bypass it.**
4. **Infrastructure layer:**
   - `src/server/prisma.ts` — Prisma Client singleton → PostgreSQL
   - `src/server/services/` — Heavy operations: cloudSync, diskMonitor, imageOptimizer, variantGenerator, variantCleanup
   - `src/server/vector/` — Qdrant REST client + CLIP embedding pipeline (`clipEmbedding`, `embeddingSync`, `wikiPostEmbedding`, `qdrantService`)
   - `src/server/s3/` — S3-compatible storage abstraction
   - `src/server/location/` — EXIF parsing + Amap geocoding
   - `src/server/wiki/` + `src/server/music/` + `src/server/birthday/` — Domain services
5. **AI Services** (`src/services/`): Gemini integration for relation recommendation + general AI tasks

### Data Flow

```
React Component → useApi() hook → apiGet/post/put/delete()
  → apiClient.ts (dedup + classifyError)
    → fetch(credentials: include) over HTTP
      → Express route handler (server/routes/)
        → server/utils/ barrel (business logic)
          → Prisma Client (PostgreSQL)
          → QdrantClient (vector search)
          → S3 SDK / external image hosts
```

***

## 4. Directory Layout (critical paths)

```
project-root/
├── server.ts                    # Runtime entrypoint — Express app + Vite middleware
├── vite.config.ts               # Build: Tailwind v4, manual chunks, terser
├── tsconfig.json                # ES2022 target, @/* path alias, bundler resolution
├── prisma/
│   └── schema.prisma            # 30+ models, PostgreSQL enums, full relation map
├── src/
│   ├── main.tsx                 # React entry: StrictMode, SW registration, WebVitals
│   ├── App.tsx                  # Router + providers (Auth/Music), lazy page loading
│   ├── index.css                # Global styles (Tailwind v4 imported here)
│   ├── components/              # ~50 UI components organized by domain
│   │   ├── Modal/               # ConfirmModal, FormModal (barrel index.ts)
│   │   ├── Music/               # AlbumCard, SongCard, MusicFilters, BatchActions
│   │   ├── Navbar/              # AuthModal, MobileMenu, NotificationPanel
│   │   ├── admin/               # AdminLayout
│   │   ├── charts/              # ECharts wrappers (index.ts barrel)
│   │   ├── search/              # SearchBox, SearchFilters, SearchResultCard, SearchResults
│   │   ├── wiki/                # WikiEditor, WikiCard, RelationGraph, types.ts
│   │   └── ... (~30 standalone components)
│   ├── pages/                   # Route pages (all lazy-loaded)
│   │   ├── Home.tsx · Forum.tsx · Gallery.tsx · Music.tsx · Search.tsx · Profile.tsx
│   │   ├── GalleryDetail.tsx · AlbumDetail.tsx · MusicDetail.tsx · MusicLinks.tsx
│   │   ├── Admin/               # 12 admin sub-pages
│   │   ├── home/DefaultHome.tsx
│   │   └── wiki/                # 9 wiki sub-pages (list, view, history, PR, timeline...)
│   ├── context/                 # React Context providers
│   │   ├── AuthContext.tsx       # JWT auth + WeChat mini-program login
│   │   ├── MusicContext.tsx      # Global music player state
│   │   └── UserPreferencesContext.tsx
│   ├── hooks/                   # 18 custom hooks
│   ├── lib/                     # 26 frontend utility modules
│   │   ├── apiClient.ts         # ★ Shared HTTP client — ALWAYS prefer this over raw fetch
│   │   ├── errorHandler.ts      # AppError hierarchy + classifyError + getUserFriendlyMessage
│   │   ├── auth.ts              # JWT token management
│   │   └── ... (wiki parsers, i18n, lrcParser, markdown, lskyClient, etc.)
│   ├── types/                   # Frontend type definitions
│   │   ├── api.ts               # ★ API request/response interfaces
│   │   ├── common.ts            # Shared union types (ContentStatus, Platform, ViewMode)
│   │   ├── entities.ts          # Domain entity types (UserProfile, etc.)
│   │   ├── userPreferences.ts   # User preference types
│   │   └── PlatformIds.ts
│   ├── utils/                   # 5 pure frontend utilities
│   ├── services/                # AI + shared backend services
│   ├── styles/                  # Style constants (cardStyles.ts)
│   ├── locales/                 # i18n default locale (default.json)
│   └── server/                  # ★ Backend — the largest subsystem
│       ├── prisma.ts            # Prisma client singleton
│       ├── uploadPath.ts        # Upload path resolution (local/S3/external)
│       ├── blurhashService.ts   # Blurhash generation for images
│       ├── middleware/           # auth, rateLimiter, requestLogger
│       ├── routes/              # 22 route modules (per domain)
│       │   ├── wiki.routes.ts   # Largest route file — Wiki CRUD + branches + PRs
│       │   ├── admin.routes.ts
│       │   ├── admin.system.routes.ts
│       │   ├── admin.variants.routes.ts
│       │   └── ... (18 more)
│       ├── utils/               # ★ Barrel export hub — import { xxx } from '../utils'
│       │   ├── index.ts         # Re-exports from all sub-modules
│       │   ├── config.ts        # Env vars, constants, Prisma singleton
│       │   ├── parsers.ts       # Input normalization (30+ parse* functions)
│       │   ├── authorization.ts # Visibility/access control (canView*)
│       │   ├── response-transformers.ts # toXxxResponse() serializers
│       │   ├── music.ts         # Music platform resolution, play URL caching
│       │   ├── upload.ts        # File upload, S3, external hosts, validation
│       │   ├── wiki-relations.ts # Relation engine (graph building, resolution)
│       │   ├── cache.ts         # EnhancedCache wrapper around node-cache
│       │   ├── backup.ts        # DB backup/restore with encryption
│       │   ├── wechat.ts        # WeChat Mini Program login flow
│       │   ├── notifications.ts # Notification creation + browsing history
│       │   ├── post-scoring.ts  # Hot score algorithm
│       │   └── hash.ts          # MD5 hashing utilities
│       ├── services/            # Background/heavy operations
│       │   ├── cloudSyncService.ts
│       │   ├── diskMonitor.service.ts
│       │   ├── imageOptimizer.ts
│       │   ├── imageSyncService.ts
│       │   ├── variantGenerator.ts
│       │   └── variantCleanup.service.ts
│       ├── types/               # Server-side type definitions
│       │   └── index.ts         # 30+ exported types + constants
│       ├── vector/              # Vector search subsystem
│       │   ├── qdrantService.ts
│       │   ├── clipEmbedding.ts
│       │   ├── embeddingSync.ts
│       │   └── wikiPostEmbedding.ts
│       ├── wiki/                # Wiki-specific backend logic
│       │   ├── wikiBranchAccess.ts
│       │   ├── wikiTitleKey.ts
│       │   └── markdownLinkUpdater.ts
│       ├── s3/                  # S3 service abstraction
│       ├── location/            # Geo/location services (EXIF + geocoding)
│       │   ├── locationService.ts
│       │   ├── geoService.ts
│       │   ├── exifService.ts
│       │   ├── routes.ts
│       │   └── exifRoutes.ts
│       ├── birthday/            # Birthday feature service
│       └── music/               # Music platform integration
│           ├── metingService.ts
│           └── musicUrlParser.ts
├── public/
│   └── sw.js                    # Service Worker (cache name: huangshifu-wiki-v31)
├── scripts/                    # Standalone maintenance scripts
│   ├── test-db-init.ts
│   ├── test-db-cleanup.ts
│   ├── check-build-size.ts
│   ├── validate-migrations.ts
│   ├── sync-image-embeddings.ts
│   └── import-regions.ts
├── tests/
│   ├── unit/                    # 47 unit test files (vitest, jsdom/node split)
│   │   └── setup.ts
│   └── integration/             # 4 integration test files (requires PostgreSQL)
├── .github/workflows/
│   ├── ci.yml                   # 5-job CI pipeline
│   └── security.yml
└── .env.example                 # 157 lines of env var documentation
```

***

## 5. Commands Reference

### Development

| Command              | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `npm run dev`        | Starts dev server: `tsx server.ts` (Express + Vite HMR on port 3003) |
| `npm run test:watch` | Vitest watch mode for TDD                                            |

### Verification (run in sequence before delivery)

| Command                 | What it does                                          | Success Criteria                 |
| ----------------------- | ----------------------------------------------------- | -------------------------------- |
| `npm run lint`          | `tsc --noEmit` — TypeScript type checking only        | Exit code 0, 0 errors            |
| `npm run test:unit`     | `vitest run` — unit tests (jsdom + node environments) | Exit code 0, 0 failures          |
| `npm run test:coverage` | Unit tests with v8 coverage report                    | Must meet thresholds (see below) |
| `npm run build`         | `vite build` — production bundle                      | Exit code 0, `dist/` produced    |
| `npm run check:build`   | Validates build artifact size and integrity           | Script-defined checks pass       |

### Database

| Command               | What it does                                               |
| --------------------- | ---------------------------------------------------------- |
| `npm run db:generate` | Generate Prisma Client from schema                         |
| `npm run db:migrate`  | `prisma migrate dev` — create and apply migrations         |
| `npm run db:push`     | `prisma db push` — push schema changes directly (dev only) |
| `npm run db:deploy`   | `prisma migrate deploy` — production migrations            |
| `npm run db:seed`     | `prisma db seed` — seed database                           |

### Testing

| Command                    | What it does                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| `npm run test`             | `vitest run` (alias for test:unit)                                    |
| `npm run test:integration` | Integration tests with `vitest.integration.config.ts` (needs real PG) |
| `npm run test:db:init`     | Initialize test database                                              |
| `npm run test:db:cleanup`  | Cleanup test database                                                 |
| `npm run test:db:reset`    | Full test DB reset (cleanup + init)                                   |

### Maintenance Scripts

| Command                       | What it does                                   |
| ----------------------------- | ---------------------------------------------- |
| `npm run embeddings:sync`     | Full CLIP embedding sync for gallery images    |
| `npm run embeddings:enqueue`  | Enqueue images for embedding (queue-only mode) |
| `npm run regions:import`      | Import administrative region data              |
| `npm run validate:migrations` | Validate Prisma migration files                |
| `npm run clean`               | Remove `dist/` (`rd /s /q dist` on Windows)    |

### CI Pipeline Structure

CI runs **5 jobs** with dependency gating:

```
lint ──────────────┐
test-unit ──────────┤──→ build ──→ report
test-integration ──┘
```

- **lint** + **test-unit** + **test-integration** run in **parallel**
- **build** waits for all three to pass
- **report** generates PR comment with coverage + build size summary

Build size warning threshold: **50MB**

***

## 6. Coding Conventions

### Style (enforced by Prettier)

From [`.prettierrc`](/.prettierrc):

| Rule            | Value              |
| --------------- | ------------------ |
| Quotes          | Single (`'`)       |
| Semicolons      | None               |
| Indent          | 2 spaces (no tabs) |
| Print width     | 100                |
| Trailing commas | ES5                |
| Arrow parens    | Always             |
| End of line     | LF                 |
| JSX quotes      | Double (`"`)       |

### TypeScript Configuration

From [`tsconfig.json`](/tsconfig.json):

```jsonc
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "bundler",    // Vite/Rollup handles resolution
  "jsx": "react-jsx",               // No need to import React in every file
  "isolatedModules": true,
  "allowImportingTsExtensions": true,
  "noEmit": true,                   // Vite handles transpilation
  "paths": { "@/*": ["./*"] },      // Path alias
  "experimentalDecorators": true
}
```

### Naming Conventions

| Category              | Convention              | Example                                      |
| --------------------- | ----------------------- | -------------------------------------------- |
| Components (files)    | PascalCase              | `WikiEditor.tsx`, `SearchBox.tsx`            |
| Components (exports)  | PascalCase              | `export function WikiEditor()`               |
| Utility functions     | camelCase               | `normalizeWikiSlug`, `calculatePostHotScore` |
| Type aliases (unions) | PascalCase `type`       | `type ContentStatus = ...`                   |
| Interfaces (objects)  | PascalCase `interface`  | `interface ApiResponse<T>`                   |
| Constants             | UPPER\_SNAKE            | `CACHE_KEYS`, `WIKI_RELATION_SCAN_LIMIT`     |
| Route files           | domain.routes.ts        | `wiki.routes.ts`, `admin.routes.ts`          |
| Test files            | \*.test.ts              | `wikiSlug.test.ts`                           |
| Directory names       | kebab-case or camelCase | `wiki/`, `imageOptimizer.ts`                 |
| Environment vars      | UPPER\_SNAKE            | `DATABASE_URL`, `QDRANT_URL`                 |

**No** **`I`** **prefix on interfaces.** Prefer `interface` for object shapes, `type` for unions/literals.

### Import Order Pattern

Observed from core files:

```
// 1. Node / third-party built-ins
import express, { Request, Response } from 'express';
import { Router } from 'express';

// 2. npm packages (alphabetical within group)
import { Prisma } from '@prisma/client';
import clsx from 'clsx';

// 3. Internal: sibling/relative imports (@/ alias preferred)
import { requireAuth } from '../middleware/auth';
import { prisma, toWikiResponse } from '../utils';
import { normalizeWikiPageSlug } from '../../lib/wikiSlug';

// 4. Types (import type for type-only imports)
import type { AuthenticatedRequest, ContentStatus } from '../types';
```

### Component Patterns

- **Function components exclusively** — no class components
- **Lazy loading** for all page-level components via `React.lazy(() => import(...).then(m => ({ default: m.default })))`
- **Error boundaries** as class components (`ErrorBoundary.tsx`)
- **Context providers** wrap at `App.tsx` level: `AuthProvider` → `MusicProvider` → `MainLayout`
- **Tailwind CSS v4** for styling (via `@tailwindcss/vite` plugin); minimal CSS module usage (`Navbar.module.css`)
- **`clsx`** for conditional className composition

### Error Handling Pattern

The project uses a **hierarchical AppError system** ([`src/lib/errorHandler.ts`](/src/lib/errorHandler.ts)):

```
AppError (base)
├── NetworkError (status 0)
├── AuthError (401)
├── PermissionError (403)
├── NotFoundError (404)
├── ValidationError (400)
├── BusinessError (400)
├── ServerError (500)
├── VectorSearchError (503)
└── EmbeddingGenerationError (500)
```

**Frontend pattern:** `apiClient.ts` calls `classifyError(status, data)` → throws typed error → `useApi()` hook catches into state
**Backend pattern:** Route handlers return `res.status(n).json({ error: message })`; global error middleware in `server.ts`
**Key functions:** `handleError()`, `getUserMessage()`, `getUserFriendlyMessage()`, `logApiError()`, `setAuthErrorCallback()`

### State Management

- **React Context** for global state (Auth, Music, UserPreferences) — no Redux/Zustand
- **useApi / useApiWithToast** hooks for per-component async state
- **Server-side:** `enhancedCache` (node-cache wrapper) for response caching; `playUrlCache` for music URL TTL cache
- **No global client-side state library** beyond Context

### API Client Protocol

**ALWAYS use** [`src/lib/apiClient.ts`](/src/lib/apiClient.ts) exports — never raw `fetch`:

| Function                              | Method          | Dedup       | Use Case                      |
| ------------------------------------- | --------------- | ----------- | ----------------------------- |
| `apiGet<T>(path, query?)`             | GET             | ✅ SWR cache | Read operations               |
| `apiPost<T>(path, body?)`             | POST            | ❌           | Create operations             |
| `apiPut<T>(path, body?)`              | PUT             | ❌           | Full update                   |
| `apiPatch<T>(path, body?)`            | PATCH           | ❌           | Partial update                |
| `apiDelete<T>(path)`                  | DELETE          | ❌           | Delete operations             |
| `apiUpload<T>(path, formData, opts?)` | POST (FormData) | ❌           | File upload                   |
| `apiUploadWithRetry<T>(...)`          | POST (FormData) | ❌           | Upload with retry             |
| `apiUploadWithProgress<T>(...)`       | POST (XHR)      | ❌           | Upload with progress callback |

All requests include `credentials: 'include'` (cookies for JWT).

### Route Handler Pattern

Backend routes follow a consistent pattern ([example:](/src/server/routes/wiki.routes.ts) [`wiki.routes.ts`](/src/server/routes/wiki.routes.ts)):

```typescript
const router = Router();

router.get('/', async (req: AuthenticatedRequest, res) => {
  // 1. Extract & validate params
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  // 2. Build where clause (using visibility helpers)
  const where = { ...buildWikiVisibilityWhere(req.authUser), ... };

  // 3. Query via Prisma (or $queryRaw for complex queries)
  const [pages, total] = await Promise.all([
    prisma.wikiPage.findMany({ where, ... }),
    prisma.wikiPage.count({ where }),
  ]);

  // 4. Serialize using response transformers
  res.json({ items: pages.map(toWikiResponse), total, page, limit });
});
```

Route registration uses **factory functions**: `registerXxxRoutes(app)` called from `server.ts`.

### Server Utils Barrel Import

Backend route handlers import from the **barrel export** at [`src/server/utils/index.ts`](/src/server/utils/index.ts):

```typescript
import { prisma, toWikiResponse, buildWikiVisibilityWhere, ... } from '../utils';
```

This single entry point re-exports from 13 sub-modules. **Do not bypass it** by importing sub-modules directly unless you have a specific reason.

***

## 7. Key Architectural Decisions

### 7.1 Monorepo-Style Single Package (Vite + Express)

The project is NOT a separate frontend/backend repo. `server.ts` runs Express, which:

- In **dev**: injects Vite's middleware (HMR, on-demand transformation)
- In **production**: serves pre-built `dist/` static files with SPA fallback

**Implication:** Frontend and backend share `src/lib/`, `src/types/`, and the same TSConfig. Changes to shared types affect both sides.

### 7.2 Wiki Branch/PR Collaboration Model

Wiki pages support a **Git-like workflow**:

- `WikiBranch` — per-user editing branch (one branch per user per page)
- `WikiRevision` — autosave + manual snapshots on a branch
- `WikiPullRequest` — propose merge from branch to main page
- Conflict detection and resolution via `conflictData` JSON field

**Key files:** `wikiBranchAccess.ts`, `wikiTitleKey.ts`, `wiki.routes.ts` (PR endpoints)

### 7.3 Triple Storage Strategy

Images use a three-tier storage system ([`ImageMap`](/prisma/schema.prisma) model):

1. **Local** — default, stored in `uploads/` directory
2. **S3** — Bitiful (S3-compatible), configurable via `S3_*` env vars
3. **External** — Superbed or Lsky Pro+ image hosting

`resolveUploadPathByStorageKey()` in `upload.ts` resolves the active URL based on `SiteConfig`. The `SmartImage` component handles automatic fallback.

### 7.4 Vector Search Pipeline (CLIP + Qdrant)

- **Model:** `Xenova/clip-vit-base-patch32` via `@huggingface/transformers` (browser + Node.js)
- **Vector DB:** Qdrant REST client (`@qdrant/js-client-rest`)
- **Embedding targets:** Gallery images (`ImageEmbedding`), Wiki page images (`WikiImageEmbedding`), Post images (`PostImageEmbedding`)
- **Sync modes:** Full sync (`embeddings:sync`) or enqueue-only (`embeddings:enqueue`)

### 7.5 Multi-Platform Music Aggregation

Music tracks can have IDs across 5 platforms simultaneously:
`neteaseId`, `tencentId`, `kugouId`, `baiduId`, `kuwoId`

Playback URL resolution tries platforms in priority order with TTL caching. Custom platform links are also supported.

### 7.6 Request Deduplication + SWR Cache

[`src/utils/requestDedup.ts`](/src/utils/requestDedup.ts) provides:

- **GET request deduplication** — concurrent identical requests are coalesced
- **SWR-style stale-while-revalidate** with configurable `staleTime` (default 30s)
- **Cache invalidation** by key prefix (used after mutations)
- **Preloading** for predicted navigation targets

### 7.7 Auth Architecture

- **JWT-based** with httpOnly cookies (not localStorage tokens)
- **Role hierarchy:** `user` < `admin` < `super_admin`
- **Middleware chain:** `authMiddleware` (attach user to req) → route-level guards (`requireAuth`, `requireAdmin`, `requireActiveUser`)
- **WeChat Mini Program** login via `wechatOpenId`/`wechatUnionId` with mock mode for development
- **AuthenticatedRequest** type extends Express `Request` with `authUser?: ApiUser`

***

## 8. Environment Variables

All documented in [`.env.example`](/.env.example) (157 lines). Key categories:

| Category          | Prefix                                         | Examples                        |
| ----------------- | ---------------------------------------------- | ------------------------------- |
| **Database**      | `DATABASE_URL`                                 | PostgreSQL connection string    |
| **Auth**          | `JWT_SECRET`, `SEED_*`                         | JWT signing, seed account       |
| **Vector Search** | `QDRANT_*`, `IMAGE_EMBEDDING_*`                | Qdrant connection, CLIP config  |
| **Storage**       | `UPLOADS_PATH`, `S3_*`, `SUPERBED_*`, `LSKY_*` | Triple storage config           |
| **Maps**          | `AMAP_*`, `VITE_AMAP_*`                        | Amap (高德) geocoding + JS API    |
| **AI**            | `VITE_GEMINI_API_KEY`                          | Gemini API for AI features      |
| **WeChat**        | `WECHAT_MP_*`                                  | Mini program auth               |
| **Variants**      | `VARIANT_*`                                    | Image variant generation tuning |
| **Disk Monitor**  | `DISK_*`, `UPLOAD_MIN_FREE_SPACE_MB`           | Disk space thresholds           |
| **Cloud Sync**    | `CLOUD_SYNC_*`                                 | External storage sync tuning    |

**Critical:** `VITE_` prefixed vars are bundled into frontend code — **never put secrets there**.

***

## 9. Testing Patterns

### Unit Tests (`tests/unit/`)

- **Framework:** Vitest with jsdom (UI) / node (pure logic) environment split
- **Setup:** `tests/unit/setup.ts`
- **47 test files** covering: lib/ utilities, server/utils/ modules, server services, vector pipeline
- **Coverage thresholds enforced in CI** (lines ≥25%, functions ≥40%, branches ≥70%)
- **Excluded from coverage:** route files, middleware, barrel exports (better suited for integration tests)

### Integration Tests (`tests/integration/`)

- **4 test files:** users, posts, wiki, auth
- **Requires running PostgreSQL** — CI spins up `postgres:16-alpine` as a service container
- **Separate config:** `vitest.integration.config.ts`

### Test Database

- Use `npm run test:db:init` / `npm run test:db:reset` for isolated test DB
- Or override `DATABASE_URL` in `.env.test`
- Tests assume clean database state

***

## 10. Before You Change Things

### Adding a new feature

1. **Check if a test exists** for the area you're touching under `tests/unit/`
2. **If no test exists, write one first** — even a minimal smoke test
3. Follow the existing route/handler pattern in `src/server/routes/`
4. Add new business logic to the appropriate `src/server/utils/` sub-module
5. Export from `src/server/utils/index.ts` barrel if used by routes
6. For new frontend pages: add lazy-loaded route in `App.tsx`, create page in `src/pages/`

### Modifying the database schema

1. Edit `prisma/schema.prisma`
2. Run `npm run db:migrate` (dev) or `npm run db:deploy` (prod)
3. Run `npm run db:generate` to regenerate Prisma Client
4. Run `npm run validate:migrations` to verify migration integrity
5. Update `src/server/types/index.ts` if new enums/types affect server types
6. Update `src/types/` if frontend-facing types change

### Modifying shared code (src/lib/, src/types/)

**These modules are imported by BOTH frontend and backend.** Changes propagate to both sides:

- `src/lib/apiClient.ts` — frontend HTTP layer
- `src/lib/errorHandler.ts` — error hierarchy used everywhere
- `src/types/common.ts` — shared union types
- Any change here may require re-verifying both `npm run lint` and `npm run test:unit`

### Working with API endpoints

1. **Frontend:** use `apiGet/apiPost/etc.` from `src/lib/apiClient.ts`
2. **Backend:** add route handler following existing patterns, import from `'../utils'` barrel
3. **Types:** define request/response in `src/types/api.ts` (frontend) and `src/server/types/index.ts` (backend)
4. **After adding/modifying an endpoint:** verify the frontend caller is updated per the user rule: *如果后端接口发生了变化，更新对应的前端代码*

***

## 11. CI Verification — Mandatory Before Delivery

After completing code changes, you **must** run the full local verification suite:

### Step-by-step local pre-validation

```bash
# 1. Type check (lint)
npm run lint
# Expected: Exit code 0, 0 TypeScript errors

# 2. Unit tests
npm run test:unit
# Expected: Exit code 0, 0 failed tests

# 3. Build
npm run build
# Expected: Exit code 0, dist/ directory produced
```

**Do not deliver changes until all three checks report success.**

### Success Criteria Summary

| Job        | Command        | Success Standard              |
| ---------- | -------------- | ----------------------------- |
| Lint       | `tsc --noEmit` | Exit code 0, 0 errors         |
| Unit Tests | `vitest run`   | Exit code 0, 0 failed tests   |
| Build      | `vite build`   | Exit code 0, `dist/` produced |

### Coverage Gates (CI-enforced)

| Metric     | Minimum |
| ---------- | ------- |
| Lines      | 25%     |
| Statements | 25%     |
| Functions  | 40%     |
| Branches   | 70%     |

***

## 12. Known Constraints & Gotchas

### Build Output

- Production files use `v5-` prefix in asset names: `assets/v5-[name]-[hash].js`
- Manual chunk splitting: React ecosystem → `vendor-react`, other node\_modules → `vendor`, pages split individually
- Terser minification strips `console.log`/`console.info` in production
- Circular dependency warnings are suppressed in Rollup (intentional — dynamic imports create false positives)

### Service Worker

- Cache name: `huangshifu-wiki-v31` (in [`public/sw.js`](/public/sw.js))
- **Bump the cache name when UI/assets change** to force cache invalidation
- Caches only app shell (`/`, `/index.html`, `/manifest.json`)

### HMR

- Vite HMR enabled by default; disable with `DISABLE_HMR=true`

### Generated Artifacts to Exclude from Commits

- `dist/` — build output
- `coverage/` — test coverage reports
- `node_modules/.prisma/` — generated Prisma Client
- `uploads/` — user-uploaded files
- `backups/` — database backups
- `models/transformers/` — cached ML models

### Request Timeout

- Global Express timeout: **30 seconds** (`server.ts` line 142-149)
- Long-running operations (backups, embedding sync) must handle their own timeouts (e.g., via `AbortSignal`)

### File Upload Limits

- Express body parser: **1MB** for JSON/urlencoded
- Multer (image upload): **20MB** per file
- Allowed extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`

***

## 13. Refactoring Sync Summary

This AGENTS.md was generated from a complete codebase analysis after significant refactoring.

### Major sections added vs. previous version

| Section                         | Status      | Notes                                                                                                                                                                        |
| ------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project Identity**            | 🆕 NEW      | Full domain model description, tech stack inventory                                                                                                                          |
| **Architecture Overview**       | 🆕 NEW      | ASCII dependency graph, layer responsibilities table                                                                                                                         |
| **Directory Layout**            | ✏️ EXPANDED | Complete 3-level tree with file count annotations (was shallow)                                                                                                              |
| **Coding Conventions**          | ✏️ EXPANDED | Prettier rules, TSconfig details, naming table, import order, error handling pattern, state management, API client protocol, route handler pattern, barrel import convention |
| **Key Architectural Decisions** | 🆕 NEW      | 7 major decisions documented (monorepo style, wiki branching, triple storage, vector search, music aggregation, request dedup, auth architecture)                            |
| **Environment Variables**       | ✏️ EXPANDED | Categorized table with security warning about VITE\_ prefix                                                                                                                  |
| **Testing Patterns**            | 🆕 NEW      | Unit/integration split, coverage thresholds, test DB setup                                                                                                                   |
| **CI Pipeline Details**         | ✏️ EXPANDED | Full 5-job dependency graph, coverage gates, build size threshold                                                                                                            |
| **Known Constraints**           | 🆕 NEW      | Service Worker, HMR, upload limits, request timeout, artifacts exclusion list                                                                                                |
| **Before You Change Things**    | 🆕 NEW      | Decision tree for features / DB schema / shared code / API changes                                                                                                           |

<br />

