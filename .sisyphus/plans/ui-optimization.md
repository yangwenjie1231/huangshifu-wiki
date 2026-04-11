# UI Optimization Plan for the Frontend Shell and Core Views

## TL;DR
> **Summary**: Optimize the React/Vite frontend UI across the global shell, homepage, and key content pages with a responsive-first, accessibility-aware refresh.
> **Deliverables**:
> - Cleaner global navigation and shell behavior on desktop/mobile
> - Stronger visual hierarchy and loading/empty states on the homepage and core pages
> - Consistent shared UI patterns across wiki/forum/music/gallery/search/profile/admin
> - TDD-backed verification with updated unit tests and browser smoke coverage
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: Design foundation → shell/navigation → homepage → shared page patterns → verification

## Context

### Original Request
“继续根据提示，设计UI优化方案”

### Interview Summary
- Scope confirmed: full UI optimization, desktop + mobile.
- Priority confirmed: visual hierarchy, interaction/motion, and performance together.
- Verification confirmed: TDD.

### Metis Review (gaps addressed)
- Metis consultation was attempted but timed out.
- Guardrails were self-resolved from repo evidence: focus on visible frontend surfaces only, keep backend/data changes out unless required for UI behavior, and include explicit verification because current coverage is unit-only.

## Work Objectives

### Core Objective
Make the app feel more polished, easier to navigate, and more responsive across desktop and mobile without changing product scope.

### Deliverables
- Refined responsive app shell and navigation.
- Improved homepage above-the-fold and content discovery sections.
- Standardized UI states for loading, empty, and error conditions.
- Better mobile ergonomics for bottom nav, menus, and touch targets.
- Updated tests that prove the new shell/page behavior.

### Definition of Done (verifiable conditions with commands)
- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- Browser smoke checks pass for home, nav, and one content page.

### Must Have
- Desktop and mobile both remain usable.
- No placeholder imagery or external media URLs.
- Accessible focus states and keyboard navigation.
- Consistent spacing, typography, and button hierarchy.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No backend/API/schema changes unless needed for a UI state.
- No new visual system that conflicts with existing brand palette.
- No placeholder assets or lorem ipsum copy.
- No motion that ignores reduced-motion preferences.
- No “pretty only” redesign without test coverage.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **TDD** + Vitest unit tests for shell/theme/page logic; add browser smoke coverage if missing.
- QA policy: every task includes agent-executed happy-path and failure/edge scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.

Wave 1: design foundation + browser verification scaffold
Wave 2: global shell/navigation + shared UI primitives
Wave 3: homepage + core content page patterns

### Dependency Matrix (full, all tasks)
- Task 1 blocks Tasks 2-5.
- Task 2 blocks Tasks 3-4.
- Task 3 blocks Task 4 where shared page patterns are extracted.
- Task 5 can run after Task 1 and in parallel with Tasks 2-4 once the test harness is stable.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 2 tasks → `quick`, `unspecified-high`
- Wave 2 → 2 tasks → `visual-engineering`, `quick`
- Wave 3 → 2 tasks → `visual-engineering`, `quick`

## TODOs

> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Establish UI foundation and verification baseline

  **What to do**: Define the responsive spacing/typography/motion baseline, tighten global theme helpers, and add/restore browser smoke coverage so later UI changes are validated against real navigation flows.
  **Must NOT do**: Do not redesign individual pages yet; do not change backend behavior.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused foundation work with small code surface.
  - Skills: [] - no special skill required.
  - Omitted: `frontend-dev` - this is a repo-specific planning task, not asset/copy generation.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2-5 | Blocked By: none

  **References**:
  - Pattern: `src/main.tsx:20-26` - initial theme application and document title behavior.
  - Pattern: `src/lib/theme.ts` - theme resolution/search helpers used across routes.
  - Pattern: `src/index.css` - global layout and shared style baseline.
  - Test: `tests/unit/theme.test.ts` - existing theme helper coverage.
  - Test: `tests/unit/apiClient.test.ts` - Vitest setup style to follow.

  **Acceptance Criteria**:
  - [ ] Theme/responsive baseline is encoded in shared styles/helpers instead of duplicated per page.
  - [ ] Browser smoke coverage exists for home and nav visibility on at least one mobile and one desktop viewport.
  - [ ] `npm test` and `npm run lint` pass after the changes.

  **QA Scenarios**:
  ```
  Scenario: theme baseline and smoke coverage
    Tool: Bash
    Steps: Run `npm test` then `npm run lint`.
    Expected: Both commands exit 0.
    Evidence: .sisyphus/evidence/task-1-foundation.log

  Scenario: smoke test catches bad routing state
    Tool: Playwright
    Steps: Open `/`, verify `getByRole('navigation')` is visible, then navigate to `/wiki` and confirm the nav remains present.
    Expected: Navigation persists and no blank shell appears.
    Evidence: .sisyphus/evidence/task-1-smoke.png
  ```

  **Commit**: NO | Message: `fix(ui): stabilize shared UI baseline` | Files: `src/index.css`, `src/lib/theme.ts`, `tests/unit/theme.test.ts`, browser smoke files if added

