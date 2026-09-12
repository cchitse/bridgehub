import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

export class LookupError extends Error {
  constructor(public readonly category: string, message: string) { super(message); }
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

export async function retrieveCompany(cik: string) {
  const contact = process.env.SEC_CONTACT_EMAIL?.trim();
  if (!contact || !z.email().safeParse(contact).success) {
    throw new LookupError("configuration_error", "Set SEC_CONTACT_EMAIL to a real operator contact before requesting SEC data.");
  }

  const signal = AbortSignal.timeout(30_000);
  try {
    await waitForRequestSlot(signal);
    const sourceUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": `BridgeHub ${contact}`, Accept: "application/json" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      cache: "no-store",
      redirect: "error",
    });
    if (response.status === 404) { await response.body?.cancel(); return null; }
    if (!response.ok) {
      await response.body?.cancel();
      throw new LookupError("upstream_unavailable", "SEC could not provide this profile. Retry later.");
    }
    const parsed = identity.safeParse(await response.json());
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
      retrieved_at: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof LookupError) throw error;
    throw new LookupError("upstream_unavailable", "SEC could not be reached or returned unreadable data. Retry later.");
  }
}
