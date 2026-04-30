# Freelance Manager — Project Instructions

> **CRITICAL — DESIGN SOURCE OF TRUTH**
>
> The whole UI **must match pixel-perfect** the reference design located at
> [`design-reference/`](./design-reference/). This is the canonical visual + UX spec.
>
> Whenever you build or modify a page, **read the matching file in
> `design-reference/src/` first** and replicate it exactly: layout, spacing,
> colors, typography, micro-interactions, copy, French wording.
>
> **Files** :
>
> - `design-reference/FreelanceManager.html` — root HTML, CSS variables, global styles
> - `design-reference/src/app.jsx` — router + state
> - `design-reference/src/shell.jsx` — Sidebar, Topbar, StatusPill, BillingTypePill, Modal, Toasts
> - `design-reference/src/icons.jsx` — full SVG icon library (use this exact set)
> - `design-reference/src/data.jsx` — formatters (`fmtEUR`, `fmtDate`, `fmtRelative`, `initials`, `avatarColor`) + seed data shape
> - `design-reference/src/page-dashboard.jsx`
> - `design-reference/src/page-clients.jsx`
> - `design-reference/src/page-client-detail.jsx`
> - `design-reference/src/page-projects.jsx`
> - `design-reference/src/page-tasks.jsx`
> - `design-reference/src/page-billing.jsx`
> - `design-reference/src/page-invoice-new.jsx`
> - `design-reference/screenshots/` — 2 screenshots showing the rendered Tasks page and Clients page (cross-reference for any visual doubt)
> - `design-reference/FreelanceManager-design.zip` — original handoff archive (kept for traceability)
>
> **Do not deviate** from the design without explicit user approval.

---

## Domain Model

The app revolves around **4 core entities**:

```
User ─┬─> Client ─┬─> Project (linked to Linear) ─> Task (synced from Linear)
      │           └─> Invoice ─> InvoiceLine ─> (optional) Task
      │
      └─> UserSettings
```

### Key rules

- **Project = Linear project mirror.** A project can ONLY exist by being linked
  to a Linear team or project. We never create a project manually — otherwise we
  lose the auto-sync of tasks. A `Project` row stores `linearProjectId` (or
  `linearTeamId`), `clientId`, `name`, `key`, `desc`, `status`. See decision I.
- **Task = Linear issue mirror.** Each `Task` row stores the `linearIssueId`,
  current `status`, `title`, `estimate` (in days), `completedAt`, plus our own
  fields: `invoiceId` (when invoiced), `projectId`, `clientId`. The actual
  source of truth is Linear; we cache + augment with billing-related state.
  See decision H.
- **Task statuses we care about**: `pending_invoice` | `done` | `in_progress` |
  `backlog`. The "ready to bill" gate is `pending_invoice`.
- **Invoice statuses**: `DRAFT` | `SENT` | `PAID` | `OVERDUE` (overdue is
  computed: `SENT` and `dueDate < now()` and not `PAID`).
- **Invoice kinds**: `standard` (line items, often from tasks) or `deposit`
  (single line, fixed amount — used for `FIXED` price clients).
- **Billing modes (Client.billingMode)**: `DAILY` | `FIXED` | `HOURLY`. **No
  `FREE`** — removed in the rework.
- **Client.category**: drives task filtering (Freelance / Side project /
  Personal / Study) — see chips on Tasks page.

### Task → Invoice line mapping

When a task is added to an invoice, the line is auto-built from the client's
billing mode:

| `client.billingMode` | `qty`                       | `rate`                                         |
| -------------------- | --------------------------- | ---------------------------------------------- |
| `DAILY`              | `task.estimate` (days)      | `client.rate` (€/day)                          |
| `HOURLY`             | `task.estimate * 8` (hours) | `client.rate` (€/hour)                         |
| `FIXED`              | always `1`                  | `0` (rate filled manually — deposit/milestone) |

`label` = `[${linearId}] ${title}`.

Once an invoice is created, all its tasks get `task.invoiceId = inv.id`. Those
tasks no longer appear in the "eligible" list of the new-invoice page.

---

## Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** strict mode, all code in **English** (variable / function /
  comment names — UI strings stay in **French**)
