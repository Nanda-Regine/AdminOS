import { useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { supabase } from '@/lib/supabase'

type QueuedAction = {
  id: string
  table: string
  operation: 'insert' | 'update'
  payload: Record<string, unknown>
  filter?: { column: string; value: string }
  queuedAt: string
}

const QUEUE_KEY = 'offline_queue'

export async function enqueueAction(action: Omit<QueuedAction, 'id' | 'queuedAt'>) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  const queue: QueuedAction[] = raw ? JSON.parse(raw) : []
  queue.push({ ...action, id: Math.random().toString(36).slice(2), queuedAt: new Date().toISOString() })
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

async function flushQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  if (!raw) return
  const queue: QueuedAction[] = JSON.parse(raw)
  if (queue.length === 0) return

  const remaining: QueuedAction[] = []
  for (const action of queue) {
    try {
      if (action.operation === 'insert') {
        const { error } = await supabase.from(action.table as any).insert(action.payload as any)
        if (error) remaining.push(action)
      } else if (action.operation === 'update' && action.filter) {
        const { error } = await supabase.from(action.table as any)
          .update(action.payload as any)
          .eq(action.filter.column, action.filter.value)
        if (error) remaining.push(action)
      }
    } catch {
      remaining.push(action)
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
}

export function useOfflineQueue() {
  const flushing = useRef(false)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && !flushing.current) {
        flushing.current = true
        flushQueue().finally(() => { flushing.current = false })
      }
    })
    return () => unsubscribe()
  }, [])
}
