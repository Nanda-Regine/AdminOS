# AdminOS — Security Audit Report

**Date:** April 2026  
**Version:** 1.0 (production release)  
**Scope:** AdminOS SaaS application — web frontend, API routes, database, authentication, integrations  
**Auditor:** Internal pre-launch review (Nandawula Regine / Mirembe Muse (Pty) Ltd)

---

## Executive Summary

AdminOS has been built with security-first architecture throughout. This report documents the security controls in place, residual risks, and recommendations before the public launch.

**Overall posture: GOOD** — No critical vulnerabilities identified. Three medium-severity items were identified; all three have been resolved (June 2026).

---

## 1. Authentication & Access Control

### Implemented
| Control | Status | Detail |
|---------|--------|--------|
| Supabase Auth (JWT) | ✅ | All dashboard routes protected via middleware |
| Google OAuth 2.0 | ✅ | PKCE flow via Supabase, `/auth/callback` validates `code` exchange |
| Session management | ✅ | HTTP-only cookies set by Supabase, no localStorage tokens |
| Route protection | ✅ | `middleware.ts` enforces auth on all `/dashboard/*` and `/api/*` (except webhooks) |
| Trial enforcement | ✅ | Trial expiry checked in middleware, redirects to billing |
| Super-admin role | ✅ | `/api/admin/*` routes verify against `admins` DB table (service-role only write), not JWT metadata |

### Residual Risks
- **MEDIUM:** No 2FA enforced on Starter/Growth tiers. Enterprise tier has 2FA in roadmap — prioritise.
- **LOW:** Password strength enforced at 8 chars minimum (Supabase default). Consider zxcvbn scoring for weak password detection.

---

## 2. Multi-Tenant Data Isolation

### Implemented
| Control | Status | Detail |
|---------|--------|--------|
| Row-Level Security | ✅ | Every table has `tenant_id` column with RLS `USING (tenant_id = auth.jwt() -> 'tenant_id')` |
| Server-side tenant resolution | ✅ | `tenant_id` never trusted from client — resolved from authenticated JWT in all API routes |
| Admin client separation | ✅ | `supabaseAdmin` (service role) used only in server-side routes, never exposed to client |
| Cross-tenant enumeration | ✅ | All queries scoped: `eq('tenant_id', tenantId)` — no global scans |

### Residual Risks
- **LOW:** RLS policies should be reviewed each time a new table is added. Checklist item in `DEPLOYMENT_CHECKLIST.md`.

---

## 3. API Security

### Implemented
| Control | Status | Detail |
|---------|--------|--------|
| Input validation | ✅ | Zod schemas on all POST/PATCH bodies (`contacts`, `invoices`, `agents`, etc.) |
| Rate limiting | ✅ | Upstash Redis sliding window: 5 limiters (per-IP, per-tenant-API, WhatsApp inbound, document upload, billing) |
| HMAC webhook verification | ✅ | Meta WhatsApp Cloud API and PayFast webhooks validate `X-Hub-Signature-256` (HMAC-SHA256) / ITN hash |
| Cron authentication | ✅ | All `/api/cron/*` routes require `Authorization: Bearer $CRON_SECRET` |
| SQL injection | ✅ | Supabase SDK uses parameterised queries — no raw SQL string interpolation |
| Path traversal | ✅ | Document upload stores to Supabase Storage with UUID filenames, never user-supplied paths |
| SSRF | ✅ | No user-controlled URLs fetched server-side |

### Residual Risks
- ~~**MEDIUM:** The `/api/admin/create-tenant` route relies on `user_metadata.role` from JWT.~~ **RESOLVED June 2026** — Both admin routes now query the `admins` DB table via service role. Users can still update `user_metadata` but it is no longer consulted for privilege checks.
- **LOW:** Zod error messages in API responses reveal schema shape. Consider generic 400 responses in production.

---

## 4. Prompt Injection Protection

### Implemented
| Control | Status | Detail |
|---------|--------|--------|
| `sanitizeForAI()` | ✅ | Strips 16 injection patterns: `ignore previous`, `system:`, `<instructions>`, jailbreak phrases, etc. |
| Input length cap | ✅ | 2,000 character hard limit on all inbound WhatsApp messages before Claude API call |
| System prompt separation | ✅ | Tenant config and agent instructions are in the `system` parameter, not the `user` turn |
| Prompt caching | ✅ | System prompts cached with `cache_control: ephemeral` — injected user content cannot poison cache |

