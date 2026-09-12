import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LookupError, retrieveCompany } from "./sec";

export function createMcpServer() {
  const server = new McpServer({ name: "bridgehub", version: "0.1.0" }, {
    instructions: "Retrieve SEC company profiles by CIK. Cite returned source URLs and retrieval times. Ticker and company-name search are not available yet. Do not interpret retrieval time as SEC's last update time.",
  });
  server.registerTool("us_search_sec_company", {
    title: "US SEC Company Search",
    description: "Retrieve an SEC company profile by CIK (e.g. 320193, 0000320193, or CIK0000320193). This initial version supports CIK only; ticker and name search are not yet available.",
    inputSchema: { query: z.string().trim().min(1).max(200), limit: z.number().int().min(1).max(20).default(10) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ query, limit }) => {
    try {
      const match = /^(?:CIK)?(\d{1,10})$/i.exec(query);
      if (!match) {
        const explicitCik = /^CIK/i.test(query) || /^\d+$/.test(query);
        throw new LookupError(explicitCik ? "invalid_input" : "unsupported_query", explicitCik
          ? "Enter a CIK containing 1–10 digits, optionally prefixed with CIK."
          : "This version supports CIK only. Use 320193 for Apple; ticker and name search arrive in ticket 02.");
      }
      const cik = match[1].padStart(10, "0");
      if (cik === "0000000000") throw new LookupError("invalid_input", "CIK must be greater than zero.");
      const profile = await retrieveCompany(cik);
      const output = { query, limit, outcome: profile ? "ok" : "no_matches", results: profile ? [profile] : [], truncated: false };
      return { structuredContent: output, content: [{ type: "text", text: JSON.stringify(output) }] };
    } catch (error) {
      const failure = error instanceof LookupError ? error : new LookupError("internal_error", "BridgeHub could not complete this lookup.");
      const output = { query, limit, outcome: "error", results: [], truncated: false, error: { category: failure.category, message: failure.message } };
      return { isError: true, structuredContent: output, content: [{ type: "text", text: JSON.stringify(output) }] };
    }
  });
  return server;
}
