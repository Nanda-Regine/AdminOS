import * as SecureStore from 'expo-secure-store'

/**
 * Supabase session storage in the OS keystore (Android Keystore / iOS
 * Keychain), chunked.
 *
 * SecureStore values over ~2 KB are unreliable on Android, and a Supabase
 * session (access + refresh token + user JSON) is usually larger — storing it
 * whole silently failed, so users were signed out on every restart. The value
 * is split into ≤1800-char chunks under `${key}.0`, `${key}.1`, … with the
 * chunk count in `${key}.n`.
 *
 * Tokens never touch AsyncStorage (plain files on the device).
 */
const CHUNK = 1800
// SecureStore keys allow only [A-Za-z0-9._-].
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_')

export const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safe(key)
    const n = Number(await SecureStore.getItemAsync(`${k}.n`))
    if (!n) return null
    const parts: string[] = []
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`)
      if (part == null) return null // torn write — treat as signed out
      parts.push(part)
    }
    return parts.join('')
  },

  async setItem(key: string, value: string): Promise<void> {
    const k = safe(key)
    const old = Number(await SecureStore.getItemAsync(`${k}.n`)) || 0
    const n = Math.max(1, Math.ceil(value.length / CHUNK))
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
    }
    await SecureStore.setItemAsync(`${k}.n`, String(n))
    for (let i = n; i < old; i++) await SecureStore.deleteItemAsync(`${k}.${i}`)
  },

  async removeItem(key: string): Promise<void> {
    const k = safe(key)
    const n = Number(await SecureStore.getItemAsync(`${k}.n`)) || 0
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`)
    await SecureStore.deleteItemAsync(`${k}.n`)
  },
}
