# 03 — Handle unavailable and incomplete data

**What to build:** Give the student an honest, useful outcome when SEC has no matching company, omits metadata, blocks a request, or returns only some requested profiles. Every outcome remains understandable through the same MCP tool.

**Blocked by:** 02 — Search by ticker and company name.

**Status:** ready-for-agent

- [ ] Distinguish successful results, genuine no matches, partial results, and errors using the specified outcome envelope and MCP-compatible failure signaling.
- [ ] An actual SEC not-found response for direct CIK lookup produces no matches. Blocking pages, malformed responses, upstream rate limits, network failures, and timeouts never masquerade as no matches.
- [ ] If some selected profiles fail, return successful profiles with `partial`, identify failed CIKs and reasons, and explain incompleteness. Retrieval failure and limit-based truncation remain separate signals.
- [ ] If discovery fails or all selected profiles fail, return an error with a stable category and concise message. Avoid exposing stack traces or secrets.
- [ ] Preserve null scalar attributes and empty missing ticker/exchange arrays. Do not infer absent values or convert missing filing counts into zero.
- [ ] Enforce a 10-second per-request timeout and a 30-second overall tool deadline, including time spent waiting for request slots. No automatic retry is introduced; errors indicate when retrying may help.
- [ ] Controlled SEC responses exercised through the real MCP HTTP interface cover no matches, actual not-found, blocking/rate limiting, malformed data, missing fields, timeouts, partial success, and total failure.
- [ ] Tests verify usable successful rows and their provenance survive partial failures, and that failed requests never return fabricated company profiles.
- [ ] Leave production shared-state failure and BridgeHub rate-limit enforcement to ticket 04; use compatible categories so the behaviors integrate without changing the user-facing contract.

