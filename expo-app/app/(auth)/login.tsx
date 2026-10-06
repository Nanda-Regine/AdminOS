import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Button, Field } from '@/components/ui'
import { SUPPORT_EMAIL, WEB_SIGNUP_URL, PRIVACY_URL } from '@/lib/config'

const STAFF_DOMAIN = 'staff.adminos.co.za'

/** "thandi.k7p2" → "thandi.k7p2@staff.adminos.co.za" (staff logins without email). */
function toLoginEmail(input: string): string {
  const v = input.trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${STAFF_DOMAIN}`
}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email or password is incorrect.'
  if (/banned|suspended/i.test(message)) return 'This login has been disabled. Contact your employer or AdminOS support.'
  if (/network|fetch/i.test(message)) return 'You appear to be offline. Check your connection and try again.'
  if (/rate|too many/i.test(message)) return 'Too many attempts. Please wait a few minutes and try again.'
  return message
}

export default function LoginScreen() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    if (!login.trim() || !password) { setError('Enter your email (or staff login) and password.'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: toLoginEmail(login), password })
    setLoading(false)
    if (err) setError(friendlyAuthError(err.message))
    // On success the session listener in the root layout routes to the app.
  }

  function forgot() {
    Alert.alert(
      'Forgot your password?',
      'Employees: ask your employer to send you a new app code — entering it lets you choose a new password.\n\nBusiness owners: email us from your account’s address and we’ll help you back in.',
      [
        { text: 'I have a new code', onPress: () => router.push('/invite') },
        { text: 'Email support', onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=AdminOS%20password%20help`) },
        { text: 'Close', style: 'cancel' },
      ],
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-navy-900">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10" keyboardShouldPersistTaps="handled">
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-brand items-center justify-center mb-4">
              <Text className="text-white text-3xl font-extrabold">A</Text>
            </View>
            <Text accessibilityRole="header" className="text-white text-2xl font-bold">AdminOS</Text>
            <Text className="text-slate-400 text-sm mt-1">Your work, pay and team — in your pocket</Text>
          </View>

          <View className="gap-4">
            <Field
              label="Email or staff login"
              value={login}
              onChangeText={setLogin}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="username"
              textContentType="username"
              placeholder="you@business.co.za"
              returnKeyType="next"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              placeholder="••••••••"
              returnKeyType="go"
              onSubmitEditing={signIn}
            />
            {error ? <Text accessibilityLiveRegion="assertive" className="text-red-300 text-sm">{error}</Text> : null}
            <Button label="Sign in" onPress={signIn} loading={loading} />
            <Pressable onPress={forgot} accessibilityRole="button" className="items-center py-2">
              <Text className="text-brand-light text-sm">Forgot password?</Text>
            </Pressable>
          </View>

          <View className="mt-8 gap-3">
            <Button label="I have an invite code" variant="secondary" icon="key-outline" onPress={() => router.push('/invite')} />
            <Text className="text-slate-500 text-xs text-center leading-5">
              Business owner?{' '}
              <Text className="text-brand-light" onPress={() => Linking.openURL(WEB_SIGNUP_URL)}>Create your business on the web</Text>
              , then sign in here.{'\n'}
              <Text className="text-slate-500 underline" onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
