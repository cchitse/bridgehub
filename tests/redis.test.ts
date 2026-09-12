import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, it, expect, vi, afterEach } from "vitest";
import * as stateModule from "../lib/state";
import { POST } from "../app/api/mcp/route";

const redisUrl = process.env.REDIS_TEST_URL;
const realFetch = globalThis.fetch;
const signal = () => AbortSignal.timeout(10000);
const namespace = () => `bridgehub-test:${randomUUID()}`;
const redis = (key: string) => new stateModule.RedisState(redisUrl!, "local-test", key);
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function startInstance() {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const response = await POST(new Request(`http://${incoming.headers.host}/api/mcp`, {
        method: incoming.method, headers: incoming.headers as Record<string, string>,
        body: incoming.method === "POST" ? Buffer.concat(chunks) : undefined,
      }));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(500).end(); }
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No instance address");
  const client = new Client({ name: "redis-interface-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/api/mcp`), { fetch: realFetch }));
  return { client, server };
}

async function stop(instance: { client: Client; server: Server }) {
  await instance.client.close();
  instance.server.closeAllConnections();
  await new Promise<void>((resolve) => instance.server.close(() => resolve()));
}

describe.skipIf(!redisUrl || !!process.env.REDIS_TEST_PROBE)("real Redis shared-state integration", () => {
  it("executes the atomic Lua rolling window across independent clients", async () => {
    const key = namespace();
    const clients = [redis(key), redis(key)];
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => clients[index % 2].take("search", 10, 60000, signal())));
    expect(results.filter((wait) => wait === 0)).toHaveLength(10);
    expect(await redis(key).take("search", 10, 60000, signal())).toBeGreaterThan(0);
  });

  it("shares cache contents and TTL across clients", async () => {
    const key = namespace();
    const first = redis(key);
    const second = redis(key);
    await first.set("directory", "original-timestamp", 150, signal());
    expect(await second.get("directory", signal())).toBe("original-timestamp");
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(await second.get("directory", signal())).toBeNull();
  });

  it("bounds actual SEC starts across two instances even when Redis admission replies are delayed", async () => {
    const key = namespace();
    // Every request receives a new Redis client: no process-local rate counters can pass this test.
    vi.spyOn(stateModule, "getSharedState").mockImplementation(() => redis(key));
    vi.stubEnv("SEC_CONTACT_EMAIL", "operator@example.org");
    const started: number[] = [];
    let delayedGrants = 0;
    vi.stubGlobal("fetch", async (url: string | URL | Request, options?: RequestInit) => {
      if (String(url).startsWith("https://data.sec.gov/")) {
        started.push(Date.now());
        return Response.json({ cik: 320193, name: "Apple Inc." });
      }
      const response = await realFetch(url, options);
      const command = typeof options?.body === "string" ? JSON.parse(options.body) : [];
      if (command[0] === "EVAL" && String(command[3]).endsWith(":sec") && delayedGrants < 5) {
        const body = await response.clone().json();
        if (body.result === 0) {
          delayedGrants++;
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
      return response;
    });
    const first = await startInstance();
    const second = await startInstance();
    try {
      const results = await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second).client.callTool({
        name: "us_search_sec_company", arguments: { query: "320193" },
      })));
      expect(results.filter((result) => !result.isError)).toHaveLength(10);
      expect(results.filter((result) => result.isError)).toHaveLength(2);
      expect(started).toHaveLength(10);
      for (const time of started) expect(started.filter((start) => start >= time && start < time + 1000).length).toBeLessThanOrEqual(5);
    } finally { await stop(first); await stop(second); }
  });

  it("retains a cache entry and exhausted search budget in a fresh process", async () => {
    const key = namespace();
    const state = redis(key);
    await state.set("directory", "survives-process-restart", 60000, signal());
    await Promise.all(Array.from({ length: 10 }, () => state.take("search", 10, 60000, signal())));
    await expect(promisify(execFile)(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/redis.test.ts", "-t", "fresh process probe"], {
      env: { ...process.env, REDIS_TEST_PROBE: key }, timeout: 20000,
    })).resolves.toMatchObject({ stderr: "" });
  }, 25000);
});

it.skipIf(!redisUrl || !process.env.REDIS_TEST_PROBE)("fresh process probe", async () => {
  const state = redis(process.env.REDIS_TEST_PROBE!);
  expect(await state.get("directory", signal())).toBe("survives-process-restart");
  expect(await state.take("search", 10, 60000, signal())).toBeGreaterThan(0);
});
