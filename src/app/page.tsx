import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function Root() {
  const session = await auth.api.getSession({ headers: await headers() })
  redirect(session?.user ? "/dashboard" : "/auth/login")
}
