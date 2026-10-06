import { useEffect, useState } from 'react'
import { Alert, Linking, Switch, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Application from 'expo-application'
import * as Updates from 'expo-updates'
import { useMe } from '@/hooks/useMe'
import { useSession } from '@/store/session'
import { biometricsAvailable, isAppLockEnabled, setAppLockEnabled } from '@/hooks/useAppLock'
import { PRIVACY_URL, TERMS_URL, SUPPORT_EMAIL, STORE } from '@/lib/config'
import { Screen, Card, Button, Row, Divider, ListRow, SectionTitle, C } from '@/components/ui'

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', manager: 'Manager', staff: 'Staff', field_agent: 'Field agent', client: 'Client' }

export default function AccountScreen() {
  const { data: me } = useMe()
  const signOut = useSession((s) => s.signOut)
  const [lock, setLock] = useState(false)
  const [canLock, setCanLock] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    isAppLockEnabled().then(setLock)
    biometricsAvailable().then(setCanLock).catch(() => setCanLock(false))
  }, [])

  async function toggleLock(on: boolean) {
    await setAppLockEnabled(on)
    setLock(on)
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'Saved information is removed from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { setSigningOut(true); await signOut() } },
    ])
  }

  const login = me?.user.email?.endsWith('@staff.adminos.co.za') ? me.user.email.split('@')[0] : me?.user.email

  return (
    <Screen title="Account" back>
      <Card>
        <Text className="text-white text-lg font-bold">{me?.staff?.fullName ?? me?.user.name ?? '—'}</Text>
        <Text className="text-slate-400 text-sm">{me?.tenant.name ?? ''}</Text>
        <Divider />
        <Row label="Login" value={login ?? '—'} />
        <Row label="Role" value={ROLE_LABEL[me?.role ?? ''] ?? me?.role ?? '—'} />
        {me?.staff?.jobTitle ? <Row label="Job title" value={me.staff.jobTitle} /> : null}
      </Card>

      <SectionTitle>Security</SectionTitle>
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-white">Lock with fingerprint / face</Text>
            <Text className="text-slate-500 text-xs mt-0.5">
              {canLock ? 'Asks to unlock when you open the app.' : 'Set up a fingerprint or face unlock on your phone first.'}
            </Text>
          </View>
          <Switch value={lock} onValueChange={toggleLock} disabled={!canLock} trackColor={{ true: C.brand }} accessibilityLabel="App lock" />
        </View>
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card className="py-1">
        <ListRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <Divider />
        <ListRow icon="document-text-outline" title="Terms of service" onPress={() => Linking.openURL(TERMS_URL)} />
        <Divider />
        <ListRow icon="mail-outline" title="Contact support" subtitle={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
      </Card>

      <Button label="Sign out" variant="secondary" icon="log-out-outline" loading={signingOut} onPress={confirmSignOut} />
      <Button label="Delete my account" variant="ghost" onPress={() => router.push('/delete-account')} />

      <Text className="text-slate-600 text-xs text-center mt-2">
        AdminOS {Application.nativeApplicationVersion ?? ''} ({Application.nativeBuildVersion ?? ''}) · {STORE === 'huawei' ? 'AppGallery' : 'Google Play'}
        {Updates.updateId ? ` · ${Updates.updateId.slice(0, 8)}` : ''}
      </Text>
    </Screen>
  )
}
