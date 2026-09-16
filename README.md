# Creative Ops — AI Creative Operations Platform

An AI-powered creative and marketing department: turn a one-line campaign
idea into a structured brief, differentiated creative concepts, generated
visuals, and a full human review/approval workflow.

```
Idea → AI Creative Brief → Creative Concepts → Image Generation
     → AI Quality Review → Human Review → Edit with AI / Edit in Canva
     → Approve → (future) Resize & Publish
```

## Stack

- **Frontend**: Next.js 16 (App Router), TypeScript (strict), Tailwind CSS v4, shadcn/ui (`base-nova` preset, built on Base UI)
- **Backend**: Next.js Server Actions + Route Handlers, Supabase (Postgres, Auth, Storage, RLS)
- **AI**: Provider-agnostic abstraction in `src/lib/ai` — OpenAI implementation today, swappable

## Getting started

### 1. Create a Supabase project

Create a project at [supabase.com/dashboard](https://supabase.com/dashboard), then from **Project Settings → API** copy:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key (keep secret) → `SUPABASE_SERVICE_ROLE_KEY`

Copy `.env.local.example` to `.env.local` and fill these in. `.env.local` in this repo currently holds **non-functional placeholder values** — replace them before running anything that touches auth or data.

### 2. Run the database migrations

No Supabase CLI project is linked yet. Easiest path: open your project's **SQL Editor** in the Supabase dashboard and run each file in `supabase/migrations/` **in order** (`0001_core.sql` → `0007_storage.sql`) — they're idempotent-safe to run once, in sequence.

Alternatively, with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates the full schema (organisations, campaigns, briefs, concepts, designs/versions, feedback, connections, …), Row Level Security policies, and the five Storage buckets. Multi-tenancy is enforced by RLS — see `supabase/migrations/0001_core.sql` for the `is_member_of_org()` pattern every policy uses.

### 3. (Optional) Connect a real AI provider

Without `OPENAI_API_KEY` set, the app runs on a clearly-labeled **mock provider** — the full brief → concepts → image → review workflow works end to end with placeholder output, so you can test the product without live credentials or cost. Set `OPENAI_API_KEY` in `.env.local` to switch to real generation (model ids are configurable — see `.env.local.example`).

### 4. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up — every new account gets its own workspace (organisation) automatically.

### Useful commands

```bash
npm run dev       # start the dev server (Turbopack)
npm run build     # production build — also the fastest way to full-project typecheck
npm run lint      # ESLint
```

## Project structure

```
src/
  app/                    Routes (App Router)
    (auth)/               Sign in / sign up — public
    (app)/                Everything behind auth — dashboard, create, campaigns,
                           review, library, brand, connections, settings
    api/connections/canva/ OAuth + return-navigation endpoints (must be Route Handlers)
  components/
    ui/                   shadcn/ui primitives (generated — prefer `npx shadcn add` over hand-editing)
    layout/                App shell, sidebar, top bar
    creative/               Campaign/concept/design cards, review panel, dialogs
    brand/                  Brand Brain CRUD
    connections/            Integration cards
    shared/                 PageHeader, EmptyState, StatusBadge, etc.
  lib/
    ai/                    Provider-agnostic AI layer — see below
    canva/                  Canva Connect API integration — see below
    creative/               Domain services: briefs, concepts, designs, versioning, queries
    supabase/               Browser/server/admin Supabase clients
    actions/                Server Actions (mutations) called from Client Components
    constants/               Enums, labels, nav config — single source of truth
    validation/              Zod schemas for every mutation input
supabase/
  migrations/               Versioned SQL, apply in order
```

## AI provider abstraction (`src/lib/ai`)

Nothing outside `src/lib/ai/**` imports an AI SDK directly. Application code depends only on the interfaces in `src/lib/ai/types.ts` (`LLMProvider`, `ImageProvider`, `ImageEvalProvider`), resolved through `getLLMProvider()` / `getImageProvider()` / `getImageEvalProvider()` in `src/lib/ai/index.ts`. Adding a second provider (e.g. a Google model) means implementing the interface under `src/lib/ai/providers/<name>/` and adding one branch to the factory — no changes anywhere else.

Every AI output is validated through a Zod schema (`src/lib/ai/schemas.ts`) before it touches the database.

## Canva integration (`src/lib/canva`)

Implemented against the real, documented [Canva Connect API](https://www.canva.dev/docs/connect/) (OAuth 2.0 + PKCE, asset upload, design creation, export, return navigation) — not a mock. Two things are explicitly **not** done yet, flagged with `TODO` comments at the exact call sites:

- Cryptographic verification of Canva's return-navigation JWT signature (currently decoded, not verified against Canva's JWKS).
- Brand Template autofill — Canva Brand Templates must be created manually in the Canva UI first; there's no API to define one.

See `src/lib/canva/types.ts` for the full breakdown of what's real vs. not yet built, and the in-app **Connections → Canva** page for the same summary.

## Current status (MVP)

Built and working (against the mock AI provider by default, real OpenAI once configured):

- Auth (Supabase, email/password) with auto-provisioned workspaces
- Dashboard, Create Campaign, Campaign detail (brief + concepts)
- Full review workflow: Approve / Reject / Edit with AI / Regenerate / Add Feedback / Version history & restore
- Canva "Edit in Canva" + "Sync from Canva" (real API calls, needs `CANVA_CLIENT_ID`/`SECRET` to activate)
- Brand Brain: identity, rules, audiences, courses/products, assets (all live CRUD, feeding the AI Creative Director's prompts)

Intentionally deferred (well-designed placeholders in the UI, schema already supports them): Quick Creative, Calendar, Published, Analytics, Meta/LinkedIn/Website connections, resize/adapt-for-platform, scheduled publishing.
