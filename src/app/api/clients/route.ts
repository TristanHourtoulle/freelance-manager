import { prisma } from "@/lib/db"
import {
  getAuthenticatedUser,
  handleApiError,
  serializeClient,
} from "@/lib/api-utils"
import { createClientSchema, clientFilterSchema } from "@/lib/schemas/client"
import { NextResponse } from "next/server"

import type { Prisma } from "@/generated/prisma/client"

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const filters = clientFilterSchema.parse(params)

    const where: Prisma.ClientWhereInput = {
      userId: userOrError.id,
      archivedAt: filters.archived ? { not: null } : null,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.billingMode ? { billingMode: filters.billingMode } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { company: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const skip = (filters.page - 1) * filters.limit

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { createdAt: "desc" },
        include: { linearMappings: true },
      }),
      prisma.client.count({ where }),
    ])

    return NextResponse.json({
      items: items.map(serializeClient),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body = await request.json()
    const validated = createClientSchema.parse(body)

    const client = await prisma.client.create({
      data: {
        ...validated,
        userId: userOrError.id,
      },
    })

    return NextResponse.json(serializeClient(client), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
