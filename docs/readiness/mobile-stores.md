# AdminOS mobile - Google Play + Huawei AppGallery readiness audit

Audited 2026-10-24, read-only. App: `expo-app/` (Expo SDK 57, RN 0.86.3, package `za.co.adminos`, v1.0.0).
Evidence is cited as file:line. Anything not checked is marked UNVERIFIED.

Commands run: `npx expo config --type public` (OK, resolved config inspected). `npx tsc --noEmit` hit the 3-minute limit (exit 124), so it is UNVERIFIED locally; CI runs it (eas-build.yml "Type-check" step). `npx expo-doctor` was not run (time). GET-only probes of production.

## Verdict

- **Google Play: NOT READY - 1 code blocker + 3 console/asset blockers.** Everything else is in good shape.
- **Huawei AppGallery: NOT READY - same code blocker + enterprise-developer verification (not started, per STORE_LISTING.md). No push on Huawei (by design).**

## BLOCKERS

1. **API base URL is the apex domain, which 307-redirects to www. This probably breaks every authenticated call.**
   - `eas.json:7` and `expo-app/lib/config.ts:8` and `app.config.ts:122` all use `https://adminos.co.za`.
   - Probe: `GET https://adminos.co.za/api/me` returns `307 -> https://www.adminos.co.za/api/me` (and `/` redirects the same way).
   - Android's network stack (OkHttp under RN fetch) drops the `Authorization` header on a cross-host redirect. `lib/api.ts:174-183` relies on that header, and `middleware.ts:105-110` authenticates API calls only from the Bearer token.
   - Expected result: login itself works (Supabase direct), then every `/api/*` call returns 401, and `lib/api.ts:201` + `store/session.ts:294-296` sign the user straight back out. A reviewer would see a login loop.
   - Status: UNVERIFIED on a device (no build allowed), but the redirect is confirmed. This is the first thing the planned real-device test (STORE_LISTING.md section 3) would hit, so fix before building.
   - Fix (no code change needed): set `EXPO_PUBLIC_API_URL=https://www.adminos.co.za` in `eas.json` base env (and the default in `config.ts`/`app.config.ts`), or make the apex serve directly. Confirm the invite redeem POST (`lib/api.ts:227`) also follows it.
2. **No reviewer test account exists in the repo.** STORE_LISTING.md:124 says to provide one, but I found no seed/process (a repo-wide search for reviewer-login material found nothing in the files I checked; search was slow, so treat as UNVERIFIED). Play "App access" and AppGallery both reject apps reviewers cannot get into. Needed: an owner login and a staff login on a seeded tenant, with an active subscription (the API returns 402 for lapsed tenants, `lib/api.ts:204`), plus working payslip/leave data. Invite codes are single-use, so use password logins, not codes.
3. **Play push needs `GOOGLE_SERVICES_JSON` + FCM V1 credential** (`app.config.ts:60`, STORE_LISTING.md section 2). The listing confirms these are not yet done. Without them the Play build silently has no push (`usePushRegistration.ts:61-64` swallows the error), which contradicts the listing text "Approve leave ... from a notification". Not a rejection cause, but the headline owner feature will not work. UNVERIFIED whether the Firebase project exists.
4. **Store accounts/gates not yet cleared (cannot verify from code).** Play org account needs D-U-N-S; a personal account needs a 12-tester / 14-day closed test (STORE_LISTING.md:91). Huawei enterprise verification takes 1-3 working days. Start these now - they set the calendar.

## HIGH

