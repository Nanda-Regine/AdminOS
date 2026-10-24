# AdminOS security + privacy readiness review (2026-10-24, read-only)

Scope: web (www.adminos.co.za, still served via Vercel behind Cloudflare), Expo app, repo history. Prior work (Phase-0 RLS, roleMatrix/withRoute, authz-matrix, SECURITY_AUDIT_REPORT.md) not redone. Items I could not confirm are marked UNVERIFIED.

## Verdict
Technically strong: tenant isolation, webhook verification, deletion flow and secrets hygiene are good. NOT store/bank-ready until the privacy policy is corrected to match what the code does, and Next.js is upgraded. Both are small (copy and npm work). No leaked secrets found.

## BLOCKERS (store / legal)
1. **Privacy policy omits processors the code uses** (app/privacy/page.tsx:112-160 and 2.3, 8). Missing: Groq and Google Gemini (customer WhatsApp text is routed there: lib/ai/callClaude.ts:79-92, 208-216; lib/ai/costControls.ts:107-132), PostHog (US; components/providers/PostHogAnalytics.tsx, lib/posthog/server.ts), Google Tag Manager/Analytics, Sentry (app/layout.tsx:165), Resend, Cloudflare (Insights + edge), Cloudinary. The policy only names Vercel Analytics. The cookie banner (components/CookieConsent.tsx:53) mentions PostHog but the policy does not. Reviewers compare these.
2. **No POPIA s72 cross-border transfer statement.** Data goes to the US (Anthropic, Groq, Gemini, PostHog, Vercel, Sentry, Meta). Privacy/terms contain no cross-border / section 72 / safeguards language. Add a section listing countries and safeguards.
3. **Controller/operator contradiction.** Privacy section 1 (page.tsx:60-62) says Mirembe Muse is the "responsible party"; Terms (app/terms/page.tsx:149) says the customer is the responsible party and AdminOS the "operator". Pick one model (customers' client data = operator; AdminOS account/billing/usage data = responsible party) and say so in both.
4. **Information Officer is a company name, not a person** (privacy page.tsx:252); address is just "South Africa" (page.tsx:15). Name a human IO and a physical address; confirm Information Regulator registration (UNVERIFIED).
5. **Deletion page not linked from privacy/terms.** /account/delete exists and is public (middleware.ts:15) but neither policy links to it. Add the link and use https://www.adminos.co.za/account/delete in the Play/AppGallery consoles.
6. **Sentry loads before consent.** app/layout.tsx:165 loads js.sentry-cdn.com unconditionally (sends IP/URL to a third party) while GTM/PostHog are gated. Gate it or disclose it. Vercel Analytics/SpeedInsights (layout.tsx:161-162) also load unconditionally; cookieless, but disclose.

## HIGH
1. **Next.js 16.1.7 has critical advisories** (npm audit): middleware/proxy bypass via segment-prefetch routes (GHSA-26hh-7cqf-hhc6), middleware redirect cache poisoning, RSC DoS, CSP-nonce XSS. Dashboard/API auth gating lives in middleware.ts, so the bypass matters directly. Upgrade to a patched 16.x.
2. **Other high/critical npm audit hits (prod deps):** dompurify (critical, XSS), protobufjs (critical), xlsx 0.18.x (high, prototype pollution + ReDoS, no fix available; which routes parse user spreadsheets is UNVERIFIED), @grpc/grpc-js, ws, sharp, postcss, lodash, nanoid, picomatch, serialize-javascript, fast-uri, @xmldom/xmldom, brace-expansion, browserslist, zod <4.6.6 (memory DoS), @opentelemetry/auto-instrumentations-node, @babel/plugin-transform-modules-systemjs. Mostly transitive; `npm audit fix` clears many without breaking changes. Moderate: @anthropic-ai/sdk 0.79-0.91 memory-tool advisories (N/A unless memory tool used).
3. **Open redirect in OAuth callback.** app/auth/callback/route.ts:10 and the final redirect `${origin}${next}` have no validation. `next=@evil.com` gives https://www.adminos.co.za@evil.com. Needs a valid code, so it is a phishing aid; fix with `next.startsWith('/') && !next.startsWith('//')` as app/auth/confirm/route.ts:33 does.
4. **Open redirect after login.** app/(auth)/login/page.tsx:38-39 does `router.push(searchParams.get('redirect'))` unvalidated; `/login?redirect=https://evil.com` leaves the site after a real login.
5. **Wellness check-in data** (health-adjacent special personal information, POPIA s26) is stored in staff.wellness_scores and the text goes to LLMs (lib/workflow/engine.ts:283-310). Policy mentions wellness only in passing; add explicit employer-consent basis and declare it as Health info.

## MEDIUM
1. **No MFA anywhere** (no mfa/totp code). Already listed open in SECURITY_AUDIT_REPORT. Bank reviewers will ask for owner/admin MFA.
2. **No web self-service password reset** (no forgot/reset link in app/(auth)/login/page.tsx; resetPasswordForEmail unused). Owners must email support (mobile: expo-app/app/(auth)/login.tsx:41).
3. **Rate limiter fails open** (lib/security/rateLimit.ts:54-58 returns success:true on Redis error); a Redis outage disables login-adjacent, invite-code and public-endpoint limits.
4. **Public widget endpoints** (app/api/widget/[tenantId]/message/route.ts): POST limit keyed on x-forwarded-for with a shared "api" bucket, and each POST writes into the tenant inbox (spam/storage abuse). GET has no rate limit and returns agent replies to anyone with tenantId + session_id (session_id guessability UNVERIFIED).
5. **/api/health is public and verbose** (live): shows DB/Redis/AI/Inngest status and version, hits the DB each call, unlimited. Return only {status} publicly.
6. **Auth cookies are probably not HttpOnly** (@supabase/ssr defaults, no overrides found). SECURITY_AUDIT_REPORT section 1 claims HTTP-only; UNVERIFIED without a live login. Secure/SameSite flags also UNVERIFIED. With 'unsafe-inline'/'unsafe-eval' in CSP this raises XSS impact.
7. **Production headers differ from code/audit doc.** next.config.ts:47 sets HSTS max-age=63072000; includeSubDomains; preload, but live is max-age=15552000 with neither (edge value wins). Live also has `access-control-allow-origin: *` on HTML and x-vercel-id (still Vercel). Align and update the audit doc.
8. **Hub shared-secret trust**: /api/billing/webhook and /api/paystack/webhook skip signature/IP checks when `x-hub-secret == HUB_INTERNAL_SECRET` (billing/webhook/route.ts:48-52; paystack/webhook/route.ts:39-40), and webhook/email (route.ts:22), compared with `!==` (not timing-safe). One static secret can activate plans for any tenant. Use timingSafeEqual and per-purpose secrets. PayFast amount/currency re-check: UNVERIFIED.
9. **webhook/social HMAC compared with `!==`** (app/api/webhook/social/route.ts:38); use timingSafeEqual.
10. **Retention/rights vs implementation.** "Purged within 30 days" is true only for the login: lib/account/deletion.ts:111-125 anonymises the auth user only; staff/contact/conversation rows stay (disclosed on /account/delete for employer records, but policy text overpromises). WhatsApp 90-day purge job: UNVERIFIED. "Export at any time": no self-serve export endpoint found (UNVERIFIED).
11. **Expo offline queue is plain AsyncStorage** (expo-app/lib/offlineQueue.ts:33-93); session tokens do use SecureStore (expo-app/lib/supabase.ts:18). Consider encrypting the queue.

## LOW
- Seed data (scripts/seed-demo-tenant.mjs) is fictional (invented names, 082 123 45xx-style phones, filler ID/bank numbers) but contacts use first.last@gmail/outlook addresses (lines 115-128) that could be real mailboxes; use @example.com. Scripts (authz-matrix.mjs:133, persona-walk.mjs:109, qa-personas.mjs:22, screen-audit.mjs:41) embed the owner's Gmail plus-alias in the public repo; move to an env var.
- No /.well-known/security.txt (404).
- Zod error shapes returned to clients (known).
- CSP unsafe-inline/unsafe-eval (known); connect-src allows api.anthropic.com / api.resend.com although those calls are server-side.
- SECURITY_AUDIT_REPORT.md is stale (Next 15, HSTS value, cookie claim). Refresh before giving it to a bank.

## Already good
- Secrets: tracked-file scan for sk-ant-, sbp_, JWTs, re_, gsk_, AIza, ghp_, sk_live_, whsec_, phc_ and private keys returned zero hits; only .env.local.example is tracked; no .env/.pem/keystore/google-services ever added in 324 commits (filename check only; content pickaxe not run, UNVERIFIED for in-history literals).
- NEXT_PUBLIC_/EXPO_PUBLIC_ vars are only Supabase URL + anon key, app/store URLs, Cloudinary cloud name, PostHog public token. No service_role in expo-app. eas.json has no secrets.
- Account + data deletion: public web page app/account/delete/page.tsx, in-app (expo-app/app/(app)/delete-account.tsx), POST /api/account/delete (typed DELETE, rate limited, withRoute), immediate ban + push revoke + audit log, 30-day anonymising purge (inngest/functions/accountDeletionPurge.ts), owner deletion flagged for review. Meets Play/AppGallery mechanics.
- Consent: PostHog and GTM load only after opt-in; PostHog identifies by id + tenant only.
- Public endpoints authenticate: Meta WhatsApp (HMAC-SHA256, fails closed, verify token), social (HMAC), PayFast (MD5 + IP allowlist), Twilio (signature), n8n hooks (timingSafeEqual), contract signing / payslip view / NPS (random tokens + rate limit), booking, feedback, invite redeem (zod + rate limit, uniform errors, 32^8 code space). Live probes: /dashboard 307, /api/contacts 401, /api/cron/health 401, WhatsApp verify with wrong token 403.
- WhatsApp inbound: dedupe, POPIA s69 opt-out before AI, per-tenant rate and plan limits, sanitizeForAI + 2000-char cap.
- AI blast radius: no LLM tool-use / function-calling found in lib or inngest; output is text only, so injection cannot run DB actions (worst case a misleading reply). Cost abuse limited by per-tenant limits and lib/ai/costControls.ts. Regex sanitizer is bypassable but only defence-in-depth.
- Live headers: CSP with frame-ancestors 'none', X-Frame-Options DENY, nosniff, strict-origin-when-cross-origin, Permissions-Policy, HSTS present.
- Auth: claims read from app_metadata not user_metadata; Bearer tokens verified through Supabase getUser; invite codes hashed; auth/confirm redirect is same-origin checked; Android blockedPermissions strip unused permissions.

## Google Play Data Safety form (suggested; verify against final build)
Collected, not sold, no ads, used for app functionality; encrypted in transit; deletion available in-app and at https://www.adminos.co.za/account/delete; privacy URL https://www.adminos.co.za/privacy (after blockers fixed).
- Personal info: name, email, phone, address, user IDs.
- Financial info: salary/payslips/bank details of staff (entered by employer), invoices/purchase history.
- Health and fitness: wellness check-in scores (declare to be safe).
- Location: approximate + precise, foreground only at clock-in/out (background blocked).
- Photos and files: receipt photos, documents.
- Messages: customer/WhatsApp messages (shared with AI processors Anthropic, Groq, Google for functionality).
- App activity / diagnostics: crash logs (Sentry); analytics (PostHog on web after consent; whether the Expo app ships analytics is UNVERIFIED).
- Device IDs: push token.
- Permissions to justify: CAMERA, ACCESS_FINE/COARSE_LOCATION, USE_BIOMETRIC, POST_NOTIFICATIONS.

## Huawei AppGallery privacy declaration
- Same categories as above; third-party list must name Anthropic, Groq, Google (Gemini), Supabase, Meta, Twilio, PayFast, Paystack, Upstash, Resend, Sentry, PostHog, Cloudflare, Vercel.
- Huawei build (APP_STORE=huawei) must not depend on Google services/FCM; push path for Huawei UNVERIFIED.
- State cross-border transfer (South Africa to US/EU), Information Officer contact, deletion URL, no sale of data, no ad use.
- Declare permissions with purposes (camera: receipts; location: clock-in; biometrics: unlock; notifications).
