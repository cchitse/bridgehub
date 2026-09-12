import { randomUUID } from "node:crypto";
import { LookupError } from "./errors";

export interface SharedState {
  get(key: string, signal: AbortSignal): Promise<string | null>;
  set(key: string, value: string, ttlMs: number, signal: AbortSignal): Promise<void>;
  /** Returns zero if admitted, otherwise the milliseconds until capacity may be available. */
  take(key: string, maximum: number, windowMs: number, signal: AbortSignal): Promise<number>;
  reserveSec(signal: AbortSignal): Promise<{ waitMs: number; token: string; expiresAt: number }>;
  finishSec(token: string, signal: AbortSignal): Promise<void>;
}

const SEC_LEASE_MS = 45000;
// A slot cannot be reused until the previous SEC request has finished plus one second.
// The long crash lease covers delayed replies and the entire bounded lookup budget.
const SEC_ACQUIRE = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if redis.call('ZCARD', KEYS[1]) >= 5 then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return math.min(100, math.max(1, tonumber(oldest[2]) - now))
end
redis.call('ZADD', KEYS[1], now + 45000, ARGV[1])
redis.call('PEXPIRE', KEYS[1], 45000)
return 0
`;
const SEC_FINISH = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
if redis.call('ZSCORE', KEYS[1], ARGV[1]) then
  redis.call('ZADD', KEYS[1], 'XX', now + 1001, ARGV[1])
end
return 1
`;

// Redis executes this entire rolling-window decision atomically using its own clock.
const LIMIT_SCRIPT = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local window = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return math.max(1, tonumber(oldest[2]) + window - now)
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return 0
`;

const unavailable = () => new LookupError("service_unavailable", "BridgeHub shared state is unavailable. Retry later.", true);

export class RedisState implements SharedState {
  constructor(private readonly url: string, private readonly token: string, private readonly namespace: string) {}

  private async command(args: (string | number)[], signal: AbortSignal): Promise<unknown> {
    try {
      const response = await fetch(this.url, {
        method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(args), cache: "no-store", redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok) { await response.body?.cancel(); throw unavailable(); }
      const body = await response.json();
      if (!body || typeof body !== "object" || !("result" in body) || "error" in body) throw unavailable();
      return body.result;
    } catch { throw unavailable(); }
  }

  async get(key: string, signal: AbortSignal) {
    const result = await this.command(["GET", `${this.namespace}:${key}`], signal);
    if (result !== null && typeof result !== "string") throw unavailable();
    return result as string | null;
  }

  async set(key: string, value: string, ttlMs: number, signal: AbortSignal) {
    const result = await this.command(["SET", `${this.namespace}:${key}`, value, "PX", ttlMs], signal);
    if (result !== "OK") throw unavailable();
  }

  async take(key: string, maximum: number, windowMs: number, signal: AbortSignal) {
    const result = await this.command(["EVAL", LIMIT_SCRIPT, 1, `${this.namespace}:${key}`, windowMs, maximum, randomUUID()], signal);
    if (typeof result !== "number" || !Number.isSafeInteger(result) || result < 0 || result > windowMs) throw unavailable();
    return result;
  }

  async reserveSec(signal: AbortSignal) {
    const token = randomUUID();
    // Earliest possible Redis expiry, measured locally before the round trip.
    const expiresAt = performance.now() + SEC_LEASE_MS;
    const waitMs = await this.command(["EVAL", SEC_ACQUIRE, 1, `${this.namespace}:sec`, token], signal);
    if (typeof waitMs !== "number" || !Number.isInteger(waitMs) || waitMs < 0 || waitMs > 100) throw unavailable();
    return { waitMs, token, expiresAt };
  }

  async finishSec(token: string, signal: AbortSignal) {
    const result = await this.command(["EVAL", SEC_FINISH, 1, `${this.namespace}:sec`, token], signal);
    if (result !== 1) throw unavailable();
  }
}

/** Local single-process equivalent. Production never falls back to this state. */
export function createMemoryState(now = Date.now): SharedState {
  const cache = new Map<string, { value: string; expires: number }>();
  const windows = new Map<string, number[]>();
  const leases = new Map<string, number>();
  return {
    async get(key, signal) {
      signal.throwIfAborted();
      const entry = cache.get(key);
      if (!entry || entry.expires <= now()) { cache.delete(key); return null; }
      return entry.value;
    },
    async set(key, value, ttlMs, signal) {
      signal.throwIfAborted();
      cache.set(key, { value, expires: now() + ttlMs });
    },
    async take(key, maximum, windowMs, signal) {
      signal.throwIfAborted();
      const time = now();
      const times = (windows.get(key) ?? []).filter((start) => start > time - windowMs);
      windows.set(key, times);
      if (times.length >= maximum) return Math.max(1, times[0] + windowMs - time);
      times.push(time);
      return 0;
    },
    async reserveSec(signal) {
      signal.throwIfAborted();
      const time = now();
      for (const [token, expiry] of leases) if (expiry <= time) leases.delete(token);
      if (leases.size >= 5) return { waitMs: Math.min(100, Math.max(1, Math.min(...leases.values()) - time)), token: "", expiresAt: 0 };
      const token = randomUUID();
      leases.set(token, time + SEC_LEASE_MS);
      return { waitMs: 0, token, expiresAt: performance.now() + SEC_LEASE_MS };
    },
    async finishSec(token, signal) {
      signal.throwIfAborted();
      if (leases.has(token)) leases.set(token, now() + 1001);
    },
  };
}

const localState = createMemoryState();
export function getSharedState(): SharedState {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url || token) {
    try {
      if (!url || !token || new URL(url).protocol !== "https:") throw unavailable();
      return new RedisState(url, token, process.env.BRIDGEHUB_STATE_NAMESPACE || "bridgehub:v1");
    } catch { throw unavailable(); }
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw unavailable();
  return localState;
}
