# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on http://localhost:3000
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

No test suite is configured (Jest/Vitest not installed).

## Environment Setup

Copy `.env.example` to `.env.local` with these required values:

```
NEXT_PUBLIC_SUPABASE_URL=<Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase public key>
```

## Tech Stack

- **Next.js 15** (App Router, React 19, TypeScript strict mode)
- **Supabase** — PostgreSQL + Auth + Row Level Security (RLS)
- **Tailwind CSS** with a custom billiard-hall theme (see `tailwind.config.ts`)
- **@supabase/ssr** for server-side session handling via cookies

## Architecture

### Routing Groups

```
app/(app)/     # Protected routes — all require auth
app/(auth)/    # Login and registration
app/api/       # API routes (sales-cuts endpoint)
```

`middleware.ts` handles all auth redirects: unauthenticated users → `/login`; authenticated users hitting auth pages → `/dashboard`. The root `/` redirects to `/login`.

### Server/Client Split

Pages (route handlers) are **async server components** that call `createClient()` from `lib/supabase/server.ts` to retrieve the authenticated user and their `organization_id`. Initial data is fetched server-side and passed as props to client components.

Heavy interactivity lives in `-client.tsx` files (e.g., `mesas-client.tsx`, `ventas-client.tsx`). These use `createBrowserClient()` from `lib/supabase/client.ts` for mutations and data refresh after state changes. There are no Supabase real-time subscriptions — the client re-fetches after mutations.

### Multi-Tenant Isolation

Every business table has an `organization_id` column. RLS policies on all tables call a `user_in_org(org_id)` SQL function to enforce org-scoped access. When a new user signs up, a Supabase trigger (`bootstrap_new_user`) automatically creates their organization, profile, org membership (owner role), and default settings.

### Billing Logic

Table sessions track time via `start_at`, `paused_at`, `ended_at`, and `total_paused_seconds`. All billing calculations (elapsed time, charged minutes, totals) live in `lib/table-session-utils.ts`. Charged time rounds **up** to the nearest minute. The final order total = table_total + products_total − discount_total.

### Sales Cuts

Sales cuts represent shift or day financial summaries. The `api/sales-cuts/route.ts` endpoint handles creation, aggregating paid orders by `organization_id` and cut type (`shift` | `day`). Cuts are linked to their constituent orders via the `sales_cut_orders` join table.

### Thermal Ticket Printing

`app/globals.css` contains print media rules that hide all UI chrome and render tickets at **58mm width** in monospace for POS printers. The `thermal-ticket.tsx` and `sales-cut-thermal-ticket.tsx` components contain the printable layouts — do not add responsive classes or colors to them.

### Design System

`components/ui.tsx` exports the shared component library: `AppShell`, `PageHeader`, `MetricCard`, `StatusBadge`, `TableCard`, `Sidebar`, `Header`. Use these instead of building one-off layouts. The custom Tailwind theme uses color names like `obsidian`, `shell`, `panel`, `felt`, `cream`, `gold`, `wood-dark` — avoid raw hex values.

## Database Migrations

SQL migrations live in `supabase/migrations/`. Apply with:

```bash
supabase db push
```

## Deployment

Hosted on Vercel. Environment variables are set in the Vercel dashboard. Supabase is the managed backend — no separate server to deploy.
