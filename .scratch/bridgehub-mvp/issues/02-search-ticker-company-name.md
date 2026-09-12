# 02 — Search by ticker and company name

**What to build:** Let a student use a familiar ticker or part of a company name to obtain a bounded, traceable list of company profiles through the existing MCP tool. Preserve direct CIK lookup and the single-tool contract.

**Blocked by:** 01 — Retrieve a company profile through MCP.

**Status:** ready-for-agent

- [ ] Non-CIK queries resolve through the official SEC company ticker directory. Case-insensitive exact ticker matches take precedence; if none exists, use case-insensitive company-name substring matching.
- [ ] Trim queries and enforce the specified 1–200 character string requirement. Reject empty/non-string queries, malformed explicit CIKs, and all-zero CIKs.
- [ ] Omitted limit defaults to 10; accept only integers from 1 through 20. Invalid limits are rejected rather than silently changed.
- [ ] Deduplicate directory matches by CIK, order by company name then CIK, and apply the limit before retrieving profiles. Return a separate truncation flag when more matches exist.
- [ ] Direct CIK resolution remains independent of directory membership and directory availability.
- [ ] Directory-based results include the official directory source URL and its original retrieval timestamp, alongside per-profile submissions provenance and the query. Retain multiple reported tickers and exchanges without inventing pairings.
- [ ] A genuine empty directory match produces `no_matches` with an empty results array. Do not describe ticker-directory coverage as exhaustive historical filer search.
- [ ] Interface tests cover AAPL and mixed-case matching, name substrings, ticker precedence, duplicate CIKs, deterministic ordering, default/maximum limits, invalid values, truncation, provenance, and direct CIK regression cases.
- [ ] A separate live AAPL lookup returns Apple's profile from SEC. Reuse the SEC access boundary established in ticket 01 so ticket 04 can supply shared cache and request controls without changing the tool contract.

