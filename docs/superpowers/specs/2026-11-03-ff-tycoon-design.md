# FF Tycoon — Game Design

- **Date:** 2026-11-03 (revised 2026-11-04)
- **Status:** Draft for owner review
- **Tracking:** [#1](https://github.com/carpusherw/ff-tycoon/issues/1)
- **Reference mockup:** [`docs/mockups/2026-11-03-game-screen-v1.html`](../../mockups/2026-11-03-game-screen-v1.html). It's a throwaway that shows the map, departments and upgrade panel. Open it in a browser. Its numbers and art are placeholders, and it's out of date in several ways:
  - it calls tasks "jobs" and workload "M/D";
  - each employee works one task at a time;
  - its ships sail as soon as a quote is won;
  - its GoFreight products are available from day one.

  This document is the source of truth.

Each decision below is labeled by who made it:

- **(owner)**: decided by the project owner. Don't change it without asking.
- **(design call)**: chosen during design and not yet confirmed by the owner. The owner should check these while reviewing.
- **(builder)**: left to whoever builds it.

---

## 1. Intent

FF Tycoon is a short, web-based **management** game in which the player runs a freight forwarding company. The player never handles individual shipments. They make the boss's decisions: whom to hire, which department to open, what software to buy, and where to expand. **(owner)**

**Who plays it:** people who work at freight forwarders that could become GoFreight customers, such as managers, operators and salespeople. They should recognize their own daily work in it. **(owner)**

**Why it exists:** it's a fun side project that doubles as marketing. The best outcome is inbound leads: a player finishes a run and books a GoFreight demo. **(owner)**

**What hooks the player:** watching profit grow as their decisions pay off. Sales win more quotes, each operator handles more shipments, and new offices open in new cities and countries. **(owner)**

**The GoFreight moment:** during the run the player decides whether to buy a freight management system, which vendor to pick (GoFreight or a clunky rival), and whether to adopt GoFreight AI. The player should *feel* the difference in their numbers, not read about it. **(owner)**

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
- **It names or mocks real competitors.** Every rival vendor is fictional, such as "LegacyFreight 2003". The repo is public, and mocking a real company invites legal trouble. **(owner)**
- **It takes a political side.** War, pandemic and tariff events are described generically ("conflict near a strait") and never name countries or sides. **(design call)**
- **It becomes micromanagement.** The player never assigns individual tasks, and adding offices adds things to watch, not clicks.
- **It feels unfair.** GoFreight products help in ways that make sense in the real world. They aren't magic buttons, and a player who skips them can still finish a run.

## 3. Constraints

- **Front end only, no server.** Progress is saved in the browser's `localStorage`. **(owner)**
- **Hosted on GitHub Pages** from this public repo. **(owner)**
- **React + TypeScript, no game engine.** The game is mostly screens of numbers and choices, which is UI work. **(owner)**
- **The game rules live in plain TypeScript, separate from React.** The simulation (tasks, staff, events, money) has no UI dependency, so it can be tested and tuned on its own. **(owner)**
- **Laptop first, works on phone.** Design each screen at laptop size, then make sure it works at phone width. **(owner)**
- **"Book a demo" links to GoFreight's existing demo page** and opens in a new tab. **(owner)** The exact URL is a builder detail. Confirm it with the owner before launch.
- **Lively world map with ships moving** between the ports of shipments the player handles. **(owner)**
- **Three languages at launch: English (default), Traditional Chinese and Simplified Chinese.** **(owner)** All player-facing text goes through translation from day one: UI labels, event and news-ticker copy, candidate and customer flavor text, and the end-screen story. The player can switch language in settings. The default comes from the browser language, falling back to English. **(design call)** Whether proper names (fictional customers, candidates) are localized or kept the same across languages is a **(builder)** choice.
- **Light and dark mode.** The game follows the browser's light/dark setting and falls back to light when the browser doesn't say. **(owner)** Settings also have a light/dark/system switch. **(design call)** Both themes must keep the map, ships and task queues easy to read.
- **It's a side project for now.** No marketing or brand approval process is assumed. **(owner)** GoFreight appears by name, and its products' effects live with the rest of the balance numbers.
- **No launch deadline.** The build should still deliver playable steps (for example: one office first, then multiple offices, events, phone layout) rather than everything at once. **(design call)**

## 4. The run at a glance

1. **Setup.** The player picks a difficulty mode (§13) and a city for their first office from a short list of major freight cities. **(owner)** The company starts with a bootstrap fund, the **owner as its only employee**, and a few **starter agents** in other countries, so shipping is possible from day one (§10). **How many starter agents depends on the difficulty.** **(owner)**
2. **Play.** In-game time runs day by day. The player can pause or speed up (except in Hardcore, §13). Tasks flow through the departments, staff work them automatically, and the player makes management decisions: hire, open departments, buy software, sign agents, open offices, take loans, and react to market events.
3. **End.** The run ends after **10 in-game years**, or earlier through bankruptcy. The final screen shows the company value breakdown and a "Book a demo" button (§15).

**Target length:** about **15–20 minutes** on Normal. **(owner)** Busy managers will try a game with a known length, and a finished run has a final screen to put the call to action on. Ten in-game years in 15–20 minutes means about 0.25–0.35 seconds of real time per in-game day at 1×. The builder should treat the length target as fixed and tune how long a day lasts to fit it, adding auto-pause on important moments (§16) so the player can still react.

## 5. Core loop: tasks and queues **(owner)**

This is the heart of the game and was the owner's idea.

### Words used in this document **(owner)**
- **Task:** one piece of work for a department, such as "Quote · Acme Toys" or "Booking · SHA→LAX".
- **Workload:** how much work a task needs, as a plain number, for example 3. The screen shows progress as "1.5 / 3".
- **Speed:** how much workload an employee gets through per day.
- **Capacity:** how many tasks an employee can keep open at the same time.

### How work gets done
- Each **department has a queue of tasks**.
- A **task** has a **deadline**, a **workload**, and a **minimum duration**. The minimum duration is the time it can't be done faster than, because someone else has to reply: the carrier confirming a booking, the customer sending documents, a sailing cut-off. **(owner)**
- An **employee** keeps up to **capacity** tasks open at once and spreads their **speed** across them each day. A task can only absorb so much per day: **workload ÷ minimum duration**. Speed it can't absorb goes to the employee's other open tasks. **(owner)**
- **Example:** a booking with workload 2 and a minimum duration of 4 days absorbs at most 0.5 per day. An operator with speed 2 and capacity 1 spends most of the day waiting. With capacity 4, the same operator's whole day is used. This is why real operators juggle many shipments, and why software that raises capacity (§11) is valuable.
- When every employee's capacity is full, the remaining tasks wait in the queue.
- When a task is finished it **creates the next task(s) in the chain** below. The final tasks bring in the money.

**Queue order:** earliest deadline first decides which waiting task gets opened next. **(design call)** The player doesn't reorder tasks, because that would be micromanagement.

### The two ends of a shipment **(owner)**

Every shipment has an **origin** and a **destination**, the industry's terms. Each end is handled by either **one of the player's offices**, whose tasks appear on screen, or a **partner agent** (an *origin agent* or a *destination agent*), who works off-screen and takes a cut.

The **selling office** is the player's office whose Sales won the customer. It can sit at either end:
- **Export:** the customer ships out of the selling office's country. The selling office is the origin.
- **Import:** the customer is buying from overseas into the selling office's country. The selling office is the destination, and an origin agent (or another of the player's offices) books and loads the cargo overseas.

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

