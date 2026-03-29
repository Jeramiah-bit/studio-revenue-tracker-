# Prompt 03 — Payout Models Settings Page

Paste this into Claude or Codex after completing prompt 02.

---

## Prompt

Build the Settings page for StudioRevenue at `/src/app/(app)/settings/page.tsx`.

This is a Next.js 14 App Router page using TypeScript, Tailwind CSS, and shadcn/ui.

### Feature: Payout Models CRUD

The page has two sections:

**Section 1: Studio Settings**
- Form to update studio name, currency (EUR default), timezone, week_start
- Validate with React Hook Form + Zod
- Save to Supabase `studios` table for the authenticated user's studio
- Use shadcn/ui Card, Input, Select, Button

**Section 2: Payout Models**
- Table showing all payout models for the studio
- Columns: Platform, Avg Payout Per Booking (€), Payout Lag (days), Last Updated, Actions
- Actions: Edit, Delete
- "Add Platform" button opens a shadcn/ui Dialog with a form:
  - Platform name (text input or select from defaults)
  - Avg payout per booking (number, min 0)
  - Payout lag days (number, optional)
- Default platforms to show as options in the select:
  - Direct / Eversports
  - ClassPass
  - Urban Sports Club
  - WellPass
  - Other
- Edit opens the same Dialog pre-filled
- Delete shows a shadcn/ui AlertDialog confirmation before removing

### Data
- Load payout models from Supabase `payout_models` table filtered by studio_id
- All mutations (create/update/delete) go to Supabase directly from client
- Refresh the list after each mutation

### Validation (Zod schema)
```ts
{
  platform: z.string().min(1),
  avg_payout_per_booking: z.number().min(0),
  payout_lag_days: z.number().int().min(0).optional()
}
```

### Constraints
- TypeScript strict, no `any`
- Use shadcn/ui Table, Dialog, AlertDialog, Card, Input, Button, Select
- Client component ("use client") for interactive parts
- Keep it minimal and working

Return TypeScript code only.
