import AsyncStorage from '@react-native-async-storage/async-storage'
import { api, ApiError } from './api'

/**
 * Clock-ins captured without signal (load-shedding takes towers down too).
 * Each event keeps the moment it happened (`occurredAt`), so the server
 * records the real time, not the time the phone found signal. The server
 * accepts events up to 12 hours old and flags them as offline captures.
 *
 * Only clock events queue: they are time-critical and idempotent enough to
 * replay. Leave, expenses and approvals need a live answer (balance, overlap,
 * self-approval rules) and say so when offline.
 */

export interface QueuedClockEvent {
  id: string
  staffId: string
  eventType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  occurredAt: string
  lat?: number
  lng?: number
}

export interface FailedClockEvent extends QueuedClockEvent {
  error: string
}

const QUEUE_KEY = 'adminos-offline-clock'
const FAILED_KEY = 'adminos-offline-clock-failed'

async function read<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

export async function enqueueClockEvent(e: Omit<QueuedClockEvent, 'id'>): Promise<void> {
  const queue = await read<QueuedClockEvent>(QUEUE_KEY)
  queue.push({ ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export async function pendingClockEvents(): Promise<QueuedClockEvent[]> {
  return read<QueuedClockEvent>(QUEUE_KEY)
}

export async function failedClockEvents(): Promise<FailedClockEvent[]> {
  return read<FailedClockEvent>(FAILED_KEY)
}

export async function dismissFailedClockEvents(): Promise<void> {
  await AsyncStorage.removeItem(FAILED_KEY)
}

let flushing = false

/**
 * Send queued events oldest-first. A network error stops the flush (try again
 * on the next reconnect); a 4xx means the server will never accept it (too
 * old, out of order) — it moves to the failed list so the employee sees it
 * and can tell HR, instead of it vanishing.
 */
export async function flushClockQueue(): Promise<{ sent: number; failed: number }> {
  if (flushing) return { sent: 0, failed: 0 }
  flushing = true
  let sent = 0
  let failed = 0
  try {
    const queue = (await read<QueuedClockEvent>(QUEUE_KEY)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    const remaining: QueuedClockEvent[] = []
    const failures = await read<FailedClockEvent>(FAILED_KEY)
    for (let i = 0; i < queue.length; i++) {
      const e = queue[i]
      try {
        await api.post('/api/staff/clock', {
          staffId: e.staffId, eventType: e.eventType, occurredAt: e.occurredAt,
          ...(e.lat != null && e.lng != null ? { lat: e.lat, lng: e.lng } : {}),
        })
        sent++
      } catch (err) {
        if (err instanceof ApiError && (err.isNetwork || err.status >= 500 || err.status === 429 || err.status === 401)) {
          remaining.push(...queue.slice(i))
          break
        }
        failures.push({ ...e, error: err instanceof Error ? err.message : 'Rejected by the server' })
        failed++
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
    if (failed) await AsyncStorage.setItem(FAILED_KEY, JSON.stringify(failures.slice(-20)))
  } finally {
    flushing = false
  }
  return { sent, failed }
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.multiRemove([QUEUE_KEY, FAILED_KEY]).catch(() => undefined)
}
