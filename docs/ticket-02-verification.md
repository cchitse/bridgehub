# Ticket 02 verification

Completed 2026-09-12. The existing MCP tool now resolves exact tickers, company-name substrings, and direct CIKs.

## Checks

- Test-first evidence: seven new search behavior cases failed against the CIK-only implementation, while the existing CIK behavior remained green.
- Final typechecking passed.
- Final full suite: 42 MCP-interface tests passed. Coverage includes ticker precedence/case, name matching, CIK deduplication, deterministic order and tie-breaking, default/maximum limits before fetching, truncation, provenance, invalid directories, and CIK independence.
- Production build passed. No dependencies were added.
- Directory and profile retrieval share the existing SEC fetch/pacing boundary, with one 30-second operation budget across the search. Shared caching and distributed limits remain ticket 04; partial-result recovery remains ticket 03.

## Live verification

The official MCP SDK client called the running local Next.js endpoint with AAPL. SEC returned Apple Inc., CIK 0000320193, with official directory and submissions URLs. Directory retrieval timestamp: 2026-09-12T06:47:48.177Z. Profile retrieval timestamp: 2026-09-12T06:47:49.064Z.

The live script now checks AAPL by default and validates both sources. Set MCP_QUERY to 320193 to repeat the direct CIK check. The temporary development server was stopped after verification; start it with npm run dev to use the tool again.

## Standards

The independent reviewer found that the bare trading symbol CIK was incorrectly rejected as an identifier prefix. This was fixed with uppercase/lowercase interface tests. The final review against baseline fd09fe4 reported no remaining blockers, documented standards violations, or substantial code smells.

Final disposition: one correctness finding, resolved.

## Spec

The independent reviewer found a README wording issue: not every SEC 404 means no matches. Documentation now explicitly limits that behavior to direct CIK lookup. The final review confirmed ordering, deduplication, limits, provenance, and CIK independence, with no remaining blockers.

Final disposition: one documentation finding, resolved.

## Repository

A Git repository on main with baseline fd09fe4 was available during this task. Only ticket-02 implementation, documentation, tests, and ticket status are included in its commit. Operator configuration stays in the ignored local environment file.
