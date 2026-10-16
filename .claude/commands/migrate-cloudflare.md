---
description: Migrate this app from Vercel to Cloudflare Workers with zero downtime, and move suitable workloads off Supabase onto Cloudflare. Plan first, cut over last, rollback ready.
---
# Vercel → Cloudflare Migration (one app per session)

Run `/migrate-cloudflare` in each app repo.
Run order (owner, Oct 16 2026): **VarsityOS → AdminOS → True Access → K53 DrillMaster → CreativelyNanda → mirembemuse.co.za → StokvelOS → Sanyu → … → JarvisOS last** (headless Chrome, 776 routes). One app per session; Vercel stays live ≥14 days as rollback.

---

You are migrating this app from Vercel to **Cloudflare Workers (Workers Paid plan)** for Mirembe Muse (Pty) Ltd. Real users, real payments, POPIA-regulated data. **The live app must never break.** Vercel stays live until Cloudflare is proven in production and I approve shutdown.

Use the team in `.claude/agents/`. `scout` maps, `architect` plans, engineers build, `security-auditor` + `sre` + `performance-engineer` review, `qa-engineer` writes smoke tests, `verifier` checks, `scribe` documents.

## Ground rules
1. Branch `migrate/cloudflare`. Never touch `main` until cutover is approved.
2. **Verify every Cloudflare fact against current docs before using it** (developers.cloudflare.com, opennext.js.org/cloudflare). Pricing, limits, supported Next.js versions and APIs change. Cite the doc URL in the plan for each limit you rely on. Do not code from memory.
3. Use `wrangler` and a **scoped Cloudflare API token** (only the permissions needed: Workers Scripts, KV, R2, D1, Queues, DNS for this zone). Never the Global API Key. Never print tokens or secrets.
4. Secrets go in with `wrangler secret put` (or the API). Never in `wrangler.jsonc`, never committed.
5. **Stop and ask me before:** changing nameservers or DNS on a live domain, changing webhook URLs in Paystack/PayFast/360dialog/Xero, changing Supabase Auth redirect URLs, moving any user files, deleting anything on Vercel or Supabase.
6. Every phase ends with typecheck, lint, tests, build, and a written checkpoint in `docs/migration/`.

## Plan facts to confirm (don't assume)
- The **$5 Workers Paid plan** is not the Cloudflare **Pro plan** (a per-domain zone plan with WAF managed rules, image optimisation features, etc.). Report what's included in Workers Paid vs Pro vs Free for this app, and flag any feature I'd need to upgrade a zone to Pro to get. Recommend whether any domain justifies Pro.
- R2, Images, Workers AI, Queues, D1, Durable Objects and KV each have their own included usage and overage pricing. Estimate this app's monthly usage and cost.

---

## PHASE 0 — Inventory (scout, Haiku) → `docs/migration/00_inventory.md`
List everything Vercel currently does for this app:
- Next.js version, router, rendering modes per route (static, SSR, ISR, streaming), `runtime = 'edge'` declarations, middleware, `next/image` usage, `next.config` settings (headers, redirects, rewrites, images).
- `vercel.json`: crons, headers, redirects, regions, function durations.
- Vercel-only packages: `@vercel/analytics`, `@vercel/speed-insights`, `@vercel/og`, `@vercel/kv`, `@vercel/blob`, `@vercel/edge-config`, `@vercel/functions`.
- Node APIs used (`fs`, `child_process`, native modules, heavy libraries like `sharp`, `puppeteer`) — anything that may not run on Workers.
- Long-running work: API routes that can run longer than a typical request (AI generation, PDF, bulk WhatsApp sends, Xero sync).
- Env vars (names only) and which are public.
- External callbacks pointing at this domain: payment webhooks, WhatsApp webhook, OAuth/Supabase redirect URLs, Xero callback, Resend webhooks.
- DNS: current nameservers, all records — **especially MX, SPF, DKIM, DMARC and Resend records**. Email must not break.
- Current Supabase usage: Storage buckets and sizes, Edge Functions, pg_cron jobs, Realtime, and any table used as a cache, queue, counter or rate limiter.
- Upstash Redis usage (AdminOS): what each key pattern does.