- A **won** quote creates the origin tasks. A **lost** quote creates nothing (§7).
- **The ship sails on the map when the origin work is done.** That means the booking, plus export customs if the origin office has a Customs department. If the origin is an agent, the agent's work takes a few days off-screen. **(owner)**
- **Destination work waits for the ship to arrive.** Route disruptions (§12) delay arrival and everything after it, including the money. **The voyage is part of the rules, not decoration.** **(owner)**
- **Billing** **(owner)**:
  - The selling office invoices its customer: an export customer when the ship departs, an import customer when it arrives. **(design call on timing)**
  - Any other office of the player's on the shipment bills its own local charges (origin or destination charges). This is one reason an office is worth more than an agent.
- **Agent ends** are off-screen. The agent takes its profit share.
- Customer Service tasks aren't part of the chain. They come up while the shipment is at sea, at the selling office, because the customer belongs to it (§9).
- Customs is a revenue unlock (§6). Without a Customs department at an end, that end's customs step is skipped and earns nothing.

### Missed deadlines **(owner)**

| Department | When a task misses its deadline |
|---|---|
| Pricing | The task goes on to Sales anyway, with the rough-rate factor (§7). Nothing is lost except win chance. |
| Sales | The quote is lost, and the customer went to a competitor. |
| Operations | A penalty fee (missed carrier cut-off), and the customer's satisfaction drops. |
| Customs | A penalty fee, and satisfaction drops. |
| Customer Service | Satisfaction drops. |
| Accounting | The customer pays late, and you lose a small amount. |

## 6. Departments

### The specialist rule **(owner)**

There are two kinds of department:

- **Core departments**, available from the start: **Sales, Operations, Accounting.**
- **Specialist departments**, opened later as upgrades: **Pricing, Customer Service, Customs.**

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

The top bar shows the company's overall quote win rate.

## 8. Staff and hiring **(owner)**

