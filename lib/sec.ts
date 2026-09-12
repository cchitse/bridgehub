import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

export class LookupError extends Error {
  constructor(public readonly category: string, message: string, public readonly retryable = false) { super(message); }
}

export function describeFailure(error: unknown) {
  const failure = error instanceof LookupError ? error : new LookupError("internal_error", "BridgeHub could not complete this lookup.");
  return { category: failure.category, message: failure.message, retryable: failure.retryable };
}

// Local, single-process pacing only. Shared deployment limits belong to ticket 04.
let requestTimes: number[] = [];

async function waitForRequestSlot(signal: AbortSignal) {
  while (true) {
    signal.throwIfAborted();
    const now = Date.now();
    requestTimes = requestTimes.filter((time) => time > now - 1000);
    if (requestTimes.length < 5) {
      requestTimes.push(now);
      return;
    }
    await delay(Math.max(1, requestTimes[0] + 1001 - now), undefined, { signal });
  }
}

const identity = z.object({ cik: z.union([z.string().regex(/^\d{1,10}$/), z.number().int().nonnegative().max(9999999999)]) }).passthrough();
const scalar = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

function recentFilingsCount(value: unknown): number | null {
  const parsed = z.object({ recent: z.object({ accessionNumber: z.array(z.string()) }) }).safeParse(value);
  return parsed.success ? parsed.data.recent.accessionNumber.length : null;
}

async function fetchSecJson(sourceUrl: string, signal: AbortSignal) {
  const contact = process.env.SEC_CONTACT_EMAIL?.trim();
  if (!contact || !z.email().safeParse(contact).success) {
    throw new LookupError("configuration_error", "Set SEC_CONTACT_EMAIL to a real operator contact before requesting SEC data.");
  }

  let requestSignal = signal;
  try {
    await waitForRequestSlot(signal);
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
  }
}

const directorySchema = z.record(z.string().regex(/^\d+$/), z.object({
  cik_str: z.number().int().positive().max(9999999999),
  ticker: z.string().min(1),
  title: z.string().min(1),
}));

export async function retrieveDirectory(signal: AbortSignal) {
  const sourceUrl = "https://www.sec.gov/files/company_tickers.json";
  const response = await fetchSecJson(sourceUrl, signal);
  const parsed = directorySchema.safeParse(response?.data);
  if (!response || !parsed.success) {
    throw new LookupError("upstream_response_error", "SEC's company directory is unavailable or invalid.");
  }
  return {
    companies: Object.values(parsed.data).map((row) => ({ cik: String(row.cik_str).padStart(10, "0"), ticker: row.ticker, name: row.title })),
    source: { source_url: sourceUrl, retrieved_at: response.retrieved_at },
  };
}

export async function retrieveCompany(cik: string, signal = AbortSignal.timeout(30_000)) {
  const sourceUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const response = await fetchSecJson(sourceUrl, signal);
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
