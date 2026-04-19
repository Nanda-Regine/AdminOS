'use client'

import { useEffect, useState } from 'react'

interface FAQ {
  question: string
  answer: string
}

interface AlexConversationProps {
  faqs: FAQ[]
  businessName: string
}

export function AlexConversation({ faqs, businessName }: AlexConversationProps) {
  const [visible, setVisible] = useState(false)
  const [shownCount, setShownCount] = useState(0)
  const [selectedFaq, setSelectedFaq] = useState<number | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 150)
    const t2 = setTimeout(() => setShownCount(1), 700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  function handleSelect(idx: number) {
    setSelectedFaq(idx)
    setShowAnswer(false)
    setTimeout(() => setShowAnswer(true), 800)
  }

  const displayFaqs = faqs.slice(0, 3)

  return (
    <div
      className="transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)' }}
    >
      <div
        className="mx-auto rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxWidth: 340, background: '#0A0F2C', padding: '12px 12px 20px' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl" style={{ background: '#128C7E' }}>
          <div
            className="rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ width: 36, height: 36, background: '#1565C0', flexShrink: 0 }}
          >
            A
          </div>
          <div>
            <div className="text-white text-sm font-semibold">{businessName}</div>
            <div className="text-green-200 text-xs">Alex — powered by AI</div>
          </div>
        </div>

        {/* Chat area */}
        <div className="rounded-xl p-3 space-y-2" style={{ background: '#ECE5DD', minHeight: 200 }}>
          {/* Alex greeting */}
          {shownCount >= 1 && (
            <div className="flex justify-start" style={{ animation: 'fadeUp 0.3s ease' }}>
              <div
                className="rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed shadow-sm bg-white"
                style={{ maxWidth: '88%' }}
              >
                <div className="font-semibold mb-1" style={{ color: '#1565C0', fontSize: 10 }}>Alex</div>
                Hi there! Welcome to {businessName} 👋 How can I help you today?
                <div className="mt-1 space-y-1">
                  {displayFaqs.map((faq, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelect(i)}
                      className="block w-full text-left rounded-lg px-2 py-1 text-xs transition-colors"
                      style={{
                        background: selectedFaq === i ? '#1565C0' : '#E3F2FD',
                        color: selectedFaq === i ? '#fff' : '#1565C0',
                        border: '1px solid #90CAF9',
                      }}
                    >
                      {faq.question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* User selection */}
          {selectedFaq !== null && (
            <div className="flex justify-end" style={{ animation: 'fadeUp 0.3s ease' }}>
              <div
                className="rounded-2xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed shadow-sm"
                style={{ background: '#DCF8C6', maxWidth: '88%' }}
              >
                {displayFaqs[selectedFaq].question}
              </div>
            </div>
          )}

          {/* Alex answer */}
          {showAnswer && selectedFaq !== null && (
            <div className="flex justify-start" style={{ animation: 'fadeUp 0.3s ease' }}>
              <div
                className="rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed shadow-sm bg-white"
                style={{ maxWidth: '88%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                <div className="font-semibold mb-1" style={{ color: '#1565C0', fontSize: 10 }}>Alex</div>
                {displayFaqs[selectedFaq].answer}
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {selectedFaq !== null && !showAnswer && (
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

        <div className="text-center mt-2 text-xs" style={{ color: '#4FC3F7' }}>
          💬 Tap a question to see Alex reply
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }
      `}</style>
    </div>
  )
}
