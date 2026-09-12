# BridgeHub MVP discussion

Status: grilling concluded; user requested SPEC.md and explicitly approved the proposed testing boundaries. See ../SPEC.md for the synthesized specification.

## Confirmed requirements from the user

- Long-term vision: one MCP endpoint for discovering and extracting open data across supported sources, with usable results and traceable sources.
- Initial source: SEC company search, described in ../SEC.md.
- A lightweight website with three tabs: Home (product introduction), Data (initially SEC company search), and Tutorial (connecting from the user's own device).
- The website is static, in English, with clickable navigation between the three pages. No browser company-search form or interactive data interface is wanted.
- Evaluation on localhost, plus publication at an accessible public URL as required by the professor. Vercel and AWS were suggested as hosting options.
- Chosen direction: a real, small MCP with a Codex CLI tutorial. The website-only prototype alternative was not selected.
- Only the project owner is expected to use the demo; no formal grading criteria beyond the stated public-link requirement. Ease of implementation is the priority. No exact deadline or monetary budget was supplied.
- Accepted demo scenario: connect Codex to BridgeHub, search AAPL, and receive Apple's company profile with an official source link.
- Initial user scenario: a student identifying a company for a research assignment. Company profiles suffice; financial statement analysis is outside the agreed scope.
- Keep scope to one company-search tool and three website pages. The user permits one or two functions but has not requested a second tool.
- Complete grilling before the user's planned to-spec, to-tickets, and implement stages.
- Round 2: user accepted all Q6-Q9 recommendations.
- Publish both the website and a working MCP endpoint; the public MCP must work while the local development server is stopped.
- Anonymous MCP access with basic request limits; no account, login, or key-generation feature.
- One company-search tool adopts SEC.md's ticker/name/CIK inputs and documented profile fields, augmented with official source URLs, retrieval time, and the query used.
- Cache the ticker directory for 24 hours and retrieve company profiles when requested.
- Distinguish no matches from upstream unavailability. Mark partial results as incomplete when only some profiles can be retrieved. Do not substitute fictional data for failed retrievals.
- Home content: product purpose, three-step workflow, and explicit current SEC company-search coverage.
- Data content: supported inputs, output fields, limitations, official source links, and a labeled example response.
- Tutorial content: Windows PowerShell instructions for connecting Codex CLI, checking the connection, and the AAPL example, covering local and public endpoints.

## Verified facts

- SEC.md defines company resolution and profile retrieval, not financial statement extraction. It specifies ticker/name/CIK input and a result limit defaulting to 10, capped at 20.
- Codex supports remote Streamable HTTP MCP servers, with optional credentials; an unauthenticated service does not require website-issued keys. Source: https://learn.chatgpt.com/docs/extend/mcp?surface=cli
- SEC public data APIs require no authentication or API keys. They do not support CORS, so a live browser search needs a backend. Source: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- Twinkle Hub is a product reference, not the proposed upstream data provider. Its CLI tutorial describes login-issued virtual keys and usage credits. Those are Twinkle Hub product choices, not prerequisites for all MCP services. Source: https://hub.twinkleai.tw/zh-TW/docs?aud=cli . The specific company tool page could not yet be retrieved; SEC.md provides its described contract.

## Proposal context and tensions

BridgeHub.pdf was read in full (two pages). It proposes education-focused workflows, reusable data packs, verified retrieval recipes, and traceability through source links and query details. It reports student feedback favoring simple downloads without mandatory MCP setup. Pricing and broader coverage remain unvalidated.

- The user explicitly selected a static website and Codex demo. Browser-based data access from the broader proposal is deferred.
- Company profiles are narrower than financial indicators, filing extraction, or reusable teaching data packs.
- A website-only prototype demonstrates the concept but cannot validate actual retrieval.
- The latest MVP requirements take precedence over the proposal's broader ambitions; deferred features must not be presented as delivered.

## Decision branches

- Settled: working public anonymous MCP, one company-search tool, three static English pages, student company-identification scenario, owner-operated demo, source provenance, freshness and failure behavior, page contents, and tutorial scope.
- Final scope carried into SPEC.md after the user requested proceeding: one Vercel project hosting the pages and MCP route, developed and evaluated locally first. Vercel documents support for deploying Streamable HTTP MCP servers: https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel . Deployment and actual SEC connectivity still require implementation verification.
- Final acceptance scope carried into SPEC.md: all three pages work locally and publicly; Codex discovers exactly one company-search tool; ticker, name, and CIK inputs work; AAPL returns a profile with provenance; no-match and unavailable/partial outcomes are distinguishable; the public MCP works with the local server stopped.
- Explicitly approved testing boundaries: public MCP interface with controlled SEC responses for failure cases, browser checks of the three pages, and one live Codex demo.
- Specification work should select exact validation rules, schema representation, rate-limit implementation, cache storage, and timeouts. Enforce SEC request limits across deployed instances rather than claiming a per-process limiter is globally effective. Verify actual SEC access from the deployed environment before declaring the demo complete.
- No ADR is needed yet: the agreed scope cuts and proposed host are straightforward, reversible choices. Decisions remain recorded here.

Recommendations are not accepted decisions. Record answers as the interview proceeds; create ADRs only when a decision meets the domain-modeling skill's trade-off criteria.
