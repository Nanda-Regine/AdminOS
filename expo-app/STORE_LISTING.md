# AdminOS mobile — store submission guide

Everything needed to ship `expo-app/` to **Google Play** and **Huawei AppGallery**.
Code-side readiness is done (see BUILD_JOURNEY_ADMINOS.md, Session 19). What's
left is account setup and console forms only the account owner can do.

- Android package (permanent once published): **`za.co.adminos`**
- App name: **AdminOS** · Category: **Business** · Audience: **18+**
- Privacy policy: https://adminos.co.za/privacy
- Account deletion page: https://adminos.co.za/account/delete
- Support email: privacy@mirembemuse.co.za

---

## 0. Before any build — server prerequisites

1. **Apply** `supabase/migrations/20261005_mobile_app_foundations.sql` in the
   Supabase SQL editor (leave types, invite codes, account deletion, private
   receipts bucket, push-token revocation). Without it, leave requests,
   invites, deletion and receipt uploads fail.
2. **Apply** the pending role-aware RLS migrations
   (`20261004_lock_down_rls_disabled_tables.sql`,
   `20261005_role_aware_rls_people.sql`). The app no longer reads tables
   directly, but those tables are reachable with the public anon key until
   the migrations are applied.
3. Deploy the web app (the mobile API routes ship with it). The Vercel deploy
   webhook has been unreliable; trigger a deploy manually if needed.

## 1. One-time setup (≈1 hour)

```bash
npm i -g eas-cli
eas login                      # Expo account (create one at expo.dev, free)
cd expo-app
eas init                       # creates the EAS project; note the project ID it prints
```

Set the build environment variables on expo.dev → Project → Environment
variables (all three environments: development, preview, production):