1. **Privacy policy does not cover the app's data.** `app/privacy/page.tsx` has no mention of GPS/location, camera/receipt photos, push tokens or Expo/Firebase as processors (grep for gps/location/push/camera/receipt/device/mobile/expo/firebase returned only the Anthropic line). Play and AppGallery both compare the policy to the Data safety form; precise location is collected (`clock.tsx:42-49`). Add a mobile-app section before submission.
2. **Feature graphic is RGBA** (`assets/store/play-feature-graphic-1024x500.png`, 1024x500, 8-bit RGBA per `file`). Play requires JPEG or 24-bit PNG with no alpha. Re-export without alpha. It is also self-described as a placeholder (STORE_LISTING.md:155). Also needed: 2-8 phone screenshots (none in repo), and AppGallery screenshots.
3. **No crash reporting.** No Sentry or any crash SDK in `package.json`; grep for Sentry/ErrorBoundary in app/lib/hooks/components found nothing. No `ErrorBoundary` export in any route, so a render exception shows the default expo-router error screen. Play vitals will be the only crash signal. Recommend at least an ErrorBoundary export in `app/_layout.tsx` and a crash reporter (note: a new SDK means a Data safety update).
4. **Data safety form omits items the code collects/shares.** STORE_LISTING.md:103-113 lists nine types. Gaps to consider: crash/diagnostic data if Sentry is added; "Approximate vs precise location" is correct; Expo (push relay, OTA updates, receives IP/device info) and Firebase are listed as service providers - reasonable, but Anthropic (Langa AI advisor, `langa.tsx`) receives user messages server-side, so "Messages" should say shared with a processor, and the policy must name it (it does name Anthropic, privacy/page.tsx:120).
5. **Huawei without GMS: no push at all.** `usePushRegistration.ts:43` returns early for `STORE==='huawei'`. In-app notification list is the only channel; owners will miss approval requests unless they open the app. HMS Push Kit is not implemented (STORE_LISTING.md:60 says "later enhancement"). This will be a first-run complaint on Huawei, not a rejection. See Huawei section.
6. **Small tap targets.** `Button small` is `px-3 py-2` with 14px text (~36px tall, `components/ui/index.tsx:138`), and `Segmented` options are `py-2` (~36px, line 205); neither has hitSlop. Primary buttons (`py-3.5`) and the Back button (36px + hitSlop 12) are fine. Below Play's 48dp / WCAG 44px guidance but not a rejection reason. Pressable `Card` rows have no accessibilityLabel (role only, `ui/index.tsx:95`).
7. **`tsc --noEmit` not confirmed locally.** Timed out at 3 minutes on this laptop. CI covers it; check the latest CI run is green before building.

## MEDIUM

1. **Target SDK.** `app.config.ts:112` comment claims SDK 57 defaults to targetSdk 36. Verified in `node_modules/react-native/gradle/libs.versions.toml:4-5` (targetSdk 36, compileSdk 36). Meets the 31 Aug 2026 Play requirement. Confirm in the built AAB manifest.
2. **No ads / IAP / minors issues found.** No ad or billing libs in `package.json`. Audience 18+ is consistent. Listing says content rating "Everyone / 3+" while audience is 18+; fine for IARC but answer the questionnaire honestly about user-generated/shared messages (WhatsApp replies) and the AI advisor.
3. **Location has no in-app pre-prompt.** The OS dialog appears on first clock-in (`clock.tsx:43`) with only the manifest string. Foreground location does not require Play's prominent-disclosure screen, but a one-line explainer before the OS prompt is good practice and helps the Play permissions review. Denial is handled (returns undefined, clock-in proceeds, `clock.tsx:54`).
4. **No POPIA consent screen at first login.** `login.tsx:102` only links the privacy policy; there is no accept-terms step. Terms are linked from Account only (`account.tsx:68`). Acceptable for stores; weak for POPIA evidence. Employee data is processed on behalf of the employer, so consent may legitimately sit with the employer - flag for legal review.
5. **Deep links / assetlinks.** The scheme `adminos://` is declared (`app.config.ts:32`) but no https App Links intent filter and `https://www.adminos.co.za/.well-known/assetlinks.json` returns 404. Not needed for submission; invite flow uses a typed code. Only matters if you want tap-to-open links from WhatsApp.
6. **Shared versionCode.** `eas.json:2` remote source + `autoIncrement` on both `production` and `production-huawei`: one counter, so Play and Huawei will have different numbers for the same version. Fine; keep both on the same package/signing key.
7. **Offline query cache excludes sensitive data** (`queryClient.ts:108`) - good - but it also means pay, profile (`me`) and notifications show nothing offline after a cold start. `me` not persisted means the whole app shell lacks role info offline; first-run on a load-shedding day with no signal after app kill will show errors/empty. UNVERIFIED how each screen degrades.
8. **Android Auto Backup.** UNVERIFIED whether `allowBackup` is disabled; `store/session.ts:236-245` handles the restored-backup case for the cache, SecureStore is excluded from backup by default. Check the generated manifest.
9. **Account deletion for owners only removes the login** (`delete-account.tsx:117-121`). Play requires the data-deletion path to be clear: policy page explains it and gives an email route (account/delete page). Acceptable; keep wording consistent in the Data safety form ("users can request deletion; some data retained by employer").
10. **expo-doctor not run**; run it before the first EAS build.

