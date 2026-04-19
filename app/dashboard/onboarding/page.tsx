'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChasePreview } from '@/components/onboarding/ChasePreview'
import { CarePreview } from '@/components/onboarding/CarePreview'
import { AlexConversation } from '@/components/onboarding/AlexConversation'
import { DocExtraction } from '@/components/onboarding/DocExtraction'
import { PenStream } from '@/components/onboarding/PenStream'
import { LANGUAGES, getMessages, type Language } from '@/lib/onboarding/messages'
import { BUSINESS_TYPES, getExamples } from '@/lib/onboarding/examples'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OnboardingState {
  language: Language
  ownerName: string
  businessName: string
  businessType: string
  // Chase
  chaseClientName: string
  chaseAmount: string
  chaseDueDate: string
  // Care
  careStaffName: string
  careStaffRole: string
  // Alex (FAQs pre-loaded from business type)
  // Doc
  docType: string
  // Pen
  penRecipientName: string
}

const STEP_WEIGHTS = [5, 10, 15, 20, 15, 15, 10, 10]

function pctAlive(step: number): number {
  let total = 0
  for (let i = 0; i <= step && i < STEP_WEIGHTS.length; i++) total += STEP_WEIGHTS[i]
  return Math.min(total, 100)
}

const CREAM = '#F5EFD6'
const FOREST = '#2D5016'
const GOLD = '#C8971F'
const NAVY = '#0A0F2C'

// ─── Siyanda Avatar ──────────────────────────────────────────────────────────

function SiyandaAvatar({ size = 48 }: { size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${FOREST} 0%, #4A7C28 100%)`,
        fontSize: size * 0.4,
        boxShadow: '0 2px 8px rgba(45,80,22,0.3)',
      }}
    >
      S
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function SiyandaBubble({ text, delay = 0 }: { text: string; delay?: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div
      className="flex items-end gap-3 transition-all duration-500"
      style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(8px)' }}
    >
      <SiyandaAvatar />
      <div
        className="rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed"
        style={{
          background: '#fff',
          color: NAVY,
          boxShadow: '0 2px 12px rgba(10,15,44,0.08)',
          maxWidth: 480,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  )
}

// ─── Input ───────────────────────────────────────────────────────────────────

interface TextInputProps {
  placeholder: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  type?: string
  pattern?: string
  inputMode?: 'text' | 'numeric' | 'decimal'
  maxLength?: number
  autoFocus?: boolean
}

function TextInput({ placeholder, value, onChange, onSubmit, type = 'text', pattern, inputMode, maxLength, autoFocus }: TextInputProps) {
  return (
    <div className="flex gap-2 items-center mt-4">
      <input
        type={type}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className="flex-1 rounded-xl px-4 py-3 text-sm outline-none border-2 transition-colors"
        style={{
          background: '#fff',
          borderColor: '#E8E0C8',
          color: NAVY,
          minWidth: 0,
        }}
        onFocus={e => (e.target.style.borderColor = FOREST)}
        onBlur={e => (e.target.style.borderColor = '#E8E0C8')}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onSubmit() }}
      />
      <button
        onClick={onSubmit}
        disabled={!value.trim()}
        className="rounded-xl px-4 py-3 text-sm font-semibold transition-all"
        style={{
          background: value.trim() ? FOREST : '#ccc',
          color: '#fff',
          cursor: value.trim() ? 'pointer' : 'not-allowed',
          flexShrink: 0,
        }}
      >
        →
      </button>
    </div>
  )
}

// ─── Choice Button ────────────────────────────────────────────────────────────

