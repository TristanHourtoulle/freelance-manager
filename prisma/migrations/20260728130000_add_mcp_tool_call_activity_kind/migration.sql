-- Audit trail for the MCP server: every tool invocation made by a connected
-- agent is recorded in activity_log under this kind, with the tool name,
-- capped arguments, outcome and duration stored in meta.

ALTER TYPE "ActivityKind" ADD VALUE IF NOT EXISTS 'MCP_TOOL_CALL';
