'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const AGENTS = [
  { key: 'alex', label: 'Alex', desc: 'Sales' },
  { key: 'chase', label: 'Chase', desc: 'Debt' },
  { key: 'care', label: 'Care', desc: 'Support' },
  { key: 'doc', label: 'Doc', desc: 'Docs' },
  { key: 'insight', label: 'Insight', desc: 'Analytics' },
  { key: 'pen', label: 'Pen', desc: 'Email' },
]

interface AgentActivity {
  [key: string]: { lastSeen: Date; count: number }
}

export function AgentStatusBar() {
  const [activity, setActivity] = useState<AgentActivity>({})

  useEffect(() => {
    const supabase = createClient()

    // Track agent activity from audit_logs
    const sub = supabase
      .channel('agent-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (p) => {
        const log = p.new as { action?: string }
        const action = log.action || ''
        for (const agent of AGENTS) {
          if (action.toLowerCase().includes(agent.key)) {
            setActivity((prev) => ({
              ...prev,
              [agent.key]: {
                lastSeen: new Date(),
                count: (prev[agent.key]?.count || 0) + 1,
              },
            }))
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {AGENTS.map((agent) => {
        const hasActivity = !!activity[agent.key]
        return (
          <div
            key={agent.key}
            title={`${agent.label} · ${agent.desc}${hasActivity ? ` · ${activity[agent.key].count} actions` : ' · idle'}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              hasActivity
                ? 'bg-[#2D4A22] text-[#C9A84C]'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${hasActivity ? 'bg-[#C9A84C]' : 'bg-gray-300'}`} />
            {agent.label}
          </div>
        )
      })}
    </div>
  )
}
