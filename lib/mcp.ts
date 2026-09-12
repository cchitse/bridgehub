import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describeFailure } from "./sec";
import { searchCompanies } from "./search";

export function createMcpServer() {
  const server = new McpServer({ name: "bridgehub", version: "0.1.0" }, {
    instructions: "Retrieve SEC company profiles by ticker, company-name substring, or CIK. Cite returned source URLs and retrieval times. Name and ticker coverage is limited to SEC's ticker directory. Retrieval time is not SEC's last update time.",
  });
  server.registerTool("us_search_sec_company", {
    title: "US SEC Company Search",
    description: "Search SEC company profiles by exact ticker (AAPL), company-name substring (apple), or CIK (320193, 0000320193, CIK0000320193). Case-insensitive tickers take precedence over name matches. Returns up to 20 unique companies with source provenance; default limit 10.",
    inputSchema: { query: z.string().trim().min(1).max(200), limit: z.number().int().min(1).max(20).default(10) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ query, limit }) => {
    try {
      const output = await searchCompanies(query, limit);
      return { isError: output.outcome === "error", structuredContent: output, content: [{ type: "text", text: JSON.stringify(output) }] };
    } catch (error) {
      const output = { query, limit, outcome: "error", results: [], truncated: false, error: describeFailure(error) };
      return { isError: true, structuredContent: output, content: [{ type: "text", text: JSON.stringify(output) }] };
    }
  });
  return server;
}
