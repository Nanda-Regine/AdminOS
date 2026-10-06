import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { api, ApiError, errorMessage } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { enqueueClockEvent, pendingClockEvents, failedClockEvents, dismissFailedClockEvents, type QueuedClockEvent, type FailedClockEvent } from '@/lib/offlineQueue'
import { time, shortDate, saToday } from '@/lib/format'
import type { ClockEvent } from '@/lib/types'
import { Screen, Card, Button, SectionTitle, EmptyState, ErrorState, Loading, C } from '@/components/ui'

type EventType = ClockEvent['event_type']
const LABEL: Record<EventType, string> = { clock_in: 'Clocked in', clock_out: 'Clocked out', break_start: 'Break started', break_end: 'Break ended' }
const STALE_MS = 16 * 3600_000 // matches the server: an open shift this old no longer blocks clock-in

/** Same transitions the server enforces (app/api/staff/clock). */
function stateOf(last: { event_type: EventType; timestamp: string } | undefined): 'off' | 'working' | 'break' {
  if (!last || Date.now() - new Date(last.timestamp).getTime() > STALE_MS) return 'off'
  if (last.event_type === 'clock_in' || last.event_type === 'break_end') return 'working'
  if (last.event_type === 'break_start') return 'break'
  return 'off'
}

/** Minutes worked today: clock-in→out pairs minus breaks; an open shift counts to now. */
function workedMinutes(events: { event_type: EventType; timestamp: string }[]): number {
  let total = 0
  let start: number | null = null
  for (const e of [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    const t = new Date(e.timestamp).getTime()
    if (e.event_type === 'clock_in' || e.event_type === 'break_end') start = t
    else if (start != null) { total += t - start; start = null }
  }
  if (start != null) total += Date.now() - start
  return Math.max(0, Math.round(total / 60000))
}

async function currentPosition(): Promise<{ lat: number; lng: number } | undefined> {
  try {
    const perm = await Location.getForegroundPermissionsAsync()
    const granted = perm.granted || (perm.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted)
    if (!granted) return undefined
    const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 })
    const pos = last ?? await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ])
    return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : undefined
  } catch {
    return undefined // location is optional — never block a clock-in on it
  }
}

