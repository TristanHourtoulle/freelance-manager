import "server-only"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import {
  cursorInputSchema,
  fetchAllInputSchema,
  limitInputSchema,
  NAME_MAX_CHARS,
  PAGINATED_LIST_NOTE,
  paginatedOutputSchema,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  runPaginatedQuery,
  truncateText,
} from "@/lib/mcp/tools/common"

const listProjectsInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  fetchAll: fetchAllInputSchema,
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  clientId: z.string().min(1).optional(),
})

const projectRowSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  name: z.string(),
  key: z.string(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]),
  targetDate: z.string().nullable(),
  tasksTotal: z.number(),
})

const listProjectsOutput = paginatedOutputSchema(projectRowSchema)

type ListProjectsArgs = z.output<typeof listProjectsInput>

const PROJECT_LIST_SELECT = {
  id: true,
  clientId: true,
  name: true,
  key: true,
  status: true,
  targetDate: true,
  _count: { select: { tasks: true } },
} as const

/**
 * Handler for the list_projects tool: v2-paginated, userId-scoped project
 * page with an uncapped `total` and optional server-side `fetchAll` walk.
 *
 * The select deliberately excludes `description`, `runbook` and every URL
 * column — those fields are free text never exposed through MCP.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and filter arguments.
 * @returns One page (or the full walked set) of project rows with names
 *   truncated.
 */
export async function listProjects(
  userId: string,
  args: ListProjectsArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_projects", args }, async () => {
    const where = {
      userId,
      ...(args.status ? { status: args.status } : {}),
      ...(args.clientId ? { clientId: args.clientId } : {}),
    }
    const result = await runPaginatedQuery({
      args,
      count: () => prisma.project.count({ where }),
      page: ({ cursor, take }) =>
        prisma.project.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: PROJECT_LIST_SELECT,
        }),
    })
    return {
      data: result.data.map((p) => ({
        id: p.id,
        clientId: p.clientId,
        name: truncateText(p.name, NAME_MAX_CHARS),
        key: truncateText(p.key, NAME_MAX_CHARS),
        status: p.status,
        targetDate: p.targetDate?.toISOString() ?? null,
        tasksTotal: p._count.tasks,
      })),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
      truncated: result.truncated,
    }
  })
}

/**
 * Register the project read tool on the given MCP server for one principal.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerProjectTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_projects",
    {
      description: `List the user's Linear-mirrored projects (name, key, status, target date, task count). ${PAGINATED_LIST_NOTE}`,
      inputSchema: listProjectsInput,
      outputSchema: listProjectsOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => listProjects(userId, args),
  )
}
