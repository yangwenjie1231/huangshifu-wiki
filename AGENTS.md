# AGENTS.md

Guidance for agentic coding assistants working in this repository.

## Project Overview

- Frontend: React 19 + TypeScript + Vite 6.
- Styling: Tailwind CSS 4.
- Server/dev entrypoint: `server.ts` (Express + Vite middleware in dev).
- Data/auth: Firebase Auth + Firestore.
- AI integration: Gemini (`@google/genai`).
- Package manager: npm (`package-lock.json` is present).

## Source of Truth for Commands

Always prefer `package.json` scripts when available.

## Build / Lint / Test Commands

Run all commands from repo root.

### Install

- `npm install`

### Local Development

- `npm run dev`
- Starts `tsx server.ts`.
- The Express server serves API routes and Vite middleware in non-production.

### Build

- `npm run build`
- Produces production assets via Vite into `dist/`.

### Preview Production Build

- `npm run preview`

### Lint / Static Checks

- `npm run lint`
- Current lint command is type-check only: `tsc --noEmit`.

### Clean Output

- `npm run clean`

### Tests (Current State)

- There is no configured test runner right now.
- No `test` script exists in `package.json`.
- No test files (`*.test.*`, `*.spec.*`) were found.

## Running a Single Test (Important)

At this moment, single-test execution is not possible because tests are not configured.

When asked to run one test, report this clearly and run `npm run lint` as the nearest available validation.

If a test framework is later added, use these patterns:

- Vitest single file: `npx vitest run path/to/file.test.ts`
- Vitest single test name: `npx vitest run path/to/file.test.ts -t "name"`
- Jest single file: `npx jest path/to/file.test.ts`
- Jest single test name: `npx jest path/to/file.test.ts -t "name"`

Do not claim these commands work until corresponding dependencies/scripts exist.

## Environment and Runtime Notes

- Required local secret from README: `GEMINI_API_KEY` in `.env.local`.
- `vite.config.ts` injects `process.env.GEMINI_API_KEY` via `define`.
- `vite.config.ts` also gates HMR by `DISABLE_HMR`.
- Keep existing env behavior unless explicitly asked to change it.

## Cursor and Copilot Rules Check

Checked repository for additional agent rule files:

- `.cursorrules`: not found.
- `.cursor/rules/`: not found.
- `.github/copilot-instructions.md`: not found.

If any of these files appear later, treat them as high-priority instructions and update this document.

## Code Style and Engineering Guidelines

### 1) General Change Strategy

- Follow existing patterns in the file you are editing.
- Keep diffs focused on the requested outcome.
- Avoid unrelated refactors.
- Preserve existing user-facing language style (Chinese copy in many UI paths).

### 2) Imports

- Prefer grouped ordering:
  - third-party packages,
  - internal alias imports,
  - relative imports,
  - side-effect imports (e.g., CSS) last.
- Remove unused imports.
- Prefer named imports over namespace imports unless namespace is clearer.
- Alias `@` is configured; use it consistently if the target file already uses it.

### 3) Formatting

- Keep semicolons (project convention).
- Match quote style already used in the file.
- Wrap long JSX props for readability.
- Keep trailing commas and spacing consistent with surrounding code.
- Do not introduce formatting churn in untouched lines.

### 4) Types

- Prefer explicit interfaces/types for props and shared data shapes.
- Avoid adding new `any`.
- Use `unknown` when type is truly uncertain, then narrow.
- Keep nullable state explicit (`T | null`).
- Add return types for exported helpers where helpful.

### 5) Naming

- Components, contexts, types: `PascalCase`.
- Functions, hooks, variables: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` when truly constant.
- Keep route and Firestore identifiers aligned with existing lowercase patterns.

### 6) React and State

- Prefer functional components and hooks.
- Keep async state transitions explicit (`loading`, `error`, `data`).
- Guard against null/undefined during async fetches.
- Use context only for shared cross-page state (auth/music patterns already exist).

### 7) Error Handling

- Wrap network/Firebase operations in `try/catch`.
- Log actionable details with `console.error`.
- Show safe, concise user-facing failures (no stack dumps in UI).
- Preserve existing fallback behavior (e.g., `ErrorBoundary` patterns).
- Never silently swallow important failures.

### 8) Firestore / Auth Conventions

- Keep document/collection paths explicit.
- Preserve permission checks (`isAdmin`, role checks, etc.).
- Use `serverTimestamp()` for write metadata where already used.
- Keep write payload keys stable (`updatedAt`, editor identifiers, etc.).

### 9) Markdown / Content Rendering

- Preserve wiki internal-link conversion conventions (`[[slug]]`, `[[title|slug]]`).
- Maintain safe handling of external links (`target="_blank"`, `rel` attrs).
- Validate Markdown rendering behavior when changing parser/renderer code.

### 10) Styling

- Tailwind utilities are the primary styling mechanism.
- Reuse existing design tokens/classes (`brand-*`, rounded card motifs, serif headings).
- Preserve responsive behavior across `sm`, `md`, and `lg` breakpoints.

## Minimal Verification Checklist for Agents

- Run `npm run lint` after code changes.
- Run `npm run build` when changing build/runtime-sensitive code.
- If no tests exist, state that explicitly in the handoff.
- Do not invent command output or test results.