- [ ] 2. Rework the global shell and navigation

  **What to do**: Improve `App.tsx`, `Navbar.tsx`, `BottomNav.tsx`, `AnnouncementBar.tsx`, and `GlobalMusicPlayer.tsx` so the shell is cleaner, less crowded, and easier to use on small screens. Keep the desktop nav concise and the mobile nav thumb-friendly.
  **Must NOT do**: Do not add new routes or rewrite auth logic.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: this is the primary visible shell redesign.
  - Skills: [`frontend-dev`] - Reason: helps with responsive hierarchy and motion decisions.
  - Omitted: `fullstack-dev` - no backend integration required.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 3-4 | Blocked By: 1

  **References**:
  - Pattern: `src/App.tsx:90-182` - shell composition, padding around global player, footer.
  - Pattern: `src/components/Navbar.tsx:252-763` - desktop nav, mobile menu, notifications, auth modal.
  - Pattern: `src/components/BottomNav.tsx:11-80` - mobile primary navigation.
  - Pattern: `src/components/AnnouncementBar.tsx` - top announcement surface.
  - Pattern: `src/components/GlobalMusicPlayer.tsx` - persistent bottom chrome.

  **Acceptance Criteria**:
  - [ ] Desktop header has a clearer hierarchy and fewer competing actions.
  - [ ] Mobile navigation remains reachable and thumb-friendly with safe-area support.
  - [ ] Global player/footer spacing no longer overlaps content on short viewports.
  - [ ] `npm run build` passes after shell changes.

  **QA Scenarios**:
  ```
  Scenario: desktop shell interaction
    Tool: Playwright
    Steps: Visit `/`, open the notification panel from the bell icon, then close it by clicking outside.
    Expected: Panel opens and closes cleanly without layout shift.
    Evidence: .sisyphus/evidence/task-2-shell-desktop.png

  Scenario: mobile nav usability
    Tool: Playwright
    Steps: Set viewport to 390x844, open the bottom nav, tap `百科`, then confirm the route changes and the nav stays fixed.
    Expected: Route changes successfully and bottom nav remains anchored.
    Evidence: .sisyphus/evidence/task-2-shell-mobile.png
  ```

  **Commit**: NO | Message: `feat(ui): streamline global shell navigation` | Files: `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/BottomNav.tsx`, `src/components/AnnouncementBar.tsx`, `src/components/GlobalMusicPlayer.tsx`

- [ ] 3. Redesign the homepage information hierarchy

  **What to do**: Rework `src/pages/Home.tsx` into a clearer landing experience: stronger hero hierarchy, tighter CTA structure, better section grouping, and explicit loading/empty states for feed data.
  **Must NOT do**: Do not change the underlying feed API contract.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: homepage hierarchy and hero treatment are visually heavy.
  - Skills: [`frontend-dev`] - Reason: supports copy hierarchy and responsive layout polish.
  - Omitted: `fullstack-dev` - backend feed data stays unchanged.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 4 | Blocked By: 1-2

  **References**:
  - Pattern: `src/pages/Home.tsx:141-397` - current hero, category cards, feed lists, and CTA columns.
  - Pattern: `src/pages/Home.tsx:314-361` - loading and empty states to improve.
  - Pattern: `src/pages/Home.tsx:252-297` - hot post cards.

  **Acceptance Criteria**:
  - [ ] Hero, categories, and content lists read as one coherent hierarchy on desktop and mobile.
  - [ ] Loading and empty states are explicit and visually consistent.
  - [ ] Key CTAs are obvious above the fold and after the first content block.
  - [ ] `npm test` passes with homepage-related coverage updates.

  **QA Scenarios**:
  ```
  Scenario: homepage happy path
    Tool: Playwright
    Steps: Visit `/`, verify the hero CTA `进入百科` is visible, then click it.
    Expected: User lands on `/wiki` (themed route preserved if applicable).
    Evidence: .sisyphus/evidence/task-3-home-happy.png

  Scenario: homepage empty-feed state
    Tool: Playwright
    Steps: Stub `/api/home/feed` to return empty lists, reload `/`, and inspect the community section.
    Expected: A deliberate empty state appears instead of a broken blank area.
    Evidence: .sisyphus/evidence/task-3-home-empty.png
  ```

  **Commit**: NO | Message: `feat(ui): refine homepage hierarchy` | Files: `src/pages/Home.tsx`, homepage tests