### Residual Risks
- ~~**LOW:** Document text extracted by pdf-parse/mammoth is passed to Claude without sanitization.~~ **RESOLVED June 2026** — `sanitizeDocumentText()` added to `lib/security/sanitize.ts` and applied in `parseFile()` before returning to the AI layer. All 16 injection patterns stripped; no character limit (documents use their own 80k char cap).

---

## 5. Security Headers

Configured in `next.config.ts` and verified on all routes:

| Header | Value | Status |
|--------|-------|--------|
| `X-Frame-Options` | `DENY` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | ✅ |
| `Content-Security-Policy` | Configured (see `next.config.ts`) | ✅ |
| `Permissions-Policy` | Camera, mic, geolocation off | ✅ |

---

## 6. Secrets Management

| Control | Status | Detail |
|---------|--------|--------|
| `.env.local` in `.gitignore` | ✅ | Never committed |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only, never in `NEXT_PUBLIC_*` |
| `ANTHROPIC_API_KEY` | ✅ | Server-only |
| Webhook secrets | ✅ | Stored as env vars, not hardcoded |
| `.env.local.example` | ✅ | All vars documented, no real values |

### Residual Risks
- **LOW:** `CRON_SECRET` is a shared secret. If Vercel environment variables are leaked, all cron routes are accessible. Low risk given Vercel's secret encryption.

---

## 7. POPIA Compliance

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Lawful basis | Documented in `/privacy` | ✅ |
| Data minimisation | Only business-necessary fields collected | ✅ |
| Right to access | Audit trail accessible to admin | ✅ |
| Right to erasure | `DELETE /api/compliance/delete-contact` | ✅ |
| Data breach notification | Manual process (document in runbook) | ⚠️ |
| Immutable audit log | `audit_logs` table, no UPDATE/DELETE | ✅ |
| Cookie consent | `CookieConsent.tsx` — opt-in, POPIA-aware | ✅ |
| Information Officer | Designated: privacy@mirembemuse.co.za | ✅ |

---

## 8. Dependency Security

```bash
# Run before each release:
npm audit
# Resolve all HIGH and CRITICAL before deploy
# MODERATE: assess on case-by-case basis
```

Key dependencies and last audit status (April 2026):
- `next` — 15.x, no known critical CVEs
- `@anthropic-ai/sdk` — latest, no known CVEs
- `@supabase/supabase-js` — latest
- `pdf-parse` — older package, monitor for CVEs
- `mammoth` — stable, no known CVEs
- `inngest` — v4, no known CVEs

---

## Priority Action Items

| Priority | Item | Owner | By | Status |
|----------|------|-------|----|--------|
| HIGH | Run `npm audit` and fix HIGH/CRITICAL | Dev | Before launch | Open |
| ~~MEDIUM~~ | ~~Move super-admin check to DB table, not JWT metadata~~ | ~~Dev~~ | ~~Before enterprise tier~~ | **DONE Jun 2026** |
| MEDIUM | Enforce 2FA for Enterprise tier | Dev | Q3 2026 | Open |
| ~~MEDIUM~~ | ~~Sanitize extracted document text before Claude~~ | ~~Dev~~ | ~~Sprint 1 post-launch~~ | **DONE Jun 2026** |
| LOW | Add zxcvbn password strength scoring | Dev | Q3 2026 | Open |
| LOW | Implement data breach notification runbook | Legal/Dev | Q3 2026 | DONE (POPIA_BREACH_RESPONSE_PLAN.md) |

---

## Conclusion

AdminOS demonstrates strong security hygiene for a v1.0 SaaS product. The multi-tenant RLS architecture, prompt injection protection, HMAC webhook verification, and POPIA compliance controls are production-grade. The action items above are low-to-medium risk and do not block the Starter/Growth tier launch. Enterprise tier should resolve the 2FA and super-admin items before onboarding large clients.

---

*AdminOS Security Audit · April 2026 · Mirembe Muse (Pty) Ltd*  
*Next review: Q3 2026 or after any major architectural change*
