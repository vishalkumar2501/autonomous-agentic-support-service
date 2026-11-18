export interface ToolContext {
  userId: string;
  ticketId: string;
  runId: string;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
