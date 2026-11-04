# Milestone 1 — Playable Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A complete, deployable 10-year run with one office: the Sales → Ops → Accounting task loop with capacity and minimum durations, export and import shipments through starter agents, ships on a world map, gacha hiring, salaries, cash flow, loans and bankruptcy, a company-value end screen with the "Book a demo" button, three languages, light/dark themes, browser save, and GitHub Pages hosting.

**Architecture:** The game rules are a pure TypeScript simulation in `src/sim/`, with no React and no DOM. All state is one serializable `GameState` object. Sim functions **mutate the state passed to them in place**, and randomness comes from a seeded RNG stored inside the state, so every run is reproducible in tests. The React app in `src/app/` and `src/ui/` holds that state in a small store. Each change clones the state, runs a sim function on the clone, and swaps it in. A clock turns real time into in-game days.

**Tech Stack:** Node 24, npm, React 19.3.1, TypeScript 7.0.2, Vite 8.3.5, @vitejs/plugin-react 6.2.1, Vitest 5.0.5, jsdom 30.1.3, @testing-library/react 16.3.3, @testing-library/user-event 14.6.8, @testing-library/jest-dom 7.0.1, @playwright/test 1.64.1. Pin these exact versions (no `^`).

**Spec:** `docs/superpowers/specs/2026-11-03-ff-tycoon-design.md`. Read it before starting. This plan implements the parts listed under "In scope" below and argues from the spec's labels: **(owner)** items are fixed, and the rest may be tuned.

**Tracking:** GitHub issue #3. End every commit message with `Refs #3`. There's no Jira key for this repo.

---

## Scope

**In scope (Milestone 1):**
- Spec §3 constraints.
- §4 run: setup with home city, owner only, starter agents, 10 years, end.
- §5 core loop: tasks, workload, speed, capacity, minimum duration, origin/destination, chain, billing, missed deadlines. Core departments only.
- §7 win chance, with the rough-rate factor only (there's no Pricing department yet, which is exactly the spec's "before it's opened" rule).
- §8 staff, hiring, growth and raises.
- §9 satisfaction, without the rival-promotion event.
- §10 coverage rule with starter agents.
- §14 money and loans.
- §15 scoring and end screens.
- §16 screens, with auto-pause for the M1 reasons.
- Normal mode only. The `mode` field exists for later.

**Later milestones (separate plans, not built here):**
- **M2 Specialist departments:** Pricing (good/rough rate factor), Customer Service (inquiries go to Ops before CS is opened), Customs (revenue unlock), department setup fees.
- **M3 Software & upgrades:** established vendors, GoFreight FMS/RMS/AI/portal, the per-office monthly pricing, capacity and speed effects, the FMS + RMS combo, GoFreight's mid-run launch, switching costs, one-time upgrades (to be brainstormed with the owner first).
- **M4 Expansion:** signing agents, opening offices (own departments, local hiring pools, local sales, local-charge billing), agent handling tasks, office switching, company overview, office/agent coexistence.
- **M5 Market events & modes:** event system and news ticker, ships rerouting, Easy and Hardcore (including the no-pause clock), the mode picker.
- **M6 Balance & polish:** tuning toward 15–20 minutes, the run story on the end screen, phone polish.

## Global Constraints

- Front end only, no server. Progress is saved in `localStorage`. Every storage read and write is wrapped in `try/catch`, and the game runs without saving if storage is unavailable.
- Hosted on GitHub Pages at `https://carpusherw.github.io/ff-tycoon/`, so Vite's `base` is `'/ff-tycoon/'`.
- React + TypeScript, no game engine. Nothing under `src/sim/` may import React, the DOM, `window` or `localStorage`.
- Laptop first, works on phone: at a 375 × 812 viewport there's no horizontal page scroll.
- Languages: English (default), Traditional Chinese (`zh-Hant`) and Simplified Chinese (`zh-Hans`). All player-facing text goes through `t()`. The default comes from the browser language, falling back to English. Proper names (fictional customers, candidates) are **not** localized.
- Themes: follow the browser's `prefers-color-scheme`, falling back to **light**. Settings have a system/light/dark switch.
- Terms used in code and copy: **task** (never "job", except the hiring "job ad"), **workload**, **speed**, **capacity**, **minimum duration**, **origin**, **destination**, **satisfaction**.
- "Book a demo with GoFreight" links to `https://gofreight.com/get-demo` (checked live on 2026-11-04), with `target="_blank" rel="noopener noreferrer"`.
- Every rival vendor and customer is fictional. Never name a real forwarder or software vendor.
- Hiring rolls cost in-game cash only. No real money exists anywhere.
- The owner is the only employee at the start, has no salary, and is the only one who can change department.
- Calendar: 30-day months and 360-day years, so a 10-year run is `3600` days. `dayMs = 290` (≈ 17.4 minutes per run at 1×).

## Review Focus

1. **Storage unavailable, corrupt, or from an older version.** The game must start (or offer a new game) without crashing, never throw at load, and never show a blank screen. Tests are in Task 12.
2. **The tab is backgrounded or the laptop sleeps.** The clock must not burst through weeks of game days when time resumes. Catch-up is capped. Tests are in Task 13.
3. **Month end with cash below zero and no loan room left.** Exactly one bankruptcy, the sim stops stepping, and the end screen shows. A second `stepDay` is a no-op. Tests are in Task 9 and Task 10.
4. **Phone width and long translated text.** No horizontal scroll at 375 px in any language. A missing translation falls back to English, never a raw key or a crash. Tests are in Task 11 and Task 18.
5. **A player action they can't afford** (job ad, re-roll, firing cost, a loan over the limit). It's rejected with a reason shown to the player, and cash never goes negative because of a player action. Tests are in Task 8 and Task 9.

---

## File Structure

```
index.html                      Vite entry
package.json, tsconfig.json, vite.config.ts, playwright.config.ts
.github/workflows/ci.yml        PR checks: typecheck, unit tests, build, e2e
.github/workflows/deploy.yml    main → GitHub Pages
src/main.tsx                    mounts <App/>
src/sim/                        pure game rules (no React/DOM)
  types.ts                      GameState and every entity type, Result, Msg
  rng.ts                        seeded RNG helpers
  ids.ts                        newId()
  balance.ts                    every tuning number (B)
  world.ts                      countries, regions, ports, sea graph, route(), transitDays()
  names.ts                      fictional company and person name lists
  newGame.ts                    createGame()
  work.ts                       assignTasks(), progressTasks()
  sales.ts                      winChance()
  satisfaction.ts               changeSatisfaction()
  chain.ts                      createTask(), onTaskCompleted(), advanceShipments()
  demand.ts                     generateRequests()
  deadlines.ts                  handleMissedDeadlines()
  staff.ts                      hiring, firing, owner moves, growth, raises
  money.ts                      monthly costs, cash flow, loans, month end, bankruptcy
  score.ts                      companyValue()
  step.ts                       stepDay()
  log.ts                        addLog()
src/i18n/                       en.ts (source of keys), zhHant.ts, zhHans.ts, index.ts, I18nProvider.tsx
src/theme/theme.ts              resolveTheme(), applyTheme()
src/app/                        persistence.ts, store.ts, clock.ts, useGameClock.ts, App.tsx
src/ui/                         styles.css, SetupScreen, GameScreen, TopBar, DepartmentBoard,
                                SidePanel, HiringDialog, EndScreen, PauseBanner
src/ui/map/                     projection.ts, land.ts, WorldMap.tsx
e2e/                            Playwright specs
```

