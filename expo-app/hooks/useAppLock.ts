import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

const KEY = 'adminos.applock'
/** Re-lock after this long in the background. */
const GRACE_MS = 2 * 60_000

export async function isAppLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY).catch(() => null)) === '1'
}

export async function setAppLockEnabled(on: boolean): Promise<void> {
  if (on) await SecureStore.setItemAsync(KEY, '1')
  else await SecureStore.deleteItemAsync(KEY)
}

export async function biometricsAvailable(): Promise<boolean> {
  const [hw, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ])
  return hw && enrolled
}

/**
 * Optional fingerprint / face lock (More → Account). A shared or lost phone
 * shouldn't open straight onto payslips. Locks on launch and after two
 * minutes in the background; the device PIN is the fallback, so a failed
 * sensor never locks someone out of their own app.
 */
export function useAppLock(active: boolean) {
  const [locked, setLocked] = useState(false)
  const backgroundedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!active) { setLocked(false); return }
    isAppLockEnabled().then((on) => on && setLocked(true))
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') backgroundedAt.current = Date.now()
      if (state === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > GRACE_MS) {
        if (await isAppLockEnabled()) setLocked(true)
      }
    })
    return () => sub.remove()
  }, [active])

  const unlock = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock AdminOS',
      fallbackLabel: 'Use device PIN',
      disableDeviceFallback: false,
    })
    if (r.success) setLocked(false)
    return r.success
  }, [])

  return { locked, unlock }
}
