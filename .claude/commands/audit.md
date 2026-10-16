---
description: Full audit — AI model routing, security, performance, reliability, a11y, hygiene, Play + AppGallery readiness. Report first, then remediate on approval.
---
Use the agents in .claude/agents for each phase: scout (Phase 0), ai-engineer (1), security-auditor, performance-engineer, sre, ux-reviewer (2), code-janitor (3), mobile-release-engineer + compliance-officer (4), verifier + scribe (6).

You are the lead engineer auditing this repository for Mirembe Muse (Pty) Ltd, a South African company. This app serves real SA users (students, SMEs, stokvels, creators), takes payments in ZAR, and processes personal information under POPIA. Treat it as production software.

## OPERATING RULES (non-negotiable)
1. Create branch `audit/<YYYY-MM-DD>` before touching anything. Never commit to main.
2. **Report first, change second.** Phases 1–5 are read-only. Write findings to `/audit/`. Stop and wait for my approval before Phase 6 (changes).
3. **Nothing is deleted outright.** Files flagged for removal move to `/audit/_quarantine/` with a manifest listing path, reason, and how you confirmed it's unused (grep results, import graph, build still passes).
4. Every finding must have: severity (Critical / High / Medium / Low), file + line, evidence, concrete fix, effort (S/M/L). No finding without evidence. No generic advice ("consider improving security").
5. Every subagent gets a precise scope, a token budget, and a required output file. If a subagent finds nothing in its scope, it writes "No findings" and stops. No exploratory wandering.
6. Do not invent requirements. If something can't be verified from the code (e.g. a dashboard setting in Supabase, Play Console, Paystack), list it under "Manual checks for Nanda".
7. Never print or commit secrets. If you find one, report its location and type only, and mark it Critical: rotate.

## SUBAGENT MODEL ALLOCATION
- **Haiku** — mechanical scanners: dead code, unused deps, file inventory, lint/type output parsing, asset sizes, env var listing, manifest checks.
- **Sonnet** — specialists that need judgement: security review, performance, AI agent audit, store readiness, refactor proposals.
- **Opus** — only you, the orchestrator: final synthesis, severity ranking, and the remediation plan. Do not spawn Opus subagents.
Run independent subagents in parallel. Pass each one only the file paths it needs, not the whole repo.

---

## PHASE 0 — Map (Haiku, ~5 min)
Produce `/audit/00_map.md`: stack and versions, folder structure, all routes/API endpoints, all env vars referenced (names only), all third-party services (Supabase, Paystack/PayFast, Anthropic/OpenAI, Resend, Upstash, 360dialog, Xero), cron jobs, and whether a mobile wrapper exists (Expo / Capacitor / TWA / none). Every later phase reads this instead of re-scanning.

## PHASE 1 — AI Agent Audit & Model Routing (Sonnet)
Find every LLM call in the codebase. For each one, record in `/audit/01_ai_agents.md`:
| Agent / call site | Purpose | Current model | Avg input/output tokens (estimate from prompt) | Frequency (per user action / cron / per message) | User-facing? | Needs reasoning? | Recommended model | Caching? | Batchable? | Est. monthly cost now vs after |

Routing rules to apply:
- **Haiku tier (worker):** classification, intent detection, crisis-keyword pre-screen, extraction, summarising short text, formatting, WhatsApp reminder wording, tagging, data cleanup, JSON shaping.
- **Sonnet tier (intelligence):** user-facing conversation (Nova, AdminOS inbox replies), budget coaching, study plans, meeting minutes, document intelligence, anything where quality is the product.
- **Opus tier:** only rare, high-stakes, low-volume analysis (e.g. monthly fraud pattern review across a stokvel, if that justifies it). Default: none.
- **Router pattern:** a cheap Haiku call classifies the request, then routes to Sonnet only when needed. Propose this where one agent currently does everything.
- **Prompt caching** on every system prompt over ~1k tokens that repeats.
- **Batch API** (50% cheaper) for anything non-real-time: daily briefs, monthly health reports, scheduled insights, debt-recovery drafts.
- **Hard caps:** max_tokens set on every call, per-user/per-tenant rate limits, free-tier message limits enforced server-side, not client-side.
- **Crisis safety:** crisis detection must never be downgraded or skipped to save cost. Pre-screen with Haiku, but any positive or ambiguous result surfaces SADAG/Lifeline and escalates.
- Flag any model string that's deprecated or hardcoded in multiple places. Propose one central `lib/ai/models.ts` config so models can be swapped in one line.
- Flag mixed providers (e.g. StokvelOS on GPT-4o-mini) and give a cost/quality recommendation, don't just force a switch.
- Check: errors and timeouts handled, retries with backoff, user sees a graceful fallback, token usage logged per tenant/user so we can see real cost.

