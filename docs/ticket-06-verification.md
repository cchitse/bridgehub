# Ticket 06 verification

Completed September 12, 2026 against baseline d73074c.

## Public deliverables

- Website: https://bridgehub-mvp.vercel.app
- MCP: https://bridgehub-mvp.vercel.app/api/mcp
- Vercel project: `chitse/bridgehub-mvp`; Node.js 24.x; Next.js; region iad1.
- Verified application deployment: `dpl_AbEq25d9woMUyP4KFdZgjcXQEK7N`.
- Database: `bridgehub-redis`, Upstash Free, primary region iad1. Eviction, automatic paid upgrades, and Prod Pack were explicitly disabled during provisioning.

Production receives the real operator contact and Redis read/write REST credentials through server-side environment settings. No credential values are committed or exposed by the website. The canonical origin is configured for MCP host validation and static tutorial generation. No public tunnel, BridgeHub account/key, or Vercel sign-in is needed to use the canonical domain.

## Acceptance checks

- Application typecheck and local production build passed.
- Final full suite with the real local Redis REST adapter: 70 passed; one intentional parent-process probe skip. The restart test runs that probe in its own fresh process. Matching, bounds, normalization, provenance, cache expiry, concurrent instances, request limits, and controlled partial/failure outcomes passed through the existing interface tests.
- Final Vercel build ran `npm ci`, passed TypeScript/build, and generated Home, Data, and Tutorial as static pages alongside the dynamic MCP route.
- Anonymous HTTP access to the public site returned 200 without a redirect or protection-bypass token.
- Standard MCP client discovered exactly `us_search_sec_company` at the public endpoint and made genuine SEC lookups:

| Query | Returned CIK | Profile retrieval time UTC |
| --- | --- | --- |
| AAPL | 0000320193 | 2026-09-12T08:16:12.787Z |
| Apple Inc. | 0000320193 | 2026-09-12T08:16:13.000Z |
| 320193 | 0000320193 | 2026-09-12T08:16:13.135Z |

All profiles cited `https://data.sec.gov/submissions/CIK0000320193.json`. Ticker and name searches retained the same directory URL, `https://www.sec.gov/files/company_tickers.json`, and original retrieval time, `2026-09-12T08:12:27.752Z`, including across production redeployment. Profile retrieval timestamps changed as expected. No volatile filing-count assertion was made.

## Public browser checks

Installed Chrome, controlled with temporary Playwright tooling after the provided browser runtimes were unavailable, loaded all three public pages at 1280×900 and 390×900. Each returned 200, displayed the correct current navigation entry and one H1, and had no horizontal overflow. Clicked navigation, keyboard skip link/focus transfer, visible focus, illustrative data labeling, and absence of browser page errors passed. Screenshots were visually inspected.

The deployed tutorial contains `codex mcp add bridgehub --url https://bridgehub-mvp.vercel.app/api/mcp` and no unpublished-endpoint message. Local setup remains separately described. No local server was listening on port 3000 during the public tests; a final localhost connection check also confirmed it was unreachable.

## Public Codex demonstration

Codex CLI `0.154.0-alpha.6.2` used the owner's existing ChatGPT sign-in in a read-only ephemeral session. The public MCP URL was supplied by command-line configuration rather than modifying existing saved MCP entries. Startup waiting was enabled with `required=true` and `startup_timeout_sec=30` for the automated run. Interactive browser sign-in and `/mcp` UI were not automated.

Initial narrowly constrained prompts ended without exposing a tool and made no MCP call. A subsequent prompt explicitly allowing tool discovery successfully invoked `bridgehub.us_search_sec_company` with `{ "query": "AAPL" }`. The CLI event stream recorded the actual completed MCP call with `outcome: ok`, Apple Inc., CIK `0000320193`, and:

- Profile URL: `https://data.sec.gov/submissions/CIK0000320193.json`.
- Profile retrieval: `2026-09-12T08:17:56.980Z`.
- Directory URL: `https://www.sec.gov/files/company_tickers.json`.
- Original directory retrieval: `2026-09-12T08:12:27.752Z`.

The result came from the deployed SEC-backed tool, not model memory or fixtures. If Codex says a tool is unavailable, confirm readiness with `/mcp` and allow it to discover the BridgeHub tool before asking again.

## Standards

Independent standards review: zero violations or material baseline smells. The route duration export follows installed Next.js guidance. Deployment upload exclusions and build commands match the project.

## Spec

Independent specification review: no implementation mismatch. Stale pending-deployment wording was identified and reconciled after live verification. Required public browser, ticker/name/CIK, Codex, and local-server-independent checks are recorded above.

## Local tooling and limits

The Vercel integration automatically installed Upstash agent skills under `.agents/` and a `skills-lock.json`; these local tool additions are left uncommitted and excluded from deployment. Vercel login/project state and temporary verification artifacts remain under ignored local paths. The Redis test adapter was stopped after acceptance testing.

Provider free-plan allowances and SEC availability still apply. No paid Redis plan or paid add-on was activated. The repository currently has no Git remote, so future changes require an explicit CLI deployment unless Git integration is later configured.