export default function ClockScreen() {
  const { data: me } = useMe()
  const staffId = me?.staff?.id
  const qc = useQueryClient()
  const [busy, setBusy] = useState<EventType | null>(null)
  const [pending, setPending] = useState<QueuedClockEvent[]>([])
  const [failed, setFailed] = useState<FailedClockEvent[]>([])

  const events = useQuery({
    queryKey: ['clock', staffId],
    queryFn: () => api.get<ClockEvent[]>(`/api/staff/clock?from=${encodeURIComponent(new Date(Date.now() - 36 * 3600_000).toISOString())}`),
    enabled: Boolean(staffId),
  })

  const loadQueue = useCallback(() => {
    pendingClockEvents().then(setPending)
    failedClockEvents().then(setFailed)
  }, [])
  useFocusEffect(loadQueue)
  useEffect(loadQueue, [events.dataUpdatedAt, loadQueue])

  // Server events plus not-yet-sent offline ones, newest first.
  const merged = useMemo(() => {
    const server = (events.data ?? []).map((e) => ({ key: e.id, event_type: e.event_type, timestamp: e.timestamp, queued: false }))
    const local = pending.map((e) => ({ key: e.id, event_type: e.eventType, timestamp: e.occurredAt, queued: true }))
    return [...server, ...local].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  }, [events.data, pending])

  const state = stateOf(merged[0])
  const today = merged.filter((e) => saToday(new Date(e.timestamp)) === saToday())
  const minutes = workedMinutes(today)

  async function act(eventType: EventType) {
    if (!staffId || busy) return
    setBusy(eventType)
    const occurredAt = new Date().toISOString()
    const pos = await currentPosition()
    try {
      await api.post('/api/staff/clock', { staffId, eventType, ...(pos ?? {}) })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      await qc.invalidateQueries({ queryKey: ['clock'] })
      qc.invalidateQueries({ queryKey: ['me'] })
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) {
        await enqueueClockEvent({ staffId, eventType, occurredAt, ...(pos ?? {}) })
        loadQueue()
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
        Alert.alert('Saved offline', `${LABEL[eventType]} at ${time(occurredAt)}. It will be sent with the correct time as soon as you’re back online.`)
      } else {
        Alert.alert('Couldn’t record that', errorMessage(e))
        qc.invalidateQueries({ queryKey: ['clock'] })
      }
    } finally {
      setBusy(null)
    }
  }

  if (!me) return <Screen title="Clock"><Loading /></Screen>
  if (!staffId) {
    return (
      <Screen title="Clock">
        <EmptyState icon="link-outline" title="No staff record linked" body="Clock-in is for employees. Ask your employer to send you an app invite so your login is linked to your staff record." />
      </Screen>
    )
  }

  const hours = `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
  const status = state === 'working' ? 'You’re clocked in' : state === 'break' ? 'You’re on a break' : 'You’re clocked out'
  const tone = state === 'working' ? C.success : state === 'break' ? C.warn : C.muted

  return (
    <Screen title="Clock" subtitle={shortDate(saToday())} refreshing={events.isRefetching} onRefresh={() => { events.refetch(); loadQueue() }}>
      <Card className="items-center py-8 gap-2">
        <Ionicons name={state === 'working' ? 'briefcase' : state === 'break' ? 'cafe' : 'moon'} size={36} color={tone} />
        <Text className="text-white text-xl font-bold" accessibilityLiveRegion="polite">{status}</Text>
        <Text className="text-slate-400">Worked today: {hours}</Text>
      </Card>

      {events.data === undefined && events.isLoading ? <Loading /> : events.error && !events.data ? <ErrorState error={events.error} onRetry={() => events.refetch()} /> : null}

      <View className="gap-3">
        {state === 'off' && <Button label="Clock in" icon="log-in-outline" variant="success" loading={busy === 'clock_in'} onPress={() => act('clock_in')} />}
        {state === 'working' && (
          <>
            <Button label="Start break" icon="cafe-outline" variant="secondary" loading={busy === 'break_start'} onPress={() => act('break_start')} />
            <Button label="Clock out" icon="log-out-outline" variant="danger" loading={busy === 'clock_out'} onPress={() => act('clock_out')} />
          </>
        )}
        {state === 'break' && <Button label="End break" icon="play-outline" loading={busy === 'break_end'} onPress={() => act('break_end')} />}
      </View>
      <Text className="text-slate-500 text-xs text-center">Your location is recorded with each entry if you allow it. You can still clock in without it.</Text>

      {failed.length > 0 && (
        <Card className="border-red-400/40 gap-2">
          <Text className="text-red-300 font-semibold">{failed.length} offline entr{failed.length === 1 ? 'y was' : 'ies were'} not accepted</Text>
          {failed.slice(-3).map((f) => (
            <Text key={f.id} className="text-slate-400 text-xs">{LABEL[f.eventType]} at {time(f.occurredAt)} — {f.error}</Text>
          ))}
          <Text className="text-slate-400 text-xs">Tell your manager so they can capture it.</Text>
          <Button label="Dismiss" variant="secondary" small onPress={() => dismissFailedClockEvents().then(loadQueue)} />
        </Card>
      )}

      <SectionTitle>Today</SectionTitle>
      {today.length === 0 ? (
        <Text className="text-slate-500 text-sm">No entries yet today.</Text>
      ) : (
        <Card className="gap-1">
          {today.map((e) => (
            <View key={e.key} className="flex-row justify-between py-1.5">
              <Text className="text-white">{LABEL[e.event_type]}</Text>
              <Text className={e.queued ? 'text-amber-300' : 'text-slate-400'}>{time(e.timestamp)}{e.queued ? ' · waiting to send' : ''}</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  )
}
