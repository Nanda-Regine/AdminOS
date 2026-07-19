'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { LANGS, INTRO, TRAINING_STEPS, type Lang } from '@/lib/onboarding/training'

const STORE_KEY = 'adminos-onboarding-done'

export function OnboardingTraining({ defaultLang }: { defaultLang: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLang)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)

  // Load saved progress + last-used language.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (raw) setDone(new Set(JSON.parse(raw)))
      const savedLang = localStorage.getItem(STORE_KEY + ':lang') as Lang | null
      if (savedLang && LANGS.some(l => l.code === savedLang)) setLang(savedLang)
    } catch { /* ignore */ }
    setReady(true)
  }, [])

  function toggle(id: string) {
    setDone(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(STORE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  function pickLang(l: Lang) {
    setLang(l)
    try { localStorage.setItem(STORE_KEY + ':lang', l) } catch { /* ignore */ }
  }

  const t = INTRO[lang]
  const total = TRAINING_STEPS.length
  const completed = TRAINING_STEPS.filter(s => done.has(s.id)).length
  const pct = Math.round((completed / total) * 100)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Intro + language switcher */}
      <div className="rounded-2xl px-6 py-5 relative overflow-hidden border on-dark"
        style={{ background: 'linear-gradient(135deg, #101a3e 0%, #16224a 100%)', borderColor: 'var(--border)' }}>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t.title}</h2>
        <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        <div className="flex items-center gap-1.5 mt-4 flex-wrap">
          {LANGS.map(l => (
            <button key={l.code} type="button" onClick={() => pickLang(l.code)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={lang === l.code
                ? { background: 'var(--indigo)', color: '#fff' }
                : { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{completed} / {total} {t.progress}</span>
          <span className="text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'var(--indigo)' }} />
        </div>
        {ready && completed === total && (
          <p className="text-sm mt-3" style={{ color: '#34D399' }}>{t.allDone}</p>
        )}
      </div>

      {/* Steps */}
      <ol className="space-y-3">
        {TRAINING_STEPS.map((step, i) => {
          const isDone = done.has(step.id)
          return (
            <li key={step.id} className="glass rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
                  style={isDone
                    ? { background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }
                    : { background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  {isDone ? <Check className="w-4 h-4" style={{ color: '#34D399' }} /> : step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>{i + 1}.</span>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                      {step.title[lang]}
                    </h3>
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{step.body[lang]}</p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <Link href={step.href} onClick={() => { if (!isDone) toggle(step.id) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                      style={{ background: 'var(--indigo)', color: '#fff' }}>
                      {step.action[lang]} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <button type="button" onClick={() => toggle(step.id)}
                      className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {isDone ? `✓ ${INTRO[lang].done}` : INTRO[lang].markDone}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
