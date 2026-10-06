import { useState } from 'react'
import { Alert, Linking, Text } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { api, errorMessage } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { useSession } from '@/store/session'
import { DELETE_ACCOUNT_URL, SUPPORT_EMAIL } from '@/lib/config'
import { Screen, Card, Button, Field } from '@/components/ui'

/** In-app account deletion (Google Play / AppGallery requirement). */
export default function DeleteAccountScreen() {
  const { data: me } = useMe()
  const signOut = useSession((s) => s.signOut)
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState('')
  const owner = me?.role === 'owner'

  const del = useMutation({
    mutationFn: () => api.post<{ purgeAfter: string }>('/api/account/delete', { confirm: 'DELETE', reason: reason.trim() || undefined, source: 'app' }),
    onSuccess: async (r) => {
      const when = new Date(r.purgeAfter).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
      await signOut()
      Alert.alert('Account deleted', `Your login is disabled and will be permanently anonymised on ${when}. Changed your mind before then? Email ${SUPPORT_EMAIL}.`)
    },
    onError: (e) => Alert.alert('Not deleted', errorMessage(e)),
  })

  return (
    <Screen title="Delete account" back>
      <Card className="gap-2">
        <Text className="text-white font-semibold">What happens</Text>
        <Text className="text-slate-300 leading-5">• Your login is disabled straight away and you’re signed out.</Text>
        <Text className="text-slate-300 leading-5">• After 30 days your email, name and login are permanently anonymised.</Text>
        <Text className="text-slate-300 leading-5">
          • Records your employer must keep by law — payslips, leave, attendance — stay with your employer (BCEA: 3 years, SARS: 5 years). You can ask them for copies.
        </Text>
        {owner ? (
          <Text className="text-amber-300 leading-5 mt-1">
            You’re the business owner. This removes your login only — it does not close the business or delete its records. To close the business, email {SUPPORT_EMAIL}.
          </Text>
        ) : null}
        <Text className="text-brand-light text-sm mt-1" onPress={() => Linking.openURL(DELETE_ACCOUNT_URL)}>Read the full deletion policy</Text>
      </Card>

      <Field label="Why are you leaving? (optional)" value={reason} onChangeText={setReason} maxLength={1000} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <Field label="Type DELETE to confirm" value={confirm} onChangeText={(v) => setConfirm(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} />
      <Button label="Delete my account" variant="danger" disabled={confirm !== 'DELETE'} loading={del.isPending} onPress={() => del.mutate()} />
    </Screen>
  )
}
