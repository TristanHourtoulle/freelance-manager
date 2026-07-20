# Scheduled jobs

Time-based work runs through a single signed HTTP endpoint,
`POST /api/cron/daily`, hit once a day by Railway's built-in cron. There is no
queue, no worker process and no third-party scheduler — this is a single-user
app and one endpoint is the whole requirement.

## The endpoint

- Route: `POST /api/cron/daily` (`src/app/api/cron/daily/route.ts`).
- Auth: the `X-Cron-Key` request header, compared in constant time against the
  `CRON_SECRET` environment variable (`src/lib/jobs/cron-auth.ts`).
- `403`-style failure modes:
  - `401 CRON_BAD_KEY` — wrong or missing header.
  - `503 CRON_NOT_CONFIGURED` — `CRON_SECRET` is unset on the server. The route
    fails **closed**: an unconfigured deployment is unusable, never open.
- An authorized call **always** returns `200`, even when a job failed. A 5xx
  would make the scheduler retry, and a retry storm on database-backed jobs is
  worse than a missed day. Per-job outcomes are in the response body
  (`jobs: [{ name, ok, count }]`) and in the server logs.
- `/api/cron/` is the only entry added to `PUBLIC_API_PREFIXES` in `proxy.ts`,
  the edge gate that otherwise 401s every `/api/*` request without a session
  cookie. It is a deliberate hole in an auth-by-default net and is acceptable
  only because the route itself fails closed and compares the key in constant
  time. Do not add further paths to that list.

## Configuration (Railway dashboard, not this repo)

1. Create a **separate service in the same Railway project** whose only role is
   to fire the cron, and set its **Cron Schedule** field to `0 7 * * *`
   (07:00 UTC daily — Railway cron schedules are UTC, so adjust for the owner's
   timezone).
2. Set its start command to:

   ```
   curl -fsS -X POST -H "X-Cron-Key: $CRON_SECRET" "$APP_URL/api/cron/daily"
   ```

3. Set `CRON_SECRET` on **both** the web service and the cron service. In
   Railway, reference the same shared variable from both so they cannot drift.
4. `APP_URL` is the deployed app URL — the same value as `NEXT_PUBLIC_APP_URL`.
5. Railway cron services run to completion and exit; `curl` exiting 0 is the
   success signal, which is why the route always returns 200 on an authorized
   call.

**Never commit the secret value.** Only the variable name appears in this
repository.

## Manual trigger

```
curl -i -X POST -H "X-Cron-Key: $CRON_SECRET" "$APP_URL/api/cron/daily"
```

Expect `HTTP 200` with a `jobs` array. A wrong key must return `401`, and no
key must return `401`.

## Jobs

| Name               | What it does                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overdue-relances` | Queues a `RELANCE` follow-up action for every overdue invoice that still owes money and has none. Reuses `sweepOverdueRelances` from `src/lib/relance.ts`. |

The same sweep is also called lazily from `GET /api/dashboard`. That call is
intentionally kept: it is idempotent, it costs nothing (the invoices are
already loaded there), and it means the feature does not silently die if the
cron is ever misconfigured.

## Adding a job

Append one descriptor to the array in `src/lib/jobs/daily.ts`:

```ts
{ name: "my-job", run: async (now: Date) => 0 }
```

Every job must be:

- **idempotent** — safe to run twice. The relance job's idempotency is enforced
  by the database (the nullable `UNIQUE` column `ClientAction.relanceInvoiceId`
  combined with `skipDuplicates`), not by application code.
- **non-throwing in effect** — a throwing job is caught, logged and recorded as
  `{ ok: false }`; it never aborts the remaining jobs.

If a future job touches a cached resource, invalidate with
`revalidateTag(tag, "max")` — `updateTag` throws inside route handlers. Actions,
meetings and the dashboard have no cache tag today, so the current jobs need no
invalidation.