- **Tailwind CSS v4** + custom CSS variables defined in `globals.css` (mirrors
  the design's `oklch()` token system — see Design Tokens section below)
- **Prisma** + PostgreSQL
- **better-auth** for authentication (single-user perso app, but auth is
  mandatory to keep data private)
- **TanStack Query v5** for ALL server state (see "Data fetching" section)
- **Linear SDK** (`@linear/sdk`) for project/task sync
- **dnd-kit** for the drag & drop invoice builder
- **Inter** + **JetBrains Mono** (numerics get `font-feature-settings: 'tnum' 1`
  via the `.num` / `.mono` classes)
- Package manager: **pnpm**

### Things we removed (design doesn't use them)

- `next-intl` and the `messages/` folder — UI is **French only**
- Stadium-shape border radius system (replaced by simple `6/8/10/14px` tokens)
- Recharts for charts → custom inline SVG (closer to the design)
- Heroicons in app code → custom SVG icon component (`<I name="..."/>`) ported
  from `design-reference/src/icons.jsx`
- Pages: Expenses, Calendar, Financial, Notifications page, sub-pages of
  Settings (appearance, audit-log, bank, billing, data, integrations,
  notifications, tags, tax)
- Models: ClientNote, TaskOverride, TaskCache, Expense, Notification, AuditLog,
  UsageMetric, Tag, BankTransaction
- Onboarding / welcome modal

---

## Design Tokens (mirrors `design-reference/FreelanceManager.html`)

Defined in `src/app/globals.css`:

```css
:root {
  --bg-0: oklch(0.16 0.006 240);
  --bg-1: oklch(0.2 0.008 240);
  --bg-2: oklch(0.235 0.009 240);
  --bg-3: oklch(0.27 0.01 240);
  --bg-hover: oklch(0.3 0.012 240);
  --border: oklch(0.32 0.01 240 / 0.6);
  --border-strong: oklch(0.4 0.012 240);
  --text-0: oklch(0.97 0.004 240);
  --text-1: oklch(0.78 0.008 240);
  --text-2: oklch(0.58 0.01 240);
  --text-3: oklch(0.42 0.01 240);
  --accent: oklch(0.86 0.19 128);
  --accent-soft: oklch(0.86 0.19 128 / 0.14);
  --accent-text: oklch(0.2 0.05 128);
  --warn: oklch(0.78 0.16 55);
  --warn-soft: oklch(0.78 0.16 55 / 0.14);
  --danger: oklch(0.7 0.2 25);
  --danger-soft: oklch(0.7 0.2 25 / 0.15);
  --info: oklch(0.78 0.13 240);
  --info-soft: oklch(0.78 0.13 240 / 0.14);
  --purple: oklch(0.75 0.15 300);
  --purple-soft: oklch(0.75 0.15 300 / 0.14);
  --radius: 10px;
  --radius-sm: 6px;
  --radius-lg: 14px;
}
```

**App shell layout**: `grid-template-columns: 248px 1fr` — fixed-width sidebar +
sticky topbar.

**Page container**: `padding: 32px 40px 80px; max-width: 1400px;`

**Card**: `bg-bg-1 border-border rounded-[10px] p-5` — variations: `card-tight`
(`p-4`), KPI accent border `border-l-2 border-accent`.

**Button sizes**: standard `padding: 8px 14px`, sm `padding: 5px 10px`. Variants:
`primary` (accent), `secondary` (bg-2 + border), `ghost` (text only),
`danger` (danger-soft).

**Pills (statuses)**: `padding: 3px 9px; border-radius: 99px;` with a 6px dot
`::before` (use `pill-no-dot` to hide the dot). Color classes:
`pill-pending` (warn), `pill-done`/`pill-paid` (accent), `pill-sent` (info),
`pill-overdue` (danger), `pill-deposit` (purple), `pill-daily` (info),
`pill-fixed` (purple), `pill-hourly` (cyan), `pill-draft` (bg-3).

**Filter chips**: `padding: 5px 11px; border-radius: 99px;` — active state =
`bg-accent text-accent-text`.

**Table**: `border-collapse: collapse;` — TH uppercase 11px text-2, TD 13px,
hover row = `bg-bg-2`. Right-aligned numeric columns use `text-right` + `.num`
font.

**Avatars**: square rounded — sm `22×22`, default `28×28`, lg `40×40`. Color is
a deterministic `linear-gradient(135deg, ...)` derived from name (see
`avatarColor()` in `data.jsx`).

---

## Data fetching with TanStack Query — REQUIRED PATTERN

All server state goes through TanStack Query. **Never** call `fetch` directly
in a component or page.

### Pattern: one hook per resource

```ts
// src/hooks/use-clients.ts
const QUERY_KEY = ["clients"] as const

export function useClients() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get("/api/clients"),
    staleTime: 30_000,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientCreateInput) => api.post("/api/clients", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
```

### Rules

1. **Query keys** are arrays starting with the resource name; nested keys for
   filters/ids: `["clients"]`, `["client", id]`, `["tasks", { clientId }]`.
2. Mutations **always** invalidate the relevant query keys in `onSuccess`. List
   mutations that change related entities (e.g. invoicing tasks invalidates
   `tasks`, `invoices`, and the affected `client` detail).
3. `staleTime` defaults of `30_000` for lists, `60_000` for details. Long-lived
   data (settings, current user) can go to `5 * 60_000`.
4. Optimistic updates only for low-risk toggles (e.g. selecting a task). Server
   roundtrips for anything money-related (creating/sending/paying invoices).
5. Toast feedback in the mutation's `onSuccess`/`onError` (use `toast()` from
   `@/components/providers/toast-provider`).