## Huawei AppGallery specifics

- **GMS dependency in code:** push only (`expo-notifications`, FCM; skipped at `usePushRegistration.ts:43` when `STORE==='huawei'`; `googleServicesFile` only added for play, `app.config.ts:60`). No Google Maps, no Google sign-in (auth is Supabase email/password), location uses `expo-location` (no Maps SDK).
- **Without GMS:** app launches; push registration skipped; in-app notifications screen and pull-to-refresh are the channel. Location: expo-location normally uses Fused Location from GMS and falls back to the platform provider - UNVERIFIED on a real Huawei; the code tolerates failure (8s timeout, `clock.tsx:46-49`). expo-notifications still bundles the Firebase messaging library, which can log errors on non-GMS devices but should not crash - UNVERIFIED. OTA updates (expo-updates) use plain HTTPS and work.
- **Build/sign:** APK from `production-huawei` (`eas.json:34-41`), same package and EAS-managed keystore as Play. AppGallery accepts APK; no AGC signing config needed for upload. Back up the keystore (STORE_LISTING.md:181).
- **Listing:** enterprise developer verification (company docs), distribution to South Africa (not mainland China, which needs a software copyright certificate), privacy declaration mirrors Data safety, age rating 18+, 216x216 icon exists (`assets/store/appgallery-icon-216.png`). Huawei also asks for a privacy policy URL and typically a reviewer login. UNVERIFIED: AppGallery's current rule on apps that include FCM libraries without HMS Core; if flagged, add HMS Push Kit (`agconnect-services.json` is already git-ignored, `.gitignore`).
- **Same blocker 1 (apex redirect) applies.**

## What is ready

- Package/IDs/versioning: `za.co.adminos` (`app.config.ts:53`), remote versionCode with autoIncrement (`eas.json:2,21`), 64-bit by default on Expo 57.
- Play AAB profile exists (`eas.json:27-31`), Huawei APK profile (`eas.json:34-41`), manual EAS workflow with type-check (`.github/workflows/eas-build.yml`).
- targetSdk/compileSdk 36 (see Medium 1). Proguard + resource shrinking on (`app.config.ts:113-114`; resolved config also shows minify on).
- Permissions are minimal and justified: CAMERA, COARSE/FINE location, USE_BIOMETRIC/FINGERPRINT, POST_NOTIFICATIONS; 8 unused permissions explicitly blocked, including background location and media (`app.config.ts:61-80`). Every permission used in code (camera: expense receipts; location: clock-in; biometrics: app lock).
- **In-app account deletion** (`app/(app)/delete-account.tsx`, linked from `account.tsx:74`), typed confirmation, 30-day anonymisation, signs out. **Web deletion URL** `https://www.adminos.co.za/account/delete` returns 200 and describes both routes and retention. `/api/account/delete` exists (401 unauthenticated).
- Privacy `/privacy` and terms `/terms` return 200; both linked in-app (`account.tsx:66-68`, `login.tsx:102`).
- Secrets: no service-role key or secrets in the app; only public Supabase URL/anon key via EAS env vars (`lib/config.ts:9-10`); Cloudflare/Google service files git-ignored. Hardcoded dev URLs: none found (only fallbacks to production). Missing config shows a clear "AdminOS can't start" screen (`app/_layout.tsx:90-97`).
- Session security: tokens in Keystore via chunked SecureStore (`lib/secureStorage.ts`), cache wiped on sign-out and user change (`session.ts`), optional biometric lock (`useAppLock.ts`), push token revoked on sign-out.
- Offline / load-shedding: clock-in offline queue with true timestamps and failed-event visibility (`offlineQueue.ts`), reconnect flush (`_layout.tsx:80-88`), offline banner (`ui/index.tsx:78-87`), query cache with `offlineFirst`, 30s timeout with human error messages (`api.ts:163-186`), ErrorState/EmptyState/Loading components.
- Login/invite flow: staff login without email, formatted 8-char code, password rules mirrored from server, "forgot password" via new code (`login.tsx`, `invite.tsx`). Accessibility labels on inputs, header roles, live regions.
- Assets: icon 1024, adaptive icon + monochrome 1024, splash, notification icon 96, Play icon 512, AppGallery icon 216 (all present, PNG).
- Reviewer-facing: portrait only, no ads, no IAP, no tracking SDKs.

