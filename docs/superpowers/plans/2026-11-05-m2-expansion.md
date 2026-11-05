# Milestone 2 — Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the world map worth expanding into. The player signs named agents to open lanes, agents send handling tasks, and the player opens more offices with their own staff, queues, local sales and local charges, switching between them from the map.

**Architecture:** Same shape as M1. New rules live in `src/rules/network.ts` (signing, opening, coverage) and `src/rules/handling.ts` (agent handling shipments), and plug into the existing `stepDay` order. The UI gains an "office on screen" (UI state, not game state), a Network card with an Expand dialog, clickable map pins, and an office switcher. The save format goes to version 2 with a v1→v2 migration and new frozen fixtures.

**Tech Stack:** Unchanged from M1 (Vite 8.3.5, React 19.3.1, TypeScript 7.0.2, Vitest 5.0.5, Playwright 1.64.1, Node 24). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-ff-tycoon-design.md`, mainly §5 (two ends, task chain, billing), §10 (offices and agents), §14 (money, yearly report), §15 (company value) and §16 (screens, saving). **(owner)** items in the spec are fixed. Scope issue: #9.

**Tracking:** GitHub issue #9. Branch `9-m2-expansion`. End every commit message with `Refs #9`. The PR says `Closes #9`.

**Execution:** subagent-driven. Don't start until the owner says go. The owner's answers to the PR's open questions override the defaults written here; the controller rules on any conflict.

---

## Scope

