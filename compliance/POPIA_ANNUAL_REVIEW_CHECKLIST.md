# POPIA Annual Compliance Review Checklist
**Mirembe Muse (Pty) Ltd t/a AdminOS**
*Conduct every June. File completed checklist with date and IO signature.*

---

## HOW TO USE THIS CHECKLIST

Work through each section once per year. For each item:
- ✅ **Done** — compliant, no action needed
- ⚠️ **Needs attention** — partially compliant or due for update
- ❌ **Not done** — action required (add to compliance task list in AdminOS)

Target: all items ✅ before filing the completed checklist.

---

## SECTION A — ACCOUNTABILITY & GOVERNANCE

| # | Item | Status | Notes / Action |
|---|---|---|---|
| A1 | Information Officer is registered with the Information Regulator | | Reg no: _______ |
| A2 | IO's contact details are current and accessible to data subjects | | Review adminos.co.za/privacy |
| A3 | PAIA Manual is up to date and published on website | | Last updated: _______ |
| A4 | This Annual Review Checklist was completed last year | | Last completed: _______ |
| A5 | All new staff/contractors have been briefed on POPIA obligations | | Training dates: _______ |
| A6 | POPIA obligations are included in all employment contracts and contractor agreements | | |

---

## SECTION B — CONDITIONS FOR LAWFUL PROCESSING

| # | Item | Status | Notes |
|---|---|---|---|
| B1 | We have identified the lawful basis for processing each category of personal information we hold | | |
| B2 | Where consent is the lawful basis, consent records are maintained and are withdrawable | | |
| B3 | Personal information is only collected for a specific, explicitly defined, and lawful purpose | | |
| B4 | We do not process more personal information than is necessary for the purpose (data minimisation) | | |
| B5 | Personal information is not retained for longer than necessary — retention periods are documented | | |
| B6 | Retention periods have been reviewed this year and records past their retention date have been deleted | | |

**Retention periods currently in use:**

| Data Category | Retention Period | Legal Basis |
|---|---|---|
| Tenant account data | Duration of subscription + 5 years | Contractual + tax law |
| Deleted tenant data (POPIA erasure) | 30 days after erasure request | Processing for compliance |
| Audit logs | 5 years | POPIA accountability requirement |
| Employee records | 5 years after employment ends | BCEA Section 31 |
| Financial records | 5 years | Tax Administration Act |
| WhatsApp conversation logs | 12 months active + 12 months archived | Legitimate interest |
| AI usage logs | 24 months | Legitimate interest (fraud/abuse investigation) |

---

## SECTION C — DATA SUBJECT RIGHTS

| # | Item | Status | Notes |
|---|---|---|---|
| C1 | Data subjects can access their personal information (PAIA/POPIA request process is documented) | | |
| C2 | Data subjects can correct inaccurate personal information (mechanism exists) | | |
| C3 | Data subjects can request deletion — POPIA erasure tool is functional in AdminOS settings | | Test the tool: _______ |
| C4 | Data subjects can object to processing — process is documented | | |
| C5 | All data subject requests received this year have been responded to within 30 days | | Requests received: _____ |
| C6 | No data subject complaints have been escalated to the Information Regulator (if there were, document outcome) | | |

---

## SECTION D — SECURITY SAFEGUARDS

| # | Item | Status | Notes |
|---|---|---|---|
| D1 | Supabase Row-Level Security (RLS) policies have been audited — no cross-tenant data leaks possible | | Last audit date: _______ |
| D2 | All API keys, Supabase service keys, and secrets have been rotated in the past 12 months | | Last rotation: _______ |
| D3 | Supabase project is in af-south-1 (data residency within South Africa) | | |
| D4 | Document storage uses signed URLs with expiry (not publicly accessible permanent links) | | URL TTL: _______ |
| D5 | No personal information is included in application logs | | Last log review: _______ |
| D6 | Penetration test has been conducted (mandatory before 1,000 tenants) | | Date: _______ / Not yet (tenants: ___) |
| D7 | Cyber liability insurance is in place | | Provider: _______ |
| D8 | All staff/contractors have unique login credentials — no shared accounts | | |
| D9 | Multi-factor authentication is available and encouraged for all AdminOS accounts | | |
| D10 | Supabase backups are configured and tested | | Last backup test: _______ |

---

## SECTION E — INFORMATION OFFICERS & THIRD PARTIES (OPERATORS)

| # | Item | Status | Notes |
|---|---|---|---|
| E1 | All third-party processors (Supabase, Vercel, Anthropic, Resend, Inngest, Meta) have data processing agreements in place | | |
| E2 | Third-party processors' data processing terms have been reviewed for POPIA compliance this year | | |
| E3 | No new third-party processors have been added without POPIA review | | New processors added: _______ |
| E4 | Operator agreements with AdminOS tenants (they are responsible parties; we are the operator) are covered in our Terms of Service | | Last ToS update: _______ |
| E5 | Cross-border data transfers: if any personal information leaves SA, it is to jurisdictions with adequate protection or with specific safeguards | | Anthropic API: US transfer — covered by Anthropic DPA |