## Copy-paste store listing checklist

### Before building
- [ ] Set `EXPO_PUBLIC_API_URL=https://www.adminos.co.za` (Blocker 1), or make the apex serve API traffic without redirect.
- [ ] Confirm EAS env vars exist in the production environment: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `GOOGLE_SERVICES_JSON` (file, production), `EAS_PROJECT_ID` (optional, defaulted).
- [ ] Apply the 3 pending Supabase migrations listed in STORE_LISTING.md section 0 (note: Session 19 memory says they were applied 2026-10-06 - confirm).
- [ ] Run `npx expo-doctor` and confirm CI type-check is green.
- [ ] Build `preview` APK, run the STORE_LISTING.md section 3 device walk (ideally a Huawei without GMS too).
- [ ] Create seeded reviewer tenant: owner login + staff login, active subscription, sample payslip/leave/task/expense, and written reviewer instructions.

### Google Play Console
- [ ] App: AdminOS, App, Free, English (South Africa), category Business
- [ ] Short (<=80): `Payslips, leave, clock-in and approvals for South African small businesses.`
- [ ] Full description: STORE_LISTING.md:134-150
- [ ] Hi-res icon 512 (`assets/store/play-icon-512.png`), feature graphic 1024x500 re-exported WITHOUT alpha, 2-8 phone screenshots (Home owner, Approvals, Clock, Leave request, Payslip)
- [ ] Privacy policy URL: `https://www.adminos.co.za/privacy` (add mobile data section first)
- [ ] Account deletion URL: `https://www.adminos.co.za/account/delete`
- [ ] App access: reviewer owner + staff credentials and instructions
- [ ] Ads: No. IAP: none. Target audience: 18+. Content rating questionnaire. News/Government/Health apps: No. Financial features: none
- [ ] Data safety: STORE_LISTING.md:103-113 (encrypted in transit: yes; deletion available: yes); align with updated policy
- [ ] Permissions declaration: location foreground only, camera for receipts
- [ ] Upload AAB to internal testing, then closed testing (14 days / 12 testers if personal account)
- [ ] Contact: privacy@mirembemuse.co.za, website https://www.adminos.co.za

### Huawei AppGallery Connect
- [ ] Enterprise developer verification complete
- [ ] New app: Android, package `za.co.adminos`, category Business, age 18+
- [ ] Upload APK from `production-huawei`
- [ ] Icon 216x216, screenshots, same description; privacy policy URL; countries: South Africa (not mainland China)
- [ ] Reviewer login; note that push is not available on Huawei devices in v1.0
- [ ] Privacy/data declarations mirror Data safety (location optional, photos optional, device ID not collected on this build)

### After launch
- [ ] Set `NEXT_PUBLIC_PLAY_STORE_URL` / `NEXT_PUBLIC_APPGALLERY_URL`
- [ ] Back up the EAS keystore
- [ ] Consider HMS Push Kit, Sentry, assetlinks.json
