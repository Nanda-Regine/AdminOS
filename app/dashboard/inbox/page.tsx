'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/dashboard/TopBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Conversation, Message } from '@/types/database'
import { AGENT_DEFINITIONS, AgentType } from '@/lib/ai/agents'

export default function InboxPage() {
  const supabase = createClient()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filtered, setFiltered] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [agentResponse, setAgentResponse] = useState('')
  const [agentLoading, setAgentLoading] = useState<AgentType | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [search, setSearch] = useState('')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const loadConversations = useCallback(async (tid: string) => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', tid)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (data) {
      setConversations(data)
      setFiltered(data)
    }
  }, [supabase])

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    if (data) {
      setMessages(data)
      setTimeout(scrollToBottom, 100)
    }
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const tid = user.user_metadata?.tenant_id
        setTenantId(tid)
        loadConversations(tid)
      }
    })
  }, [supabase, loadConversations])

  // Search filter
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(conversations)
      return
    }
    const q = search.toLowerCase()
    setFiltered(
      conversations.filter(
        (c) =>
          c.contact_name?.toLowerCase().includes(q) ||
          c.contact_identifier?.toLowerCase().includes(q) ||
          c.intent?.toLowerCase().includes(q)
      )
    )
  }, [search, conversations])

  // Realtime subscription for new messages
  useEffect(() => {
    if (!selected) return
    loadMessages(selected.id)

    const channel = supabase
      .channel(`conv:${selected.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selected.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          setTimeout(scrollToBottom, 100)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selected, loadMessages, supabase])

  const callAgent = async (agentType: AgentType) => {
    if (!selected || !messages.length) return
    setAgentLoading(agentType)
    setAgentResponse('')

    const context = messages
      .slice(-12)
      .map((m) => `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.content}`)
      .join('\n')

    try {
      const res = await fetch(`/api/agents/${agentType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          contactIdentifier: selected.contact_identifier,
        }),
      })
      const data = await res.json()
      setAgentResponse(data.response || 'No response from agent.')
    } catch {
      setAgentResponse('Agent unavailable. Please try again.')
    } finally {
      setAgentLoading(null)
    }
  }

  const useAgentDraft = () => {
    if (agentResponse) setReplyText(agentResponse)
  }

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return
    setSending(true)
    try {
      await fetch('/api/conversations/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selected.id,
          message: replyText.trim(),
          channel: selected.channel,
          contactIdentifier: selected.contact_identifier,
        }),
      })
      setReplyText('')
    } catch {
      alert('Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const updateConversationStatus = async (status: 'auto_resolved' | 'escalated' | 'closed') => {
    if (!selected) return
    setActionLoading(status)
    try {
      await fetch('/api/conversations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.id, status }),
      })
      setSelected((prev) => prev ? { ...prev, status } : null)
      setConversations((prev) =>
        prev.map((c) => c.id === selected.id ? { ...c, status } : c)
      )
    } finally {
      setActionLoading(null)
    }
  }

  const statusColor: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
    open: 'yellow', auto_resolved: 'green', escalated: 'red', closed: 'gray',
  }

  const sentimentColor: Record<string, string> = {
    positive: 'text-green-600', neutral: 'text-gray-400',
    negative: 'text-red-500', urgent: 'text-orange-500',
  }

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Inbox" subtitle="All inbound conversations" />
      <div className="flex flex-1 overflow-hidden">

        {/* Conversation list */}
        <div className="w-72 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <input
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => { setSelected(conv); setAgentResponse('') }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selected?.id === conv.id ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {conv.contact_name || conv.contact_identifier || 'Unknown'}
                  </p>
                  <Badge variant={statusColor[conv.status] || 'gray'} className="ml-2 shrink-0">
                    {conv.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400 capitalize">{conv.channel} · {conv.intent || 'general'}</p>
                  {conv.sentiment && (
                    <span className={`text-xs font-medium ${sentimentColor[conv.sentiment] || ''}`}>
                      {conv.sentiment}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">
                {search ? 'No conversations match your search.' : 'No conversations yet.'}
              </div>
            )}
          </div>
        </div>

        {/* Messages panel */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Conversation header */}
            <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {selected.contact_name || selected.contact_identifier}
                </p>
                <p className="text-xs text-gray-400 capitalize">
                  {selected.channel} · {selected.intent} · {selected.sentiment || 'neutral'}
                </p>
              </div>
              <div className="flex gap-2">
                {selected.status !== 'auto_resolved' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={actionLoading === 'auto_resolved'}
                    onClick={() => updateConversationStatus('auto_resolved')}
                  >
                    ✓ Resolve
                  </Button>
                )}
                {selected.status !== 'escalated' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={actionLoading === 'escalated'}
                    onClick={() => updateConversationStatus('escalated')}
                  >
                    ⚠ Escalate
                  </Button>
                )}
                {selected.status !== 'closed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={actionLoading === 'closed'}
                    onClick={() => updateConversationStatus('closed')}
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-xs lg:max-w-md rounded-xl px-4 py-2.5 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-white border border-gray-200 text-gray-800'
                      : msg.role === 'system'
                      ? 'bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs italic'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {msg.content}
                    {msg.from_cache && <span className="ml-1 text-xs opacity-60" title="From FAQ cache">⚡</span>}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            <div className="border-t border-gray-200 bg-white">
              <div className="px-4 pt-3 pb-1">
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  placeholder={`Reply via ${selected.channel}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply()
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400">Ctrl+Enter to send</p>
                  <div className="flex gap-2">
                    {agentResponse && (
                      <Button variant="ghost" size="sm" onClick={useAgentDraft}>
                        Use AI draft
                      </Button>
                    )}
                    <Button size="sm" onClick={sendReply} loading={sending} disabled={!replyText.trim()}>
                      Send →
                    </Button>
                  </div>
                </div>
              </div>

              {/* AI Agent panel */}
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">AI Agents</p>
                <div className="flex gap-2 flex-wrap mb-3">
                  {(Object.entries(AGENT_DEFINITIONS) as [AgentType, typeof AGENT_DEFINITIONS[AgentType]][]).map(([key, agent]) => (
                    <Button
                      key={key}
                      variant="secondary"
                      size="sm"
                      loading={agentLoading === key}
                      onClick={() => callAgent(key)}
                      title={agent.description}
                    >
                      {agent.name}
                    </Button>
                  ))}
                </div>
                {agentResponse && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-gray-800 leading-relaxed">
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap">{agentResponse}</p>
                      <button
                        className="text-xs text-emerald-600 hover:text-emerald-800 shrink-0 font-medium"
                        onClick={useAgentDraft}
                        title="Copy to reply box"
                      >
                        Use ↑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-sm">Select a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