## PHASE 2 — Specialist Team (run in parallel)
Each writes its own file. Scope is fixed. Only checks that matter for a payments-taking, POPIA-regulated SA app at scale.

### 2a. Security (Sonnet) → `/audit/02a_security.md`
- Supabase: RLS enabled on **every** table; policies actually restrict by `auth.uid()` / tenant_id; no `service_role` key reachable from client code; storage bucket policies.
- Multi-tenant isolation (AdminOS, StokvelOS): attempt to reason through whether tenant A can read tenant B via any API route.
- AuthN/AuthZ on every API route and server action; no route trusts a client-sent user_id or role.
- Payment webhooks (Paystack/PayFast): signature verification, idempotency, amount + currency verified server-side, subscription status never set by client.
- Secrets: hardcoded keys, `.env` files committed, keys in git history (`git log -p` search for key patterns), `NEXT_PUBLIC_` vars that shouldn't be public.
- Input validation (Zod) on all API inputs; SQL/RPC injection; XSS via `dangerouslySetInnerHTML` or rendered AI output.
- **Prompt injection:** can user input or uploaded documents make an agent leak its system prompt, other users' data, or call tools it shouldn't? Check AdminOS WhatsApp inbox and document agent especially.
- Security headers (CSP, HSTS, X-Frame-Options), CORS config, rate limiting on auth and AI endpoints.
- `npm audit` — report only High/Critical with exploitable paths, not noise.
- POPIA: what personal info is collected, is there a privacy policy, can users export/delete their data, is health/wellbeing data (VarsityOS, AdminOS wellness) treated as special personal information.

### 2b. Performance (Sonnet) → `/audit/02b_performance.md`
SA context: many users on mid-range Android, prepaid data, unstable connections, load-shedding.
- Build the app; report bundle size per route, largest dependencies, client components that could be server components.
- Images: unoptimised, missing `next/image`, oversized assets.
- Data fetching: N+1 queries, missing Supabase indexes on filtered/joined columns, unbounded selects (no pagination/limit), waterfalls.
- Lighthouse (mobile, throttled 3G) on the top 5 routes: report LCP, INP, CLS, TBT with the specific cause of each failure.
- PWA/offline: does the app degrade gracefully offline; are writes queued or lost.
- AI latency: streaming used for chat; long calls not blocking UI.
- Cold starts on Vercel functions/edge; cron job duration vs limits.

### 2c. Reliability & Troubleshooting (Sonnet) → `/audit/02c_reliability.md`
- Run `tsc --noEmit`, lint, existing tests, and a production build. Report every failure.
- Error handling: unhandled promise rejections, missing error boundaries, API routes that return 200 on failure, silent catch blocks.
- Critical user journeys — trace each end-to-end in code and list where it can break: sign up → onboard → core feature → upgrade/pay → webhook → access granted → cancel. Plus app-specific ones (NSFAS budget entry, stokvel contribution recorded, WhatsApp message received → agent reply).
- Observability: is there error tracking (Sentry or similar)? Are failures logged with enough context to debug? Recommend the minimum setup if missing.
- Race conditions on payments and contributions; timezone bugs (SAST vs UTC in cron).
- Write the **5 highest-value tests** this app is missing (payment webhook, RLS isolation, crisis detection trigger, auth guard, one core journey). Propose them; write them in Phase 6.

### 2d. Accessibility & Device Coverage (Haiku scan + Sonnet review) → `/audit/02d_a11y.md`
WCAG 2.2 AA basics: contrast, labels, focus states, touch targets ≥ 48dp, screen-reader names, font scaling. Small-screen (360px) layout breakage. Brief, top issues only.

## PHASE 3 — Hygiene & Simplification (Haiku scan → Sonnet decides) → `/audit/03_hygiene.md`
Haiku produces raw candidate lists; Sonnet confirms each before it goes into the report.
- **Hazardous files:** committed `.env*`, keys, `.pem`, database dumps, logs containing user data, `node_modules` or build output in git, large binaries, files with real personal data used as test fixtures.
- **Junk:** unused files/components/routes (confirm via import graph + grep + build), unused dependencies (`depcheck`/`knip`), duplicate utilities, commented-out code blocks, stale TODOs older than 3 months, orphaned migrations, empty folders, leftover boilerplate.
- **Flows to simplify:** duplicated logic across agents, over-abstracted wrappers with one caller, client-side state that should be server state, multiple ways of doing the same thing (two fetch helpers, two date libs). Propose the simpler version — only where it reduces code and risk. No rewrites for taste.
- `.gitignore` gaps; README accuracy; scripts in `package.json` that don't work.
- Recommend Git history cleanup (BFG/filter-repo) only if a secret was ever committed, and note the key must be rotated regardless.