Unit tests sit next to their files as `*.test.ts(x)`. Tests that need a game use `createGame({ seed: 1, homePortId: 'TPE', mode: 'normal' })` unless a step says otherwise.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/setupTests.ts`, `src/app/App.test.tsx`, `.gitignore`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `e2e` (`playwright test`). Vitest uses the jsdom environment, with globals and `src/setupTests.ts` (which imports `@testing-library/jest-dom/vitest`).

- [ ] **Step 1: Write the failing test** `src/app/App.test.tsx`: `renders the app root` asserts that `render(<App />)` produces an element with `data-testid="app-root"`.
- [ ] **Step 2: Create the config files** with the pinned versions from the Tech Stack. `vite.config.ts` sets `base: '/ff-tycoon/'`, `plugins: [react()]`, `test: { environment: 'jsdom', globals: true, setupFiles: ['src/setupTests.ts'], include: ['src/**/*.test.{ts,tsx}'] }`. `tsconfig.json` is strict, with `"jsx": "react-jsx"`, `"moduleResolution": "bundler"` and `"types": ["vitest/globals"]`. `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`, `.superpowers`.
- [ ] **Step 3: Run** `npm install && npm test`. Expected: FAIL, because `App` has no `data-testid`.
- [ ] **Step 4: Implement** a minimal `App` returning `<div data-testid="app-root" />`, and `main.tsx` mounting it into `#root`.
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run build`. Expected: all pass, and `dist/index.html` references `/ff-tycoon/assets/...`.
- [ ] **Step 6: Commit** `chore: scaffold Vite + React + TypeScript project`

---

### Task 2: Types, RNG, ids, balance

**Files:**
- Create: `src/sim/types.ts`, `src/sim/rng.ts`, `src/sim/ids.ts`, `src/sim/balance.ts`, `src/sim/log.ts`, `src/sim/rng.test.ts`, `src/sim/balance.test.ts`, `src/i18n/en.ts` (a stub with the keys this task needs)

**Interfaces — Produces** (`src/sim/types.ts`, exactly):

```ts
import type { MsgKey } from '../i18n/en';
export type Mode = 'easy' | 'normal' | 'hardcore';
export type DeptKey = 'sales' | 'ops' | 'accounting';
export const DEPTS: readonly DeptKey[] = ['sales', 'ops', 'accounting'];
export type TaskKind = 'quote' | 'booking' | 'arrival' | 'invoice';
export type ShipmentStatus = 'quoting' | 'lost' | 'origin' | 'atSea' | 'destination' | 'done';
export type EndRef = { kind: 'office'; officeId: string } | { kind: 'agent'; agentId: string };
export type Msg = { key: MsgKey; params?: Record<string, string | number> };
export type Result = { ok: true } | { ok: false; reason: MsgKey };
export interface Stats3 { speed: number; capacity: number; winRate: number }
export interface Employee extends Stats3 { id: string; name: string; officeId: string; dept: DeptKey;
  isOwner: boolean; potential: Stats3; salary: number; hiredDay: number; grewThisYear: boolean }
export interface Candidate extends Stats3 { candidateId: string; name: string; potential: Stats3; salary: number }
export interface HiringSession { officeId: string; dept: DeptKey; candidates: Candidate[] }
export interface Office { id: string; portId: string; regionId: string; rent: number }
export interface Agent { id: string; portId: string; regionId: string }
export interface Customer { id: string; name: string; officeId: string; status: 'prospect' | 'active' | 'lost';
  satisfaction: number; payments: { day: number; amount: number }[]; atRiskNotified: boolean }
export interface Shipment { id: string; customerId: string; sellingOfficeId: string; direction: 'export' | 'import';
  fromPortId: string; toPortId: string; origin: EndRef; destination: EndRef; status: ShipmentStatus;
  margin: number; agentShare: number; departDay: number | null; arriveDay: number | null;
  agentReadyDay: number | null; arrived: boolean; paid: boolean; arrivalDone: boolean }
export interface Task { id: string; kind: TaskKind; officeId: string; dept: DeptKey; shipmentId: string;
  workload: number; progress: number; minDuration: number; createdDay: number; deadline: number;
  assigneeId: string | null; late: boolean }
export interface Loan { id: string; principal: number; monthlyRate: number; monthsLeft: number; payment: number; emergency: boolean }
export type PauseReason = 'yearEnd' | 'customerAtRisk' | 'cashWarning' | 'bankrupt' | 'runEnded';
export interface LogEntry { day: number; tone: 'good' | 'bad' | 'info'; msg: Msg }
export interface GameState { version: 1; seed: number; rngState: number; mode: Mode; day: number; cash: number;
  nextId: number; offices: Office[]; agents: Agent[]; employees: Employee[]; customers: Customer[];
  shipments: Shipment[]; tasks: Task[]; loans: Loan[]; hiring: HiringSession | null; log: LogEntry[];
  pauseReasons: PauseReason[]; ended: null | { reason: 'completed' | 'bankrupt'; day: number };
  stats: { quotesWon: number; quotesLost: number; deliveredDays: number[]; revenue: { day: number; amount: number }[] } }
