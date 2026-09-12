# 05 — Complete the three-page website and tutorial

**What to build:** Let visitors understand BridgeHub and its SEC company-search capability through one simple English website, then follow a Windows PowerShell tutorial to connect Codex CLI to the service. Keep the website informational with clickable navigation only.

**Blocked by:** 01 — Retrieve a company profile through MCP.

**Status:** ready-for-agent

- [ ] One website provides Home, Data, and Tutorial as three directly loadable pages with shared clickable navigation, visible keyboard focus, and readable desktop/narrow-screen layouts.
- [ ] Home explains BridgeHub, current SEC support, and the connect/ask/retrieve workflow. Future multi-source ambitions are clearly distinct from delivered functionality.
- [ ] Data describes the one company-search tool, input rules, output fields and types, directory coverage limits, source provenance, and recent-filings-count semantics. Include official source links and a clearly labeled illustrative response.
- [ ] Tutorial covers Codex prerequisites and sign-in, Windows PowerShell connection setup, local versus public endpoint addresses, connection verification, an AAPL prompt, and short troubleshooting guidance.
- [ ] Explain that BridgeHub needs no end-user account/key, while Codex has its own prerequisites. Local instructions make clear that the development server must be running.
- [ ] Content and examples follow the complete specification without adding a search form, chat, dashboard, live preview, extra source, or second tool.
- [ ] Verify browser navigation, direct page loading, English content, links, keyboard usability, example labeling, and readability. Avoid brittle pixel or text snapshots for simple static content.
- [ ] Verify the local Codex connection against the working endpoint. Before ticket 02 lands, the local walkthrough may use Apple's CIK to validate retrieval; ticket 06 verifies the published AAPL walkthrough against the final tool.
- [ ] Public endpoint text is supplied from deployment configuration and is not presented as working before publication. Ticket 06 supplies the actual address and verifies the deployed instructions.
- [ ] Static pages render even when SEC or shared storage is unavailable. No live backend data is required merely to read the website.