### Employee stats
Each employee has:
- **Speed:** how much workload they get through per day (§5).
- **Capacity:** how many tasks they can keep open at once (§5).
- **Win rate:** only matters for Sales.
- **Potential:** the ceiling their stats can grow to through experience.
- **Salary:** paid monthly. It starts at what they asked for when hired.

Stats grow with experience toward potential. **(owner: the idea of potential; the growth curve is builder tuning)**

**Salaries rise every year.** **(owner)** Each employee gets an automatic yearly raise, bigger for those whose stats grew that year, so a star employee becomes expensive over time. **(owner)** Raise sizes are builder tuning.

### Hiring works like a gacha roll **(owner)**
- The player pays to **post a job ad** for a chosen department and office.
- The game **rolls a few candidates** (about 3, **builder**). Each has their own stats, potential and asking salary.
- The player reviews them and **hires one, or pays to re-roll**.
- Candidates come from **that office's country pool**, so each country has its own profile. For example, one country's candidates are cheaper but less experienced, another's cost more but have higher win rates. **(design call)**
- Rolls cost **in-game cash only. There is never real money.** **(design call)**

### Placement rules **(owner)**
- An employee **stays in the department they were hired for.**
- **Only the owner can move** between departments and offices. Early on, that's how a one-person company covers everything.
- The owner isn't paid a salary. **(design call)**
- The player can let an employee go, with a small one-off cost. **(design call)**

## 9. Customers and satisfaction **(owner)**

- Customers are named, fictional companies.
- Each has a hidden **satisfaction score from 0 to 100**, shown simply on screen as **5 stars or a bar**. **(owner)** New customers start in the middle. **(design call)**
- Many things move the score a few points. **Good service** (deadlines met, inquiries answered on time) raises it. **Bad service** (Ops or Customs penalties, ignored inquiries) lowers it. **At 0 the customer leaves.**
- A higher score does two things: the customer **sends quote requests more often**, and quotes for them **win more easily** (the satisfaction bonus in §7). **(owner)**
- The customer portal & tracking product (§11) cuts down inquiries and raises satisfaction faster.
- **Rival forwarders:** a market event (§12) in which a competitor runs a price promotion. **Unhappy customers may leave for it, and happy ones stay.** This is a reason to keep satisfaction high, not just above zero. **(owner)**

## 10. Offices and agents **(owner)**

Forwarders handle **both exports and imports**. At each end of a shipment, the work is done by one of the player's offices or by a partner agent (§5).

### The coverage rule **(owner)**
- Coverage is **by country, with big countries split into regions**: for example the US into West Coast, East Coast and Gulf, and China into north and south. The exact list is builder data.
- **A shipment can only be taken if both ends are covered**, by one of the player's offices or by an agent, in that country or region. No partner there means no shipment. This keeps "sign agents to open up the map" a clear, fun progression.
- **Starter agents depend on the difficulty**, for example more on Easy and fewer on Hardcore. **(owner)** Exact numbers are builder tuning.

| | **Agent** | **Office** |
|---|---|---|
| What it does | Handles its end of the player's shipments, off-screen, as origin or destination agent | The player's own staff handle that end and bill its local charges (§5) |
| Cost | Cheap to sign, then takes a **profit share** of each shipment it touches | One-time opening cost, plus **rent** and the **salaries** of its staff |
| Brings in customers? | **No.** It sells for itself, not for you. | **Yes.** Its own salespeople win local exporters and importers. |
| Extra tasks | **Sends the player handling tasks:** its own customers' shipments to or from the player's countries, where the player acts as its agent. These **skip Pricing and Sales** and go straight to Ops (plus Customs and local-charge Accounting where opened) for a smaller fee. **(owner)** | — |
| Volume | Both raise the volume of tasks on lanes touching that country or region, at all the player's offices. **(owner)** | |

- **An office and an agent can coexist** in the same country or region. **(owner)** The player's office handles the player's own shipments there, the agent keeps sending its handling tasks, and the player can end the agent contract at any time.
- **The intended progression:** sign agents early because they're cheap and open up the map, then open offices in the busiest places once the business can afford them. **(design call)**
- **Agent handling tasks** create a tension worth keeping: they're welcome when sales are slow, but they compete with the player's own higher-margin shipments when Ops is busy.

### Managing several offices **(owner)**
- **Each office has its own departments, staff and queues.** This keeps the "staff can't move" rule meaningful and gives each country its own hiring pool. Design the data model around offices from day one, even if the first playable step has only one office.
- **Cash and software are shared** across the company.
- The player switches offices by **clicking its pin on the map** (or tabs on phone).
- A **company overview** flags the struggling office ("Los Angeles: Ops queue overloaded").
- Whether running several separate offices is fun or tiring is still to be **confirmed in play**.

## 11. Software and upgrades

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

