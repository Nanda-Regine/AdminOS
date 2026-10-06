import { useState } from 'react'
import { Alert, Image, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api, errorMessage } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { CLAIM_CATEGORIES } from '@/lib/categories'
import { Screen, Button, Field, SectionTitle, Card, C } from '@/components/ui'

/** "R 1 234,50" / "1234.5" → 1234.5. Null when it isn't a positive amount. */
function parseRand(input: string): number | null {
  const cleaned = input.replace(/[R\s]/gi, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 && n <= 10_000_000 ? Math.round(n * 100) / 100 : null
}

export default function NewExpenseScreen() {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('travel')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Camera not allowed', 'Allow camera access in your phone’s settings to photograph receipts. You can still submit without one.')
      return
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: false, exif: false })
    if (r.canceled || !r.assets[0]) return
    const a = r.assets[0]
    if (a.fileSize && a.fileSize > 4 * 1024 * 1024) {
      Alert.alert('Photo too large', 'That photo is over 4 MB. Retake it a little further away, or in better light.')
      return
    }
    setPhoto(a)
  }

  const submit = useMutation({
    mutationFn: async () => {
      const value = parseRand(amount)
      if (!value) throw new Error('Enter the amount on the slip, e.g. 245.50.')
      if (!me?.staff) throw new Error('Your login isn’t linked to a staff record.')

      let receiptRef: string | undefined
      if (photo) {
        const form = new FormData()
        // React Native's FormData accepts a { uri, name, type } file descriptor.
        form.append('file', { uri: photo.uri, name: 'receipt.jpg', type: photo.mimeType ?? 'image/jpeg' } as unknown as Blob)
        receiptRef = (await api.upload<{ receiptRef: string }>('/api/expenses/receipt', form)).receiptRef
      }
      return api.post('/api/expenses', {
        staffId: me.staff.id,
        amount: value,
        category,
        description: description.trim() || undefined,
        receiptRef,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      Alert.alert('Claim submitted', 'Your manager has been notified. You’ll get a notification when it’s decided.')
      router.back()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <Screen title="New expense claim" back>
      <Field label="Amount (R)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />

      <SectionTitle>Category</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {CLAIM_CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setCategory(c.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: category === c.key }}
            className={`px-3 py-2 rounded-full border ${category === c.key ? 'bg-brand border-brand' : 'border-white/15'}`}
          >
            <Text className={category === c.key ? 'text-white font-medium' : 'text-slate-300'}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Field label="What was it for?" value={description} onChangeText={setDescription} maxLength={500} placeholder="Taxi to client site, 12 Oct" />

      <SectionTitle>Receipt</SectionTitle>
      {photo ? (
        <Card className="gap-2">
          <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 220, borderRadius: 12 }} resizeMode="contain" accessibilityLabel="Receipt photo" />
          <Button label="Retake" variant="secondary" small onPress={takePhoto} />
        </Card>
      ) : (
        <Card onPress={takePhoto} className="items-center py-6 gap-2">
          <Ionicons name="camera-outline" size={28} color={C.brand} />
          <Text className="text-white">Photograph the receipt</Text>
          <Text className="text-slate-500 text-xs text-center">Stored privately — only you and your finance approver can see it.</Text>
        </Card>
      )}

      {error ? <Text accessibilityLiveRegion="assertive" className="text-red-300 text-sm">{error}</Text> : null}
      <Button label="Submit claim" onPress={() => { setError(null); submit.mutate() }} loading={submit.isPending} />
    </Screen>
  )
}
