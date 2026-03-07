import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { prisma } from "@/lib/db"
import { searchLinearIssues } from "@/lib/linear-service"
import { searchQuerySchema } from "@/lib/schemas/search"
import { NextResponse } from "next/server"

interface SearchClientResult {
  id: string
  name: string
  company: string | null
  category: string
}

interface SearchTaskResult {
  id: string
  identifier: string
  title: string
  url: string
}

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const { q } = searchQuerySchema.parse(params)

    const [clients, tasks] = await Promise.all([
      prisma.client.findMany({
        where: {
          userId: userOrError.id,
          archivedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          company: true,
          category: true,
        },
        take: 5,
        orderBy: { name: "asc" },
      }) as Promise<SearchClientResult[]>,
      searchLinearIssues(q).catch((): SearchTaskResult[] => []),
    ])

    return NextResponse.json({ clients, tasks })
  } catch (error) {
    return handleApiError(error)
  }
}
