import { Suspense } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

async function RootRedirect(): Promise<null> {
  const session = await auth.api.getSession({ headers: await headers() })
  redirect(session?.user ? "/dashboard" : "/auth/login")
}

export default function Root() {
  return (
    <Suspense fallback={<div className="empty">Chargement…</div>}>
      <RootRedirect />
    </Suspense>
  )
}
