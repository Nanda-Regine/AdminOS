'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/dashboard/TopBar'
import { Plus, Trash2, ArrowLeft, Zap, Clock, MessageSquare } from 'lucide-react'
import Link from 'next/link'

type Step = {
  id:          string
  name:        string
  delay_hours: number
  message:     string
}

const TRIGGERS = [
  { value: 'new_contact',     label: 'New Contact' },
  { value: 'new_client',      label: 'New Client' },
  { value: 'overdue_invoice', label: 'Overdue Invoice' },
  { value: 'keyword',         label: 'Keyword Match' },
  { value: 'manual',          label: 'Manual Enrol' },
  { value: 'onboarding',      label: 'Onboarding' },
]

function newStep(index: number): Step {
  return {
    id:          crypto.randomUUID(),
    name:        `Step ${index + 1}`,
    delay_hours: index === 0 ? 0 : 24,
    message:     '',
  }
}

export default function NewSequencePage() {
  const router = useRouter()

  const [name,        setName]        = useState('')
  const [triggerType, setTriggerType] = useState('manual')
  const [steps,       setSteps]       = useState<Step[]>([newStep(0)])
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  function addStep() {
    setSteps(prev => [...prev, newStep(prev.length)])
  }

  function removeStep(id: string) {
    setSteps(prev => prev.filter(s => s.id !== id))
  }

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('Sequence name is required'); return }
    if (steps.length === 0) { setError('Add at least one step'); return }
    if (steps.some(s => !s.message.trim())) { setError('All steps must have a message'); return }

    setSaving(true)
    const res = await fetch('/api/sequences', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: name.trim(), trigger_type: triggerType, steps }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create sequence')
      setSaving(false)
      return
    }

    router.push('/dashboard/sequences')
  }

  return (
    <div>
      <TopBar title="New Sequence" subtitle="Build an automated multi-step message flow" />
      <div className="p-6 max-w-2xl">

        {/* Back */}
        <Link href="/dashboard/sequences"
          className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Sequences
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Name + Trigger */}
          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Sequence Details
            </h2>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Sequence Name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. New Client Welcome"
                maxLength={100}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{
                  background: 'var(--surface-2)',
                  border:     '1px solid var(--border)',
                  color:      'var(--text-primary)',
                  outline:    'none',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Trigger
              </label>
              <div className="flex flex-wrap gap-2">
                {TRIGGERS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTriggerType(t.value)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{
                      background: triggerType === t.value ? 'var(--indigo)' : 'var(--surface-2)',
                      color:      triggerType === t.value ? '#fff' : 'var(--text-muted)',
                      border:     `1px solid ${triggerType === t.value ? 'transparent' : 'var(--border)'}`,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Steps ({steps.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg"
                style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Step
              </button>
            </div>

            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={step.id}
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}>
                        {i + 1}
                      </div>
                      <input
                        value={step.name}
                        onChange={e => updateStep(step.id, { name: e.target.value })}
                        placeholder={`Step ${i + 1}`}
                        className="text-sm font-medium bg-transparent border-none outline-none"
                        style={{ color: 'var(--text-primary)', minWidth: 0 }}
                      />
                    </div>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(step.id)}
                        className="p-1 rounded-lg hover:opacity-70"
                        style={{ color: '#EF4444' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {i === 0 ? 'Send after' : 'Wait'}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={8760}
                      value={step.delay_hours}
                      onChange={e => updateStep(step.id, { delay_hours: Number(e.target.value) })}
                      className="w-16 px-2 py-1 rounded-lg text-xs text-center"
                      style={{
                        background: 'var(--surface-1)',
                        border:     '1px solid var(--border)',
                        color:      'var(--text-primary)',
                        outline:    'none',
                      }}
                    />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>hours</span>
                    {step.delay_hours >= 24 && (
                      <span className="text-xs" style={{ color: 'var(--indigo-light)' }}>
                        ({(step.delay_hours / 24).toFixed(1)}d)
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Message</span>
                      <span className="text-xs ml-auto" style={{ color: step.message.length > 3800 ? '#EF4444' : 'var(--text-muted)' }}>
                        {step.message.length}/4096
                      </span>
                    </div>
                    <textarea
                      value={step.message}
                      onChange={e => updateStep(step.id, { message: e.target.value })}
                      placeholder="Type your WhatsApp message here..."
                      maxLength={4096}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl text-sm resize-none"
                      style={{
                        background: 'var(--surface-1)',
                        border:     '1px solid var(--border)',
                        color:      'var(--text-primary)',
                        outline:    'none',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Visual timeline */}
            {steps.length > 1 && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Timeline:</span>
                {steps.map((s, i) => (
                  <span key={s.id} className="flex items-center gap-1">
                    {i > 0 && <span style={{ color: 'var(--text-muted)' }}>→</span>}
                    <span className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}>
                      {s.delay_hours}h
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: '#EF4444' }}>{error}</p>
          )}

          <div className="flex gap-3">
            <Link href="/dashboard/sequences"
              className="flex-1 text-center text-sm font-medium px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 text-sm font-medium px-4 py-2.5 rounded-xl"
              style={{
                background: saving ? 'var(--indigo-muted)' : 'var(--indigo)',
                color:      saving ? 'var(--indigo-light)' : '#fff',
                cursor:     saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Creating…' : 'Create Sequence'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
