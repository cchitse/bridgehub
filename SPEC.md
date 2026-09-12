# BridgeHub MVP Specification

Status: ready for ticket breakdown. Product scope and testing boundaries were confirmed through discussion. Technical defaults below make the agreed scope implementable; they are specification choices, not claims that software already exists.

## Problem Statement

A student identifying a company for a research assignment must navigate SEC data sources, resolve company identifiers, and interpret source-specific responses before obtaining a useful company profile. Using an AI application does not by itself provide a dependable, traceable connection to that data.

BridgeHub needs a small working demonstration of its broader idea: connect an AI application to one MCP endpoint and retrieve usable open data with source provenance. The project owner will evaluate the demo locally and must also provide a public website and working public MCP endpoint. Ease of implementation takes priority over breadth.

## Solution

Build one English-language website with three static pages, reached through shared Home, Data, and Tutorial navigation. Host a real, anonymous MCP endpoint alongside the website. Expose exactly one company-search tool backed by SEC EDGAR.

The visitor learns what BridgeHub does, reads the supported source and example output, and follows Windows PowerShell instructions to connect Codex CLI. In Codex, the user asks for Apple's company profile. Codex discovers and calls the tool, receives structured company data with official source links, and can explain the result to the user.

The website displays information; it has no company-search form or live data interface. The public MCP remains usable when the owner's local development server is stopped.

## User Stories

1. As a visitor, I want a concise explanation of BridgeHub, so that I understand its purpose.
2. As a visitor, I want Home, Data, and Tutorial navigation within one website, so that I can find the information I need.
3. As a visitor, I want English content and readable layouts, so that I can understand the demo quickly.
4. As a visitor, I want current SEC coverage clearly distinguished from future multi-source ambitions, so that I know what works today.
5. As a student, I want to understand the connection, search, and result workflow, so that I can decide how to use the service.
6. As a student, I want a description of company-search inputs, so that I can prepare a valid query.
7. As a student, I want definitions of returned profile fields, so that I can interpret the data correctly.
8. As a student, I want an explicitly labeled example response, so that I can recognize a successful result without mistaking an example for live data.
9. As a student, I want links to official SEC sources, so that I can examine the underlying data.
10. As a Codex user, I want Windows PowerShell connection instructions, so that I can configure the demo on my own device.
11. As a Codex user, I want local and public connection instructions clearly separated, so that I use the correct endpoint.
12. As a Codex user, I want a way to check whether the tool is connected, so that I can diagnose setup problems.
13. As a Codex user, I want a sample AAPL prompt, so that I can reproduce the intended demonstration.
14. As a Codex user, I want to connect without a BridgeHub account or key, so that setup stays short.
15. As a student, I want to search by ticker, so that I can identify a company using its familiar trading symbol.
16. As a student, I want to search by part of a company name, so that I can find a company without knowing its ticker.
17. As a student, I want to search by CIK with or without leading zeros, so that I can reuse an SEC identifier.
18. As a student, I want matching company profiles returned in a bounded list, so that results remain manageable.
19. As a student, I want source URLs, the query, and retrieval times associated with results, so that I can trace their origin and freshness.
20. As a student, I want missing attributes represented honestly, so that I do not mistake an unavailable value for a reported fact.
21. As a student, I want an explicit no-match result, so that I can revise my query.
22. As a student, I want SEC availability errors distinguished from no matches, so that I do not draw a false conclusion about a company.
23. As a student, I want incomplete results identified, so that I know when some matching profiles could not be retrieved.
24. As a user, I want understandable invalid-input and rate-limit responses, so that I know how to retry.
25. As the project owner, I want to run the website and MCP locally, so that I can evaluate them before publication.
26. As the project owner, I want one public deployment for the website and MCP, so that I can share the demo without keeping my computer running.
27. As the project owner, I want repeatable interface-level tests, so that I can verify functionality without relying on SEC being available for every test.
28. As the project owner, I want one successful live Codex demonstration against the deployment, so that I can show the core product actually works.

## Implementation Decisions

### Application and deployment

- Use one application with static informational pages and a server-side Streamable HTTP MCP endpoint. Static pages do not imply a static-only hosting deployment.
- Target one Vercel project. Use TypeScript, Next.js, and an MCP SDK-compatible HTTP handler as implementation defaults; select and pin compatible versions during implementation.
- Separate responsibilities into website presentation, MCP protocol handling, company-search orchestration, SEC access, and a small cache/rate-limit facility. Do not build a multi-source plugin framework for this demo.
- Expose exactly one tool named `us_search_sec_company`. Standard MCP initialization and tool discovery are protocol operations, not additional product tools.
- Use the same application behavior locally and publicly, with environment-specific connection addresses and server configuration.
- The public website and MCP must be accessible without deployment-platform login. Anonymous BridgeHub access does not remove Codex's own installation and sign-in prerequisites.
- BridgeHub performs deterministic data retrieval and normalization. It does not call an LLM or need an OpenAI API key; Codex handles the user's natural-language interaction.

### Website content

