# FreelanceDash

A freelance management dashboard that connects to Linear and provides client management, billing tracking, task oversight, and financial analytics — all in one place.

Built by [Tristan Hourtoulle](https://github.com/TristanHourtoulle).

## Features

- **Client Management** — Create and manage clients with billing modes (hourly, daily, fixed, free), categories, and Linear project mappings
- **Task Tracking** — Syncs tasks from Linear, calculates billable amounts, and lets you mark work as invoiced
- **Billing** — See what needs invoicing per client, track invoiced history by month, and manage invoice statuses
- **Analytics** — Revenue charts, KPIs, financial breakdowns by client and category
- **Expense Tracking** — Log expenses, categorize them, and link them to clients
- **Kanban Board** — Drag-and-drop task board synced with Linear workflow statuses
- **Calendar** — Deadline timeline view across all clients
- **Notifications** — In-app notification center for task updates and reminders
- **i18n** — Full English and French support with locale switcher
- **Dark Landing Page** — Modern landing page with integrated auth forms

## Tech Stack

| Layer         | Technology                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------- |
| Framework     | [Next.js 16](https://nextjs.org/) (App Router, Turbopack)                                   |
| Language      | TypeScript (strict mode)                                                                    |
| Database      | PostgreSQL via [Prisma 7](https://www.prisma.io/)                                           |
| Auth          | [Better Auth](https://www.better-auth.com/) (email/password)                                |
| Styling       | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (New York) |
| Data Fetching | [TanStack Query v5](https://tanstack.com/query)                                             |
| Charts        | [Recharts](https://recharts.org/)                                                           |
| Forms         | [React Hook Form](https://react-hook-form.com/) + [Zod 4](https://zod.dev/)                 |
| Integration   | [Linear API](https://developers.linear.app/) (GraphQL)                                      |
| i18n          | [next-intl](https://next-intl.dev/)                                                         |
| Drag & Drop   | [@dnd-kit](https://dndkit.com/)                                                             |
| Icons         | [@heroicons/react](https://heroicons.com/)                                                  |
| Hosting       | [Railway](https://railway.app/)                                                             |

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
# Edit .env.local with your database URL, auth secret, and Linear API token
```

### Environment Variables

| Variable                | Description                        |
| ----------------------- | ---------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string       |
| `BETTER_AUTH_SECRET`    | Secret key for session encryption  |
| `LINEAR_API_KEY`        | Personal API token from Linear     |
| `LINEAR_WEBHOOK_SECRET` | Webhook signing secret (optional)  |
| `NEXT_PUBLIC_APP_URL`   | Public URL of the app (production) |

### Database Setup

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate deploy
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
    ui/             # Design system (shadcn/ui + custom)
    layout/         # App shell, sidebar, header
    clients/        # Client feature components
    tasks/          # Task feature components (including kanban)
    billing/        # Billing feature components
    expenses/       # Expense feature components
    notifications/  # Notification components
  hooks/            # Custom React hooks (data fetching, UI state)
  lib/              # Utilities, schemas, helpers, auth config
  features/         # Feature-level logic
  types/            # Shared TypeScript types
messages/           # i18n translation files (en.json, fr.json)
prisma/             # Prisma schema and migrations
```

## License

Private project. All rights reserved.
