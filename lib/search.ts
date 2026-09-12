import { describeFailure, LookupError, retrieveCompany, retrieveDirectory } from "./sec";

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
  const settled = await Promise.allSettled(selected.map(async (company) => {
    const profile = await retrieveCompany(company.cik, signal);
    if (!profile) throw new LookupError("upstream_not_found", "SEC no longer provides the profile selected from its directory.");
    return profile;
  }));
  const profiles: NonNullable<Awaited<ReturnType<typeof retrieveCompany>>>[] = [];
  const failures: ({ cik: string } & ReturnType<typeof describeFailure>)[] = [];
  for (const [index, result] of settled.entries()) {
    if (result.status === "fulfilled") profiles.push(result.value);
    else failures.push({ cik: selected[index].cik, ...describeFailure(result.reason) });
  }
  const outcome = failures.length ? (profiles.length ? "partial" : "error") : (profiles.length ? "ok" : "no_matches");
  return {
    query, limit, outcome, results: profiles,
    truncated: unique.size > limit, directory_source: directory.source,
    ...(failures.length ? { failures, warnings: ["Results are incomplete because one or more selected company profiles could not be retrieved."] } : {}),
    ...(outcome === "error" ? { error: {
      category: "profiles_unavailable", message: "None of the selected company profiles could be retrieved. See failures for the individual reasons.",
      retryable: failures.some((failure) => failure.retryable),
    } } : {}),
  };
}