- Home: BridgeHub introduction; current SEC support; a three-step connect, ask, and retrieve explanation; links to Data and Tutorial.
- Data: one supported-source entry titled US SEC Company Search; accepted inputs; output definitions; coverage limitations; official source links; a clearly labeled example with illustrative timestamps identified as such.
- Tutorial: Codex CLI prerequisites, Windows PowerShell setup, local and deployed endpoint instructions, connection verification, the AAPL prompt, and short troubleshooting guidance for unavailable endpoints and rate limits.
- Published connection instructions must use the actual deployed address. Do not leave a placeholder as the operational public endpoint.
- Keep the layout simple and original, informed by TwinkleHub's information structure. Use accessible navigation, visible keyboard focus, and readable narrow-screen layouts. Clicking a tab navigates between the three pages.

### Company-search input and resolution

- `query`: required string, trimmed, containing 1–200 characters. Reject empty strings and non-string input.
- `limit`: optional integer, default 10, allowed range 1–20. Reject invalid values rather than silently changing them.
- Treat a string of 1–10 digits, optionally prefixed by case-insensitive `CIK`, as a CIK. Normalize it to a ten-digit string. Reject an all-zero CIK and malformed explicit CIK input.
- Resolve CIK queries directly against the submissions endpoint. Do not require the company to appear in the ticker directory first.
- For other queries, prefer case-insensitive exact ticker matches. If none exists, perform case-insensitive substring matching on names in the ticker directory.
- Deduplicate matches by CIK, sort by company name and then CIK, and apply the limit before fetching profiles. Report whether additional matching companies were omitted by the limit. Pagination is not included.
- Name and ticker discovery are bounded by SEC's ticker directory; the website must not promise exhaustive search across all historical filers or former company names.
- Read the official ticker directory at `https://www.sec.gov/files/company_tickers.json` and company submissions at `https://data.sec.gov/submissions/CIK{cik10}.json`.

### Result contract and source provenance

- Return structured MCP content with a concise equivalent text representation for client compatibility. Do not return the complete raw submissions payload.
- The result envelope contains the trimmed query, applied limit, outcome (`ok`, `no_matches`, `partial`, or `error`), a results array, a truncation flag, and warnings/errors where relevant.
- Each company profile includes `cik`, `ticker`, `name`, `sic`, `sic_description`, `exchange`, `fiscal_year_end`, `state_of_incorporation`, and `recent_filings_count`.
- Preserve CIK as a ten-digit string, SIC as a string, and fiscal year end as the source's four-digit month/day value. Return `ticker` and `exchange` as arrays to retain multiple reported values without inventing a one-to-one mapping. Document these types on the Data page.
- Return unavailable scalar attributes as null and unavailable ticker/exchange collections as empty arrays. Do not infer absent attributes from the model or fabricate company information.
- `recent_filings_count` is the length of the recent accession-number array in the fetched submissions data. It is not a lifetime count or a guaranteed count for a fixed calendar period. If the array is absent or invalid, return null rather than zero.
- Each profile includes its official submissions URL and a UTC ISO-8601 retrieval timestamp. For directory-based resolution, also provide the directory URL and its original retrieval timestamp. Report the query in the envelope.
- Retrieval time means when BridgeHub fetched the data, not when SEC last updated it. Cached directory data retains its original retrieval timestamp.
- Source attribution identifies SEC EDGAR. Do not expand the public-domain label in the source notes into a blanket legal claim about every issuer-authored filing; this demo returns profile metadata and links, not filing documents.

### Freshness, bounded requests, and failures

- Cache successful ticker-directory retrievals for 24 hours. Refresh expired data on demand; no scheduled refresh process is needed. Do not silently use expired data when a refresh fails.
- Retrieve company submissions on demand. Do not persist user query history or company profiles for this MVP.
- Identify SEC requests with a configured application name and a real operator contact in the User-Agent. Never invent an email address. This operator configuration is separate from end-user authentication.
- Use a shared cache and atomic rate-limit state in the public deployment so cold starts and multiple instances do not bypass limits. A small managed key-value service is sufficient; no user database is needed. A local equivalent may be used for development.
- As conservative demo defaults, allow at most 10 company-search calls per minute across the deployment and at most 5 upstream SEC requests in any rolling second. Count directory reads, profile fetches, and any retries against the upstream budget. These limits are distinct from the result limit.
- Use bounded waiting for upstream request slots, a 10-second timeout per SEC request, and a 30-second overall tool deadline. Do not retry automatically in the initial implementation. Return a clear retryable outcome when requests cannot complete within the budget.
- If shared rate-limit state is unavailable in production, return a service-unavailable error rather than making unbounded upstream calls. Static pages remain available independently of SEC and cache availability.
- No directory matches, or a direct CIK lookup with an actual SEC not-found response, produces `no_matches` with an empty array. A block page, malformed response, timeout, or upstream rate limit is not a no-match result.
- If some selected profiles succeed and others fail, return the successful profiles with `partial`, identify failed CIKs and failure reasons, and explain that results are incomplete. Limit-based truncation is reported separately from retrieval failure.
- If discovery fails or every selected profile fails, return `error` with a stable error category and a concise message. Distinguish invalid input, BridgeHub rate limiting, upstream unavailability, upstream response errors, and internal dependency unavailability.
- Use MCP-compatible error signaling for failed calls. Do not expose stack traces or infrastructure secrets in user-facing errors. Controlled test responses must never become a silent live-data fallback.

