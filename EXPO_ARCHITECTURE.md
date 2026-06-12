# AdminOS — Expo Mobile App Architecture
> Mirembe Muse (Pty) Ltd · June 2026

---

## Strategy: Two-App Architecture

AdminOS runs as **two applications sharing one backend**:

| App | Platform | Primary Users | Primary Use Cases |
|---|---|---|---|
| **Next.js Web** (adminos.co.za) | Web/Desktop | Owner, Manager | Full dashboard, analytics, settings, billing |
| **Expo Mobile** (App Store + Play Store) | iOS, Android, PWA | All users, especially staff + field | My Admin, Langa, owner quick view, field agent |

The Expo app is **also a PWA** — when opened in a mobile browser, it installs like a PWA. This means employees who cannot install from App Store still get the native-feeling experience.

---

## Monorepo Structure

```
adminos/
├── app/                         # Next.js web app (existing)
├── expo-app/                    # NEW: Expo mobile app
│   ├── app/                     # Expo Router screens
│   │   ├── (auth)/              # Login, signup
│   │   ├── (owner)/             # Owner tab group
│   │   │   ├── index.tsx        # Home — health score, KPIs
│   │   │   ├── inbox.tsx        # Conversations
│   │   │   ├── langa.tsx        # Langa mentor chat
│   │   │   └── invoices.tsx     # Quick invoicing
│   │   ├── (my-admin)/          # Employee tab group
│   │   │   ├── index.tsx        # My Admin home
│   │   │   ├── clock.tsx        # Clock in/out
│   │   │   ├── leave.tsx        # Leave management
│   │   │   ├── tasks.tsx        # My tasks
│   │   │   ├── expenses.tsx     # Expense claims
│   │   │   ├── pay.tsx          # Payslips
│   │   │   ├── documents.tsx    # My documents
│   │   │   ├── training.tsx     # My training
│   │   │   ├── handbook.tsx     # Company handbook
│   │   │   ├── announcements.tsx
│   │   │   └── team.tsx         # Team directory
│   │   ├── notifications.tsx
│   │   └── _layout.tsx          # Root layout
│   ├── components/              # RN components
│   ├── hooks/                   # Custom hooks
│   ├── app.json                 # Expo config
│   └── eas.json                 # EAS Build config
│
└── packages/                    # NEW: Shared code
    └── shared/
        ├── types/               # Shared TypeScript types (from types/database.ts)
        ├── supabase/            # Supabase client factory
        ├── api/                 # API call functions (shared between web + mobile)
        └── utils/               # Shared utilities
```

---

## Dependencies (Expo App)

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-camera": "~15.0.0",
    "expo-location": "~17.0.0",
    "expo-local-authentication": "~14.0.0",
    "expo-notifications": "~0.29.0",
    "expo-file-system": "~17.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-document-picker": "~12.0.0",
    "expo-updates": "~0.25.0",
    "expo-secure-store": "~13.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.5.0",
    "react-native-safe-area-context": "4.10.1",
    "react-native-screens": "3.31.1",
    "@react-native-async-storage/async-storage": "1.23.1"
  }
}
```

---

## app.json Configuration

```json
{
  "expo": {
    "name": "AdminOS",
    "slug": "adminos",
    "version": "1.0.0",
    "scheme": "adminos",
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/favicon.png"
    },
    "ios": {
      "bundleIdentifier": "co.adminos.app",
      "buildNumber": "1",
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "Used for scanning receipts and documents",
        "NSLocationWhenInUseUsageDescription": "Used for clock in/out location verification",
        "NSFaceIDUsageDescription": "Used for secure biometric login"
      }
    },
    "android": {
      "package": "co.adminos.app",
      "versionCode": 1,
      "permissions": ["CAMERA", "ACCESS_FINE_LOCATION", "USE_BIOMETRIC", "RECEIVE_BOOT_COMPLETED"],
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F172A"
      }
    },
    "plugins": [
      ["expo-camera", { "cameraPermission": "Required for receipt scanning" }],
      ["expo-location", { "locationWhenInUsePermission": "Required for clock-in verification" }],
      "expo-local-authentication",
      "expo-notifications",
      "expo-router",
      "expo-updates"
    ],
    "extra": {
      "eas": { "projectId": "YOUR_EAS_PROJECT_ID" },
      "supabaseUrl": "EXPO_PUBLIC_SUPABASE_URL",
      "supabaseAnonKey": "EXPO_PUBLIC_SUPABASE_ANON_KEY"
    }
  }
}
```

---

## Authentication Flow

```
App Opens
    │
    ▼
