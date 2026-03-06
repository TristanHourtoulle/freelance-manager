# FreelanceDash

> Product Requirements Document — v1.0 — June 2025

**Author:** Tristan Hourtoulle

**Stack:** Next.js 16 · TypeScript · Prisma · PostgreSQL · Railway

**Integrations:** Linear API (GraphQL)

---

## 1. Vision & Objective

FreelanceDash is a centralized personal dashboard designed for a solo freelancer. It aggregates Linear data (tasks, projects, estimates) with a custom business layer (clients, hourly rates, categories, revenue). The goal is to answer at a glance: *"What do I need to invoice, how much have I earned, and where am I spending my time?"*

### Out of scope

- PDF invoice generation — handled by Abby (external tool)
- Team management / multi-user
- Real-time time tracking (timer)

## 2. Target Users

Strictly personal use. Single user: Tristan. No multi-user auth, no roles. Simple authentication (magic link or credentials) is sufficient to protect access.

## 3. Modules & Features

### 3.1 — Client Management

Central reference for all freelance clients. Each client is the keystone linking Linear tasks, billing mode, and revenue. 4 available modes: hourly rate, daily rate, fixed project price, or free.

| Feature | Priority | Description |
|---------|----------|-------------|
| Client list | P0 | Table with name, category, billing mode, rate, status (active/inactive), contact |
| Create / edit client | P0 | Form: name, email, company, billing mode + associated rate, category, notes |
| Billing modes | P0 | 4 modes: Hourly rate (EUR/h) · Daily rate (EUR/d) · Fixed project price (EUR flat) · Free (EUR 0, no calculation) |
| Client categories | P0 | Enum: Freelance · Study · Personal · Side-project — filterable across all views |
| Client archiving | P1 | Soft delete: archived client hidden by default but history preserved |
| Linear → Client mapping | P0 | Associate one or more Linear projects/teams to a client |

#### Client Schema

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary identifier |
| name | string | Client or company name |
| email | string? | Contact email |
| category | enum | FREELANCE \| STUDY \| PERSONAL \| SIDE_PROJECT |
| billingType | enum | HOURLY \| DAILY \| FIXED \| FREE — client calculation mode |
| hourlyRate | decimal? | Hourly rate in euros (if billingType = HOURLY) |
| dailyRate | decimal? | Daily rate in euros (if billingType = DAILY) |
| fixedRate | decimal? | Fixed project price in euros (if billingType = FIXED) |
| linearTeamId | string? | Associated Linear team ID |
| linearProjectIds | string[] | Associated Linear project IDs |
| isActive | boolean | true = active client |
| notes | text? | Free-form notes |
| createdAt | datetime | Creation date |

### 3.2 — Tasks (Synced from Linear)

Tasks are not stored locally persistently — they are fetched from the Linear GraphQL API. Only business metadata (calculated amount, time override, "to invoice" flag) is persisted in the local database.

| Feature | Priority | Description |
|---------|----------|-------------|
| Task list by client | P0 | Linear issues filtered by team/project associated with client, with status, title, estimate |
| Invoice amount calculation | P0 | estimate (hours) x client hourly rate = auto-calculated amount, displayed per task |
| "To invoice" flag | P0 | Manual checkbox to mark a task as included in the next invoice |
| "Invoiced" flag | P0 | Mark a task as already invoiced (archived from "to invoice" view) |
| "To invoice" view by client | P0 | Filterable summary: completed uninvoiced tasks + total EUR |
| Linear sync (on-demand) | P1 | "Refresh" button to re-fetch issues from Linear API |
| Linear webhooks | P2 | Automatic sync on each issue update via Linear webhook → Next.js endpoint |
| Create issue from dashboard | P2 | Minimal form to create a Linear issue directly in the app |
| Edit estimate from dashboard | P1 | Edit the estimate field of a Linear issue via GraphQL mutation without opening Linear |

#### Estimation Convention = Time Spent

Linear is configured in hours mode (Settings → Use hours for estimates). The estimate field is filled manually at the end of a task and represents the actual time spent. This value is used for billing calculation.

#### Local Metadata (TaskMeta table)

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary identifier |
| linearIssueId | string | Linear issue ID (logical foreign key) |
| clientId | uuid | FK to Client |
| isBillable | boolean | Task to include in billing (default: true) |
| isBilled | boolean | Task already invoiced |
| billedAt | datetime? | Invoice date |
| invoiceRef | string? | Abby invoice reference (manual entry) |
| timeOverride | decimal? | Manual time override (if Linear estimate is incorrect) |
| notes | text? | Free-form billing notes |

### 3.3 — Billing (What to Invoice)

Actual invoicing is handled by Abby. This module only answers: *"For this client, which tasks do I need to invoice and for what total amount?"*

| Feature | Priority | Description |
|---------|----------|-------------|
| Client summary view | P0 | List of "to invoice" tasks with details: task, hours, rate, amount |
| Total to invoice per client | P0 | Automatically calculated sum, highlighted |
| Export summary (copy/paste) | P1 | Button to copy the summary in structured text format for pasting into Abby |
| Invoiced history | P1 | View of tasks marked as invoiced, grouped by month and client |
| Abby invoice reference | P1 | Field to note the invoice reference issued in Abby |
| Per-task rate override | P2 | Allow a different rate than the client rate on a specific task |

### 3.4 — Analytics & Revenue

Dashboard view to understand how time and revenue are distributed across clients and categories.

