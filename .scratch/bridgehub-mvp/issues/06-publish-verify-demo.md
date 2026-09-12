# 06 — Publish and verify the complete demo

**What to build:** Give the owner one accessible public website and a working public MCP endpoint, with verified Codex instructions and evidence that the demo works independently of the owner's local server.

**Blocked by:** 02 — Search by ticker and company name; 03 — Handle unavailable and incomplete data; 04 — Add caching and shared request limits; 05 — Complete the three-page website and tutorial.

**Status:** ready-for-agent

- [ ] Deploy the application to one Vercel project with static informational pages and the real Streamable HTTP MCP endpoint. Configure the shared cache/request limits and real SEC operator contact without exposing secrets.
- [ ] Obtain necessary deployment access and setup values from the owner if unavailable. Never invent credentials or operator contact details, and identify unavoidable costs before incurring them.
- [ ] The public website and MCP require neither deployment-platform login nor a BridgeHub account/key. No local tunnel or running owner computer is required.
- [ ] Published tutorial instructions use the actual public endpoint and clearly distinguish local setup. Verify all three pages and their navigation at the deployed address.
- [ ] Run the interface acceptance suite for validation, matching, bounds, normalization, source provenance, cache expiry, concurrent-instance limits, and partial/failed outcomes. Ensure ticker/name search uses the shared cache/request controls after tickets 02–04 are integrated.
- [ ] Verify actual SEC connectivity from the deployed runtime with ticker, company-name, and CIK queries. Do not infer deployment success from local tests or return controlled responses in place of live data.
- [ ] Follow the Tutorial using Windows PowerShell and Codex CLI: connect to the deployed endpoint, verify discovery of exactly one company-search tool, and ask for Apple's company profile with official source links.
- [ ] Record a genuine tool invocation returning Apple with CIK 0000320193, usable profile fields, official source URLs, and retrieval timestamps. Do not assert volatile filing counts or exact model wording.
- [ ] Stop the local development server and confirm the public website and MCP still work. Repeat the public lookup within the configured request budget.
- [ ] Deliver the actual website address, MCP address, local run/configuration instructions, and concise verification evidence. Disclose any remaining live-service or deployment blocker rather than marking this ticket complete prematurely.
