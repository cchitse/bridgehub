# Ticket 05 verification

Completed 2026-09-12 against baseline 770fd9b.

## Website

Home (`/`), Data (`/data`), and Tutorial (`/tutorial`) are directly loadable static pages with shared navigation, current-page indication, visible keyboard focus, and a skip link. Home separates current SEC support from future multi-source plans. Data documents the actual tool contract and labels its example values, timestamps, and filing count as illustrative. Tutorial covers Windows PowerShell, Codex setup, local/public endpoints, verification, AAPL, and troubleshooting.

No additional data tool, search form, chat, or live page data dependency was added. `BRIDGEHUB_PUBLIC_ORIGIN` supplies the public tutorial address at build time; it remains empty and the website explicitly says the public endpoint is unpublished. README documents when to set it and rebuild. Public connectivity remains ticket 06.

## Checks

- Application typecheck passed.
- Final full suite: 66 passed; five optional Redis integration cases skipped because no test Redis URL was supplied. Backend source code was unchanged. Ticket 04 records real Redis concurrency/restart evidence.
- Production build passed and reported `/`, `/data`, and `/tutorial` as static routes.
- Headless Chrome checked each page at 1280×900 and 390×900: HTTP 200, English document language, one H1, correct active navigation, no forms, and no horizontal overflow.
- Browser checks passed for clicked navigation, keyboard navigation to Data, visible focus, skip-link focus transfer, illustrative example labeling, and unpublished endpoint messaging. No browser page errors occurred.
- Desktop Home and narrow Data/Tutorial screenshots were visually inspected, including detailed field-table and local setup sections. Official SEC and Codex link destinations were inspected.
- Against the production server on port 3001, an actual MCP search returned `service_unavailable` without production Redis credentials. All three pages still loaded successfully in Chrome.
- The supplied Browser runtime failed due to a missing browser-service module; the Windows Computer Use helper was also unavailable. Browser checks therefore used temporary Playwright tooling with installed Chrome. No browser dependency was added to the project.

## Live Codex demonstration

Verified with installed Codex CLI `0.154.0-alpha.6.2`, using the existing ChatGPT sign-in. `codex mcp add --help` confirmed the documented `--url` syntax. The live invocation used an ephemeral read-only `codex exec` session with a command-line MCP URL override; it did not modify the user's saved MCP configuration. Interactive sign-in and `/mcp` were documented from official guidance rather than automated.

Codex discovered and invoked exactly `bridgehub.us_search_sec_company` with `query: AAPL`. The first attempt reached BridgeHub but returned `upstream_unavailable` because the development server was sandboxed without SEC network access. After restarting that server with approved network access, the actual MCP call completed successfully:

- Outcome: `ok`; company: Apple Inc.; CIK: `0000320193`.
- Profile: `https://data.sec.gov/submissions/CIK0000320193.json`, retrieved `2026-09-12T07:44:27.848Z`.
- Directory: `https://www.sec.gov/files/company_tickers.json`, retrieved `2026-09-12T07:44:27.628Z`.
- The CLI event stream showed the tool invocation and returned structured content. The answer was not supplied from model memory. No assertion was made about a stable filing count.

Official references checked: [Codex CLI installation and sign-in](https://learn.chatgpt.com/docs/codex/cli) and [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Standards

Independent review: zero findings. Shared navigation, Server Components, and static routing follow the installed Next.js guidance required by AGENTS.md. No meaningful baseline code smells were reported.

## Spec

Independent review: no blocking findings. One wording clarification was addressed: whitespace is trimmed, and the resulting query must contain 1–200 characters; excess characters are rejected rather than truncated. Browser and live evidence above complete the checks that were pending during the read-only review.
