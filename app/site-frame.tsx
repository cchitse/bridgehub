import Link from "next/link";
import type { ReactNode } from "react";

export function SiteFrame({ current, children }: { current: "Home" | "Data" | "Tutorial"; children: ReactNode }) {
  return <>
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="BridgeHub home"><span className="brand-mark" aria-hidden="true">B</span>BridgeHub</Link>
      <nav aria-label="Main navigation">
        {([['Home', '/'], ['Data', '/data'], ['Tutorial', '/tutorial']] as const).map(([label, href]) =>
          <Link key={href} href={href} aria-current={current === label ? "page" : undefined}>{label}</Link>)}
      </nav>
    </header>
    <main id="content" tabIndex={-1}>{children}</main>
    <footer className="site-footer"><span>BridgeHub <span className="muted">/ Open data, connected.</span></span><span>One source. One MCP endpoint.</span></footer>
  </>;
}
