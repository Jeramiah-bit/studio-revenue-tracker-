# StudioRevenue — Product Brief
> For use with Claude Code in VS Code. Read this file at the start of each session.

---

## What We're Building

**StudioRevenue** is a SaaS financial dashboard for boutique fitness studios (yoga, pilates, HIIT, etc.) that lack visibility into their daily revenue and monthly projections. Studios typically operate across multiple booking platforms (Urban Sports Club, ClassPass, WellPass, Eversports/Direct) and currently have no unified view of their financial performance.

The core insight: studio owners don't have a bookkeeping problem — they have a **revenue anxiety problem**. They wake up not knowing if they'll hit their numbers this month. This product solves that.

**Current tech stack:** Next.js, running on localhost:3000. EUR currency, Europe/Berlin timezone.

---

## Current State of the App

### Pages that exist today:

**`/dashboard`**
- 3 summary cards: Today's Revenue, Yesterday's Revenue, Last 7 Days (all estimated)
- Platform Performance table (last 30 days) — shows bookings, est. revenue, rev/booking, share %
- Insights panel (Beta) — currently empty, just says "add more booking data"
- Recent Entries table

**`/data-input`**
- Manual Entry form: date, platform dropdown, bookings count, class name (optional), trainer (optional)
- Import panel: drag & drop CSV/Excel/PDF upload (Mindbody, Eversports, custom exports)

**`/data` (Data page)**
- Not fully explored — raw data view

**`/reconciliation`** ← TO BE RENAMED (see below)
- Summary cards: Estimated Revenue, Actual Payouts, Difference
- Platform Breakdown table
- Quick Reconciliation Entry form: platform, month, actual payout amount

**`/settings`**
- Payout Models table: per-platform avg revenue per booking (ClassPass €9.00, Direct/Eversports €16.00, Urban Sports Club €3.50, WellPass €16.20)
- Studio Settings: name, currency, timezone, week start

---

## Decisions Made in This Session

### 1. Rename "Reconciliation" → "Payouts"
- "Reconciliation" is accountant-speak, intimidating and unclear to studio owners
- "Payouts" is the word they already use naturally ("when does my USC payout come in?")
- The page's job is: *"Did the right amount arrive from each platform?"*

**Action:** Rename the nav item, page title, and route from `reconciliation` / `Revenue Audit` → `payouts` / `Payouts`

---

### 2. Add Month-End Revenue Projection to Dashboard (PRIORITY #1)

This is the **hero feature** and the primary value proposition. Studio owners need to know: *"Am I going to hit my numbers this month?"*

**What to build:**
- A prominent projection card on the dashboard: **"Projected Month-End Revenue: €X,XXX"**
- Based on: current month's bookings pace × avg revenue per booking (from Settings payout models)
- Show a progress bar: "You're at €1,840 of your projected €4,200 this month"
- Include trend indicator vs. last month: "trending +12% vs February"

**Logic:**
```
days_elapsed = current day of month
days_in_month = total days in month
revenue_so_far = sum of all estimated revenue this month
daily_run_rate = revenue_so_far / days_elapsed
projected_month_end = daily_run_rate × days_in_month
```

**Also fix the Today/Yesterday €0.00 empty state:**
- Instead of showing €0.00 ESTIMATED when there's no data for today, show:
  - "Last recorded: [date] — €[amount]"
  - A 7-day sparkline chart

---

### 3. Add Monthly Revenue Goal Setting

**In Settings:** Add a "Monthly Revenue Target" field (€ amount).

**On Dashboard:** Orient the projection card around the goal:
- "You're 44% toward your €9,500 March goal"
- Progress bar: revenue so far / monthly goal

---

### 4. Add New Tab: Cash Flow (`/cash-flow`)

**The core insight:** Earning revenue and *receiving* that revenue are two different things. Each platform has different payout timing, and a studio could have thousands of euros "earned" but not yet in their bank account. This creates predictable cash crunches that no tool currently surfaces.

**Platform payout timing examples (configurable per studio):**
- Urban Sports Club: monthly, ~mid-month after service month
- ClassPass: monthly, ~45 days after month end
- Eversports / Direct: weekly or near-immediate
- WellPass: monthly, end of following month

**What to build — three sections:**

**A. Upcoming Payouts list (next 30 days)**
- Sorted by expected arrival date
- Columns: Platform | Estimated Amount | Expected Date | Status (Pending / Received / Late)

**B. Cash Flow Timeline / Calendar view**
- Visual monthly view showing when each platform's money is expected to land
- Each platform shown as a colored bar/marker on the timeline

