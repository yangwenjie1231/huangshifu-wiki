# AGENTS.md
---

**Strong success criteria let you close the loop independently. Weak criteria (“make it work”) require constant clarification.**

---

## Project‑specific instructions

### Source of truth
- Trust `package.json`, `vite.config.ts`, `vitest.config.ts`, `prisma/schema.prisma`, `.env.example`, `.github/workflows/ci.yml`, and `server.ts` over README prose when they conflict.
- The app is a Vite + Express + Prisma project; the runtime entrypoint is `server.ts`.

### Commands
- `npm run dev` → `tsx server.ts`
- `npm run lint` → `tsc --noEmit`
- `npm run test` / `npm run test:unit` → `vitest run`
- `npm run test:coverage` → `vitest run --coverage`
- `npm run test:integration` → `vitest run --config vitest.integration.config.ts`
- `npm run build` → `vite build`
- `npm run check:build` → 验证构建产物大小和完整性
- `npm run validate:migrations` → 验证 Prisma 迁移文件
- CI runs parallel jobs: `lint` + `test-unit` + `test-integration` → `build`.
- `npm run clean` uses `rd /s /q dist`.

### Setup (one‑time)
- Run `prisma generate` (or `npm run db:generate` if defined) to create the Prisma Client.
- Run `prisma migrate dev` to set up your database schema.
- For tests, either configure a separate test database (e.g., override `DATABASE_URL` in a `.env.test` file) or use a mock. The test suite assumes a clean database state.

### Layout that matters
- `server.ts` wires Express routes and serves Vite in dev / `dist/` in production.
- `src/server/` holds backend routes, middleware, and Prisma access.
- `src/lib/apiClient.ts` is the shared API client; prefer its exported helpers instead of ad‑hoc `fetch` calls.
- `src/hooks/useApi.ts` is the standard React‑side API state helper.
- `src/main.tsx` is the React entrypoint; `src/App.tsx` is the top‑level app shell.
- Unit tests live under `tests/unit/**/*.test.ts`.
- Integration tests live under `tests/integration/**/*.test.ts`.
- `public/sw.js` caches the app shell; bump the cache name when UI/assets change.

### Repo‑specific conventions
- Database is PostgreSQL via Prisma (`provider = "postgresql"`); use `DATABASE_URL` from `.env.example`.
- Vite HMR can be disabled with `DISABLE_HMR=true`.
- The local upload / media / embedding scripts (npm scripts) are:  
  - `npm run embeddings:sync`  
  - `npm run embeddings:enqueue`  
  - `npm run regions:import`

### Before changing or verifying work
- Check the closest test file under `tests/unit/` for the expected pattern.  
  **If no test file exists for the area you're changing, write a minimal test first.**
- If you touch backend or shared logic, run the narrowest relevant test command first, then `lint`, then `test:coverage` if the change is broad.
- Keep generated artifacts out of commits: `dist/`, `coverage/`, Prisma client output, uploads, and backup archives.

### CI verification — mandatory before delivery
After completing code changes, you **must** run the full local verification suite to ensure all three parallel GitHub CI jobs pass:

1. **Lint** (`npm run lint` → `tsc --noEmit`) — zero TypeScript errors. All code must conform to project type definitions.
2. **Unit tests** (`npm run test:unit` → `vitest run`) — all test cases must pass with zero failures. If any pre-existing test failure is discovered during verification, it must be fixed as part of the current change set.
3. **Build** (`npm run build` → `vite build`) — must complete successfully and produce valid output in `dist/`.

**Local pre-validation** is required before considering work done. Run each of the three commands above in sequence. Record the results (pass/fail counts for tests, error count for lint). Do not deliver changes until all three checks report success.

**CI environment validation** is the final gate. The `.github/workflows/ci.yml` pipeline runs `lint`, `test-unit`, and `build` jobs in parallel. A change is only considered complete when the CI workflow shows green across all three jobs.

**Success criteria summary**:
| Job | Command | Success Standard |
|-----|---------|-----------------|
| Lint | `tsc --noEmit` | Exit code 0, 0 errors |
| Unit Tests | `vitest run` | Exit code 0, 0 failed tests |
| Build | `vite build` | Exit code 0, `dist/` produced |

---

This version addresses:
- Clarifying the "loop independently" phrasing.
- Adding explicit Prisma setup and migration steps.
- Reminding about test database isolation.
- Specifying that the embedding scripts are `npm run` commands.
- Instructing to write a test if none exists.
- Mandating full CI verification (lint + unit tests + build) with documented success standards before delivery.