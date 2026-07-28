import "server-only"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerClientTools } from "@/lib/mcp/tools/clients"
import { registerProjectTools } from "@/lib/mcp/tools/projects"
import { registerTaskTools } from "@/lib/mcp/tools/tasks"
import { registerInvoiceTools } from "@/lib/mcp/tools/invoices"
import { registerQuoteTools } from "@/lib/mcp/tools/quotes"
import { registerInsightTools } from "@/lib/mcp/tools/insights"
import { registerSuiviTools } from "@/lib/mcp/tools/suivi"

/**
 * Register the complete v1 MCP tool surface for one resolved principal.
 *
 * Reads: list_clients, get_client, list_projects, list_tasks, list_invoices,
 * get_invoice, list_quotes, get_dashboard, get_analytics, list_meetings,
 * list_actions. Writes: create_invoice_draft (DRAFT only),
 * set_task_actual_days, set_task_billability, log_meeting, create_action.
 * Nothing here can send, pay, delete, cancel, trigger a Linear sync, or
 * touch settings or the Linear token — those capabilities are deliberately
 * absent from the surface, not merely guarded.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal; every query is scoped to it.
 */
export function registerMcpTools(server: McpServer, userId: string): void {
  registerClientTools(server, userId)
  registerProjectTools(server, userId)
  registerTaskTools(server, userId)
  registerInvoiceTools(server, userId)
  registerQuoteTools(server, userId)
  registerInsightTools(server, userId)
  registerSuiviTools(server, userId)
}