**C. Gap Alert**
- Proactively surface cash gaps: "⚠️ No expected payouts between Mar 1–18. Next inflow: ~€1,800 from Urban Sports Club on Mar 19."

**Data model additions needed:**
- Add `payout_delay_days` or `payout_schedule` field to each platform in Settings
  - e.g. Urban Sports Club: "monthly, 45 days after month end"
  - e.g. Direct: "weekly, 7 days after booking"
- Cash Flow page calculates: bookings × avg rate = estimated earnings → + payout delay = expected cash arrival date

---

### 5. Improve the Insights Panel

Currently the Insights panel (Beta) takes up a third of the dashboard and just says "add more booking data." This erodes trust.

**Fix:** Either:
- Populate it with at least one insight from day one (e.g. "Urban Sports Club is your highest-volume platform" or "Your busiest day is Tuesday")
- OR remove it from the dashboard until it has real functionality

---

### 6. Data Input: Show Revenue Estimate at Entry Time

When a user logs bookings, immediately calculate and display the estimated revenue before they submit.

Example: User types "175 bookings" + selects "Urban Sports Club" → show "≈ €612.50 estimated revenue" inline before hitting Add Entry.

---

## Revised Navigation Structure

```
Dashboard       ← hero: today's revenue + month projection + goal progress
Data Input      ← unchanged
Data            ← unchanged (raw data view)
Cash Flow       ← NEW: when will money actually arrive in bank?
Payouts         ← RENAMED from Reconciliation: did the right amount arrive?
Settings        ← add: monthly goal, payout delay config per platform
```

**The story each page tells:**
- Dashboard = "How am I performing?"
- Data Input = "Log my bookings"
- Data = "See all my raw data"
- Cash Flow = "When will I actually get paid?"
- Payouts = "Was I paid the right amount?"
- Settings = "Configure my studio"

---

## The Value Proposition (for marketing/positioning)

**Primary pain point solved:** Studio owners operating across multiple fitness platforms (USC, ClassPass, WellPass, Eversports) have no single view of their daily revenue, monthly trajectory, or when cash will actually arrive. They're flying blind financially.

**Core value props:**
1. **Daily revenue clarity** — know exactly where you stand today and this month
2. **Month-end projection** — stop guessing, start planning
3. **Cash flow visibility** — know when money actually lands, not just when it's earned
4. **Payout verification** — catch underpayments from platforms automatically
5. **Multi-platform** — one place for all booking platforms

---

## Pricing Strategy

### Recommended Pricing

**Launch price: €49/month** (or €39/month billed annually — ~20% discount)

This is the sweet spot for the target customer:
- Low enough that a studio owner can expense it without approval or hesitation
- High enough to signal real, professional software (not a toy)
- If the tool catches even one platform underpayment per quarter, it pays for itself

**Do not launch below €29/month.** Too cheap signals low value, attracts price-sensitive customers who churn easily, and undermines the "serious financial software" positioning.

**Future pricing tier at €99–€149/month** is achievable once you have retention data and customer case studies. Studios doing €15k+/month revenue will pay this without hesitation if the projection accuracy is proven.

### Pricing Comparison vs. Market

| Tool | Price | What it does |
|---|---|---|
| Mindbody | ~€139–€349/mo | Full studio management (overkill, expensive) |
| Glofox | ~€100–€200/mo | Booking + basic reporting |
| Spreadsheet | €0 | What most studios use today |
| **StudioRevenue** | **€49/mo** | Pure financial intelligence layer |

Key positioning: you are NOT competing with Mindbody or Glofox. You are the **financial clarity layer that works on top of whatever they already use**. This is a different category entirely — studios don't have to switch anything.

### Revenue Potential

| Customers | Price | MRR |
|---|---|---|
| 20 studios | €49 | €980 |
| 50 studios | €49 | €2,450 |
| 100 studios | €49 | €4,900 |
| 200 studios | €69 | €13,800 |

Getting to 50 studios in the DACH market (Germany, Austria, Switzerland) alone is very achievable through direct outreach — Berlin, Munich, Vienna, and Zurich have thousands of eligible independent boutique studios.

---

## Go-to-Market Strategy

### Primary Target Customer

**Independent boutique fitness studios** with these characteristics:
- Monthly revenue: €5,000–€25,000
- Active on 2+ booking platforms simultaneously (USC + ClassPass, or USC + WellPass + Direct)
- 1–3 staff, no dedicated finance person — owner handles finances themselves
- Currently using spreadsheets or nothing at all for revenue tracking
- Located in DACH region initially (where USC and Eversports are dominant)