**In scope (#9):**
- Slice 1, agents: sign agents (one-off fee plus the existing 25% profit share) at uncovered ports, with names shown on their pins. Agent handling tasks go straight to Ops and earn a smaller fee. Three new ports. The phone map stays usable as the network grows.
- Slice 2, offices: open an office (opening cost plus rent) with its own departments, staff and queues; its own country's hiring pool (already built); local sales; local charges billed by a player office at the far end; an office and an agent coexisting in one region; switching offices from the map pin and from an office switcher (tabs on phone); a company overview that flags a struggling office; the owner moving between offices.
- Save format version 2.

**Not in scope:**
- Ending agent contracts (Q3).
- Randomized starter agents and double-click to move the owner. Both are in #6 and built separately. M2 must not assume the order or contents of `STARTER_AGENT_PRIORITY`: every agent goes through `addAgent` (Task 3), and nothing reads `agents[0]` or the starter list outside `createGame`.
- Customs, Pricing, Customer Service and satisfaction (#10), and travel time for the owner.

## Global Constraints

- Everything in AGENTS.md: the rules stay pure, randomness only from the seeded RNG, every tuning number in `src/rules/balance.ts` (per-country numbers in `src/rules/world.ts`), all player text through `t()` with every key in `en`, `zh-Hant` and `zh-Hans`, Chinese wording per `docs/i18n/zh-glossary.md`, CSS color tokens only, and no horizontal page scroll at 375 px.
- The repo is public, so every agent name is fictional and contains an invented word, like `COMPANY_NAMES`. Never use a real forwarder's name.
- Terms in code and copy: **task**, **workload**, **origin**, **destination**, **agent**, **office**, **local charges**. Chinese uses 國外代理 / 国外代理 for agent and Local Charge（本地費用）/ 本地费用 for local charges (glossary).
- **Profit always equals the change in cash** over a year (§14). Every new cash movement is counted in a year-report figure.
- Save format: `CURRENT_SAVE_VERSION = 2`, a step `migrations[1]`, and a new folder `src/app/__fixtures__/saves/v2/`. **Never edit `saves/v1/`.** v2 isn't released until this PR merges, so Task 10 may regenerate `saves/v2/`.
- Each dialog follows the M1 modal pattern: background `inert`, Esc closes, focus returns to a real control, and its keys work only while it's open.
- Every button with a shortcut shows it in its tooltip as "action (key)" with a keycap.
- Run `npm test` and `npm run typecheck` before every commit.

## Default numbers (balance.ts; Q2, Q5 and Q6 may change them)

| Key | Value |
|---|---|
| `B.agents.signCost` | 5000 (equals `B.score.agentContractValue`, so signing doesn't change company value) |
| `B.offices.openCost` | 50000 (equals `B.score.officeValue`) |
| `B.offices.baseRent` | 2000; a new office's rent = `round(baseRent × COUNTRIES[country].rentMult)`. The home office keeps `B.homeRent` (2000). |
| `B.demand.referenceLanes` | 2; prospects per office per day = `newProspectPerDay × sqrt(lanes / referenceLanes)` |
| `B.localCharges` | [250, 450] per far-end office on the player's own shipment |
| `B.handling` | `{ requestPerAgentPerDay: 0.08, fee: [300, 500], exportShare: 0.5 }` |
| `B.tasks.charges` | `{ workload: [0.5, 1], minDuration: 1, deadlineDays: 5 }`; a late charges task costs `B.penalties.invoiceLateFee` |
| `B.score.officeValue` | 50000 (renamed from `homeOfficeValue`, applied to every office) |

Move `B.agentProfitShare` → `B.agents.profitShare` and `B.agentHandlingDays` → `B.agents.handlingDays`, and update every caller (grep).

## Review Focus

1. **A v1 save from M1 loads as v2 and plays on:** mid-shipment, hiring dialog open, paused at a year end, and late game. Agents get names and nothing is lost. *Tests: Task 2 (migration) and Task 10 (fixtures).*
2. **Expanding with not quite enough cash:** signing or opening with `cash < cost` is refused with a reason shown, and cash never goes below zero because of the action. With `cash === cost` it succeeds. *Tests: Task 3 and Task 8.*
3. **A brand-new office with no staff:** its quotes expire quietly without fees, agents send it no handling tasks, the overview flags it "no staff yet", and switching to it shows empty columns with "Work here". *Tests: Tasks 4, 5, 6 and 7.*
4. **An office and an agent in the same region:** the player's own shipments there use the office (no agent share, local charges billed), the agent keeps sending handling tasks to the player's other offices, and the region counts once as a lane. *Tests: Tasks 4 and 5.*
5. **The year report with expansion in it:** in a year with a signing, an office opening, local charges and handling fees, `profit === cashEnd − cashStart`. *Tests: Task 4.*

---

## File Structure

```
src/rules/
  world.ts        + HOU, SGN, BOM ports, US-G / VN / IN regions, VN / IN countries, rentMult, sea nodes
  names.ts        + AGENT_NAMES
  network.ts      NEW: addAgent, signAgent, openOffice, coveredRegions, lanesFor, farEndFor, canSign, canOpen
  handling.ts     NEW: generateHandling
  demand.ts       requests per office, far end by region
  chain.ts        charges task, kind-aware billing, maybeFinish
  staff.ts        moveOwner(s, dept, officeId?)
  overview.ts     NEW: officeAlerts
  newGame.ts, score.ts, yearReport.ts, deadlines.ts, step.ts, types.ts, balance.ts
src/app/
  migrations.ts   v2 + step 1→2
  validateSave.ts v2 shape
  __fixtures__/saves/v2/   NEW (generated)
scripts/save-fixtures.ts   expansion scenarios
src/ui/
  GameScreen.tsx       office on screen, Network tab, N / [ / ] keys, Expand dialog
  OfficeSwitcher.tsx   NEW
  NetworkSection.tsx   NEW (overview + "Expand network")
  ExpandDialog.tsx     NEW
  DepartmentBoard.tsx, SidePanel.tsx (HireSection per office), YearReportDialog.tsx, HotkeyHelpDialog.tsx
  map/WorldMap.tsx     every office pin, agent names, clickable pins and ports, phone strip
src/i18n/en.ts, zhHant.ts, zhHans.ts
e2e/expansion.spec.ts  NEW; e2e/saves.ts
```

---

### Task 1: World data — three more ports

**Files:** `src/rules/world.ts`, `src/rules/world.test.ts`, `src/ui/map/WorldMap.tsx` (`LABEL_AT` entries only), `src/i18n/*.ts` (city names)

**Interfaces:**
- Produces: `PortId` gains `'HOU' | 'SGN' | 'BOM'`. `REGIONS` gains `'US-G': { country: 'US' }`, `VN`, `IN`. `COUNTRIES` gains `VN: { salaryMult: 0.7, skillMult: 0.9 }` and `IN: { salaryMult: 0.75, skillMult: 0.95 }`, and every country gets `rentMult`: TW 1, CN 0.9, SG 1.6, KR 1.1, JP 1.4, US 1.8, NL 1.6, DE 1.5, AU 1.5, AE 1.3, VN 0.7, IN 0.7. The type becomes `{ pool: {...}; rentMult: number }`.
- Ports: HOU `[-95.0, 29.6]` US-G "Houston" / 休士頓 / 休斯敦; SGN `[106.8, 10.7]` VN "Ho Chi Minh City" / 胡志明市 / 胡志明市; BOM `[72.9, 18.95]` IN "Mumbai" / 孟買 / 孟买.
- Sea nodes to start from (nudge any segment that crosses a `LAND` polygon in `src/ui/map/land.ts`, as M1 did): `houstonOff [-94.5, 28.8]`, `gulfMid [-90, 25.5]`, `yucatanChannel [-85.8, 21.9]`, `floridaStraits [-80.5, 24.0]`, `floridaEast [-79.3, 26.8]`; `vungTauOff [107.3, 10.0]`; `mumbaiOff [71.5, 18.5]`, `laccadive [74, 8]`. Edges: HOU–houstonOff, houstonOff–gulfMid, gulfMid–yucatanChannel, yucatanChannel–caribbeanSW, gulfMid–floridaStraits, floridaStraits–floridaEast, floridaEast–bahamasNE; SGN–vungTauOff, vungTauOff–scsSouth, vungTauOff–scsMid; BOM–mumbaiOff, mumbaiOff–omanSouth, mumbaiOff–laccadive, laccadive–sriLankaSouth.

- [ ] **Step 1: Failing tests in `world.test.ts`:**
  - `Houston to Rotterdam leaves the Gulf through Florida and crosses the Atlantic`: `nodeIds` contains `floridaStraits` and `atlanticMid`, not `panamaE`.
  - `Houston to Shanghai uses Panama`: contains `yucatanChannel` and `panamaW`.
  - `Mumbai to Rotterdam goes through Suez`: contains `suezNorth`, not `malacca`.
  - `Ho Chi Minh City to Los Angeles crosses the Pacific`: contains `northPacificMid`.
  - `every region has a country with a hiring pool and rent`: for each `REGIONS` entry, `COUNTRIES[country].rentMult > 0`.
  - The existing all-pairs connectivity and symmetry tests cover the new ports.
- [ ] **Step 2: Run** `npx vitest run src/rules/world.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the data, `LABEL_AT` entries for the three ports (the `Record<PortId>` type forces them), and the `city.HOU/SGN/BOM` keys in all three languages.
- [ ] **Step 4: Run** `npm test && npm run typecheck`, then look at the map at 1280 px and 375 px (`npm run dev`) so the new labels don't collide. Expected: PASS, labels readable.
- [ ] **Step 5: Commit** `feat(world): add Houston, Ho Chi Minh City and Mumbai`

---

### Task 2: Save format version 2

All shape changes land here, so later tasks only add behavior.

**Files:** `src/rules/types.ts`, `src/rules/names.ts`, `src/rules/newGame.ts`, `src/app/migrations.ts`, `src/app/validateSave.ts`, `src/app/migrations.test.ts`, `scripts/save-fixtures.ts` (compile only), `src/app/__fixtures__/saves/v2/` (generated)

**Interfaces:**
- Produces in `types.ts`:
  - `GameState.version: 2`
  - `TaskKind` adds `'charges'` (department `accounting`)
  - `Agent { id; portId; regionId; name: string; signedDay: number }`
  - `Shipment` adds `kind: 'sale' | 'handling'`, `localCharges: number` (what the charges task bills; 0 when there is none) and `chargesPaid: boolean`. `customerId: string | null` and `sellingOfficeId: string | null`, both null exactly when `kind === 'handling'`.
  - `YearTotals` and `YearReport` add `expansion: number` (agent signings and office openings)
- `AGENT_NAMES: readonly string[]` in `names.ts`: at least 20 coined names such as "Brinequoll Shipping", none sharing an invented word with `COMPANY_NAMES`.
- `migrations[1]: (v1) => v2`:
  - each agent gets `name = AGENT_NAMES[index % AGENT_NAMES.length]` and `signedDay = 0`
  - each shipment gets `kind: 'sale'`, `localCharges: 0`, `chargesPaid: false`
  - `yearTotals.expansion = 0`, and every `yearReports[i].expansion = 0`
  - It uses no RNG, and leaves `rngState` alone.
- Until Task 3, `createGame` names agents the same way (by index); Task 3 replaces that with `addAgent`.

- [ ] **Step 1: Failing tests in `migrations.test.ts`:**
  - `v1 → v2 names every agent and keeps the rest`: run the migration on each `saves/v1/*.json`. The result is valid (`isValidSave`) with `version === 2`; agents are named and unique within the save; shipments, tasks, cash, `day`, `rngState` and `nextId` are unchanged; year reports carry `expansion: 0`.
  - `a v1 hiring session from before slots still gets cancelled before the step` (the existing normalize keeps working on the way up).
  - `a save claiming version 3 is refused as newer`.
- [ ] **Step 2: Run** `npx vitest run src/app`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, the `validateSave` guards (`nullOr(str)` for the two ids, a `taskKind` that includes `charges`, the new fields), the step, `CURRENT_SAVE_VERSION = 2`, the `task.charges` label ("Local charges · {customer} — {from} → {to}"; Local Charge · … / 本地费用 · …) in all three languages, and the minimum in the rules so it compiles. The minimum: shipments are created with `kind: 'sale', localCharges: 0, chargesPaid: false`, and where code needs a selling office or customer it uses `sellingOfficeId!` / `customerId!`, with a `// Task 4/5` note.
- [ ] **Step 4: Run** `npm run save-fixtures`. This writes `saves/v2/` from the M1 scenarios. Then run `npm test && npm run typecheck`. Expected: PASS. Both `v1/` and `v2/` fixtures load and play 30 days.
- [ ] **Step 5: Commit** `feat(save): save format version 2 with named agents and local charges`

---

### Task 3: Network rules — sign agents, open offices, coverage

**Files:** `src/rules/network.ts`, `src/rules/network.test.ts`, `src/rules/newGame.ts`, `src/rules/score.ts`, `src/rules/balance.ts`, `src/i18n/*.ts` (logs, errors)

**Interfaces:**
- Produces (`network.ts`):
  - `addAgent(s, portId: PortId): Agent` gives the agent a random unused name from `AGENT_NAMES` via `pick` (falling back to `"<name> <n>"` if every name is taken) and `signedDay: s.day`. **Every agent is created through it,** including starter agents in `createGame`.
  - `coveredRegions(s): Set<string>`: the regions with a player office or an agent.
  - `lanesFor(s, officeId): string[]`: the covered regions other than that office's own region, sorted.
  - `farEndFor(s, regionId): { end: EndRef; portId: PortId }`: the player's office in that region if there is one, else its agent.
  - `canSign(s, portId): Result`: `error.alreadyCovered` if the port's region has an agent or a player office; `error.cannotAfford` if `cash < B.agents.signCost`.
  - `canOpen(s, portId): Result`: `error.officeExists` if the region has a player office; `error.cannotAfford` if `cash < B.offices.openCost`.
  - `signAgent(s, portId): Result` and `openOffice(s, portId): Result`: on success, cash goes down by the cost and `yearTotals.expansion` up by it. The agent is added, or an office `{ id: newId('o'), portId, regionId, rent: round(B.offices.baseRent × rentMult) }` is pushed. Each logs `log.agentSigned {name, city}` or `log.officeOpened {city, rent}`.
- `companyValue`: `network = B.score.officeValue × offices + B.score.agentContractValue × agents`.

- [ ] **Step 1: Failing tests in `network.test.ts`:**
  - `signing costs 5000, opens the region and names the agent`.
  - `cannot sign where an agent or own office already covers the region`.
  - `cash exactly the cost is enough; one dollar short is refused and changes nothing` (deep-equal state before and after), for both actions.
  - `opening an office where an agent works keeps the agent` (coexist). `lanesFor` counts that region once, and `farEndFor` returns the office.
  - `new office rent follows the country` (LAX office → 3600; SGN → 1400). `the home office keeps 2000`.
  - `agent names are unique within a run`: sign every port and check every name is distinct.
  - `company value is unchanged by signing or opening` (cost equals its network value).
  - `createGame` still gives Normal two agents outside the home region. Don't assert which ports.
- [ ] **Step 2: Run** `npx vitest run src/rules`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS. Fix any seed-dependent M1 tests that broke only because `createGame` now draws names: update the expected values and note it in the commit body.
- [ ] **Step 5: Commit** `feat(rules): sign agents and open offices`

---

### Task 4: Demand and the chain across offices, local charges

**Files:** `src/rules/demand.ts`, `src/rules/chain.ts`, `src/rules/deadlines.ts`, `src/rules/yearReport.ts`, their tests, `src/i18n/*.ts`

**Interfaces:**
- Consumes: `lanesFor`, `farEndFor` (Task 3).
- `generateRequests(s)`: for **each office**, roll `chance(newProspectPerDay × sqrt(lanes / referenceLanes))`, skipping offices with no lanes. A new prospect belongs to that office. Repeat requests come from each active customer of each office, as before. A request picks a lane region uniformly from `lanesFor`; its far end is `farEndFor`. Export goes from the office's port to the far port; import is the reverse. With an office far end: `agentShare = 0` and `localCharges = randInt(B.localCharges)`. With an agent far end: `agentShare = round(margin × B.agents.profitShare)` and `localCharges = 0`.
- `chain.ts`:
  - When a **booking or arrival completes at an office other than the shipment's `sellingOfficeId`**, create a `charges` task at that office.
  - Completing a charges task adds `localCharges` to cash and `stats.revenue`, sets `chargesPaid`, logs `log.chargesPaid {city, amount}`, then calls `maybeFinish`.
  - `maybeFinish`: done when `arrived && (kind === 'handling' || paid) && (destination is an agent || arrivalDone) && (localCharges === 0 || chargesPaid)`.
  - The customer invoice is created only for `kind === 'sale'`.
  - `customerName(s, shipment)` returns the sending agent's name for a handling shipment (Task 5 uses it).
- `deadlines.ts`: a late charges task costs `invoiceLateFee` once, like an invoice (log `log.chargesLate`).
- `recordYearReport`: `expansion` is copied from `yearTotals`, and `profit = revenue − salaries − rent − fees − hiring − expansion`.

- [ ] **Step 1: Failing tests:**
  - `demand.test.ts`:
    - `each office sells for itself`: with two offices, prospects appear at both, and each customer's `officeId` is the office that got the request.
    - `prospect rate grows with lanes, not linearly`: the measured mean over 20,000 days with seeds fixed is about `0.35 × sqrt(lanes/2)` for lanes 1, 2 and 8, within 10%.
    - `an office with no lanes gets no requests`.
    - `a far end with an own office uses it`: the end is `{kind:'office'}`, `agentShare === 0`, `localCharges` is in range, even when an agent also works in that region.
  - `chain.test.ts`:
    - `export to an own far office: arrival there, then charges there, done after invoice and charges are paid`. Cash rises by `margin + localCharges`.
    - `import from an own far office: booking at the far office creates charges there; the ship sails on booking`.
  - `deadlines.test.ts`: `late charges cost the invoice late fee once`.
  - `yearReport.test.ts`: `profit equals the change in cash with expansion and local charges`. Script a year that signs an agent, opens an office and earns local charges. Assert `profit === cashEnd − cashStart` and `expansion === 55000`.
- [ ] **Step 2: Run** `npx vitest run src/rules`. Expected: FAIL.
- [ ] **Step 3: Implement**, removing every `// Task 4/5` non-null assertion that this task's code makes unnecessary.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(rules): local sales per office and local charges`

---

### Task 5: Agent handling tasks

**Files:** `src/rules/handling.ts`, `src/rules/handling.test.ts`, `src/rules/step.ts`, `src/i18n/*.ts`

**Interfaces:**
- `generateHandling(s)`: for each agent, roll `chance(B.handling.requestPerAgentPerDay)`. The target is a player office **outside the agent's region with at least one Ops employee** (the owner counts), picked uniformly; with none, there's no request. Direction comes from `chance(B.handling.exportShare)`.
  - Export (from the office's port to the agent's port): origin is the office, destination the agent.
  - Import: origin is the agent, destination the office.
  - Fields: `kind: 'handling'`, `customerId: null`, `sellingOfficeId: null`, `margin: 0`, `agentShare: 0`, `localCharges: randInt(B.handling.fee)`, status `'origin'`.
  - It goes straight to Ops: a booking at the office, or `agentReadyDay = day + B.agents.handlingDays`. No quote and no invoice.
  - The charges task comes from Task 4's rule, because the handling office is never the selling office.
- `stepDay`: call `generateHandling` right after `generateRequests`.

- [ ] **Step 1: Failing tests in `handling.test.ts`:**
  - `handling export: booking at the office, sails, charges, done once charges are paid and it arrives`. Cash rises by `localCharges` only.
  - `handling import: agent origin, arrival at the office, then charges`.
  - `never sent to an office without Ops staff, or to an office in the agent's own region`.
  - `task labels name the agent`: `customerName` returns the agent's name.
  - `no customer is created and the customer book is unchanged`.
- [ ] **Step 2: Run** `npx vitest run src/rules`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(rules): agents send handling tasks`

---

### Task 6: Owner between offices and the company overview

**Files:** `src/rules/staff.ts`, `src/rules/overview.ts`, their tests

**Interfaces:**
- `moveOwner(s, dept: DeptKey, officeId?: string): void`. `officeId` defaults to the owner's office, and an unknown id does nothing. The owner's open tasks go back to the queue (as today), then `officeId` and `dept` are set.
- `officeAlerts(s): OfficeAlert[]`, where `type OfficeAlert = { officeId: string; kind: 'late'; dept: DeptKey; count: number } | { officeId: string; kind: 'noStaff' }`.
  - One `late` alert per department with overdue tasks (`task.late` or `deadline < day`).
  - One `noStaff` alert per office with no employees.
  - Sorted: `noStaff` first, then by `count` descending.

- [ ] **Step 1: Failing tests:**
  - `owner moves to another office and department; their tasks return to the queue with progress kept`.
  - `a new office with nobody is flagged noStaff`.
  - `late Ops tasks at the second office flag that office and department`.
- [ ] **Step 2: Run** `npx vitest run src/rules`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(rules): owner moves between offices; office alerts`

---

### Task 7: The office on screen

**Files:** `src/ui/GameScreen.tsx`, `src/ui/OfficeSwitcher.tsx`, `src/ui/DepartmentBoard.tsx`, `src/ui/SidePanel.tsx`, `src/ui/useHotkeys.ts`, `src/ui/HotkeyHelpDialog.tsx`, their tests, `src/i18n/*.ts`

**Interfaces:**
- `GameScreen` holds `viewedOfficeId` (UI state, starting at the owner's office; it falls back to the owner's office if the id vanishes).
- `DepartmentBoard` takes `officeId` and shows only that office's staff and tasks. "Work here" calls `onWorkHere(dept)`, which moves the owner to **the viewed office** and that department. The board's task labels use `customerName` (Task 4), so handling tasks show the agent.
- `HireSection` and the Shift+S/O/A job ads post for the viewed office, and its title reads "Hire · {city}" once there are two or more offices. H posts for the owner's office and department.
- `OfficeSwitcher({ state, officeId, onSelect })`: shown only with two or more offices, above the department board on laptop and phone. It has one button per office with `aria-pressed`, reading "{city}" plus "· N late" when that office has late tasks. Keys `[` and `]` select the previous or next office, with tooltips per the rule.
- S/O/A move the owner to that department **in the viewed office**.

- [ ] **Step 1: Failing tests:**
  - `GameScreen.test.tsx`:
    - `switching office shows that office's tasks and staff only`.
    - `Work here in the second office moves the owner there`.
    - `the job ad goes to the office on screen`.
    - `] and [ cycle offices`.
    - `the switcher is hidden with one office`.
  - `DepartmentBoard.test.tsx`: `a handling task is labelled with the agent's name`.
  - `useHotkeys.test.tsx`: the new keys are ignored in form fields and while a dialog is open.
- [ ] **Step 2: Run** `npx vitest run src/ui`. Expected: FAIL.
- [ ] **Step 3: Implement**, with `[`/`]` added to the shortcut list.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): switch between offices`

---

### Task 8: Network card, Expand dialog and the map

**Files:** `src/ui/NetworkSection.tsx`, `src/ui/ExpandDialog.tsx`, `src/ui/map/WorldMap.tsx`, `src/ui/GameScreen.tsx`, `src/ui/SidePanel.tsx`, `src/ui/YearReportDialog.tsx`, their tests, `src/i18n/*.ts`

**Interfaces:**
- `NetworkSection({ state, onView, onExpand })` is a card titled "Network" (網點與國外代理 / 网点与国外代理). It shows:
  - one row per office: city, staff count, and the top alert from `officeAlerts` ("Ops: 3 late", "No staff yet"), with a View button that calls `onView(officeId)`;
  - "N agents";
  - an "Expand network" button (key **N**).

  On laptop it goes in the side panel between Hire and Money. On phone it's a new **Network** tab: Departments | Hiring | Network | Money | Log.
- `ExpandDialog({ store, open, focusPortId, onClose, onClosed })` is a modal listing every port.
  - Each row: city, status ("Your office", "Agent: {name}" or "Not covered"), then `Sign agent · $5,000` if `canSign` holds and `Open office · $50,000 (+$R / mo)` if no player office is there. A row with neither (the home office, or an office plus an agent) shows its status only. The buttons stay enabled; an action that `canSign`/`canOpen` refuses shows that reason in the row (`role="alert"`).
  - It pauses the clock with auto-pause on, like hiring (`pauseFor('expand')`). It stays open after an action, so the player can keep expanding.
  - `focusPortId` scrolls to that row and focuses it.
- `WorldMap`:
  - Draws an office pin for **every** office; the viewed one gets `is-viewed`. Where an office and an agent share a port, only the office pin is drawn.
  - Agent pins show the agent's name as their second line on laptop, instead of "Agent".
  - Pins and plain ports are buttons (`role="button"`, `tabIndex=0`, Enter/Space). An office pin calls `onSelectOffice(officeId)`; any other port or agent pin calls `onPickPort(portId)`, which opens the Expand dialog at that row.
- `YearReportDialog` and the end screen's final-year block gain an "Expansion" row. "Invoices paid (last 30 days)" becomes "Payments received (last 30 days)", because local charges and handling fees count too.

- [ ] **Step 1: Failing tests:**
  - `ExpandDialog.test.tsx`:
    - `signing from the dialog adds a named agent pin`.
    - `opening an office shows the rent in the button and adds an office pin and a switcher button`.
    - `a refused action shows the reason and keeps cash`.
    - `Esc closes and focus returns to the Expand button`.
  - `WorldMap.test.tsx`:
    - `agent pin shows the agent's name`.
    - `clicking a plain port asks to expand there`.
    - `clicking the second office's pin selects it`.
  - `GameScreen.test.tsx`: `N opens the Expand dialog`, and `the phone layout has a Network tab`.
  - `YearReportDialog` shows the Expansion row.
- [ ] **Step 2: Run** `npx vitest run src/ui`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): network card, expand dialog and clickable map`

---

### Task 9: Phone map

Default per Q1: the phone map is drawn wider than the screen in a strip that scrolls sideways, so it's about 1.6× taller and its pins can be tapped.

**Files:** `src/ui/map/WorldMap.tsx`, `src/ui/styles.css`, `src/ui/map/WorldMap.test.tsx`

**Interfaces:**
- On phone (`compact`), the SVG is `160%` of the card's width inside an `overflow-x: auto` strip, which is not the page. The page still has no horizontal scroll.
- On mount, and when `viewedOfficeId` changes, the strip scrolls so the viewed office is centered, smoothly unless reduced motion is on.
- Compact labels keep their M1 rule (the offices, the agents, and ports with a ship at sea), and pins keep the `COMPACT_SCALE` sizes.

- [ ] **Step 1: Failing tests:** `compact map scrolls to the viewed office` (assert the strip's `scrollLeft` is set toward the office's x), and `laptop map has no strip`.
- [ ] **Step 2: Run** `npx vitest run src/ui/map`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`, and check at 375 × 812 that the map is about 220 px tall, swipes sideways and the page doesn't scroll sideways.
- [ ] **Step 5: Commit** `feat(ui): wider, scrollable phone map`

---

### Task 10: Fixtures, save budget and end-to-end checks

**Files:** `scripts/save-fixtures.ts`, `src/app/__fixtures__/saves/v2/` (regenerated), `src/app/longRun.test.tsx`, `e2e/saves.ts`, `e2e/expansion.spec.ts`, `e2e/layout.spec.ts`

**Interfaces:**
- The scripted player in `save-fixtures.ts` and `e2e/saves.ts` also expands:
  - at a month end, it signs an agent at the nearest uncovered port while `cash > monthlyCosts × 6 + signCost`;
  - it opens a second office at its busiest lane's port once `cash > monthlyCosts × 6 + openCost`, then hires Ops and Sales there.
- v2 fixtures (delete `saves/v2/` and rerun `npm run save-fixtures`; allowed because v2 is unreleased): the five M1 scenarios at v2, plus `day-0500-agents-signed` and `day-1500-second-office`. The second must have a handling shipment and a charges task in flight; the script throws if not.
- `longRun.test.tsx`: the 10-year size-budget run uses the expanding player, and stays under 500,000 characters.
- `e2e/expansion.spec.ts`, seeded from a save with enough cash:
  - sign an agent from the Expand dialog, and its named pin appears;
  - open an office, and the switcher appears;
  - switch to the new office, see empty columns, and use "Work here";
  - reload, and the second office and agent are still there.
- `e2e/layout.spec.ts`: no horizontal page scroll at 375 px with five tabs and the switcher, in all three languages.

- [ ] **Step 1: Write the scripts and specs.**
- [ ] **Step 2: Run** `npm run save-fixtures && npm test && npm run typecheck && npm run build && npm run e2e`. Expected: all pass, and `saves/v1/` is untouched (`git diff --stat src/app/__fixtures__/saves/v1` is empty).
- [ ] **Step 3: Commit** `test: v2 fixtures and expansion end-to-end checks`

---

### Task 11: Docs and owner play-test

**Files:** `docs/superpowers/specs/2026-11-03-ff-tycoon-design.md`, `AGENTS.md`

- [ ] **Step 1:** Update the design doc:
  - Replace §5, §10, §14, §15 and §16's "*Planned (M2 Expansion, #9)*" markers with what was built, including the owner's answers to the PR questions.
  - Add an M2 entry under §19.
  - Point AGENTS.md's "Current build plan" at this file.
- [ ] **Step 2: Owner checkpoint (controller, not a subagent).** Deploy a preview or share the dev URL. The owner plays on laptop and phone, and their feedback becomes fix tasks or #6 items before the PR is marked ready.
- [ ] **Step 3: Commit** `docs: record Milestone 2 as built`

---

## Self-review notes

- **Spec coverage (#9):**
  - Sign agents: T3, T8. Agent names: T2, T3, T8. Handling tasks: T5. More ports: T1. Phone map: T9.
  - Open offices: T3, T8. Own departments and queues: the M1 data model plus T7. Local hiring pool: M1 `rollCandidate`, reached through T7's per-office job ads. Local sales: T4. Local charges: T4. Coexistence: T3, T4. Switching from pins and tabs: T7, T8. Overview flag: T6, T8. Owner between offices: T6, T7.
  - Save format: T2, T10.
- **Profit equals the change in cash:** the new cash movements are signing and opening (`expansion`), and local charges and handling fees (`revenue`). Both are covered by T4's test.
- **Type consistency:** `addAgent`, `signAgent`, `openOffice`, `canSign`, `canOpen`, `lanesFor`, `farEndFor`, `coveredRegions` (T3) are used by T4, T5, T8 and T10. `moveOwner(s, dept, officeId?)` and `officeAlerts` (T6) are used by T7 and T8. `customerName` (T4) is used by T5 and T7.
- **Starter agents:** only `createGame` reads `STARTER_AGENT_PRIORITY`, and every agent comes from `addAgent`, so #6's random pick only changes which ports `createGame` passes in.