```

- `rng.ts`: `nextFloat(s: { rngState: number }): number` (mulberry32; returns a value in [0, 1) and advances `rngState`), `randRange(s, min, max): number`, `randInt(s, min, max): number` (inclusive), `chance(s, p): boolean`, `pick<T>(s, items: readonly T[]): T`.
- `ids.ts`: `newId(s: GameState, prefix: string): string` returns `` `${prefix}${s.nextId}` `` and increments `nextId`.
- `log.ts`: `addLog(s: GameState, tone: LogEntry['tone'], msg: Msg): void` prepends the entry and keeps at most 60.
- `balance.ts`: `export const B = { ... } as const` with exactly these starting values:

| Key | Value |
|---|---|
| `daysPerMonth`, `daysPerYear`, `runDays`, `dayMs` | `30`, `360`, `3600`, `290` |
| `startCash`, `homeRent`, `starterAgents` | `60000`, `2000`, `{ easy: 3, normal: 2, hardcore: 1 }` |
| `owner` | `{ speed: 1.2, capacity: 3, winRate: 0.45 }` |
| `tasks.quote` / `booking` / `arrival` / `invoice` | `{ workload: [1, 2], minDuration: 1, deadlineDays: 5 }` / `{ workload: [1.5, 2.5], minDuration: 4, deadlineDays: 10 }` / `{ workload: [1, 2], minDuration: 3, deadlineDays: 8 }` / `{ workload: [0.5, 1], minDuration: 1, deadlineDays: 5 }` |
| `agentHandlingDays`, `agentProfitShare` | `5`, `0.25` |
| `roughRateFactor`, `winClamp`, `satisfactionWinBonusMax` | `0.6`, `[0.05, 0.95]`, `0.1` |
| `demand` | `{ newProspectPerDay: 0.35, repeatPerCustomerPerDay: 0.04, exportShare: 0.6 }` |
| `margin` | `{ base: 800, perTransitDay: 120, jitter: [0.85, 1.15] }` |
| `satisfaction` | `{ start: 50, onTime: 3, opsMiss: -12, invoiceLate: -4, atRisk: 15 }` |
| `penalties` | `{ opsMissFee: 600, invoiceLateFee: 150 }` |
| `hiring` | `{ jobAdCost: 800, rerollCost: 400, candidatesPerRoll: 3, fireCostMonths: 1, speed: [0.7, 1.6], capacity: { sales: [1, 3], ops: [2, 5], accounting: [2, 5] }, winRate: [0.3, 0.6], potentialMult: [1.1, 1.6], baseSalary: { sales: 3200, ops: 3000, accounting: 2800 } }` |
| `growth` | `{ monthlyGapShare: 0.04, capacityChancePerMonth: 0.15, raiseBase: 0.03, raiseGrowthBonus: 0.04 }` |
| `loans` | `{ floor: 30000, valueRatio: 0.5, monthlyRate: 0.01, termMonths: 24, emergencyMonthlyRate: 0.025, emergencyBuffer: 2000 }` |
| `score` | `{ homeOfficeValue: 50000, agentContractValue: 5000, satisfactionPivot: 50 }` |
| `ship` | `{ kmPerDay: 900, minTransitDays: 3 }` |
| `clock` | `{ tickMs: 50, maxCatchUpDays: 3, maxElapsedMs: 1000 }` |

- [ ] **Step 1: Write failing tests.** `rng.test.ts`:
  - `same seed gives the same sequence`: two `{ rngState: 42 }` objects produce identical first 5 `nextFloat` values.
  - `nextFloat stays in [0,1)` over 10,000 draws.
  - `randInt is inclusive`: `randInt(s, 1, 3)` over 1,000 draws yields exactly the set {1, 2, 3}.

  `balance.test.ts`:
  - `every task deadline leaves room for its minimum duration`: for each `B.tasks[k]`, `deadlineDays >= minDuration + 1`.
  - `runDays equals 10 years`: `B.runDays === 10 * B.daysPerYear`.
- [ ] **Step 2: Run** `npx vitest run src/sim`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the files above. `en.ts` exports `export const en = { ... } as const` and `export type MsgKey = keyof typeof en`. Start it with any keys referenced so far. Later tasks add keys.
- [ ] **Step 4: Run** `npx vitest run src/sim && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): add state types, seeded RNG and balance table`

---

### Task 3: World data and sea routes

**Files:**
- Create: `src/sim/world.ts`, `src/sim/names.ts`, `src/sim/world.test.ts`

**Interfaces — Produces:**
- `COUNTRIES: Record<string, { pool: { salaryMult: number; skillMult: number } }>` for `TW, CN, SG, KR, JP, US, NL, DE, AU, AE`.
- `REGIONS: Record<string, { country: string }>` for `TW, CN-N, CN-S, SG, KR, JP, US-W, US-E, NL, DE, AU, AE` (big countries are split, per spec §10).
- `PORTS: Record<PortId, { cityKey: MsgKey; lon: number; lat: number; regionId: string }>` with `PortId = 'TPE'|'SHA'|'SZX'|'SIN'|'PUS'|'TYO'|'LAX'|'NYC'|'RTM'|'HAM'|'SYD'|'DXB'`. Approximate coordinates: TPE (Keelung) 121.74, 25.13; SHA 121.5, 31.2; SZX 114.1, 22.5; SIN 103.8, 1.3; PUS 129.0, 35.1; TYO 139.8, 35.6; LAX −118.2, 33.7; NYC −74.0, 40.7; RTM 4.5, 51.9; HAM 9.9, 53.5; SYD 151.2, −33.9; DXB 55.0, 25.0.
- `type HomePortId = 'TPE' | 'SHA' | 'SIN' | 'LAX' | 'RTM'` and `HOME_PORTS: readonly HomePortId[] = ['TPE', 'SHA', 'SIN', 'LAX', 'RTM']`. Export `PortId` and `HomePortId`.
- `STARTER_AGENT_PRIORITY: Record<HomePortId, PortId[]>`. Each list has at least 3 ports in regions other than home. Example: TPE `['LAX', 'SHA', 'RTM']`.
- `SEA_NODES: Record<string, [lon: number, lat: number]>`, waypoints that keep routes off land. Must include the ids `malacca`, `suezNorth`, `gibraltar`, `panamaW`, `panamaE`, `atlanticMid` and `northPacificMid`. The others are the builder's choice (the mockup's lanes in `docs/mockups/` are a good coordinate source).
- `SEA_EDGES: [string, string][]`: undirected edges among sea nodes and ports.
- `route(from: PortId, to: PortId): { nodeIds: string[]; waypoints: [number, number][]; distanceKm: number }`: shortest path (Dijkstra, haversine edge lengths), memoized. `nodeIds` starts with `from` and ends with `to`.
- `transitDays(from: PortId, to: PortId): number` = `max(B.ship.minTransitDays, round(distanceKm / B.ship.kmPerDay))`.
- `names.ts`: `COMPANY_NAMES: readonly string[]` (≥ 40 fictional companies, e.g. "Acme Toys") and `PERSON_NAMES: readonly string[]` (≥ 40 given names).

- [ ] **Step 1: Write failing tests** `world.test.ts`:
  - `every pair of ports is connected`: `route(a, b)` returns a finite `distanceKm > 0` for all pairs `a ≠ b`.
  - `routes are symmetric`: `route(a, b).distanceKm === route(b, a).distanceKm`.
  - `trans-Pacific stays in the Pacific`: `route('SHA', 'LAX').nodeIds` contains `northPacificMid` and neither `malacca` nor `suezNorth`.
  - `Asia to Europe goes through Malacca, Suez and Gibraltar`: `route('SZX', 'RTM').nodeIds` contains all three.
  - `Korea to New York uses Panama`: `route('PUS', 'NYC').nodeIds` contains `panamaW` and `panamaE`.
  - `Europe to New York crosses the Atlantic`: `route('RTM', 'NYC').nodeIds` contains `atlanticMid` and not `panamaE`.
  - `transit days are plausible`: `transitDays('SHA', 'LAX')` is between 10 and 18, and `transitDays('SZX', 'RTM')` is between 22 and 36.
  - `starter agents are outside the home region`: for each home port, each priority port's region differs from the home port's region.
- [ ] **Step 2: Run** `npx vitest run src/sim/world.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the data and `route()`. Add the `city.*` keys used by `cityKey` to `en.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): add world ports, coverage regions and sea routing`

---

### Task 4: New game

**Files:**
- Create: `src/sim/newGame.ts`, `src/sim/newGame.test.ts`

**Interfaces:**
- Consumes: `B`, `PORTS`, `STARTER_AGENT_PRIORITY`, `newId`.
- Produces: `createGame(opts: { seed: number; homePortId: HomePortId; mode: Mode }): GameState`. It creates one office `o1` at the home port, with `rent = B.homeRent`. The only employee is the owner (`isOwner: true`, `dept: 'sales'`, `salary: 0`, stats `B.owner`, potential equal to the stats). It also creates `B.starterAgents[mode]` agents from the priority list, sets `day: 0`, `cash: B.startCash`, and `rngState: seed`, and leaves all lists empty.

- [ ] **Step 1: Write failing tests:**
  - `starts with the owner only`: `employees.length === 1`, `employees[0].isOwner === true`, `salary === 0`.
  - `normal mode has two starter agents from the priority list`: for TPE, the agent ports equal `['LAX', 'SHA']`.
  - `easy has three and hardcore one`.
  - `is reproducible`: two calls with the same options are deeply equal.
- [ ] **Step 2: Run** `npx vitest run src/sim/newGame.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `createGame`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): create a new game with owner and starter agents`

---

### Task 5: Work engine (speed, capacity, minimum duration)

**Files:**
- Create: `src/sim/work.ts`, `src/sim/work.test.ts`

**Interfaces:**
- Produces:
  - `assignTasks(s: GameState): void`: for each office and department, the unassigned tasks are sorted by `(deadline, createdDay, id)`. Each is given to the department's employee (in that office, the owner included when their `dept` matches) who has the most free capacity slots, with ties going to array order. Stop when nobody has a free slot.
  - `progressTasks(s: GameState): Task[]`: each employee spreads `speed` over their assigned tasks in `(deadline, createdDay, id)` order. Each task gains `min(budget, workload / minDuration, workload − progress)`, and the budget shrinks by that amount. Tasks with `progress >= workload − 1e-9` are removed from `s.tasks` and returned.
  - `unassignAll(s: GameState, employeeId: string): void`.