function ChoiceButton({ label, onClick, selected }: { label: string; onClick: () => void; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
      style={{
        background: selected ? FOREST : '#fff',
        color: selected ? '#fff' : NAVY,
        border: `2px solid ${selected ? FOREST : '#E8E0C8'}`,
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      {label}
    </button>
  )
}

// ─── Skip Tooltip ─────────────────────────────────────────────────────────────

function SkipButton({ consequence, onSkip }: { consequence: string; onSkip: () => void }) {
  const [tip, setTip] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        className="text-xs underline transition-colors"
        style={{ color: '#9CA3AF' }}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        onFocus={() => setTip(true)}
        onBlur={() => setTip(false)}
        onClick={onSkip}
      >
        Skip
      </button>
      {tip && (
        <div
          className="absolute bottom-full left-0 mb-2 rounded-xl p-3 text-xs shadow-xl w-64 z-10"
          style={{ background: '#1a1a2e', color: '#E5E7EB' }}
        >
          ⚠️ {consequence}
        </div>
      )}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, messages }: { pct: number; messages: ReturnType<typeof getMessages> }) {
  const color = pct >= 100 ? GOLD : FOREST
  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: CREAM, borderBottom: '1px solid #E8E0C8' }}>
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#E8E0C8', height: 8 }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold whitespace-nowrap" style={{ color, minWidth: 140 }}>
        {messages.progressAlive(pct)}
      </span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)

  const [state, setState] = useState<OnboardingState>({
    language: 'en',
    ownerName: '',
    businessName: '',
    businessType: '',
    chaseClientName: '',
    chaseAmount: '',
    chaseDueDate: '',
    careStaffName: '',
    careStaffRole: '',
    docType: '',
    penRecipientName: '',
  })

  // Temporary input values (before confirmed)
  const [input, setInput] = useState('')

  const msgs = getMessages(state.language)
  const examples = state.businessType ? getExamples(state.businessType) : null

  // Restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('adminos_onboarding')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.step !== undefined) setStep(parsed.step)
        if (parsed.state) setState(parsed.state)
      }
    } catch {
      // ignore
    }
  }, [])

  // Persist to localStorage on state change
  useEffect(() => {
    try {
      localStorage.setItem('adminos_onboarding', JSON.stringify({ step, state }))
    } catch {
      // ignore
    }
  }, [step, state])

  // Auto-scroll to bottom as conversation grows
  useEffect(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 120)
  }, [step])

  const saveProgress = useCallback(async (nextStep: number, newState: Partial<OnboardingState>) => {
    setSaving(true)
    try {
      await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: nextStep,
          language: newState.language ?? state.language,
          data: newState,
        }),
      })
    } catch {
      // non-blocking
    }
    setSaving(false)
  }, [state.language])

  function advance(nextStep: number, patch: Partial<OnboardingState> = {}) {
    const newState = { ...state, ...patch }
    setState(newState)
    setInput('')
    setStep(nextStep)
    saveProgress(nextStep, patch)
  }

  async function complete() {
    setCompleted(true)
    localStorage.removeItem('adminos_onboarding')
    await fetch('/api/onboarding/complete', { method: 'POST' })
  }

  const pct = pctAlive(step)

  // ── Step renderers ───────────────────────────────────────────────────────

  function renderStep0() {
    // Language selection
    return (
      <div className="space-y-4">
        <SiyandaBubble text={msgs.langSelectGreeting} delay={200} />
        <SiyandaBubble text={msgs.langSelectPrompt} delay={800} />
        <div className="flex flex-wrap gap-2 mt-2 pl-15">
          {LANGUAGES.map(lang => (
            <ChoiceButton
              key={lang.code}
              label={lang.nativeLabel}
              selected={state.language === lang.code}
              onClick={() => advance(1, { language: lang.code })}
            />
          ))}
        </div>
      </div>
    )
  }

  function renderStep1() {
    // Welcome: name + business name + business type
    return (
      <div className="space-y-4">
        <SiyandaBubble text={msgs.langSelectGreeting} delay={0} />
        <SiyandaBubble text={msgs.siyandaIntro(state.ownerName || 'there')} delay={300} />

        {/* Owner name */}
        {!state.ownerName ? (
          <>
            <SiyandaBubble text={msgs.businessNamePrompt.replace('business', 'name — what do people call you?')} delay={900} />
            <TextInput
              placeholder="e.g. Thembi"
              value={input}
              onChange={setInput}
              onSubmit={() => { if (input.trim()) { setState(s => ({ ...s, ownerName: input.trim() })); setInput('') } }}
              autoFocus
            />
          </>
        ) : !state.businessName ? (
          <>
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm px-4 py-2 text-sm" style={{ background: '#DCF8C6', color: NAVY }}>{state.ownerName}</div>
            </div>
            <SiyandaBubble text={msgs.businessNameConfirm(state.ownerName)} delay={200} />
            <TextInput
              placeholder={msgs.businessNamePrompt}
              value={input}
              onChange={setInput}
              onSubmit={() => { if (input.trim()) { setState(s => ({ ...s, businessName: input.trim() })); setInput('') } }}
              autoFocus
            />
          </>
        ) : !state.businessType ? (
          <>
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm px-4 py-2 text-sm" style={{ background: '#DCF8C6', color: NAVY }}>{state.businessName}</div>
            </div>
            <SiyandaBubble text={msgs.businessTypePrompt} delay={200} />
            <div className="flex flex-wrap gap-2 mt-2">
              {BUSINESS_TYPES.map(bt => (
                <ChoiceButton
                  key={bt}
                  label={bt}
                  selected={state.businessType === bt}
                  onClick={() => advance(2, { businessType: bt, docType: getExamples(bt).document_example })}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    )
  }

  function renderStep2() {
    // Chase — debt recovery
    const ex = examples ?? getExamples('Other')
    return (
      <div className="space-y-4">
        <SiyandaBubble text={msgs.chaseIntro} delay={0} />

        {!state.chaseClientName ? (
          <>
            <SiyandaBubble text={msgs.chaseClientPrompt} delay={600} />
            <TextInput
              placeholder={`e.g. ${ex.invoice_example.split('—')[0].trim()}`}
              value={input}
              onChange={setInput}
              onSubmit={() => { if (input.trim()) { setState(s => ({ ...s, chaseClientName: input.trim() })); setInput('') } }}
              autoFocus
            />
            <SkipButton consequence={msgs.skipChase} onSkip={() => advance(3)} />
          </>
        ) : !state.chaseAmount ? (
          <>
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm px-4 py-2 text-sm" style={{ background: '#DCF8C6', color: NAVY }}>{state.chaseClientName}</div>
            </div>
            <SiyandaBubble text={msgs.chaseAmountPrompt} delay={200} />
            <TextInput
              placeholder={`e.g. ${ex.invoice_amount}`}
              value={input}
              onChange={setInput}
              onSubmit={() => { if (input.trim()) { setState(s => ({ ...s, chaseAmount: input.trim() })); setInput('') } }}
              inputMode="numeric"
              autoFocus
            />
          </>
        ) : !state.chaseDueDate ? (
          <>
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm px-4 py-2 text-sm" style={{ background: '#DCF8C6', color: NAVY }}>R {state.chaseAmount}</div>
            </div>
            <SiyandaBubble text={msgs.chaseDueDatePrompt} delay={200} />
            <TextInput
              placeholder="e.g. 15 April 2026"
              value={input}
              onChange={setInput}
              onSubmit={() => { if (input.trim()) { setState(s => ({ ...s, chaseDueDate: input.trim() })); setInput(''); setTimeout(() => advance(3, { chaseDueDate: input.trim() }), 600) } }}
              autoFocus
            />
          </>
        ) : (
          <>
            <SiyandaBubble text={msgs.chaseMagicTitle(state.chaseClientName)} delay={0} />
            <ChasePreview
              clientName={state.chaseClientName}
              amount={state.chaseAmount}
              dueDate={state.chaseDueDate}
              businessName={state.businessName}
            />
            <SiyandaBubble text={msgs.chaseExplainer} delay={1800} />
            <div className="flex gap-3 mt-2">
              <button
                className="rounded-xl px-5 py-3 text-sm font-semibold transition-all"
                style={{ background: FOREST, color: '#fff', cursor: 'pointer', minHeight: 44 }}
                onClick={() => advance(3)}
              >
                {msgs.continueBtn} →
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  function renderStep3() {
    // Care — staff wellness
    const ex = examples ?? getExamples('Other')
    return (
      <div className="space-y-4">
        <SiyandaBubble text={msgs.careIntro} delay={0} />

        {!state.careStaffName ? (
          <>
            <SiyandaBubble text={msgs.careNamePrompt} delay={600} />
            <TextInput
              placeholder="e.g. Sipho"
              value={input}
              onChange={setInput}
              onSubmit={() => { if (input.trim()) { setState(s => ({ ...s, careStaffName: input.trim() })); setInput('') } }}
              autoFocus
            />
            <SkipButton consequence={msgs.skipCare} onSkip={() => advance(4)} />
          </>
        ) : !state.careStaffRole ? (
          <>
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm px-4 py-2 text-sm" style={{ background: '#DCF8C6', color: NAVY }}>{state.careStaffName}</div>
            </div>
            <SiyandaBubble text={msgs.careRolePrompt ?? "What's their role or job title?"} delay={200} />
            <TextInput
              placeholder={`e.g. ${ex.staff_role_example}`}
              value={input}
              onChange={setInput}
              onSubmit={() => { setState(s => ({ ...s, careStaffRole: input.trim() })); setInput('') }}
              autoFocus
            />
          </>
        ) : (
          <>
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm px-4 py-2 text-sm" style={{ background: '#DCF8C6', color: NAVY }}>{state.careStaffRole}</div>
            </div>
            <SiyandaBubble text={msgs.careMagicTitle(state.careStaffName)} delay={200} />
            <CarePreview
              staffName={state.careStaffName}
              role={state.careStaffRole}
              businessName={state.businessName}
            />
            <SiyandaBubble text={msgs.careExplainer} delay={3800} />
            <div className="flex gap-3 mt-2">
              <button
                className="rounded-xl px-5 py-3 text-sm font-semibold"
                style={{ background: FOREST, color: '#fff', cursor: 'pointer', minHeight: 44 }}
                onClick={() => advance(4)}
              >
                {msgs.continueBtn} →
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  function renderStep4() {
    // Alex — FAQs
    const ex = examples ?? getExamples('Other')
    return (
      <div className="space-y-4">
        <SiyandaBubble text={msgs.alexIntro} delay={0} />
        <SiyandaBubble text={msgs.alexExplainer} delay={700} />
        <AlexConversation
          faqs={ex.faq_examples}
          businessName={state.businessName}
        />
        <SiyandaBubble text={msgs.alexExplainer} delay={1200} />
        <div className="flex gap-3 mt-2">
          <button
            className="rounded-xl px-5 py-3 text-sm font-semibold"
            style={{ background: FOREST, color: '#fff', cursor: 'pointer', minHeight: 44 }}
            onClick={() => advance(5)}
          >
            {msgs.continueBtn} →
          </button>
          <SkipButton consequence={msgs.skipAlex} onSkip={() => advance(5)} />
        </div>
      </div>
    )
  }

  function renderStep5() {
    // Doc — document upload simulation
    const ex = examples ?? getExamples('Other')
    const docType = state.docType || ex.document_example
    return (
      <div className="space-y-4">
        <SiyandaBubble text={msgs.docIntro} delay={0} />
        <SiyandaBubble text={msgs.docExplainer(docType)} delay={700} />
        <DocExtraction
          docType={docType}
          businessType={state.businessType}
        />
        <SiyandaBubble text={msgs.docSkipMsg} delay={1600} />
        <div className="flex gap-3 mt-2">
          <button
            className="rounded-xl px-5 py-3 text-sm font-semibold"
            style={{ background: FOREST, color: '#fff', cursor: 'pointer', minHeight: 44 }}
            onClick={() => advance(6)}
          >
            {msgs.continueBtn} →
          </button>
          <SkipButton consequence={msgs.skipDoc} onSkip={() => advance(6)} />
        </div>
      </div>
    )
  }

  function renderStep6() {
    // Pen — email generation
    return (
      <div className="space-y-4">
        <SiyandaBubble text={msgs.penIntroSimple} delay={0} />

        {!state.penRecipientName ? (
          <>
            <SiyandaBubble text={msgs.penRecipientPrompt} delay={600} />
            <TextInput
              placeholder="e.g. Kagiso"
              value={input}
              onChange={setInput}
              onSubmit={() => { if (input.trim()) { advance(6, { penRecipientName: input.trim() }) } }}
              autoFocus
            />
            <SkipButton consequence={msgs.skipPen} onSkip={() => advance(7)} />
          </>
        ) : (
          <>
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-sm px-4 py-2 text-sm" style={{ background: '#DCF8C6', color: NAVY }}>{state.penRecipientName}</div>
            </div>
            <SiyandaBubble text={msgs.penMagicTitle(state.penRecipientName)} delay={200} />
            <PenStream
              recipientName={state.penRecipientName}
              businessName={state.businessName}
              ownerName={state.ownerName}
              language={state.language}
            />
            <SiyandaBubble text={msgs.penDone} delay={2000} />
            <div className="flex gap-3 mt-2">
              <button
                className="rounded-xl px-5 py-3 text-sm font-semibold"
                style={{ background: FOREST, color: '#fff', cursor: 'pointer', minHeight: 44 }}
                onClick={() => advance(7)}
              >
                {msgs.continueBtn} →
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  function renderStep7() {
    // Celebration
    return (
      <div className="space-y-6 text-center">
        <div style={{ fontSize: 64 }}>🎉</div>
        <SiyandaBubble text={msgs.celebrateSubhead(state.businessName)} delay={200} />
        <SiyandaBubble text={msgs.tourPrompt} delay={900} />

        {/* Checklist of what was set up */}
        <div
          className="rounded-2xl p-4 text-left space-y-2 mx-auto"
          style={{ background: '#fff', maxWidth: 400, boxShadow: '0 2px 12px rgba(10,15,44,0.08)' }}
        >
          {[
            { done: !!state.chaseClientName, label: msgs.agentSummary(1, 1).chase },
            { done: !!state.careStaffName, label: msgs.agentSummary(1, 1).care },
            { done: true, label: msgs.agentSummary(1, 1).alex },
            { done: true, label: msgs.agentSummary(1, 1).doc },
            { done: !!state.penRecipientName, label: msgs.agentSummary(1, 1).pen },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span style={{ color: item.done ? FOREST : '#9CA3AF' }}>
                {item.done ? '✅' : '○'}
              </span>
              <span style={{ color: item.done ? NAVY : '#9CA3AF' }}>{item.label}</span>
            </div>
          ))}
        </div>

        <button
          disabled={saving || completed}
          onClick={async () => {
            await complete()
            router.push('/dashboard')
          }}
          className="rounded-2xl px-8 py-4 text-base font-bold transition-all shadow-lg"
          style={{
            background: completed ? '#9CA3AF' : GOLD,
            color: '#fff',
            cursor: completed ? 'default' : 'pointer',
            minHeight: 56,
          }}
        >
          {completed ? '✓ Heading to your dashboard...' : msgs.dashboardButton}
        </button>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const stepRenderers = [
    renderStep0,
    renderStep1,
    renderStep2,
    renderStep3,
    renderStep4,
    renderStep5,
    renderStep6,
    renderStep7,
  ]

  return (
    <div className="min-h-screen" style={{ background: CREAM, paddingTop: 60, paddingBottom: 80 }}>
      <ProgressBar pct={pct} messages={msgs} />

      <div className="mx-auto px-4 py-8 space-y-8" style={{ maxWidth: 600 }}>
        {/* Render all steps up to and including current (conversation stays visible) */}
        {stepRenderers.slice(0, step + 1).map((render, i) => (
          <div key={i}>
            {i < step ? (
              // Completed steps — collapsed summary
              <CompletedStep step={i} state={state} msgs={msgs} />
            ) : (
              render()
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 text-xs px-3 py-1.5 rounded-full shadow-lg" style={{ background: '#fff', color: '#9CA3AF' }}>
          Saving...
        </div>
      )}
    </div>
  )
}

// ─── Completed Step Summary ───────────────────────────────────────────────────

function CompletedStep({
  step,
  state,
  msgs,
}: {
  step: number
  state: OnboardingState
  msgs: ReturnType<typeof getMessages>
}) {
  const summaries: Record<number, string | null> = {
    0: null,
    1: state.businessName ? `🏢 ${state.businessName} · ${state.businessType}` : null,
    2: state.chaseClientName ? `⚡ Chase ready — ${state.chaseClientName}, R${state.chaseAmount}` : `⚡ ${msgs.skipChase.slice(0, 50)}…`,
    3: state.careStaffName ? `💚 Care watching over ${state.careStaffName}` : `💚 Care setup skipped`,
    4: `💬 Alex loaded with ${msgs.alexExplainer.slice(0, 40)}…`,
    5: `📄 Doc trained on ${state.docType || 'your documents'}`,
    6: state.penRecipientName ? `✍️ Pen drafted welcome email for ${state.penRecipientName}` : `✍️ Pen setup skipped`,
  }
  const text = summaries[step]
  if (!text) return null
  return (
    <div className="text-xs px-4 py-2 rounded-xl" style={{ background: '#E8E0C8', color: '#6B7280' }}>
      {text}
    </div>
  )
}
