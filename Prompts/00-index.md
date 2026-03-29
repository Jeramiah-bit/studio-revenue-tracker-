# StudioRevenue — Codex / Claude Prompt Library

Use these prompts in order. Each is scoped to a single feature.
Copy the prompt → paste into Claude or Codex → review output → test → commit → move to next.

## Build Order

| # | Prompt file | Feature | Est. time |
|---|---|---|---|
| 01 | `01-supabase-schema.md` | Database schema + TypeScript types | 30 min |
| 02 | `02-auth-layout.md` | Auth (login/signup) + sidebar layout | 45 min |
| 03 | `03-payout-settings.md` | Payout models CRUD (Settings page) | 45 min |
| 04 | `04-booking-entry-form.md` | Manual booking entry form | 45 min |
| 05 | `05-dashboard.md` | Dashboard KPIs + platform table + insights | 60 min |
| 06 | `06-data-table.md` | Full data table with filters + edit/delete | 45 min |
| 07 | `07-csv-import.md` | CSV upload + column mapping + import | 60 min |
| 08 | `08-reconciliation.md` | Reconciliation page + variance table | 45 min |
| 09 | `09-insights-engine.md` | Insights logic in /lib/insights.ts | 30 min |
| 10 | `10-polish.md` | Empty states, loading states, responsive | 30 min |

## Tips
- Run `npm run dev` after each prompt and check the browser before moving on
- If Claude output has a bug, paste the error back into Claude with the file context
- Never ask Claude to "fix everything" — isolate the specific error