---

## Routing & pages (target structure)

```
src/app/
├── (dashboard)/
│   ├── layout.tsx                   # AppShell (sidebar + topbar)
│   ├── dashboard/page.tsx           # /dashboard
│   ├── clients/
│   │   ├── page.tsx                 # /clients
│   │   └── [id]/page.tsx            # /clients/:id (tabs: overview/projects/tasks/invoices)
│   ├── projects/page.tsx            # /projects
│   ├── tasks/page.tsx               # /tasks
│   ├── billing/
│   │   ├── page.tsx                 # /billing (list + drawer)
│   │   └── new/page.tsx             # /billing/new (drag & drop builder)
│   ├── analytics/page.tsx           # stub "Bientôt disponible"
│   └── settings/page.tsx            # stub "Bientôt disponible"
├── auth/
│   ├── login/page.tsx
│   └── register/page.tsx
└── api/...                          # only the routes the design needs
```

### API routes we keep / need

- `/api/auth/[...all]` — better-auth handler
- `/api/clients` (GET, POST) + `/api/clients/[id]` (GET, PATCH, DELETE) +
  `/api/clients/[id]/archive` + `/api/clients/[id]/dashboard` (KPI by client)
- `/api/projects` (GET, POST link with Linear)
- `/api/tasks` (GET with filters, sync trigger)
- `/api/invoices` (GET, POST) + `/api/invoices/[id]` (PATCH for status changes)
- `/api/invoices/[id]/files` (existing, keep for PDF storage)
- `/api/linear/refresh` (manual sync)
- `/api/linear/teams`, `/api/linear/projects`, `/api/linear/issues` (used to
  link new projects)
- `/api/dashboard` (aggregated KPIs)
- `/api/user`, `/api/user/account`, `/api/settings` (minimal)

Everything else is removed.

---

## Coding rules (project-specific)

- **Icons**: import the `<I name="..."/>` component from `@/components/ui/icon.tsx`
  (ported from `design-reference/src/icons.jsx`). **Do not** import Heroicons
  in app code anymore.
- **Formatters**: import from `@/lib/format.ts` — `fmtEUR`, `fmtEURprecise`,
  `fmtDate`, `fmtDateShort`, `fmtRelative`, `initials`, `avatarColor`.
- **Status pills**: use `<StatusPill status={...}/>` and
  `<BillingTypePill type={...}/>` from `@/components/ui/pill.tsx`.
- **French in UI**: all visible strings are in French. Use the exact wording
  from `design-reference/src/page-*.jsx` ("Nouvelle facture", "À facturer",
  "Encours", "Pipeline", "Émise le", "Échéance", etc.).
- **Numbers**: any numeric cell uses `.num` class for `tnum` font feature.
- **No comments explaining what the code does** — code is self-documenting.
  Only add a comment when the _why_ is non-obvious (a constraint, an
  invariant, or a workaround).
- **File size**: target 200–400 lines; absolute max 800.
- **Tests**: keep co-located `*.test.ts(x)` files. Cover billing math, invoice
  status transitions, Linear sync, and any pricing/edge logic.

---

## Linear integration

- A `Client` is associated with a Linear team or Linear project via a
  `LinearMapping` (or directly via `Project.linearProjectId`).
- A `Project` is **always** mirroring a Linear project. Manual creation is not
  allowed in the UI — only "Lier projet Linear".
- Tasks are pulled from Linear and stored in `Task` (with `linearIssueId`,
  `status`, `estimate`, `title`, `completedAt`, `priority`).
- A webhook (`/api/webhooks/linear`) keeps the local cache in sync; a manual
  "Sync Linear" button on Tasks/Projects page calls `/api/linear/refresh`.
- Linear API token is **encrypted at rest** (AES-256-GCM via `src/lib/encryption.ts`).