- [ ] **Step 1: Write failing tests** (build tasks by hand on a fresh game, with the owner moved to `ops` and set to `speed: 2`):
  - `a task can't beat its minimum duration`: one booking with workload 2 and minimum duration 4 has `progress === 0.5` after one day and completes on day 4, not earlier.
  - `capacity 1 leaves speed unused`: with `capacity: 1` and four such bookings, after 4 days exactly 1 is complete.
  - `capacity 4 uses the whole day`: with `capacity: 4` and four such bookings, after 4 days all 4 are complete.
  - `earliest deadline is assigned first`: with capacity 1 and two tasks (deadlines 9 and 5), the one with deadline 5 gets the assignee.
  - `nobody in the department means the task waits`: an `accounting` task with no accounting staff stays unassigned with progress 0.
- [ ] **Step 2: Run** `npx vitest run src/sim/work.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `work.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): add task work engine with capacity and minimum duration`

---

### Task 6: Win chance, satisfaction, task chain and shipments

**Files:**
- Create: `src/sim/sales.ts`, `src/sim/satisfaction.ts`, `src/sim/chain.ts`, `src/sim/demand.ts`, and their `*.test.ts`

**Interfaces:**
- Consumes: `assignTasks`, `progressTasks` (Task 5), `route`, `transitDays`, `addLog`, the RNG.
- Produces:
  - `winChance(s, salesperson: Employee, customer: Customer): number` = clamp to `B.winClamp` of `salesperson.winRate × B.roughRateFactor + bonus`. The `bonus` is `((satisfaction − 50) / 50) × B.satisfactionWinBonusMax` for `active` customers and `0` for prospects.
  - `changeSatisfaction(s, customerId, delta): void` clamps to 0–100. At 0, the status becomes `'lost'` with log `log.customerLeft`. When the value first drops below `B.satisfaction.atRisk`, it pushes `'customerAtRisk'` to `pauseReasons` once (`atRiskNotified`), then resets that flag above the threshold.
  - `createTask(s, kind: TaskKind, shipment: Shipment, officeId: string): Task` (dept: quote → sales, booking/arrival → ops, invoice → accounting). The workload is drawn from `B.tasks[kind].workload`, with `deadline = s.day + deadlineDays`. It's pushed to `s.tasks`.
  - `onTaskCompleted(s, task: Task): void`:
    - **quote:** roll `winChance` against the assignee. If won, the customer becomes `active`, `quotesWon++`, log `log.quoteWon`, and `startOrigin`. If lost, the status becomes `'lost'`, `quotesLost++`, the customer is removed if they were a prospect, and log `log.quoteLost`.
    - **booking:** `depart`.
    - **arrival:** `arrivalDone = true`, plus satisfaction `+onTime` unless the task was `late`, then `maybeFinish`.
    - **invoice:** `cash += margin − agentShare`, push to `customer.payments` and `stats.revenue`, `paid = true`, log `log.paid`, then `maybeFinish`.
  - `advanceShipments(s): void`: for each shipment, if `agentReadyDay === s.day` then `depart`; if `arriveDay === s.day` then `arrive`.
  - Internal rules (from spec §5):
    - `startOrigin`: if the origin is an office, create a booking there; else set `agentReadyDay = day + B.agentHandlingDays`.
    - `depart`: `status 'atSea'`, `departDay = day`, `arriveDay = day + transitDays`. For an export, create the invoice at the selling office.
    - `arrive`: `arrived = true`, `status 'destination'`. If the destination is an office, create an arrival task there; for an import, also create the invoice at the selling office.
    - `maybeFinish`: when `arrived && paid && (destination is agent || arrivalDone)`, set `status 'done'` and push the day to `stats.deliveredDays`.
  - `generateRequests(s): void`: if there is at least one agent, roll `chance(newProspectPerDay)` to create a prospect customer (name picked from `COMPANY_NAMES`) at office `o1`. For each active customer, roll `chance(repeatPerCustomerPerDay × (0.5 + satisfaction / 100))`. Each request creates a shipment (`status 'quoting'`, with `direction` from `B.demand.exportShare`). The partner port is `pick` from the agent ports. Export goes `from` home `to` the partner, with origin = office and destination = agent. Import is the reverse. `margin = round((base + perTransitDay × transitDays) × jitter)`, `agentShare = round(margin × B.agentProfitShare)`. It then creates the quote task.

- [ ] **Step 1: Write failing tests:**
  - `sales.test.ts`:
    - `rough rate scales the salesperson`: winRate 0.5 with a prospect gives `0.3`.
    - `happy customers win more`: satisfaction 100 and active gives `0.4`.
    - `clamped`: winRate 2 gives `0.95`.
  - `satisfaction.test.ts`:
    - `at-risk pauses once`: two drops below 15 push `'customerAtRisk'` exactly once.
    - `customer leaves at zero`: the status becomes `'lost'`.
  - `chain.test.ts`, each driving a shipment by calling `onTaskCompleted` and `advanceShipments` with `s.day` set by hand:
    - `export: booking → sails → invoice at departure → done on arrival and payment`. Assert `departDay`, an `invoice` task created on the departure day, `status 'done'` only after both arrival and payment, and `cash` increased by `margin − agentShare`.
    - `import: origin agent → sails → arrival and invoice tasks on arrival`. Assert no booking task is created, departure happens on `day + 5`, and both an `arrival` and an `invoice` task exist on the arrival day.
    - `lost quote removes a prospect`.
    - `every created task's deadline leaves room for its minimum duration`: for 200 tasks created through `generateRequests` and the chain, `deadline − createdDay >= minDuration`.
  - `demand.test.ts`:
    - `no agents means no requests`: with `s.agents = []`, 100 days of `generateRequests` create no shipments.
    - `requests only use covered ports`: every shipment's non-home port is an agent port.
- [ ] **Step 2: Run** `npx vitest run src/sim`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the four modules, adding the `log.*` keys used to `en.ts`.
- [ ] **Step 4: Run** `npx vitest run src/sim`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): add win chance, satisfaction and the export/import task chain`

---

### Task 7: Missed deadlines

**Files:**
- Create: `src/sim/deadlines.ts`, `src/sim/deadlines.test.ts`

**Interfaces:**
- Produces: `handleMissedDeadlines(s: GameState): void`. Applies to tasks with `deadline < s.day && !late`:
  - **quote:** remove the task, set the shipment to `'lost'`, `quotesLost++`, remove the prospect, log `log.quoteExpired`.
  - **booking/arrival:** `cash −= B.penalties.opsMissFee`, satisfaction `B.satisfaction.opsMiss`, `late = true`, log `log.opsLate`. The task stays.
  - **invoice:** `cash −= B.penalties.invoiceLateFee`, satisfaction `B.satisfaction.invoiceLate`, `late = true`, log `log.invoiceLate`.

- [ ] **Step 1: Write failing tests:**
  - `an expired quote is lost`.
  - `a late booking costs 600 and 12 satisfaction once`: calling it on two consecutive days charges only once.
  - `a late invoice costs 150 and the task stays`.
  - `a late booking earns no on-time bonus`: after the late booking completes, satisfaction doesn't rise.
- [ ] **Step 2: Run** `npx vitest run src/sim/deadlines.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): apply missed-deadline penalties`

---

### Task 8: Staff — gacha hiring, firing, owner moves, growth, raises

**Files:**
- Create: `src/sim/staff.ts`, `src/sim/staff.test.ts`

**Interfaces:**
- Consumes: the RNG, `PERSON_NAMES`, `COUNTRIES[...].pool`, `unassignAll` (Task 5), `addLog`.
- Produces:
  - `rollCandidate(s, officeId, dept): Candidate`. Speed comes from `B.hiring.speed × skillMult`, capacity from `B.hiring.capacity[dept]` (an integer), and win rate from `B.hiring.winRate` for sales (0 otherwise). Potential = each stat × `randRange(potentialMult)`, with capacity rounded down and at least the current value. `salary = round(baseSalary[dept] × salaryMult × (0.75 + 0.5 × quality))`, where `quality` is the mean of each stat's position within its range (0–1).
  - `startHiring(s, officeId, dept): Result`. Rejects with `error.cannotAfford` if `cash < jobAdCost`. Otherwise it deducts the cost and sets `s.hiring` with `candidatesPerRoll` candidates.
  - `rerollCandidates(s): Result`. Uses `rerollCost`, with the same rejection rule. Fails with `error.noHiring` without a session.
  - `hireCandidate(s, candidateId): Result`. Adds an employee (`hiredDay = day`), clears `s.hiring`, logs `log.hired`.
  - `cancelHiring(s): void`.
  - `fireEmployee(s, employeeId): Result`. Fails with `error.cannotFireOwner` for the owner. The cost is `fireCostMonths × salary`, rejected with `error.cannotAfford` if it can't be paid. Otherwise it unassigns the employee's tasks, removes them, and logs `log.fired`.
  - `moveOwner(s, dept): void`. Unassigns the owner's tasks and changes the owner's `dept`.
  - `monthlyGrowth(s): void`. Speed and win rate each move `monthlyGapShare` of the gap toward potential. Capacity goes +1 with `capacityChancePerMonth` while below potential. Any growth sets `grewThisYear`.
  - `yearlyRaises(s): void`. `salary = round(salary × (1 + raiseBase + (grewThisYear ? raiseGrowthBonus : 0)))`, then resets `grewThisYear`. The owner stays at 0.

- [ ] **Step 1: Write failing tests:**
  - `a job ad costs 800 and rolls 3 candidates`.
  - `can't post a job ad without the cash`: with `cash = 500` the result is `{ ok: false, reason: 'error.cannotAfford' }` and cash stays 500.
  - `re-roll costs 400 and replaces all candidates`.
  - `hiring adds the employee and closes the session`.
  - `the owner can't be fired`.
  - `firing costs one month's salary and returns their tasks to the queue`.
  - `firing is refused when it can't be paid`: cash is unchanged.
  - `candidate stats stay in range`: for 500 rolls per department, speed, capacity and win rate are within the ranges times `skillMult`, and potential is at least the stat.
  - `potential caps growth`: 120 months of growth never pushes a stat above its potential.
  - `raises are bigger for staff who grew`: a 3,000 salary becomes 3,090 without growth and 3,210 with it.
  - `moving the owner returns their tasks`.
