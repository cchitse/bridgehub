# Ticket 04 verification

Completed 2026-09-12 against baseline ab0d28e.

## Behavior

Successful SEC ticker directories are cached for 24 hours with their original retrieval timestamp. Expired cache entries refresh on demand; failed refreshes never return stale data. Profiles remain fetched on demand.

Production state uses Upstash Redis REST with atomic Lua operations and Redis server time. Ten searches are admitted per rolling minute across instances. SEC requests share five slots held through completion plus 1,001 milliseconds. A 45-second crash lease and a dispatch expiry check protect against delayed replies; cleanup failures retain the conservative lease. Waiting remains bounded by the 30-second lookup deadline.

Production searches fail closed when shared state is missing or unavailable. Website content and MCP discovery are independent of storage. Development has a documented single-process memory equivalent. No accounts, query history, or paid resources were introduced.

## Validation

- Strict application typecheck passed.
- Final full suite with `REDIS_TEST_URL=http://127.0.0.1:8079`: 70 passed, one intentional parent-process probe skip. The restart test explicitly executes that probe in a fresh process.
- Production build passed, including static page generation.
- MCP interface tests cover cache reuse and original timestamps, 24-hour expiry, failed refresh without stale fallback, concurrent admission, and unavailable production storage without extra SEC traffic.
- Real Redis tests execute the production Lua through a local REST adapter, exercise two HTTP MCP instances, and verify shared cache and search admission persist in a fresh process.
- Delaying the first five Redis SEC admission replies by 1,200 milliseconds reproduced ten actual SEC starts in one rolling second with the original design. The lease implementation passes the same regression with at most five starts.
- Memory contract tests cover the completion cooldown and abandoned lease expiry.
- SEC responses were controlled; no new live SEC or public Upstash verification is claimed.

## Reviews

Independent standards and specification reviewers both identified the delayed-admission timing gap. After the lease fix and regression coverage, both reported no remaining blockers or standards violations.

## Environment and deployment

Redis was installed in Ubuntu-24.04 WSL for local integration verification. `scripts/redis-rest-bridge.py` is a loopback-only development adapter, not a deployment service. Tests create unique expiring keys without flushing Redis.

README and `.env.example` document required production credentials, a stable shared namespace, non-evicting storage, and local testing. No cloud resource was provisioned. Public Upstash connectivity and provider costs must be verified during ticket 06 deployment.
