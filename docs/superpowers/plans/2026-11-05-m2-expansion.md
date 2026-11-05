# Milestone 2 — Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the world map worth expanding into. The player signs named agents to open lanes, and agents send handling tasks. The player also opens more offices, each with its own staff, queues, local sales and local charges, and switches between them from the map.

**Architecture:** Same shape as M1. New rules live in `src/rules/network.ts` (signing, opening, coverage) and `src/rules/handling.ts` (agent handling shipments), and plug into the existing `stepDay` order. The UI gains an "office on screen" (UI state, not game state), a Network card with an Expand dialog, clickable map pins and an office switcher. The save format goes to version 2, with a v1→v2 migration and new frozen fixtures.

**Tech Stack:** Unchanged from M1 (Vite 8.3.5, React 19.3.1, TypeScript 7.0.2, Vitest 5.0.5, Playwright 1.64.1, Node 24). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-ff-tycoon-design.md`, mainly §5 (two ends, task chain, billing), §10 (offices and agents), §14 (money, yearly report), §15 (company value) and §16 (screens, saving). **(owner)** items in the spec are fixed. Scope issue: #9.

**Tracking:** GitHub issue #9. Branch `9-m2-expansion`. End every commit message with `Refs #9`. The PR says `Closes #9`.

**Execution:** subagent-driven. Don't start until the owner says go.

## Owner decisions (PR #15)

1. **Phone map:** drawn 1.6× wider than the screen in a strip that scrolls sideways (about 220 px tall), centered on the office on screen (Task 11).
2. **Prices:**
   - An agent costs $5,000 once, plus the 25% profit share.
   - An office costs $50,000 plus rent. Rent is $2,000 × the country's rent factor; the home office stays at $2,000.
3. **Ending agent contracts:** not in M2.
4. **Ports:** 11 new ports, for 23 in total. Houston, Ho Chi Minh City and Mumbai, plus the owner's eight: Vancouver, Manzanillo, Santos, Felixstowe, Genoa, Durban, Jakarta and Laem Chabang (Tasks 1–3).
5. **Volume:** each office's new-customer rate is M1's rate × √(lanes ÷ 2). In plain words, 4× the places abroad gives 2× the new customers.
6. **Agent handling tasks:**
   - About one per agent every 12 days (8% a day), for a fee of $300–$500.
   - Sent only to the player's offices outside the agent's region that have Ops staff.
   - They can't be refused, and late fees apply.
7. **Owner travel:** moving between offices is instant, like changing departments.
8. **Expand dialog:** holds the clock like the hiring dialog (with auto-pause on) and stays open after each action.
9. **Keys:**
   - **N** opens the Expand dialog.
   - **[** and **]** switch to the previous or next office.
   - S/O/A move the owner within the office on screen.
   - H posts a job ad for the owner's own office and department.

---

## Scope

