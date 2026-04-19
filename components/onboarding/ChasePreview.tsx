'use client'

import { useEffect, useState } from 'react'

interface ChasePreviewProps {
  clientName: string
  amount: string
  dueDate: string
  businessName: string
}

export function ChasePreview({ clientName, amount, dueDate, businessName }: ChasePreviewProps) {
  const [visible, setVisible] = useState(false)
  const [typed, setTyped] = useState('')

  const message = `Hi ${clientName} 👋

This is a friendly reminder from *${businessName}*.

Your invoice of *R${Number(amount).toLocaleString('en-ZA')}* was due on *${dueDate}*.

We'd love to sort this out — please let us know if you have any questions or if you'd like to arrange a payment plan.

Reply *PAY* to get our banking details, or call us to chat. 🙏`

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible) return
    let i = 0
    const interval = setInterval(() => {
      i++
      setTyped(message.slice(0, i))
      if (i >= message.length) clearInterval(interval)
    }, 12)
    return () => clearInterval(interval)
  }, [visible, message])

  return (
    <div
      className="transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)' }}
    >
      {/* Phone mockup */}
      <div
        className="mx-auto rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxWidth: 320, background: '#0A0F2C', padding: '12px 12px 20px' }}
      >
        {/* WhatsApp header */}
        <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl" style={{ background: '#128C7E' }}>
          <div
            className="rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ width: 36, height: 36, background: '#075E54', flexShrink: 0 }}
          >
            {clientName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-white text-sm font-semibold">{clientName}</div>
            <div className="text-green-200 text-xs">online</div>
          </div>
        </div>

        {/* Chat area */}
        <div className="rounded-xl p-3 min-h-32" style={{ background: '#ECE5DD' }}>
          {/* Outgoing bubble */}
          <div className="flex justify-end">
            <div
              className="rounded-2xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed shadow-sm"
              style={{
                background: '#DCF8C6',
                maxWidth: '88%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {typed}
              <span
                className="inline-block w-1 h-3 ml-0.5 align-middle"
                style={{ background: '#128C7E', animation: typed.length < message.length ? 'blink 0.7s step-end infinite' : 'none' }}
              />
              <div className="flex justify-end items-center gap-1 mt-1">
                <span className="text-gray-400" style={{ fontSize: 10 }}>Chase · just now</span>
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                  <path d="M1 5l3.5 3.5L13 1" stroke="#4FC3F7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 5l3.5 3.5L13 1" stroke="#4FC3F7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Agent label */}
        <div className="text-center mt-2 text-xs" style={{ color: '#4FC3F7' }}>
          ⚡ Chase drafted this automatically
        </div>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}
