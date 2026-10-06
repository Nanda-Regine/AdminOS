import 'react-native-url-polyfill/auto'
import { AppState } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import { chunkedSecureStorage } from './secureStorage'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

/**
 * Auth only. The app never queries tables directly — every read and write goes
 * through the AdminOS API (lib/api.ts) so it gets the same role checks,
 * validation and audit log as the web app. Placeholder values keep the module
 * importable in a misconfigured build; the root layout shows CONFIG_ERROR.
 */
export const supabase = createClient(
  SUPABASE_URL || 'https://not-configured.invalid',
  SUPABASE_ANON_KEY || 'not-configured',
  {
    auth: {
      storage: chunkedSecureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
)

// Refresh tokens only while the app is in the foreground (Supabase's
// recommendation for React Native) — no background timers draining battery.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
