import { useMemo, useState } from 'react'
import { Alert, Pressable, Switch, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '@/lib/api'
import { workingDaysBetween } from '@/lib/workingDays'
import { LEAVE_LABEL, saToday, addDays, shortDate } from '@/lib/format'
import type { LeaveType } from '@/lib/types'
import { DateRangePicker } from '@/components/DateRangePicker'
import { Screen, Button, Field, SectionTitle, Card, C } from '@/components/ui'

const TYPES: LeaveType[] = ['annual', 'sick', 'family_responsibility', 'maternity', 'parental', 'study', 'unpaid']

export default function LeaveRequestScreen() {
  const qc = useQueryClient()
  const today = saToday()
  const [type, setType] = useState<LeaveType>('annual')
  const [start, setStart] = useState<string | null>(null)
  const [end, setEnd] = useState<string | null>(null)
  const [halfDay, setHalfDay] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const last = end ?? start
  const single = Boolean(start && (!end || end === start))
  const days = useMemo(() => {
    if (!start || !last) return null
    try {
      const n = workingDaysBetween(start, last)
      return single && halfDay && n === 1 ? 0.5 : n
    } catch {
      return null
    }
  }, [start, last, single, halfDay])

  const submit = useMutation({
    mutationFn: () => api.post<{ medicalCertificateRequired?: boolean }>('/api/leave', {
      leaveType: type,
      startDate: start,
      endDate: last,
      halfDay: single && halfDay,
      reason: reason.trim() || undefined,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['leave'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      Alert.alert(
        'Request sent',
        r.medicalCertificateRequired
          ? 'Your manager has been notified. For sick leave of more than two days your employer may ask for a medical certificate (BCEA s23) — keep it handy.'
          : 'Your manager has been notified. You’ll get a notification when it’s decided.',
      )
      router.back()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  function send() {
    setError(null)
    if (!start) { setError('Pick the first day of your leave on the calendar.'); return }
    if (days === 0) { setError('Those dates are all weekends or public holidays — no leave needed.'); return }
    submit.mutate()
  }

  return (
    <Screen title="Request leave" back>
      <SectionTitle>Type</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setType(t)}
            accessibilityRole="radio"
            accessibilityState={{ checked: type === t }}
            className={`px-3 py-2 rounded-full border ${type === t ? 'bg-brand border-brand' : 'border-white/15'}`}
          >
            <Text className={type === t ? 'text-white font-medium' : 'text-slate-300'}>{LEAVE_LABEL[t]}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Dates</SectionTitle>
      <DateRangePicker
        start={start}
        end={end}
        min={addDays(today, -60)}
        max={addDays(today, 365)}
        onChange={(s, e) => { setStart(s); setEnd(e); if (e && e !== s) setHalfDay(false) }}
      />
      <Card className="gap-1">
        <Text className="text-white">
          {start ? (single ? shortDate(start) : `${shortDate(start)} – ${shortDate(last)}`) : 'No dates picked yet'}
        </Text>
        {days != null && <Text className="text-slate-400 text-sm">{days} working day{days === 1 ? '' : 's'}{type !== 'annual' ? ' — doesn’t use annual leave' : ''}</Text>}
        {single && (
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-slate-300">Half day</Text>
            <Switch value={halfDay} onValueChange={setHalfDay} trackColor={{ true: C.brand }} accessibilityLabel="Half day" />
          </View>
        )}
      </Card>

      <Field label="Note for your manager (optional)" value={reason} onChangeText={setReason} multiline maxLength={1000} style={{ minHeight: 80, textAlignVertical: 'top' }} />
      {error ? <Text accessibilityLiveRegion="assertive" className="text-red-300 text-sm">{error}</Text> : null}
      <Button label="Send request" onPress={send} loading={submit.isPending} />
    </Screen>
  )
}
