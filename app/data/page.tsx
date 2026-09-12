import Link from "next/link";
import { SiteFrame } from "../site-frame";

export const metadata = { title: "Data | BridgeHub" };
const fields = [
  ["cik", "string", "Ten-digit SEC company identifier, including leading zeros."],
  ["ticker", "string[]", "Reported trading symbols. An empty array means unavailable."],
  ["name", "string | null", "Company name reported in the submissions data."],
  ["sic", "string | null", "Standard Industrial Classification code, preserved as a string."],
  ["sic_description", "string | null", "SEC’s description of the industry classification."],
  ["exchange", "string[]", "Reported exchanges; no one-to-one mapping to ticker entries is implied."],
  ["fiscal_year_end", "string | null", "Source month/day value (MMDD), such as 0930."],
  ["state_of_incorporation", "string | null", "Source incorporation code, such as CA."],
  ["recent_filings_count", "number | null", "Length of the fetched recent accession-number array. Not a lifetime total or a fixed calendar-period count. Null if the array is missing or invalid."],
  ["source_url", "string", "Official SEC submissions URL for this profile."],
  ["retrieved_at", "string", "UTC ISO-8601 time when BridgeHub fetched this profile, not SEC’s last update time."],
];
const example = {
  query: "AAPL", limit: 10, outcome: "ok", results: [{
    cik: "0000320193", ticker: ["AAPL"], name: "Apple Inc.", sic: "3571",
    sic_description: "Electronic Computers", exchange: ["Nasdaq"], fiscal_year_end: "0930",
    state_of_incorporation: "CA", recent_filings_count: 1000,
    source_url: "https://data.sec.gov/submissions/CIK0000320193.json", retrieved_at: "2026-01-15T12:00:00.000Z",
  }], truncated: false, directory_source: {
    source_url: "https://www.sec.gov/files/company_tickers.json", retrieved_at: "2026-01-15T11:00:00.000Z",
  },
};

export default function Data() {
  return <SiteFrame current="Data">
    <div className="page-heading"><p className="eyebrow">THE DATA CATALOG / 01 SOURCE</p><h1>US SEC Company Search</h1><p className="lede">Find a company. Understand its profile. Follow the information back to SEC EDGAR.</p><span className="badge">MCP tool · <code>us_search_sec_company</code></span></div>
    <section className="content-section"><h2>What you can ask</h2><div className="two-column"><div><h3>Query</h3><p>Required string. Whitespace is trimmed; the resulting string must contain 1–200 characters. Use an exact ticker (<code>AAPL</code>), a company-name substring (<code>apple</code>), or a CIK (<code>320193</code>, <code>0000320193</code>, <code>CIK0000320193</code>).</p><p>CIKs contain 1–10 digits and must be greater than zero. The optional CIK prefix is case-insensitive. Malformed explicit CIKs are rejected; the bare symbol <code>CIK</code> is treated as a ticker.</p></div><div><h3>Result limit</h3><p>Optional integer from 1–20; default 10. Invalid values are rejected. Matches are deduplicated by CIK, sorted by company name then CIK, and limited before profiles are retrieved.</p><p>Exact ticker matches take priority. Otherwise, names are matched by substring. Both are case-insensitive. CIK lookup goes directly to the submissions source.</p></div></div><pre aria-label="Example tool arguments"><code>{'{ "query": "AAPL", "limit": 10 }'}</code></pre></section>
    <section className="content-section"><h2>Coverage and freshness</h2><p>Ticker and name search covers SEC’s current ticker directory. It is not an exhaustive search of historical filers or former company names. CIK lookup can retrieve a company outside that directory.</p><p>The directory is cached for 24 hours and keeps its original retrieval time. Expired data is refreshed on demand; failed refreshes do not silently return stale data. Company profiles are fetched on demand.</p><p>This tool returns company metadata and source links. It does not extract financial metrics, download filings, or count a company’s entire filing history.</p></section>
    <section className="content-section"><h2>Company profile fields</h2><p>Missing scalar attributes are <code>null</code>; unavailable ticker and exchange collections are empty arrays. Missing values are never inferred.</p><table><caption className="small muted">Fields in each entry of the results array</caption><thead><tr><th scope="col">Field</th><th scope="col">Type</th><th scope="col">Meaning</th></tr></thead><tbody>{fields.map(([name,type,meaning]) => <tr key={name}><th scope="row"><code>{name}</code></th><td><code>{type}</code></td><td>{meaning}</td></tr>)}</tbody></table></section>
    <section className="content-section"><h2>Reading the response</h2><p>The envelope includes <code>query</code> (trimmed string), <code>limit</code> (integer), <code>outcome</code> (string), <code>results</code> (profile array), and <code>truncated</code> (boolean). Truncation means additional matches were omitted by the result limit; it is separate from retrieval failures. Pagination is not included.</p><p>Directory-based searches also return <code>directory_source</code>, an object containing <code>source_url</code> and the original <code>retrieved_at</code>, both strings. Direct CIK lookups do not need directory provenance.</p><ul><li><code>ok</code>: selected profiles were retrieved.</li><li><code>no_matches</code>: no directory match, or a direct CIK lookup returned SEC not found.</li><li><code>partial</code>: some profiles succeeded; <code>warnings</code> (string array) and <code>failures</code> (object array) identify incompleteness.</li><li><code>error</code>: discovery or all selected profile retrievals failed. An <code>error</code> object explains the failure and MCP marks the call as failed.</li></ul><p>Errors include <code>category</code> and <code>message</code> strings and a <code>retryable</code> boolean. Each failure also includes its CIK string. Retryable means a later attempt may help; BridgeHub does not retry automatically. SDK argument-validation failures may use MCP’s own error format.</p><p>The result is returned as structured MCP content and equivalent JSON text. SEC errors, blocking, or timeouts are never reported as “no matches.”</p></section>
    <section className="content-section"><h2>Illustrative response</h2><div className="notice"><strong>Example only — not live data.</strong><p>All values below illustrate the response format. The timestamps and filing count are illustrative and must not be treated as current SEC information.</p></div><pre aria-label="Illustrative company-search response"><code>{JSON.stringify(example,null,2)}</code></pre></section>
    <section className="content-section"><h2>Follow the source</h2><p>Source attribution: SEC EDGAR. Retrieval timestamps tell you when BridgeHub fetched the data, not when the SEC last changed it.</p><ul className="link-list"><li><a href="https://www.sec.gov/files/company_tickers.json">Official SEC ticker directory</a></li><li><a href="https://data.sec.gov/submissions/CIK0000320193.json">Official Apple submissions data</a> · profile URLs use a ten-digit CIK.</li><li><a href="https://www.sec.gov/search-filings/edgar-application-programming-interfaces">SEC EDGAR API documentation</a></li></ul><Link className="button" href="/tutorial">Connect this tool <span aria-hidden="true">↗</span></Link></section>
  </SiteFrame>;
}
