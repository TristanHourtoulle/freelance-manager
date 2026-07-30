import "server-only"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerClientTools } from "@/lib/mcp/tools/clients"
import { registerProjectTools } from "@/lib/mcp/tools/projects"
import { registerTaskTools } from "@/lib/mcp/tools/tasks"
import { registerInvoiceTools } from "@/lib/mcp/tools/invoices"
import { registerInvoiceWriteTools } from "@/lib/mcp/tools/invoices-write"
import { registerQuoteTools } from "@/lib/mcp/tools/quotes"
import { registerInsightTools } from "@/lib/mcp/tools/insights"
import { registerSuiviTools } from "@/lib/mcp/tools/suivi"
import { registerLinearSyncTools } from "@/lib/mcp/tools/linear-sync"

/**
 * Register the complete v1 MCP tool surface for one resolved principal.
 *
 * Reads: list_clients, get_client, list_projects, list_tasks, list_invoices,
 * get_invoice, list_quotes, get_dashboard, get_analytics, list_meetings,
 * list_actions, get_linear_sync_status. Writes: create_client,
 * update_client, link_linear_project, create_invoice_draft /
 * update_invoice_draft (DRAFT only), split_invoice, record_payment,
 * set_task_actual_days, set_task_estimate, set_task_billability,
 * log_meeting, update_meeting, create_action, complete_action,
 * trigger_linear_sync. Settings and the Linear token itself stay off the
 * surface entirely. `record_payment` and `split_invoice` are the tools that
 * move money or allocate invoice numbers; `set_task_estimate` and
 * `trigger_linear_sync` are the only tools that reach outside the app —
 * both via the app's own stored credential, never the MCP bearer token.
 * `trigger_linear_sync` is non-destructive (it only pulls from Linear, and
 * runs in the background via `after()`) but is rate-limited by a 60s
 * cooldown on top of the single-flight guard already owned by
 * `triggerLinearSync`. The single destructive exception on the whole
 * server is delete_meeting: an explicitly approved, clearly-annotated
 * (`destructiveHint: true`) destructive tool.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal; every query is scoped to it.
 */
export function registerMcpTools(server: McpServer, userId: string): void {
  registerClientTools(server, userId)
  registerProjectTools(server, userId)
  registerTaskTools(server, userId)
  registerInvoiceTools(server, userId)
  registerInvoiceWriteTools(server, userId)
  registerQuoteTools(server, userId)
  registerInsightTools(server, userId)
  registerSuiviTools(server, userId)
  registerLinearSyncTools(server, userId)
}