## PHASE 4 — Google Play & Huawei AppGallery Readiness (Sonnet) → `/audit/04_store_readiness.md`
We publish via **Expo / EAS**. First determine from Phase 0 how this app becomes a mobile app (native Expo app, Expo WebView wrapper, or not yet set up) and say plainly what's missing.

**Build config (verify against current official docs, policies change):**
- `app.json`/`app.config.ts`: unique `android.package`, `versionCode` incrementing, version name, app name, adaptive icon (foreground + background), splash, permissions — only those actually used, with justification for each.
- Target SDK meets Google Play's current required API level; Expo SDK version supports it.
- 16 KB page size support for any native libraries.
- `eas.json`: `production` profile building AAB for Play; separate `huawei` profile building APK (or AAB if AppGallery accepts) with no Google Play Services dependency.
- Signing: EAS-managed keystore; Play App Signing enrolled.
- No debug flags, no dev URLs, no console logs with user data in release.

**Google Play policy:**
- **Payments (highest risk):** digital subscriptions sold inside the app (VarsityOS Pro, AdminOS tiers, K53 premium) generally must use Google Play Billing. Check whether the app opens Paystack/PayFast for digital goods inside the Android app. Report the exact flows that are at risk and the compliant options (Play Billing, or web-only purchase with no in-app purchase links where policy allows, or physical goods/B2B services exemptions where they genuinely apply). Do not guess — mark for manual verification against current Play Payments policy.
- Data safety form: produce a filled draft from what the code actually collects and shares (Supabase, Anthropic, Resend, analytics).
- Privacy policy URL live and matching actual collection.
- **Account deletion:** in-app deletion path AND a web URL for deletion requests. Required for apps with accounts.
- AI-generated content policy: in-app way to report/flag offensive AI output (Nova, recipe generator, AdminOS agents).
- Health/mental-health features (Nova crisis support, wellness check-ins): check health-app declarations and that the app doesn't present as medical treatment.
- Target audience: VarsityOS / K53 may reach users under 18 — check Families policy implications and declare age honestly.
- Content rating questionnaire answers draft.
- Testing track: if the developer account is a personal account, new apps need a closed test with the required number of testers for the required days before production. Recommend an organisation account under Mirembe Muse (Pty) Ltd (needs D-U-N-S) if not already.

**Huawei AppGallery:**
- No Google Mobile Services: Expo push notifications via FCM won't work on Huawei devices — flag every GMS dependency (FCM, Google Sign-In, Maps, Play Billing, SafetyNet/Play Integrity) and the fallback (HMS Push Kit, email/OTP login, web maps, HMS IAP or web payment).
- Test install on a GMS-free emulator/device.
- AppGallery privacy statement, age rating, app category, copyright/ownership docs for the company.

**Store listing assets checklist:** icon 512×512, feature graphic 1024×500, phone screenshots (min 2, recommend 6–8), short (80 char) and full (4000 char) descriptions, support email, website. Draft the short + full description in the Mirembe Muse voice for this app.

Output a **Go / No-Go table** per store with blocker list.

## PHASE 5 — Synthesis (Opus, you) → `/audit/REPORT.md`
- One-paragraph health summary.
- Top 10 issues across all phases, ranked by (severity × user/revenue impact) ÷ effort.
- AI cost table: current est. monthly spend vs post-routing spend at 100 / 1,000 / 10,000 users.
- Remediation plan in three batches: **Fix now** (Critical/security/payments/store blockers), **This sprint**, **Backlog**.
- "Manual checks for Nanda" — dashboard settings, console declarations, accounts, legal docs.
- Then **STOP and wait for my approval**.

## PHASE 6 — Remediation (after approval only)
- One commit per fix, conventional commit messages, each referencing its finding ID.
- After every batch: type-check, lint, tests, production build. If anything breaks, revert that commit and report.
- Implement: central model config + routing, caching, batch jobs, the 5 missing tests, quarantine moves, security fixes, store config changes.
- Final: append a section to `BUILD_JOURNEY.md` — what the audit found, what changed, cost savings, in plain language I can turn into content.

## DEFINITION OF DONE
Build passes. Tests pass. No Critical or High security findings open. RLS verified on every table. AI calls routed through central config with caps and logging. Store readiness table is Go or every blocker has an owner. `/audit/` committed (minus `_quarantine`, which I review and delete myself).
