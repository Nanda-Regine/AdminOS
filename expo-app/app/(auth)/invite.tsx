import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { publicPost, errorMessage } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Button, Field, C } from '@/components/ui'
import { Ionicons } from '@expo/vector-icons'

/** Same rule the server enforces (lib/people/invites.ts passwordProblem). */
function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.'
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use at least one letter and one number.'
  return null
}

export default function InviteScreen() {
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onCode(v: string) {
    // Show the code the way it was sent: ABCD-EFGH.
    const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    setCode(raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw)
  }

  async function redeem() {
    setError(null)
    if (code.replace('-', '').length !== 8) { setError('Enter the 8-character code from your employer.'); return }
    const pw = passwordProblem(password)
    if (pw) { setError(pw); return }
    if (password !== confirm) { setError('The passwords don’t match.'); return }

    setLoading(true)
    try {
      const r = await publicPost<{ loginEmail: string; generatedLogin?: boolean; reset?: boolean }>(
        '/api/auth/invite/redeem',
        { code, password, email: email.trim() || undefined },
      )
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: r.loginEmail, password })
      const loginId = r.loginEmail.endsWith('@staff.adminos.co.za') ? r.loginEmail.split('@')[0] : r.loginEmail
      if (r.generatedLogin) {
        Alert.alert('Save your login', `Your staff login is:\n\n${loginId}\n\nWrite it down — you’ll need it with your password to sign in on another phone.`)
      } else if (r.reset) {
        Alert.alert('Password updated', `Sign in with ${loginId} and your new password.`)
      }
      if (signInError) router.replace('/login')
      // Otherwise the session listener routes into the app.
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-navy-900">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="px-6 py-6 gap-4" keyboardShouldPersistTaps="handled">
          <Button label="Back to sign in" variant="ghost" icon="chevron-back" small onPress={() => router.back()} />
          <View className="flex-row items-center gap-3">
            <Ionicons name="key-outline" size={28} color={C.brand} />
            <Text accessibilityRole="header" className="text-white text-2xl font-bold">Join your team</Text>
          </View>
          <Text className="text-slate-400 leading-5">
            Enter the code your employer sent you on WhatsApp, then choose a password. If you already have a login,
            the code resets your password.
          </Text>

          <Field
            label="Invite code"
            value={code}
            onChangeText={onCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ABCD-EFGH"
            maxLength={9}
            style={{ letterSpacing: 4, fontSize: 20 }}
          />
          <Field
            label="Email (optional)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
            hint="No email? Leave this empty and we’ll give you a staff login."
          />
          <Field label="Choose a password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters, with a letter and a number." />
          <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={redeem} />

          {error ? <Text accessibilityLiveRegion="assertive" className="text-red-300 text-sm">{error}</Text> : null}
          <Button label="Continue" onPress={redeem} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
