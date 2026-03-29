# Prompt 02 — Auth + Sidebar Layout

Paste this into Claude or Codex after completing prompt 01.

---

## Prompt

Build the authentication flow and main app layout for a Next.js 14 App Router app called StudioRevenue. Use TypeScript, Tailwind CSS, and shadcn/ui components. Use Supabase Auth for email/password login.

### Files to create

**1. `/src/app/(auth)/login/page.tsx`**
- Email + password login form
- Validate with React Hook Form + Zod
- On success: redirect to /dashboard
- Link to /signup
- Show error message on failed login
- Use shadcn/ui Card, Input, Button, Label

**2. `/src/app/(auth)/signup/page.tsx`**
- Email + password signup form
- Same validation pattern as login
- On success: redirect to /dashboard
- After signup, create a profile row in Supabase for the user
- Link to /login

**3. `/src/lib/supabase/client.ts`**
- Export a Supabase browser client using createBrowserClient from @supabase/ssr

**4. `/src/lib/supabase/server.ts`**
- Export a Supabase server client using createServerClient from @supabase/ssr
- Handle cookie management correctly for Next.js App Router

**5. `/src/middleware.ts`**
- Protect all routes under /dashboard, /data, /data-input, /reconciliation, /settings
- Redirect unauthenticated users to /login
- Use Supabase session check

**6. `/src/app/(app)/layout.tsx`**
- Sidebar layout wrapping all protected pages
- Sidebar links: Dashboard, Data Input, Data, Reconciliation, Settings
- Show studio name in sidebar header (fetch from Supabase)
- Show user email + logout button at bottom of sidebar
- Use shadcn/ui for sidebar structure
- Responsive: sidebar collapses on mobile

### Constraints
- TypeScript strict mode, no `any`
- Use @supabase/ssr (not @supabase/auth-helpers-nextjs)
- Keep components minimal and working
- No unnecessary state libraries

Return TypeScript code only. One file at a time, clearly labelled.
