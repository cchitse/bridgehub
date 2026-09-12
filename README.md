# BridgeHub — company search

A Next.js application with three English informational pages and one anonymous Streamable HTTP MCP tool: `us_search_sec_company`. Search by ticker, company-name substring, or CIK. Directory caching and shared request controls are implemented. Public hosting remains ticket 06.

## Website

- `/`: product introduction, current SEC support, and connect/ask/retrieve workflow.
- `/data`: tool inputs, output types, coverage, provenance, and an explicitly illustrative response.
- `/tutorial`: Windows PowerShell setup for Codex CLI, endpoint selection, verification, an AAPL prompt, and troubleshooting.

All three pages are static and readable without SEC or Redis access. Navigation uses ordinary accessible links; there is no data-search form or live preview. Local development must remain running to serve both the website and MCP.

Leave `BRIDGEHUB_PUBLIC_ORIGIN` empty until the public deployment has been verified. Then set it to the actual HTTPS origin (without a path, query, or credentials) and rebuild. The tutorial derives `/api/mcp` from that origin. Until configured, it explicitly says the public endpoint is unpublished and provides no placeholder connection command. This display setting is separate from the endpoint's `BRIDGEHUB_ORIGIN` request-validation setting; deployment should configure both to the verified public origin.

## Run locally

Use Node.js 22.14+ (Node 24 LTS recommended) and npm. Dependencies are pinned with a lockfile. This workspace was verified using Node 25.3.0.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set `SEC_CONTACT_EMAIL` to your real operator email. This is sent to SEC in the User-Agent, never in returned company profiles. Keep the local file private.
3. Run `npm run dev`.
4. Connect a Streamable HTTP MCP client to `http://127.0.0.1:3000/api/mcp`.

PowerShell setup:

```powershell
Copy-Item .env.example .env.local
# Edit .env.local to supply your actual SEC contact email.
npm run dev
```

For Codex CLI, add this MCP configuration to your existing Codex configuration without replacing other settings:

```toml
[mcp_servers.bridgehub]
url = "http://127.0.0.1:3000/api/mcp"
```

