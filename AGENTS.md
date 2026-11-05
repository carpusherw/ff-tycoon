# FF Tycoon — agent guide

A browser-based freight forwarding management game, built as a side project that doubles as GoFreight marketing (the end screen offers "Book a demo").

- Design (source of truth): `docs/superpowers/specs/2026-11-03-ff-tycoon-design.md`
- Current build plan: `docs/superpowers/plans/2026-11-04-m1-playable-core.md`

## Tracking

- There is no Jira for this repo. Track work in GitHub issues, and reference them in branches (`<issue>-<topic>`), commits (`Refs #N`) and PRs (`Closes #N`).
- Never push to `main`; open a PR.

## This repo is public

- Every rival vendor, customer and candidate is fictional. Never name or mock a real forwarder or software vendor.
- Keep internal GoFreight details (customers, tickets, internal systems) out of code, docs and commits.
- Market events use generic wording ("conflict near a strait"), never real countries or sides.

## Architecture

- `src/rules/` is the game's rule engine: pure TypeScript with no React, DOM, `window` or `localStorage`. Rule functions mutate the `GameState` passed to them; the app clones the state before each change.
- Randomness only comes from the seeded RNG stored in the state (`src/rules/rng.ts`), never `Math.random()`, so runs are reproducible in tests.
- Every tuning number lives in `src/rules/balance.ts`.
- Front end only: progress is saved in `localStorage`, and every storage access is wrapped in `try/catch`.

## Words

Use these terms in code and copy: **task** (never "job", except the hiring "job ad"), **workload**, **speed**, **capacity**, **minimum duration**, **origin**, **destination**.

## UI rules

- All player-facing text goes through `t()`. English (`en`) is the source of keys; Traditional (`zh-Hant`) and Simplified (`zh-Hans`) Chinese must have every key.
- Follow the browser's light/dark setting (fall back to light) and use the CSS color tokens, never hard-coded colors.
- Laptop first, but no horizontal scroll at 375 px wide.

## Commands

```
npm test           # unit tests (Vitest)
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
npm run e2e        # Playwright end-to-end checks
```

Run `npm test` and `npm run typecheck` before every commit. Never skip hooks with `--no-verify`.
