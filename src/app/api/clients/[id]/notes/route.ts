import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { createClientNoteSchema } from "@/lib/schemas/client-note"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/clients/:id/notes
 * Lists all notes for a client, ordered by creation date descending.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    // Verify client ownership
    const client = await prisma.client.findFirst({
      where: { id, userId: userOrError.id },
      select: { id: true },
    })

    if (!client) {
      return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    }

    const notes = await prisma.clientNote.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ items: notes })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/clients/:id/notes
 * Creates a new note for a client.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    // Verify client ownership
    const client = await prisma.client.findFirst({
      where: { id, userId: userOrError.id },
      select: { id: true },
    })

    if (!client) {
      return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    }

    const body = await request.json()
    const validated = createClientNoteSchema.parse(body)

    const note = await prisma.clientNote.create({
      data: {
        clientId: id,
        title: validated.title,
        content: validated.content,
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
