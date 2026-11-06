# FF Tycoon visual style: Cozy tycoon in GoFreight green

**Status:** chosen by the owner on 2026-11-04.
**Visual reference:** [`docs/mockups/2026-11-04-style-cozy-tycoon-green.html`](../../mockups/2026-11-04-style-cozy-tycoon-green.html). Open it in a browser and use the Light/Dark and Laptop/Phone toggles. When this doc and the mockup disagree, this doc wins.
**Tokens in code:** `src/ui/styles.css`.

## The choice

We built three directions on the same game screen: Control tower (dark, data-dense), Cozy tycoon (warm, rounded, illustrated) and Paper & ink (shipping documents and stamps). The owner liked **Cozy tycoon** and asked for it in **GoFreight's green** rather than its original orange. The result feels like a friendly casual management game while still looking like GoFreight. The other mockups stay in `docs/mockups/` for the record:

- `2026-11-04-style-cozy-tycoon-green.html` (chosen)
- `2026-11-04-style-cozy-tycoon.html` (the orange original)
- `2026-11-04-style-control-tower.html`
- `2026-11-04-style-paper-ink.html`

The greens come from the gofreight.com theme: `#207f73` (button green), `#34aa97` (main brand green), `#4ec1ac` (light green, used as the accent on dark), `#0b5e54` (deep green, used for button shadows) and `#d7f1ec` (pale green). The dark theme's surfaces are a deep teal in the same family as the site's `#072929`.

## Color tokens

Use only these tokens in components and the map. Never write a hex value in a component.

### Surfaces and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#eef6ec` | `#0a2422` | page background |
| `--bg-dot` | `#d9ecd9` | `#0f2f2c` | the dot pattern on the page background |
| `--panel` | `#fffef9` | `#113430` | cards |
| `--panel-2` | `#f5faf1` | `#163f3a` | things inside cards: task cards, candidate cards, soft buttons |
| `--line` | `#d3e7d7` | `#26564e` | borders and dotted dividers |
| `--shadow` | `#b9d9c5` | `#04120f` | the solid drop shadow under cards, pills and soft buttons |
| `--text` | `#1f3a33` | `#ecf7f1` | body text, and outlines on map pins, ports and ships |
| `--muted` | `#557064` | `#a0c4b8` | labels and secondary text |
| `--track` | `#e0eee2` | `#0b2a27` | empty part of progress bars and stat pips |

### Brand green

| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent` | `#207f73` | `#4ec1ac` | the green that carries text: primary buttons, active tabs and speed buttons, the hiring ribbon, the logo tile |
| `--on-accent` | `#ffffff` | `#05221e` | text and icons on `--accent` |
| `--accent-shadow` | `#0b5e54` | `#207f73` | the drop shadow under `--accent` buttons |
| `--brand` | `#34aa97` | `#4ec1ac` | decorative green only: highlighted borders (the hiring card). Never text. |
| `--brand-soft` | `#d7f1ec` | `#123f3a` | pale green fills behind brand moments |

### Departments

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sales` | `#ff7d66` | `#ff9b87` | Sales color: icon, avatar, progress fill, filled pips |
| `--sales-soft` | `#ffe1da` | `#4a2d33` | Sales badge and staff chip fill |
| `--ops` | `#f5a524` | `#ffc35c` | Operations color |
| `--ops-soft` | `#ffefcc` | `#45381e` | Operations badge and chip fill |
| `--accounting` | `#7d6be0` | `#b3a4ff` | Accounting color |
| `--accounting-soft` | `#e8e4fb` | `#2f2c52` | Accounting badge and chip fill |
| `--on-dept` | `#ffffff` | `#ffffff` | the initial letter on a staff avatar |

Department colors are warm or purple on purpose, so no department reads as "brand" or as "good".

### Good and bad

| Token | Light | Dark | Use |
|---|---|---|---|
| `--good` | `#2d7414` | `#a8d96a` | good numbers and news |
| `--good-soft` | `#eaf5dd` | `#243d1d` | fill behind a good total (net cash flow row) |
| `--bad` | `#c33349` | `#ff7d91` | bad numbers and news, a full staff member's load, the border of an overdue task |
| `--bad-soft` | `#ffdde1` | `#52222f` | fill of an overdue task card |
| `--on-bad` | `#ffffff` | `#2a0910` | text on a `--bad` fill (the "due today" chip) |
| `--star` | `#f6b500` | `#f6b500` | the owner's star next to their name |

