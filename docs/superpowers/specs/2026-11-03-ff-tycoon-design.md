# FF Tycoon — Game Design

- **Date:** 2026-11-03 (revised 2026-11-06)
- **Status:** Milestone 1 shipped 2026-11-05 and is live at <https://carpusherw.github.io/ff-tycoon/>. Milestone 2 is built and waiting for the owner's play-test. Later milestones are planned (§19).
- **Tracking:** [#1](https://github.com/carpusherw/ff-tycoon/issues/1) (design), [#3](https://github.com/carpusherw/ff-tycoon/issues/3) (Milestone 1 build), [#9](https://github.com/carpusherw/ff-tycoon/issues/9) (Milestone 2 build)
- **Visual style:** [`2026-11-04-visual-style.md`](2026-11-04-visual-style.md), the owner's pick: "Cozy tycoon" in GoFreight green.
- **Reference mockup:** [`docs/mockups/2026-11-03-game-screen-v1.html`](../../mockups/2026-11-03-game-screen-v1.html). It's a throwaway that shows the map, departments and upgrade panel. Open it in a browser. Its numbers and art are placeholders, and it's out of date in several ways:
  - it calls tasks "jobs" and workload "M/D";
  - each employee works one task at a time;
  - its ships sail as soon as a quote is won;
  - its GoFreight products are available from day one.

  This document is the source of truth.

Each decision below is labeled by who made it:

- **(owner)**: decided by the project owner, including the changes the owner asked for while play-testing Milestone 1. Don't change it without asking.
- **(design call)**: chosen during design and not yet confirmed by the owner. The owner should check these while reviewing.
- **(builder)**: left to whoever builds it. Where Milestone 1 already made the choice, the text says what was built.

Each section says what **Milestone 1 (M1)** and **Milestone 2 (M2)** built. Anything marked *Planned (…)* isn't in the game yet; the marker names the GitHub milestone and its scope issue, and §19 links the roadmap. Exact tuning numbers live in `src/rules/balance.ts` (per-country numbers in `src/rules/world.ts`); the ones quoted here are the values as built.

---

## 1. Intent

FF Tycoon is a short, web-based **management** game in which the player runs a freight forwarding company. The player never handles individual shipments. They make the boss's decisions: whom to hire, which department to open, what software to buy, and where to expand. **(owner)**

**Who plays it:** people who work at freight forwarders that could become GoFreight customers, such as managers, operators and salespeople. They should recognize their own daily work in it. **(owner)**

**Why it exists:** it's a fun side project that doubles as marketing. The best outcome is inbound leads: a player finishes a run and books a GoFreight demo. **(owner)**

**What hooks the player:** watching profit grow as their decisions pay off. Sales win more quotes, each operator handles more shipments, and new offices open in new cities and countries. **(owner)**

**The GoFreight moment:** during the run the player decides whether to buy a freight management system, which vendor to pick (GoFreight or a clunky rival), and whether to adopt GoFreight AI. The player should *feel* the difference in their numbers, not read about it. **(owner)** *Planned (M4 Software & GoFreight, #11).*

## 2. Goals, non-goals, anti-goals

**Goals**
- It's fun as a game first. A player who doesn't care about software should still enjoy the run.
- A complete run has a clear ending, a final score, and a "Book a demo" call to action.
- Each GoFreight product proves its value through a game mechanic the player can see in their numbers.
- It works on a laptop and still works on a phone.

**Non-goals (for now)**
- A backend, accounts, leaderboards or analytics. **(owner)**
- Passing the player's score to the demo page. It's a plain link for now. **(owner)**
- Hosting on gofreight.com. It starts on GitHub Pages. **(owner)**
- Endless mode. It may come later as an unlock after the first run. **(design call)**
- A shared "challenge of the week" event sequence. It may come later if a fair leaderboard is wanted. **(design call)**

**Anti-goals (failure even if it technically works)**
- **It plays like an ad.** If the pitch shows up before the fun, the target audience closes the tab. **(owner)**
- **It names or mocks real competitors.** Every rival vendor is fictional, such as "LegacyFreight 2003". The repo is public, and mocking a real company invites legal trouble. **(owner)** The same goes for customers and candidates: all names are made up.
- **It takes a political side.** War, pandemic and tariff events are described generically ("conflict near a strait") and never name countries or sides. **(design call)**
- **It becomes micromanagement.** The player never assigns individual tasks, and adding offices adds things to watch, not clicks.
- **It feels unfair.** GoFreight products help in ways that make sense in the real world. They aren't magic buttons, and a player who skips them can still finish a run.

## 3. Constraints

- **Front end only, no server.** Progress is saved in the browser's `localStorage` (§16). **(owner)**
- **Hosted on GitHub Pages** from this public repo, at <https://carpusherw.github.io/ff-tycoon/>, deployed by GitHub Actions. **(owner)**
- **React + TypeScript, no game engine.** The game is mostly screens of numbers and choices, which is UI work. **(owner)**
- **The game rules live in plain TypeScript, separate from React.** The simulation (tasks, staff, events, money) has no UI dependency, so it can be tested and tuned on its own. It uses a seeded random number generator, so a run can be replayed exactly in tests. **(owner)**
- **Laptop first, works on phone.** Design each screen at laptop size, then make sure it works at phone width (no sideways scrolling at 375 px). **(owner)**
- **"Book a demo" links to GoFreight's existing demo page**, <https://gofreight.com/get-demo>, and opens in a new tab. **(owner)**
- **Lively world map with ships moving** between the ports of shipments the player handles. **(owner)**
- **Three languages at launch: English (default), Traditional Chinese and Simplified Chinese.** **(owner)** All player-facing text goes through translation: UI labels, log lines, tooltips and the end screen (later also events, the news ticker and the run story). The default comes from the browser language, falling back to English, and the player can switch in settings. **(design call)** Proper names (fictional customers, candidates) stay the same in every language. **(builder)**
  - **Chinese wording uses the terms Taiwan and mainland forwarders use**, e.g. OP / 操作 for Operations and 帳單 / 账单 for invoices. The owner asked for researched industry terms; they're recorded in [`docs/i18n/zh-glossary.md`](../../i18n/zh-glossary.md). **(owner)**
  - **Money shows as a plain "$" in every language**, not "US$". **(owner)**
- **Light and dark mode.** The game follows the browser's light/dark setting and falls back to light when the browser doesn't say. **(owner)** Settings also have a light/dark/follow-the-browser switch. **(design call)** Both themes keep the map, ships and task queues easy to read.
- **It's a side project for now.** No marketing or brand approval process is assumed. **(owner)** GoFreight appears by name, and its products' effects live with the rest of the balance numbers.
- **No launch deadline.** The build delivers playable steps rather than everything at once (§19). **(design call)**

## 4. The run at a glance

1. **Setup.** The player picks a difficulty mode (§13) and a city for their first office from a short list of major freight cities. **(owner)** The company starts with a bootstrap fund, the **owner as its only employee**, and a few **starter agents** in other countries, so shipping is possible from day one (§10). **How many starter agents depends on the difficulty.** **(owner)**
   - *M1:* five cities (Taipei, Shanghai, Singapore, Los Angeles, Rotterdam), $60,000 starting cash, Normal mode only with 2 starter agents. The mode picker is *Planned (M6 Market events & modes, #13)*.
2. **Play.** In-game time runs day by day. The player can pause or speed up (except in Hardcore, §13). Tasks flow through the departments, staff work them automatically, and the player makes management decisions: hire, open departments, buy software, sign agents, open offices, take loans, and react to market events.
   - *M1:* the decisions are hiring and choosing which department the owner works in. *M2* adds signing agents, opening offices and choosing which office the owner works in (§10). The rest arrive with later milestones (§19).
3. **End.** The run ends after **10 in-game years**, or earlier through bankruptcy. The end screen shows the company value breakdown and a "Book a demo" button (§15).

**Pace: one real second per in-game day at 1×.** **(owner)** The player picks **pause, 1×, 3× or 5×**, so a full 10-year run (3,600 days; 30-day months, 360-day years) takes about **60 minutes at 1×, 20 minutes at 3× and 12 minutes at 5×**. **(owner)** This replaces the original "15–20 minutes at 1×" target: after play-testing, the owner wanted a calmer 1× and faster speeds for players who know what they're doing. Auto-pause on important moments (§16) lets the player react at any speed.

## 5. Core loop: tasks and queues **(owner)**

This is the heart of the game and was the owner's idea.

### Words used in this document **(owner)**
- **Task:** one piece of work for a department, such as "Quote · Acme Toys" or "Booking · SHA→LAX".
- **Workload:** how much work a task needs, as a plain number, for example 3. The screen shows progress as "1.5 / 3".
- **Speed:** how much workload an employee gets through per day.
- **Capacity:** how many tasks an employee can keep open at the same time.
- **Minimum duration:** the fewest days a task can take, however fast the employee is (see below).

### How work gets done
- Each **department has a queue of tasks**.
- A **task** has a **deadline**, a **workload**, and a **minimum duration**. The minimum duration is the time it can't be done faster than, because someone else has to reply: the carrier confirming a booking, the customer sending documents, a sailing cut-off. **(owner)**
- An **employee** keeps up to **capacity** tasks open at once and spreads their **speed** across them each day. A task can only absorb so much per day: **workload ÷ minimum duration**. Speed it can't absorb goes to the employee's other open tasks. **(owner)**
- **Example:** a booking with workload 2 and a minimum duration of 4 days absorbs at most 0.5 per day. An operator with speed 2 and capacity 1 spends most of the day waiting. With capacity 4, the same operator's whole day is used. This is why real operators juggle many shipments, and why software that raises capacity (§11) is valuable.
- When every employee's capacity is full, the remaining tasks wait in the queue.
- When a task is finished it **creates the next task(s) in the chain** below. The final tasks bring in the money.

**Queue order:** earliest deadline first decides which waiting task gets opened next (ties go to the oldest task). Each employee also works their own open tasks in that order. **(design call, built)** The player doesn't reorder tasks, because that would be micromanagement.

**The tasks built so far** **(builder)** (M1, plus local charges in M2):

| Task | Department | Workload | Minimum duration | Deadline |
|---|---|---|---|---|
| Quote | Sales | 1–2 | 1 day | 5 days |
| Booking (origin) | Operations | 1.5–2.5 | 4 days | 10 days |
| Arrival (destination) | Operations | 1–2 | 3 days | 8 days |
| Invoice | Accounting | 0.5–1 | 1 day | 5 days |
| Local charges | Accounting | 0.5–1 | 1 day | 5 days |

**Due labels** **(owner)**: each task card says **"due in N d"** while more than 3 days are left, a red **"due soon"** from 3 days down to the deadline day, and a red **"overdue"** once the deadline has passed. Each department's header shows a red **"N late"** badge while it has overdue tasks, and hides it at zero.

### The two ends of a shipment **(owner)**

Every shipment has an **origin** and a **destination**, the industry's terms. Each end is handled by either **one of the player's offices**, whose tasks appear on screen, or a **partner agent** (an *origin agent* or a *destination agent*), who works off-screen and takes a cut.

The **selling office** is the player's office whose Sales won the customer. It can sit at either end:
- **Export:** the customer ships out of the selling office's country. The selling office is the origin.
- **Import:** the customer is buying from overseas into the selling office's country. The selling office is the destination, and an origin agent (or another of the player's offices) books and loads the cargo overseas.

*M1:* the home office sells both exports (about 60% of requests) and imports; the far end is always a starter agent. *M2:* every office sells for itself, the same way. Each request goes to or from one of that office's **lanes** (the other covered regions, picked evenly). The far end is the player's own office in that region if it has at least one employee, otherwise the region's agent. **(builder)** An office with nobody in it yet doesn't work other offices' far ends.

### The task chain **(owner)**

```
SELLING OFFICE      Pricing ──► Sales ──► (won)
                                            │
ORIGIN END          your office:  Ops: booking ──► Customs: export (if opened) ──► Accounting: origin charges*
                    origin agent: handled off-screen
                                            │
                                       ship sails          while at sea: Customer Service inquiries
                                            │              go to the selling office
                                       ship arrives
                                            │
DESTINATION END     your office:  Ops: arrival ──► Customs: import (if opened) ──► Accounting: destination charges*
                    destination agent: handled off-screen

SELLING OFFICE      Accounting: invoice the customer ──► cash

* Only when that end is one of the player's offices other than the selling office.
  At the selling office's own end, its local charges go on the customer invoice.
```

*M1 builds the chain without Pricing, Customs, Customer Service or local charges:* Sales → Ops booking (or the origin agent) → the ship sails → it arrives → Ops arrival (or the destination agent) → Accounting invoice. *M2 adds local charges:* when the far end is one of the player's offices, its Ops booking or arrival creates a **Local charges** task in that office's Accounting.

- A **won** quote creates the origin tasks. A **lost** quote creates nothing (§7).
- **The ship sails on the map when the origin work is done.** That means the booking, plus export customs if the origin office has a Customs department. If the origin is an agent, the agent's work takes a few days off-screen (5 days in M1). **(owner)**
- **Destination work waits for the ship to arrive.** Route disruptions (§12) delay arrival and everything after it, including the money. **The voyage is part of the rules, not decoration.** **(owner)** Ships cover 750 km a day, about real slow-steaming speed: Shanghai → Los Angeles takes about 15 days and Shenzhen → Rotterdam about 25. **(builder)**
- **Billing** **(owner)**:
  - The selling office invoices its customer: an export customer when the ship departs, an import customer when it arrives. **(design call on timing, built)**
  - Any other office of the player's on the shipment bills its own local charges (origin or destination charges). This is one reason an office is worth more than an agent. *M2:* $250–$450 per shipment, paid when that office's Local charges task is done. A shipment with local charges isn't finished until they're paid. The task card shows a "Local charges +$amount" tag.
- **Agent ends** are off-screen. The agent takes its profit share: 25% of the shipment's margin. An own office at the far end takes no share.
- Customer Service tasks aren't part of the chain. They come up while the shipment is at sea, at the selling office, because the customer belongs to it (§9). *Planned (M3 Specialist departments & satisfaction, #10).*
- Customs is a revenue unlock (§6). Without a Customs department at an end, that end's customs step is skipped and earns nothing. *Planned (M3 Specialist departments & satisfaction, #10).*

### Missed deadlines **(owner)**

| Department | When a task misses its deadline | M1 |
|---|---|---|
| Pricing | The task goes on to Sales anyway, with the rough-rate factor (§7). Nothing is lost except win chance. | *Planned (M3 Specialist departments & satisfaction, #10)* |
| Sales | The quote is lost, and the customer went to a competitor. | Built |
| Operations | A penalty fee (missed carrier cut-off), and the customer's satisfaction drops. | $600 fee, charged once; the task stays until done. Satisfaction *planned (M3 Specialist departments & satisfaction, #10)*. |
| Customs | A penalty fee, and satisfaction drops. | *Planned (M3 Specialist departments & satisfaction, #10)* |
| Customer Service | Satisfaction drops. | *Planned (M3 Specialist departments & satisfaction, #10)* |
| Accounting | The customer pays late, and you lose a small amount. | $150 late fee, charged once. A late Local charges task costs the same (M2). |

## 6. Departments

### The specialist rule **(owner)**

There are two kinds of department:

- **Core departments**, available from the start: **Sales, Operations, Accounting.**
- **Specialist departments**, opened later as upgrades: **Pricing, Customer Service, Customs.** *Planned (M3 Specialist departments & satisfaction, #10).*

**Before a specialist department is opened, someone else does that work badly. After it's opened, a specialist does it well.** So opening a department is always a clear upgrade and never just extra complexity. That's also why the owner rejected a separate Documentation department: splitting it out of Ops added work without any benefit. **(owner)**

Opening a specialist department costs a one-time setup fee. It does nothing until someone is hired into it. **(design call)**

### Department list

| Department | Type | What it does | Before it's opened |
|---|---|---|---|
| **Sales** | core | Turns quote requests into won or lost shipments (§7). | — |
| **Operations** | core | Bookings at origin, arrivals at destination. Also handles tasks sent by partner agents (§10). | — |
| **Accounting** | core | Invoices customers and bills local charges (§5). Finishing these tasks brings in the money. | — |
| **Pricing** | specialist **(owner)** | Every quote request starts here. Finishing on time gives Sales the good-rate factor (§7). | Requests skip Pricing and go straight to Sales with the **rough-rate factor**, because salespeople guess rates. |
| **Customer Service** | specialist **(owner)** | Answers "where's my cargo?" inquiries while shipments are at sea. Answering on time keeps customers satisfied (§9). | Inquiries go into the **Operations queue** and eat Ops time. **(design call)** |
| **Customs brokerage** | specialist, **revenue unlock** **(owner)** | Export clearance at origin, import clearance at destination. Adds a Customs task to that end and extra revenue. | No customs revenue at that end. The step is skipped. |

Each office (§10) has its own departments. **(owner)**

**"Work here" in every department** **(owner)**: each department column has a **"Work here"** button that moves the owner into it; the column the owner is in shows "You work here" instead. Moving sends the owner's open tasks back to the queue with their progress kept. **(builder)** This replaced a separate "where you work" panel.

## 7. Winning quotes **(owner)**

```
win chance = salesperson win rate × pricing factor  + RMS bonus + satisfaction bonus + other bonuses
```

- **Salesperson win rate** is a stat of the employee who works the quote (§8).
- **Pricing factor:** **good rate** (e.g. ×1.0) if the Pricing task finished on time. **Rough rate** (e.g. ×0.6) if it was late or there's no Pricing department. **(owner: the idea of two rates or a factor; the numbers are builder tuning)**
- **RMS** speeds up Pricing work **and** adds directly to win chance. **(owner)**
- **Satisfaction bonus** for happy repeat customers (§9). **(owner)**
- Market events can change any of these (§12).
- Clamp the result to a sensible range, such as 5–95%. **(builder)**

*M1:* there's no Pricing department yet, so every quote uses the rough rate: **win chance = win rate × 0.6**, clamped to 5–95%. The other bonuses are planned: the good rate and the satisfaction bonus with M3 Specialist departments & satisfaction (#10), RMS with M4 Software & GoFreight (#11) and event effects with M6 Market events & modes (#13).

The top bar shows the company's overall quote win rate.

## 8. Staff and hiring **(owner)**

### Employee stats
Each employee has:
- **Speed:** how much workload they get through per day (§5).
- **Capacity:** how many tasks they can keep open at once (§5).
- **Win rate:** only matters for Sales.
- **Potential:** the ceiling their stats can grow to through experience. *Planned (M5 Staff depth & loans, #12).*
- **Salary:** paid monthly. It starts at what they asked for when hired.

Stats grow with experience toward potential. **(owner: the idea of potential; the growth curve is builder tuning)** *Planned (M5 Staff depth & loans, #12).*

**Salaries rise every year.** **(owner)** Each employee gets an automatic yearly raise, bigger for those whose stats grew that year, so a star employee becomes expensive over time. **(owner)** Raise sizes are builder tuning. *Planned (M5 Staff depth & loans, #12).*

**The owner** starts with speed 1.2, capacity 3 and a 45% win rate, and takes no salary. **(builder numbers)**

**Staff on screen** **(owner)**:
- Each department shows its staff as small **chips** (avatar plus "open / capacity"), in **at most two lines**. When more staff don't fit, a **"+N"** chip opens the full list. The row never scrolls, so task lists start at about the same height in every column. **(owner asked; the two-line limit is builder)**
- Clicking a chip, **including the owner's** ("You"), opens a small **stats card**: speed per day, capacity, win rate (for Sales staff and the owner), and salary per month or "No salary".

### Hiring works like a gacha roll **(owner)**
- The player pays to **post a job ad** for a chosen department and office ($800 in M1).
- The game **rolls a few candidates** (3 in M1, **builder**). Each has their own stats, potential and asking salary. Better rolls ask for more money.
- The player reviews them and **hires one, or pays to re-roll** ($400 in M1).
- **The player can hire several candidates from one roll.** **(owner)** The dialog stays open after a hire with a short "Hired {name}!" note. Each candidate sits in a **fixed slot**: a hired one becomes a "Hired ✓ {name}" placeholder of the same size, so the other cards never move. The dialog closes when the player closes it; **re-roll** refills every slot with new faces. Before each hire it shows the monthly cost, e.g. "Hiring Nora: −$3,200 / mo".
- Candidates come from **that office's country pool**, so each country has its own profile. For example, one country's candidates are cheaper but less experienced, another's cost more but have higher win rates. **(design call, built:** each country scales salary and skill; capacity is the same everywhere**)**
- Rolls cost **in-game cash only. There is never real money.** **(design call)**

### Placement rules **(owner)**
- An employee **stays in the department they were hired for.**
- **Only the owner can move** between departments and offices. Early on, that's how a one-person company covers everything.
- The owner isn't paid a salary. **(design call)**
- The player can let an employee go, with a small one-off cost. **(design call)** The owner kept this for a later milestone. **(owner)** *Planned (M5 Staff depth & loans, #12).*

## 9. Customers and satisfaction **(owner)**

*Planned (M3 Specialist departments & satisfaction, #10).* In M1, customers are named fictional companies that send quote requests (new prospects and repeat requests from active customers), but there's no satisfaction score yet.

- Customers are named, fictional companies.
- Each has a hidden **satisfaction score from 0 to 100**, shown simply on screen as **5 stars or a bar**. **(owner)** New customers start in the middle. **(design call)**
- Many things move the score a few points. **Good service** (deadlines met, inquiries answered on time) raises it. **Bad service** (Ops or Customs penalties, ignored inquiries) lowers it. **At 0 the customer leaves.**
- A higher score does two things: the customer **sends quote requests more often**, and quotes for them **win more easily** (the satisfaction bonus in §7). **(owner)**
- The customer portal & tracking product (§11) cuts down inquiries and raises satisfaction faster.
- **Rival forwarders:** a market event (§12) in which a competitor runs a price promotion. **Unhappy customers may leave for it, and happy ones stay.** This is a reason to keep satisfaction high, not just above zero. **(owner)**

## 10. Offices and agents **(owner)**

*M1:* one home office and the starter agents. *M2* builds signing agents, opening offices, agent handling tasks and switching between offices. Every agent has a made-up company name, shown on its map pin. Where the player also has an office in that region, the office pin replaces the agent's pin: the agent stays signed, keeps sending handling tasks and still counts in the legend's "Agents · M", but nothing on the map shows it. The player signs agents and opens offices on the map (§16).

Forwarders handle **both exports and imports**. At each end of a shipment, the work is done by one of the player's offices or by a partner agent (§5).

**Prices** **(owner)**:
- **Signing an agent** costs $5,000 once, plus its 25% profit share of each shipment it handles.
- **Opening an office** costs $50,000, plus monthly rent that depends on the country: $2,000 × the country's rent factor, for example $3,600 in Los Angeles and $1,400 in Ho Chi Minh City. The home office pays $2,000. Players see the rent amount, never the factor.
- Both costs equal what the agent or office adds to company value (§15), so expanding doesn't change the score by itself.
- A button the player can't afford is disabled, and the rules refuse it too, so cash never goes below zero because of it.

### The coverage rule **(owner)**
- Coverage is **by country, with big countries split into regions**: for example the US into West Coast, East Coast and Gulf, and China into north and south. The exact list is builder data.
- **A shipment can only be taken if both ends are covered**, by one of the player's offices or by an agent, in that country or region. No partner there means no shipment. This keeps "sign agents to open up the map" a clear, fun progression.
- **Starter agents depend on the difficulty**, for example more on Easy and fewer on Hardcore. **(owner)** M1 sets 3 / 2 / 1 for Easy / Normal / Hardcore; only Normal is playable so far. **(builder)** They're drawn at random from ports outside the home country.
- *M2:* **23 ports, each its own region** **(owner: the ports)**. The US is split into West Coast (Los Angeles), East Coast (New York) and Gulf (Houston), and China into north (Shanghai) and south (Shenzhen). The other 18 are Taipei, Singapore, Busan, Tokyo, Rotterdam, Hamburg, Sydney, Dubai, Vancouver, Manzanillo, Santos, Felixstowe, Genoa, Durban, Ho Chi Minh City, Mumbai, Jakarta and Laem Chabang. A full network is the home office plus 22 agents or offices.

| | **Agent** | **Office** |
|---|---|---|
| What it does | Handles its end of the player's shipments, off-screen, as origin or destination agent | The player's own staff handle that end and bill its local charges (§5) |
| Cost | Cheap to sign, then takes a **profit share** of each shipment it touches | One-time opening cost, plus **rent** and the **salaries** of its staff |
| Brings in customers? | **No.** It sells for itself, not for you. | **Yes.** Its own salespeople win local exporters and importers. |
| Extra tasks | **Sends the player handling tasks:** its own customers' shipments to or from the player's countries, where the player acts as its agent. These **skip Pricing and Sales** and go straight to Ops (plus Customs and local-charge Accounting where opened) for a smaller fee. **(owner)** | — |
| Volume | Both raise the volume of tasks on lanes touching that country or region, at all the player's offices. **(owner)** | |

- **Volume as built** **(owner)**: each office's new customers per day are M1's rate (0.35) × √(lanes ÷ 2). In plain words, 4× the places abroad gives 2× the new customers; a full network gives each office about 3.3× M1's. Repeat requests from active customers work as in M1.
- **Agent handling tasks as built** **(owner)**: each agent sends about one every 12 days (an 8% chance a day), for a fee of $300–$500.
  - It goes to one of the player's offices outside the agent's region that has someone in Ops (the owner counts while working there), picked evenly. With no such office, the agent sends nothing.
  - It can't be refused, and late fees apply as usual.
  - It skips Sales and goes straight to Ops: a booking for an export; for an import, the agent's 5 days of origin work and the voyage, then an arrival. The Ops task creates a Local charges task that bills the fee. There's no customer and no invoice.
  - Its task cards carry the agent's name and an "Agent job +$fee" tag (指定貨 / 指定货 in Chinese).
- **An office and an agent can coexist** in the same country or region. **(owner)** The player's office handles the player's own shipments there, the agent keeps sending its handling tasks to the player's other offices, and the region counts once as a lane. Ending an agent contract was left out of M2 **(owner)** and is parked (§18).
- **A new office starts empty.** **(builder)** Until it has at least one employee, it isn't a lane or a far end for the other offices (its region uses its agent, if any), and agents send it no handling tasks. Its own quote requests still come in and expire quietly, with no fee, until someone works there.
- **The intended progression:** sign agents early because they're cheap and open up the map, then open offices in the busiest places once the business can afford them. **(design call)**
- **Agent handling tasks** create a tension worth keeping: they're welcome when sales are slow, but they compete with the player's own higher-margin shipments when Ops is busy.

### Managing several offices **(owner)**
- **Each office has its own departments, staff and queues.** This keeps the "staff can't move" rule meaningful and gives each country its own hiring pool. Each job ad hires from its office's country pool.
- **Cash and software are shared** across the company. Each office pays its own rent.
- The player switches offices by **clicking its pin on the map** (or tabs on phone). *M2:* with two or more offices, an **office switcher** sits between the map and the departments: one button per office, plus previous / next arrows (keys **[** and **]**). On phone it's at the top of the Offices tab and scrolls sideways inside its row. Opening an office switches the board to it. **(owner)**
- A **company overview** flags the struggling office ("Los Angeles: Ops queue overloaded"). *M2:* the overview is the switcher's badges. A star marks the office the owner works in, a red "N late" counts its overdue tasks, and "No staff yet" marks an office with nobody in it.
- **The owner moves between offices instantly**, like changing departments **(owner)**: "Work here" in another office's department, or S / O / A in the office on screen, moves the owner there.
- Whether running several separate offices is fun or tiring is still to be **confirmed in play**.

## 11. Software and upgrades

*Planned (M4 Software & GoFreight, #11).* One-time upgrades are to be brainstormed with the owner first.

Every software product is a **monthly subscription**. **(owner)** Some other upgrades are **one-time purchases**. **(owner)** The second monitor below is only an example. The full list of fun one-time upgrades is to be brainstormed with the owner during the build phase. **(owner)**

**Software mainly raises capacity**: it tracks follow-ups for staff, so they can keep more tasks open (§5). AI mainly raises speed or shortens minimum durations. **(owner)**

| Product | Requires | Effect (values are builder tuning) |
|---|---|---|
| **Second monitor** (one-time, example only) | — | All staff in that office slightly faster |
| **Established FMS vendors** (fictional, e.g. LegacyFreight 2003) | — | Ops (and maybe Accounting) capacity a little higher. Each has its own weak spot, e.g. clunky, expensive or slow to improve. |
| **GoFreight FMS** | launches mid-run outside Easy | Ops and Accounting capacity much higher (invoices come from shipment data) |
| **Established RMS vendor(s)** (fictional) **(design call)** | — | Pricing a little faster |
| **GoFreight RMS** | launches mid-run outside Easy | Pricing faster **and** win chance up **(owner)** |
| **GoFreight FMS + RMS combo** | both | **Extra bonus** for owning both **(owner)**. Builder picks the bonus. One suggestion: Sales gets a speed boost from live rates appearing in quotes. |
| **GoFreight AI** | GoFreight FMS **or** GoFreight RMS **(owner)** | Big speed boost and shorter waits on the departments its parent products cover (e.g. it reads emails and documents into shipments) |
| **Customer portal & tracking** | GoFreight FMS **(owner)** | Far fewer "where's my cargo?" inquiries, and satisfaction rises faster |

- **Only one FMS and one RMS at a time.**
- **Software is priced per office per month.** **(design call)** Expanding raises software cost, which keeps the cash flow display relevant.
- **Effects should make sense in the real world** (see the anti-goals). GoFreight's advantage must be clear, but a player who never buys it can still finish a run.

### GoFreight arrives later **(owner)**

GoFreight is a startup that enters the market after the established vendors. That's more realistic, and it turns "buy GoFreight" from an obvious click into a real decision.

- **Easy mode:** GoFreight products are on the upgrade list from the start. **(owner)**
- **Normal and Hardcore:** at the start, the list offers only **a few fictional established vendors**. **(owner)** Give them clear personalities, for example a cheap but clunky one ("LegacyFreight 2003") and an expensive, solid but slow-moving one. **(design call)** A growing company will probably need to buy one of them early or mid-game to keep up. **(owner)**
- **GoFreight launches partway through the run, on the same schedule in Normal and Hardcore.** **(owner)** It's announced on the news ticker ("Startup GoFreight launches a cloud FMS"). Products can arrive one at a time, like a startup's roadmap: for example FMS first, then RMS, AI and the customer portal later. Exact years are builder tuning, with a rough start of GoFreight FMS around year 3. **(design call)**
- **Switching vendors is a real decision with a short-term cost and a long-term gain**, like a real software switch **(owner)**:
  - *Short-term drawbacks* **(design call)**: a one-time migration fee; a cut-over period of a few in-game weeks when the affected departments work slower while staff learn the new system; one month of paying for both systems; and an early-exit fee if the old vendor's contract still has time left.
  - *Long-term benefits*: GoFreight's stronger effects, plus access to the FMS + RMS combo bonus, GoFreight AI and the customer portal, which all require GoFreight products.
  - The switch should be timed by the player. Switching just before peak season or during a crisis hurts more than switching in a quiet month.
- The established vendors may raise prices over time or fall behind on features, which keeps "should I switch now?" a live question. **(design call)**

## 12. Market events **(owner)**

*Planned (M6 Market events & modes, #13).*

A random event system makes every run tell a different story and keeps the map alive.

| Group | Examples | Game effect |
|---|---|---|
| Rates jump | Rate spike / peak season, fuel surcharge jump, carrier alliance reshuffle | Rates go stale quickly (a rough-rate factor is more likely), and quotes on old rates lose money or deals |
| Routes disrupted | Conflict near a strait, canal drought, ship stuck in a canal, port strike, typhoon, Lunar New Year shutdown | **Ships visibly reroute or stop on the map**, transit gets longer, destination work and money come later, and more CS inquiries come in |
| Demand swings | Tariff announcement (rush, then slump), pandemic (crash, boom, container shortage, rates up many times over), e-commerce boom | Request volume rises or falls, and rates move |
| Company shocks | Carrier bankruptcy, cyberattack on a carrier, rival forwarder promotion (§9) | Emergency Ops work, frozen bookings, unhappy customers lost |

- **A news ticker gives warning** a week or two before most events, so a good player can prepare. **(design call)**
- **Not every event is bad.** Surges reward players who have built capacity. Good events also exist. **(owner: probabilities of bad and good events vary by mode)**
- **GoFreight products help fairly during events:** RMS refreshes rates during spikes, tracking and the portal cut inquiry floods during delays, and AI absorbs volume surges. **(design call)**
- **Pacing:** about 3–5 events per in-game year on Normal, with at most one major crisis (such as a pandemic) per run. **(design call)**
- **Wording is generic:** no real country names or sides for wars or tariffs (see the anti-goals).

## 13. Difficulty modes **(owner)**

*M1 plays Normal only.* Easy, Hardcore and the mode picker are *planned (M6 Market events & modes, #13)*.

| Mode | Pace | Events | Starter agents | Clock |
|---|---|---|---|---|
| **Easy** | Slower | Fewer bad, more good. Maybe more starting cash. | More | Auto-pause on important moments |
| **Normal** (default) | The baseline the game is tuned around | Balanced | Some | Auto-pause on important moments |
| **Hardcore** | Faster | More frequent and harsher bad events. Maybe shorter ticker warning. | Fewer | **Never pauses on its own**, not even while hiring or during market events, like real life |

- **GoFreight availability:** from the start on Easy. Mid-run on **both** Normal and Hardcore, on the same schedule (§11). **(owner)**
- The Hardcore rules above are examples. More are to be brainstormed later. **(owner)**
- **Every score is labeled with its mode**, such as "$8.2M · Hardcore", so players compare like with like. **(owner)** Luck still differs between runs in the same mode, which is accepted. **(owner)** The M1 end screen already shows the mode.

## 14. Money

**Revenue:** the player's own shipments (customer invoices), local charges billed by the player's other offices, customs fees, and agent handling fees.

**Costs:** salaries (monthly, rising yearly), office rent (monthly), software subscriptions (monthly), agent profit share (per shipment), penalties, recruiting (job ads and re-rolls), expansion (signing agents and opening offices), department setup fees, one-time upgrades, and loan interest and repayments.

*M1:* revenue is customer invoices only. Each shipment's margin grows with the length of the voyage, and the agent's share comes off it. Costs are salaries, $2,000 a month office rent, the agent's share, late fees, and job ads and re-rolls. Salaries and rent are paid at each month end.

*M2:* revenue adds local charges and agent handling fees (§5, §10). Costs add expansion ($5,000 per agent, $50,000 per office, paid at once) and each office's rent.

**Cash flow is always visible** **(owner)**: the top bar shows the **net per month** (e.g. "+$1,100 / mo" or "−$500 / mo"). The player can open a breakdown of revenue, salaries, rent, software and loans, and see how a decision would change it before confirming (e.g. "Hiring Nora: −$3,200 / mo"). **(design call)** *M1:* the "Money this month" panel shows invoices paid in the last 30 days, salaries, rent, net cash flow and cash on hand; the hiring dialog shows each candidate's monthly cost. *M2:* the first line reads "Payments received (last 30 days)", because local charges and handling fees count too, and rent is the total for all offices. Each Open office button shows the new rent ("+$1,800 / mo rent") before the player confirms.

### Yearly report **(owner)**
At the end of each year the clock pauses (with auto-pause on) and a **"Year N report"** opens with that year's numbers: payments received (invoices paid in M1; local charges and handling fees too from M2), salaries, rent, late fees, **hiring (job ads and re-rolls)**, **expansion (agents and offices)** (M2), **profit**, cash at the start → end of the year, quotes won / lost and the win rate, shipments delivered, and staff at year end. Profit counts every cost, so **profit always equals the change in cash** over the year. **"Continue"** (or Enter / Space / Esc) resumes at the speed the player had. With auto-pause off, no report pops up. The final year's report is shown on the end screen instead (§15).

### Loans **(owner)**
*Planned (M5 Staff depth & loans, #12).* Until then, **the company goes bankrupt when cash is below zero at a month end.**

- **The player can take a loan at any time**, up to a limit based on company value, with monthly interest and repayments. **(design call)**
- **Emergency loan:** if cash goes below zero, the bank steps in automatically at a worse rate. **(design call)**
- **Game over** happens when a repayment is due and can't be paid. **(owner)**

## 15. Scoring and the end screen

**Final score = company value** **(owner)**:

```
company value = cash − outstanding loans
              + network       (each office ≈ what it would cost to set up again; each agent contract a little)
              + customer book (each customer ≈ one year of the profit they bring, weighted by their satisfaction)
```

The formula shape is a **(design call)**. The weights are builder tuning.

*M1:* company value = cash + network ($50,000 per office, $5,000 per agent) + customer book (what active customers paid over the last 360 days). Loans arrive with M5 Staff depth & loans (#12) and the satisfaction weighting with M3 Specialist departments & satisfaction (#10). *M2:* the same formula, now with every office and agent the player adds. Signing or opening costs exactly its network value, so it moves money from cash to network. The customer book counts customer invoices only, not local charges or handling fees. In Chinese, "Network" is 版圖 / 版图 **(owner)**.

**End-of-run screen:**
- The headline value with its breakdown, e.g. "Cash $2.1M + Network $1.4M + Customer book $4.7M = **$8.2M** · Normal". *Built.*
- **The final year's numbers** **(owner)**: the same figures as the yearly report (§14), titled "Your final year (year 10)". After a bankruptcy it shows "Your last full year". *Built,* with the Expansion row since M2.
- A short story of the run: offices opened, staff hired, events survived. *Planned (M7 Balance & polish, #14).*
- A **"Book a demo with GoFreight"** button linking to the existing demo page, with the line "Real forwarders run on GoFreight. See it for real." **(owner: book a demo; the owner approved the wording)** Plus "Play again".

**Bankruptcy screen:** the same breakdown, the year the company fell, and the same button with "See what would have kept you afloat." **(design call, built)**

**The end isn't abrupt** **(owner)**: when a run ends, the board freezes (the clock stops and nothing can be clicked) and a short scene plays over it, then cross-fades into the end screen.
- A **completed** run gets **fireworks** and "10 years in business!" for about 2.5 seconds. **(owner)**
- A **bankrupt** run gets a **"Closed" stamp** dropping onto the board for about 1.8 seconds, because fireworks would be wrong for a bankruptcy. **(builder)**
- Any click, tap or key **skips** straight to the end screen. With reduced motion turned on, the scene is static and the fade is short. Reloading a finished run goes straight to the end screen, without replaying the scene.

## 16. Screens and UI

**Main screen (laptop)** **(owner: layout; details builder)**:
- **Fixed height:** the screen fills the browser window and the page itself never scrolls. Each department's task list scrolls inside its column (its header and staff stay put), and the log scrolls inside its card. **(owner)**
- A **top bar** with cash, net cash flow per month, the in-game date ("Year X of 10 · Day N"), the speed buttons (pause / 1× / 3× / 5×), company win rate, shipments per operator per month, staff count, a **keyboard-shortcuts** button and a **settings gear**. **(owner)**
- Below it are the **world map**, the office switcher (with two or more offices, §10), the **department columns** of the office on screen with staff and task queues, and a **side panel** with "Money this month" and the "What happened" log. Upgrades and loans join it in later milestones; agents and offices are handled on the map. **(owner)**
- **Hiring buttons** **(owner)**: each department header has its own **"Hire · $800"** button for the office on screen, right-aligned in the header's tools row, so it never moves when the owner moves in or out or when a late badge appears. Its tooltip is one line, e.g. "Post a job ad for Operations: 3 candidates (⇧ O, or H when you work here)". In Chinese the button reads 招募 · $800 / 招聘 · $800, and the tooltip names the department with the glossary's hiring verb and department name: **招募業務 / 招募 OP / 招募會計** and **招聘销售 / 招聘操作 / 招聘财务**, replacing M1's 為…招募 / 为…招聘. In M1 these buttons sat in a Hire card in the side panel.
- Numbers that change constantly (cash, cash flow, date, win rate, shipments per operator, task progress) keep a fixed width, so the layout doesn't jitter as they tick. **(owner asked; builder)**
- **Resuming keeps your speed:** after any pause, resuming returns to the last speed the player chose (1× on a fresh load). While a pause reason holds the clock (a year-end report, the hiring dialog), the speed buttons are locked. **(owner)**

**Task cards** show the task's name, its due label (§5), and progress as "1.5 / 3" with a bar. Each employee chip shows how many of their capacity slots are in use (e.g. "3/4"). **(design call)**

**Settings** sit **behind the gear** in the top bar, in a dialog **(owner)**: language, theme (follow the browser / light / dark), pause at each year end, and New game (asks to confirm first).

**Keyboard shortcuts** **(owner asked; bindings are builder, approved by the owner)**. Keys are physical keys, the same in every language, and they're ignored while typing in a form field or when combined with Ctrl / Cmd / Alt:

| Key | Action |
|---|---|
| Space | Pause or resume |
| 1 / 3 / 5 | 1× / 3× / 5× speed |
| S / O / A | Owner works in Sales / Operations / Accounting of the office on screen |
| Shift+S / Shift+O / Shift+A | Post a job ad for Sales / Operations / Accounting of the office on screen |
| H | Post a job ad for the office and department the owner works in |
| [ / ] | Previous / next office (M2) |
| ? or / | Show the shortcut list |
| In the hiring dialog: 1 / 2 / 3, R, Esc | Hire that slot's candidate, re-roll, close |
| In the year report: Enter, Space or Esc | Continue |

Tab is left alone so it keeps moving keyboard focus. There's no key for expanding. **(owner)** While a dialog is open, only that dialog's keys work. Every button with a shortcut shows it in its **tooltip as "action (key)"**, with the key drawn as a small keycap, e.g. "Pause (Space)" or "3× speed (3)". **(owner)**

**Phone** **(owner)**: the top bar, map and a bottom tab bar stay fixed and the active tab scrolls. The tabs are **Offices | Money | Log** (辦公室 / 办公室). Offices holds the office switcher and the department **sub-tabs, one per department** ("Sales · 4 tasks · 1 late"), opening on the owner's department, because stacking all three columns was unplayable. **(owner asked; sub-tabs builder)** In M1 the tabs were Departments | Hiring | Money | Log; the Hire buttons moved into the department headers in M2. Taps replace hovers. On the small phone map, only the offices, the agents (with their names) and ports with a ship at sea are labeled.

**World map:** stylized continents, ports, office and agent pins, coverage by country or region, and **ships moving along real-ish sea routes**. During events, affected ships reroute or stop visibly. Clicking an office pin opens that office. **(owner: lively map; drawing approach is builder)** *M1:* an SVG map with 12 ports, the office and agent pins, and ships sailing at 750 km a day; hovering a ship shows its customer and route. Rerouting is *planned (M6 Market events & modes, #13)*.

*M2:* the map has **23 ports** (§10) and is where the player expands. **(owner, from the mockup review)**
- **Pins and ports are buttons.** Each has a hit area at least 32 px across, and opens with a click, a tap or Enter, never Space, because Space always pauses or resumes.
  - An **own-office pin** switches straight to that office. The office on screen has its label outlined in the accent color.
  - An **agent pin** or an **uncovered port** opens a small **pin popup**. Clicking the same pin again, clicking away from it or pressing Esc closes it. Where hit areas overlap, a click goes to the pin or port nearest to where it lands.
- **The pin popup** shows the city, one short line ("Not part of your network yet", 尚未納入版圖 / 尚未纳入版图, or "Agent: {name}. Handles your shipments here.") and up to two buttons, each on one line:
  - **Sign agent · $5,000**, in blue like agent pins. Its tooltip: "Handles your shipments to and from {city} for 25% of the profit, and sends you its own".
  - **Open office · $50,000**, in green like office pins, with "+$R / mo rent" on its own line. Its tooltip: "Your own staff win local customers and bill local charges".
  - A button the player can't afford is disabled, and the popup says "Not enough cash: you have $C."
  - The popup keeps the same size whatever it shows. After signing it stays open, and a same-height "Signed {name} ✓" line takes the Sign agent button's place. Opening an office closes it and switches the board to the new office.
  - It doesn't hold the clock.
- **Labels are placed automatically** so they never overlap; offices first, then agents, then plain ports. A crowded label may sit farther from its pin, with a thin dashed leader line back to it. **(owner)** On laptop every label shows.
- **The legend** shows "Your offices · N" and "Agents · M", with no region count. **(owner)**
- A port dot that a pin head covers is drawn on top of the pin, so it stays visible and tappable. **(builder)**
- **Phone map** **(owner)**: the map is drawn 1.6× the screen's width (about 220 px tall) in a strip that scrolls sideways; the page itself still never scrolls sideways. The strip centers on the office on screen, as far as the map's edges allow: at once on load, then smoothly when the office changes (at once with reduced motion). **(builder: the timing)** A label that doesn't fit near its pin is hidden; the pin stays tappable. On a landscape phone the map is capped in height and shows the whole world without scrolling. **(builder)**
- **On phone the popup is a bottom sheet** **(owner)** that slides up below the map, so the map stays visible and its pins stay tappable. Its content is centered, and a backdrop tap, Esc or its close button closes it. On laptop the popup stays anchored to the pin.

**Hiring screen:** shows the rolled candidates side by side in fixed slots with their stats and salary, plus Hire and Re-roll buttons (§8). Potential is added in M5 Staff depth & loans (#12). **(owner: gacha-style review)**

**Auto-pause** on Easy and Normal for important moments: event warnings, loan warnings, a customer about to leave, the end of a year, and the hiring screen. **(design call)** The player can switch it off. **On Hardcore the clock never pauses on its own** (§13). **(owner)** *M1:* the clock pauses at each year end (with the yearly report) and holds while the hiring dialog is open, both controlled by the "Pause at each year end" setting (on by default). Bankruptcy and the end of the run always stop the clock. The other moments come with their features.

### Saving **(owner: no lost progress; details builder)**
- **One save slot**, autosaved to `localStorage`: at every month change, when the player pauses, and when the tab is hidden or closed. The setup screen offers Continue, or a city to start a new run. **(design call)** If storage isn't available, the game still runs and just doesn't save.
- **Saves stay small.** Finished shipments and history older than **360 days** (the longest window anything reads) are pruned at each month end and on load, and money received and shipments delivered are kept as one total per day (M2). This changes no score or report number. A full 10-year save stays under a budget of **1,500,000 characters** **(owner, M2; it was 500,000 in M1)**, checked by a test, even with every region covered and four offices. Browsers keep about 5.2M characters per site, so this leaves room for the backup copy. This fixed an owner-found bug where a late-game save outgrew storage and the game quietly resumed years earlier.
- **Saves never fail silently.** Whenever a save can't be written, a warning appears ("Couldn't save your progress — storage is full or blocked.") and clears after the next successful save; the end screen says so too. **(owner)**
- **Old saves keep loading.** Each save carries a format version. On load it goes through a **migration chain** that upgrades it step by step to the current version, then it's checked. A set of real saves from each released version is kept as **frozen test fixtures** that must still load and play; a format change adds a new version, a migration step and new fixtures, and never edits old ones. **(owner)** *M2* is format version 2: an M1 save loads into it and plays on, and its agents get names.
- **Nothing is overwritten without a backup.** A save that can't be loaded is copied to a **backup** slot, and the setup screen says so in one plain line. If even the backup can't be written, starting a new game asks to confirm first. **(owner)**
- **Confirm before replacing a run.** Starting a new game over a saved run (from the setup screen or settings) asks first ("Your current run (Year 3, Day 120) will be replaced") and keeps the old run in the backup slot. **(owner)** A "Restore backup" button is a future idea (§18).

## 17. Left to the builder

- All balance numbers: starting fund, salaries and raises, prices, workloads, minimum durations, deadlines, speed and capacity ranges, factors, growth curves, event probabilities, starter agent counts and the score weights. M1's values are in `src/rules/balance.ts`; tuning is M7 Balance & polish (#14).
- Visual style, the art for the map and ships, fonts and colors, in both light and dark themes (keeping it readable and professional for a business audience). Chosen by the owner in M1: see the visual style doc.
- The list of one-time upgrades, to be brainstormed with the owner during the build phase.
- Map drawing approach and map data. M1 uses SVG with hand-drawn coastlines.
- The list of starting cities, ports, sea lanes, and the coverage countries and regions.
- Names of fictional customers, candidates and rival vendors.
- Candidate count per roll (3 in M1), rarity tiers (if any), and re-roll cost.
- Build tooling and tests. M1 uses Vite, Vitest and Playwright, deployed to GitHub Pages by GitHub Actions.
- Sound (optional).

## 18. Ideas parked for later

- Endless mode unlocked after the first run.
- A "challenge of the week" with a shared event sequence, for fair comparisons.
- Passing the score and the player's choices to the demo booking.
- Hosting on gofreight.com.
- A Documentation department. It was rejected for now because splitting it out of Ops adds work without benefit (§6).
- Ad-hoc one-off partners for uncovered countries, with worse margins and more delays (§10).
- More Hardcore rules (§13).
- A "Restore backup" button for the backup save slot (§16). **(owner)**
- Ending an agent contract (§10). The owner left it out of M2. **(owner)**

## 19. Milestones

The game is built in playable steps. Each milestone has its own plan under `docs/superpowers/plans/`.

### Milestone 1: playable core — shipped 2026-11-05

Plan: [`2026-11-04-m1-playable-core.md`](../plans/2026-11-04-m1-playable-core.md). One office plays a full 10-year run through Sales → Ops → Accounting with starter agents, ships on a world map, gacha hiring, salaries, cash flow, bankruptcy, the company-value end screen with "Book a demo", three languages, light and dark themes, browser saves and GitHub Pages hosting.

**Changed after the owner's play-test** (all recorded above as **(owner)** decisions; the plan's original numbers, such as a 290 ms day, are superseded):
- Pace: 1 s per in-game day, with a new 5× speed (§4); resuming keeps your speed (§16).
- Due labels "due in N d" / "due soon" / "overdue" and the per-department "N late" badge (§5).
- "Work here" in each department (§6).
- Staff chips in two lines with "+N", and a stats card for every employee including the owner (§8).
- Hiring several candidates from one roll, in fixed slots, with the dialog staying open (§8).
- The yearly report with hiring costs, where profit equals the change in cash (§14), and the final year on the end screen (§15).
- The end-of-run fireworks or "Closed" stamp (§15).
- Keyboard shortcuts with keycap tooltips, settings behind a gear, the fixed-height laptop layout and phone department sub-tabs (§16).
- Plain "$" in every language and researched forwarder wording in Chinese (§3).
- Saves: pruning, a size budget, the migration chain with frozen fixtures, backups, a confirm before replacing a run, and a warning whenever a save fails (§16).

### Milestone 2: expansion — built 2026-11-06, owner's play-test next

Plan: [`2026-11-05-m2-expansion.md`](../plans/2026-11-05-m2-expansion.md). Scope issue: [#9](https://github.com/carpusherw/ff-tycoon/issues/9). The player signs named agents and opens offices from the map, across 23 ports. Agents send handling tasks, each office sells for itself, and an office at the far end bills local charges. The player switches between offices and moves the owner among them, and the switcher flags late or empty offices. M1 saves load as save format 2.

**Decided by the owner** (recorded above as **(owner)** decisions, made on the plan, at a mockup review and during the build):
- Prices: $5,000 per agent, $50,000 per office plus rent by country (§10).
- 11 new ports, for 23 in total (§10).
- Each office's new customers grow with the square root of its lanes (§10).
- Agent handling tasks: about one per agent every 12 days, $300–$500, only to offices with Ops staff (§10).
- Expanding happens on the map: pin popups instead of an Expand dialog, a bottom sheet on phone (§16).
- Hire buttons in each department header, with the Chinese hire copy 招募業務 / 招募 OP / 招募會計 and 招聘销售 / 招聘操作 / 招聘财务; the side panel is Money and Log again; phone tabs Offices | Money | Log (§16).
- Keys: [ and ] switch offices, and S / O / A and Shift+S / O / A act on the office on screen (§16).
- The phone map is 1.6× the screen's width and scrolls sideways (§16).
- Pins and ports open with Enter, a click or a tap, never Space, which always pauses (the owner's M1 rule, §16).
- The save budget went up from 500,000 to 1,500,000 characters: with a full network, a 10-year save still reaches about 1,000,000 after trimming its history (§16).
- Chinese: "network" is 版圖 / 版图 and "not covered" is 尚未納入版圖 / 尚未纳入版图 (§3's glossary).
- Ending agent contracts was left for later (§18).

**Builder choices the play-test should confirm:**
- A new office counts for the rest of the network only once someone works there (§10).
- "No staff yet" shows on any empty office, including the home office after the owner leaves it.
- An agent in a region where the player also has an office has no pin of its own, so the map doesn't show it, though it keeps sending handling tasks (§10).
- In a Taipei game, part of the Taipei pin opens Shanghai, whose port sits right under it; every port can still be reached (§16).
- The "sent you a shipment to handle" log line comes about twice a day with a full network, and may crowd the log.

**How it was built:** the map work and the final tests were each split into two steps so they could run alongside the rest; nothing changed for the player. The owner's play-test on laptop and phone comes next, and its changes will be added here.

### Later milestones

The roadmap and the milestone order live in [GitHub milestones](https://github.com/carpusherw/ff-tycoon/milestones), with one scope issue each. The order may change there without editing this doc; the *Planned (…)* markers above name the milestone and its issue.

- **M3 Specialist departments & satisfaction:** [#10](https://github.com/carpusherw/ff-tycoon/issues/10) (§6, §7, §9).
- **M4 Software & GoFreight:** [#11](https://github.com/carpusherw/ff-tycoon/issues/11), blocked by #10 (§11).
- **M5 Staff depth & loans:** [#12](https://github.com/carpusherw/ff-tycoon/issues/12), independent (§8, §14).
- **M6 Market events & modes:** [#13](https://github.com/carpusherw/ff-tycoon/issues/13), blocked by #10 and #11 (§12, §13).
- **M7 Balance & polish:** [#14](https://github.com/carpusherw/ff-tycoon/issues/14), blocked by all of the above.

Small Milestone 1 leftovers are tracked in [#6](https://github.com/carpusherw/ff-tycoon/issues/6).
