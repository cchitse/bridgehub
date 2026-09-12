import { LookupError, retrieveCompany, retrieveDirectory } from "./sec";

export async function searchCompanies(query: string, limit: number) {
  // One budget covers discovery, waiting for request slots, and all profiles.
  const signal = AbortSignal.timeout(30_000);
  const match = /^(?:CIK)?(\d{1,10})$/i.exec(query);
  if (match) {
    const cik = match[1].padStart(10, "0");
    if (cik === "0000000000") throw new LookupError("invalid_input", "CIK must be greater than zero.");
    const profile = await retrieveCompany(cik, signal);
    return { query, limit, outcome: profile ? "ok" : "no_matches", results: profile ? [profile] : [], truncated: false };
  }
  // Bare CIK is also a trading symbol; only a longer prefix denotes explicit CIK input.
  if (/^CIK.+/i.test(query) || /^\d+$/.test(query)) {
    throw new LookupError("invalid_input", "Enter a CIK containing 1–10 digits, optionally prefixed with CIK.");
  }

  const directory = await retrieveDirectory(signal);
  const needle = query.toLowerCase();
  const tickerMatches = directory.companies.filter((company) => company.ticker.toLowerCase() === needle);
  const matches = tickerMatches.length ? tickerMatches : directory.companies.filter((company) => company.name.toLowerCase().includes(needle));
  matches.sort((a, b) => a.name.localeCompare(b.name, "en") || a.cik.localeCompare(b.cik, "en"));
  const unique = new Map<string, typeof matches[number]>();
  for (const company of matches) if (!unique.has(company.cik)) unique.set(company.cik, company);
  const selected = [...unique.values()].slice(0, limit);
  const profiles = await Promise.all(selected.map(async (company) => {
    const profile = await retrieveCompany(company.cik, signal);
    if (!profile) throw new LookupError("upstream_response_error", "A matching company's SEC profile is unavailable. Retry later.");
    return profile;
  }));
  return {
    query, limit, outcome: profiles.length ? "ok" : "no_matches", results: profiles,
    truncated: unique.size > limit, directory_source: directory.source,
  };
}
