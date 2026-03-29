# Prompt 04 — Booking Entry Form + Data Input Page

Paste this into Claude or Codex after completing prompt 03.

---

## Prompt

Build the Data Input page for StudioRevenue at `/src/app/(app)/data-input/page.tsx`.

Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui.

### Section 1: Manual Booking Entry Form

Form fields:
- date (date picker, required, default today)
- platform (select from studio's payout models, required)
- bookings (number input, min 0, required)
- class_name (text, optional)
- trainer_name (text, optional)

On submit:
1. Look up the avg_payout_per_booking for the selected platform from Supabase `payout_models`
2. Calculate: estimated_revenue = bookings * avg_payout_per_booking
3. Insert into Supabase `booking_entries` with studio_id, all fields, and estimated_revenue
4. Show success toast (use shadcn/ui Toaster)
5. Reset form

Zod validation:
```ts
{
  date: z.string().min(1, "Date required"),
  platform: z.string().min(1, "Platform required"),
  bookings: z.number().int().min(0, "Must be 0 or more"),
  class_name: z.string().optional(),
  trainer_name: z.string().optional()
}
```

### Section 2: CSV Upload

- File input (accept .csv only)
- Use PapaParse to parse the file client-side
- After parsing show a column mapping UI:
  - User maps CSV columns to: date, platform, bookings, class_name (optional), trainer_name (optional)
  - Show a preview of first 5 rows
- "Import" button:
  - Validates each row (date required, platform required, bookings >= 0)
  - For each valid row: look up payout model, calculate estimated_revenue, insert to Supabase
  - Show count of imported vs rejected rows
  - Show rejected rows with reason

### Constraints
- "use client" component
- TypeScript strict, no `any`
- shadcn/ui: Card, Input, Select, Button, Label, Toast
- Use React Hook Form + Zod for the manual form
- Use PapaParse for CSV (import dynamically if needed)
- Keep error handling clear and user-friendly

Return TypeScript code only.
