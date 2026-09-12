# BridgeHub — ticket 01

A local Next.js application exposing one anonymous Streamable HTTP MCP tool: `us_search_sec_company`. This first slice accepts CIKs only. Ticker/name search, the three-page website, shared deployment limits, and publishing belong to later tickets.

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

Restart Codex, check `/mcp`, and ask: “Use BridgeHub to retrieve SEC company 320193. Include the official source URL and retrieval time.” Codex requires its own installation and sign-in; BridgeHub needs no user key or LLM API access. See [official MCP configuration guidance](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

For a production-mode local check, use `npm run build` followed by `npm start`. Both local commands bind to loopback. Public hosting is not part of this ticket.

## Tool contract

`query` is a trimmed string of 1–200 characters. Accepted CIK examples: `320193`, `0000320193`, `CIK0000320193`; the prefix is case-insensitive. Zero and malformed CIKs are rejected. `limit` is an integer from 1–20, default 10; this CIK-only version returns at most one company. A ticker such as AAPL receives an explicit unsupported-query error.

The output envelope includes query, limit, outcome, results, and truncated. Each profile includes cik, ticker, name, sic, sic_description, exchange, fiscal_year_end, state_of_incorporation, recent_filings_count, source_url, and retrieved_at. Tickers/exchanges are arrays; unavailable scalar metadata is null. Recent filings count means the number of accession numbers in the fetched recent filings array, not a lifetime count. The UTC retrieval time records when BridgeHub fetched the profile, not SEC's last modification time.

Responses provide structured content and an equivalent JSON text representation. A real SEC 404 yields no_matches. Upstream failures and invalid identities return errors rather than invented data. Missing operator configuration does not prevent discovery but prevents live retrieval.

## Verification

```powershell
npm run typecheck
npm run test:mcp
npm test
# With the local application running in another terminal:
npm run check:live
```

The interface tests use the real SDK client over a loopback HTTP server invoking the actual Next.js POST handler. Only outbound SEC fetch responses are controlled. They never contact SEC or use the real operator email. The separate live script calls the running application and verifies Apple's identity and provenance without asserting volatile filing counts. `MCP_URL` can select another endpoint for that script.

Outbound SEC requests have a 10-second timeout within a 30-second operation budget, no automatic retries, and a single-process limit of five starts per rolling second. This is sufficient for local evaluation, not deployment-wide protection: ticket 04 supplies shared controls. Request pacing counts actual dispatch times even when the event loop is delayed.

The route validates localhost hosts and rejects foreign browser origins. A future deployment can specify `BRIDGEHUB_ORIGIN` as its exact origin; deployment settings and shared controls still require ticket 06 validation. SEC and network restrictions may prevent live retrieval; a controlled test pass alone is not evidence of successful SEC connectivity.