| Feature | Priority | Description |
|---------|----------|-------------|
| Revenue by month | P0 | Bar chart: invoiced amounts month by month (based on billedAt) |
| Revenue by client | P0 | Revenue distribution (EUR) by client over a selectable period |
| Revenue by category | P1 | Freelance / Study / Personal / Side-project breakdown |
| Time spent by client | P0 | Total hours (Linear estimate) by client over period |
| Time spent by project | P1 | Drill-down by Linear project for a client |
| Utilization rate | P1 | Billed hours vs available hours (configurable: e.g. 40h/week) |
| Pipeline to invoice | P0 | Total EUR to invoice pending, by client, highlighted at top of dashboard |
| Period selector | P0 | Filters: this month / previous month / quarter / year / custom |
| Monthly target | P2 | Set a monthly revenue target with progress indicator |

### 3.5 — Projects & Categories

Projects are Linear entities. The dashboard adds a semantic layer (category, associated client) without duplicating Linear project management.

| Feature | Priority | Description |
|---------|----------|-------------|
| Linear project list | P0 | Fetched from API, displayed with associated client and category |
| Project → client association | P0 | Link a Linear project to a dashboard client |
| Category per project | P0 | FREELANCE \| STUDY \| PERSONAL \| SIDE_PROJECT — inherited from client if not set |
| Category view | P1 | Filter all views (tasks, revenue) by category |

## 4. Navigation & UX

Single-page application with sidebar navigation.

| Page | Content |
|------|---------|
| /dashboard | KPIs: pipeline EUR, monthly revenue, billed hours. 6-month revenue chart. |
| /clients | Client list with quick access to each client's "to invoice" summary |
| /clients/[id] | Client detail: tasks, history, amounts, notes |
| /tasks | All tasks, filterable by client / status / period / to-invoice flag |
| /billing | Billing summary: pipeline to invoice + invoiced history |
| /analytics | Revenue charts, time, distribution by client/category |
| /settings | Linear token, default hourly rate, monthly target, available hours/week |

## 5. Technical Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16+ App Router — single repo, front + Route Handlers |
| Bundler | Turbopack (integrated in Next.js 16, enabled via --turbopack in dev) |
| Language | TypeScript strict |
| Styling | Tailwind CSS + custom components exclusively (no shadcn/ui) |
| ORM | Prisma + PostgreSQL |
| Linear | @linear/sdk — GraphQL queries + mutations via personal API token |
| Charts | Recharts |
| Auth | Better Auth — simple credentials, solo use, no multi-user |
| Hosting | Railway — one Next.js service + one PostgreSQL service in the same project |
| Env variables | LINEAR_API_TOKEN, DATABASE_URL, BETTER_AUTH_SECRET |

## 6. Data Model (Prisma)

Only business data is stored locally. Linear data (issues, projects, teams) is fetched on demand via API and never persisted (except TaskMeta).

### Local entities

- **Client** — client reference with rates, category, Linear mapping
- **TaskMeta** — billing metadata linked to a Linear issue (flags, invoice ref, time override)
- **Settings** — user config: Linear token, revenue target, weekly capacity

### Core calculation rule

| Mode | Formula |
|------|---------|
| HOURLY | amount = (timeOverride ?? estimate) x hourlyRate |
| DAILY | amount = (timeOverride ?? estimate) x dailyRate |
| FIXED | amount = fixedRate (flat rate, time-independent) |
| FREE | amount = 0 EUR |

For FREE: tasks are tracked but excluded from revenue calculations. For FIXED: the amount is entered once on the client, regardless of individual tasks.

## 7. Linear API Integration

| Feature | Priority | Description |
|---------|----------|-------------|
| List teams | P0 | GET teams → display in settings for client mapping |
| List projects | P0 | GET projects by team → display in settings for client mapping |
| List issues | P0 | GET issues by project/team, filtered by status (completedAt not null) |
| Read estimate + status | P0 | Fields: id, title, estimate, state.name, completedAt, assignee |
| Edit estimate | P1 | MUTATION updateIssue({ estimate }) — from dashboard task view |
| Create issue | P2 | MUTATION createIssue — minimal form in dashboard |
| Webhook issue updated | P2 | POST /api/webhooks/linear → re-fetch the updated issue |

Authentication: Personal API Token stored in settings (encrypted in DB or via env var). The @linear/sdk handles authentication and automatic retries.

## 8. Development Priorities

| Phase | Scope | Features |
|-------|-------|----------|
| P0 — MVP | Core business | CRUD clients · Linear mapping · task list + billing calculation · "to invoice" view · dashboard KPIs |
| P1 — V1 | Comfort & analytics | Invoiced history · revenue/time analytics · utilization rate · export summary · edit estimate from dashboard |
| P2 — V2 | Automation | Linear webhooks · issue creation · revenue target · per-task rate override |

## 9. Out of Scope

- PDF invoice generation — delegated to Abby
- Real-time time tracking (start/stop timer)
- Mobile application (web only)
- Multi-user or team management
- Accounting integration / accounting exports
- Notifications / automatic alerts (out of scope V1)

## 10. Open Questions

| Question | Decision / Status |
|----------|-------------------|
| Per-task billing mode override: useful for mixed missions? | Yes — both fields are optional, display logic TBD |
| One Linear token per client or one global token? | One global token (solo use), stored in Settings |
| Acceptable Linear sync frequency without webhooks? | On-demand (refresh button) + optional 5-min server-side cache |
| In-progress issues (not completed): show or hide? | Filter option — to decide during P0 implementation |

---

*FreelanceDash — Living document, to be updated with each scope evolution.*

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