**In scope (#9):**
- **Slice 1, agents:**
  - Sign agents at uncovered ports; their names show on their pins.
  - Agent handling tasks go straight to Ops and earn a smaller fee.
  - 11 new ports.
  - The phone map stays usable as the network grows.
- **Slice 2, offices:**
  - Open an office with its own departments, staff and queues, hiring from its own country's pool (already built).
  - Local sales, and local charges billed by a player office at the far end.
  - An office and an agent can coexist in one region.
  - Switch offices from the map pin and from an office switcher (tabs on phone).
  - A company overview flags a struggling office.
  - The owner moves between offices.
- **Save format version 2.**

**Not in scope:**
- Ending agent contracts.
- Randomized starter agents and double-click to move the owner. Both are in #6 and built separately. M2 must not assume the order or contents of `STARTER_AGENT_PRIORITY`: every agent goes through `addAgent` (Task 5), and nothing outside `createGame` reads `agents[0]` or the starter list.
- Customs, Pricing, Customer Service and satisfaction (#10), and travel time for the owner.

## Global Constraints

- **Everything in AGENTS.md:**
  - The rules stay pure, and randomness comes only from the seeded RNG.
  - Every tuning number lives in `src/rules/balance.ts`, with per-country numbers in `src/rules/world.ts`.
  - All player text goes through `t()`, with every key in `en`, `zh-Hant` and `zh-Hans`.
  - Chinese wording follows `docs/i18n/zh-glossary.md`.
  - CSS color tokens only, and no horizontal page scroll at 375 px.
- **Public repo:** every agent name is fictional and contains an invented word, like `COMPANY_NAMES`. Never use a real forwarder's name.
- **Terms in code and copy:** **task**, **workload**, **origin**, **destination**, **agent**, **office**, **local charges**. Chinese uses 國外代理 / 国外代理 for agent and Local Charge（本地費用）/ 本地费用 for local charges (glossary). City names use the common official Chinese names, Taiwan usage in `zh-Hant` (as with 杜拜 / 迪拜).
- **Profit always equals the change in cash** over a year (§14). Every new cash movement is counted in a year-report figure.
- **Sea routes:** `src/ui/map/land.test.ts` ("sea routes stay off the drawn land") already samples every port pair's route against the `LAND` polygons, so it is the gate for every new node and edge. When it fails, nudge the node and say so in the commit body. Edges that no shortest route uses aren't sampled, so place those by hand against the polygons.
- **Save format:**
  - `CURRENT_SAVE_VERSION = 2`, with a step `migrations[1]` and a new folder `src/app/__fixtures__/saves/v2/`.
  - **Never edit `saves/v1/`.**
  - v2 isn't released until this PR merges, so Task 12 may regenerate `saves/v2/`.
- **Dialogs** follow the M1 modal pattern: the background is `inert`, Esc closes, focus returns to a real control, and the dialog's keys work only while it's open.
- **Shortcuts:** every button with one shows it in its tooltip as "action (key)", with a keycap.
- Run `npm test` and `npm run typecheck` before every commit.

## Numbers (balance.ts)

| Key | Value |
|---|---|
| `B.agents.signCost` | 5000 (equals `B.score.agentContractValue`, so signing doesn't change company value) |
| `B.agents.profitShare` | 0.25 (moved from `B.agentProfitShare`) |
| `B.agents.handlingDays` | 5 (moved from `B.agentHandlingDays`) |
| `B.offices.openCost` | 50000 (equals `B.score.officeValue`) |
| `B.offices.baseRent` | 2000; a new office's rent is `round(baseRent × COUNTRIES[country].rentMult)`. The home office keeps `B.homeRent` (2000). |
| `B.demand.referenceLanes` | 2; prospects per office per day = `newProspectPerDay × sqrt(lanes / referenceLanes)` |
| `B.localCharges` | [250, 450], billed by a far-end office on the player's own shipment |
| `B.handling` | `{ requestPerAgentPerDay: 0.08, fee: [300, 500], exportShare: 0.5 }` |
| `B.tasks.charges` | `{ workload: [0.5, 1], minDuration: 1, deadlineDays: 5 }`; a late charges task costs `B.penalties.invoiceLateFee` |
| `B.score.officeValue` | 50000 (renamed from `homeOfficeValue`, applied to every office) |

Update every caller of the moved and renamed keys (grep).

**Countries** (`world.ts`; `pool` is `{ salaryMult, skillMult }`, then `rentMult`). Existing countries keep their pools and gain a `rentMult`:

| Country | Pool | rentMult |
|---|---|---|
| TW | existing | 1 |
| CN | existing | 0.9 |
| SG | existing | 1.6 |
| KR | existing | 1.1 |
| JP | existing | 1.4 |
| US | existing | 1.8 |
| NL | existing | 1.6 |
| DE | existing | 1.5 |
| AU | existing | 1.5 |
| AE | existing | 1.3 |
| VN | 0.7, 0.9 | 0.7 |
| IN | 0.75, 0.95 | 0.7 |
| CA | 1.5, 1.05 | 1.6 |
| MX | 0.8, 0.9 | 0.8 |
| BR | 0.85, 0.9 | 0.9 |
| GB | 1.5, 1.1 | 1.7 |
| IT | 1.3, 1 | 1.3 |
| ZA | 0.8, 0.9 | 0.8 |
| ID | 0.65, 0.85 | 0.7 |
| TH | 0.75, 0.9 | 0.8 |

**New ports.** Each new port is its own region, and the region id equals the country code except Houston's `US-G`.

| Id | City (en / zh-Hant / zh-Hans) | [lon, lat] | Region | Task |
|---|---|---|---|---|
| HOU | Houston / 休士頓 / 休斯敦 | [-95.0, 29.6] | US-G | 1 |
| VAN | Vancouver / 溫哥華 / 温哥华 | [-123.1, 49.3] | CA | 1 |
| ZLO | Manzanillo / 曼薩尼約 / 曼萨尼约 | [-104.3, 19.05] | MX | 1 |
| SSZ | Santos / 桑托斯 / 桑托斯 | [-46.3, -23.95] | BR | 1 |
| FXT | Felixstowe / 費利克斯托 / 费利克斯托 | [1.35, 51.95] | GB | 2 |
| GOA | Genoa / 熱那亞 / 热那亚 | [8.9, 44.4] | IT | 2 |
| DUR | Durban / 德班 / 德班 | [30.9, -29.9] | ZA | 2 |
| SGN | Ho Chi Minh City / 胡志明市 / 胡志明市 | [106.8, 10.7] | VN | 3 |
| BOM | Mumbai / 孟買 / 孟买 | [72.9, 18.95] | IN | 3 |
| JKT | Jakarta / 雅加達 / 雅加达 | [106.85, -6.1] | ID | 3 |
| LCH | Laem Chabang / 林查班 / 林查班 | [100.9, 13.1] | TH | 3 |

## Review Focus

1. **A v1 save from M1 loads as v2 and plays on.** Cover mid-shipment, hiring dialog open, paused at a year end, and late game. Agents get names, and nothing is lost. *Tests: Task 4 (migration) and Task 12 (fixtures).*
2. **Expanding with not quite enough cash.** Signing or opening with `cash < cost` is refused with a reason shown, and cash never goes below zero because of the action. `cash === cost` succeeds. *Tests: Task 5 and Task 10.*
3. **A brand-new office with no staff.** Its quotes expire quietly without fees, agents send it no handling tasks, and the overview flags it "no staff yet". Switching to it shows empty columns with "Work here". *Tests: Tasks 6, 7, 8 and 9.*
4. **An office and an agent in the same region.** The player's own shipments there use the office (no agent share, local charges billed). The agent keeps sending handling tasks to the player's other offices, and the region counts once as a lane. *Tests: Tasks 6 and 7.*
5. **A big network on the map.** With every region covered and four offices, no two pin label bubbles overlap on the laptop map or the phone strip, in all three languages. *Test: Task 12's e2e check, tuned in Task 10.*

---

## File Structure

```
src/rules/
  world.ts        + 11 ports, their regions, countries (pool + rentMult) and sea nodes
  names.ts        + AGENT_NAMES
  network.ts      NEW: addAgent, signAgent, openOffice, coveredRegions, lanesFor, farEndFor, canSign, canOpen
  handling.ts     NEW: generateHandling
  overview.ts     NEW: officeAlerts
  demand.ts, chain.ts, staff.ts, newGame.ts, score.ts, yearReport.ts, deadlines.ts, step.ts, types.ts, balance.ts
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
  map/WorldMap.tsx     every office pin, agent names, clickable pins and ports, label spots, phone strip
  map/land.ts          Gulf of Thailand carved out (Task 3)
src/i18n/en.ts, zhHant.ts, zhHans.ts
e2e/expansion.spec.ts  NEW; e2e/saves.ts, e2e/layout.spec.ts
```

---

### Tasks 1–3: World data

Each world task adds its ports from the table above. That means its `PORTS` entries, `REGIONS` and `COUNTRIES` rows, sea nodes and edges, `LABEL_AT` entries in `WorldMap.tsx` (the `Record<PortId>` type forces one per port), and `city.*` keys in all three languages. Each task tests its routes in `world.test.ts`. The existing all-pairs connectivity, symmetry and transit-plausibility tests then cover every port.

Nodes below are starting points, checked by hand against `LAND`. The land test has the final say.

Shared step pattern for each world task:
- [ ] Write the route tests listed. Run `npx vitest run src/rules/world.test.ts`. Expected: FAIL.
- [ ] Implement the data.
- [ ] Run `npm test && npm run typecheck` (including `land.test.ts`), then look at the map at 1280 px and 375 px (`npm run dev`). Expected: PASS, and no pin sits on the wrong side of a coast.
- [ ] Commit `feat(world): add <region> ports`.

### Task 1: World — the Americas and the Atlantic

**Ports:** HOU, VAN, ZLO, SSZ.

**This task also:**
- changes `COUNTRIES`' type to `{ pool: {...}; rentMult: number }`;
- adds `rentMult` to every existing country.

**Interfaces:**
- **Sea nodes:**
  - Gulf of Mexico: `houstonOff [-94.5, 27.8]`, `gulfMid [-90, 25.5]`, `yucatanChannel [-85.8, 21.9]`, `floridaStraits [-80.5, 24.0]`, `floridaEast [-79.3, 26.8]`.
  - North-east Pacific: `vancouverOff [-126.5, 48.3]`, `oregonOff [-126, 42]`.
  - Mexico: `manzanilloOff [-105.5, 18.0]`.
  - Brazil: `santosOff [-44, -25.5]`, `caboFrioOff [-39, -24]`, `bahiaOff [-36, -16]`, `brazilEast [-32, -8]`, `amazonOff [-44, 4]`.
  - Caribbean: `lesserAntilles [-60, 13.5]`.
  - East Atlantic: `capeVerdeOff [-26, 14]`, `canariesOff [-19, 28]`.
- **Edges:**
  - HOU–houstonOff, houstonOff–gulfMid, gulfMid–yucatanChannel, yucatanChannel–caribbeanSW, gulfMid–floridaStraits, floridaStraits–floridaEast, floridaEast–bahamasNE.
  - VAN–vancouverOff, vancouverOff–northPacificEast, vancouverOff–oregonOff, oregonOff–californiaOff.
  - ZLO–manzanilloOff, manzanilloOff–mexicoOff, manzanilloOff–bajaOff.
  - SSZ–santosOff, santosOff–caboFrioOff, caboFrioOff–bahiaOff, bahiaOff–brazilEast, brazilEast–amazonOff, amazonOff–lesserAntilles, lesserAntilles–caribbeanSW, lesserAntilles–bahamasNE.
  - brazilEast–capeVerdeOff, capeVerdeOff–canariesOff, canariesOff–capeStVincent.

**Route tests:**
- `Houston to Rotterdam leaves the Gulf through Florida`: contains `floridaStraits` and `atlanticMid`, not `panamaE`.
- `Houston to Shanghai uses Panama`: contains `yucatanChannel` and `panamaW`.
- `Vancouver to Shanghai crosses the North Pacific`: contains `northPacificMid`, not `panamaW`.
- `Manzanillo to Shanghai crosses the Pacific`: contains `northPacificMid`, not `panamaE`.
- `Santos to Rotterdam stays in the Atlantic`: contains `capeVerdeOff`, not `panamaE`.
- `Santos to New York goes up the Brazilian coast`: contains `amazonOff`, not `capeVerdeOff`.
- `every region has a country with a hiring pool and rent`: for each `REGIONS` entry, `COUNTRIES[country].rentMult > 0`.

### Task 2: World — Europe and Africa

**Ports:** FXT, GOA, DUR.

**Interfaces:**
- **Sea nodes:**
  - North Sea: `felixstoweOff [2.4, 51.9]`.
  - Ligurian Sea: `ligurianSea [8.5, 43.3]`.
  - South Africa: `durbanOff [32.5, -30.5]`, `portElizabethOff [27, -35]`, `capeAgulhas [20, -36.5]`.
  - West Africa: `namibiaOff [11, -26]`, `angolaOff [9, -12]`, `gulfGuinea [3, 1]`, `liberiaOff [-13, 4.5]`.
  - Indian Ocean: `madagascarSouth [46, -28.5]`, `madagascarEast [53, -21]`, `somaliaOff [52, 2]`.
- **Edges:**
  - FXT–felixstoweOff, felixstoweOff–northSeaSouth, felixstoweOff–doverStrait.
  - GOA–ligurianSea, ligurianSea–tunisNorth.
  - DUR–durbanOff, durbanOff–portElizabethOff, portElizabethOff–capeAgulhas, portElizabethOff–madagascarSouth, durbanOff–madagascarSouth.
  - capeAgulhas–namibiaOff, namibiaOff–angolaOff, angolaOff–gulfGuinea, gulfGuinea–liberiaOff, liberiaOff–capeVerdeOff.
  - capeAgulhas–santosOff (the South Atlantic).
  - madagascarSouth–madagascarEast, madagascarEast–somaliaOff, somaliaOff–adenEast, madagascarEast–sriLankaSouth.

**Route tests:**
- `Genoa reaches Asia through Suez`: GOA→SHA contains `suezNorth` and `malacca`, not `gibraltar`.
- `Durban to Shanghai goes round through the Indian Ocean`: contains `sriLankaSouth` and `malacca`, not `suezNorth` and not `capeAgulhas`.
- `Durban to Rotterdam goes round the Cape`: contains `capeAgulhas` and `capeVerdeOff`, not `suezNorth`.
- `Felixstowe to New York crosses the Atlantic`: contains `doverStrait` and `atlanticMid`.
- `Santos to Shanghai goes round the Cape of Good Hope`: contains `capeAgulhas`, not `panamaW`.

### Task 3: World — Asia

**Ports:** SGN, BOM, JKT, LCH.

**`land.ts` change:** the Europe–Asia polygon has no Gulf of Thailand, which would put Laem Chabang inland. Carve the gulf out by replacing the step `[105, 9], [104, 2]` with `[105, 9], [103.5, 10.5], [102.5, 12], [101, 12.8], [100.3, 13.4], [99.3, 10.5], [100.3, 7.5], [102.3, 6], [103.4, 4.5], [104, 2]`. This changes the drawn coast only there, and no existing route passes through it.

**Interfaces:**
- **Sea nodes:**
  - Vietnam: `vungTauOff [107.3, 10.0]`.
  - India: `mumbaiOff [71.5, 18.5]`, `laccadive [74, 8]`.
  - Java: `jakartaOff [107, -5.6]`.
  - Gulf of Thailand: `lchOff [100.7, 12.7]`, `gulfThailandMouth [103.5, 7.5]`.
- **Edges:**
  - SGN–vungTauOff, vungTauOff–scsSouth, vungTauOff–scsMid.
  - BOM–mumbaiOff, mumbaiOff–omanSouth, mumbaiOff–laccadive, laccadive–sriLankaSouth.
  - JKT–jakartaOff, jakartaOff–javaSea, jakartaOff–karimata.
  - LCH–lchOff, lchOff–gulfThailandMouth, gulfThailandMouth–scsSouth, gulfThailandMouth–singaporeEast.

**Route tests:**
- `Mumbai to Rotterdam goes through Suez`: contains `suezNorth`, not `malacca`.
- `Ho Chi Minh City to Los Angeles crosses the Pacific`: contains `northPacificMid`.
- `Jakarta to Rotterdam goes through Malacca`: contains `karimata` and `malacca`.
- `Laem Chabang leaves the Gulf of Thailand`: LCH→SHA contains `gulfThailandMouth`.
- `land.test.ts`: `Laem Chabang sits on the coast of the carved gulf`, meaning `lchOff` and `gulfThailandMouth` are outside every `LAND` polygon (use the file's `inside` helper).

---

### Task 4: Save format version 2

All shape changes land here, so later tasks only add behavior.

**Files:** `src/rules/types.ts`, `src/rules/names.ts`, `src/rules/newGame.ts`, `src/app/migrations.ts`, `src/app/validateSave.ts`, `src/app/migrations.test.ts`, `scripts/save-fixtures.ts` (compile only), `src/app/__fixtures__/saves/v2/` (generated), `src/i18n/*.ts`

**Interfaces:**
- **Produces in `types.ts`:**
  - `GameState.version: 2`.
  - `TaskKind` adds `'charges'`, worked by `accounting`.
  - `Agent { id; portId; regionId; name: string; signedDay: number }`.
  - `Shipment` adds `kind: 'sale' | 'handling'`, `localCharges: number` (what the charges task bills; 0 when there is none) and `chargesPaid: boolean`.
  - `Shipment.customerId: string | null` and `sellingOfficeId: string | null`, both null exactly when `kind === 'handling'`.
  - `YearTotals` and `YearReport` add `expansion: number` (agent signings and office openings).
- **`AGENT_NAMES: readonly string[]`** in `names.ts`: at least 30 coined names, such as "Brinequoll Shipping". None shares an invented word with `COMPANY_NAMES`. There are 23 regions, so a full network needs up to 22 agents.
- **`migrations[1]: (v1) => v2`:**
  - Each agent gets `name = AGENT_NAMES[index % AGENT_NAMES.length]` and `signedDay = 0`.
  - Each shipment gets `kind: 'sale'`, `localCharges: 0`, `chargesPaid: false`.
  - `yearTotals.expansion = 0`, and every `yearReports[i].expansion = 0`.
  - It uses no RNG and leaves `rngState` alone.
- `task.charges` label in all three languages: "Local charges · {customer} — {from} → {to}" / "Local Charge · …" / "本地费用 · …".
- Until Task 5, `createGame` names agents the same way (by index). Task 5 replaces that with `addAgent`.

- [ ] **Step 1: Failing tests in `migrations.test.ts`:**
  - `v1 → v2 names every agent and keeps the rest`: run the migration on each `saves/v1/*.json`. The result passes `isValidSave` with `version === 2`, and agents are named and unique within the save. Shipments, tasks, cash, `day`, `rngState` and `nextId` are unchanged, and year reports carry `expansion: 0`.
  - `a v1 hiring session from before slots still gets cancelled before the step`: the existing normalize keeps working on the way up.
  - `a save claiming version 3 is refused as newer`.
- [ ] **Step 2: Run** `npx vitest run src/app`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, the `validateSave` guards (`nullOr(str)` for the two ids, a `taskKind` that includes `charges`, the new fields), the step, `CURRENT_SAVE_VERSION = 2`, the label, and the minimum the rules need to compile:
  - shipments are created with `kind: 'sale', localCharges: 0, chargesPaid: false`;
  - where code needs a selling office or a customer, it uses `sellingOfficeId!` / `customerId!` with a `// Task 6/7` note.
- [ ] **Step 4: Run** `npm run save-fixtures`. It writes `saves/v2/` from the M1 scenarios. Then run `npm test && npm run typecheck`. Expected: PASS, and both `v1/` and `v2/` fixtures load and play 30 days.
- [ ] **Step 5: Commit** `feat(save): save format version 2 with named agents and local charges`

---

### Task 5: Network rules — sign agents, open offices, coverage

**Files:** `src/rules/network.ts`, `src/rules/network.test.ts`, `src/rules/newGame.ts`, `src/rules/score.ts`, `src/rules/balance.ts`, `src/i18n/*.ts` (logs, errors)

**Interfaces (`network.ts`):**
- `addAgent(s, portId: PortId): Agent` gives the agent a random unused name from `AGENT_NAMES` via `pick`, falling back to `"<name> <n>"` once every name is taken, and sets `signedDay: s.day`. **Every agent is created through it,** including the starter agents in `createGame`.
- `coveredRegions(s): Set<string>`: regions with a player office or an agent.
- `lanesFor(s, officeId): string[]`: covered regions other than that office's own region, sorted.
- `farEndFor(s, regionId): { end: EndRef; portId: PortId }`: the player's office in that region if there is one, otherwise its agent.
- `canSign(s, portId): Result`:
  - `error.alreadyCovered` if the port's region already has an agent or a player office;
  - `error.cannotAfford` if `cash < B.agents.signCost`.
- `canOpen(s, portId): Result`:
  - `error.officeExists` if the region already has a player office;
  - `error.cannotAfford` if `cash < B.offices.openCost`.
- `signAgent(s, portId): Result` and `openOffice(s, portId): Result`. On success:
  - cash goes down by the cost, and `yearTotals.expansion` goes up by it;
  - the agent is added, or an office `{ id: newId('o'), portId, regionId, rent: round(B.offices.baseRent × rentMult) }` is pushed;
  - each logs `log.agentSigned {name, city}` or `log.officeOpened {city, rent}`.
- `companyValue`: `network = B.score.officeValue × offices + B.score.agentContractValue × agents`.

- [ ] **Step 1: Failing tests in `network.test.ts`:**
  - `signing costs 5000, opens the region and names the agent`.
  - `cannot sign where an agent or own office already covers the region`.
  - `cash exactly the cost is enough; one dollar short is refused and changes nothing` (deep-equal state before and after), for both actions.
  - `opening an office where an agent works keeps the agent` (coexistence). `lanesFor` counts that region once, and `farEndFor` returns the office.
  - `new office rent follows the country`: LAX office → 3600, SGN → 1400. `the home office keeps 2000`.
  - `agent names are unique within a run`: sign every port and check that all 22 names are distinct.
  - `company value is unchanged by signing or opening`, since each cost equals its network value.
  - `createGame` still gives Normal two agents outside the home region. Don't assert which ports.
- [ ] **Step 2: Run** `npx vitest run src/rules`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS. If seed-dependent M1 tests broke only because `createGame` now draws names, update their expected values and note it in the commit body.
- [ ] **Step 5: Commit** `feat(rules): sign agents and open offices`

---

### Task 6: Demand and the chain across offices, local charges

**Files:** `src/rules/demand.ts`, `src/rules/chain.ts`, `src/rules/deadlines.ts`, `src/rules/yearReport.ts`, their tests, `src/i18n/*.ts`

**Interfaces:**
- Consumes `lanesFor` and `farEndFor` (Task 5).
- **`generateRequests(s)`:**
  - For **each office**, roll `chance(newProspectPerDay × sqrt(lanes / referenceLanes))`, skipping offices with no lanes. A new prospect belongs to that office.
  - Repeat requests come from each active customer of each office, as before.
  - Each request picks a lane region uniformly from `lanesFor`; its far end comes from `farEndFor`.
  - Export goes from the office's port to the far port; import goes the other way.
  - With an office at the far end: `agentShare = 0` and `localCharges = randInt(B.localCharges)`.
  - With an agent at the far end: `agentShare = round(margin × B.agents.profitShare)` and `localCharges = 0`.
- **`chain.ts`:**
  - When a **booking or arrival completes at an office other than the shipment's `sellingOfficeId`**, create a `charges` task at that office.
  - Completing a charges task adds `localCharges` to cash and to `stats.revenue`, sets `chargesPaid`, logs `log.chargesPaid {city, amount}` and calls `maybeFinish`.
  - `maybeFinish` marks a shipment done when `arrived && (kind === 'handling' || paid) && (destination is an agent || arrivalDone) && (localCharges === 0 || chargesPaid)`.
  - A customer invoice is created only for `kind === 'sale'`.
  - `customerName(s, shipment)` returns the sending agent's name for a handling shipment.
- **`deadlines.ts`:** a late charges task costs `invoiceLateFee` once, like an invoice, and logs `log.chargesLate`.
- **`recordYearReport`:** copies `expansion` from `yearTotals`; `profit = revenue − salaries − rent − fees − hiring − expansion`.

- [ ] **Step 1: Failing tests:**
  - `demand.test.ts`:
    - `each office sells for itself`: with two offices, prospects appear at both, and each customer's `officeId` is the office that got the request.
    - `prospect rate grows with lanes, not linearly`: over 20,000 days with fixed seeds, the mean is within 10% of `0.35 × sqrt(lanes/2)` for lanes 1, 2, 8 and 22.
    - `an office with no lanes gets no requests`.
    - `a far end with an own office uses it`: the end is `{kind:'office'}`, `agentShare === 0` and `localCharges` is in range, even when an agent also works in that region.
  - `chain.test.ts`:
    - `export to an own far office: arrival there, then charges there, done after invoice and charges are paid`. Cash rises by `margin + localCharges`.
    - `import from an own far office: booking at the far office creates charges there; the ship sails on booking`.
  - `deadlines.test.ts`: `late charges cost the invoice late fee once`.
  - `yearReport.test.ts`: `profit equals the change in cash with expansion and local charges`. Script a year that signs an agent, opens an office and earns local charges, then assert `profit === cashEnd − cashStart` and `expansion === 55000`.
- [ ] **Step 2: Run** `npx vitest run src/rules`. Expected: FAIL.
- [ ] **Step 3: Implement.** Remove every `// Task 6/7` non-null assertion that this task's code makes unnecessary.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(rules): local sales per office and local charges`

---

### Task 7: Agent handling tasks

**Files:** `src/rules/handling.ts`, `src/rules/handling.test.ts`, `src/rules/step.ts`, `src/i18n/*.ts`

**Interfaces:**
- **`generateHandling(s)`:** for each agent, roll `chance(B.handling.requestPerAgentPerDay)`.
  - The target is a player office **outside the agent's region with at least one Ops employee** (the owner counts), picked uniformly. If there's none, no request is made.
  - Direction comes from `chance(B.handling.exportShare)`.
    - Export goes from the office's port to the agent's port: the office is the origin, the agent the destination.
    - Import goes the other way.
  - The shipment gets `kind: 'handling'`, `customerId: null`, `sellingOfficeId: null`, `margin: 0`, `agentShare: 0`, `localCharges: randInt(B.handling.fee)` and status `'origin'`.
  - It goes straight to Ops: a booking task at the office for an export, or `agentReadyDay = day + B.agents.handlingDays` for an import. There's no quote and no invoice.
  - The charges task comes from Task 6's rule, because the handling office is never the selling office.
- **`stepDay`:** call `generateHandling` right after `generateRequests`.

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

### Task 8: Owner between offices and the company overview

**Files:** `src/rules/staff.ts`, `src/rules/overview.ts`, their tests

**Interfaces:**
- **`moveOwner(s, dept: DeptKey, officeId?: string): void`:**
  - `officeId` defaults to the owner's office; an unknown id does nothing.
  - The owner's open tasks go back to the queue, as today, then `officeId` and `dept` are set.
- **`officeAlerts(s): OfficeAlert[]`**, where `type OfficeAlert = { officeId: string; kind: 'late'; dept: DeptKey; count: number } | { officeId: string; kind: 'noStaff' }`:
  - one `late` alert per department with overdue tasks (`task.late` or `deadline < day`);
  - one `noStaff` alert per office with no employees;
  - sorted with `noStaff` first, then by `count` descending.

- [ ] **Step 1: Failing tests:**
  - `owner moves to another office and department; their tasks return to the queue with progress kept`.
  - `a new office with nobody is flagged noStaff`.
  - `late Ops tasks at the second office flag that office and department`.
- [ ] **Step 2: Run** `npx vitest run src/rules`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(rules): owner moves between offices; office alerts`

---

### Task 9: The office on screen

**Files:** `src/ui/GameScreen.tsx`, `src/ui/OfficeSwitcher.tsx`, `src/ui/DepartmentBoard.tsx`, `src/ui/SidePanel.tsx`, `src/ui/useHotkeys.ts`, `src/ui/HotkeyHelpDialog.tsx`, their tests, `src/i18n/*.ts`

**Interfaces:**
- **`GameScreen`** holds `viewedOfficeId` as UI state. It starts at the owner's office, and falls back to the owner's office if the id disappears.
- **`DepartmentBoard`** takes `officeId` and shows only that office's staff and tasks.
  - "Work here" calls `onWorkHere(dept)`, which moves the owner to **the viewed office** and that department.
  - Task labels use `customerName` (Task 6), so handling tasks show the agent's name.
- **Job ads:**
  - `HireSection` and the Shift+S/O/A job ads post for the viewed office.
  - The section title reads "Hire · {city}" once there are two or more offices.
  - H posts for the owner's office and department.
- **`OfficeSwitcher({ state, officeId, onSelect })`:**
  - Shown only with two or more offices, above the department board on laptop and phone.
  - One button per office, with `aria-pressed`, labeled "{city}" plus "· N late" when that office has late tasks.
  - With many offices it wraps on laptop and scrolls sideways inside its row on phone; the page never scrolls sideways.
  - Keys `[` and `]` select the previous or next office, with tooltips per the shortcut rule.
- **S/O/A** move the owner to that department **in the viewed office**.

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
- [ ] **Step 3: Implement**, adding `[` and `]` to the shortcut list.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): switch between offices`

---

### Task 10: Network card, Expand dialog and the map

**Files:** `src/ui/NetworkSection.tsx`, `src/ui/ExpandDialog.tsx`, `src/ui/map/WorldMap.tsx`, `src/ui/GameScreen.tsx`, `src/ui/SidePanel.tsx`, `src/ui/YearReportDialog.tsx`, their tests, `src/i18n/*.ts`

**Interfaces:**
- **`NetworkSection({ state, onView, onExpand })`:** a card titled "Network" (網點與國外代理 / 网点与国外代理).
  - One row per office: city, staff count and the top alert from `officeAlerts` ("Ops: 3 late", "No staff yet"), with a View button that calls `onView(officeId)`.
  - "N agents", and an "Expand network" button (key **N**).
  - On laptop it sits in the side panel between Hire and Money. On phone it's a new **Network** tab: Departments | Hiring | Network | Money | Log.
- **`ExpandDialog({ store, open, focusPortId, onClose, onClosed })`:** a modal listing all 23 ports, grouped by continent, in a list that scrolls inside the dialog.
  - Each row shows the city and its status ("Your office", "Agent: {name}" or "Not covered").
  - Then `Sign agent · $5,000` if `canSign` holds, and `Open office · $50,000 (+$R / mo)` if there's no player office there. A row with neither (the home office, or an office plus an agent) shows its status only.
  - The buttons stay enabled. When `canSign` / `canOpen` refuses an action, the row shows the reason (`role="alert"`).
  - With auto-pause on, it holds the clock like hiring (`pauseFor('expand')`). It stays open after an action, so the player can keep expanding.
  - `focusPortId` scrolls to that row and focuses it.
- **`WorldMap`:**
  - Draws an office pin for **every** office; the viewed one gets `is-viewed`. Where an office and an agent share a port, only the office pin is drawn.
  - Agent pins show the agent's name as their second line on laptop, instead of "Agent".
  - Pins and plain ports are buttons (`role="button"`, `tabIndex=0`, Enter/Space). An office pin calls `onSelectOffice(officeId)`; any other port or agent pin calls `onPickPort(portId)`, which opens the Expand dialog at that row.
  - **Crowding:**
    - Tune `LABEL_AT` (side and `dy`) so that with every port pinned, no two label bubbles overlap at 1280 px. The tight clusters are Rotterdam / Felixstowe / Hamburg and Singapore / Jakarta / Laem Chabang / Ho Chi Minh City.
    - Add `LABEL_AT_COMPACT: Partial<Record<PortId, …>>` overrides for the phone strip where the bigger pins need other spots.
    - Task 12's e2e check is the gate.
- **Year report:** `YearReportDialog` and the end screen's final-year block gain an "Expansion" row.
- **Money wording:** "Invoices paid (last 30 days)" becomes "Payments received (last 30 days)", since local charges and handling fees count too.

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
  - `YearReportDialog`: shows the Expansion row.
- [ ] **Step 2: Run** `npx vitest run src/ui`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Then sign every port in `npm run dev` and check that the pins read cleanly at 1280 px.
- [ ] **Step 5: Commit** `feat(ui): network card, expand dialog and clickable map`

---

### Task 11: Phone map

**Files:** `src/ui/map/WorldMap.tsx`, `src/ui/styles.css`, `src/ui/map/WorldMap.test.tsx`

**Interfaces:**
- On phone (`compact`), the SVG is `160%` of the card's width, inside a strip with `overflow-x: auto`. The strip scrolls sideways, not the page, so the page still has no horizontal scroll.
- On mount, and whenever `viewedOfficeId` changes, the strip scrolls so the viewed office is centered. The scroll is smooth unless reduced motion is on.
- Compact labels keep M1's rule: offices, agents, and ports with a ship at sea. Pins keep the `COMPACT_SCALE` sizes and use `LABEL_AT_COMPACT` where it's set.

- [ ] **Step 1: Failing tests:**
  - `compact map scrolls to the viewed office`: assert that the strip's `scrollLeft` moves toward the office's x.
  - `laptop map has no strip`.
- [ ] **Step 2: Run** `npx vitest run src/ui/map`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. At 375 × 812, check that the map is about 220 px tall and swipes sideways, and that the page doesn't scroll sideways.
- [ ] **Step 5: Commit** `feat(ui): wider, scrollable phone map`

---

### Task 12: Fixtures, save budget and end-to-end checks

**Files:** `scripts/save-fixtures.ts`, `src/app/__fixtures__/saves/v2/` (regenerated), `src/app/longRun.test.tsx`, `e2e/saves.ts`, `e2e/expansion.spec.ts`, `e2e/layout.spec.ts`

**Interfaces:**
- **The scripted player** in `save-fixtures.ts` and `e2e/saves.ts` also expands, at a month end:
  - It signs an agent at the nearest uncovered port while `cash > monthlyCosts × 6 + signCost`.
  - Once `cash > monthlyCosts × 6 + openCost`, it opens a second office at the port of its busiest lane, then hires Ops and Sales there.
- **v2 fixtures:** delete `saves/v2/` and rerun `npm run save-fixtures` (allowed because v2 is unreleased).
  - The five M1 scenarios, now at v2.
  - Plus `day-0500-agents-signed` and `day-1500-second-office`. The second must have a handling shipment and a charges task in flight; the script throws if not.
- **Save budget (`longRun.test.tsx`):**
  - The 10-year size check uses a **stress player**: it covers every region by year 3 and runs four offices from year 5, cash permitting. With 22 lanes, each office gets about 3.3× M1's new customers, plus handling tasks.
  - The save must stay under the 500,000-character budget.
  - If it doesn't, the controller rules, preferring to drop data the save doesn't need (finished handling shipments, long logs) over raising the budget, and records the ruling in the ledger.
  - Also assert that a stress-run day steps in under 20 ms on CI, so 5× stays smooth.
- **`e2e/expansion.spec.ts`**, seeded from a save with enough cash:
  - Sign an agent from the Expand dialog; its named pin appears.
  - Open an office; the switcher appears.
  - Switch to the new office; the columns are empty and "Work here" works.
  - Reload; the second office and the agent are still there.
- **`e2e/layout.spec.ts`:**
  - No horizontal page scroll at 375 px with five tabs and a four-office switcher, in all three languages.
  - **Pin crowding:** from a layout-only save (built with the real rules, with cash set directly so it can sign every port and open four offices), check that no two `.pin-bubble` boxes intersect. Check at 1280 × 800 and in the 375 px phone strip, in all three languages.

- [ ] **Step 1: Write the scripts and specs.**
- [ ] **Step 2: Run** `npm run save-fixtures && npm test && npm run typecheck && npm run build && npm run e2e`. Expected: all pass, and `saves/v1/` is untouched (`git diff --stat src/app/__fixtures__/saves/v1` is empty).
- [ ] **Step 3: Commit** `test: v2 fixtures, save budget with a full network, expansion e2e`

---

### Task 13: Docs and owner play-test

**Files:** `docs/superpowers/specs/2026-11-03-ff-tycoon-design.md`, `AGENTS.md`

- [ ] **Step 1: Update the docs.**
  - In the design doc, replace the "*Planned (M2 Expansion, #9)*" markers in §5, §10, §14, §15 and §16 with what was built, including the owner decisions above. Update §16's map line (23 ports) and add an M2 entry under §19.
  - Point AGENTS.md's "Current build plan" at this file.
- [ ] **Step 2: Owner checkpoint (controller, not a subagent).** Deploy a preview or share the dev URL. The owner plays on laptop and phone. Their feedback becomes fix tasks, or #6 items, before the PR is marked ready.
- [ ] **Step 3: Commit** `docs: record Milestone 2 as built`

---

## Self-review notes

- **Spec coverage (#9):**
  - Slice 1:
    - Sign agents: Tasks 5 and 10.
    - Agent names: Tasks 4, 5 and 10.
    - Handling tasks: Task 7.
    - More ports: Tasks 1–3.
    - Phone map: Task 11; crowding: Tasks 10 and 12.
  - Slice 2:
    - Open offices: Tasks 5 and 10.
    - Own departments and queues: the M1 data model plus Task 9.
    - Local hiring pool: M1's `rollCandidate`, reached through Task 9's per-office job ads; the new countries' pools come from Tasks 1–3.
    - Local sales and local charges: Task 6.
    - Coexistence of an office and an agent: Tasks 5 and 6.
    - Switching from pins and tabs: Tasks 9 and 10.
    - Overview flag: Tasks 8 and 10.
    - Owner between offices: Tasks 8 and 9.
  - Save format: Tasks 4 and 12.
- **Profit equals the change in cash:**
  - The new cash movements are signing and opening (counted in `expansion`) and local charges and handling fees (counted in `revenue`).
  - Task 6's test covers both.
- **Type consistency:**
  - `COUNTRIES[c].rentMult` (Task 1) is read by Task 5.
  - `addAgent`, `signAgent`, `openOffice`, `canSign`, `canOpen`, `lanesFor`, `farEndFor` and `coveredRegions` (Task 5) are used by Tasks 6, 7, 10 and 12.
  - `moveOwner(s, dept, officeId?)` and `officeAlerts` (Task 8) are used by Tasks 9 and 10.
  - `customerName` (Task 6) is used by Tasks 7 and 9.
  - `LABEL_AT_COMPACT` (Task 10) is read by Task 11.
- **Numbers:**
  - Every number in the tables lands in `balance.ts` (Tasks 5–7) or `world.ts` (Tasks 1–3).
  - The rent examples check out: LAX 2000 × 1.8 = 3600, SGN 2000 × 0.7 = 1400.
  - Expansion in the yearly-report test: 5000 + 50000 = 55000.
  - √(22 / 2) ≈ 3.3 at full coverage.
- **Task count:** 13. The world work is split by region (Tasks 1–3) so that each reviewer gate covers four or fewer ports' routes.
- **Starter agents:** only `createGame` reads `STARTER_AGENT_PRIORITY`, and every agent comes from `addAgent`. So #6's random pick only changes which ports `createGame` passes in.
