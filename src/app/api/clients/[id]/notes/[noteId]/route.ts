import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { updateClientNoteSchema } from "@/lib/schemas/client-note"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string; noteId: string }>
}

/**
 * Verifies that the client belongs to the user and the note belongs to the client.
 * Returns the note or a NextResponse error.
 */
async function verifyNoteOwnership(
  userId: string,
  clientId: string,
  noteId: string,
) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true },
  })

  if (!client) {
    return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
  }

  const note = await prisma.clientNote.findFirst({
    where: { id: noteId, clientId },
  })

  if (!note) {
    return apiError("NOTE_NOT_FOUND", "Note not found", 404)
  }

  return note
}

/**
 * GET /api/clients/:id/notes/:noteId
 * Retrieves a single note.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id, noteId } = await context.params
    const noteOrError = await verifyNoteOwnership(userOrError.id, id, noteId)
    if (noteOrError instanceof NextResponse) return noteOrError

    return NextResponse.json(noteOrError)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/clients/:id/notes/:noteId
 * Updates an existing note.
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id, noteId } = await context.params
    const noteOrError = await verifyNoteOwnership(userOrError.id, id, noteId)
    if (noteOrError instanceof NextResponse) return noteOrError

    const body = await request.json()
    const validated = updateClientNoteSchema.parse(body)

    const updated = await prisma.clientNote.update({
      where: { id: noteId },
      data: validated,
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/clients/:id/notes/:noteId
 * Deletes a note.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id, noteId } = await context.params
    const noteOrError = await verifyNoteOwnership(userOrError.id, id, noteId)
    if (noteOrError instanceof NextResponse) return noteOrError

    await prisma.clientNote.delete({ where: { id: noteId } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
