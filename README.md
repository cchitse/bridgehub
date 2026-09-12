<div align="center">
  <img src="docs/assets/bridgehub-icon.svg" alt="BridgeHub logo" width="88" height="88" />

  <h1>BridgeHub</h1>

  <p><strong>A bridge between your AI and public data.</strong></p>
  <p>Connect once. Ask about a company. Get structured data with sources you can follow.</p>

  <p>
    <a href="https://bridgehub-mvp.vercel.app">Visit BridgeHub</a> ·
    <a href="https://bridgehub-mvp.vercel.app/data">Explore the data</a> ·
    <a href="https://bridgehub-mvp.vercel.app/tutorial">Connection guide</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/MCP-Streamable_HTTP-183c36?style=flat-square" alt="MCP Streamable HTTP" />
    <img src="https://img.shields.io/badge/Source-SEC_EDGAR-24584a?style=flat-square" alt="Source: SEC EDGAR" />
    <img src="https://img.shields.io/badge/Built_with-TypeScript-3178c6?style=flat-square" alt="Built with TypeScript" />
  </p>
</div>

---

## Open data, closer to your workflow

BridgeHub connects AI applications to open data through a single **Model Context Protocol (MCP)** endpoint. It handles source-specific requests and data formats, giving your AI usable results with traceable origins.

This MVP starts with **US SEC Company Search**: one working tool for finding company profiles from SEC EDGAR. A Windows PowerShell walkthrough helps you connect it to Codex CLI.

### What you get

- **Flexible company search** — find companies by ticker, name, or SEC identifier (CIK).
- **Structured profiles** — retrieve company identity, industry classification, exchanges, and recent-filing counts.
- **Traceable results** — follow official SEC links and see when each source was retrieved.
- **Honest failure handling** — missing fields and incomplete results are identified explicitly.
- **Simple access** — no BridgeHub account, virtual key, or local server needed for the hosted endpoint.

## Connect in minutes

With [Codex CLI installed and signed in](https://learn.chatgpt.com/docs/codex/cli), run this in PowerShell:

```powershell
codex mcp add bridgehub --url https://bridgehub-mvp.vercel.app/api/mcp
codex
```

If you already configured a local BridgeHub endpoint, remove that entry with `codex mcp remove bridgehub` before adding the hosted one.

Inside Codex, enter `/mcp` to confirm the connection, then ask:

> Discover BridgeHub’s us_search_sec_company tool and use it to search AAPL. Summarize the company profile and include the official source URLs and retrieval times.

The public service runs independently of your computer. Codex has its own installation and sign-in requirements; BridgeHub does not require an end-user key.

**MCP endpoint**

```text
https://bridgehub-mvp.vercel.app/api/mcp
```

See the [full tutorial](https://bridgehub-mvp.vercel.app/tutorial) for local connections and troubleshooting.

## Supported data

| Source | Tool | Search by |
| --- | --- | --- |
| SEC EDGAR | `us_search_sec_company` | Ticker (`AAPL`), company name (`Apple Inc.`), or CIK (`320193`) |

The tool returns company profiles with official source URLs and UTC retrieval timestamps. Results are bounded to 20 companies per call, with a default of 10.

Ticker and name discovery is limited to SEC’s current ticker directory. CIK lookups access company submissions directly. Recent-filing counts describe the fetched recent filings array, not a company’s lifetime filing history.

The hosted demo shares a budget of **10 searches per minute across all users**. Its ticker directory is cached for 24 hours; company profiles are fetched on demand.

[View all fields and an illustrative response →](https://bridgehub-mvp.vercel.app/data)

## How it works

```text
Your question in Codex
        ↓
BridgeHub MCP endpoint
        ↓
SEC EDGAR company data
        ↓
Structured profile + source links + retrieval times
```

BridgeHub retrieves and normalizes data. Your AI application interprets the result and presents the answer.

## Run locally

Requires Node.js 22.14 or newer and npm. From the project folder:

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Set `SEC_CONTACT_EMAIL` in `.env.local` to your real operator contact email, then start the application:

```powershell
npm run dev
```

Open **http://127.0.0.1:3000**. The local MCP endpoint is `http://127.0.0.1:3000/api/mcp`. Keep the terminal running while using it. Local development uses in-memory state and does not require Redis.

## Built with

**Next.js · TypeScript · MCP SDK · Vercel · Upstash Redis**

One application serves the Home, Data, and Tutorial pages alongside the real MCP endpoint. Production uses shared caching and request limits across instances.

## Documentation

| Guide | What it covers |
| --- | --- |
| [Technical guide](docs/technical-guide.md) | Original README contents: setup, full tool contract, error handling, caching, and tests |
| [Deployment guide](docs/deployment.md) | Vercel configuration, environment variables, and publication workflow |
| [Verification evidence](docs/ticket-06-verification.md) | Public browser checks, acceptance tests, and a real Codex demonstration |
| [Product specification](SPEC.md) | MVP scope and design decisions |

## Scope

BridgeHub’s long-term direction is one connection to multiple open-data sources. **This version supports SEC company search only.** Financial metrics, full filing downloads, and additional sources are outside the current MVP.