- [ ] **Step 2: Run** `npx vitest run src/sim/staff.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, adding the `error.*` and `log.*` keys to `en.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): add gacha hiring, firing, owner moves, growth and raises`

---

### Task 9: Money, loans and bankruptcy

**Files:**
- Create: `src/sim/money.ts`, `src/sim/score.ts`, `src/sim/money.test.ts`, `src/sim/score.test.ts`

**Interfaces:**
- Produces:
  - `companyValue(s): { cash: number; loans: number; network: number; customerBook: number; total: number }`:
    - `loans` = the sum of remaining principal;
    - `network = homeOfficeValue × offices.length + agentContractValue × agents.length`;
    - `customerBook` = sum over active customers of (payments in the last 360 days) × (satisfaction / `satisfactionPivot`);
    - `total = cash − loans + network + customerBook`.
  - `fixedMonthlyCosts(s): { salaries: number; rent: number; loans: number; total: number }`.
  - `cashFlowPerMonth(s): { revenue: number; salaries: number; rent: number; loans: number; net: number }`. `revenue` is the sum of `stats.revenue` over the last 30 days.
  - `loanRoom(s): number` = `max(0, max(B.loans.floor, valueRatio × companyValue(s).total) − outstanding principal)`.
  - `takeLoan(s, amount: number): Result`. Rejects with `error.loanOverLimit` above `loanRoom` and `error.invalidAmount` at or below 0. Otherwise it adds a loan with the standard amortized payment `P·r / (1 − (1 + r)^−n)` and `n = termMonths`, rounded up to whole dollars, adds the cash, and logs `log.loanTaken`.
  - `monthEnd(s): void`, run when `day % 30 === 0`:
    1. Pay salaries + rent + each loan payment. Each payment reduces principal by `payment − interest` and decrements `monthsLeft`; a loan at 0 months is removed.
    2. If `cash < 0` and `loanRoom ≥ −cash + emergencyBuffer`, take an emergency loan for that amount at `emergencyMonthlyRate` and log `log.emergencyLoan`.
    3. Else, if `cash < 0`, set `ended = { reason: 'bankrupt', day }`, push `'bankrupt'`, and log `log.bankrupt`.
    4. Otherwise, if `cash < fixedMonthlyCosts.total`, push `'cashWarning'`.

    Also logs `log.payroll`.

- [ ] **Step 1: Write failing tests:**
  - `score.test.ts`:
    - `new game value`: cash 60,000 with 1 office and 2 agents gives a total of 120,000.
    - `satisfaction weighs the customer book`: one customer with 10,000 in payments counts 20,000 at satisfaction 100 and 5,000 at 25.
    - `payments older than a year don't count`.
  - `money.test.ts`:
    - `loan payment is amortized`: 24,000 over 24 months at 1% gives a payment of 1,130.
    - `a loan over the room is refused and cash is unchanged`.
    - `month end pays salaries, rent and loans`.
    - `emergency loan covers a shortfall when there's room`: cash ends at the 2,000 buffer, with one `emergency: true` loan.
    - `bankrupt when cash is negative and there's no room`: `ended.reason === 'bankrupt'`, and `pauseReasons` includes `'bankrupt'` exactly once.
    - `cash warning when cash is below a month of costs`.
- [ ] **Step 2: Run** `npx vitest run src/sim/money.test.ts src/sim/score.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): add cash flow, loans, bankruptcy and company value`

---

### Task 10: Daily step and the full run

**Files:**
- Create: `src/sim/step.ts`, `src/sim/step.test.ts`

**Interfaces:**
- Produces: `stepDay(s: GameState): void`. Does nothing if `s.ended`. Otherwise, in order:
  1. `day++`
  2. `advanceShipments`
  3. `generateRequests`
  4. `assignTasks`
  5. `progressTasks` → `onTaskCompleted` for each completed task
  6. `assignTasks`
  7. `handleMissedDeadlines`
  8. if `day % 30 === 0`: `monthlyGrowth`, then `monthEnd`
  9. if `day % 360 === 0`: `yearlyRaises`, push `'yearEnd'`, log `log.yearEnd`
  10. if `day >= B.runDays` and not ended: `ended = { reason: 'completed', day }`, push `'runEnded'`

- [ ] **Step 1: Write failing tests:**
  - `a run ends after 3600 days`: an owner-only Normal game stepped until `ended` ends either completed on day 3600 or bankrupt earlier, and never steps past 3600.
  - `stepping after the end does nothing`: the state is unchanged.
  - `an owner-only company makes money in year 1`: seed 1, the owner moved by script (sales on days 1–10, then ops) — after 60 days, `stats.quotesWon > 0` and at least one shipment is `'done'`. This proves the loop works end to end. It isn't a balance target.
  - `same seed, same run`: two runs of 720 days with seed 7 are deeply equal.
  - `step is fast`: 3,600 days on seed 3, with 2 hires per department scripted on day 1, finish in under 2,000 ms.
