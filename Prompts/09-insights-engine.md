# Prompt 09 — Insights Engine

Paste this into Claude or Codex after completing prompt 08.

---

## Prompt

Build the insights engine for StudioRevenue at `/src/lib/insights.ts`.

TypeScript only. No UI — pure logic functions that return plain-language insight strings.

### Function signature

```ts
export function generateInsights(
  entries: BookingEntry[],
  payoutModels: PayoutModel[],
  period?: { from: Date; to: Date }
): string[]
```

Returns an array of up to 3 insight strings, prioritised by magnitude of impact.

### Rules to implement (in priority order)

**Rule 1: Lowest yield platform**
Find the platform with the lowest revenue_per_booking.
If it's more than 30% below the highest, return:
"[Platform] has the lowest revenue per booking at €X — [X]% below your best channel"

**Rule 2: Yield gap vs direct**
If "Direct / Eversports" exists in data, compare its revenue_per_booking to each third-party platform.
Return:
"Switching one [Platform] booking to direct would earn you €X more per spot"

**Rule 3: Revenue share concentration**
If any single platform accounts for more than 60% of total revenue:
"[Platform] drives [X]% of your estimated revenue — high dependency on one channel"

**Rule 4: Day-over-day change**
Compare today's revenue to yesterday's.
"Revenue is up/down [X]% vs yesterday ([€Y] → [€Z])"

**Rule 5: Week-over-week (only if 14+ days of data)**
Compare this week's total to last week's.
"This week is tracking [X]% above/below last week"

**Rule 6: Booking volume with no revenue**
If any platform has bookings but avg_payout_per_booking = 0 or no payout model:
"[Platform] has [X] bookings with no payout model configured — add one in Settings"

### Formatting rules
- Always round € values to 2 decimal places
- Always round % values to 1 decimal place
- Return max 3 insights — pick highest impact
- If fewer than 3 days of data, skip week-over-week rule
- If no data at all, return empty array

### Types (import from /src/types/index.ts)
Use `BookingEntry` and `PayoutModel` types already defined.

### Constraints
- Pure functions only — no Supabase calls, no side effects
- TypeScript strict, no `any`
- Export `generateInsights` as named export
- Add a brief JSDoc comment to each rule function

Return TypeScript code only.
