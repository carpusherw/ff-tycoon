# FF Tycoon — Chinese forwarder glossary

The game's Chinese wording follows the terms Taiwan forwarders (Traditional Chinese, `zh-Hant`) and mainland forwarders (Simplified Chinese, `zh-Hans`) use at work.

Researched 2026-11-05. "Source" is one public page per market where the term shows up in a forwarder's own context (a job ad, a forwarder or carrier page, a regulation). Where no market-specific page was found, the row says so. The strings themselves live in `src/i18n/zhHant.ts` and `src/i18n/zhHans.ts`; when you add or change Chinese copy, use the terms below and add a row for any new industry term.

## Sources

Short names used in the tables:

- TW-law: 海關管理承攬業辦法 (Taiwan regulation) — https://law-out.mof.gov.tw/LawContent.aspx?id=GL009915
- TW-ad: a Taiwan ocean forwarder's job ad (求才登記) — https://www.ltsh.tyc.edu.tw/ezfiles/1/1001/attach/65/pta_2183_308074_77268.pdf
- TW-op: 海運出口 OP 職務分享 (goodjob.life) — https://www.goodjob.life/experiences/68a68c1cb2bd52d4ed97c870
- TW-iv: 海運 OP 面試心得 (interview.tw) — https://interview.tw/c/2M3C
- TW-one: a carrier's Taiwan sailing schedule (結關日、到港天數) — https://tw.one-line.com/sites/g/files/lnzjqr1471/files/schedules/2020-09/ONE%20AE%20shipping%20schedule%20-%20Updated%2020200921.pdf
- TW-lc: a carrier's Taiwan export Local Charge table — https://tw.one-line.com/sites/g/files/lnzjqr1471/files/2019-11/EXPORT%20LOCAL%20CHARGE_0.pdf
- TW-yang: a shipping company's recruiting notice (財會人員 / 文件人員 / 業務) — https://mmd.ntou.edu.tw/var/file/51/1051/attach/52/pta_28208_3004235_29366.pdf
- TW-tc: interview notes for a Taichung shipping company (會計 / 業務 / 文件) — https://interview.tw/c/GUaN
- CN-flow: 货代(出口)操作流程 (amz123) — https://www.amz123.com/ask/7jDyPccA
- CN-sino: a forwarder's guide to 截关时间 — https://www.sino-shipping.com/zh/shipping-from-china-to-united-kingdom/cut-off-times/
- CN-cut: 截关/截港/截单 区别 (amz123) — https://www.amz123.com/ask/4077ONGG
- CN-hr: a mainland forwarder's recruiting news (国际物流商务) — https://news.qq.com/rain/a/20260702A098RL00
- CN-ops: 货代操作（海运）招聘 — https://campus.niuqizp.com/job-vmrNLZtZn.html
- CN-lp: a forwarder's guide to 港杂费 / 本地费用 — https://www.sino-shipping.com/zh/freight-costs-from-china/hidden-charges/local-port-fees-in-china-shanghai-ningbo-shenzhen/
- CN-cost: 货运代理费用拆解 — https://suaidglobal.com/zh-cn/insights/freight-forwarding-cost/

## Industry terms

