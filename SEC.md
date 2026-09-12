## Search US Sec Company

Keywords: SEC EDGAR 美股 上市公司 公司搜尋 ticker CIK 代號 10-K 10-Q 8-K XBRL company filing quarterly annual US stocks NYSE NASDAQ Apple Microsoft TSMC

Scope: US public companies filing with the SEC (EDGAR).

Resolve a ticker / company name / CIK to matching SEC filers, then pull each one's submissions profile (name · SIC · exchange · fiscal year end · recent filings count).

Endpoints: https://www.sec.gov/files/company_tickers.json (ticker resolver, cached 24h) https://data.sec.gov/submissions/CIK{cik10}.json (profile per hit)

Args: query: ticker ("AAPL"), company name substring ("apple"), or CIK ("0000320193" / "320193" / "CIK0000320193"). Ticker matches case-insensitive exact; name matches case-insensitive substring. limit: max hits to return (default 10, hard cap 20).

Returns dict with results — each row has cik, ticker, name, sic, sic_description, exchange, fiscal_year_end, state_of_incorporation, recent_filings_count. License is "US Public Domain (17 USC §105)". Rate-limited to 10 req/sec.