Restart Codex, check `/mcp`, and ask: “Use BridgeHub to search AAPL. Include the official source URLs and retrieval times.” Codex requires its own installation and sign-in; BridgeHub needs no user key or LLM API access. See [official MCP configuration guidance](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

For a production-mode local check, configure the Redis settings below, then use `npm run build` followed by `npm start`. Static pages and MCP discovery work without Redis configuration, but production searches fail closed. Both local commands bind to loopback. Public hosting is not part of this ticket.

## Tool contract

`query` is a trimmed string of 1–200 characters. Accepted CIK examples: `320193`, `0000320193`, `CIK0000320193`; the prefix is case-insensitive. Zero and malformed explicit CIKs are rejected. Other queries first use case-insensitive exact ticker matching (such as AAPL); if there is no ticker match, they use company-name substring matching (such as apple). CIK lookup does not depend on the directory.

`limit` is an integer from 1–20, default 10. Matches are deduplicated by CIK, sorted by company name then CIK, and limited before fetching profiles. `truncated` reports additional omitted matches. Name and ticker coverage is limited to SEC's current ticker directory, not all historical filers or former names.

The output envelope includes query, limit, outcome, results, and truncated. Directory-based searches also include `directory_source` with `source_url` and the directory's original `retrieved_at`. Each profile includes cik, ticker, name, sic, sic_description, exchange, fiscal_year_end, state_of_incorporation, recent_filings_count, source_url, and retrieved_at. Tickers/exchanges are arrays; unavailable scalar metadata is null. Recent filings count means the number of accession numbers in the fetched recent filings array, not a lifetime count. The UTC retrieval time records when BridgeHub fetched the data, not SEC's last modification time.

The successful ticker directory is cached for 24 hours with its original retrieval timestamp. Expired entries are refreshed on demand; a failed refresh never silently serves stale data. Profiles are always fetched on demand. If some selected profiles fail, successful profiles are returned with `outcome: partial`, a warning, and a `failures` list containing each failed CIK, category, message, and retryable flag. Truncation due to the result limit remains independent of retrieval failures. Partial responses retain usable data and do not set MCP's error flag.

If every selected profile fails, the response uses `outcome: error` and MCP's error flag, retaining directory provenance, truncation, and individual failure details. The aggregate `profiles_unavailable` error is retryable if at least one failure is retryable. Direct CIK or discovery errors also set MCP's error flag. Failures never synthesize missing profiles.

Responses provide structured content and an equivalent JSON text representation. A direct CIK profile lookup receiving an SEC 404 yields no_matches; a selected-profile 404 is an `upstream_not_found` failure, while a directory 404 is a discovery error. Missing operator configuration does not prevent discovery but prevents live retrieval.

Failure categories distinguish SEC blocking (`upstream_blocked`), SEC rate limiting (`upstream_rate_limited`), network/server failures (`upstream_unavailable`), invalid data (`upstream_response_error`), and exceeded request/lookup budgets (`upstream_timeout`). Retryable indicates whether a later attempt may help; no automatic retries occur. Blocking requires checking operator/network configuration before retrying. Error messages omit SEC response bodies, internal exceptions, and secrets.

Protocol validation is an exception to the structured retrieval envelope: missing/wrong-type arguments and out-of-range limits are rejected by the MCP SDK before the tool callback, using SDK-generated MCP errors. Validly typed but malformed CIKs reach the callback and receive BridgeHub's `invalid_input` envelope. Clients should handle MCP errors as well as structured retrieval outcomes.

The bare trading symbol `CIK` is resolved as a ticker. A CIK-prefixed identifier must include its digits; malformed longer forms such as `CIKabc` remain invalid.

## Verification

```powershell
npm run typecheck
npm run test:mcp
npm test
# With the local application running in another terminal:
npm run check:live
```

The interface tests use the real SDK client over a loopback HTTP server invoking the actual Next.js POST handler. Only outbound SEC fetch responses are controlled. They never contact SEC or use the real operator email. The separate live script searches AAPL through the running application and verifies Apple's identity plus directory and profile provenance without asserting volatile filing counts. `MCP_URL` can select another endpoint and `MCP_QUERY=320193` can recheck direct CIK lookup.

Outbound SEC requests have a 10-second timeout within a 30-second operation budget, with no automatic retries. Shared admission allows ten searches per rolling minute and five SEC requests per rolling second. A search beyond the budget returns `rate_limited` before reaching SEC. Upstream capacity is awaited only within the lookup deadline. Directory reads and profile reads consume the same SEC budget. Requests that pass the SDK input schema consume search capacity even if later validation or retrieval fails.

## Shared state configuration

Production uses [Upstash Redis's HTTPS REST API](https://upstash.com/docs/redis/features/restapi). Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (a read/write token), and a stable `BRIDGEHUB_STATE_NAMESPACE` shared by every instance. Use a separate namespace for an unrelated deployment, but never a per-instance or per-build namespace for the same service.

Redis executes search admission atomically using a rolling window and Redis server time. SEC capacity uses five shared slots held through request completion and for another 1,001 milliseconds, so delayed storage replies cannot bunch actual request starts beyond the limit. Abandoned slots expire after 45 seconds; dispatch rejects permits too close to expiry. Failed cleanup retains the longer lease. This conservative policy can reduce throughput when requests are slow. Expiring sorted sets contain random request IDs and timestamps, not queries or personal identifiers. Cache keys contain only the public directory and original retrieval time. No user accounts or query history are stored. Application restarts do not reset Redis state. Use a dedicated non-evicting database; manual deletion/eviction of limiter keys would reset the budget.

Without credentials, development uses a single-process in-memory equivalent with the same limits and cache rules. Its state resets on restart and is not suitable for multi-instance deployment. Production (`NODE_ENV=production` or Vercel) never falls back to memory. Missing/partial credentials, Redis errors, invalid Redis responses, and storage timeouts fail closed as `service_unavailable`; no unguarded SEC request is sent. Redis commands have a five-second timeout bounded by the overall tool deadline. Static pages and tool discovery do not access Redis.

No cloud database or paid resource was provisioned for this ticket. Choose the account/database and check current provider costs during deployment; credentials stay server-side. Upstash connectivity from the chosen deployment remains a ticket-06 verification step.

## Real Redis integration tests

The default tests run without a Redis installation. Optional integration tests execute the actual Lua script on real Redis through a loopback-only REST adapter, exercise two MCP HTTP instances, and launch a fresh process to verify state survives application restarts.

With Redis running on localhost port 6379, run `python3 scripts/redis-rest-bridge.py` in that environment. On this Windows machine Redis was installed in Ubuntu-24.04 WSL for testing. The adapter listens on port 8079 and accepts only the test token `local-test`. It is a development test helper, not a deployment service.

```powershell
$env:REDIS_TEST_URL = 'http://127.0.0.1:8079'
npm run test:redis
```

Use a local test Redis instance. The suite creates unique expiring keys; it does not flush the database. The child-process probe is skipped in the parent run and executed explicitly by its restart test. Without `REDIS_TEST_URL`, these integration cases are skipped. Stop the REST adapter after testing.

The route validates localhost hosts and rejects foreign browser origins. A future deployment can specify `BRIDGEHUB_ORIGIN` as its exact origin; deployment settings and shared controls still require ticket 06 validation. SEC and network restrictions may prevent live retrieval; a controlled test pass alone is not evidence of successful SEC connectivity.
