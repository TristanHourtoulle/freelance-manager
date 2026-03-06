import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/auth/login")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome, {session.user.name}
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          FreelanceDash is ready.
        </p>
        <div className="flex gap-3">
          <Link
            href="/clients"
            className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Manage Clients
          </Link>
          <Link
            href="/tasks"
            className="inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Tasks
          </Link>
          <Link
            href="/billing"
            className="inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            To Invoice
          </Link>
        </div>
      </div>
    </div>
  )
}
