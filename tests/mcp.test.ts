import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/mcp/route";

const realFetch = globalThis.fetch;
const secFetch = vi.fn<typeof fetch>();
const fixture = {
  cik: "320193", name: "Apple Inc.", tickers: ["AAPL", "TEST"],
  exchanges: ["Nasdaq"], sic: "3571", sicDescription: "Electronic Computers",
  fiscalYearEnd: "0927", stateOfIncorporation: "CA",
  filings: { recent: { accessionNumber: ["one", "two"] } },
};
let http: Server;
let endpoint: URL;
let client: Client;

beforeAll(async () => {
  http = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const request = new Request(`http://${incoming.headers.host}${incoming.url}`, {
        method: incoming.method,
        headers: incoming.headers as Record<string, string>,
        body: incoming.method === "POST" ? Buffer.concat(chunks) : undefined,
      });
      const response = await POST(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(500).end();
    }
  }).listen(0, "127.0.0.1");
  await once(http, "listening");
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("No HTTP address");
  endpoint = new URL(`http://127.0.0.1:${address.port}/api/mcp`);
});

beforeEach(async () => {
  vi.stubEnv("SEC_CONTACT_EMAIL", "operator@example.org");
  secFetch.mockReset().mockImplementation(async () => Response.json(fixture));
  vi.stubGlobal("fetch", secFetch);
  client = new Client({ name: "bridgehub-interface-tests", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(endpoint, { fetch: realFetch }));
});

afterEach(async () => {
  await client.close();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => { http.closeAllConnections(); await new Promise<void>((resolve) => http.close(() => resolve())); });

async function lookup(query: unknown, limit?: unknown) {
  return client.callTool({ name: "us_search_sec_company", arguments: { query, ...(limit === undefined ? {} : { limit }) } });
}

describe("company profiles over the MCP HTTP interface", () => {
  it("discovers exactly one read-only tool without fetching SEC", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["us_search_sec_company"]);
    expect(tools[0].annotations?.readOnlyHint).toBe(true);
    expect(tools[0].inputSchema.required).toContain("query");
    expect(secFetch).not.toHaveBeenCalled();
  });

  it.each(["320193", "0000320193", "CIK0000320193", " cik320193 "])("resolves %s directly and retains provenance", async (query) => {
    const before = Date.now();
    const result = await lookup(query);
    expect(result.isError).not.toBe(true);
    const data = result.structuredContent as { query: string; limit: number; outcome: string; results: Record<string, unknown>[]; truncated: boolean };
    expect(data).toMatchObject({ query: query.trim(), limit: 10, outcome: "ok", truncated: false });
    expect(data.results).toHaveLength(1);
    expect(data.results[0]).toMatchObject({
      cik: "0000320193", ticker: ["AAPL", "TEST"], name: "Apple Inc.",
      sic: "3571", sic_description: "Electronic Computers", exchange: ["Nasdaq"],
      fiscal_year_end: "0927", state_of_incorporation: "CA", recent_filings_count: 2,
      source_url: "https://data.sec.gov/submissions/CIK0000320193.json",
    });
    const retrieved = Date.parse(data.results[0].retrieved_at as string);
    expect(retrieved).toBeGreaterThanOrEqual(before);
    expect(retrieved).toBeLessThanOrEqual(Date.now());
    const content = result.content as { type: string; text: string }[];
    expect(JSON.parse(content[0].text)).toEqual(data);
    expect(secFetch).toHaveBeenCalledTimes(1);
    const [url, options] = secFetch.mock.calls[0];
    expect(String(url)).toBe("https://data.sec.gov/submissions/CIK0000320193.json");
    expect(new Headers(options?.headers).get("user-agent")).toBe("BridgeHub operator@example.org");
  });

  it("honors a valid explicit result limit", async () => {
    expect((await lookup("320193", 1)).structuredContent).toMatchObject({ limit: 1, outcome: "ok" });
  });

  it("does not invent missing metadata or a missing filing count", async () => {
    secFetch.mockImplementation(async () => Response.json({ cik: 320193, name: "Apple Inc." }));
    const result = await lookup("320193");
    expect(result.structuredContent).toMatchObject({ results: [{ ticker: [], exchange: [], sic: null,
      sic_description: null, fiscal_year_end: null, state_of_incorporation: null, recent_filings_count: null }] });
  });

  it("preserves an actual empty filing list as zero", async () => {
    secFetch.mockImplementation(async () => Response.json({ ...fixture, filings: { recent: { accessionNumber: [] } } }));
    expect((await lookup("320193")).structuredContent).toMatchObject({ results: [{ recent_filings_count: 0 }] });
  });

  it("does not turn an invalid filings array into a count", async () => {
    secFetch.mockImplementation(async () => Response.json({ ...fixture, filings: { recent: { accessionNumber: [42] } } }));
    expect((await lookup("320193")).structuredContent).toMatchObject({ results: [{ recent_filings_count: null }] });
  });

  it.each(["", " ", "0", "CIK", "CIKabc", "12345678901", "x".repeat(201), 320193, null])("rejects invalid query %s without SEC access", async (query) => {
    expect((await lookup(query)).isError).toBe(true);
    expect(secFetch).not.toHaveBeenCalled();
  });

  it.each([0, 21, 1.5, "10", null])("rejects invalid limit %s", async (limit) => {
    expect((await lookup("320193", limit)).isError).toBe(true);
    expect(secFetch).not.toHaveBeenCalled();
  });

  it("explains that ticker lookup belongs to the next ticket", async () => {
    const result = await lookup("AAPL");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ outcome: "error", error: { category: "unsupported_query" } });
    expect(secFetch).not.toHaveBeenCalled();
  });

  it("requires operator configuration without blocking discovery", async () => {
    vi.stubEnv("SEC_CONTACT_EMAIL", "");
    const result = await lookup("320193");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { category: "configuration_error" } });
    expect(secFetch).not.toHaveBeenCalled();
  });

  it("distinguishes actual not-found from upstream failure", async () => {
    secFetch.mockImplementation(async () => new Response(null, { status: 404 }));
    const missing = await lookup("320193");
    expect(missing.isError).not.toBe(true);
    expect(missing.structuredContent).toMatchObject({ outcome: "no_matches", results: [] });
    secFetch.mockImplementation(async () => new Response("blocked", { status: 403 }));
    const blocked = await lookup("320193");
    expect(blocked.isError).toBe(true);
    expect(blocked.structuredContent).toMatchObject({ outcome: "error", results: [] });
  });

  it.each([{ message: "not a company" }, { ...fixture, cik: "1234" }])("rejects invalid or mismatched upstream identity", async (body) => {
    secFetch.mockImplementation(async () => Response.json(body));
    expect((await lookup("320193")).isError).toBe(true);
  });

  it("returns a safe error for a network failure", async () => {
    secFetch.mockRejectedValue(new Error("private infrastructure details"));
    const result = await lookup("320193");
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private infrastructure details");
  });

  it("bounds actual SEC request starts under concurrent tool calls", async () => {
    const started: number[] = [];
    secFetch.mockImplementation(async () => {
      started.push(Date.now());
      return Response.json(fixture);
    });
    const results = await Promise.all(Array.from({ length: 6 }, () => lookup("320193")));
    expect(results.every((result) => !result.isError)).toBe(true);
    expect(started).toHaveLength(6);
    for (const time of started) {
      expect(started.filter((start) => start >= time && start < time + 1000).length).toBeLessThanOrEqual(5);
    }
  });

  it("rejects a malformed Host header", async () => {
    const result = await POST(new Request(endpoint, { method: "POST", headers: { Host: "[invalid" }, body: "{}" }));
    expect(result.status).toBe(403);
    expect(secFetch).not.toHaveBeenCalled();
  });

  it("rejects a foreign browser origin before SEC access", async () => {
    const result = await realFetch(endpoint, { method: "POST", headers: { Origin: "https://foreign.example" }, body: "{}" });
    expect(result.status).toBe(403);
    expect(secFetch).not.toHaveBeenCalled();
  });
});