## Testing Decisions

- The user approved testing through the public MCP interface with controlled SEC responses for failure cases, a browser check of the three pages, and one live Codex demonstration.
- There is no existing application code, test suite, or prior testing pattern in the workspace. Prefer one primary automated boundary: a protocol client exercising the application's actual MCP HTTP interface. Replace only external SEC access and necessary clock/storage dependencies in deterministic tests; retain real protocol handling, validation, resolution, and normalization.
- Good tests assert observable contracts, not private helper calls, internal file layouts, or the exact wording Codex generates. Avoid implementation-mirroring unit tests and brittle page snapshots.
- Test initialization, tool discovery, and invocation: exactly one tool is advertised with the specified input schema, and a protocol client can call it.
- Cover AAPL and mixed-case ticker matching; name substring matching; all supported CIK representations; direct CIK lookup absent from the directory; duplicate tickers for one CIK; deterministic ordering; defaults and result bounds; invalid input; and truncation.
- Cover multiple tickers/exchanges, missing metadata, recent-filings count semantics, official URLs, query propagation, and original cache timestamps.
- At the same public interface, control upstream responses to exercise no matches, actual not-found, SEC blocking/rate limiting, malformed data, timeouts, partial success, total failure, and shared-state failure.
- Check observable cache expiry and request-limit behavior, including concurrent requests across two application instances sharing the same state. Verify rejected requests do not cause extra SEC traffic.
- Browser acceptance checks cover navigation among all three pages, direct page loading, English content, readable desktop/mobile layouts, keyboard navigation, labeled example data, official links, and correct local/public instructions. No browser data-search behavior is expected.
- Keep live SEC verification separate from deterministic tests. Do not assert volatile values such as an exact current filing count. Record the returned CIK, provenance, and successful retrieval instead.

### Completion criteria

1. The website and MCP run locally with documented prerequisites and configuration.
2. Home, Data, and Tutorial work as three pages within one website, locally and at the public address.
3. A standards-compatible MCP client discovers exactly `us_search_sec_company` and successfully calls it using ticker, name, and CIK inputs.
4. Deterministic interface tests demonstrate validation, result bounds, provenance, cache behavior, request limits, no matches, and partial/failed retrievals.
5. Following the Tutorial on Windows PowerShell, the owner connects Codex CLI to the deployed endpoint and asks for Apple's company profile with official source links.
6. The live response identifies Apple with CIK `0000320193`, contains usable profile data and provenance, and results from an actual tool invocation rather than model memory.
7. The public website and MCP still work after the owner's local server is stopped. Verify SEC access from the deployed runtime; local success alone does not meet this condition.
8. Provide the actual public website address, MCP address, local run instructions, and concise validation evidence. Do not report publication or live validation as complete without executing them.

## Out of Scope

- Additional data sources or a second company tool.
- Financial metrics, XBRL extraction, full filing downloads, investment analysis, or historical filing traversal.
- A website search form, chat interface, dashboard, live previews, or interactive data visualizations.
- BridgeHub accounts, virtual keys, OAuth, subscriptions, billing, or per-user quotas.
- Saved queries, retrieval history, reusable data packs, collaboration, scheduled jobs, and bulk exports.
- Tutorials or compatibility certification for AI clients beyond Codex CLI, or operating systems beyond the Windows PowerShell walkthrough.
- Multilingual content, custom domains, large-scale production operations, and an AWS deployment in addition to the selected Vercel target.
- Mock data presented as a successful live MCP response.

## Further Notes

- This specification synthesizes BridgeHub.pdf, SEC.md, the domain glossary, and the confirmed conversation. The newer narrow MVP decisions take precedence over the PDF's broader education and multi-source ambitions.
- Proceeding to this specification is treated as acceptance of the final scope and Vercel recommendation. No precise deadline or hosting budget was supplied. Minimize infrastructure and avoid assuming permission for paid subscriptions; identify any unavoidable cost before incurring it.
- Deployment credentials, the final public hostname, and the real SEC operator contact are setup inputs for implementation, not reasons to delay specification writing.
- Cache provider, compatible dependency versions, and concrete deployment configuration may be selected during implementation without widening the product scope. Preserve the external behavior and shared request limits defined here.
- No ADR is required for the straightforward, reversible MVP choices. The discussion record preserves their rationale.
- This deliverable is a local SPEC file as requested. No project issue tracker is configured, and no issue has been published. Ticket creation is the user's planned next stage.
- Official references: [Codex MCP support](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [SEC data APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [SEC automated access guidance](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data), and [deploying MCP servers on Vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel). Recheck exact setup commands against the versions used during implementation.