Check SecureStore for session token
    │
    ├── Token valid → skip to role detection
    │
    └── No token → Login screen
              │
              ▼
        Supabase Auth (email/password)
              │
              ▼
        Detect role from user_metadata:
          - owner/manager → Owner tab group
          - staff → My Admin tab group
              │
              ▼
        Offer biometric setup (Face ID / fingerprint)
        Store session in SecureStore (not AsyncStorage)
              │
              ▼
        Register Expo push token → /api/push/register
```

---

## Push Notifications Architecture

```
Business Event (Supabase trigger / Inngest)
    │
    ▼
Identify affected users (by tenant_id + role)
    │
    ▼
Query push_tokens table for their device tokens
    │
    ▼
Expo Push API (https://exp.host/--/api/v2/push/send)
    │
    ▼
Device receives push → deep link to relevant screen
```

**Notification types:**
- `leave_approved` → My Admin > My Leave
- `task_assigned` → My Admin > My Tasks
- `payslip_ready` → My Admin > My Pay
- `achievement_earned` → achievement modal
- `langa_insight` → Langa screen
- `invoice_paid` → owner dashboard
- `new_message` → inbox
- `compliance_due` → compliance calendar
- `low_stock` → inventory
- `health_score_update` → health screen
- `booking_reminder` → bookings
- `announcement_new` → announcements

---

## Offline Mode

The Expo app must work with **no internet connection** (load shedding resilience):

**Always cached locally (SecureStore + AsyncStorage):**
- User's profile
- Today's tasks (last sync)
- Team directory
- Company handbook / SOPs
- Last daily brief
- Payslip PDFs (downloaded on open)

**Offline action queue:**
- Clock in/out events queued → sync on reconnect
- Expense claim drafts → sync on reconnect
- Leave application drafts → sync on reconnect
- Langa messages queued → send on reconnect

**Sync strategy:**
- React Query: staleTime 5min, background refetch on focus
- Optimistic updates for status changes
- Conflict resolution: server wins for financial data, last-write-wins for profile

---

## PWA Configuration (Expo Web Output)

When employees access `app.adminos.co.za` on mobile browser:
- Service worker caches all critical assets
- "Add to Home Screen" prompt
- Works offline (same offline mode as native)
- Push notifications via Web Push API
- Geolocation for clock-in

---

## EAS Build Setup

```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_APP_STORE_CONNECT_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```

---

## App Store Submission Checklist

**iOS App Store:**
- [ ] Apple Developer account (R2,250/year)
- [ ] App icons: 1024×1024 + all sizes (auto-generated by EAS)
- [ ] Screenshots: 6.7" iPhone, 12.9" iPad
- [ ] Privacy policy URL: adminos.co.za/privacy
- [ ] Data usage disclosure (camera, location, biometrics)
- [ ] App Review notes: explain GPS + camera usage

**Google Play Store:**
- [ ] Google Play Developer account ($25 once-off)
- [ ] Feature graphic: 1024×500px
- [ ] Screenshots: phone + tablet
- [ ] Content rating: Everyone
- [ ] Data safety form (location, photos, files)

---

## Over-the-Air Updates (Expo Updates)

Critical for fixing bugs without App Store review delay:

```typescript
// app/_layout.tsx
import * as Updates from 'expo-updates'

// On app foreground: check for OTA update
useEffect(() => {
  async function checkUpdate() {
    const update = await Updates.checkForUpdateAsync()
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync()
      await Updates.reloadAsync()
    }
  }
  checkUpdate()
}, [])
```

OTA updates deploy in seconds. Use for:
- Bug fixes
- Content updates (Academy lessons)
- UI tweaks
- Framework library additions

Store updates required for:
- New native permissions
- New native modules
- Major version bumps

---

## Shared Supabase Client (packages/shared/supabase)

```typescript
// packages/shared/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

// Works in both Next.js (browser) and React Native
export function createSupabaseClient(storage?: any) {
  return createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: storage ?? undefined,
        autoRefreshToken: true,
        persistSession: true,
      }
    }
  )
}

// In Expo: pass ExpoSecureStoreAdapter
// In Next.js: use default cookie storage
```

---

*Last updated: June 2026 · Mirembe Muse (Pty) Ltd*
