# 04 — Add caching and shared request limits

**What to build:** Keep anonymous company search bounded across concurrent application instances, reuse the SEC ticker directory for 24 hours, and give users clear retryable outcomes when request budgets or supporting storage are unavailable.

**Blocked by:** 01 — Retrieve a company profile through MCP.

**Status:** ready-for-agent

- [ ] Add shared cache and atomic request-limit state suitable for the public deployment, with a documented local equivalent. Do not introduce accounts, a user database, or query-history persistence.
- [ ] Cache successful ticker-directory retrievals for 24 hours, preserving the actual retrieval timestamp. Refresh on demand after expiry; failed refreshes do not silently serve expired data. Company profiles remain fetched on demand.
- [ ] Enforce at most 10 company-search calls per minute across the deployment and at most 5 upstream SEC requests in any rolling second. Directory fetches and profile fetches both consume upstream capacity.
- [ ] Request limits remain effective across two instances sharing state and after process restarts; a per-process counter is not considered deployment-wide enforcement.
- [ ] Wait for upstream slots only within the tool deadline. Return a clear rate-limit or retryable availability outcome when a request cannot proceed; do not add automatic retries.
- [ ] If production shared state is unavailable, return service unavailable without issuing uncontrolled SEC requests. Static website content must remain independently accessible.
- [ ] Keep rejection messages MCP-compatible and distinguish BridgeHub rate limiting from SEC rate limiting. Validate that rejected calls cause no extra upstream traffic.
- [ ] Use the existing public MCP boundary to verify search admission, CIK request throttling, shared-state failure, and concurrency. Directory cache behavior can initially be verified at the SEC access boundary with controlled time and storage, so this ticket can start before ticket 02.
- [ ] Test cache reuse, expiry, refresh failure, timestamp preservation, and shared-instance behavior. Once ticker/name search is available, ticket 06 verifies the complete cache-backed search path through MCP.
- [ ] Document required deployment settings and the selected storage service. Identify unavoidable costs before incurring them; do not assume authorization for a paid subscription.

