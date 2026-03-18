'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'

const STEPS = [
  { id: 1, label: 'Business Profile' },
  { id: 2, label: 'Team' },
  { id: 3, label: 'Knowledge Base' },
  { id: 4, label: 'Strategy Doc' },
  { id: 5, label: 'Integrations' },
  { id: 6, label: 'Go Live' },
]

interface StaffRow { full_name: string; phone: string; role: string }

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Step 1
  const [formData, setFormData] = useState({
    name: '', businessType: 'retail', country: 'ZA',
    language: 'en', timezone: 'Africa/Johannesburg',
    whatsappNumber: '', faqs: '', policies: '', tone: 'warm', services: '',
  })
  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  // Step 2 — Team
  const [staffRows, setStaffRows] = useState<StaffRow[]>([
    { full_name: '', phone: '', role: 'staff' },
  ])
  const addStaffRow = () =>
    setStaffRows((prev) => [...prev, { full_name: '', phone: '', role: 'staff' }])
  const updateStaff = (i: number, field: keyof StaffRow, value: string) =>
    setStaffRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  const removeStaff = (i: number) =>
    setStaffRows((prev) => prev.filter((_, idx) => idx !== i))

  // Step 4 — Strategy doc
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedDoc, setUploadedDoc] = useState<string | null>(null)
  const [docUploading, setDocUploading] = useState(false)

  const next = () => setStep((s) => Math.min(s + 1, 6))
  const prev = () => setStep((s) => Math.max(s - 1, 1))

  const flash = (msg: string) => {
    setSaveMsg(msg)
    setTimeout(() => setSaveMsg(''), 4000)
  }

  // Step 1: Save profile
  const saveProfile = async () => {
    setSaving(true)
    const res = await fetch('/api/settings/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    setSaving(false)
    if (res.ok) { next() } else { flash('Failed to save profile. Please try again.') }
  }

  // Step 2: Save team
  const saveTeam = async () => {
    const validRows = staffRows.filter((r) => r.full_name.trim())
    if (!validRows.length) { next(); return } // skip if no staff added
    setSaving(true)
    const res = await fetch('/api/onboarding/add-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff: validRows }),
    })
    setSaving(false)
    if (res.ok) { flash(`Added ${validRows.length} team member(s).`); next() }
    else { flash('Failed to save team. Please try again.') }
  }

  // Step 3: Save knowledge base
  const saveKnowledge = async () => {
    setSaving(true)
    await fetch('/api/settings/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    setSaving(false)
    next()
  }

  // Step 4: Upload strategy doc
  const uploadStrategyDoc = async (file: File) => {
    setDocUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/documents/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) {
        setUploadedDoc(file.name)
        flash(`${file.name} uploaded — AI is extracting your goals.`)
      } else {
        flash(data.error || 'Upload failed.')
      }
    } catch {
      flash('Upload failed. Please try again.')
    } finally {
      setDocUploading(false)
    }
  }

  const handleStepAction = async () => {
    if (step === 1) await saveProfile()
    else if (step === 2) await saveTeam()
    else if (step === 3) await saveKnowledge()
    else next()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Step {step} of 6</p>
            <p className="text-sm text-gray-400">{STEPS[step - 1]?.label}</p>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((s) => (
              <div key={s.id} className={`text-xs font-medium ${s.id <= step ? 'text-emerald-600' : 'text-gray-400'}`}>
                {s.id < step ? '✓' : s.id}
              </div>
            ))}
          </div>
        </div>

        {saveMsg && (
          <div className="mb-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {saveMsg}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">

          {/* Step 1: Business Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Business Profile</h2>
                <p className="text-sm text-gray-400 mt-1">Tell us about your business so we can personalise your AI assistant.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business name *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.name} onChange={(e) => update('name', e.target.value)} placeholder="Sunshine Hardware" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business type</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.businessType} onChange={(e) => update('businessType', e.target.value)}>
                    <option value="retail">Retail / Shop</option>
                    <option value="school">School / Education</option>
                    <option value="clinic">Clinic / Medical</option>
                    <option value="ngo">NGO / Non-profit</option>
                    <option value="property">Property</option>
                    <option value="legal">Legal</option>
                    <option value="government">Government / Municipality</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.country} onChange={(e) => update('country', e.target.value)}>
                    <option value="ZA">South Africa</option>
                    <option value="ZW">Zimbabwe</option>
                    <option value="KE">Kenya</option>
                    <option value="NG">Nigeria</option>
                    <option value="GH">Ghana</option>
                    <option value="UG">Uganda</option>
                    <option value="TZ">Tanzania</option>
                    <option value="BW">Botswana</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp number</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.whatsappNumber} onChange={(e) => update('whatsappNumber', e.target.value)} placeholder="+27 82 000 0000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary language</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.language} onChange={(e) => update('language', e.target.value)}>
                    <option value="en">English</option>
                    <option value="af">Afrikaans</option>
                    <option value="zu">Zulu (isiZulu)</option>
                    <option value="xh">Xhosa (isiXhosa)</option>
                    <option value="st">Sesotho</option>
                    <option value="tn">Setswana</option>
                    <option value="ts">Tsonga</option>
                    <option value="sw">Swati</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Team */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Your Team</h2>
                <p className="text-sm text-gray-400 mt-1">Add staff so AdminOS can send them wellness check-ins and process leave requests.</p>
              </div>
              <div className="space-y-3">
                {staffRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Full name *"
                      value={row.full_name}
                      onChange={(e) => updateStaff(i, 'full_name', e.target.value)}
                    />
                    <input
                      className="col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="+27 82 000 0000"
                      value={row.phone}
                      onChange={(e) => updateStaff(i, 'phone', e.target.value)}
                    />
                    <select
                      className="col-span-2 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={row.role}
                      onChange={(e) => updateStaff(i, 'role', e.target.value)}
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    {staffRows.length > 1 && (
                      <button onClick={() => removeStaff(i)} className="col-span-1 text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={addStaffRow}>+ Add another</Button>
              <p className="text-xs text-gray-400">You can also add staff later from the Staff page.</p>
            </div>
          )}

          {/* Step 3: Knowledge Base */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Knowledge Base</h2>
                <p className="text-sm text-gray-400 mt-1">This is what your AI will know and say about your business.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Top FAQs</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  rows={4} value={formData.faqs} onChange={(e) => update('faqs', e.target.value)}
                  placeholder={'Q: What are your hours?\nA: Monday-Friday 8am-5pm\n\nQ: Do you offer credit?\nA: Yes, for accounts in good standing'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Services & Products</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  rows={3} value={formData.services} onChange={(e) => update('services', e.target.value)}
                  placeholder="List your main services and products..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business policies</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  rows={2} value={formData.policies} onChange={(e) => update('policies', e.target.value)}
                  placeholder="Return policy, payment terms, booking rules..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bot tone</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={formData.tone} onChange={(e) => update('tone', e.target.value)}>
                  <option value="warm">Warm & Friendly</option>
                  <option value="formal">Formal & Professional</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Strategy doc */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Strategy Document</h2>
                <p className="text-sm text-gray-400 mt-1">Upload your business plan, strategic goals, or KPI doc. Claude extracts your goals automatically.</p>
              </div>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  uploadedDoc ? 'border-emerald-400 bg-emerald-50' : 'border-emerald-200 bg-emerald-50 hover:border-emerald-400'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.txt,.md"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadStrategyDoc(f) }}
                />
                {uploadedDoc ? (
                  <>
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-sm font-medium text-emerald-700">{uploadedDoc}</p>
                    <p className="text-xs text-emerald-600 mt-1">AI is processing your goals...</p>
                    <button onClick={(e) => { e.stopPropagation(); setUploadedDoc(null) }}
                      className="text-xs text-gray-400 hover:text-gray-600 mt-2 underline">Upload a different file</button>
                  </>
                ) : docUploading ? (
                  <>
                    <p className="text-3xl mb-2 animate-pulse">⏳</p>
                    <p className="text-sm text-gray-600">Uploading and analysing...</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl mb-2">📎</p>
                    <p className="text-sm font-medium text-gray-700 mb-1">Upload PDF, Word, Excel, or PowerPoint</p>
                    <p className="text-xs text-gray-400 mb-4">Max 50MB · Encrypted & private</p>
                    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>Choose file</Button>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-400 text-center">
                Optional but powerful — unlocks Goal Tracker and personalised AI advisor insights.
              </p>
            </div>
          )}

          {/* Step 5: Integrations */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Connect Integrations</h2>
                <p className="text-sm text-gray-400 mt-1">Connect the tools your business already uses. You can skip and connect later.</p>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Gmail', icon: '✉️', desc: 'Sync and route inbound emails', status: 'coming_soon' },
                  { label: 'Google Calendar', icon: '📅', desc: 'Leave & appointment management', status: 'coming_soon' },
                  { label: 'PayFast', icon: '💳', desc: 'SA payment processing', status: 'coming_soon' },
                  { label: 'Xero', icon: '📊', desc: 'Invoice & accounting sync', status: 'coming_soon' },
                  { label: 'Google Drive', icon: '📁', desc: 'Auto-sync uploaded documents', status: 'coming_soon' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Coming soon</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Go Live */}
          {step === 6 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl mx-auto">🚀</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">You&apos;re live!</h2>
                <p className="text-sm text-gray-400 mt-1">AdminOS is now running your business in the background.</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left space-y-2">
                {[
                  'AI trained on your business',
                  'Dashboard ready',
                  'WhatsApp bot configured',
                  'Daily brief will arrive Monday morning',
                  'Debt recovery running automatically',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-emerald-800">
                    <span>✅</span> {item}
                  </div>
                ))}
              </div>
              <Button onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard →
              </Button>
            </div>
          )}

          {/* Navigation */}
          {step < 6 && (
            <div className="flex justify-between mt-6 pt-6 border-t border-gray-100">
              <Button variant="ghost" onClick={prev} disabled={step === 1}>← Back</Button>
              <div className="flex items-center gap-3">
                {step >= 2 && step <= 4 && (
                  <button onClick={next} className="text-sm text-gray-400 hover:text-gray-600">
                    Skip →
                  </button>
                )}
                <Button onClick={handleStepAction} loading={saving}>
                  {step === 5 ? 'Finish Setup →' : 'Save & Continue →'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
