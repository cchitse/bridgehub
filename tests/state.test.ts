import { describe, expect, it, vi, afterEach } from "vitest";
import { createMemoryState, RedisState, getSharedState } from "../lib/state";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const signal = () => AbortSignal.timeout(5000);

describe("shared-state contract", () => {
  it("expires cached values at 24 hours without changing their provenance", async () => {
    let now = 0;
    const state = createMemoryState(() => now);
    const value = JSON.stringify({ retrieved_at: "2026-09-12T00:00:00.000Z" });
    await state.set("directory", value, 86_400_000, signal());
    now = 86_399_999;
    expect(await state.get("directory", signal())).toBe(value);
    now++;
    expect(await state.get("directory", signal())).toBeNull();
  });

  it("admits only ten searches in a rolling minute", async () => {
    let now = 0;
    const state = createMemoryState(() => now);
    const attempts = await Promise.all(Array.from({ length: 12 }, () => state.take("search", 10, 60000, signal())));
    expect(attempts.filter((wait) => wait === 0)).toHaveLength(10);
    expect(attempts.slice(10)).toEqual([60000, 60000]);
    now = 1000;
    expect(await state.take("search", 10, 60000, signal())).toBe(59000);
    now = 60000;
    expect(await state.take("search", 10, 60000, signal())).toBe(0);
  });

  it("holds SEC slots until completion plus one second, retaining abandoned leases for 45 seconds", async () => {
    let now = 0;
    const state = createMemoryState(() => now);
    const permits = await Promise.all(Array.from({ length: 5 }, () => state.reserveSec(signal())));
    expect(permits.every((permit) => permit.waitMs === 0)).toBe(true);
    now = 2000;
    expect((await state.reserveSec(signal())).waitMs).toBeGreaterThan(0);
    await state.finishSec(permits[0].token, signal());
    now = 3000;
    expect((await state.reserveSec(signal())).waitMs).toBe(1);
    now = 3001;
    expect((await state.reserveSec(signal())).waitMs).toBe(0);
    now = 44999;
    expect((await state.reserveSec(signal())).waitMs).toBe(1);
    now = 45000;
    expect((await state.reserveSec(signal())).waitMs).toBe(0);
  });

  it("fails closed when production has no shared credentials", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(() => getSharedState()).toThrow(/shared state/i);
  });

  it.each([new Response("secret", { status: 503 }), Response.json({ error: "secret" }), Response.json({ result: "invalid" })])("fails safely on Redis failure or malformed limiter response", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const state = new RedisState("https://redis.example", "private-token", "bridgehub-test");
    await expect(state.take("search", 10, 60000, signal())).rejects.toMatchObject({ category: "service_unavailable", retryable: true });
  });
});
