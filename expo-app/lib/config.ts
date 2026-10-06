import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; store?: string; eas?: { projectId?: string } }

/** Which store this binary was built for (app.config.ts APP_STORE). */
export const STORE: 'play' | 'huawei' = extra.store === 'huawei' ? 'huawei' : 'play'

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || 'https://adminos.co.za').replace(/\/$/, '')
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const EAS_PROJECT_ID = extra.eas?.projectId ?? null

/**
 * A build missing its public Supabase values can't sign anyone in. The root
 * layout shows this instead of a login screen that fails mysteriously.
 */
export const CONFIG_ERROR: string | null =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? 'This build is missing its server configuration (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).'
    : null

export const SUPPORT_EMAIL = 'privacy@mirembemuse.co.za'
export const PRIVACY_URL = 'https://adminos.co.za/privacy'
export const TERMS_URL = 'https://adminos.co.za/terms'
export const DELETE_ACCOUNT_URL = 'https://adminos.co.za/account/delete'
export const WEB_SIGNUP_URL = 'https://adminos.co.za/signup'