| Concept | zh-Hant (Taiwan) | Source | zh-Hans (mainland) | Source | Note |
|---|---|---|---|---|---|
| Freight forwarder (company) | 承攬業 / 海運承攬（口語「貨代」也通） | TW-law | 货代（货运代理） | CN-flow | The game says 貨代 / 货代 (setup title). |
| Quote / quotation | 報價 / 報價單 | TW-ad「報價事宜」 | 报价 / 报价单 | CN-hr「询价报价」 | Sales task name. |
| Request for quote | 詢價 | TW-ad (implied by 報價事宜); no TW page found with 詢價 alone | 询价 | CN-hr | Not used in current copy. |
| Win / lose a quote | 成交 / 沒成交（接到 / 沒接到） | no TW source found; general business usage | 成单 / 丢单（拿下这单 / 没谈成） | no CN page found; general usage | Low confidence on the exact idiom. The game uses 成交率 / 成单率 for win rate, 報價成交 / 沒成交 and 报价成单 / 丢单 in the year report, and 拿下 / 没谈成 in the zh-Hans log. |
| Booking | 訂艙（OP 口語常說 Booking / Booking Note） | TW-op「向船公司或代理行訂艙」「訂艙單（Booking Note）」 | 订舱 | CN-ops / CN-flow「在船公司的网站上订舱」 | Ops task name. |
| S/O | S/O（裝貨單） | TW-iv / web search on 海運 OP 職缺 | SO | CN-ops「处理SO、舱单、电放」 | Not used in current copy. |
| Ops staff / department | OP（海運 OP） | TW-iv | 操作 | CN-ops | Taiwan's role title is "海運出口OP"; the mainland job title is 操作 / 海运操作. The game's Operations department is OP / 操作. |
| Documentation staff | 文件（文件人員） | TW-yang | 单证 | CN-ops | Not used in current copy. |
| Sales | 業務 | TW-ad「高薪徵聘業務人才」 | 销售 / 商务（商务 handles quoting/booking） | CN-hr「国际物流商务」 | The game's Sales department is 業務 / 销售. |
| Accounting | 會計 / 財會 | TW-tc / TW-yang | 财务 / 会计 | no page opened; 财务 appears in mainland forwarder ads in search excerpts | The game's Accounting department is 會計 / 财务. |
| Invoice (to customer) | 帳單（開帳單；英文 Debit Note） | TW-op「向客戶開立應收費用帳單」 | 账单（开账单） | CN-ops「核对费用，制作账单」 | Accounting task name. |
| Local charges | Local Charge（本地費用） | TW-lc | 本地费用 / 港杂费 | CN-lp | Taiwan forwarders keep the English. Not used yet (local charges come with more offices). |
| Cut-off | 結關（結關日） | TW-one「結關日」 | 截关（截关时间） | CN-sino「截关」 | 截港 / 截单 are narrower (CN-cut). Used in the missed-booking log line. |
| B/L | 提單（B/L） | TW-op「製作/確認提單 (B/L)」 | 提单 | CN-flow | Not used in current copy. |
| Shipment | 一票貨 / 一單（口語） | TW-iv「一個月打幾張單」 | 一票货 | CN-flow「此票货物」 | "票" for Taiwan is common speech, but no Taiwan page was found. The game counts shipments in 票 (每位 OP 每月票數, 送達票數). |
| Export / import | 出口 / 進口 | TW-ad「承攬進出口業務」 | 出口 / 进口 | CN-flow | |
| Origin | 起運港 / 裝貨港 | TW (general; carrier tables in Taiwan use port codes) | 起运港 | CN-flow「起运港的FOB本地费用」 | |
| Destination | 目的港 | TW-lc (Destination Charges usage) | 目的港 | CN-flow「目的港清关代理」 | |
| Arrival (destination Ops task) | 到港 | no page found; general usage | 到港 | no page found; general usage | Ops task name. |
| Overseas agent | 國外代理 | TW-ad「與國外代理 E-MAIL 聯絡」 | 国外代理 / 海外代理 | CN-ops「和船公司、车队、仓库、国外代理对接」 | Agent pins on the map. "Network" is 版圖 / 版图 (owner's choice, see below), replacing the earlier 據點與國外代理 / 网点与国外代理. |
| Customer | 客戶 | TW-op | 客户 | CN-hr | |
| Carrier | 船公司 | TW-op「向船公司…訂艙」 | 船公司 | CN-flow「哪家船公司承运」 | Not used in current copy. |
| Transit time | 航行天數 / 航程（T/T） | TW-one（各目的港天數） | 航程 / 运输时效 | CN-sino「运输时效」 | Not used in current copy. |
| Port | 港口 / 港 | TW-law | 港口 / 港 | CN-cost | |
| Vessel sailing | 開航 / 船期 | TW-one（ETD 開航日） / TW-op「掌握船期」 | 开船 / 船期 | CN-ops「直至开船」「跟进船期」 | Not used in current copy. |
| Job ad / hiring | 職缺 / 徵才（求才） | TW-ad「求才登記」「徵聘」; 104 uses 職缺 | 招聘 / 岗位（在招岗位） | CN-hr「招聘」 | The game says 刊登職缺 and 发布招聘岗位. |
| Candidate | 應徵者 | general HR usage | 候选人 | general HR usage | Hiring dialog. |
| Hire (a candidate) | 錄用 / 錄取 | general HR usage | 录用 | general HR usage (录用通知) | The game says 錄用 / 录用. |

## Other game wording

These came in after play-testing and use plain business Chinese rather than forwarder jargon. No market source was looked up for them.

| Concept (English copy) | zh-Hant | zh-Hans | Note |
|---|---|---|---|
| Invoices paid (revenue) | 已收帳款 | 已收款 | Money panel and year report. |
| Late fees | 逾期罰款 | 逾期罚款 | |
| Overdue / N late | 已逾期 / N 項逾期 | 已逾期 / N 项逾期 | Task due label and department badge. |
| Due soon | 快到期 | 快到期 | |
| Profit | 損益 | 盈亏 | Can be negative, so not 利潤 / 利润. |
| No salary (the owner) | 不支薪 | 不领工资 | |
| Salary | 薪資 | 工资 | |
| Cash on hand | 手上現金 | 账上现金 | |
| Work here (move the owner) | 調到這裡 | 调到这里 | |
| Re-roll | 重抽 | 重抽 | Gacha wording. |
| Year N report | 第 N 年年度報告 | 第 N 年年度报告 | |
| Customer book (score) | 客戶業績 | 客户业绩 | |
| Closed (bankrupt stamp) | 歇業 | 歇业 | |
| Bankrupt (cash below zero) | 現金跌破零，公司破產了 | 账上资金为负，公司破产了 | |
| Speed / capacity (staff stats) | 速度 / 容量 | 速度 / 容量 | |
| Network (offices and agents, map summary, end screen) | 版圖 | 版图 | **Owner's choice** (M2 mockup review), replacing 據點與國外代理 / 网点与国外代理. |
| Not covered (a port outside the network) | 尚未納入版圖 | 尚未纳入版图 | **Owner's choice** (M2 mockup review), replacing 尚未覆蓋 / 尚未覆盖. |
| Agent job (tag on an agent's handling task) | 指定貨 | 指定货 | Forwarders' word for cargo an overseas agent nominates to you. Not looked up in a market source. |
| Payments received (revenue, M2) | 已收款項 | 已收款 | Replaces "Invoices paid" once local charges and agent fees count as revenue. |

## Source caveat

CN-flow, CN-sino, CN-hr, CN-ops, TW-ad and TW-op were opened and the quoted phrases read directly. TW-iv, TW-tc, TW-one, TW-lc, TW-yang, CN-cut, CN-lp and CN-cost are cited from search-result excerpts and were not opened one by one. No 104人力銀行 listing page could be fetched; 職缺 is 104's own site vocabulary.

## Where Taiwan mixes English

Taiwan forwarders routinely say OP, Booking, S/O, B/L, Local Charge, Debit Note and T/T in speech and in job ads. The game keeps "OP" for the Operations department and uses Chinese for the rest, because 訂艙, 結關 and 帳單 are what Taiwan forwarders write.
