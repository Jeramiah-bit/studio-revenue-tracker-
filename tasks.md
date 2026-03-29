# StudioRevenue — Build Checklist

Track your progress here. Check off each task as you complete it.
Use the prompts/ folder for the Claude/Codex prompts for each section.

---

## Phase 1: Project Setup (Hour 0–4)

### Scaffold
- [ ] Run: `npx create-next-app@latest studio-revenue --typescript --tailwind --app --src-dir`
- [ ] Install dependencies (see below)
- [ ] Create Supabase project at supabase.com
- [ ] Add `.env.local` with Supabase URL + anon key
- [ ] Run `npm run dev` — confirm blank app works

### Install dependencies
```bash
# UI
npx shadcn@latest init
npx shadcn@latest add button card input label select dialog alert-dialog table badge toast skeleton sheet popover calendar

# Core
npm install @supabase/supabase-js @supabase/ssr
npm install react-hook-form @hookform/resolvers zod
npm install @tanstack/react-table
npm install date-fns
npm install papaparse
npm install recharts

# Types
npm install -D @types/papaparse
```

- [ ] Confirm all packages installed without errors

---

## Phase 2: Database + Auth (Hour 4–8)

### Database (Prompt 01)
- [ ] Run Prompt 01 → get SQL schema output
- [ ] Paste SQL into Supabase SQL editor and run
- [ ] Confirm all 5 tables created in Supabase dashboard
- [ ] Confirm RLS policies applied
- [ ] Copy TypeScript types output to `/src/types/index.ts`

### Auth + Layout (Prompt 02)
- [ ] Run Prompt 02 → get auth + layout files
- [ ] Create `/src/lib/supabase/client.ts`
- [ ] Create `/src/lib/supabase/server.ts`
- [ ] Create `/src/middleware.ts`
- [ ] Create `/src/app/(auth)/login/page.tsx`
- [ ] Create `/src/app/(auth)/signup/page.tsx`
- [ ] Create `/src/app/(app)/layout.tsx`
- [ ] Test: sign up a new user → redirects to /dashboard ✓
- [ ] Test: visit /dashboard while logged out → redirects to /login ✓
- [ ] Test: sidebar shows and links work ✓

---

## Phase 3: Settings + Data Entry (Hour 8–16)

### Payout Settings (Prompt 03)
- [ ] Run Prompt 03 → get settings page
- [ ] Create `/src/app/(app)/settings/page.tsx`
- [ ] Test: add a payout model (e.g. ClassPass, €6.50/booking) ✓
- [ ] Test: edit a payout model ✓
- [ ] Test: delete a payout model with confirmation ✓
- [ ] Test: studio settings save correctly ✓

### Booking Entry Form (Prompt 04)
- [ ] Run Prompt 04 → get data input page
- [ ] Create `/src/app/(app)/data-input/page.tsx`
- [ ] Test: add a manual booking entry ✓
- [ ] Test: estimated_revenue calculated correctly (bookings × payout rate) ✓
- [ ] Test: CSV upload with sample file ✓
- [ ] Test: column mapping UI works ✓
- [ ] Test: rejected rows shown with reason ✓

---

## Phase 4: Dashboard (Hour 16–24)

### Dashboard (Prompt 05)
- [ ] Run Prompt 05 → get dashboard page
- [ ] Create `/src/app/(app)/dashboard/page.tsx`
- [ ] Create stub `/src/lib/insights.ts` (returns empty array for now)
- [ ] Test: KPI cards show today / yesterday / 7-day revenue ✓
- [ ] Test: Platform table shows correct aggregations ✓
- [ ] Test: Revenue per booking highlights lowest/highest ✓
- [ ] Test: Recent entries table shows last 10 ✓
- [ ] Test: Empty state shows when no data ✓

---

## Phase 5: Data Management (Hour 24–32)

### Data Table (Prompt 06)
- [ ] Run Prompt 06 → get data table page
- [ ] Create `/src/app/(app)/data/page.tsx`
- [ ] Test: table shows all entries ✓
- [ ] Test: date filter works ✓
- [ ] Test: platform filter works ✓
- [ ] Test: edit entry → recalculates estimated_revenue ✓
- [ ] Test: delete entry with confirmation ✓
- [ ] Test: sorting works ✓
- [ ] Test: pagination works ✓

---

## Phase 6: Reconciliation (Hour 32–40)

### Reconciliation (Prompt 08)
- [ ] Run Prompt 08 → get reconciliation page
- [ ] Create `/src/app/(app)/reconciliation/page.tsx`
- [ ] Test: add actual payout for a platform + month ✓
- [ ] Test: variance calculated correctly ✓
- [ ] Test: status badges show correct colours ✓
- [ ] Test: month selector changes the view ✓

---

## Phase 7: Insights Engine (Hour 40–44)

### Insights (Prompt 09)
- [ ] Run Prompt 09 → get insights.ts
- [ ] Replace stub `/src/lib/insights.ts` with real implementation
- [ ] Test: lowest yield platform insight triggers correctly ✓
- [ ] Test: revenue share concentration insight ✓
- [ ] Test: day-over-day change insight ✓
- [ ] Test: insights show on dashboard ✓

---

## Phase 8: Polish + Deploy (Hour 44–48)

### Polish (Prompt 10)
- [ ] Run Prompt 10 → get polish components
- [ ] Add EmptyState component and apply across all pages ✓
- [ ] Add loading skeletons ✓
- [ ] Fix responsive layout on mobile ✓
- [ ] Add EstimatedBadge to all revenue figures ✓
- [ ] Add PageHeader to all pages ✓

### Pre-deploy checks
- [ ] Test full user flow: signup → add payout model → add bookings → view dashboard → reconcile
- [ ] Check all pages on mobile viewport
- [ ] Confirm all revenue figures labelled as "estimated"
- [ ] Check for console errors
- [ ] Seed with realistic sample data for demo

### Deploy to Vercel
- [ ] Push to GitHub
- [ ] Connect repo to Vercel
- [ ] Add env vars in Vercel dashboard:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Deploy
- [ ] Test deployed URL end-to-end ✓

---

## Sample Data for Testing

Use this to seed realistic data after setup:

**Payout models:**
| Platform | Avg payout/booking | Payout lag |
|---|---|---|
| Direct / Eversports | €14.00 | 3 days |
| ClassPass | €6.50 | 30 days |
| Urban Sports Club | €7.20 | 30 days |
| WellPass | €8.00 | 45 days |

**Booking entries (last 7 days):**
Add 3–5 entries per day across different platforms to populate the dashboard.

---

## Post-MVP: What to build next

Once the above is working and you're using it daily:

1. [ ] Platform yield comparison page (`/platforms`)
2. [ ] Payout lag tracker (expected cash arrival dates)
3. [ ] Cash flow forecast (next 30/60 days)
4. [ ] Eversports PDF payout import
5. [ ] "Should I use this platform?" advisor (rule-based)
6. [ ] Multi-studio support