### Map

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sea` | `#a8dfe3` | `#16465e` | ocean |
| `--wave` | `#e9fbfb` | `#3f7898` | the small wave strokes on the ocean |
| `--land` | `#d6eba2` | `#5d8f4f` | continents |
| `--land-shadow` | `#a9cd7e` | `#3c6a3c` | the continent's offset shadow, and mountains |
| `--land-edge` | `#7fae5c` | `#8fc27a` | coastline and mountain outline |
| `--sand` | `#f6e7b4` | `#b9a874` | the beach band around each coast |
| `--tree` | `#5f9e4d` | `#3f7a45` | tree tops (alternate with `--tree-2`) |
| `--tree-2` | `#4a8a3c` | `#2f6236` | tree tops |
| `--tree-trunk` | `#9a6a44` | `#9a6a44` | tree trunks |
| `--snow` | `#ffffff` | `#ffffff` | mountain caps |
| `--cloud` | `#ffffff` | `#b9d6ce` | drifting clouds |
| `--route` | `#ffffff` | `#fff1b8` | the dotted line of a sea route |
| `--route-halo` | `#34aa97` | `#4ec1ac` | the soft wide line under a route |
| `--office` | `#34aa97` | `#4ec1ac` | your office pin |
| `--agent` | `#3b82d6` | `#6aa8ff` | agent pins, and the "info" marker in the news log |
| `--on-pin` | `#ffffff` | `#ffffff` | the house / flag drawn inside a pin |
| `--hull` | `#ff6f5e` | `#ff8a78` | ship hull |
| `--cabin` | `#ffffff` | `#ecf7f1` | ship cabin |
| `--cargo-1` | `#4fa3ff` | `#4fa3ff` | first container on deck |
| `--cargo-2` | `#ffcf4a` | `#ffcf4a` | second container on deck |
| `--cargo-edge` | `#4a3226` | `#4a3226` | container outline |
| `--wake` | `#ffffff` | `#ffffff` | the wake lines behind a ship |

## Fonts

Loaded from Google Fonts in `index.html` with `display=swap`:

- **Fredoka** 500, 600, 700 (`--font-round`): headings, numbers (cash, "1.5 / 3", salaries), buttons, tabs, map labels.
- **Nunito** 500, 600, 700, 800 (`--font-body`): everything else. Body text is 13px, weight 600, line height 1.4. Labels go to 700 and strong names to 800.

Fallback stack: `ui-rounded, system-ui, -apple-system, 'Segoe UI', sans-serif`. Neither font has Chinese glyphs, so Chinese text falls through to the system font; that's expected, and the layout must not depend on Latin glyph widths.

Rough sizes: section headings 17px/700, the hiring ribbon title 19px, top-bar values 16px/600, small labels 10.5 to 11px/700.

## Shape

