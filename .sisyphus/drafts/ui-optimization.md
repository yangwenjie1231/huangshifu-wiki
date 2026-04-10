# Draft: UI Optimization

## Requirements (confirmed)
- "继续根据提示，设计UI优化方案"

## Technical Decisions
- Main app shell is `src/App.tsx` with global `Navbar`, `BottomNav`, `AnnouncementBar`, `GlobalMusicPlayer`, and route-level pages.
- High-traffic UI pages include `src/pages/Home.tsx`, `src/pages/Wiki.tsx`, `src/pages/Forum.tsx`, `src/pages/Music.tsx`, `src/pages/Gallery.tsx`, `src/pages/Search.tsx`, `src/pages/Profile.tsx`, and `src/pages/Admin.tsx`.
- Current verification coverage is unit-only under `tests/unit/`; no browser/e2e files found.

## Research Findings
- `src/App.tsx` defines the main route map and lazy-loads deep pages.
- `src/components/Navbar.tsx` contains the largest global UI surface, including desktop nav, mobile menu, auth modal, and notifications.
- `src/components/BottomNav.tsx` is the mobile primary nav.
- `src/pages/Home.tsx` is the most visually dense landing page and likely the first optimization target.
- `tests/unit/*.test.ts` exists, but no `tests/e2e`, Playwright, or browser QA files were found.

## Open Questions
- Which verification strategy should the plan assume: TDD, tests-after, or no tests?

## Scope Boundaries
- INCLUDE: UI structure, layout, styling, motion, and component ergonomics where needed.
- EXCLUDE: unrelated backend or data-model changes unless they are required for UI behavior.