- [ ] **Step 2: Run** `npx vitest run src/sim/step.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `stepDay`.
- [ ] **Step 4: Run** `npx vitest run src/sim`. Expected: PASS (all sim tests).
- [ ] **Step 5: Commit** `feat(sim): orchestrate the daily step and the 10-year run`

---

### Task 11: Translations

**Files:**
- Create: `src/i18n/zhHant.ts`, `src/i18n/zhHans.ts`, `src/i18n/index.ts`, `src/i18n/I18nProvider.tsx`, `src/i18n/i18n.test.ts`
- Modify: `src/i18n/en.ts` (add the UI keys listed in Tasks 14–17 as they're written, starting with those below)

**Interfaces:**
- Produces:
  - `type Lang = 'en' | 'zh-Hant' | 'zh-Hans'`.
  - `zhHant` and `zhHans` typed as `Record<MsgKey, string>`, so a missing key fails `typecheck`.
  - `detectLang(languages: readonly string[]): Lang`. The first match wins: `zh-TW`, `zh-HK`, `zh-MO` or anything with `Hant` → `zh-Hant`; any other `zh*` → `zh-Hans`; anything else → `en`.
  - `t(lang: Lang, key: MsgKey, params?: Record<string, string | number>): string`. Falls back to `en` when a value is empty, then to the key. Replaces `{name}` placeholders, leaving unknown placeholders as they are.
  - `formatMoney(lang: Lang, n: number): string` (USD, 0 decimals, via `Intl.NumberFormat`).
  - `I18nProvider({ lang, children })` and `useT(): { lang: Lang; t: (key: MsgKey, params?) => string; money: (n: number) => string }`.
- Exact copy fixed by this plan:

| Key | en | zh-Hant | zh-Hans |
|---|---|---|---|
| `setup.title` | Start your forwarding company | 創立你的貨代公司 | 创立你的货代公司 |
| `end.demoCta` | Book a demo with GoFreight | 預約 GoFreight 產品展示 | 预约 GoFreight 产品演示 |
| `end.demoLine` | Real forwarders run on GoFreight. See it for real. | 真正的貨代都用 GoFreight。來看看實際的樣子。 | 真正的货代都用 GoFreight。来看看实际的样子。 |
| `end.bankruptLine` | See what would have kept you afloat. | 看看什麼能讓你撐下去。 | 看看什么能让你撑下去。 |

- [ ] **Step 1: Write failing tests** `i18n.test.ts`:
  - `detectLang maps browser languages`: `['zh-TW'] → 'zh-Hant'`, `['zh-CN'] → 'zh-Hans'`, `['zh'] → 'zh-Hans'`, `['fr', 'zh-HK'] → 'zh-Hant'`, `['de'] → 'en'`, `[] → 'en'`.
  - `interpolates params`: `t('en', 'log.paid', { customer: 'Acme', amount: '$1' })` contains `Acme`.
  - `falls back to English for an empty translation`: temporarily set a zh value to `''` and confirm the result equals the en value.
  - `no empty translations ship`: every value in `zhHant` and `zhHans` is a non-empty string.
- [ ] **Step 2: Run** `npx vitest run src/i18n`. Expected: FAIL.
- [ ] **Step 3: Implement**, translating every existing key into both Chinese variants.
- [ ] **Step 4: Run** `npx vitest run src/i18n && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(i18n): add English, Traditional and Simplified Chinese`

From here on, every task that adds an `en` key also adds both Chinese values in the same commit. `typecheck` enforces this.

---

### Task 12: Theme, settings and saving

**Files:**
- Create: `src/theme/theme.ts`, `src/theme/theme.test.ts`, `src/app/persistence.ts`, `src/app/persistence.test.ts`, `src/ui/styles.css`

**Interfaces:**
- Produces:
  - `type ThemePref = 'system' | 'light' | 'dark'`.
  - `resolveTheme(pref: ThemePref, matchMedia?: (q: string) => { matches: boolean }): 'light' | 'dark'`. For `system`: `dark` if `(prefers-color-scheme: dark)` matches, otherwise `light`. It's also `light` when `matchMedia` is undefined or throws.
  - `applyTheme(theme, root: HTMLElement = document.documentElement): void` sets `root.dataset.theme`.
  - `interface Settings { lang: Lang; theme: ThemePref; autoPause: boolean }`.
  - `SAVE_KEY = 'ff-tycoon/save/v1'` and `SETTINGS_KEY = 'ff-tycoon/settings/v1'`.
  - `getStorage(): Storage | null`. Wraps `window.localStorage` access and a probe write in `try/catch`.
  - `loadGame(storage: Storage | null): GameState | null`. Returns `null` for no storage, a missing key, invalid JSON, or `version !== 1`. Never throws.
  - `saveGame(storage, s): boolean` returns `false` on any error.
  - `clearGame(storage): void`.
  - `loadSettings(storage, languages: readonly string[]): Settings`. Defaults are `{ lang: detectLang(languages), theme: 'system', autoPause: true }`, and stored fields override them only when valid.
  - `saveSettings(storage, settings): boolean`.
- `styles.css` defines the color tokens on `:root` (light) and again under `:root[data-theme="dark"]`, and gives `body` an explicit background. Tokens: `--bg, --panel, --panel-2, --line, --text, --muted, --sea, --land, --land-edge, --route, --sales, --ops, --accounting, --good, --bad, --accent`.

- [ ] **Step 1: Write failing tests:**
  - `theme.test.ts`:
    - `system follows dark preference`.
    - `system falls back to light without matchMedia`.
    - `system falls back to light when matchMedia throws`.
    - `explicit prefs win`.
  - `persistence.test.ts`, using fake `Storage` objects:
    - `round-trips a game`.
    - `returns null for corrupt JSON`.
    - `returns null for another version`.
    - `returns null with no storage`.
    - `save reports false when setItem throws (quota)`.
    - `settings default from browser language`: `['zh-TW']` gives `lang 'zh-Hant'`, `theme 'system'`, `autoPause true`.
    - `invalid stored settings fall back to defaults`.
- [ ] **Step 2: Run** `npx vitest run src/theme src/app/persistence.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add light/dark theme, settings and save/load`

---

### Task 13: Store and clock

**Files:**
- Create: `src/app/store.ts`, `src/app/clock.ts`, `src/app/useGameClock.ts`, `src/app/store.test.ts`, `src/app/clock.test.ts`

**Interfaces:**
- Produces:
  - `createGameStore(initial: GameState): GameStore`, where `GameStore = { getState(): GameState; update(mutator: (draft: GameState) => void): void; replace(s: GameState): void; subscribe(fn: () => void): () => void }`. `update` runs the mutator on a `structuredClone` and then notifies subscribers.
  - `useGameState<T>(store, selector: (s: GameState) => T): T` (via `useSyncExternalStore`).
  - `createClock(opts: { now: () => number; dayMs: number; tickMs: number; maxCatchUpDays: number; maxElapsedMs: number; onDays: (n: number) => void }): Clock`, where `Clock = { start(): void; stop(): void; setSpeed(v: 0 | 1 | 3): void; getSpeed(): 0 | 1 | 3; fraction(): number }`. Every `tickMs` it adds `min(elapsed, maxElapsedMs) × speed` to an accumulator, converts whole days (at most `maxCatchUpDays` per tick) into one `onDays(n)` call, and keeps the remainder. `fraction()` = accumulator / dayMs, for smooth ship movement.
  - `useGameClock(store, settings): { speed; setSpeed; fraction: () => number; resume(): void }`. `onDays` calls `store.update(s => { for n: stepDay(s) })`. After an update, if `pauseReasons` is non-empty and (`settings.autoPause` or the reasons include `'bankrupt'` or `'runEnded'`), it sets the speed to 0. `resume()` clears `pauseReasons` and sets 1×. It also saves the game (`saveGame`) whenever the in-game month changes, and on `visibilitychange` to hidden.

- [ ] **Step 1: Write failing tests:**
  - `store.test.ts`:
    - `update produces a new object and notifies`.
    - `the mutator can't touch the previous state`: the old reference is unchanged after an update.
  - `clock.test.ts`, with Vitest fake timers and a fake `now`:
    - `1× advances one day per dayMs`: 2,900 ms gives 10 days.
    - `3× is three times faster`.
    - `paused advances nothing`.
    - `a long sleep doesn't burst`: jumping `now` forward by 600,000 ms advances at most `maxCatchUpDays` days on that tick.
    - `fraction is between 0 and 1`.
