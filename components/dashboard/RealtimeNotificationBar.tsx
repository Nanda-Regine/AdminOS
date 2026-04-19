'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Bell } from 'lucide-react'

interface Notification {
  id: string
  message: string
  type: 'info' | 'warning' | 'success'
  timestamp: Date
}

export function RealtimeNotificationBar() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const supabase = createClient()

    // Subscribe to new urgent conversations
    const convSub = supabase
      .channel('realtime-conversations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
      }, (payload) => {
        const conv = payload.new as { id: string; contact_name?: string; sentiment?: string; intent?: string }
        if (conv.sentiment === 'urgent' || conv.sentiment === 'negative') {
          push({
            id: `conv-${conv.id}`,
            message: `Urgent message from ${conv.contact_name || 'a contact'} — ${conv.intent || 'needs attention'}`,
            type: 'warning',
          })
        }
      })
      .subscribe()

    // Subscribe to new invoices becoming overdue
    const invSub = supabase
      .channel('realtime-invoices')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'invoices',
      }, (payload) => {
        const inv = payload.new as { id: string; contact_name?: string; days_overdue?: number; status?: string }
        if (inv.days_overdue && inv.days_overdue > 0 && inv.status === 'unpaid') {
          push({
            id: `inv-${inv.id}`,
            message: `Invoice overdue: ${inv.contact_name || 'Unknown'} — ${inv.days_overdue} days`,
            type: 'warning',
          })
        }
      })
      .subscribe()

    // Subscribe to document processing completing
    const docSub = supabase
      .channel('realtime-documents')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
      }, (payload) => {
        const doc = payload.new as { id: string; original_filename?: string; processing_status?: string }
        if (doc.processing_status === 'done') {
          push({
            id: `doc-${doc.id}`,
            message: `Document ready: ${doc.original_filename || 'file'} has been analysed`,
            type: 'success',
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(convSub)
      supabase.removeChannel(invSub)
      supabase.removeChannel(docSub)
    }
  }, [])

  function push(n: Omit<Notification, 'timestamp'>) {
    setNotifications((prev) => {
      if (prev.find((x) => x.id === n.id)) return prev
      return [{ ...n, timestamp: new Date() }, ...prev].slice(0, 3)
    })
    setTimeout(() => dismiss(n.id), 8000)
  }

  function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm border backdrop-blur-sm transition-all ${
            n.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : n.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-white border-gray-200 text-gray-800'
          }`}
        >
          <Bell className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
          <p className="flex-1 leading-snug">{n.message}</p>
          <button onClick={() => dismiss(n.id)} className="opacity-40 hover:opacity-80 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
