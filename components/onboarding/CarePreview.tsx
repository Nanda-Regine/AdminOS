'use client'

import { useEffect, useState } from 'react'

interface CarePreviewProps {
  staffName: string
  role: string
  businessName: string
}

export function CarePreview({ staffName, role, businessName }: CarePreviewProps) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  const messages = [
    {
      from: 'care',
      text: `Hi ${staffName} 👋 It's Care from *${businessName}*.\n\nHow are you feeling today? Reply with a number:\n\n1️⃣ Great — energised & focused\n2️⃣ Good — managing well\n3️⃣ Okay — a bit tired\n4️⃣ Struggling — could use support`,
      delay: 400,
    },
    {
      from: 'staff',
      text: '2',
      delay: 2200,
    },
    {
      from: 'care',
      text: `Glad to hear it, ${staffName} 😊 Keep up the great work as ${role}!\n\nIf anything changes this week, just reply and I'll flag it for the team. You matter here. 💚`,
      delay: 3400,
    },
  ]

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible) return
    messages.forEach((msg, i) => {
      setTimeout(() => setStep(i + 1), msg.delay)
    })
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)' }}
    >
      <div
        className="mx-auto rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxWidth: 320, background: '#0A0F2C', padding: '12px 12px 20px' }}
      >
        {/* WhatsApp header */}
        <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl" style={{ background: '#128C7E' }}>
          <div
            className="rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ width: 36, height: 36, background: '#2E7D32', flexShrink: 0 }}
          >
            {staffName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-white text-sm font-semibold">{staffName}</div>
            <div className="text-green-200 text-xs">{role}</div>
          </div>
        </div>

        {/* Chat area */}
        <div className="rounded-xl p-3 space-y-2 min-h-32" style={{ background: '#ECE5DD' }}>
          {messages.map((msg, i) => {
            if (step <= i) return null
            const isIncoming = msg.from === 'care'
            return (
              <div key={i} className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                <div
                  className="rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm"
                  style={{
                    background: isIncoming ? '#fff' : '#DCF8C6',
                    borderTopLeftRadius: isIncoming ? 4 : 16,
                    borderTopRightRadius: isIncoming ? 16 : 4,
                    maxWidth: '88%',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    animation: 'fadeUp 0.3s ease',
                  }}
                >
                  {isIncoming && (
                    <div className="font-semibold mb-0.5" style={{ color: '#2E7D32', fontSize: 10 }}>
                      Care
                    </div>
                  )}
                  {msg.text}
                </div>
              </div>
            )
          })}

          {/* Typing indicator */}
          {step > 0 && step < messages.length && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-sm px-3 py-2 bg-white shadow-sm flex gap-1 items-center">
                {[0, 1, 2].map(d => (
                  <span
                    key={d}
                    className="rounded-full"
                    style={{
                      width: 6, height: 6, background: '#aaa',
                      animation: `bounce 1s ${d * 0.2}s infinite`,
                      display: 'inline-block',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-2 text-xs" style={{ color: '#66BB6A' }}>
          💚 Care checks in automatically every Monday
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }
      `}</style>
    </div>
  )
}
