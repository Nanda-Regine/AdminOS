# POPIA Security Compromise Response Plan
**Mirembe Muse (Pty) Ltd t/a AdminOS**
Version 1.0 | June 2026

---

## 1. PURPOSE & LEGAL BASIS

This plan governs Mirembe Muse (Pty) Ltd's response to any actual or suspected security compromise involving personal information, as required by **Section 22 of the Protection of Personal Information Act 4 of 2013 (POPIA)**.

AdminOS is a multi-tenant SaaS platform. A breach may affect:
- Personal information of our direct customers (tenant account holders)
- Personal information held by tenants within their AdminOS accounts (their clients, staff, suppliers, contacts)
- Our own internal staff and contractor records

All three categories are covered by this plan.

---

## 2. INFORMATION OFFICER

| Role | Name | Contact |
|---|---|---|
| **Registered Information Officer** | [YOUR FULL NAME] | [YOUR EMAIL] |
| **Deputy Information Officer** | [NAME or "Not appointed — sole IO"] | [EMAIL] |
| **Technical Lead (Data Security)** | [NAME or "Information Officer acting"] | [EMAIL] |

*The Information Officer is responsible for activating this plan, notifying the Information Regulator, and coordinating all breach response activities.*

---

## 3. WHAT CONSTITUTES A REPORTABLE SECURITY COMPROMISE

Under POPIA Section 22, a security compromise must be reported when there are **reasonable grounds** to believe that personal information of a data subject has been accessed or acquired by an unauthorised person.

