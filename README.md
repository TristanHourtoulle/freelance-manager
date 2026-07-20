# FreelanceDash

A freelance management dashboard that connects to Linear and provides client management, billing tracking, task oversight, and financial analytics — all in one place.

Built by [Tristan Hourtoulle](https://github.com/TristanHourtoulle).

## Features

- **Client Management** — Create and manage clients with billing modes (hourly, daily, fixed), categories, and Linear project mappings
- **Task Tracking** — Syncs tasks from Linear, calculates billable amounts, and lets you mark work as invoiced
- **Billing** — See what needs invoicing per client, track invoiced history by month, and manage invoice statuses
- **Analytics** — Revenue charts, KPIs, financial breakdowns by client and category
- **Suivi** — Non-dev client actions and Teams meeting logs, alongside the Linear-synced dev tasks
- **PWA** — Installable progressive web app with an offline shell and iOS standalone support
- **Mobile** — A dedicated mobile UI for every dashboard page (768px breakpoint), not a responsive squeeze of the desktop layout

## Tech Stack

| Layer         | Technology                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------- |
| Framework     | [Next.js 16](https://nextjs.org/) (App Router, Turbopack)                                   |
| Language      | TypeScript (strict mode)                                                                    |
| Database      | PostgreSQL via [Prisma 7](https://www.prisma.io/)                                           |
| Auth          | [Better Auth](https://www.better-auth.com/) (email/password)                                |
| Styling       | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (New York) |
| Data Fetching | [TanStack Query v5](https://tanstack.com/query)                                             |
| Charts        | Custom inline SVG (`src/components/analytics/charts.tsx`)                                   |
| Forms         | [React Hook Form](https://react-hook-form.com/) + [Zod 4](https://zod.dev/)                 |
| Integration   | [Linear API](https://developers.linear.app/) (GraphQL)                                      |
| Icons         | Custom SVG set (`<Icon name="…"/>`, `src/components/ui/icon.tsx`)                           |
| Hosting       | [Railway](https://railway.app/)                                                             |

The UI is **French only** — there is no i18n layer.

## Getting Started

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **PostgreSQL** database (local or hosted)

### Installation

```bash
# Clone the repository
git clone https://github.com/TristanHourtoulle/freelance-manager.git
cd freelance-manager

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database URL, auth secret, and encryption key
```

### Environment Variables

| Variable                   | Description                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string                                                                          |
| `BETTER_AUTH_SECRET`       | Secret key for session encryption                                                                     |
| `ENCRYPTION_KEY`           | 64-char hex key (32 bytes) used to encrypt the per-user Linear token at rest — `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL`      | Public URL of the app (production)                                                                    |
| `LINEAR_WEBHOOK_SECRET`    | Linear webhook signing secret (optional)                                                              |
| `LINEAR_CACHE_TTL_SECONDS` | Linear response cache TTL (optional)                                                                  |
| `CRON_SECRET`              | Shared secret for scheduled job endpoints (optional)                                                  |
| `HEALTH_KEY`               | Unlocks the detailed `/api/health` payload (optional)                                                 |
| `TRUST_PROXY`              | Set to `1` only when running behind a trusted reverse proxy                                           |

The Linear API token is **not** an environment variable: each user pastes their
personal token in the in-app Settings page and it is stored AES-256-GCM
encrypted on `UserSettings` (`linearApiTokenEncrypted`).

`NEXT_PUBLIC_APP_URL` is `https://freelance-manager.tristanhourtoulle.fr` in
production. It must include the scheme and carry **no trailing slash**: every API
mutation compares the incoming `Origin` header to this value by exact string
equality, so any deviation returns `403 CSRF_ORIGIN_MISMATCH`.

### Database Setup

```bash
# Generate Prisma client
pnpm exec prisma generate

# Run migrations
pnpm exec prisma migrate deploy
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
pnpm build
pnpm start
```

### Testing

```bash
pnpm test          # Run all tests
pnpm test --watch  # Watch mode
```

## Project Structure

```
src/
  app/              # Next.js App Router pages and API routes
    (dashboard)/    # Protected dashboard pages (clients, tasks, billing, ...)
    api/            # REST API routes
    auth/           # Authentication pages
  components/       # Shared and feature-specific components
    analytics/      # Charts and analytics widgets
    auth/           # Auth screens and forms
    billing/        # Billing feature components
    clients/        # Client feature components
    cmdk/           # Command palette
    dashboard/      # Dashboard widgets
    layout/         # App shell, sidebar, header
    mobile/         # Mobile shell and primitives
    providers/      # React context providers
    settings/       # Settings feature components
    suivi/          # Client actions and meeting logs
    tasks/          # Task feature components
    ui/             # Design system (shadcn/ui + custom)
  hooks/            # Custom React hooks (data fetching, UI state)
  lib/              # Utilities, schemas, helpers, auth config
  domain/           # Pure business logic (no React, no Prisma runtime)
  features/         # Feature-level logic
  types/            # Shared TypeScript types
prisma/             # Prisma schema and migrations
```

## License

Private project. All rights reserved.
