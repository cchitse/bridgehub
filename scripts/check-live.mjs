import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = new URL(process.env.MCP_URL ?? "http://127.0.0.1:3000/api/mcp");
const client = new Client({ name: "bridgehub-live-check", version: "0.1.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name), ["us_search_sec_company"]);
  const query = process.env.MCP_QUERY ?? "AAPL";
  const result = await client.callTool({ name: "us_search_sec_company", arguments: { query } });
  if (result.isError) throw new Error(JSON.stringify(result.structuredContent ?? result.content));
  const data = result.structuredContent;
  assert.equal(data?.outcome, "ok");
  assert.equal(data.results[0].cik, "0000320193");
  assert.match(data.results[0].name, /apple/i);
  assert.equal(data.results[0].source_url, "https://data.sec.gov/submissions/CIK0000320193.json");
  assert.ok(Number.isFinite(Date.parse(data.results[0].retrieved_at)));
  if (query.toUpperCase() === "AAPL") {
    assert.equal(data.directory_source?.source_url, "https://www.sec.gov/files/company_tickers.json");
    assert.ok(Number.isFinite(Date.parse(data.directory_source.retrieved_at)));
  }
  console.log(JSON.stringify({ endpoint: endpoint.href, ...data }, null, 2));
} finally {
  await client.close();
}