### Reportable Events (Examples)
- Unauthorised access to the AdminOS database or Supabase project
- A cross-tenant data leak (tenant A accessing tenant B's data)
- Accidental exposure of personal information via a misconfigured API endpoint
- Theft or loss of a device containing personal information (laptop, phone with app session)
- A staff member accessing tenant data outside their authorised role
- A third-party integration (Xero, Sage, Meta WhatsApp) reporting a breach that may include our tenants' data
- A phishing attack that results in credential compromise
- Ransomware or malware affecting systems holding personal information

### Non-Reportable Events (Internal Only)
- Attempted but unsuccessful unauthorised access (log, monitor, patch)
- Spam or phishing attempts that did not result in compromise
- Technical errors that did not expose personal information

---

## 4. SEVERITY CLASSIFICATION

| Level | Definition | Examples | Response Time |
|---|---|---|---|
| **P1 — Critical** | Mass exposure of personal information across multiple tenants or the full database | Database dump, API key leaked in public repo, RLS bypass | **Immediate — within 1 hour** |
| **P2 — High** | Single tenant's full data exposed, or partial exposure affecting >100 data subjects | Single tenant DB leak, document storage misconfiguration | **Within 4 hours** |
| **P3 — Medium** | Limited exposure affecting <100 data subjects | Single record accessed incorrectly, staff data visible to wrong manager | **Within 24 hours** |
| **P4 — Low** | Potential exposure with no confirmed unauthorised access | Suspicious login attempt, anomalous API call pattern | **Within 72 hours** |

---

## 5. STEP-BY-STEP RESPONSE PROCEDURE

### STEP 1 — DETECT & CONTAIN (Hour 0–1 for P1/P2)

**Who:** Information Officer + Technical Lead

- [ ] Confirm the breach is real (not a false positive)
- [ ] Identify what data was compromised: which tables, which tenants, how many data subjects
- [ ] Identify the attack vector (how did it happen?)
- [ ] **CONTAIN immediately:**
  - Revoke compromised API keys or access tokens
  - Disable affected user accounts
  - Enable Supabase IP allowlist if not already active
  - Take affected endpoints offline if necessary
  - Preserve logs — do NOT delete anything
- [ ] Document start time and all actions taken with timestamps

### STEP 2 — ASSESS IMPACT (Hour 1–4)

**Who:** Information Officer

- [ ] Identify all affected data subjects (query the database — which contacts, staff, users)
- [ ] Identify the categories of personal information exposed:
  - Basic identifiers (name, phone, email)
  - Financial information (invoices, bank details)
  - Health information (wellness scores, medical records)
  - Employment information (payslips, IR records)
  - Special categories (race/ethnicity for EE data — highest protection)
- [ ] Assess likelihood of harm to data subjects (identity theft risk, financial fraud risk, reputational risk)
- [ ] Classify severity level (P1–P4)

### STEP 3 — NOTIFY THE INFORMATION REGULATOR (Within 72 Hours)

**Who:** Information Officer

**Legal requirement:** Section 22(1) of POPIA requires notification to the Information Regulator as soon as reasonably possible after becoming aware of a compromise.

**The Information Regulator of South Africa:**
- Website: www.justice.gov.za/inforeg/
- Email: inforeg@justice.gov.za
- Physical: JD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001
- Tel: 010 023 5200

**Use the notification template in Section 8 of this plan.**

**What to include in the notification:**
- Description of the compromise
- Categories and approximate number of data subjects affected
- Categories and approximate number of personal information records concerned
- Contact details of the Information Officer
- Likely consequences of the security compromise
- Measures taken or proposed to address the compromise

### STEP 4 — NOTIFY AFFECTED DATA SUBJECTS (As Soon As Reasonably Possible)

**Who:** Information Officer

Section 22(1) also requires notifying affected data subjects unless the Information Regulator directs otherwise (e.g. if notification would compromise a criminal investigation).

**Priority order for notification:**
1. Tenants (account holders) whose data was directly exposed — notify FIRST
2. Tenants whose customers'/staff's data was exposed — they must notify their own data subjects
3. Direct data subjects if we hold data without a tenant intermediary

**Channel:** Email + WhatsApp (dual channel for critical notifications)

**Use the notification template in Section 9 of this plan.**

### STEP 5 — REMEDIATE

**Who:** Technical Lead + Information Officer

- [ ] Patch the vulnerability that caused the breach
- [ ] Rotate all potentially compromised credentials (Supabase service key, API keys, JWT secrets)
- [ ] Conduct a full RLS policy audit to confirm no other bypass routes exist
- [ ] Force password reset for all affected user accounts
- [ ] Review and tighten any misconfigured permissions
- [ ] Conduct penetration test on affected components before reopening

### STEP 6 — POST-INCIDENT REVIEW (Within 14 Days)

**Who:** Information Officer

- [ ] Root cause analysis: how did this happen?
- [ ] Process failure: which safeguard failed or was absent?
- [ ] Corrective measures: what changes prevent recurrence?
- [ ] Update this plan if the incident revealed gaps
- [ ] Update the POPIA Annual Review checklist with new controls
- [ ] Document all findings in the breach register (Section 10)

---

## 6. SPECIFIC SCENARIOS FOR AdminOS

### Scenario A: Cross-Tenant Data Leak (RLS Policy Failure)
*Highest risk for a multi-tenant platform*

1. Immediately disable the affected API endpoint
2. Identify which tenants may have accessed another tenant's data (check Supabase logs)
3. Identify what data was accessible (which tables, which rows)
4. Notify BOTH affected tenants: the one whose data leaked AND the one that may have seen it
5. Fix the RLS policy, verify with automated tenant isolation tests before re-enabling

### Scenario B: Supabase Service Role Key Exposed in Public Repository
1. Rotate the service role key immediately (Supabase dashboard → Settings → API)
2. Update all environment variables in Vercel
3. Audit git history — if committed to a public repo, assume compromised from commit date
4. Check Supabase logs for any API calls using the old key after commit date
5. If any unauthorised access confirmed → full breach procedure

### Scenario C: Tenant's WhatsApp Number Compromised
1. This is Meta's breach, not AdminOS's — but we may hold conversation data
2. Assist the tenant in securing their WhatsApp Business account
3. Review what personal information from their conversations is stored in AdminOS
4. If messages containing sensitive data were exposed → notify as per Steps 3 & 4

### Scenario D: Staff Laptop Stolen (with Active AdminOS Session)
1. Immediately revoke all sessions for that user account (Supabase Auth → Users → Invalidate sessions)
2. Force password reset
3. Review what data the user had access to (their role determines the blast radius)
4. If the device had offline-cached data (Expo app) → the cached data scope determines notification need

---

## 7. THIRD-PARTY NOTIFICATION OBLIGATIONS

If the breach originates from a third-party processor we use, we still bear accountability:

| Processor | Contact for Security | Our Obligation |
|---|---|---|
| Supabase | security@supabase.io | Notify if their breach exposes our tenant data |
| Vercel | security@vercel.com | Notify if their infrastructure breach exposes data |
| Meta (WhatsApp API) | Meta Security Team | Notify tenants if Meta breach exposes their messages |
| Anthropic (Claude API) | security@anthropic.com | Notify if AI prompts containing PII were exposed |
| Resend | security@resend.com | Notify if email delivery breach exposes personal data |
| Inngest | support@inngest.com | Notify if job queue data breach exposes personal data |

---

## 8. INFORMATION REGULATOR NOTIFICATION TEMPLATE

```
TO: Information Regulator of South Africa
    inforeg@justice.gov.za

FROM: [YOUR NAME], Information Officer
      Mirembe Muse (Pty) Ltd t/a AdminOS
      [YOUR EMAIL] | [YOUR PHONE]

DATE: [DATE OF NOTIFICATION]
SUBJECT: Security Compromise Notification — POPIA Section 22

1. DESCRIPTION OF COMPROMISE:
   [Describe what happened, when it was discovered, and how]

2. CATEGORIES OF DATA SUBJECTS AFFECTED:
   [ ] Customers of Mirembe Muse (Pty) Ltd
   [ ] Employees/contractors of Mirembe Muse (Pty) Ltd
   [ ] Third parties (customers' clients, staff, contacts)
   Approximate number of data subjects: [NUMBER]

3. CATEGORIES OF PERSONAL INFORMATION INVOLVED:
   [ ] Basic identifiers (name, email, phone)
   [ ] Financial information
   [ ] Employment information
   [ ] Health/wellness information
   [ ] Special categories (race, ethnicity)
   Approximate number of records: [NUMBER]

4. LIKELY CONSEQUENCES:
   [Describe the harm that may result — identity theft risk, financial fraud, etc.]

5. MEASURES TAKEN OR PROPOSED:
   [Describe containment, remediation, and prevention steps]

6. CONTACT FOR FURTHER INFORMATION:
   [YOUR NAME], Information Officer
   [YOUR EMAIL] | [YOUR PHONE]
   [COMPANY REGISTERED ADDRESS]

Yours sincerely,
[YOUR SIGNATURE]
[YOUR NAME]
Information Officer — Mirembe Muse (Pty) Ltd
```

---

## 9. DATA SUBJECT NOTIFICATION TEMPLATE

**For tenants (account holders):**

```
Subject: Important Security Notice — AdminOS

Dear [Tenant Name],

We are writing to inform you of a security incident that may have affected
your AdminOS account.

WHAT HAPPENED:
[Plain-language description of the breach]

WHAT INFORMATION WAS INVOLVED:
[Specific categories of data — be specific, not vague]

WHAT WE HAVE DONE:
[Steps taken to contain and remediate]

WHAT YOU SHOULD DO:
1. Change your AdminOS password immediately at: adminos.co.za/login
2. Review your account for any unauthorised activity
3. [Any other specific action relevant to the breach type]

If any of your customers' personal information was involved, you should
notify them as their responsible party under POPIA.

We sincerely apologise for this incident. We are available to answer
any questions at [YOUR EMAIL] or [YOUR PHONE].

[YOUR NAME]
Information Officer — AdminOS / Mirembe Muse (Pty) Ltd
```

---

## 10. BREACH REGISTER

*All incidents must be recorded here regardless of severity or whether notification was required.*

| Date | Incident Description | Severity | Data Subjects Affected | Categories of Data | Regulator Notified | Subjects Notified | Resolved Date | Root Cause |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

---

## 11. PLAN REVIEW

This plan must be reviewed:
- Annually (see POPIA Annual Review checklist)
- After any security incident
- When AdminOS adds new data categories or processing activities
- When significant new integrations are added

**Next scheduled review:** June 2027

---

*Approved by:* [YOUR NAME], Registered Information Officer, Mirembe Muse (Pty) Ltd
*Date:* June 2026
*Version:* 1.0