- [ ] 4. Standardize the core content page shells

  **What to do**: Normalize the layout, section headers, list spacing, and responsive cards across `Wiki`, `Forum`, `Music`, `Gallery`, `Search`, `Profile`, and `Admin`, extracting shared page-shell patterns only where they reduce duplication.
  **Must NOT do**: Do not homogenize away page-specific personality; keep each section's unique content model.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: mainly pattern unification and repeated UI cleanup.
  - Skills: [`frontend-dev`] - Reason: improves consistent page composition and states.
  - Omitted: `fullstack-dev` - no backend feature work required.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: none | Blocked By: 1-2

  **References**:
  - Pattern: `src/pages/Wiki.tsx` - content-heavy article/list page.
  - Pattern: `src/pages/Forum.tsx` - feed/discussion shell.
  - Pattern: `src/pages/Music.tsx` - media-centric page with player interactions.
  - Pattern: `src/pages/Gallery.tsx` and `src/pages/Search.tsx` - discovery/listing shells.
  - Pattern: `src/pages/Profile.tsx` and `src/pages/Admin.tsx` - account/admin surfaces.

  **Acceptance Criteria**:
  - [ ] Section headers, spacing, and list/card treatments feel consistent across content pages.
  - [ ] Shared empty/loading/error states are reusable instead of copy-pasted.
  - [ ] Mobile layouts collapse cleanly without horizontal overflow.
  - [ ] `npm run build` passes after the page shell updates.

  **QA Scenarios**:
  ```
  Scenario: wiki-to-forum parity check
    Tool: Playwright
    Steps: Visit `/wiki` and `/forum`, compare header placement, list spacing, and CTA affordance.
    Expected: Shared shell behavior feels consistent while content remains distinct.
    Evidence: .sisyphus/evidence/task-4-content-parity.png

  Scenario: narrow viewport overflow guard
    Tool: Playwright
    Steps: Set viewport to 375x812 and navigate through `/music`, `/gallery`, and `/search`.
    Expected: No horizontal scrolling or clipped primary controls.
    Evidence: .sisyphus/evidence/task-4-mobile-overflow.png
  ```

  **Commit**: NO | Message: `refactor(ui): normalize core content shells` | Files: `src/pages/Wiki.tsx`, `src/pages/Forum.tsx`, `src/pages/Music.tsx`, `src/pages/Gallery.tsx`, `src/pages/Search.tsx`, `src/pages/Profile.tsx`, `src/pages/Admin.tsx`

- [ ] 5. Add UI-focused regression tests and final QA sweep

  **What to do**: Expand Vitest coverage for the changed shared helpers/components and add browser smoke checks for the nav + homepage flows introduced above. Confirm reduced-motion and mobile behavior remain intact.
  **Must NOT do**: Do not add flaky pixel tests or overfit assertions to implementation details.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused verification work with small, targeted changes.
  - Skills: [] - no special skill required.
  - Omitted: `frontend-dev` - the task is test-first verification, not new design work.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: none | Blocked By: 1-4

  **References**:
  - Test: `tests/unit/theme.test.ts` - existing style for unit assertions.
  - Test: `tests/unit/auth.test.ts` - example of behavior-driven Vitest coverage.
  - Test: `tests/unit/apiClient.test.ts` - example of mock/stub style.
  - Pattern: `src/components/Navbar.tsx` and `src/pages/Home.tsx` - primary UI surfaces to cover.

  **Acceptance Criteria**:
  - [ ] Unit tests cover the key shared helpers/components touched by the UI changes.
  - [ ] Browser smoke coverage verifies the shell and homepage critical flows.
  - [ ] `npm test`, `npm run lint`, and `npm run build` all pass.
  - [ ] Reduced-motion and mobile viewport checks are explicitly exercised.

  **QA Scenarios**:
  ```
  Scenario: regression test suite
    Tool: Bash
    Steps: Run `npm test && npm run lint && npm run build`.
    Expected: All commands exit 0.
    Evidence: .sisyphus/evidence/task-5-regression.log

  Scenario: motion/accessibility smoke
    Tool: Playwright
    Steps: Set reduced-motion emulation on, load `/`, open the mobile menu, then close it with Escape.
    Expected: Animations do not overwhelm the interface and keyboard dismissal works.
    Evidence: .sisyphus/evidence/task-5-accessibility.png
  ```

  **Commit**: NO | Message: `test(ui): add UI regression coverage` | Files: `tests/unit/*`, browser smoke files if added

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- No commit is required for the planning artifact itself.
- Execution commits should stay task-local and match the touched surface.

## Success Criteria
- The shell feels simpler and more intentional on desktop and mobile.
- The homepage clearly drives users into wiki/forum/music/gallery flows.
- Core content pages share a recognizable structure without becoming generic.
- Tests and browser QA prove the new UI remains stable.
