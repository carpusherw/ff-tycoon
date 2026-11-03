# FF Tycoon — Game Design

- **Date:** 2026-11-03
- **Status:** Draft for owner review
- **Tracking:** [#1](https://github.com/carpusherw/ff-tycoon/issues/1)
- **Reference mockup:** [`docs/mockups/2026-11-03-game-screen-v1.html`](../../mockups/2026-11-03-game-screen-v1.html). It's a throwaway that shows the map, departments and upgrade panel. Open it in a browser. Its numbers and art are placeholders. It's also out of date in two ways: its ships sail when a quote is won (this document says after Ops books, §5), and its GoFreight products are available from day one (this document delays them outside Easy, §11).

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
- **It plays like an ad.** If the pitch shows up before the fun, the target audience closes the tab. **(owner, confirmed)**
- **It names or mocks real competitors.** Every rival vendor is fictional, such as "LegacyFreight 2003". The repo is public, and mocking a real company invites legal trouble. **(owner, confirmed)**
- **It takes a political side.** War, pandemic and tariff events are described generically ("conflict near a strait") and never name countries or sides. **(design call)**
- **It becomes micromanagement.** The player never assigns individual jobs, and adding offices adds things to watch, not clicks.
- **It feels unfair.** GoFreight products help in ways that make sense in the real world. They aren't magic buttons, and a player who skips them can still finish a run.

## 3. Constraints

- **Front end only, no server.** Progress is saved in the browser's `localStorage`. **(owner)**
- **Hosted on GitHub Pages** from this public repo. **(owner)**
- **React + TypeScript, no game engine.** The game is mostly screens of numbers and choices, which is UI work. **(owner accepted the recommendation)**
- **The game rules live in plain TypeScript, separate from React.** The simulation (jobs, staff, events, money) has no UI dependency, so it can be tested and tuned on its own. **(owner accepted the recommendation)**
- **Laptop first, works on phone.** Design each screen at laptop size, then make sure it works at phone width. **(owner)**
- **"Book a demo" links to GoFreight's existing demo page** and opens in a new tab. **(owner)** The exact URL is a builder detail. Confirm it with the owner before launch.
- **Lively world map with ships moving** between the ports of shipments the player handles. **(owner)**
- **Three languages at launch: English (default), Traditional Chinese and Simplified Chinese.** **(owner)** Every bit of player-facing text goes through translation from day one: UI labels, event and news-ticker copy, candidate and customer flavor text, and the end-screen story. The player can switch language in settings. The game picks a default from the browser language and falls back to English. **(design call)** Whether proper names (fictional customers, candidates) are localized or kept the same across languages is a **(builder)** choice.
- **It's a side project for now.** No marketing or brand approval process is assumed. **(owner)** GoFreight appears by name, and its products' effects live with the rest of the balance numbers.
- **No launch deadline.** The build should still deliver playable steps (for example: one office first, then multiple offices, events, phone layout) rather than everything at once. **(design call)**

## 4. The run at a glance

1. **Setup.** The player picks a difficulty mode (§13) and a city for their first office from a short list of major freight cities. **(owner)** The company starts with a bootstrap fund, the **owner as its only employee**, and one or two starter agents in other cities so shipping is possible from day one (§10). **(design call)**
2. **Play.** In-game time runs day by day. The player can pause or speed up. Jobs flow through the departments, staff work them automatically, and the player makes management decisions: hire, open departments, buy software, sign agents, open offices, take loans, and react to market events.
3. **End.** The run ends after **10 in-game years**, or earlier through bankruptcy. The final screen shows the company value breakdown and a "Book a demo" button (§15).

**Target length:** about **15–20 minutes** on Normal. **(owner)** Busy managers will try a game with a known length, and a finished run has a final screen to put the call to action on. Ten in-game years in 15–20 minutes means about 0.25–0.35 seconds of real time per in-game day at 1×. The builder should treat the length target as fixed and tune how long a day lasts to fit it, adding auto-pause on important moments (§16) so the player can still react.

## 5. Core loop: jobs and queues **(owner)**

This is the heart of the game and was the owner's idea.

- Each **department has a queue of jobs**.
- A **job** has a **deadline** and an **amount of work in M/D** (man-days), for example 2.4 M/D.
- Each **employee** in a department works on one job at a time and adds their daily M/D to it at the end of each day. A typical employee adds 1, and better ones add more (§8).
- When a job is finished it **creates the next job in the following department**. The last department's job doesn't create a new one. It brings in the money.
- When there are more jobs than staff, the extra jobs wait.

**Queue order:** earliest deadline first. **(design call)** The player doesn't reorder jobs, because that would be micromanagement.

**The job chain for one of the player's own shipments** **(owner)**:

```
ORIGIN (the office that won the customer)

  Pricing ──► Sales ──► Ops: book ──► ship sails ──► Accounting: invoice ──► cash
                                         │
                                         │  while at sea: Customer Service inquiries
                                         ▼
FAR END (agent or own office)       ship arrives
                                         │
               own office:  Ops: arrival ──► (Customs, if opened there) ──► its share of revenue
               agent:       handled off-screen; the agent takes its profit share
```

- A **won** quote creates the Ops booking job. A **lost** quote creates nothing (§7).
- **The ship sets sail on the map when Ops finishes the booking**, not when the quote is won.
- **The origin office invoices once the ship departs.**
- **Far-end work waits for the ship to arrive.** If the far end is the player's own office, that office gets an **arrival Ops job**, plus a **Customs job** if it has opened Customs, and it earns **its share of the shipment's revenue**. If the far end is an agent, the agent does that work off-screen and takes its profit share. This is a second reason an office is worth more than an agent (§10).
- **The voyage is part of the rules, not decoration.** Route disruptions (§12) delay arrival, so far-end work and the revenue tied to it come later.
- Customer Service jobs aren't part of the chain. They come up while the shipment is at sea (§9).
- Customs work happens at whichever end has a Customs department: export clearance at origin, import clearance at the far end. The exact split of customs revenue is **(builder)** tuning.

**Missed deadlines** (design call, owner said the guesses were mostly right):

| Department | When a job misses its deadline |
|---|---|
| Pricing | The job goes on to Sales anyway, with the rough-rate factor (§7). Nothing is lost except win chance. |
| Sales | The quote is lost, and the customer went to a competitor. |
| Operations | A penalty fee (missed carrier cut-off), and the customer loses loyalty. |
| Customs | A penalty fee and a loyalty loss. |
| Customer Service | The customer loses loyalty. |
| Accounting | The customer pays late, and you lose a small amount. |

## 6. Departments

### The specialist rule **(design call, built on the owner's idea of starting with Sales and upgrading)**

There are two kinds of department:

- **Core departments**, available from the start: **Sales, Operations, Accounting.**
- **Specialist departments**, opened later as upgrades: **Pricing, Customer Service, Customs.**

**Before a specialist department is opened, someone else does that work badly. After it's opened, a specialist does it well.** So opening a department is always a clear upgrade and never just extra complexity. That's also why the owner rejected a separate Documentation department: splitting it out of Ops added work without any benefit. **(owner)**

Opening a specialist department costs a one-time setup fee. It does nothing until someone is hired into it. **(design call)**

### Department list

| Department | Type | What it does | Before it's opened |
|---|---|---|---|
| **Sales** | core | Turns quote requests into won or lost shipments (§7). | — |
| **Operations** | core | Books and tracks shipments. Also handles jobs sent by partner agents (§10). | — |
| **Accounting** | core | Invoices and collects. Finishing the job brings in the revenue. | — |
| **Pricing** | specialist **(owner)** | Every quote request starts here. Finishing on time gives Sales the good-rate factor (§7). | Requests skip Pricing and go straight to Sales with the **rough-rate factor** (salespeople guess rates). |
| **Customer Service** | specialist **(owner agreed)** | Answers "where's my cargo?" inquiries while shipments are at sea. Answering on time keeps customers loyal (§9). | Inquiries go into the **Operations queue** and eat Ops time. **(design call)** |
| **Customs brokerage** | specialist, **revenue unlock** **(owner agreed)** | Sells customs clearance on top of shipments. It adds a Customs job to the chain and extra revenue per shipment. | No customs revenue. Shipments skip this step. |

Each office (§10) has its own departments. **(design call)**

## 7. Winning quotes **(owner)**

```
win chance = salesperson win rate × pricing factor  + RMS bonus + loyalty bonus + other bonuses
```

- **Salesperson win rate** is a stat of the employee who works the quote (§8).
- **Pricing factor:** **good rate** (e.g. ×1.0) if the Pricing job finished on time. **Rough rate** (e.g. ×0.6) if it was late or there's no Pricing department. **(owner: the idea of two rates or a factor; the numbers are builder tuning)**
- **RMS** speeds up Pricing work **and** adds directly to win chance. **(owner)**
- **Loyalty bonus** for repeat customers (§9). **(design call)**
- Market events can change any of these (§12).
- Clamp the result to a sensible range, such as 5–95%. **(builder)**

The top bar shows the company's overall quote win rate.

## 8. Staff and hiring **(owner)**

### Employee stats
Each employee has:
- **Speed:** how many M/D they add to a job per day.
- **Win rate:** only matters for Sales.
- **Potential:** the ceiling their stats can grow to through experience.
- **Salary:** what they asked for when hired, paid monthly.

Stats grow with experience toward potential. **(owner: the idea of potential; the growth curve is builder tuning)**

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

## 9. Customers and loyalty **(design call, owner asked how to make repeat business a mechanic)**

- Customers are named, fictional companies.
- Each has a **loyalty level of 0–3 stars**. New customers start at 1 star. **(design call)**
- **Good service** (deadlines met, inquiries answered) earns a star. **Bad service** (missed deadlines, ignored inquiries) loses one. At **0 stars the customer leaves.**
- Each star does two things: that customer **sends quote requests more often**, and quotes for them **win more easily** (the loyalty bonus in §7).
- The customer portal & tracking product (§11) cuts down inquiries and speeds up loyalty gains.
- Rival forwarders target low-loyalty customers (§12).

## 10. Offices and agents **(owner agreed; corrected by the owner on direction)**

Forwarders handle **both exports and imports**. An agent or office covers **the far end** of a shipment in **either direction**.

**The coverage rule:** a shipment can only go to or from a city where the company has **an office or an agent**. **(design call)** At the start, the company has its home office and one or two starter agents.

| | **Agent** | **Office** |
|---|---|---|
| What it does | Covers the far end of the player's shipments to or from that city, off-screen | Its staff do the far-end work themselves (arrival Ops, import customs) and keep that share of the revenue (§5) |
| Cost | Cheap to sign, then takes a **profit share** of each shipment it touches | One-time opening cost, plus **rent** and the **salaries** of its staff |
| Brings in customers? | **No.** It sells for itself, not for you. | **Yes.** Its own salespeople win local exporters and importers, creating shipments that start from that city. |
| Extra jobs | **Sends the player handling jobs:** its own customers' shipments into the player's cities. These **skip Pricing and Sales** and go straight into Operations for a smaller fee. **(owner)** | — |
| Volume | Both raise the volume of jobs on lanes touching that city, at all the player's offices. **(owner)** | |

**The intended progression:** sign agents early because they're cheap and open up the map. Later, upgrade the busiest agent cities into offices once the business can afford it (the new office replaces the agent there). **(design call)**

**Agent handling jobs** create a tension worth keeping: they're welcome when sales are slow, but they compete with the player's own higher-margin shipments when Ops is busy.

### Managing several offices
- **Each office has its own departments, staff and queues.** **(owner)** This keeps the "staff can't move" rule meaningful and gives each country its own hiring pool. Design the data model around offices from day one, even if the first playable step has only one office.
- **Cash and software are shared** across the company.
- The player switches offices by **clicking its pin on the map** (or tabs on phone).
- A **company overview** flags the struggling office ("Los Angeles: Ops queue overloaded").
- Whether running several separate offices is fun or tiring is still to be **confirmed in play**.

## 11. Software and equipment

Every software product is a **monthly subscription**. **(owner)** Equipment such as a second monitor is a one-time purchase. **(design call)**

| Product | Requires | Effect (values are builder tuning) |
|---|---|---|
| **Second monitor** (equipment) | — | All staff in that office slightly faster |
| **Established FMS vendors** (fictional, e.g. LegacyFreight 2003) | — | Ops (and maybe Accounting) a little faster. Each has its own weak spot, e.g. clunky, expensive or slow to improve. |
| **GoFreight FMS** | launches mid-run outside Easy | Ops and Accounting much faster (invoices come from shipment data) |
| **Established RMS vendor(s)** (fictional) **(design call)** | — | Pricing a little faster |
| **GoFreight RMS** | launches mid-run outside Easy | Pricing faster **and** win chance up **(owner)** |
| **GoFreight FMS + RMS combo** | both | **Extra bonus** for owning both **(owner)**. Builder picks the bonus. One suggestion: Sales gets a speed boost from live rates appearing in quotes. |
| **GoFreight AI** | GoFreight FMS **or** GoFreight RMS **(owner)** | Big speed boost on the departments its parent products cover (e.g. it reads emails and documents into shipments) |
| **Customer portal & tracking** | GoFreight FMS **(owner)** | Far fewer "where's my cargo?" inquiries, and faster loyalty gains |

- **Only one FMS and one RMS at a time.**

### GoFreight arrives later **(owner)**

GoFreight is a startup that enters the market after the established vendors. That's more realistic, and it turns "buy GoFreight" from an obvious click into a real decision.

- **Easy mode:** GoFreight products are on the upgrade list from the start. **(owner)**
- **Normal and Hardcore:** at the start, the list offers only **a few fictional established vendors**. **(owner)** Give them clear personalities, for example a cheap but clunky one ("LegacyFreight 2003") and an expensive, solid but slow-moving one. **(design call)** A growing company will probably need to buy one of them early or mid-game to keep up. **(owner)**
- **GoFreight launches partway through the run**, announced on the news ticker ("Startup GoFreight launches a cloud FMS"). Products can arrive one at a time, like a startup's roadmap, for example FMS first, then RMS, AI and the customer portal later. Exact years are builder tuning (as a rough start: GoFreight FMS around year 3 on Normal, a bit later on Hardcore). **(design call)**
- **Switching vendors is a real decision with a short-term cost and a long-term gain**, like a real software switch **(owner)**:
  - *Short-term drawbacks* **(design call)**: a one-time migration fee; a cut-over period of a few in-game weeks when the affected departments work slower while staff learn the new system; one month of paying for both systems; and an early-exit fee if the old vendor's contract still has time left.
  - *Long-term benefits*: GoFreight's stronger effects, plus access to the FMS + RMS combo bonus, GoFreight AI and the customer portal, which all require GoFreight products.
  - The switch should be timed by the player. Switching just before peak season or during a crisis hurts more than switching in a quiet month.
- The established vendors may raise prices over time or fall behind on features, to make "should I switch now?" a live question. **(design call)**
- **Software is priced per office per month.** **(design call)** Expanding raises software cost, which keeps the cash flow display relevant.
- **Effects should make sense in the real world** (see the anti-goals). GoFreight's advantage must be clear, but a player who never buys it can still finish a run.

## 12. Market events **(owner)**

A random event system makes every run tell a different story and keeps the map alive.

| Group | Examples | Game effect |
|---|---|---|
| Rates jump | Rate spike / peak season, fuel surcharge jump, carrier alliance reshuffle | Rates go stale quickly (a rough-rate factor is more likely), and quotes on old rates lose money or deals |
| Routes disrupted | Conflict near a strait, canal drought, ship stuck in a canal, port strike, typhoon, Lunar New Year shutdown | **Ships visibly reroute or stop on the map**, transit gets longer, deadlines are at risk, and more CS inquiries come in |
| Demand swings | Tariff announcement (rush, then slump), pandemic (crash, boom, container shortage, rates up many times over), e-commerce boom | Request volume rises or falls, and rates move |
| Company shocks | Carrier bankruptcy, cyberattack on a carrier, rival forwarder poaching | Emergency Ops work, frozen bookings, low-loyalty customers lost |

- **A news ticker gives warning** a week or two before most events, so a good player can prepare. **(design call)**
- **Not every event is bad.** Surges reward players who have built capacity. Good events also exist. **(owner: probabilities of bad and good events vary by mode)**
- **GoFreight products help fairly during events:** RMS refreshes rates during spikes, tracking and the portal cut inquiry floods during delays, and AI absorbs volume surges. **(design call)**
- **Pacing:** about 3–5 events per in-game year on Normal, with at most one major crisis (such as a pandemic) per run. **(design call)**
- **Wording is generic:** no real country names or sides for wars or tariffs (see the anti-goals).

## 13. Difficulty modes **(owner)**

| Mode | Pace | Events | GoFreight products |
|---|---|---|---|
| **Easy** | Slower | Fewer bad, more good. Maybe more starting cash. | Available from the start |
| **Normal** (default) | The baseline the game is tuned around | Balanced | Launch partway through the run (§11) |
| **Hardcore** | Faster | More frequent and harsher bad events. Maybe shorter ticker warning. | Launch partway through, maybe later than Normal |

**Every score is labeled with its mode**, such as "$8.2M · Hardcore", so players compare like with like. **(owner)** Luck still differs between runs in the same mode, which is accepted. **(owner)**

## 14. Money

**Revenue:** the margin on the player's own shipments, customs add-on fees, and agent handling fees.

**Costs:** salaries (monthly), office rent (monthly), software subscriptions (monthly), agent profit share (per shipment), penalties, recruiting (job ads and re-rolls), department setup fees, and loan interest and repayments.

**Cash flow is always visible** **(owner)**: the top bar shows the **net per month** (e.g. "+$1,100 / mo" or "−$500 / mo"). The player can open a breakdown of revenue, salaries, rent, software and loans, and see how a decision would change it before confirming (e.g. "Hiring Nora: −$3,200 / mo"). **(design call)**

### Loans **(owner)**
- **The player can take a loan at any time**, up to a limit based on company value, with monthly interest and repayments. **(design call)**
- **Emergency loan:** if cash goes below zero, the bank steps in automatically at a worse rate. **(design call)**
- **Game over** happens when a repayment is due and can't be paid. **(owner)**

## 15. Scoring and the end screen

**Final score = company value** **(owner)**:

```
company value = cash − outstanding loans
              + network      (each office ≈ what it would cost to set up again; each agent contract a little)
              + customer book (each customer ≈ one year of the profit they bring × their loyalty stars)
```

The formula shape is a **(design call)**. The weights are builder tuning.

**End-of-run screen:**
- The headline value with its breakdown, e.g. "Cash $2.1M + Network $1.4M + Customer book $4.7M = **$8.2M** · Normal".
- A short story of the run: offices opened, staff hired, events survived.
- A **"Book a demo with GoFreight"** button linking to the existing demo page. The wording should feel like the next step in the story, e.g. "Real forwarders run on GoFreight. See it for real." **(owner: book a demo; wording is a builder or owner detail)**

**Bankruptcy screen:** the same breakdown, the year the company fell, and the same button with copy like "See what would have kept you afloat". **(design call)**

## 16. Screens and UI

- **Main screen (laptop):** a top bar with cash, net cash flow per month, the in-game date (year X of 10), company win rate, shipments per operator per month, staff count, and pause / 1× / 3× controls. Below it, the **world map**, the current office's **department columns** with staff and job queues, and a **side panel** for upgrades, hiring, agents and offices, loans, and the event log. See the mockup for the general layout.
- **Phone:** the map stays on top. Departments, upgrades, hiring and the log become tabs underneath. Taps replace hovers. **(design call)**
- **World map:** stylized continents, ports, office and agent pins, and **ships moving along real-ish sea routes**. During events, affected ships reroute or stop visibly. Clicking an office pin opens that office. **(owner: lively map; drawing approach is builder)**
- **Hiring screen:** shows the rolled candidates side by side with their stats, potential and salary, plus Hire and Re-roll buttons. **(owner: gacha-style review)**
- **Auto-pause** on important moments: event warnings, loan warnings, a customer about to leave, the end of a year. **(design call)** This should be a setting the player can switch off.
- **Saving:** autosave to `localStorage`, with one save slot plus Continue and New game. **(design call)** If storage isn't available, the game still runs and just doesn't save.

## 17. Left to the builder

- All balance numbers: starting fund, salaries, prices, M/D sizes, deadlines, factors, growth curves, event probabilities and the score weights.
- Visual style, the art for the map and ships, fonts and colors (keeping it readable and professional for a business audience).
- Map drawing approach (SVG worked in the mockup) and map data.
- The list of starting cities, ports and sea lanes.
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
