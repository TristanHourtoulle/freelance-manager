import { prisma } from "@/lib/db"
import {
  getAuthenticatedUser,
  handleApiError,
  serializeClient,
} from "@/lib/api-utils"
import { createClientSchema, clientFilterSchema } from "@/lib/schemas/client"
import { NextResponse } from "next/server"

import type { Prisma } from "@/generated/prisma/client"

/**
 * GET /api/clients
 * Lists clients with filtering, sorting, and pagination. Supports sorting by
 * name, createdAt, revenue, or lastActivity.
 * @returns 200 - `{ items: SerializedClient[], pagination: { page, limit, total, totalPages } }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid filter/sort parameters
 */
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
      ...(filters.category ? { category: { in: filters.category } } : {}),
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

    const isComputedSort =
      filters.sortBy === "revenue" || filters.sortBy === "lastActivity"

    if (isComputedSort) {
      const allClients = await prisma.client.findMany({
        where,
        select: { id: true },
      })
      const clientIds = allClients.map((c) => c.id)
      const total = clientIds.length

      const [revenueByClient, activityByClient] = await Promise.all([
        prisma.invoice.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds } },
          _sum: { totalAmount: true },
        }),
        prisma.taskOverride.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds } },
          _max: { updatedAt: true },
        }),
      ])

      const revenueMap = new Map(
        revenueByClient.map((r) => [
          r.clientId,
          Number(r._sum.totalAmount ?? 0),
        ]),
      )
      const activityMap = new Map(
        activityByClient.map((a) => [a.clientId, a._max.updatedAt]),
      )

      const sortedIds = [...clientIds].sort((a, b) => {
        if (filters.sortBy === "revenue") {
          const diff = (revenueMap.get(a) ?? 0) - (revenueMap.get(b) ?? 0)
          return filters.sortOrder === "desc" ? -diff : diff
        }
        const dateA = activityMap.get(a)?.getTime() ?? 0
        const dateB = activityMap.get(b)?.getTime() ?? 0
        const diff = dateA - dateB
        return filters.sortOrder === "desc" ? -diff : diff
      })

      const skip = (filters.page - 1) * filters.limit
      const pagedIds = sortedIds.slice(skip, skip + filters.limit)

      const items = await prisma.client.findMany({
        where: { id: { in: pagedIds } },
        include: { linearMappings: true },
      })

      const orderedItems = pagedIds.map((id) => items.find((i) => i.id === id)!)

      return NextResponse.json({
        items: orderedItems.map((client) =>
          serializeClient(client, {
            totalRevenue: revenueMap.get(client.id),
            lastActivityAt: activityMap.get(client.id) ?? null,
          }),
        ),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      })
    }

    const skip = (filters.page - 1) * filters.limit
    const orderBy =
      filters.sortBy === "name"
        ? {
            name:
              filters.sortOrder === "asc"
                ? ("asc" as const)
                : ("desc" as const),
          }
        : {
            createdAt:
              filters.sortOrder === "asc"
                ? ("asc" as const)
                : ("desc" as const),
          }

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy,
        include: { linearMappings: true },
      }),
      prisma.client.count({ where }),
    ])

    const clientIds = items.map((c) => c.id)

    const [revenueByClient, activityByClient] = await Promise.all([
      prisma.invoice.groupBy({
        by: ["clientId"],
        where: { clientId: { in: clientIds } },
        _sum: { totalAmount: true },
      }),
      prisma.taskOverride.groupBy({
        by: ["clientId"],
        where: { clientId: { in: clientIds } },
        _max: { updatedAt: true },
      }),
    ])

    const revenueMap = new Map(
      revenueByClient.map((r) => [r.clientId, Number(r._sum.totalAmount ?? 0)]),
    )
    const activityMap = new Map(
      activityByClient.map((a) => [a.clientId, a._max.updatedAt]),
    )

    return NextResponse.json({
      items: items.map((client) =>
        serializeClient(client, {
          totalRevenue: revenueMap.get(client.id),
          lastActivityAt: activityMap.get(client.id) ?? null,
        }),
      ),
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

/**
 * POST /api/clients
 * Creates a new client for the authenticated user.
 * @returns 201 - The created `SerializedClient`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid request body
 */
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