### Why This Segment First

These studios feel the pain most acutely:
- Too small for enterprise finance tools
- Too complex (multi-platform) for a simple spreadsheet
- Margins are thin, so missed underpayments and cash surprises genuinely hurt
- The owner is the buyer AND the user — no sales committee, fast decisions

### Acquisition Approach

**Phase 1 — Direct outreach (0–50 customers)**
- Identify studios on Urban Sports Club, ClassPass, and WellPass listings in Berlin/Munich/Vienna
- Reach out directly via Instagram DM or email: "We built a tool that shows your USC + ClassPass revenue in one dashboard and tells you when your next payout arrives. Free trial?"
- Personal onboarding for first 20 customers — learn their exact workflow and pain points

**Phase 2 — Community & word of mouth (50–200 customers)**
- Partner with studio owner Facebook groups and WhatsApp communities
- Ask happy customers for referrals — offer 1 free month per referral
- Content: "How much did ClassPass actually pay you last month vs. what you expected?" — this kind of question resonates instantly

**Phase 3 — Platform partnerships (200+ customers)**
- Explore data partnership or listing with Eversports, WellPass, or USC
- These platforms want their studios to succeed — a financial tool that improves studio health is aligned with their interests

### The Conversion Argument (what to say to studios)

The single most compelling pitch:

> *"You know that feeling at the end of the month when you're adding up your USC, ClassPass, and WellPass payouts in a spreadsheet? StudioRevenue does that automatically, shows you whether you're on track for your revenue goal, and tells you exactly when each payout will hit your account — so no more cash surprises."*

Leads that will convert fastest: studio owners who have ever been surprised by a lower-than-expected payout, or who have experienced a cash crunch because a payout was delayed.

### Biggest Risk: Data Entry Friction

The main churn risk is not price — it's **habit formation**. If studios have to manually log bookings every day, many will fall off after 2–3 weeks.

**Mitigation path:**
1. **Now:** Make CSV import as frictionless as possible (1-click, auto-parse platform exports)
2. **Soon:** Email forwarding — studios forward their platform payout emails, system parses them automatically
3. **Later:** Direct API integrations with USC, ClassPass, Eversports — data flows in with zero manual work

The long-term moat is automatic data ingestion. When the product updates itself, it becomes infrastructure the studio can't easily replace.

### What Drives Retention

1. **Projection accuracy** — if a studio sees "projected month-end: €8,400" and it comes in at €8,250, they will never cancel. Must be visibly accurate.
2. **Catching underpayments** — "We caught a €340 underpayment from WellPass in month one" is worth 10x any feature list. Make this outcome easy to surface and share.
3. **Time saved** — many owners spend 2–3 hours at month-end reconciling across platforms manually. If this tool cuts it to 15 minutes, that's a concrete, quotable benefit.

---

## Integration Roadmap

### The Core Reality

True direct API integrations with USC, ClassPass, and WellPass are **not available from day one** — these platforms have no public APIs for third-party tools and require formal partnership agreements that typically only happen at scale (200+ studios). However, there is a fully viable path to 80% of the automation benefit without any partnerships.

### What's Available Immediately (No Partnerships Needed)

**1. Smart CSV/Excel Auto-Parsing (build first)**
Every platform lets studios export monthly booking reports. The current upload in Data Input is generic — make it platform-specific:
- Detect the file format automatically (USC exports look different from ClassPass exports)
- Auto-map columns with zero manual configuration
- Populate the dashboard instantly on upload
- Studios already download these files — you're just removing the manual data entry step
- This alone is a major UX improvement over the current state

**2. Email Forwarding Parser (highest near-term impact)**
Every platform sends payout confirmation emails to studios. Build a dedicated forwarding address (e.g. `data@studiorevenueapp.com`) and a parser that reads these emails and automatically updates the dashboard.
- Studios set up a one-time auto-forward rule in Gmail/Outlook
- Parser extracts: platform, amount, period, payout date
- Dashboard updates with zero ongoing manual work
- This is how many fintech tools bootstrapped data ingestion before they had APIs — proven approach
- Covers USC, ClassPass, WellPass, Eversports payout emails from day one

**3. Mindbody API (available now, no partnership needed)**
Mindbody has a public REST API with OAuth authentication. Many independent studios use Mindbody as their booking system regardless of which aggregator platforms they're on.
- Pull class bookings, attendance, and revenue data automatically
- Genuine "connect your account" integration buildable today
- Covers a large portion of the independent studio market
- Documentation: developers.mindbodyonline.com

