import { prisma } from "@/lib/db"

/**
 * Creates a tenant-scoped Prisma client that auto-injects userId filters.
 * Use this for operations where forgetting the userId filter would be a security issue.
 */
export function createTenantClient(userId: string) {
  return prisma.$extends({
    query: {
      client: {
        async findMany({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
        async count({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
      },
      expense: {
        async findMany({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
        async count({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
      },
      notification: {
        async findMany({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
        async count({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
      },
      usageMetric: {
        async findMany({ args, query }) {
          args.where = { ...args.where, userId }
          return query(args)
        },
      },
    },
  })
}
