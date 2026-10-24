# Privacy policy & terms — corrections needed before store / bank review

**Status: DRAFT for Nanda's review. Nothing here has been applied to `app/privacy/page.tsx` or `app/terms/page.tsx`.**
Legal copy is yours to approve, and items marked **[YOU]** need facts only you have.
Source: `docs/readiness/security-compliance.md` (every point below was traced to code there).

## 1. Decide the role model (privacy and terms currently contradict each other)

`app/privacy/page.tsx:60-62` calls Mirembe Muse the "responsible party"; `app/terms/page.tsx:149` says the
customer is the responsible party and AdminOS the "operator". The accurate split for a B2B SaaS is:

- **Your customer (the business) = responsible party** for *their* customers', staff and contacts' data that they put into AdminOS.
  **AdminOS (Mirembe Muse) = operator** for that data (POPIA s20–21: process only on their instructions, with security safeguards).
- **Mirembe Muse = responsible party** for its *own* data: account holders' sign-up details, billing and usage records, website analytics.

Say this once, in the same words, in both documents.

## 2. Sub-processors to list (the policy only names Vercel Analytics today)

| Processor | Purpose | Location | Notes |
|---|---|---|---|
| Supabase | Database + authentication | **[YOU: confirm region]** | core |
| Vercel (moving to Cloudflare) | Hosting | US / global edge | |
| Cloudflare | DNS, edge, Web Analytics beacon | global | beacon is cookieless |
| Anthropic (Claude) | AI replies, summaries | US | customer message text is sent |
| Groq, Google (Gemini) | AI cost routing | US | customer message text is sent (`lib/ai/callClaude.ts`, `costControls.ts`) |
| Meta (WhatsApp Cloud API) | WhatsApp messaging | US / global | |
| Twilio | Voice / SMS (Ring add-on) | US | |
| PayFast, Paystack | Payments | South Africa / Nigeria | |
| Resend | Transactional email | US | **key currently revoked — only list once email works** |
| Upstash | Rate limiting / cache | **[YOU: region]** | |
| Cloudinary | Image hosting | **[YOU: region]** | |
| PostHog | Product analytics | US | **only after "Accept all"** |
| Google Tag Manager / Analytics | Marketing/analytics tags | US | **only after "Accept all"** |
| Sentry | Error monitoring | US | **loads before consent today** — see §5 |

## 3. Add a POPIA s72 cross-border transfer section

Draft wording: *"Some of our service providers process personal information outside South Africa, mainly in the United
States. We only use providers that are bound by written agreements requiring protection substantially similar to POPIA
(s72(1)(b)), and we send AI providers only the text needed to produce a response. You can ask us for the list of
countries and providers at any time."* **[YOU: confirm you hold DPAs / standard terms with each provider before publishing this sentence.]**

## 4. Name a person and a real address

- Information Officer: `app/privacy/page.tsx:252` names the company, not a person. POPIA requires a natural person. **[YOU: name, email, phone.]**
- Physical address: `page.tsx:15` says only "South Africa". **[YOU: registered address.]**
- Information Regulator registration of the Information Officer: **[YOU: confirm done / do it at inforegulator.org.za.]**

## 5. Consent vs what actually loads

- PostHog and Google Tag Manager now load **only after "Accept all"**. Good; say so in the cookie section.
- **Sentry** (`app/layout.tsx:165`) loads before consent and sends IP + page URL to a third party. Either (a) disclose it as
  strictly-necessary security/stability monitoring, or (b) gate it behind consent like PostHog. Option (a) is defensible for
  error monitoring and is one sentence of policy; option (b) is a small code change. **[YOU: pick one.]**
- Vercel Analytics / Speed Insights load unconditionally (cookieless) — disclose.

## 6. Link the deletion page

`/account/delete` works on web and in the app, but neither policy links to it. Add: *"Delete your account and data:
https://www.adminos.co.za/account/delete"*, and use that exact URL in the Google Play and AppGallery consoles.

## 7. Claims that overpromise (fix the words or fix the code)

- "Purged within 30 days": true for the login only (`lib/account/deletion.ts:111-125` anonymises the auth user). Staff,
  contact and conversation rows remain (the delete page already says employer records stay). Reword: *"Your login and
  profile are removed within 30 days. Business records your employer or customer is legally required to keep are retained
  by them."*
- "Export your data at any time": no self-service export exists today. Reword to "on request" until it does.
- "WhatsApp messages deleted after 90 days": **UNVERIFIED** that a purge job runs — check before publishing.

## 8. Special personal information (POPIA s26)

Staff wellness check-ins are stored (`staff.wellness_scores`) and their text is sent to AI providers
(`lib/workflow/engine.ts:283-310`). That is health-adjacent. State: what is collected, that it is optional, that the
employer is the responsible party and must have the employee's consent, and that it is never used for discipline.

## 9. Store form answers

Google Play Data safety and Huawei AppGallery privacy declarations are pre-filled in
`docs/readiness/security-compliance.md` (bottom two sections). Use `https://www.adminos.co.za/privacy` and
`https://www.adminos.co.za/account/delete` once §1–§6 are published.
