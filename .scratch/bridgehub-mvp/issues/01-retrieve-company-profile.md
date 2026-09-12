# 01 — Retrieve a company profile through MCP

**What to build:** Let the owner run BridgeHub locally, connect a standards-compatible MCP client, and retrieve a real SEC company profile by CIK with source provenance. Establish the smallest working application and protocol test boundary for the remaining tickets. Implements the approved BridgeHub MVP specification; this first slice supports CIK lookup, with ticker/name resolution added in ticket 02.

**Blocked by:** None — can start immediately.

**Status:** complete

- [x] A locally runnable TypeScript/Next.js application exposes an anonymous Streamable HTTP MCP endpoint using pinned, compatible dependencies. Installation, runtime prerequisites, and local configuration are documented.
- [x] MCP initialization and tool discovery work, advertising exactly one company-search tool named `us_search_sec_company`. Protocol operations do not appear as extra tools.
- [x] The tool accepts the specified query and optional limit contract. CIKs with and without leading zeros or a case-insensitive CIK prefix resolve directly to SEC submissions without requiring a ticker-directory entry.
- [x] A successful lookup returns the specified envelope and all nine company-profile fields, including ten-digit CIK strings, ticker/exchange arrays, source-preserving SIC and fiscal-year-end strings, and defined missing-value behavior.
- [x] Recent filings count reflects the fetched recent accession-number array, not lifetime filings; missing or invalid arrays produce null rather than zero.
- [x] Results include the trimmed query, official submissions URL, and UTC retrieval timestamp. Structured MCP content and its concise text representation agree.
- [x] SEC requests identify BridgeHub and a real configured operator contact. BridgeHub retrieves data without an LLM or end-user API key and does not substitute fictional results.
- [x] Basic invalid-input and failed-request responses are MCP-compatible; the full failure matrix belongs to ticket 03. Local live requests are bounded and never exceed the SEC access limit; deployment-wide enforcement belongs to ticket 04.
- [x] Deterministic tests call the actual MCP HTTP interface, keeping protocol handling and normalization real while controlling external SEC responses. Cover discovery, successful CIK lookup, normalized CIK variants, field types, and provenance.
- [x] A separate live CIK lookup retrieves Apple's profile with CIK 0000320193. Record actual verification or an explicit upstream/setup blocker; controlled tests do not count as live verification.

## Verification

- Typechecking, all 32 MCP interface tests, and the production build passed on 2026-09-12.
- The live SDK client called the running Next.js endpoint and received Apple Inc., CIK 0000320193, with an official submissions source and retrieval timestamp 2026-09-12T06:37:12.308Z.
- Independent standards and specification reviews found no blocking issues. The Host-header robustness finding and invalid-filings-array coverage suggestion were addressed and verified.
- No commit was created: the supplied workspace has no Git repository or current branch. This does not affect the implemented ticket acceptance criteria.
