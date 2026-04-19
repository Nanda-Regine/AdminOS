'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, FileText, Receipt, Zap } from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'conversation' | 'document' | 'invoice' | 'workflow'
  label: string
  sub: string
  time: Date
}

const typeConfig = {
  conversation: { icon: MessageSquare, color: 'text-blue-500 bg-blue-50' },
  document: { icon: FileText, color: 'text-purple-500 bg-purple-50' },
  invoice: { icon: Receipt, color: 'text-amber-500 bg-amber-50' },
  workflow: { icon: Zap, color: 'text-emerald-500 bg-emerald-50' },
}

export function LiveActivityFeed({ initial }: { initial: ActivityItem[] }) {
  const [items, setItems] = useState<ActivityItem[]>(initial)

  useEffect(() => {
    const supabase = createClient()

    const sub = supabase
      .channel('activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (p) => {
        const r = p.new as { id: string; contact_name?: string; contact_identifier?: string; channel?: string }
        prepend({
          id: `c-${r.id}`,
          type: 'conversation',
          label: `New message from ${r.contact_name || r.contact_identifier || 'unknown'}`,
          sub: r.channel || 'whatsapp',
          time: new Date(),
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents' }, (p) => {
        const r = p.new as { id: string; original_filename?: string; processing_status?: string; doc_category?: string }
        if (r.processing_status !== 'done') return
        prepend({
          id: `d-${r.id}`,
          type: 'document',
          label: `${r.original_filename || 'Document'} processed`,
          sub: r.doc_category || 'document',
          time: new Date(),
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invoices' }, (p) => {
        const r = p.new as { id: string; contact_name?: string; amount?: number }
        prepend({
          id: `i-${r.id}`,
          type: 'invoice',
          label: `Invoice created for ${r.contact_name || 'contact'}`,
          sub: `R${Number(r.amount || 0).toLocaleString()}`,
          time: new Date(),
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  function prepend(item: ActivityItem) {
    setItems((prev) => [item, ...prev].slice(0, 20))
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const cfg = typeConfig[item.type]
        const Icon = cfg.icon
        return (
          <div key={item.id} className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">{item.label}</p>
              <p className="text-xs text-gray-400 capitalize">{item.sub}</p>
            </div>
            <span className="text-xs text-gray-300 shrink-0">
              {item.time.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )
      })}
      {items.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">Activity will appear here in real-time.</p>
      )}
    </div>
  )
}