- **Borders:** 2px solid `--line` on every card, pill, chip outline and task card (`--border`).
- **Corner radius:** cards 22px (`--radius-card`); things inside a card (task cards, the map's ocean, candidate cards) 16px (`--radius-inner`); buttons and small badges 12px (`--radius-btn`); tiny tags like the log's day stamp 8px (`--radius-small`); chips, pills, progress bars and the theme switch fully round (`--radius-pill`).
- **Shadow:** a solid shadow straight down, no blur, which makes things look like chunky toy pieces. Cards use `0 5px 0 var(--shadow)` (`--lift`); pills and soft buttons use `0 3px 0 var(--shadow)` (`--lift-sm`); `--accent` buttons use `0 3px 0 var(--accent-shadow)`. A pressed button moves down 2px and its shadow shrinks to 1px.
- **Spacing scale:** 4, 6, 8, 12, 16, 24px (`--space-1` to `--space-6`). Gaps between cards are 16px on laptop and 12px on phone; card padding is 12 to 16px.

## Components (shape only)

- **Card:** `--panel`, 2px `--line` border, 22px radius, `--lift`. Heading in Fredoka 17px with an icon to its left.
- **Top-bar pill:** a rounded box (16px radius) with an icon tile on the left (28px, `--panel-2`, 10px radius), the value in Fredoka and a small muted label under it.
- **Department header:** a 38px rounded badge filled with the department's soft color, holding the department icon in its strong color; name and hint next to it; the queue count on the right.
- **Staff chip:** fully round, filled with the department's soft color. A 24px round avatar in the department color with the person's initial in `--on-dept`, the name, then a white-ish inner tag "3 / 4 open" (`--panel`, muted text). When the person is full, that tag turns `--bad` and bold.
- **Task card:** `--panel-2`, 2px border, 16px radius. A one-line title ("Quote · **Customer** — lane"), then a row with the progress bar, the "1.5 / 3" figure and a due chip. Overdue or due-today cards get a `--bad` border, a `--bad-soft` fill and a `--bad` due chip with `--on-bad` text that wiggles now and then. Tasks still waiting their turn are faded to about 60% opacity.
- **Progress bar:** 10px tall, fully round, `--track` behind, the fill in the department color with soft diagonal white stripes.
- **Buttons:** primary is `--accent` with `--on-accent` text, 12px radius and the `--accent-shadow` lift. Soft is `--panel-2` with a border and `--lift-sm`.
- **Hiring card:** a card with a `--brand` border and an `--accent` ribbon across the top (title, a one-line hint, department switch, close button). Candidates sit side by side, three across even on phone, each with an illustrated face, name, stat rows with five pips each, a dashed salary tag and a full-width Hire button. Re-roll is a soft button under them, with its cost.
- **News log:** each line has a small day stamp and a ▲ / ▼ / ● marker.
- **Phone:** the map stays on top, with the speed buttons on the map. Under it, a row of four tabs (Team, Hiring, Money, News); the active tab is `--accent`.

## Map

A friendly, hand-drawn-looking SVG map, centred on the Pacific so Asia and the Americas both show.

- **Sea:** `--sea` with a light pattern of small `--wave` strokes.
- **Land:** smoothed continent shapes in `--land` with a `--land-edge` outline, a `--sand` beach band, and a `--land-shadow` copy offset 3px down so the land looks raised.
- **Decoration:** a few round trees (`--tree` / `--tree-2` on a `--tree-trunk`), small mountains (`--land-shadow` with `--snow` caps), and two or three `--cloud` puffs drifting slowly across.
- **Routes:** each sea route is a wide soft `--route-halo` line under a dotted `--route` line, following real-ish sea paths.
- **Ports:** small `--panel` circles outlined in `--text`.
- **Pins:** a teardrop pin outlined in `--text`. Your office is `--office` with a little house; an agent is `--agent` with a little flag. Each pin has a label bubble (`--panel`, outlined) with the city in Fredoka and the agent's name in small muted text; the phone layout drops the second line.
- **Ships:** a small cartoon cargo ship: a `--hull` hull, a `--cabin` cabin, two containers (`--cargo-1`, `--cargo-2`, outlined in `--cargo-edge`) and `--wake` lines behind. Ships point along their route and bob gently.
- **On top of the map:** a pill showing how many ships are sailing (top left) and a small legend for office and agent colors (bottom right).

Motion is light: bobbing ships, drifting clouds, the overdue wiggle. Turn all of it off under `prefers-reduced-motion: reduce`.

## Icons

Inline SVG symbols in one sprite, drawn in a chunky, rounded, slightly cartoon style with 1.5 to 2px outlines on a 24px grid. Two kinds:

- **UI icons** (department badges, the boat in the logo, dice on Re-roll) are one color and use `currentColor`, so they follow the tokens.
- **Illustrated icons** (coin, calendar, trophy, box, people, piggy bank, newspaper, candidate faces) are small pieces of art with their own fixed fills, the same in both themes. They always sit on a tile or card, never straight on the page, so they stay readable in dark mode.

No icon font and no emoji in the UI, apart from the ▲ ▼ ● ★ ✕ text markers.

## Good versus bad

Good is a leafy green (`--good`), deliberately different from the teal brand green, and it is never shown by color alone:

- A good number or news line starts with **▲**; a bad one starts with **▼**; neutral news uses **●** in `--agent` blue.
- Overdue work also changes shape: red border, red fill, red due chip.
- Never use `--accent` or `--brand` to mean "good", and never use `--good` on a button.

## Contrast

Body text must meet WCAG AA (4.5:1) in both themes. These pairs pass and are safe for text:

- `--text` and `--muted` on `--bg`, `--panel` and `--panel-2`
- `--on-accent` on `--accent`; `--accent` on `--panel` and `--panel-2`
- `--good` on `--panel`, `--panel-2` and `--good-soft`
- `--bad` on `--panel` and `--panel-2`; `--on-bad` on `--bad`
- `--text` on every `-soft` fill

`src/ui/tokens.test.ts` checks every pair in this list in both themes. Avoid `--accent` text on `--brand-soft` in light mode (about 4.1:1); the accent is GoFreight's button green, so it stays, and on `--brand-soft` it is only ever a button fill (3:1 is enough for a control). `--brand`, the department colors and the map colors are for shapes, not text. The avatar initial on a department color is decorative, because the name is written right next to it.