| Name | Value | Visibility |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | same as `NEXT_PUBLIC_SUPABASE_URL` in Vercel | Plain text |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Plain text (it's public by design) |
| `EAS_PROJECT_ID` | the ID from `eas init` | Plain text |
| `GOOGLE_SERVICES_JSON` | **file** — `google-services.json` from step 2 | Secret (production only) |

Never put the Supabase **service role** key in the app.

## 2. Push notifications (Google Play build)

1. console.firebase.google.com → Add project "AdminOS" → Add Android app with
   package `za.co.adminos` → download `google-services.json` → upload it as the
   `GOOGLE_SERVICES_JSON` file variable above.
2. Firebase → Project settings → Service accounts → Generate new private key.
   Then `eas credentials` → Android → production → Google Service Account →
   **FCM V1** → upload that JSON. (Expo uses it to deliver pushes.)
3. Huawei phones without Google services can't receive FCM. The AppGallery build
   (`APP_STORE=huawei`) skips push registration; users see everything in the
   in-app Notifications screen. HMS Push Kit is a later enhancement.

## 3. Test build on a real phone first

```bash
eas build -p android --profile preview      # installable APK, ~15 min
```

Install the APK, then walk this checklist on a real device (ideally a cheap
Android and a Huawei):

- [ ] Owner logs in → Home shows "Needs a decision" + money + health
- [ ] Web: Staff → a staff member → **Send app invite** → WhatsApp message
- [ ] On the employee phone: *I have an invite code* → code, no email, password → lands in app; the generated staff login is shown
- [ ] Employee: Clock in (allow & deny location both work) → airplane mode → Clock out → "Saved offline" → reconnect → event appears with the offline time
- [ ] Employee: Request sick leave Fri→Tue → shows 3 working days → owner gets a push → approves in **Approvals** → employee gets "Leave approved" push → annual balance **unchanged** (sick leave)
- [ ] Employee: New expense claim with receipt photo → owner opens receipt from Approvals
- [ ] Payslips visible only after a payroll run is **paid**
- [ ] Owner: Inbox → reply to a customer → arrives on WhatsApp
- [ ] Account → fingerprint lock on → background 3 min → asks to unlock
- [ ] Account → Delete my account (on a throwaway login) → signed out; login no longer works
- [ ] Sign out → sign in as a different user → no previous user's data visible

## 4. Google Play

1. play.google.com/console → Create app → AdminOS, App, Free.
   (Organisation account: needs a D-U-N-S number for Mirembe Muse (Pty) Ltd.)
2. `eas build -p android --profile production` → AAB. Upload to **Internal
   testing** first (or `eas submit -p android --profile production` with a
   Play service-account key saved as `expo-app/google-service-account.json`,
   which is git-ignored).
3. New personal developer accounts must run a **closed test with 12+ testers for
   14 days** before production access — start this early (staff of the beta
   tenants are ideal testers).
4. Complete the App content forms with the answers below.

### Data safety answers

Data is **encrypted in transit** (HTTPS only). Users **can request deletion**
(in-app: More → Account → Delete my account; web: /account/delete). No data is
sold or shared with third parties; Supabase, Vercel, Expo and Firebase are
service providers (not "sharing" under Play's definition).

| Data type | Collected | Optional? | Purpose |
|---|---|---|---|
| Personal info → Name | Yes | Required | Account management, app functionality |
| Personal info → Email address | Yes | Optional (staff can use a staff login) | Account management |
| Personal info → User IDs | Yes | Required | Account management |
| Location → Precise & Approximate | Yes | **Optional** (clock-in works without it) | App functionality (attendance) |
| Financial info → Other financial info | Yes | Required for the feature | App functionality (expense claims; invoice payments for owners) |
| Photos | Yes | Optional | App functionality (receipt photos) |
| Messages → Other in-app messages | Yes | Optional | App functionality (customer replies, AI advisor) |
| App activity → Other user-generated content | Yes | Required | App functionality (leave requests, tasks) |
| Device or other IDs | Yes | Optional (push permission) | App functionality (notifications) |

Location is collected **only in the foreground at the moment of a clock-in**;
background location is blocked in the manifest.

### Other forms
- **Content rating** (IARC): business/productivity, no user-to-public content,
  no ads → *Everyone / 3+*.
- **Target audience**: 18 and over. **Ads**: No.
- **Government app**: No. **Financial features**: none of the listed types
  (no loans, payments processing or crypto — invoices are records).
- **App access**: provide a reviewer login (owner + a linked staff login on the
  seeded test tenant) — Play rejects apps reviewers can't get into.
- **Permissions declaration**: Location — "Records where an employee clocks in
  or out, if they allow it; never in the background."

### Listing copy

**Short description (≤80):**
Payslips, leave, clock-in and approvals for South African small businesses.

**Full description:**
AdminOS puts your business admin in your pocket.

For employees — free:
• See your payslips the moment payroll is paid
• Request annual, sick and family-responsibility leave — weekends and public holidays are counted correctly
• Clock in and out, even during load-shedding (entries are saved offline and sent with the right time)
• Claim expenses with a photo of the receipt
• Read company announcements and policies; see your tasks

For owners and managers:
• Approve leave and expense claims from a notification
• See who owes you money and record payments
• Reply to customer WhatsApp conversations the AI hands over
• Ask Langa, your AI business advisor, about cash flow and compliance

Built for South African businesses: BCEA leave rules, SARS-ready payroll, POPIA-conscious privacy. Employees join with a code from their employer — no email address needed.

### Graphics
- Hi-res icon 512×512: `assets/store/play-icon-512.png`
- Feature graphic 1024×500: `assets/store/play-feature-graphic-1024x500.png`
  (generated placeholder — a designed version with a tagline will convert better)
- Phone screenshots (2–8, 1080×1920 or similar): capture from the preview
  build — Home (owner), Approvals, Clock, Leave request, Payslip.

## 5. Huawei AppGallery

1. developer.huawei.com → register and verify as an enterprise developer
   (company registration documents) — verification takes 1–3 working days.
2. AppGallery Connect → My apps → New app → Android, package `za.co.adminos`.
3. `eas build -p android --profile production-huawei` → APK. Upload under
   Version information → Software packages.
4. Distribution: select South Africa (and any other countries); not mainland
   China (that needs a Chinese software copyright certificate).
5. Fill privacy (same answers as Data safety), age rating 18+, category Business,
   icon `assets/store/appgallery-icon-216.png`, screenshots, and the same
   description. Provide the same reviewer login.
6. Review typically takes 3–5 working days.

## 6. After launch

- Set `NEXT_PUBLIC_PLAY_STORE_URL` and `NEXT_PUBLIC_APPGALLERY_URL` in Vercel —
  adminos.co.za/app (linked from every staff invite) switches from "coming soon"
  to real store buttons.
- Ship JS-only fixes over the air: `eas update --channel production` (and
  `production-huawei`). Native changes (new permissions, SDK upgrades) need a
  new store build.
- Back up the signing key: `eas credentials` → Android → Download keystore.
  Store it somewhere safe outside this repo.
- Every February: add the new tax year to `TAX_TABLES` (web) — payslips depend on it.
