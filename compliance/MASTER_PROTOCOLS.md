# AdminOS Master Protocols
**Mirembe Muse (Pty) Ltd t/a AdminOS**
Version 1.0 | June 2026

Single source of truth for all operational, technical, security, legal, and AI safety protocols.
Update this document whenever a protocol changes. Link here from code comments, runbooks, and onboarding.

---

## TABLE OF CONTENTS

1. [Technical Security Protocols](#1-technical-security-protocols)
2. [AI Safety Protocols](#2-ai-safety-protocols)
3. [Multi-Tenant Data Isolation Protocols](#3-multi-tenant-data-isolation-protocols)
4. [Authentication & Access Control Protocols](#4-authentication--access-control-protocols)
5. [API & Webhook Security Protocols](#5-api--webhook-security-protocols)
6. [File Handling Protocols](#6-file-handling-protocols)
7. [Operational Protocols](#7-operational-protocols)
8. [Incident Response Protocols](#8-incident-response-protocols)
9. [Legal & Compliance Protocols](#9-legal--compliance-protocols)
10. [Cost Control Protocols](#10-cost-control-protocols)
11. [Deployment Protocols](#11-deployment-protocols)
12. [Protocol Review Schedule](#12-protocol-review-schedule)

---

## 1. TECHNICAL SECURITY PROTOCOLS

### 1.1 Secrets Management

| Rule | Detail |
|------|--------|
| No secrets in code | All secrets in environment variables. `.env.local` in `.gitignore`. |
| Public prefix prohibition | `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `META_APP_SECRET` must NEVER use `NEXT_PUBLIC_` prefix |
| Secret rotation schedule | Rotate all API keys every 12 months, or immediately on any suspected exposure |
| Rotation procedure | (1) Generate new key in provider dashboard, (2) Update Vercel env vars, (3) Deploy, (4) Verify, (5) Revoke old key |
| Emergency rotation | See Section 8 — Incident Response |

**Secrets inventory:**

| Secret | Where | Rotation Owner |
|--------|-------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | Information Officer |
| `ANTHROPIC_API_KEY` | Vercel env | Information Officer |
| `META_APP_SECRET` | Vercel env | Information Officer |
| `PAYFAST_PASSPHRASE` | Vercel env | Information Officer |
| `CRON_SECRET` | Vercel env | Information Officer |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel env | Information Officer |
| `RESEND_API_KEY` | Vercel env | Information Officer |
| `INNGEST_SIGNING_KEY` | Vercel env | Information Officer |

### 1.2 Security Headers

Configured in `next.config.ts`. Required on every route:

| Header | Required Value |
|--------|---------------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=() |

### 1.3 Dependency Security

- Run `npm audit` before every production release
- Fix all `HIGH` and `CRITICAL` vulnerabilities before deploy
- `MODERATE`: assess case-by-case; document decision if not fixing
- Monitor `pdf-parse` specifically — older package, higher CVE surface

---

## 2. AI SAFETY PROTOCOLS

### 2.1 Prompt Injection Protection

All user-controlled input MUST pass through `sanitizeForAI()` before reaching any Claude API call.
All document-extracted text MUST pass through `sanitizeDocumentText()` before reaching any Claude API call.

| Input type | Function to use | Where applied |
|-----------|-----------------|---------------|
| Inbound WhatsApp messages | `sanitizeForAI()` | `app/api/webhook/whatsapp/route.ts` |
| User-typed chat messages | `sanitizeForAI()` | Any AI chat endpoint |
| Extracted PDF/DOCX/XLSX text | `sanitizeDocumentText()` | `lib/files/parser.ts` → `parseFile()` |
| Tenant config values in system prompt | `sanitizeSystemPromptValue()` | Any endpoint building a system prompt |

**Both functions are in `lib/security/sanitize.ts`.** Do not call the Claude SDK directly without first running appropriate sanitization.

### 2.2 AI Cost Controls

See `docs/api_cost_controls.md` for the full budget table. Enforced by `lib/ai/budget.ts` using Upstash Redis.

| Plan | Daily token budget | Model tier |
|------|--------------------|------------|
| Solo | 50,000 | Haiku |
| Starter | 200,000 | Haiku / Sonnet |
| Business | 800,000 | Sonnet |
| Enterprise | 500,000 (per seat) | Sonnet / Opus |
| Partner | 2,000,000 | Sonnet / Opus |

**Enforcement protocol:**
1. Before every Claude API call, check Redis budget key `ai:budget:{tenantId}:{date}`
2. If remaining budget < tokens_needed → return 429 with message to upgrade
3. After call, increment Redis counter by `usage.input_tokens + usage.output_tokens`
4. Abuse spike detection: if tenant burns >50% of daily budget in <15 minutes, alert and throttle

### 2.3 Model Selection Protocol

| Feature | Model | Rationale |
|---------|-------|-----------|
| WhatsApp reply (< 200 tokens) | `claude-haiku-4-5-20251001` | Low cost, fast |
| Document analysis | `claude-sonnet-4-6` | Quality needed |
| Langa mentor | `claude-sonnet-4-6` | Quality + context |
| Financial insights | `claude-sonnet-4-6` | Accuracy critical |
| Board pack / strategic | `claude-opus-4-8` | Enterprise only |

**Never use Opus for high-volume, low-value tasks.** Always default to Haiku for short responses.

### 2.4 Langa Agent Safety

- Langa has access to the tenant's real business data. Always prefix context with `sanitizeSystemPromptValue()` for any tenant-supplied values injected into the system prompt.
- Langa must not make specific legal, tax, or medical recommendations. Add disclaimer: *"This is guidance, not professional advice. Consult a qualified professional for specific decisions."*
- All Langa interaction logs stored for abuse review. No personal conversation content in server logs.

---

## 3. MULTI-TENANT DATA ISOLATION PROTOCOLS

### 3.1 Row-Level Security (RLS) Requirements

**Every table that holds tenant data MUST have:**

```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON [table_name]
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);
```

**Protocol for adding a new table:**
1. Create table with `tenant_id UUID NOT NULL` column
2. Add RLS policy (copy template above)
3. Verify with RLS audit query (see `supabase/migrations/20260426_rls_audit.sql`)
4. Add to `DEPLOYMENT_CHECKLIST.md` smoke test
5. Tick off the POPIA Annual Review checklist item D1

### 3.2 `supabaseAdmin` Usage Rules

`supabaseAdmin` (service role) bypasses RLS entirely. It MUST:
- Only be used in server-side route handlers (never in client components)
- Never be used with user-supplied `tenant_id` without explicit validation
- Only be used when the operation genuinely needs to cross tenant boundaries (e.g. super-admin, cron jobs)
- Always be accompanied by a comment explaining why service role is needed

### 3.3 Tenant ID Resolution

- `tenant_id` is NEVER trusted from the client request body or headers
- It MUST be resolved server-side from the authenticated JWT
- Use the helper: `lib/supabase/tenant.ts → getTenantId(supabase)`

---

## 4. AUTHENTICATION & ACCESS CONTROL PROTOCOLS

### 4.1 Super-Admin Verification

Super-admin routes (`/api/admin/*`) MUST verify against the `admins` DB table, not JWT metadata.

**Reason:** Users can call `supabase.auth.updateUser({ data: { role: 'super_admin' } })` to self-assign `user_metadata`. The `admins` table is only writable via `supabaseAdmin` (service role), making it tamper-proof.

```typescript
// CORRECT
const { data: adminRecord } = await supabaseAdmin
  .from('admins')
  .select('id')
  .eq('user_id', user.id)
  .single()
if (!adminRecord) return new NextResponse('Forbidden', { status: 403 })

// WRONG — do not use
if (user.user_metadata?.role !== 'super_admin') { ... }
```

### 4.2 Adding a Super Admin

Only the registered Information Officer can add a super-admin. Procedure:
1. Log into Supabase dashboard
2. Run via SQL editor (never expose this in any UI):
   ```sql
   INSERT INTO admins (user_id, created_by)
   VALUES ('[target_user_uuid]', '[your_user_uuid]');
   ```
3. Record in the audit log manually

### 4.3 Role Hierarchy

```
super_admin    → full system access (DB admins table)
owner          → all features for their tenant
admin          → manage staff, settings for their tenant
manager        → manage operations, not billing
staff          → task execution, limited data access
```

Role is stored in the `staff` table, not in JWT claims. Always resolve from DB.

### 4.4 Session Security

- Sessions managed by Supabase Auth HTTP-only cookies
- No tokens stored in `localStorage`
- Trial expiry enforced in `middleware.ts` — redirect to `/billing` on expiry
- Session invalidation on password change or account suspension

---

## 5. API & WEBHOOK SECURITY PROTOCOLS

### 5.1 Webhook Verification

**Never process a webhook without verifying its signature first.**

| Webhook | Verification method | Code location |
|---------|--------------------|----|
| Meta WhatsApp | `X-Hub-Signature-256` HMAC-SHA256 | `app/api/webhook/whatsapp/route.ts` |
| PayFast ITN | MD5 hash with passphrase | `app/api/webhook/payfast/route.ts` |

If signature verification fails → return `200 OK` immediately (do not reveal the failure to the sender).

### 5.2 Rate Limiting

Five Upstash Redis rate limiters are active. Adding a new endpoint that calls expensive resources MUST include rate limiting:

```typescript
import { rateLimiter } from '@/lib/rate-limit'
const { success } = await rateLimiter.tenantApi.limit(tenantId)
if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
```

### 5.3 Cron Route Authentication

All `/api/cron/*` routes MUST verify:
```typescript
const secret = request.headers.get('Authorization')?.replace('Bearer ', '')
if (secret !== process.env.CRON_SECRET) {
  return new NextResponse('Forbidden', { status: 403 })
}
```

---

## 6. FILE HANDLING PROTOCOLS

### 6.1 Upload Security

- All uploaded files stored in Supabase Storage with UUID-generated filenames
- User-supplied filenames are NEVER used as storage paths (prevents path traversal)
- MIME type verified server-side — client-declared content-type is not trusted
- File size limits enforced before processing: 25MB max for documents

### 6.2 Document Text Sanitization

After extracting text from any file, always pass through `sanitizeDocumentText()`:

```typescript
import { sanitizeDocumentText } from '@/lib/security/sanitize'
// Applied automatically inside parseFile() in lib/files/parser.ts
```

This is applied in `parseFile()` automatically. If you call individual parsers directly (e.g. `parsePDF`), you MUST apply `sanitizeDocumentText()` manually.

### 6.3 Signed URL Protocol

- Document download links MUST use signed URLs (not permanent public URLs)
- Default TTL: 60 minutes
- Never return permanent `publicURL` links for private documents

---

## 7. OPERATIONAL PROTOCOLS

### 7.1 Deployment Protocol

Full checklist in `DEPLOYMENT_CHECKLIST.md`. Key gates:

1. `npm audit` — no HIGH/CRITICAL
2. All RLS tables verified
3. Environment variables set in Vercel
4. Cron jobs scheduled in Vercel
5. Smoke test: create tenant → send WhatsApp → check dashboard

### 7.2 Database Migration Protocol

1. Write migration in `supabase/migrations/` with timestamp prefix `YYYYMMDD_description.sql`
2. Test on local Supabase (`supabase db reset && supabase db push`)
3. Test on Supabase branch (staging environment)
4. Apply to production during low-traffic window (02:00–04:00 SAST)
5. Verify with post-migration smoke test

### 7.3 Incident Escalation Ladder

| Severity | Who is notified | Response time |
|----------|----------------|---------------|
| P1 (system down / data breach) | Information Officer immediately | < 1 hour |
| P2 (major feature broken) | Information Officer within 4 hours | < 4 hours |
| P3 (minor feature degraded) | Dev team next working day | < 24 hours |
| P4 (cosmetic / enhancement) | Added to sprint backlog | Next sprint |

---

## 8. INCIDENT RESPONSE PROTOCOLS

### 8.1 Security Breach Response

Full procedure in `compliance/POPIA_BREACH_RESPONSE_PLAN.md`. Summary:

1. **Detect & Contain** (Hour 0–1): Revoke compromised keys, disable affected accounts, preserve all logs
2. **Assess** (Hour 1–4): Identify affected data subjects and categories
3. **Notify Regulator** (< 72 hours): Report to Information Regulator via `inforeg@justice.gov.za`
4. **Notify Subjects** (ASAP): Email + WhatsApp to affected tenants
5. **Remediate**: Patch vulnerability, rotate credentials, audit RLS
6. **Post-Incident Review** (< 14 days): Root cause, corrective measures, update this document

### 8.2 Emergency Key Rotation

If any secret is suspected compromised:

```
1. Generate new key in provider dashboard
2. Go to Vercel → Project → Settings → Environment Variables
3. Update the variable
4. Trigger immediate redeploy (Vercel dashboard → Deployments → Redeploy)
5. Verify new deployment is live and working
6. Revoke the old key in the provider dashboard
7. Record the incident in compliance/BREACH_REGISTER.md
```

### 8.3 Cross-Tenant Data Leak Protocol

The highest-risk scenario for a multi-tenant platform:

1. Immediately disable the affected API endpoint
2. Query Supabase logs: which tenants accessed what
3. Identify the faulty RLS policy
4. Fix the RLS policy in a migration
5. Deploy fix
6. Run full RLS audit query
7. Notify both affected tenants (the leaker and the recipient)
8. Notify Information Regulator if > 1 data subject affected

---

## 9. LEGAL & COMPLIANCE PROTOCOLS

### 9.1 POPIA Information Officer

**Registered Information Officer:** Nandawula Regine (nandaregine@gmail.com)
**Registration status:** Confirmed registered with Information Regulator

All data subject requests (access, correction, deletion, objection) must be routed to the IO and responded to within **30 days**.

### 9.2 POPIA Erasure Protocol

When a tenant or their contact requests erasure:
1. Run the erasure endpoint: `DELETE /api/compliance/delete-contact`
2. Verify all personal data deleted from: contacts, conversations, messages, documents, invoices, AI logs
3. Confirm erasure in writing to the requester within 30 days
4. Log the erasure in the audit log

### 9.3 PAIA Request Protocol

Full procedure in `compliance/PAIA_MANUAL.md`. Summary:
1. Acknowledge within 3 business days
2. Decide within 30 days
3. Request Form C + R50 fee (waived for own personal information requests)

### 9.4 Annual Compliance Review

Run every June using `compliance/POPIA_ANNUAL_REVIEW_CHECKLIST.md`. File completed checklist with IO signature in the `compliance/` folder as `POPIA_REVIEW_[YEAR].md`.

### 9.5 New Feature Compliance Gate

Before launching any feature that processes new categories of personal information:
1. Update the Privacy Policy
2. Complete a Privacy Impact Assessment (document in `compliance/PIA_[FEATURE].md`)
3. Add the processing activity to the PAIA Manual (Section 5)
4. Add a checklist item to the Annual Review

---

## 10. COST CONTROL PROTOCOLS

### 10.1 AI Token Budget Enforcement

Enforced in `lib/ai/budget.ts`. Redis key structure:

```
ai:budget:{tenantId}:{YYYY-MM-DD}     → daily token usage counter (TTL 48h)
ai:abuse:{tenantId}:{YYYY-MM-DD}:{HH} → hourly spike counter (TTL 2h)
```

**Never bypass budget checks** for any reason — even for demo or test tenants. Use a dedicated `super_admin` test tenant with elevated limits if needed.

### 10.2 AI Caching Protocol

- System prompts use `cache_control: { type: 'ephemeral' }` on all Claude API calls
- Cache TTL: 5 minutes on Anthropic's side
- Tenant config (business name, agent instructions) cached with system prompt — do not inject volatile data into the cacheable portion

### 10.3 Monitoring Alerts

Set up alerts for:
- Any tenant exceeding 80% of daily budget
- Any single API call exceeding 10,000 tokens
- Total monthly Anthropic bill exceeding R5,000 (alert) or R10,000 (auto-throttle all non-paying tenants)

---

## 11. DEPLOYMENT PROTOCOLS

See `DEPLOYMENT_CHECKLIST.md` for the complete pre-production gate.

### 11.1 Vercel Environment Variable Protocol

All 22 required env vars must be set before deploy. Required vars are documented in `.env.local.example`. Never set `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` — this would expose the service role key to browsers.

### 11.2 Cron Job Protocol

All cron jobs registered in `vercel.json`. They authenticate via `CRON_SECRET`. After any deploy, verify in Vercel dashboard that cron jobs are scheduled correctly.

### 11.3 Rollback Protocol

If a deploy causes P1/P2 incident:
1. Vercel dashboard → Deployments → Find last known good deploy → Instant Rollback
2. Investigate root cause before re-deploying
3. Do not re-deploy until root cause is confirmed fixed and tested

---

## 12. PROTOCOL REVIEW SCHEDULE

| Protocol | Review frequency | Trigger for immediate review |
|----------|-----------------|------------------------------|
| This document | Annually (June) + after any incident | Any security incident, new major feature |
| POPIA Breach Response Plan | Annually + after any breach | Security incident involving personal data |
| PAIA Manual | Annually + on major change | New data categories, new features, legal changes |
| POPIA Annual Review Checklist | Annually (June) | N/A |
| Security Audit Report | Before enterprise tier launch + annually | Any penetration test finding |
| Deployment Checklist | Before each major release | New external integrations |

**Next scheduled review of this document:** June 2027

---

*Approved by:* Nandawula Regine, Registered Information Officer, Mirembe Muse (Pty) Ltd
*Date:* June 2026
*Version:* 1.0

*To report a security issue: nandaregine@gmail.com*
*To report a data breach: nandaregine@gmail.com → follow Section 8.1*