## PHASE 1 — Plan (architect, Opus) → `docs/migration/01_plan.md`
Produce a mapping table: `Vercel/Supabase feature → Cloudflare equivalent → code change → risk → test`.

**Hosting**
- Next.js on Workers via the **OpenNext Cloudflare adapter** (`@opennextjs/cloudflare`). Confirm the installed Next.js version is supported; if Next 14 needs upgrading, plan that as a separate, tested step before migrating. Do not use the deprecated `next-on-pages`.
- Remove `export const runtime = 'edge'` where the adapter requires the Node.js runtime; enable `nodejs_compat`.
- Check the Worker bundle against the current size limit. If over, plan splitting or trimming.
- ISR / `revalidate` → OpenNext incremental cache on R2 (+ tag cache if `revalidateTag` is used).
- `next/image` → Cloudflare Images via the adapter's image loader, or a custom loader. Confirm the cost.
- Vite apps (K53 DrillMaster) → Workers Static Assets. No adapter needed.

**Vercel feature replacements**
| Vercel | Cloudflare |
|---|---|
| Vercel Cron | Cron Triggers on the Worker (convert to UTC, document SAST equivalent) |
| Analytics / Speed Insights | Cloudflare Web Analytics (cookie-free, POPIA-friendly) |
| Edge Config / KV | Workers KV |
| Blob | R2 |
| `@vercel/og` | Check compatibility; else `workers-og` or a prebuilt image |
| Long functions | Queues or Workflows |
| Preview deployments | Worker versions / preview URLs per branch |
| Env vars | `wrangler secret` + `vars` |