---

## SECTION F — PRIVACY NOTICES & TRANSPARENCY

| # | Item | Status | Notes |
|---|---|---|---|
| F1 | Privacy Policy on adminos.co.za is current — reflects all actual data processing activities | | Last updated: _______ |
| F2 | Privacy Policy accurately describes: what data is collected, why, how long it is kept, data subject rights | | |
| F3 | Cookie consent banner is functional and accurate | | |
| F4 | Tenants are informed that they are responsible parties for their own customers' data (ToS + onboarding) | | |
| F5 | Marketing communications include an unsubscribe mechanism | | |
| F6 | Any direct marketing using personal information has the data subject's consent or is within the B2B exception | | |

---

## SECTION G — BREACH RESPONSE READINESS

| # | Item | Status | Notes |
|---|---|---|---|
| G1 | Breach Response Plan is current and has been reviewed this year | | Last reviewed: _______ |
| G2 | Breach notification templates (for Information Regulator + data subjects) are ready to use | | |
| G3 | The breach register has been reviewed — all incidents are documented | | Incidents this year: _____ |
| G4 | If any breaches occurred: Information Regulator was notified within 72 hours | | |
| G5 | If any breaches occurred: affected data subjects were notified as required | | |
| G6 | Post-incident improvements from any breaches have been implemented | | |

---

## SECTION H — SPECIAL CATEGORIES OF INFORMATION

POPIA Section 26 imposes stricter requirements on processing of special personal information:
religious/philosophical beliefs, race/ethnic origin, trade union membership, political persuasion, health/sex life, biometric information, criminal behaviour.

AdminOS may process:
- **Health information** — wellness scores, staff sick leave
- **Race/ethnic origin** — Employment Equity demographic data
- **Biometric information** — Face ID/fingerprint for Expo app login

| # | Item | Status | Notes |
|---|---|---|---|
| H1 | Wellness scores are collected with explicit staff consent | | Consent captured in: _______ |
| H2 | EE demographic data is collected with explicit consent and used only for EE reporting purposes | | |
| H3 | Biometric authentication is opt-in and biometric data is never transmitted to AdminOS servers (processed on-device only by iOS/Android) | | |
| H4 | No special category information is used for automated decision-making without human oversight | | |

---

## SECTION I — NEW PRODUCTS, FEATURES & PROCESSING ACTIVITIES

Review all features launched since the last annual review:

| # | Item | Status | Notes |
|---|---|---|---|
| I1 | A Privacy Impact Assessment (PIA) was conducted before launching any new data processing activity | | Features launched: _______ |
| I2 | The Stokvel Module (if launched): member data collected with consent, retention period set | | |
| I3 | The Payroll Lite Module (if launched): payslip data security and retention reviewed | | |
| I4 | The eSignature Module (if launched): signature audit trail meets ECTA requirements | | |
| I5 | The Social Inbox (if launched): Facebook/Instagram data processing agreements reviewed | | |
| I6 | The Expo Mobile App (if launched): device permissions match stated purposes, on-device data security reviewed | | |
| I7 | Langa AI interactions: no personal information is retained in Claude API beyond the request (Anthropic's zero-retention policy confirmed) | | |
| I8 | Any new country expansions: local data protection law assessment completed | | |

---

## SECTION J — ANNUAL ACTIONS

Complete these tasks as part of every annual review:

| # | Action | Done | Date |
|---|---|---|---|
| J1 | Update this checklist with any new items relevant to the past year's changes | | |
| J2 | Update PAIA Manual if any categories of records have changed | | |
| J3 | Update Privacy Policy if any processing activities have changed | | |
| J4 | Review and update data retention schedules | | |
| J5 | Rotate all API keys and service credentials | | |
| J6 | Run Supabase RLS audit query to confirm tenant isolation | | |
| J7 | Test the POPIA erasure endpoint — confirm it deletes all personal data for a test contact | | |
| J8 | Brief all new staff/contractors on POPIA obligations | | |
| J9 | Review third-party processor data processing agreements for any changes | | |
| J10 | File the completed checklist with the IO signature | | |

---

## SIGN-OFF

**Review completed by:** ___________________________

**Name:** [YOUR NAME]

**Role:** Registered Information Officer, Mirembe Muse (Pty) Ltd

**Date:** _______________________

**Review period:** 1 June [YEAR] — 31 May [YEAR+1]

**Overall compliance status:**
- [ ] Fully compliant — all items ✅
- [ ] Substantially compliant — minor items outstanding (listed below)
- [ ] Needs work — significant items outstanding (listed below)

**Outstanding items / actions required:**

| Item # | Description | Responsible | Target Date |
|---|---|---|---|
| | | | |
| | | | |

**Next review due:** June [YEAR+1]

---

*File this completed checklist in: AdminOS repo → compliance/ folder with filename: `POPIA_REVIEW_[YEAR].md`*
*Send a copy to: [YOUR EMAIL] for your records*