- [ ] **Step 2: Run** `npx vitest run src/app`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): add game store and real-time clock with catch-up cap`

---

### Task 14: App shell, setup screen and end screen

**Files:**
- Create: `src/ui/SetupScreen.tsx`, `src/ui/EndScreen.tsx`, `src/ui/SetupScreen.test.tsx`, `src/ui/EndScreen.test.tsx`
- Modify: `src/app/App.tsx`, `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `createGame`, `companyValue`, the persistence functions, `useT`, `resolveTheme`/`applyTheme`.
- Produces:
  - `App` loads settings and the save. It applies the theme, updating when the system preference changes while on `system`. It shows `SetupScreen` (no game), `GameScreen` (game running; Task 15 provides it, until then a placeholder), or `EndScreen` (`state.ended`).
  - `SetupScreen({ hasSave, onContinue, onNewGame(homePortId) })` shows the `setup.title` heading, one button per `HOME_PORTS` city, and a Continue button when `hasSave`. The seed for a new game is `Date.now() >>> 0`.
  - `EndScreen({ state, onPlayAgain })` shows:
    - the heading `end.titleCompleted` or `end.titleBankrupt`;
    - the breakdown "Cash + Network + Customer book = total" using `money()`, with the loans line shown when non-zero;
    - the label `Normal` (key `mode.normal`);
    - for bankruptcy, the year the company fell;
    - an `<a>` with text `end.demoCta`, href `https://gofreight.com/get-demo`, and `target="_blank" rel="noopener noreferrer"`, under `end.demoLine` (completed) or `end.bankruptLine` (bankrupt);
    - a Play again button that clears the save.

- [ ] **Step 1: Write failing tests:**
  - `SetupScreen.test.tsx`:
    - `starting a game from Taipei calls onNewGame('TPE')`.
    - `Continue only shows with a save`.
    - `shows Traditional Chinese title under zh-Hant`.
  - `EndScreen.test.tsx`:
    - `completed run shows the value breakdown and the demo link`. The link has the exact href, `target="_blank"` and a `rel` containing `noopener`.
    - `bankrupt run shows the bankrupt line and year`.
  - `App.test.tsx`:
    - `no save shows setup`.
    - `an ended save shows the end screen`. Seed storage with a saved game whose `ended` is set.
- [ ] **Step 2: Run** `npx vitest run src/ui src/app/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** with semantic HTML (buttons, headings, `<dl>` for the breakdown).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): add setup and end screens with the demo call to action`

---

### Task 15: Game screen — top bar, departments, side panel, hiring

**Files:**
- Create: `src/ui/GameScreen.tsx`, `src/ui/TopBar.tsx`, `src/ui/PauseBanner.tsx`, `src/ui/DepartmentBoard.tsx`, `src/ui/SidePanel.tsx`, `src/ui/HiringDialog.tsx`, and tests `src/ui/TopBar.test.tsx`, `src/ui/DepartmentBoard.test.tsx`, `src/ui/HiringDialog.test.tsx`, `src/ui/GameScreen.test.tsx`
- Modify: `src/app/App.tsx` (use `GameScreen`)

**Interfaces:**
- Consumes: the store, `useGameClock`, `cashFlowPerMonth`, `loanRoom`, `takeLoan`, `startHiring`, `rerollCandidates`, `hireCandidate`, `cancelHiring`, `fireEmployee`, `moveOwner`, `useT`. Every player action goes through `store.update(s => ...)`, and a returned `Result` with `ok: false` shows `t(reason)` inline.
- Produces:
  - **`TopBar`** shows:
    - cash;
    - net cash flow per month, signed, e.g. `+$1,100 / mo`, with the `--good`/`--bad` color;
    - "Year X of 10 · Day Y", where X = `floor((day − 1) / 360) + 1`;
    - win rate (`quotesWon / (quotesWon + quotesLost)`, "—" before any quote);
    - shipments per operator per month (delivered in the last 30 days ÷ max(1, ops staff));
    - staff count;
    - pause / 1× / 3× buttons with `aria-pressed`.
  - **`PauseBanner`** lists the translated `pauseReasons`, with a Resume button.
  - **`DepartmentBoard`** has one column per department. Each column shows:
    - staff chips: name, ★ for the owner, and `"{open} / {capacity} open"`;
    - up to 6 task cards, sorted like the engine. Each card shows the task label (a `task.<kind>` key with customer and route), the deadline as `"due in {n}d"`, or `due today` with the `--bad` color when n ≤ 1, a progress bar, and the text `"{progress} / {workload}"` with one decimal;
    - `"+{n} more waiting"`;
    - the `dept.empty` hint when nobody is in the department.
  - **`SidePanel`** sections:
    - **Hire:** one button per department (shows the job-ad cost) that opens `HiringDialog`.
    - **Owner:** three buttons to move the owner.
    - **Staff:** a list with a Let go button showing its cost.
    - **Money:** the cash-flow breakdown, loan room, and buttons for $10,000 / $25,000 / $50,000 loans, disabled above the room.
    - **Log:** the latest 40 entries.
    - **Settings:** language select, theme select, auto-pause toggle, and New game behind a `confirm()`.
  - **`HiringDialog`** (`role="dialog"`) shows the candidates side by side: speed, capacity, win rate (Sales only), potential, and salary per month. It has one Hire button per candidate, a Re-roll button (shows cost, disabled with `error.cannotAfford` when unaffordable), and Close. It also shows the cash-flow preview "Hiring {name}: −$X / mo". While it's open the clock is paused (auto-pause, Easy/Normal), and closing it restores the previous speed.
  - **`GameScreen` layout:**
    - above 768 px: a grid with TopBar on top, map + DepartmentBoard on the left, and SidePanel (300 px) on the right;
    - at 768 px and below: TopBar, the map, then a tab bar (`role="tablist"`) with tabs `Departments | Staff & hiring | Money | Log | Settings` showing one panel at a time. Every container has `min-width: 0`, and long text wraps or truncates with an ellipsis.

- [ ] **Step 1: Write failing tests:**
  - `TopBar.test.tsx`:
    - `formats positive and negative cash flow`: `+$1,100 / mo` and `−$500 / mo` in `en`.
    - `year counter`: day 361 shows Year 2.
  - `DepartmentBoard.test.tsx`:
    - `shows progress and capacity`: a task with progress 1.5 and workload 3 renders `1.5 / 3`; an employee with 3 of 4 slots used renders `3 / 4 open`.
    - `shows due today in red when n ≤ 1`.
    - `empty department hint`.
  - `HiringDialog.test.tsx`:
    - `re-roll disabled with a reason when cash is short`.
    - `hire adds the employee and closes`.
    - `sales candidates show win rate, ops candidates don't`.
  - `GameScreen.test.tsx`:
    - `narrow layout shows tabs`. Set `window.innerWidth = 375` (and mock `matchMedia('(max-width: 768px)')` to match), then expect a `tablist` with 5 tabs.
- [ ] **Step 2: Run** `npx vitest run src/ui`. Expected: FAIL.
- [ ] **Step 3: Implement**, adding all UI keys to the three dictionaries.
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Run the game by hand:** `npm run dev`, start from Taipei, watch quote tasks appear, move the owner, and hire once. Expected: no console errors.
- [ ] **Step 6: Commit** `feat(ui): add game screen with departments, hiring, money and settings`

---

### Task 16: World map with moving ships

**Files:**
- Create: `src/ui/map/projection.ts`, `src/ui/map/projection.test.ts`, `src/ui/map/land.ts`, `src/ui/map/WorldMap.tsx`, `src/ui/map/WorldMap.test.tsx`
- Modify: `src/ui/GameScreen.tsx` (mount the map)