| Mode | Pace | Events | Starter agents | Clock |
|---|---|---|---|---|
| **Easy** | Slower | Fewer bad, more good. Maybe more starting cash. | More | Auto-pause on important moments |
| **Normal** (default) | The baseline the game is tuned around | Balanced | Some | Auto-pause on important moments |
| **Hardcore** | Faster | More frequent and harsher bad events. Maybe shorter ticker warning. | Fewer | **Never pauses on its own**, not even while hiring or during market events, like real life |

- **GoFreight availability:** from the start on Easy. Mid-run on **both** Normal and Hardcore, on the same schedule (§11). **(owner)**
- The Hardcore rules above are examples. More are to be brainstormed later. **(owner)**
- **Every score is labeled with its mode**, such as "$8.2M · Hardcore", so players compare like with like. **(owner)** Luck still differs between runs in the same mode, which is accepted. **(owner)**

## 14. Money

**Revenue:** the player's own shipments (customer invoices), local charges billed by the player's other offices, customs fees, and agent handling fees.

**Costs:** salaries (monthly, rising yearly), office rent (monthly), software subscriptions (monthly), agent profit share (per shipment), penalties, recruiting (job ads and re-rolls), department setup fees, one-time upgrades, and loan interest and repayments.

**Cash flow is always visible** **(owner)**: the top bar shows the **net per month** (e.g. "+$1,100 / mo" or "−$500 / mo"). The player can open a breakdown of revenue, salaries, rent, software and loans, and see how a decision would change it before confirming (e.g. "Hiring Nora: −$3,200 / mo"). **(design call)**

### Loans **(owner)**
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

**End-of-run screen:**
- The headline value with its breakdown, e.g. "Cash $2.1M + Network $1.4M + Customer book $4.7M = **$8.2M** · Normal".
- A short story of the run: offices opened, staff hired, events survived.
- A **"Book a demo with GoFreight"** button linking to the existing demo page. The wording should feel like the next step in the story, e.g. "Real forwarders run on GoFreight. See it for real." **(owner: book a demo; wording is a builder or owner detail)**

**Bankruptcy screen:** the same breakdown, the year the company fell, and the same button with copy like "See what would have kept you afloat". **(design call)**

## 16. Screens and UI

- **Main screen (laptop):** a top bar with cash, net cash flow per month, the in-game date (year X of 10), company win rate, shipments per operator per month, staff count, and pause / 1× / 3× controls. Below it are the **world map**, the current office's **department columns** with staff and task queues, and a **side panel** for upgrades, hiring, agents and offices, loans, and the event log. See the mockup for the general layout.
- **Task cards** show the task's name, deadline, and progress as "1.5 / 3". Each employee shows how many of their capacity slots are in use (e.g. "3 / 4 open"). **(design call)**
- **Phone:** the map stays on top. Departments, upgrades, hiring and the log become tabs underneath. Taps replace hovers. **(design call)**
- **World map:** stylized continents, ports, office and agent pins, coverage by country or region, and **ships moving along real-ish sea routes**. During events, affected ships reroute or stop visibly. Clicking an office pin opens that office. **(owner: lively map; drawing approach is builder)**
- **Hiring screen:** shows the rolled candidates side by side with their stats, potential and salary, plus Hire and Re-roll buttons. **(owner: gacha-style review)**
- **Auto-pause** on Easy and Normal for important moments: event warnings, loan warnings, a customer about to leave, the end of a year, and the hiring screen. **(design call)** The player can switch it off. **On Hardcore the clock never pauses on its own** (§13). **(owner)**
- **Saving:** autosave to `localStorage`, with one save slot plus Continue and New game. **(design call)** If storage isn't available, the game still runs and just doesn't save.

## 17. Left to the builder

- All balance numbers: starting fund, salaries and raises, prices, workloads, minimum durations, deadlines, speed and capacity ranges, factors, growth curves, event probabilities, starter agent counts and the score weights.
- Visual style, the art for the map and ships, fonts and colors, in both light and dark themes (keeping it readable and professional for a business audience).
- The list of one-time upgrades, to be brainstormed with the owner during the build phase.
- Map drawing approach (SVG worked in the mockup) and map data.
- The list of starting cities, ports, sea lanes, and the coverage countries and regions.
- Names of fictional customers, candidates and rival vendors.
- Candidate count per roll, rarity tiers (if any), and re-roll cost.
- Build tooling (e.g. Vite), project structure, tests, and the GitHub Pages deploy setup.
- Sound (optional).

## 18. Ideas parked for later

- Endless mode unlocked after the first run.
- A "challenge of the week" with a shared event sequence, for fair comparisons.
- Passing the score and the player's choices to the demo booking.
- Hosting on gofreight.com.
- A Documentation department. It was rejected for now because splitting it out of Ops adds work without benefit (§6).
- Ad-hoc one-off partners for uncovered countries, with worse margins and more delays (§10).
- More Hardcore rules (§13).
