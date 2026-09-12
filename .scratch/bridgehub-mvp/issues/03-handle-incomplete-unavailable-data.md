# 03 — Handle unavailable and incomplete data

**What to build:** Give the student an honest, useful outcome when SEC has no matching company, omits metadata, blocks a request, or returns only some requested profiles. Every outcome remains understandable through the same MCP tool.

**Blocked by:** 02 — Search by ticker and company name.

**Status:** complete

- [x] Distinguish successful results, genuine no matches, partial results, and errors using the specified outcome envelope and MCP-compatible failure signaling.
- [x] An actual SEC not-found response for direct CIK lookup produces no matches. Blocking pages, malformed responses, upstream rate limits, network failures, and timeouts never masquerade as no matches.
- [x] If some selected profiles fail, return successful profiles with `partial`, identify failed CIKs and reasons, and explain incompleteness. Retrieval failure and limit-based truncation remain separate signals.
- [x] If discovery fails or all selected profiles fail, return an error with a stable category and concise message. Avoid exposing stack traces or secrets.
- [x] Preserve null scalar attributes and empty missing ticker/exchange arrays. Do not infer absent values or convert missing filing counts into zero.
- [x] Enforce a 10-second per-request timeout and a 30-second overall tool deadline, including time spent waiting for request slots. No automatic retry is introduced; errors indicate when retrying may help.
- [x] Controlled SEC responses exercised through the real MCP HTTP interface cover no matches, actual not-found, blocking/rate limiting, malformed data, missing fields, timeouts, partial success, and total failure.
- [x] Tests verify usable successful rows and their provenance survive partial failures, and that failed requests never return fabricated company profiles.
- [x] Leave production shared-state failure and BridgeHub rate-limit enforcement to ticket 04; use compatible categories so the behaviors integrate without changing the user-facing contract.

## Verification

- Final typechecking, full suite of 54 MCP-interface tests, and production build passed on 2026-09-12.
- Controlled SEC responses verify successful-row preservation, partial/total failure signaling, stable categories and retryability, safe error content, and both timeout budgets including queue waiting and stalled bodies.
- Standards review found no issues. Specification review found no retrieval blockers; its clarification about SDK argument-validation errors is documented in the README.