**Interfaces:**
- Consumes: `route`, `PORTS`, `GameState`, `clock.fraction()`.
- Produces:
  - `MAP = { width: 1000, height: 500, seamLon: -25 }` (Pacific-centered, as in the mockup).
  - `project(lon, lat): [x, y]` with `x = (((lon − seamLon) mod 360 + 360) mod 360) / 360 × width`, `y = (90 − lat) / 180 × height`.
  - `projectPath(points: [lon, lat][]): [x, y][][]`. Splits into separate polylines wherever two consecutive points' `x` differ by more than `width / 2`, adding interpolated edge points at `x = 0` and `x = width`.
  - `pointAlong(polylines: [x, y][][], t: number): { x: number; y: number; angle: number }` measures distance over all pieces, clamps `t` to [0, 1], and gives the angle in degrees.
  - `LAND: [lon, lat][][]` is moved from the mockup's polygons.
  - `WorldMap({ state, fraction })` renders an SVG with `viewBox="0 30 1000 360"` and `preserveAspectRatio="xMidYMid meet"`:
    - land, ports with translated city labels, the office pin, agent pins;
    - a dashed route for every `atSea` shipment;
    - one `<g data-testid="ship">` per `atSea` shipment, positioned with `pointAlong(projectPath(route(from, to).waypoints), (day + fraction() − departDay) / (arriveDay − departDay))` and updated with `requestAnimationFrame`.

  All colors use the CSS tokens, so both themes work.

- [ ] **Step 1: Write failing tests:**
  - `projection.test.ts`:
    - `project maps the seam to x = 0`.
    - `a Pacific path isn't split`: SHA→LAX waypoints give 1 polyline.
    - `an Atlantic path is split at the seam`: `[[4.5, 51.9], [-74, 40.7]]` gives 2 polylines, the first ending at `x = 0` and the second starting at `x = 1000`.
    - `pointAlong endpoints`: `t = 0` gives the first point and `t = 1` the last.
  - `WorldMap.test.tsx`:
    - `one ship per shipment at sea`: a state with 2 `atSea` and 1 `origin` shipment renders 2 `ship` elements.
    - `labels follow the language`: the TPE label is in Traditional Chinese under zh-Hant.
- [ ] **Step 2: Run** `npx vitest run src/ui/map`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/ui/map`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): add world map with ships sailing real sea routes`

---

### Task 17: Auto-pause wiring and log copy

**Files:**
- Modify: `src/app/useGameClock.ts`, `src/ui/PauseBanner.tsx`, `src/ui/SidePanel.tsx`
- Create: `src/ui/PauseBanner.test.tsx`

**Interfaces:**
- Consumes: Task 13's `useGameClock` and Task 10's `pauseReasons`.
- Produces: `PauseBanner` shows one line per reason via `pause.<reason>` keys. For example, `pause.customerAtRisk` → "A customer is unhappy and may leave", and `pause.cashWarning` → "Cash is below one month of costs". With auto-pause off, the clock keeps running for every reason except `bankrupt` and `runEnded`, and the banner doesn't show. Log entries render through `t(msg.key, msg.params)` with money params pre-formatted, so switching language re-renders old entries too.

- [ ] **Step 1: Write failing tests** `PauseBanner.test.tsx`:
  - `lists each reason in the current language`.
  - `Resume clears reasons and restarts at 1×`.
  - `with auto-pause off, a year end doesn't stop the clock`: run `useGameClock` over a state on day 359 with fake timers, and the speed stays 1 after day 360.
  - `bankruptcy stops the clock even with auto-pause off`.
- [ ] **Step 2: Run** `npx vitest run src/ui/PauseBanner.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): wire auto-pause reasons and translated log`

---

### Task 18: End-to-end checks, CI and GitHub Pages deploy

**Files:**
- Create: `playwright.config.ts`, `e2e/run.spec.ts`, `e2e/layout.spec.ts`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the built app (`npm run build && npm run preview -- --port 4173 --strictPort`), and `createGame` plus `B` imported directly from `src/sim` in the specs (pure TS, so this is safe in Node).
- Produces:
  - **Playwright config:** `webServer` runs the preview at `http://localhost:4173/ff-tycoon/`, with project `chromium`.
  - **CI** (`ci.yml`, on `pull_request`): Node 24, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright install --with-deps chromium`, `npm run e2e`.
  - **Deploy** (`deploy.yml`, on push to `main` and `workflow_dispatch`): the same checks, then `actions/configure-pages`, `actions/upload-pages-artifact` (path `dist`), and `actions/deploy-pages`, with `permissions: { pages: write, id-token: write, contents: read }` and `concurrency: pages`.

- [ ] **Step 1: Write the specs:**
  - `e2e/run.spec.ts`:
    - `new game runs`: visit the app, click the Taipei start button, wait until the top bar shows Day ≥ 10, expect at least one task card, open Hire → Sales, hire the first candidate, and expect 2 staff in the top bar.
    - `ships appear at sea`: with an `addInitScript` that seeds `localStorage[SAVE_KEY]` from a `createGame` state stepped 120 days in Node (import `stepDay`), click Continue and expect at least one `[data-testid="ship"]`.
    - `end screen offers the demo`: seed a save at day 3599 and 1×. Within 5 s the end screen shows, and the demo link has href `https://gofreight.com/get-demo` and `target="_blank"`.
    - `survives broken storage`: an `addInitScript` makes `localStorage.getItem` throw. The setup screen still renders, and a new game still starts.
  - `e2e/layout.spec.ts`:
    - `no horizontal scroll on a phone`: viewport 375 × 812, for each `locale` of `en-US`, `zh-TW` and `zh-CN`, start a game. Then `document.documentElement.scrollWidth <= window.innerWidth`, and the tab bar is visible.
    - `language follows the browser`: locale `zh-TW` shows `創立你的貨代公司`, and `zh-CN` shows `创立你的货代公司`.
    - `dark mode follows the browser`: `colorScheme: 'dark'` gives `html[data-theme="dark"]`, and `colorScheme: 'light'` gives `light`.
- [ ] **Step 2: Run** `npx playwright install chromium && npm run build && npm run e2e`. Expected: all pass. If one fails, fix the app, not the spec.
- [ ] **Step 3: Write** `ci.yml` and `deploy.yml` as above.
- [ ] **Step 4: Ask the owner before enabling Pages.** It's a repository setting. With approval, run `gh api -X POST repos/carpusherw/ff-tycoon/pages -f build_type=workflow`, or the owner sets Settings → Pages → Source: GitHub Actions.
- [ ] **Step 5: Commit** `ci: add e2e checks and GitHub Pages deploy`
- [ ] **Step 6: Push, open the PR** (`Closes #3`), and confirm CI is green. After merge, confirm the deploy workflow succeeded and that `https://carpusherw.github.io/ff-tycoon/` loads the setup screen.

---

## Self-review notes

- **Spec coverage (M1 scope):**
  - §3 → Tasks 1, 11, 12, 18
  - §4 → Tasks 4, 10, 14
  - §5 → Tasks 5, 6, 7
  - §7 → Task 6
  - §8 → Task 8
  - §9 → Task 6 (rival promotions → M5)
  - §10 coverage and starter agents → Tasks 3, 4, 6 (signing and offices → M4)
  - §14 → Task 9
  - §15 → Tasks 9, 14
  - §16 → Tasks 15, 16, 17 (the run story → M6)
  - §6 specialists → M2; §11 → M3; §12/§13 → M5
- **Calls this plan makes that the spec leaves open**, all inside the spec's "builder" area and listed so the owner can veto them:
  - 30-day months and 360-day years;
  - `dayMs = 290`;
  - Normal-only in M1;
  - prospects become customers only when won;
  - import invoices created on arrival, in parallel with the arrival task;
  - proper names aren't localized;
  - the starting balance numbers in Task 2.
