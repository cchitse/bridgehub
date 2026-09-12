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
  vi.restoreAllMocks();
});

describe("unavailable and incomplete SEC data", () => {
  const directoryUrl = "https://www.sec.gov/files/company_tickers.json";
  const directory = {
    0: { cik_str: 1, ticker: "ONE", title: "Group One" },
    1: { cik_str: 2, ticker: "TWO", title: "Group Two" },
    2: { cik_str: 3, ticker: "THREE", title: "Group Z" },
  };

  it("retains successful profiles and provenance while reporting failed CIKs independently of truncation", async () => {
    secFetch.mockImplementation(async (url) => {
      if (String(url) === directoryUrl) return Response.json(directory);
      if (String(url).endsWith("0000000001.json")) return Response.json({ ...fixture, cik: 1 });
      return new Response("SEC blocked private-detail", { status: 403 });
    });
    const result = await lookup("group", 2);
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ outcome: "partial", truncated: true,
      results: [{ cik: "0000000001", source_url: "https://data.sec.gov/submissions/CIK0000000001.json" }],
      failures: [{ cik: "0000000002", category: "upstream_blocked", retryable: false }],
      directory_source: { source_url: directoryUrl },
    });
    const data = result.structuredContent as { results: { retrieved_at: string }[]; warnings: string[] };
    expect(data.results).toHaveLength(1);
    expect(data.warnings[0]).toMatch(/incomplete/i);
    expect(Number.isFinite(Date.parse(data.results[0].retrieved_at))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private-detail");
    expect(JSON.parse((result.content as { text: string }[])[0].text)).toEqual(result.structuredContent);
    expect(secFetch).toHaveBeenCalledTimes(3);
  });

  it("reports total profile failure with failed CIKs, retained discovery provenance, and MCP error signaling", async () => {
    secFetch.mockImplementation(async (url) => String(url) === directoryUrl ? Response.json(directory) : new Response(null, { status: 503 }));
    const result = await lookup("group", 2);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ outcome: "error", results: [], truncated: true,
      error: { category: "profiles_unavailable", retryable: true },
      failures: [{ cik: "0000000001", category: "upstream_unavailable" }, { cik: "0000000002", category: "upstream_unavailable" }],
      directory_source: { source_url: directoryUrl },
    });
    expect(secFetch).toHaveBeenCalledTimes(3);
  });

  it("treats a selected profile 404 as an incomplete result rather than no matches", async () => {
    secFetch.mockImplementation(async (url) => {
      if (String(url) === directoryUrl) return Response.json(directory);
      return String(url).endsWith("0000000001.json") ? Response.json({ ...fixture, cik: 1 }) : new Response(null, { status: 404 });
    });
    expect((await lookup("group")).structuredContent).toMatchObject({ outcome: "partial", truncated: false,
      failures: [{ cik: "0000000002", category: "upstream_not_found" }, { cik: "0000000003", category: "upstream_not_found" }] });
  });

  it.each([
    [403, "upstream_blocked", false], [429, "upstream_rate_limited", true], [503, "upstream_unavailable", true],
  ])("classifies SEC status %s without exposing the body or retrying", async (status, category, retryable) => {
    secFetch.mockImplementation(async () => new Response("sensitive backend body", { status: status as number }));
    const result = await lookup("320193");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ outcome: "error", results: [], error: { category, retryable } });
    expect(JSON.stringify(result)).not.toContain("sensitive backend body");
    expect(secFetch).toHaveBeenCalledTimes(1);
  });

  it.each(["<html>blocked</html>", "{not json"])("rejects a malformed success body as an upstream response error", async (body) => {
    secFetch.mockImplementation(async () => new Response(body, { status: 200 }));
    expect((await lookup("320193")).structuredContent).toMatchObject({ outcome: "error", error: { category: "upstream_response_error", retryable: false } });
  });

  it("returns a discovery error, not no matches, for directory 404", async () => {
    secFetch.mockImplementation(async () => new Response(null, { status: 404 }));
    const result = await lookup("group");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ outcome: "error", results: [], error: { category: "upstream_response_error" } });
    expect(secFetch).toHaveBeenCalledTimes(1);
  });

  it("enforces the 10-second request timeout including a stalled body", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const deadlines = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => timeout(ms === 10_000 ? 40 : ms));
    secFetch.mockImplementation(async (_url, options) => new Response(new ReadableStream({
      start(controller) {
        options!.signal!.addEventListener("abort", () => controller.error(options!.signal!.reason), { once: true });
      },
    })));
    const result = await lookup("320193");
    expect(result.structuredContent).toMatchObject({ outcome: "error", error: { category: "upstream_timeout", retryable: true } });
    expect(deadlines).toHaveBeenCalledWith(10_000);
    expect(deadlines).toHaveBeenCalledWith(30_000);
    expect(secFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the overall deadline while waiting for a local request slot", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await Promise.all(Array.from({ length: 5 }, () => lookup("320193")));
    secFetch.mockClear();
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const deadlines = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => timeout(ms === 30_000 ? 40 : ms));
    const result = await lookup("320193");
    expect(result.structuredContent).toMatchObject({ outcome: "error", error: { category: "upstream_timeout", retryable: true } });
    expect(deadlines).toHaveBeenCalledWith(30_000);
    expect(secFetch).not.toHaveBeenCalled();
  });

  it("preserves completed profiles when the shared overall deadline aborts remaining requests", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => timeout(ms === 30_000 ? 100 : ms));
    secFetch.mockImplementation(async (url, options) => {
      if (String(url) === directoryUrl) return Response.json(directory);
      if (String(url).endsWith("0000000001.json")) return Response.json({ ...fixture, cik: 1 });
      return new Promise<Response>((_resolve, reject) => {
        const signal = options!.signal!;
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
    const result = await lookup("group");
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ outcome: "partial", results: [{ cik: "0000000001" }], failures: [
      { cik: "0000000002", category: "upstream_timeout", retryable: true },
      { cik: "0000000003", category: "upstream_timeout", retryable: true },
    ] });
    expect(secFetch).toHaveBeenCalledTimes(4);
  });
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

  it.each(["", " ", "0", "CIKabc", "12345678901", "x".repeat(201), 320193, null])("rejects invalid query %s without SEC access", async (query) => {
    expect((await lookup(query)).isError).toBe(true);
    expect(secFetch).not.toHaveBeenCalled();
  });

  it.each([0, 21, 1.5, "10", null])("rejects invalid limit %s", async (limit) => {
    expect((await lookup("320193", limit)).isError).toBe(true);
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

describe("ticker and company-name search", () => {
  const directoryUrl = "https://www.sec.gov/files/company_tickers.json";
  const rows = [
    { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
    { cik_str: 320193, ticker: "TEST", title: "Apple Inc." },
    { cik_str: 2, ticker: "OTHER", title: "AAPL Holdings" },
    { cik_str: 3, ticker: "FRUIT", title: "Apple Farms" },
  ];
  function serveDirectory(entries = rows) {
    secFetch.mockImplementation(async (url) => {
      if (String(url) === directoryUrl) return Response.json(Object.fromEntries(entries.map((row, index) => [index, row])));
      const cik = /CIK(\d{10})\.json$/.exec(String(url))?.[1];
      const row = entries.find((entry) => String(entry.cik_str).padStart(10, "0") === cik);
      if (!row) throw new Error("Unexpected profile request");
      return Response.json({ ...fixture, cik, name: row.title });
    });
  }

  it.each(["AAPL", "aApL", " AAPL "])("resolves %s using ticker precedence and directory provenance", async (query) => {
    serveDirectory();
    const before = Date.now();
    const result = await lookup(query);
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ query: query.trim(), outcome: "ok", truncated: false,
      directory_source: { source_url: directoryUrl }, results: [{ cik: "0000320193", ticker: ["AAPL", "TEST"], exchange: ["Nasdaq"] }] });
    const data = result.structuredContent as { results: unknown[]; directory_source: { retrieved_at: string } };
    expect(data.results).toHaveLength(1);
    expect(Date.parse(data.directory_source.retrieved_at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(data.directory_source.retrieved_at)).toBeLessThanOrEqual(Date.now());
    expect(secFetch.mock.calls.map(([url]) => String(url))).toEqual([directoryUrl, "https://data.sec.gov/submissions/CIK0000320193.json"]);
  });

  it("matches name substrings, deduplicates CIKs, and sorts before limiting", async () => {
    serveDirectory();
    const all = await lookup("aPpLe");
    expect(all.structuredContent).toMatchObject({ limit: 10, truncated: false, results: [{ cik: "0000000003" }, { cik: "0000320193" }] });
    secFetch.mockClear();
    const limited = await lookup("apple", 1);
    expect(limited.structuredContent).toMatchObject({ truncated: true, results: [{ cik: "0000000003" }] });
    expect(secFetch.mock.calls.map(([url]) => String(url))).toEqual([directoryUrl, "https://data.sec.gov/submissions/CIK0000000003.json"]);
  });

  it.each(["CIK", "cik"])("allows the bare %s trading symbol without treating it as an identifier prefix", async (query) => {
    serveDirectory([{ cik_str: 810766, ticker: "CIK", title: "Example Fund" }]);
    expect((await lookup(query)).structuredContent).toMatchObject({ outcome: "ok", results: [{ cik: "0000810766" }] });
  });

  it.each([undefined, 20])("applies limit %s before profile requests and uses CIK as the name tie-breaker", async (limit) => {
    serveDirectory(Array.from({ length: 21 }, (_, index) => ({ cik_str: 21 - index, ticker: `T${index}`, title: "Same Name" })));
    const result = await lookup("same", limit);
    const count = limit ?? 10;
    const data = result.structuredContent as { results: { cik: string }[] };
    expect(result.structuredContent).toMatchObject({ limit: count, truncated: true, outcome: "ok" });
    expect(data.results.map((row) => row.cik)).toEqual(Array.from({ length: count }, (_, index) => String(index + 1).padStart(10, "0")));
    expect(secFetch).toHaveBeenCalledTimes(count + 1);
  });

  it("returns genuine no matches without any profile requests", async () => {
    serveDirectory();
    expect((await lookup("nonexistent company")).structuredContent).toMatchObject({ outcome: "no_matches", results: [], truncated: false, directory_source: { source_url: directoryUrl } });
    expect(secFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps direct CIK lookup independent of directory failure", async () => {
    secFetch.mockImplementation(async (url) => String(url) === directoryUrl ? new Response(null, { status: 503 }) : Response.json(fixture));
    expect((await lookup("AAPL")).isError).toBe(true);
    secFetch.mockClear();
    expect((await lookup("320193")).structuredContent).toMatchObject({ outcome: "ok" });
    expect(secFetch.mock.calls.map(([url]) => String(url))).toEqual(["https://data.sec.gov/submissions/CIK0000320193.json"]);
  });

  it.each([{ unexpected: "shape" }, { 0: { cik_str: 0, ticker: "BAD", title: "Bad" } }])("does not treat malformed directory data as no matches", async (body) => {
    secFetch.mockImplementation(async () => Response.json(body));
    expect((await lookup("apple")).isError).toBe(true);
  });
});
