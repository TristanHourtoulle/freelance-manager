# Suivi — Actions & Réunions client

> Status: implemented (2026-06-18)

## Problem

Everything non-dev in a freelance activity — invoice follow-ups, sending links,
RDV, meeting notes — has no home in the app. Linear is 100% dev/design. We need
a lightweight, client-attached operational layer that does **not** pollute the
Linear-mirrored `Task` model.

## Decisions

- **Two new entities, separate from the Linear `Task`.**
  - `ClientAction`: a manual to-do attached to a client. Typed
    `RELANCE | LINK | RDV | OTHER`, with `title`, optional `dueDate`, `status`
    (`TODO | DONE`), `notes`, optional `link` (LINK), optional `invoiceId`
    (RELANCE → links the invoice), optional `meetingId` (RDV → links the meeting).
  - `Meeting`: a Teams meeting log. `title`, optional `teamsUrl`, `heldAt`,
    `durationMinutes`, `participants` (free-text list), `summaryMd` (markdown).
- **Naming:** the UI calls this **"Suivi"** to avoid clashing with "Tasks"
  (= Linear).
- **Placement:** the existing **Tasks page** gets a top **Dev | Suivi**
  segmented selector. Dev = the current Linear view (unchanged). Suivi = a
  reusable `SuiviView` (all clients). The **same** `SuiviView`, parameterized by
  `clientId`, also renders as a **Suivi tab** on the client detail page (not a
  duplicate). Within Suivi: an **Actions | Réunions** sub-toggle.
- **Aujourd'hui:** the dashboard shows a compact "Aujourd'hui" block (actions
  due today/overdue + today's meetings, one-tap done); the Suivi actions list
  filters by `Aujourd'hui / À venir / Tout / Fait`.
- **Participants** = free text (comma-separated). **RDV ↔ Réunion** = an RDV
  action can be marked held, which creates/links a meeting and marks it done.
- **Markdown** summaries render via a small dependency-free renderer
  (`src/lib/markdown.tsx`, unit-tested) — no `dangerouslySetInnerHTML`.

## Architecture

- Prisma: `ClientAction` + `Meeting` models, `ClientActionType` /
  `ClientActionStatus` enums, `ActivityKind` += `ACTION_DONE`, `MEETING_LOGGED`.
  Hand-written migration validated against a fresh DB.
- API (auth + same-origin CSRF + per-user/BOLA scoping, always-fresh reads):
  `/api/actions` (GET/POST), `/api/actions/[id]` (PATCH/DELETE),
  `/api/meetings` (GET/POST), `/api/meetings/[id]` (PATCH/DELETE).
- Hooks: `use-actions`, `use-meetings` (TanStack Query; mutations invalidate
  `actions`/`meetings`/`dashboard` + the client detail key).
- UI: `SuiviView`, `ActionModal`, `MeetingModal`, `TodayBlock` under
  `src/components/suivi/`.

## Out of scope (fast-follow)

PWA push reminders on due dates, auto-created relance when an invoice goes
overdue, a per-client contacts directory. The `invoiceId` link on actions and
the RDV→meeting link already pave the way.

## Not built (deliberate)

PDF invoice generation (handled externally by Abby.fr — French state-approved
invoicing requirement) and URSSAF/expenses (handled by the billing tool).
