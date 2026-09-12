import Link from "next/link";
import { SiteFrame } from "./site-frame";

export default function Home() {
  return <SiteFrame current="Home">
    <section className="hero">
      <div><p className="eyebrow">OPEN DATA, WITH A SOURCE</p><h1>A bridge between<br />your AI and<br /><em>public data.</em></h1>
        <p className="lede">Connect once. Ask about a company. Get a usable SEC profile with sources you can follow.</p>
        <div className="actions"><Link className="button" href="/tutorial">Connect with Codex <span aria-hidden="true">↗</span></Link><Link className="text-link" href="/data">Explore the data <span aria-hidden="true">→</span></Link></div>
        <p className="small muted">No BridgeHub account or key required.</p>
      </div>
      <aside className="flow-card" aria-label="How BridgeHub connects your AI to SEC data">
        <p className="eyebrow">ONE CONNECTION</p><div className="flow-node"><span className="node-icon" aria-hidden="true">01</span><div><strong>Your AI application</strong><span>Codex CLI walkthrough included</span></div></div>
        <div className="flow-line" aria-hidden="true">↓</div>
        <div className="flow-node featured"><span className="node-icon" aria-hidden="true">B</span><div><strong>BridgeHub MCP</strong><span>Resolve · retrieve · normalize</span></div></div>
        <div className="flow-line" aria-hidden="true">↓</div>
        <div className="flow-node"><span className="node-icon" aria-hidden="true">02</span><div><strong>SEC EDGAR</strong><span>Company metadata + source links</span></div></div>
        <p className="small">MCP is the connection that lets your AI application call BridgeHub’s data tool.</p>
      </aside>
    </section>
    <section className="section"><div className="section-heading"><div><p className="eyebrow">FROM QUESTION TO SOURCE</p><h2>Three steps. A traceable answer.</h2></div></div>
      <div className="steps-grid">{[
        ["01", "Connect", "Add BridgeHub’s MCP endpoint to Codex CLI using the tutorial."],
        ["02", "Ask", "Search by a ticker, company name, or SEC company identifier (CIK)."],
        ["03", "Retrieve", "Get structured company data with official URLs and retrieval times."],
      ].map(([number, title, body]) => <article className="step-card" key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>
    <section className="source-banner"><div><p className="eyebrow">AVAILABLE IN THIS MVP</p><h2>US SEC Company Search</h2><p>One working tool for company profiles from SEC EDGAR. Built for checking company identity and tracing the information back to its source.</p><Link className="text-link" href="/data">View coverage and fields <span aria-hidden="true">→</span></Link></div><div className="future-note"><strong>Starting with SEC.</strong><p>The longer-term idea is one connection to multiple open-data sources. This version supports SEC company search only.</p></div></section>
  </SiteFrame>;
}