**Offload from Supabase → Cloudflare (only where it reduces cost, load or latency without weakening security)**
Keep in Supabase: **Postgres, Auth, RLS and anything that relies on RLS.** Do not migrate relational user data to D1; that would throw away the RLS security model.
Move or add:
- **Storage → R2** for user uploads, media and generated files (zero egress fees; matters a lot for watchSankofa video and AdminOS documents). Access through signed URLs or a Worker that checks the Supabase session and ownership before serving. Private by default.
- **Upstash Redis → Workers Rate Limiting binding / Durable Objects / KV** for rate limits, counters and per-tenant limits. Evaluate and recommend; keep Upstash only if something needs features Cloudflare lacks.
- **Caching → KV or Cache API** for public, read-heavy data (K53 question bank, public catalogues, AI responses that are safe to share). Never cache per-user private data in a shared key.
- **pg_cron / Vercel Cron → Cron Triggers** that enqueue work.
- **Background jobs → Queues**: WhatsApp reminder sends, email batches, AI batch submissions, Xero syncs. Retries and a dead-letter queue configured.
- **Multi-step, long-running processes → Workflows**: AdminOS debt-recovery escalation, monthly StokvelOS health reports, daily manager brief. Durable, resumable, idempotent.
- **Postgres connection → Hyperdrive** if the app connects to Postgres directly (pooling + lower latency from Workers). Not needed for calls that go through supabase-js over HTTP.
- **Bot protection → Turnstile** on sign-up, login, contact and OTP forms.
- **Edge security:** WAF custom rules and rate-limiting rules on auth, AI and webhook paths; security headers via the Worker or Transform Rules; SSL Full (strict); HSTS; Always Use HTTPS; Bot Fight Mode (check it doesn't block payment-provider webhooks).
- **AI gateway:** route Anthropic/OpenAI calls through **Cloudflare AI Gateway** for caching, rate limiting, logging and cost tracking per app. Keep existing model routing.
- **Email Routing** for inbound addresses only if the domain doesn't already have working mail. Never replace existing MX records without my approval.
- Only propose Workers AI, Vectorize or D1 where there's a concrete use in this app (e.g. Vectorize for search). No features for the sake of features.

For each offload: what moves, why (cost / speed / load), the data migration steps, how it's secured, and how to roll back.

**Cutover plan** — zero-downtime:
1. Deploy to the `*.workers.dev` URL (or a `staging.` subdomain). Full smoke test there.
2. Move the domain's DNS to Cloudflare (if not already), importing every existing record. Verify email records resolve identically before and after (`dig` comparison).
3. Lower TTLs 24h ahead.
4. Point the domain to the Worker. Monitor.
5. Update external callbacks (webhooks, OAuth redirects) — with my approval — **adding** new URLs before removing old ones where providers allow.
6. Keep Vercel deployment live and unchanged for at least 14 days as instant rollback.
7. Rollback = repoint DNS/route to Vercel. Write the exact steps and time it.

**Then show me the plan, the cost estimate, and the decisions you need from me. Wait for approval.**

## PHASE 2 — Build (engineers, Sonnet)
- Add OpenNext + `wrangler.jsonc` with all bindings (R2, KV, Queues, Workflows, Hyperdrive, Images, AI Gateway, rate limiter, crons), `nodejs_compat`, observability/logs enabled.
- Typed bindings (`wrangler types`); access env via the adapter's `getCloudflareContext()`. No `process.env` assumptions that break on Workers.
- Replace Vercel packages per the plan. Remove unused Vercel deps.
- Move cron handlers into the Worker's `scheduled` handler → enqueue to Queues → consumers do the work.
- Build R2 upload/download through presigned URLs or an authenticated Worker route with ownership checks and content-type/size validation.
- Add Turnstile to public forms, verified server-side.
- Scripts: `preview` (local Workers runtime), `deploy:staging`, `deploy:prod`, `cf-typegen`.
- Local dev must run in the Workers runtime (`opennextjs-cloudflare preview` / `wrangler dev`), not only `next dev`, before anything is called working.

## PHASE 3 — Data moves (backend-engineer + sre)
- Supabase Storage → R2: script that copies objects with checksums, writes a manifest, is resumable and idempotent. Dry run first. Dual-read period (try R2, fall back to Supabase) until counts and checksums match 100%. Never delete Supabase objects — that's my call after verification.
- Redis → Cloudflare limiter/KV: run both in parallel briefly and compare decisions before switching.

## PHASE 4 — Test & review (qa, security, perf, ux in parallel) → `docs/migration/04_validation.md`
Against the staging Worker URL, prove:
- Every route returns the same status and content as Vercel (automated crawl/diff of all pages and API routes).
- Auth: sign up, login, logout, password reset, OAuth redirect.
- Payments: Paystack/PayFast test-mode payment end to end, webhook received, signature verified, access granted; duplicate and forged webhook rejected.
- Cron/Queues/Workflows: trigger each manually; confirm correct time zone, retries, dead-letter, idempotency.
- R2: upload, download, access denied for another user's file, oversized/wrong-type rejected.
- AI: streaming works on Workers; AI Gateway logs show calls; limits enforced.
- WhatsApp webhook (AdminOS), Xero callback.
- ISR/revalidation works; images load and are optimised.
- Turnstile blocks bots, doesn't block real users.
- Security headers, HTTPS, WAF rules don't block legitimate webhooks.
- Performance: Lighthouse mobile and TTFB from South Africa vs current Vercel numbers. Cloudflare should be equal or better; explain any regression.
- Email: MX/SPF/DKIM/DMARC identical to before.
- 360px / 1280px screenshots of core screens.

`security-auditor` reviews bindings, secret handling, R2 access and WAF config. `verifier` signs off.

## PHASE 5 — Cutover (only after my "go")
Follow the cutover plan. Run the smoke suite against the production domain immediately after. Watch Workers logs and error rates for 1 hour, then 24 hours. Report.

## PHASE 6 — Close out
- `docs/migration/RUNBOOK.md`: how to deploy, roll back, rotate secrets, read logs, add a cron/queue job, and the monthly cost dashboard to check.
- Update `CLAUDE.md` stack section: Cloudflare Workers via OpenNext, bindings list, deploy commands.
- Update `.claude/settings.json` deny list: `wrangler deploy --env production`, `wrangler r2 object delete`, `wrangler kv namespace delete`, `wrangler d1 delete`, DNS deletes.
- After 14 stable days and my approval: list exactly what to remove from Vercel and Supabase (Storage, Edge Functions, pg_cron, Upstash). Don't remove it yourself.
- `scribe`: proof doc, CHANGELOG, and a BUILD_JOURNEY entry on why we moved and what it saved.

## Definition of Done
App serves production traffic from Cloudflare. All smoke tests pass on the live domain. Payments, webhooks, auth, crons and email verified. No Critical/High findings. Performance equal or better than Vercel. Rollback tested and documented. Vercel still available as fallback.
