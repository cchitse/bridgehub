import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { LookupError } from "./errors";
import type { SharedState } from "./state";

async function waitForRequestSlot(state: SharedState, signal: AbortSignal) {
  while (true) {
    signal.throwIfAborted();
    const permit = await state.reserveSec(signal);
    if (permit.waitMs === 0) return permit;
    await delay(permit.waitMs + 1, undefined, { signal });
  }
}

const identity = z.object({ cik: z.union([z.string().regex(/^\d{1,10}$/), z.number().int().nonnegative().max(9999999999)]) }).passthrough();
const scalar = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

function recentFilingsCount(value: unknown): number | null {
  const parsed = z.object({ recent: z.object({ accessionNumber: z.array(z.string()) }) }).safeParse(value);
  return parsed.success ? parsed.data.recent.accessionNumber.length : null;
}

async function fetchSecJson(sourceUrl: string, state: SharedState, signal: AbortSignal) {
  const contact = process.env.SEC_CONTACT_EMAIL?.trim();
  if (!contact || !z.email().safeParse(contact).success) {
    throw new LookupError("configuration_error", "Set SEC_CONTACT_EMAIL to a real operator contact before requesting SEC data.");
  }

  let requestSignal = signal;
  let permit: Awaited<ReturnType<SharedState["reserveSec"]>> | undefined;
  try {
    permit = await waitForRequestSlot(state, signal);
    signal.throwIfAborted();
    if (performance.now() > permit.expiresAt - 11000) {
      throw new LookupError("upstream_timeout", "The reserved SEC slot expired before it could be used. Retry later.", true);
    }
    requestSignal = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": `BridgeHub ${contact}`, Accept: "application/json" },
      signal: requestSignal,
      cache: "no-store",
      redirect: "error",
    });
    if (response.status === 404) { await response.body?.cancel(); return null; }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) throw new LookupError("upstream_rate_limited", "SEC is limiting requests. Retry later.", true);
      if (response.status === 403) throw new LookupError("upstream_blocked", "SEC blocked this request. Check the operator contact and network access before retrying.");
      if (response.status >= 500) throw new LookupError("upstream_unavailable", "SEC is temporarily unavailable. Retry later.", true);
      throw new LookupError("upstream_response_error", "SEC returned an unexpected response.");
    }
    return { data: await response.json() as unknown, retrieved_at: new Date().toISOString() };
  } catch (error) {
    if (error instanceof LookupError) throw error;
    if (requestSignal.aborted) throw new LookupError("upstream_timeout", "The SEC request or overall lookup deadline expired. Retry later.", true);
    if (error instanceof SyntaxError) throw new LookupError("upstream_response_error", "SEC returned unreadable data instead of a company response.");
    throw new LookupError("upstream_unavailable", "SEC could not be reached. Retry later.", true);
  } finally {
    if (permit) {
      try { await state.finishSec(permit.token, signal); }
      catch { /* Keep the longer crash lease when cleanup fails; never release unconfirmed capacity. */ }
    }
  }
}

const directorySchema = z.record(z.string().regex(/^\d+$/), z.object({
  cik_str: z.number().int().positive().max(9999999999),
  ticker: z.string().min(1),
  title: z.string().min(1),
}));

const directoryCacheSchema = z.object({ data: directorySchema, retrieved_at: z.iso.datetime() });
const directoryTtl = 86_400_000;

export async function retrieveDirectory(state: SharedState, signal: AbortSignal) {
  const sourceUrl = "https://www.sec.gov/files/company_tickers.json";
  const cached = await state.get("directory", signal);
  if (cached !== null) {
    let entry;
    try { entry = directoryCacheSchema.parse(JSON.parse(cached)); }
    catch { throw new LookupError("service_unavailable", "BridgeHub's cached directory is invalid. Retry later.", true); }
    if (Date.now() - Date.parse(entry.retrieved_at) < directoryTtl && Date.parse(entry.retrieved_at) <= Date.now()) {
      return directoryResult(entry.data, sourceUrl, entry.retrieved_at);
    }
  }
  const response = await fetchSecJson(sourceUrl, state, signal);
  const parsed = directorySchema.safeParse(response?.data);
  if (!response || !parsed.success) {
    throw new LookupError("upstream_response_error", "SEC's company directory is unavailable or invalid.");
  }
  await state.set("directory", JSON.stringify({ data: parsed.data, retrieved_at: response.retrieved_at }), directoryTtl, signal);
  return directoryResult(parsed.data, sourceUrl, response.retrieved_at);
}

function directoryResult(data: z.infer<typeof directorySchema>, sourceUrl: string, retrievedAt: string) {
  return {
    companies: Object.values(data).map((row) => ({ cik: String(row.cik_str).padStart(10, "0"), ticker: row.ticker, name: row.title })),
    source: { source_url: sourceUrl, retrieved_at: retrievedAt },
  };
}

export async function retrieveCompany(cik: string, state: SharedState, signal: AbortSignal) {
  const sourceUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const response = await fetchSecJson(sourceUrl, state, signal);
  if (!response) return null;
  const parsed = identity.safeParse(response.data);
  if (!parsed.success || String(parsed.data.cik).padStart(10, "0") !== cik) {
    throw new LookupError("upstream_response_error", "SEC returned an invalid or mismatched company profile.");
  }
  const data = parsed.data;
  return {
    cik,
    ticker: strings(data.tickers),
    name: scalar(data.name),
    sic: scalar(data.sic),
    sic_description: scalar(data.sicDescription),
    exchange: strings(data.exchanges),
    fiscal_year_end: scalar(data.fiscalYearEnd),
    state_of_incorporation: scalar(data.stateOfIncorporation),
    recent_filings_count: recentFilingsCount(data.filings),
    source_url: sourceUrl,
    retrieved_at: response.retrieved_at,
  };
}
