# Vercel deployment

Status: published and verified September 12, 2026. Project `chitse/bridgehub-mvp` uses Node.js 24.x and the Next.js preset. The account-owned Upstash Free database `bridgehub-redis` is connected to Production with eviction, paid auto-upgrades, and Prod Pack disabled.

- Website: https://bridgehub-mvp.vercel.app
- MCP: https://bridgehub-mvp.vercel.app/api/mcp
- Verification: [ticket 06 evidence](ticket-06-verification.md)

## Account access

From PowerShell in the project folder, run `npx vercel login` and complete the browser sign-in yourself. The CLI retains the login locally; never paste a password or token into chat or commit it. After sign-in, `npx vercel whoami` identifies the account available for deployment. Linking and deploying this folder does not require a Git remote.

## Hosting and storage

Use one Vercel project with the Next.js framework preset, Node.js 24.x, install command `npm ci`, and build command `npm run build`. Build/install commands are recorded in `vercel.json`. The MCP route declares a 60-second platform budget so its 30-second application deadline can return a useful outcome.

Target the Vercel Hobby plan for this personal student demo and an account-owned Upstash Free Redis database. Verify the selected plans before provisioning; do not select Pro, pay-as-you-go, or paid add-ons without owner approval. Upstash currently documents 256 MB and 500,000 commands/month for Free. SEC slot polling also uses Redis commands, so ten searches/minute is not a guarantee of staying inside monthly allowances. Use a dedicated database with eviction disabled to preserve request-limit state.

References checked September 12, 2026: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Upstash pricing](https://upstash.com/pricing/redis), [Vercel CLI login](https://vercel.com/docs/cli/login), and [function duration](https://vercel.com/docs/functions/configuring-functions/duration).

## Production environment

Set these in the Vercel project's Production environment. Local `.env.local` is not a deployment configuration source and is excluded from uploads.

| Variable | Value |
| --- | --- |
| `SEC_CONTACT_EMAIL` | Owner's already configured real operator contact; sent to SEC in the User-Agent |
| `UPSTASH_REDIS_REST_URL` | Database HTTPS REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Database read/write REST token; keep secret and server-side |
| `BRIDGEHUB_STATE_NAMESPACE` | Stable deployment namespace, such as `bridgehub:production:v1`; never vary by instance/build |
| `BRIDGEHUB_ORIGIN` | Actual canonical HTTPS website origin, without `/api/mcp` |
| `BRIDGEHUB_PUBLIC_ORIGIN` | Same origin, set only after the public MCP is verified; rebuild to publish tutorial commands |

The project source upload excludes environment files, planning documents, and local tooling. Configure secrets through Vercel environment settings or protected CLI input, not command arguments or committed files.

## Publication sequence

1. Verify account/team and link this folder to one Next.js project. Select its actual canonical production hostname; do not invent an available hostname.
2. Configure the database and production variables, initially leaving `BRIDGEHUB_PUBLIC_ORIGIN` empty. Set `BRIDGEHUB_ORIGIN` to the actual canonical production origin.
3. Deploy with `npx vercel --prod`. Configure the production domain to be accessible anonymously. Preview deployments may remain protected. Do not use a protection bypass token as evidence of public access.
4. Verify anonymous MCP discovery and real SEC ticker, name, and CIK retrieval from the canonical public domain. Confirm directory provenance is reused across successive ticker/name calls. Leave the tutorial unpublished if this fails.
5. Set `BRIDGEHUB_PUBLIC_ORIGIN` to the verified origin, redeploy, and inspect Home, Data, and Tutorial at that address. The tutorial must show its real connection command.
6. Connect Codex CLI to the public endpoint and capture an actual AAPL tool invocation with CIK `0000320193`, official URLs, and retrieval timestamps.
7. Stop the owner's local server and repeat public page and MCP checks within the shared request budget. Record URLs and evidence in the ticket verification note before marking ticket 06 complete.

## Verification commands

Run `npm run typecheck`, the full interface suite with the local Redis integration adapter enabled, and `npm run build` before publication. The existing live checker uses a real MCP client and rejects failed calls. For each of `AAPL`, `Apple Inc.`, and `320193`, set `MCP_QUERY` and run it against the actual public `/api/mcp` URL supplied through `MCP_URL`. Separate live SEC checks from deterministic failure fixtures; never substitute fixture data in production.

Public SEC access can differ from localhost access. If the deployed runtime is blocked, record that deployment blocker and resolve it before claiming a working demo. Missing Redis must continue to return `service_unavailable` while static pages stay readable.