### Available Within 3–6 Months

**4. Eversports API**
Eversports has a developer-friendly approach and an existing API ecosystem used by other studio management tools. Most promising platform for an early formal integration.
- Reach out to Eversports directly — as a growing tool targeting their studios, they are motivated to integrate (makes their platform stickier)
- Start the partnership conversation early, before you need it

**5. Zapier Connector**
Build a Zapier integration or accept Zapier webhooks — lets technically inclined studios automate their own data flow without needing platform partnerships. Opens up connections to hundreds of tools studios already use.

**6. Google Sheets Import**
Many studios already export data into Google Sheets manually. A direct Google Sheets import removes one more step in the workflow.

### Requires Scale — Long Term Only (200+ studios)

**7. Formal USC / ClassPass / WellPass API Agreements**
At 200+ studios on the platform, you have leverage. Approach them as: "We represent X studios on your platform and want to build a deeper integration that improves their financial visibility." Until then, focus on Tiers 1 and 2.

### Integration Roadmap Timeline

```
Now (Day 1)     → Smart CSV parsing — platform-specific auto-mapping
Month 1–2       → Email forwarding parser (payout emails from all platforms)
Month 2–3       → Mindbody API — "connect your account" integration
Month 3–6       → Eversports API + Zapier connector + Google Sheets import
Month 6–12+     → Formal USC / ClassPass partnership conversations (requires scale)
```

### Strategic Note

You do not need Day 1 API integrations to validate the product or charge for it. The studios most likely to pay early are already exporting CSVs manually — if your import handles their file in 30 seconds with zero configuration, that closes the first 20 customers.

The email parser is the near-term killer feature because it turns a manual monthly task into something completely passive. That's the moment the product starts feeling like infrastructure that studios can't easily walk away from.

### Email Parsing Architecture

**Phase 1 — N8N (proof of concept on your own studio)**
- Studio forwards all platform payout/booking emails to a dedicated address
- N8N watches inbox, parses content, hits StudioRevenue API to log data
- Use to validate parsing logic across USC, ClassPass, WellPass, Eversports
- Limitation: requires manual setup per studio, not self-serve yet

**Phase 2 — Native inbound parser (before first paying customers)**
- Use Postmark Inbound, SendGrid Inbound Parse, or Mailgun Routes
- Each studio gets a unique auto-generated forwarding address (e.g. `studio-abc123@inbound.studiorevenueapp.com`)
- Emails → webhook → Next.js API → dashboard updates automatically, fully self-serve

**Sequence:** N8N on flowsol → validate per-platform parsing → migrate to Postmark/Mailgun → ship self-serve.

### Revenue Projection: Trust & Accuracy

**The projection logic (simple and correct):**
```
daily_run_rate = revenue so far this month / days elapsed
projected_month_end = daily_run_rate × total days in month
```
Simplicity is a feature — accuracy improves naturally as the month progresses.

**Add a confidence indicator alongside the projection:**
```
Projected Month-End: €8,400
▓▓▓▓▓▓▓░░░░░  Based on 18 of 31 days — moderate confidence
```
Early month = "early estimate." Late month = "high confidence." This manages expectations honestly and increases trust.

**Show a range, not a single number:**
```
Projected Month-End: €7,900 – €8,900
```
A range feels honest. A single precise number feels like it's probably wrong.

**Auto-recalibrate avg revenue per booking after each real payout:**
- When an actual payout is logged in Payouts, compare it to the estimate
- Surface: "Your actual USC avg this month was €3.72 vs your configured €3.50 — model updated"
- This self-improving loop is what builds long-term trust in the numbers

**Critical dependency:** the avg revenue per booking in Settings is manually entered — if it's wrong, every projection will be off. Auto-recalibration over time is the fix.

The long-term moat is **automatic data ingestion**. Each tier reduces friction further. When data flows in with zero manual work, switching costs become very high.

---

## Notes for Claude Code Sessions

- When building the Cash Flow tab, start with the data model (payout schedule config in Settings) before building the UI
- The projection algorithm should live in a shared utility function so Dashboard and Cash Flow can both use it
- Keep "Reconciliation" references in the codebase — rename to "Payouts" at the UI/route level and update all labels, nav items, and page titles
- The existing payout models in Settings (avg revenue per booking per platform) are the foundation for all revenue estimation logic
