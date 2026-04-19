'use client'

import { useEffect, useState } from 'react'

interface PenStreamProps {
  recipientName: string
  businessName: string
  ownerName: string
  language: string
}

export function PenStream({ recipientName, businessName, ownerName, language }: PenStreamProps) {
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [rawBuffer, setRawBuffer] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true)
      streamEmail()
    }, 400)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function streamEmail() {
    setStatus('streaming')
    try {
      const res = await fetch('/api/agents/pen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone: 'friendly',
          emailType: 'welcome',
          recipientName,
          recipientEmail: 'preview@adminos.co.za',
          context: `New client welcome email from ${businessName}. The business owner is ${ownerName}. Make the client feel valued and explain what working together will look like. Keep it warm and professional.`,
          language: language as 'en' | 'af' | 'zu' | 'xh' | 'st',
          saveDraft: false,
        }),
      })

      if (!res.ok || !res.body) {
        setStatus('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'text_delta' && parsed.text) {
              setRawBuffer(prev => prev + parsed.text)
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  // Parse subject line from streamed content
  useEffect(() => {
    const subjectMatch = rawBuffer.match(/Subject:\s*(.+?)(?:\n|$)/)
    if (subjectMatch) {
      setSubject(subjectMatch[1].trim())
      setBody(rawBuffer.replace(/Subject:\s*.+?(\n|$)/, '').trim())
    } else {
      setBody(rawBuffer)
    }
  }, [rawBuffer])

  return (
    <div
      className="transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)' }}
    >
      <div
        className="mx-auto rounded-2xl overflow-hidden shadow-xl"
        style={{ maxWidth: 380, background: '#fff', border: '2px solid #E8E0C8' }}
      >
        {/* Email header */}
        <div className="px-4 py-3" style={{ background: '#1a1a2e', borderBottom: '1px solid #2a2a4e' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs" style={{ color: '#9CA3AF' }}>To:</span>
            <span className="text-xs font-medium text-white">{recipientName}</span>
          </div>
          {subject && (
            <div className="flex items-start gap-2">
              <span className="text-xs" style={{ color: '#9CA3AF' }}>Subject:</span>
              <span className="text-xs font-semibold text-white">{subject}</span>
            </div>
          )}
          {status === 'streaming' && !subject && (
            <div className="h-4 rounded animate-pulse" style={{ background: '#2a2a4e', width: '60%' }} />
          )}
        </div>

        {/* Email body */}
        <div className="px-4 py-3 min-h-32" style={{ background: '#FAFAF8' }}>
          {status === 'streaming' && !body && (
            <div className="space-y-2">
              {[80, 100, 65, 90, 45].map((w, i) => (
                <div
                  key={i}
                  className="h-3 rounded animate-pulse"
                  style={{ background: '#E8E0C8', width: `${w}%` }}
                />
              ))}
            </div>
          )}

          {body && (
            <div
              className="text-xs leading-relaxed whitespace-pre-wrap"
              style={{ color: '#374151' }}
            >
              {body}
              {status === 'streaming' && (
                <span
                  className="inline-block w-0.5 h-3 ml-0.5 align-middle"
                  style={{ background: '#0A0F2C', animation: 'blink 0.7s step-end infinite' }}
                />
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="text-xs text-red-500 py-4 text-center">
              Could not generate preview — check your connection.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{ borderTop: '1px solid #E8E0C8', background: '#F5EFD6' }}
        >
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {status === 'streaming' && '✍️ Pen is writing...'}
            {status === 'done' && '✅ Draft ready — saved to Email Studio'}
            {status === 'error' && '❌ Preview unavailable'}
            {status === 'idle' && '✍️ Starting...'}
          </span>
          <span className="text-xs font-medium" style={{ color: '#0A0F2C' }}>Pen</span>
        </div>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}
